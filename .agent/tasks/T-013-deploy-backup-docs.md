---
id: T-013
title: deploy + backup + DEPLOY.md
owner: claude-sonnet-5 (subagent)
scope: infra/{deploy.sh,backup/**,uptime/**}, docs/DEPLOY.md
exit: `bash -n infra/deploy.sh`; `docker compose config` validates with the backup service; DEPLOY.md covers the hardening checklist
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 14
---

## Plan
deploy.sh (git pull, compose pull, up -d), daily pg_dump keep 7, Uptime Kuma, VPS hardening (non-root user + key, no root/password SSH, ufw 22/80/443). The user runs it on the VPS; agents never SSH.

## Execute
## Review
## Test
## Handoff
