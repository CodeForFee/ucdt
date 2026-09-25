# Triển khai UCDT lên VPS

Hướng dẫn này dành cho một VPS Ubuntu 2 vCPU / 3.78 GB RAM chạy Docker Compose, kéo image
từ GHCR (`ghcr.io/codeforfee/ucdt-{climate,gateway,web}`) do pipeline CI (T-012) publish với
các tag `dev`, `main`, `sha-<short>` và `latest` (trên `main`).

## 1. Yêu cầu VPS và cài Docker

- Ubuntu 22.04/24.04 LTS, 2 vCPU, ~3.78 GB RAM (đủ dùng — toàn bộ stack hiện đo được
  ~213 MiB thực tế, `mem_limit` cộng dồn ~1.9 GB kể cả backup + Uptime Kuma).
- Cài Docker Engine + Compose plugin theo hướng dẫn chính thức:

  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"   # rồi đăng xuất/đăng nhập lại
  docker compose version            # xác nhận plugin v2 có sẵn
  ```

## 2. Checklist hardening (bắt buộc trước khi mở port ra Internet)

1. **Tạo user sudo không phải root, dùng SSH key:**
   ```bash
   sudo adduser deploy
   sudo usermod -aG sudo,docker deploy
   sudo mkdir -p /home/deploy/.ssh
   sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
   sudo chown -R deploy:deploy /home/deploy/.ssh
   sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys
   ```
2. **Khoá SSH bằng mật khẩu và đăng nhập root** — sửa `/etc/ssh/sshd_config`:
   ```
   PermitRootLogin no
   PasswordAuthentication no
   ```
   rồi `sudo systemctl restart sshd`. Kiểm tra đăng nhập bằng key ở một phiên SSH **khác**
   trước khi đóng phiên hiện tại — lỡ tay khoá nhầm là mất quyền truy cập VPS.
3. **Tường lửa `ufw`** — chỉ mở 22 (SSH), 80/443 (HTTP/HTTPS). Cổng Uptime Kuma (3100) **không**
   mở ra ngoài — chỉ vào qua SSH tunnel (mục 8):
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   sudo ufw status verbose
   ```
4. **Tự động cập nhật bản vá bảo mật:**
   ```bash
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```
5. **fail2ban (tuỳ chọn nhưng nên bật)** — chặn brute-force SSH:
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable --now fail2ban
   ```

## 3. Clone repo riêng tư (private)

Repo là private nên cần deploy key (khuyến nghị, chỉ đọc, riêng cho VPS) hoặc PAT:

```bash
ssh-keygen -t ed25519 -C "ucdt-vps-deploy" -f ~/.ssh/ucdt_deploy_key -N ""
cat ~/.ssh/ucdt_deploy_key.pub   # thêm vào GitHub repo -> Settings -> Deploy keys (read-only)
GIT_SSH_COMMAND="ssh -i ~/.ssh/ucdt_deploy_key" git clone git@github.com:CodeForFee/ucdt.git
```

(hoặc dùng PAT: `git clone https://<user>:<PAT>@github.com/CodeForFee/ucdt.git`).

## 4. Đăng nhập GHCR

Image `ucdt-*` là private, cần PAT với scope `read:packages`:

```bash
export CR_PAT=<personal-access-token-read:packages>
echo "$CR_PAT" | docker login ghcr.io -u <github-username> --password-stdin
```

## 5. Tạo `infra/.env`

```bash
cp infra/.env.example infra/.env
```

Sửa các giá trị trong `infra/.env`:

- `POSTGRES_PASSWORD` — đặt mật khẩu mạnh (Postgres không public ra ngoài compose network,
  nhưng đừng để mặc định `ucdt`).
- `VITE_MAPBOX_TOKEN` — bắt buộc phải có giá trị non-empty: `infra/compose.yml` khai báo biến
  này là required (`${VITE_MAPBOX_TOKEN:?...}`) cho build arg của `nginx`/`nginx-cert-init`
  (image web), và Compose kiểm tra điều này ngay cả khi bạn không build (chỉ pull image có sẵn
  từ GHCR) — set token thật vào đây.
- `SITE_ADDRESS` — domain (vd. `ucdt.example.org`) để nginx phục vụ đúng `server_name` và
  certbot xin chứng chỉ HTTPS thật (mục 6b); để mặc định `localhost` nếu chỉ test bằng IP —
  nginx vẫn luôn bật TLS nhưng dùng chứng chỉ tự ký (`infra/certbot/dummy-cert.sh`), trình
  duyệt sẽ cảnh báo "không an toàn" cho tới khi có domain thật.
- `BACKUP_DIR` (không có sẵn trong `.env.example`, thêm nếu muốn đổi) — thư mục trên host chứa
  bản backup, mặc định `/var/backups/ucdt`:
  ```bash
  echo 'BACKUP_DIR=/var/backups/ucdt' >> infra/.env
  sudo mkdir -p /var/backups/ucdt
  sudo chown "$USER" /var/backups/ucdt
  ```

## 6. Deploy lần đầu

```bash
UCDT_TAG=main infra/deploy.sh    # hoặc bỏ UCDT_TAG, mặc định là "main"
```

`infra/deploy.sh` sẽ:
1. `git pull --ff-only` (repo phải sạch, không có local commit lệch nhánh).
2. `docker compose -f infra/compose.yml -f infra/compose.prod.yml pull` — kéo image
   `ucdt-climate` / `ucdt-gateway` / `ucdt-web` từ GHCR theo tag `UCDT_TAG` (mặc định `main`).
3. `up -d --no-build --remove-orphans --wait` — khởi động toàn bộ stack (postgres, redis,
   migrate, climate-api, climate-worker, gateway ×2, `nginx-cert-init` (ghi chứng chỉ tự ký
   nếu chưa có), nginx, backup, uptime-kuma), chờ healthcheck.
4. In trạng thái service (`compose ps`) rồi `docker image prune -f` dọn image cũ không dùng.
5. Từ chối chạy nếu thiếu `infra/.env`.

Sau khi chạy xong, mở `https://<ip-hoặc-domain>/` để kiểm tra — lần đầu trên domain thật sẽ
thấy cảnh báo chứng chỉ tự ký, chạy tiếp mục **6b** để có HTTPS thật.

### 6b. Xin chứng chỉ HTTPS thật (chỉ chạy 1 lần, sau khi DNS đã trỏ về VPS)

```bash
infra/certbot/init.sh
```

Script thay chứng chỉ tự ký bằng chứng chỉ Let's Encrypt thật cho `SITE_ADDRESS`, rồi reload
nginx. Sau đó cài cron gia hạn hằng ngày trên **host** (không phải trong container):

```bash
sudo crontab -e
# thêm dòng:
0 3 * * * /opt/ucdt/infra/certbot/renew-cron.sh >> /var/log/ucdt-certbot.log 2>&1
```

`certbot renew` không làm gì nếu chứng chỉ chưa gần hết hạn, nên chạy hằng ngày là an toàn.

## 7. Cập nhật và rollback

**Cập nhật lên bản mới nhất trên `main`:**
```bash
infra/deploy.sh
```

**Rollback về một bản build cụ thể** (mọi image T-012 publish đều có tag `sha-<short>`):
```bash
UCDT_TAG=sha-abc1234 infra/deploy.sh
```

Script vẫn `git pull` — nếu bạn muốn rollback code lẫn image, `git checkout <tag/commit>` trước
khi chạy, hoặc chỉ set `UCDT_TAG` để rollback image mà giữ nguyên `docs`/`infra` hiện tại.

## 8. Backup

- Service `backup` (postgres:16-alpine, khớp major version với `postgres:16-3.4` đang chạy)
  chạy `infra/backup/backup.sh` một lần ngay khi container khởi động, sau đó lặp lại mỗi 24h
  (`infra/backup/entrypoint.sh`).
- Mỗi lần chạy tạo `${BACKUP_DIR:-/var/backups/ucdt}/ucdt-<UTC-timestamp>.dump` (`pg_dump -Fc`,
  định dạng custom của Postgres — nén sẵn, restore chọn lọc bảng được), log vào
  `backup.log` trong cùng thư mục và ra `docker compose logs backup`.
- Chỉ giữ lại **7 bản mới nhất** — bản cũ hơn bị xoá tự động sau mỗi lần dump thành công.
- **Copy backup ra khỏi VPS** (đừng chỉ tin vào ổ đĩa của VPS):
  ```bash
  scp deploy@<vps>:/var/backups/ucdt/ucdt-*.dump ./local-backups/
  # hoặc rsync định kỳ từ máy khác / một cron trên VPS đẩy lên nơi lưu trữ ngoài (S3, Backblaze...)
  ```
- **Restore** (chạy trên VPS, dùng `docker` / `docker compose`, KHÔNG cần SSH vào container
  thủ công):
  ```bash
  infra/backup/restore.sh /var/backups/ucdt/ucdt-20260924T0300Z.dump
  ```
  Script sẽ:
  1. Cảnh báo rõ ràng, yêu cầu gõ lại đúng tên database để xác nhận (bắt buộc, không có cách
     bỏ qua).
  2. **Dừng `climate-api`, `climate-worker`, `backup`** (`docker compose stop`, đường dẫn tới
     `infra/compose.yml`/`infra/compose.prod.yml` tự suy ra từ vị trí của script, chạy được dù
     bạn đứng ở thư mục nào) — đây là các service duy nhất giữ kết nối tới Postgres, dừng
     chúng trước để `dropdb` không bị chặn.
  3. `dropdb --force` (backstop: tự ngắt mọi kết nối còn sót lại, kể cả một phiên `psql` ai đó
     quên đóng) + `createdb` + `pg_restore --no-owner`.
  4. **Khởi động lại `climate-api`, `climate-worker`, `backup`** — luôn chạy bước này kể cả khi
     restore ở bước 3 thất bại giữa chừng (dùng `trap` trên EXIT), để một lần restore lỗi
     không để stack ở trạng thái "đã tắt mất API".

  **Restore đè lên database đích** — nếu chỉ muốn thử/kiểm tra, truyền tên database khác làm
  tham số thứ hai (khi đó việc dừng/khởi động lại 3 service ở trên vẫn chạy, vì chúng không
  biết trước database nào đang bị restore):
  ```bash
  infra/backup/restore.sh /var/backups/ucdt/ucdt-20260924T0300Z.dump ucdt_scratch
  ```
  `RESTORE_DRY_RUN=1` in ra lệnh `docker compose stop`/`start` thay vì chạy thật — dùng khi
  muốn kiểm thử `restore.sh` nhắm vào một database phụ mà không đụng tới stack đang chạy thật.

## 9. Giám sát với Uptime Kuma

`uptime-kuma` chỉ publish trên `127.0.0.1:3100` của VPS — không lộ ra Internet. Truy cập qua
SSH tunnel từ máy của bạn:

```bash
ssh -L 3100:127.0.0.1:3100 deploy@<vps-ip-hoặc-domain>
```

rồi mở `http://localhost:3100` trên trình duyệt máy bạn. Lần đầu vào sẽ yêu cầu tạo tài khoản
admin.

**Monitor gợi ý:**
- HTTP(s) — `http://<vps>/` hoặc domain, path `/` — kiểm tra nginx + web còn sống.
- HTTP(s) — `http://<vps>/api/weather` — kiểm tra xuyên suốt cả chuỗi gateway -> climate-api ->
  Postgres (trả 200 nghĩa là toàn bộ pipeline dữ liệu đang hoạt động, không chỉ web tĩnh).
- Có thể thêm `/api/aqi`, `/api/flood`, `/api/heat` nếu muốn giám sát riêng từng hazard.

## 10. Xử lý sự cố (troubleshooting)

| Triệu chứng | Kiểm tra |
|---|---|
| `deploy.sh` báo thiếu `infra/.env` | Chạy bước 5 (`cp infra/.env.example infra/.env`, điền giá trị). |
| `docker compose ... config` báo thiếu `VITE_MAPBOX_TOKEN` | Biến này bắt buộc trong `infra/.env` dù không build image — xem mục 5. |
| `git pull --ff-only` báo lỗi diverged | VPS có commit/local change không sync với `dev`/`main` — không tự ý `reset --hard`, kiểm tra `git status`/`git log` trước. |
| Service không `healthy` sau `deploy.sh` | `docker compose -f infra/compose.yml -f infra/compose.prod.yml logs <service>` — thứ tự khởi động là postgres → migrate → climate-api → gateway/gateway2 → nginx-cert-init → nginx, lỗi ở bước nào chặn các bước sau. |
| `nginx` không lên, log báo thiếu cert | `nginx-cert-init` chưa chạy xong hoặc volume `letsencrypt_certs` bị xoá — chạy lại `docker compose ... up -d nginx-cert-init` rồi `up -d nginx`. |
| Trình duyệt báo chứng chỉ không an toàn dù đã chạy `certbot/init.sh` | Kiểm tra DNS `SITE_ADDRESS` đã trỏ đúng VPS chưa (`dig`/`nslookup`) — certbot cần domain phân giải đúng trước khi xin chứng chỉ mới xin lại được. |
| `docker login ghcr.io` báo 401/403 | PAT hết hạn hoặc thiếu scope `read:packages` — tạo PAT mới. |
| Web trắng trang / lỗi ngay khi mở | `apps/web` yêu cầu `VITE_MAPBOX_TOKEN` hợp lệ tại **build time** (image `ucdt-web` được T-012 build sẵn) — nếu ảnh GHCR build với token placeholder, phải yêu cầu rebuild/publish lại image với token thật, đổi token trong `infra/.env` không có tác dụng với image đã build sẵn. |
| Backup không tạo file mới | `docker compose logs backup`; kiểm tra `BACKUP_DIR` trên host có tồn tại và ghi được (`ls -la /var/backups/ucdt`). |
| RAM gần chạm giới hạn VPS | `docker stats` — tổng `mem_limit` của stack (~1.9 GB) vẫn dưới 3.78 GB, nhưng nếu VPS chạy thêm tiến trình khác, cân nhắc giảm `mem_limit` của các service ít quan trọng hơn (vd. `uptime-kuma`) trong `infra/compose.prod.yml`. |
