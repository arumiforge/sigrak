# R0-11 — Version and server decisions

- **Phase:** R0
- **Status:** review
- **Owner:** r0/r0-11-version-and-server-decisions
- **Depends on:** R0-05
- **Can run in parallel with:** R0-06…R0-08

## Goal

Record the owner's confirmed choices on versions and servers (proposed in the previous session, confirmed "setuju semua" on 2026-11-27) and move the app to them.

## Output

- `DECISIONS.md`: D-412 version policy (Node 26 LTS, PostgreSQL 19, latest LTS/stable, pinned), D-413 Ubuntu 26.04, D-414 nginx, D-415 Compose and replicas, D-416 setup flow, D-417 SSH and Cloudflare Access, D-418 tmux, D-419 server guides in Indonesian, D-420 CalVer, D-421 Fondasi left to the owner; markers on D-086, D-388, D-391, D-398
- App: `.nvmrc` 26, `package.json` engines, CI and `compose.yaml` on `pgvector/pgvector:pg19` and `redis:8.8-alpine`
- `.claude/cloud/setup.sh` (Node 26, PostgreSQL 19, stops other PostgreSQL clusters that would take port 5432) and `docs/agent/cloud-environment.md`
- `CLAUDE.md` stack line, `CONTEXT.md`, `README.md`, `PROGRESS.md` (R3 scope), `docs/drafts/fondasi-uptake.md`, developer handbook + Indonesian source + PDF, owner's handbook v3

## Result

Done on 2026-11-27. On Node 26.13 and PostgreSQL 19.0: 17 Japa tests, lint, format check, typecheck, build pass; `npm audit --omit=dev` finds 0 vulnerabilities. The proposals in `docs/server/rekomendasi-tambahan.md` are not decisions yet.
