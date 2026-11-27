# Claude cloud environment for SIGRAK

Settings the owner applies once per Claude account (claude.ai → Claude Code → the environment menu in the session title bar → Edit). The script lives in the repository, so changing it here updates every account. Follows Fondasi `docs/cloud-environment.md`. Never put secrets in environment variables: they are stored in plain text.

| Setting | Value |
|---|---|
| Name | `SIGRAK` |
| Repositories | `arumiforge/sigrak`, plus `arumiforge/fondasi` (read-only use, `docs/agent/fondasi-check.md`) |
| Network access | Limited with "Allow package managers", plus the hosts below (or Full) |
| Environment variables | below |
| Setup script | `if [ -f sigrak/.claude/cloud/setup.sh ]; then bash sigrak/.claude/cloud/setup.sh; fi` |

## What the setup script installs

`.claude/cloud/setup.sh` is idempotent and never fails the session start:

- Node.js 26 LTS (D-412) in `/opt/node26`, next to the image's Node 22. If `node -v` still shows 22, run `export PATH=/opt/node26/bin:$PATH` first.
- PostgreSQL 19 with pgvector (D-398, D-412), started on port 5432; other clusters in the image (such as 16) are stopped and set to manual start. Local role `sigrak` (password `sigrak`, local only), databases `sigrak` and `sigrak_test`.
- Redis, started.
- Typst CLI (D-399 spike) and k6 (R0-08).
- pandoc, Liberation and Noto fonts, for the docs PDF build.
- Git identity `Arumi Studios <arumiforge@gmail.com>`, `core.hooksPath .githooks`, and, when `pnpm-lock.yaml` exists, pnpm at the version pinned in `package.json` plus `pnpm install --frozen-lockfile` (D-422).

The script finds the repository root from its own path, so it works whatever the checkout folder is called; set `SIGRAK_DIR` to override. Only the new stack is installed; nothing from the old stack is needed (D-407, D-411).

## Environment variables (no secrets)

| Variable | Value | Used by |
|---|---|---|
| `TZ` | `Asia/Jakarta` | dates in logs and data versions (D-165) |
| `ARUMI_GIT_NAME` / `ARUMI_GIT_EMAIL` | `Arumi Studios` / `arumiforge@gmail.com` | setup script and session hook |
| `ARUMI_ACCOUNT` | a neutral label such as `akun-1` | session labels (never an email or a name) |
| `NODE_EXTRA_CA_CERTS` | `/root/.ccr/ca-bundle.crt` | Node tools behind the session proxy, if a TLS error appears |

## Hosts for Limited network access

| Host | Why |
|---|---|
| `github.com`, `objects.githubusercontent.com`, `codeload.github.com` | repositories, Typst release download |
| `registry.npmjs.org` | npm packages (covered by "Allow package managers") |
| `nodejs.org` | Node.js 26 download |
| `apt.postgresql.org`, `www.postgresql.org` | PostgreSQL 19 packages and key |
| `dl.k6.io` | k6 packages |

Docker has no daemon in cloud sessions, so `compose.yaml` is for laptops and servers; cloud sessions use the PostgreSQL and Redis the script starts.

## Ready to paste (Claude account → environment settings)

Copy each block into the matching field of the environment form. The setup script cannot read the environment variables saved in the form, so the versions it needs are passed on the script line itself.

**Name**

```
SIGRAK
```

**Repositories** (add both)

```
arumiforge/sigrak
arumiforge/fondasi
```

**Network access**: choose **Limited**, turn on **Allow package managers**, then add these allowed hosts (one per line). Or choose **Full**.

```
github.com
objects.githubusercontent.com
codeload.github.com
release-assets.githubusercontent.com
registry.npmjs.org
nodejs.org
apt.postgresql.org
www.postgresql.org
dl.k6.io
```

**Environment variables** (`.env` format, no secrets)

```
TZ=Asia/Jakarta
ARUMI_GIT_NAME=Arumi Studios
ARUMI_GIT_EMAIL=arumiforge@gmail.com
ARUMI_ACCOUNT=akun-1
NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
```

Change `ARUMI_ACCOUNT` per Claude account (`akun-1`, `akun-2`, …); never an e-mail or a name.

**Setup script**

```bash
#!/bin/bash
if [ -f sigrak/.claude/cloud/setup.sh ]; then
  SIGRAK_NODE_MAJOR=26 SIGRAK_PG_MAJOR=19 bash sigrak/.claude/cloud/setup.sh
fi
```

After saving, start a **new** session in this environment; existing sessions keep the old settings. Check the first lines of the session log for `setup:` messages (Node 26, PostgreSQL 19, pnpm). If one says "could not install", the session still starts; tell the agent which line failed.
