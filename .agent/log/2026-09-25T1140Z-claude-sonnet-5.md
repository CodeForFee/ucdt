---
agent: claude-sonnet-5
session: c99eb68e
started: 2026-09-25T0330Z
ended: 2026-09-25T1140Z
scope: whole repo (live production deploy + live QA feedback loop); VPS 103.77.208.150
branch: dev
status: done
---

## Did
- First production deploy: VPS hardened (ufw, fail2ban, unattended-upgrades, deploy key +
  deploy user for SSH — root/password login still open, waiting on the user's own public key
  to close it), domain po-ucdt.top wired to Let's Encrypt via Caddy. PR #64 (dev->main)
  unblocked (see earlier log 2026-09-25T0845Z / 1000Z — main's squash-merge history means every
  dev->main promotion needs this same merge-and-keep-dev's-side resolution; user has since
  switched to real merge commits going forward, which should stop the recurrence).
- Live UI feedback loop (#67, #68): removed the redundant simulation "Run" button (auto-
  simulate already runs on a 150ms debounce), hid raw formulas/pi/ruleId/the maturity card
  from end users across Simulation, Dashboard and Recommendations, fixed Recommendations
  staying Vietnamese in English (new `recRules` i18n catalog keyed by ruleId), restyled Alerts
  to match Recommendations and fixed three pages not scrolling (Alerts, Flood, Air-quality —
  all missing AppLayout's required `h-full overflow-y-auto` wrapper).
- Infra migration Caddy -> nginx + certbot + a second gateway replica (#68, #74/#75): live
  cutover hit a real bug (nginx:alpine has no openssl CLI, `nginx-cert-init` exited 127 —
  hotfixed live via a throwaway alpine container, permanent fix is `apk add openssl` in
  infra/web.Dockerfile now on dev). Real Let's Encrypt cert obtained via infra/certbot/init.sh,
  daily renewal cron installed on the VPS host.
- CI auto-deploy wired up (#74/#75): .github/workflows/deploy.yml SSHes into the VPS's
  `deploy` user (forced-command-restricted key, can only run infra/deploy.sh) after `images`
  publishes on main. Not yet exercised for real — will fire on the next dev->main promotion.
- Alerts i18n (#67/#75): same Vietnamese-only bug as Recommendations, but alerts are generated
  once by the worker and persisted, with no ruleId/inputs to rebuild from client-side.
  Migration 003 adds nullable unit_id/unit_name/value to `alerts`; rules.py/snapshots.py
  populate them; FE rebuilds title/message from a new `alertRules` catalog
  (shared/lib/alertText.ts), falling back to the server's Vietnamese text for a pre-migration
  row (unitName/value null) — same fallback shape as Recommendations' ruleId fallback.
- README polished: badges, live link, nginx architecture, a CI/CD section (image publish is
  automatic, VPS deploy was manual until this session's deploy.yml).
- Repo setting changed: `allow_merge_commit` was false (squash-only) — enabled at the user's
  request after diagnosing the squash-caused conflict-recreation bug.

## Verified
- Web: `tsc -b --noEmit` clean and `vitest run` 87/87 green on every PR (#68, #72, #75) before
  merge — re-verified after each fixture/type break CI caught (SimAlert.value missing from a
  fixture; caught by CI's web-image build, not local tsc, because contracts were regenerated a
  second time without re-running tsc first — logged so the next agent re-runs tsc after ANY
  contracts regen, not just the first one in a session).
- Python: `uv run pytest` — 219-263 non-DB tests pass locally (no local Postgres on this
  machine); the DB-dependent tests (migration roundtrip, alert insert/list, worker, the two
  tests broken by the new Alert/SimAlert fields) were verified green via `climate.yml`'s real
  Postgres service container in CI on PR #75, not locally.
- Live VPS, post-cutover: `curl https://po-ucdt.top/` -> 200 with a trusted Let's Encrypt cert
  (`openssl s_client`/browser both confirm), `/api/weather` -> 200, `docker compose ps` all
  services healthy including the new `nginx`, `gateway2`, `certbot` (exits 0, by design).
- `docker compose config` (both alone and merged with compose.prod.yml) validates the nginx/
  certbot/gateway2 compose changes — this is NOT a docker build; the actual image build was
  only verified via CI (no local Docker daemon on this machine either).
- Did NOT verify end-to-end: the new alertRules i18n text against a REAL alert with
  unit_name/value populated (migration 003 hasn't run on the VPS yet — it ships with the next
  dev->main promotion + deploy.sh run, whether via the new deploy.yml or manually). Until then
  every alert on the live site still shows the old Vietnamese-only text; that is expected, not
  a bug.

## Next
- User promotes dev -> main (their action). This should now auto-trigger deploy.yml, which
  runs infra/deploy.sh on the VPS — first real exercise of the auto-deploy pipeline. Watch it:
  if the forced-command SSH key or the `deploy` user's docker-group permissions have any issue,
  it'll fail loudly in the Actions log rather than silently.
- After that deploy: confirm migration 003 applied (`docker compose exec climate-api alembic
  current` should show 003), and that a freshly-fired alert shows unit_name/value non-null.
- Still open: root/password SSH login on the VPS (waiting on the user's own public key to lock
  it down per docs/DEPLOY.md's hardening checklist); Sentry/error-tracking (needs the user's
  own account/DSN); ScenarioRecommendations' counterfactual alert preview still shows the
  server's raw Vietnamese title (lower priority than the main Alerts page, not yet requested).
