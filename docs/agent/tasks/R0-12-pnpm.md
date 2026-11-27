# R0-12 — pnpm replaces npm

- **Phase:** R0
- **Status:** done (merged in the previous repository)
- **Owner:** r0/r0-12-pnpm
- **Depends on:** R0-11

## Goal

Move the app from npm to pnpm (owner: "setuju, pakai pnpm", "pnpm ok"), with install-script and release-age controls (D-422).

## Output

- `package.json` `packageManager: pnpm@12.23.0`, `audit:prod` on `pnpm audit`; `pnpm-lock.yaml` (imported from the npm lock file, same resolved versions) replaces `package-lock.json`
- `pnpm-workspace.yaml`: `allowBuilds` (`@swc/core` denied), `minimumReleaseAge: 1440`
- CI on `pnpm/action-setup` + `pnpm install --frozen-lockfile`; `.prettierignore`; README; `.claude/cloud/setup.sh` and `docs/agent/cloud-environment.md`; CONTEXT; D-422; owner's handbook v4

## Result

Done on 2026-11-27. With pnpm 12.23 on Node 26.13 and PostgreSQL 19.0: frozen install, lint, format check, typecheck, 17 Japa tests and build pass; `pnpm audit --prod` finds no known vulnerabilities. The Dockerfile (`pnpm fetch` + offline install) comes with R3.
