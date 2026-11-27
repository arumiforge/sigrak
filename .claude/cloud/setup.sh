#!/usr/bin/env bash
# Cloud environment setup for SIGRAK sessions (docs/agent/cloud-environment.md).
# Runs as root; finds the repository root from its own path (SIGRAK_DIR overrides it). Idempotent; an optional tool that fails
# to install prints a line and never fails the session start.
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive
APP_DIR="${SIGRAK_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NODE_MAJOR="${SIGRAK_NODE_MAJOR:-26}"
PG_MAJOR="${SIGRAK_PG_MAJOR:-19}"
log() { echo "setup: $*"; }
apt_updated=0
apt_install() {
    [ "$apt_updated" = 1 ] || { apt-get update -q >/dev/null 2>&1 || true; apt_updated=1; }
    apt-get install -y -q "$@" >/dev/null 2>&1
}

# Node.js LTS (D-412) in /opt/node$NODE_MAJOR. Cloud images put /opt/node22/bin before /usr/local/bin on PATH,
# so the check looks at the install folder itself, and a profile snippet puts that folder first for sessions.
NODE_BIN="/opt/node${NODE_MAJOR}/bin"
if ! "$NODE_BIN/node" -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
    ver=$(curl -fsSL https://nodejs.org/dist/index.json 2>/dev/null \
        | python3 -c "import json,sys;print(next(x['version'] for x in json.load(sys.stdin) if x['version'].startswith('v${NODE_MAJOR}.')))" 2>/dev/null)
    if [ -n "$ver" ] && curl -fsSL "https://nodejs.org/dist/${ver}/node-${ver}-linux-x64.tar.xz" -o /tmp/node.tar.xz; then
        if mkdir -p "/opt/node${NODE_MAJOR}" && tar -xJf /tmp/node.tar.xz -C "/opt/node${NODE_MAJOR}" --strip-components=1; then
            log "node $ver installed"
        else
            log "could not unpack Node.js $ver (optional)"
        fi
        rm -f /tmp/node.tar.xz
    else
        log "could not install Node.js ${NODE_MAJOR} (optional; found $(node -v 2>/dev/null || echo none))"
    fi
fi
if [ -x "$NODE_BIN/node" ]; then
    export PATH="$NODE_BIN:$PATH"
    # Links for tools that only look in /usr/local/bin; drop links whose target is gone (Node 25+ has no corepack).
    for tool in node npm npx corepack pnpm pnpx; do
        if [ -e "$NODE_BIN/$tool" ]; then ln -sf "$NODE_BIN/$tool" "/usr/local/bin/$tool"
        elif [ -L "/usr/local/bin/$tool" ] && [ ! -e "/usr/local/bin/$tool" ]; then rm -f "/usr/local/bin/$tool"; fi
    done
    # Login shells read /etc/profile.d (zz- sorts after the image's nodejs.sh); interactive shells and the
    # agent's shell snapshot read ~/.bashrc, which sources the same snippet.
    printf '%s\n' "# SIGRAK: Node.js ${NODE_MAJOR} first on PATH (.claude/cloud/setup.sh)" \
        "case \"\$PATH\" in ${NODE_BIN}:*) ;; *) export PATH=\"${NODE_BIN}:\$PATH\" ;; esac" \
        > /etc/profile.d/zz-sigrak-node.sh 2>/dev/null || true
    bashrc="${HOME:-/root}/.bashrc"
    grep -qs "zz-sigrak-node.sh" "$bashrc" \
        || echo '[ -f /etc/profile.d/zz-sigrak-node.sh ] && . /etc/profile.d/zz-sigrak-node.sh' >> "$bashrc" 2>/dev/null || true
fi

# PostgreSQL with pgvector (D-398, D-412) and Redis
if ! command -v "/usr/lib/postgresql/${PG_MAJOR}/bin/postgres" >/dev/null; then
    apt_install curl ca-certificates gnupg
    install -d /usr/share/postgresql-common/pgdg
    if curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc; then
        echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release; echo "$VERSION_CODENAME")-pgdg main" \
            > /etc/apt/sources.list.d/pgdg.list
        apt_updated=0
        apt_install "postgresql-${PG_MAJOR}" "postgresql-${PG_MAJOR}-pgvector" && log "postgresql ${PG_MAJOR} installed" \
            || log "could not install PostgreSQL ${PG_MAJOR} (optional)"
    fi
fi
command -v redis-server >/dev/null || apt_install redis-server || log "could not install redis (optional)"
if [ -x "/usr/lib/postgresql/${PG_MAJOR}/bin/postgres" ]; then
    # Other clusters in the base image (e.g. 16) would take port 5432 after a restart: stop them, no autostart.
    pg_lsclusters -h 2>/dev/null | awk -v keep="$PG_MAJOR" '$1 != keep {print $1, $2}' | while read -r v c; do
        pg_ctlcluster "$v" "$c" stop >/dev/null 2>&1 || true
        [ -f "/etc/postgresql/$v/$c/start.conf" ] && echo manual > "/etc/postgresql/$v/$c/start.conf"
    done
    pg_lsclusters 2>/dev/null | grep -q "^${PG_MAJOR} " || pg_createcluster "$PG_MAJOR" main --port 5432 >/dev/null 2>&1
    pg_ctlcluster "$PG_MAJOR" main start >/dev/null 2>&1 || true
    su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='sigrak'\"" 2>/dev/null | grep -q 1 \
        || su postgres -c "psql -c \"CREATE ROLE sigrak LOGIN SUPERUSER PASSWORD 'sigrak'\"" >/dev/null 2>&1
    for db in sigrak sigrak_test; do
        su postgres -c "createdb -O sigrak $db" >/dev/null 2>&1 || true
    done
    log "postgresql ${PG_MAJOR} running (local role/password sigrak/sigrak, databases sigrak and sigrak_test)"
fi
pgrep -x redis-server >/dev/null || redis-server --daemonize yes >/dev/null 2>&1 || true

# Typst CLI (D-399 spike), k6 (R0-08), fonts and pandoc (docs PDF build)
if ! command -v typst >/dev/null; then
    curl -fsSL https://github.com/typst/typst/releases/latest/download/typst-x86_64-unknown-linux-musl.tar.xz -o /tmp/typst.tar.xz \
        && tar -xJf /tmp/typst.tar.xz -C /tmp && install /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/typst \
        && log "$(typst --version) installed" || log "could not install typst (optional)"
fi
if ! command -v k6 >/dev/null; then
    curl -fsSL https://dl.k6.io/key.gpg | gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg 2>/dev/null \
        && echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" > /etc/apt/sources.list.d/k6.list \
        && apt_updated=0 && apt_install k6 && log "k6 installed" || log "could not install k6 (optional)"
fi
need=()
command -v pandoc >/dev/null || need+=(pandoc)
for pkg in fonts-liberation fonts-noto-core jq; do dpkg -s "$pkg" >/dev/null 2>&1 || need+=("$pkg"); done
[ "${#need[@]}" -eq 0 ] || apt_install "${need[@]}" || log "could not install ${need[*]} (optional)"

# Repository: owner identity, commit hook, dependencies
if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" config user.name "${ARUMI_GIT_NAME:-Arumi Studios}"
    git -C "$APP_DIR" config user.email "${ARUMI_GIT_EMAIL:-arumiforge@gmail.com}"
    git -C "$APP_DIR" config commit.gpgsign false
    [ -d "$APP_DIR/.githooks" ] && git -C "$APP_DIR" config core.hooksPath .githooks
    if [ -f "$APP_DIR/pnpm-lock.yaml" ]; then
        # pnpm version pinned in package.json "packageManager" (D-422)
        pm=$(python3 -c "import json;print(json.load(open('$APP_DIR/package.json')).get('packageManager',''))" 2>/dev/null)
        pnpm_ver="${pm#pnpm@}"
        # Installed into Node ${NODE_MAJOR}'s own folder, so it runs next to that Node on PATH.
        if [ -n "$pnpm_ver" ] && [ -x "$NODE_BIN/npm" ] && ! "$NODE_BIN/pnpm" -v 2>/dev/null | grep -qx "$pnpm_ver"; then
            "$NODE_BIN/npm" i -g "pnpm@${pnpm_ver}" --no-fund --no-audit >/dev/null 2>&1 \
                && ln -sf "$NODE_BIN/pnpm" /usr/local/bin/pnpm && log "pnpm $pnpm_ver installed" \
                || log "could not install pnpm $pnpm_ver (optional)"
        fi
        (cd "$APP_DIR" && pnpm install --frozen-lockfile >/dev/null 2>&1) && log "pnpm install done" \
            || log "pnpm install failed (run it in the session)"
    fi
    # Local .env as in CI (.github/workflows/ci.yml), only when missing; .env is gitignored. Removed again if the
    # key cannot be generated, so the next run tries again.
    if [ ! -f "$APP_DIR/.env" ] && [ -f "$APP_DIR/.env.example" ] && [ -d "$APP_DIR/node_modules" ]; then
        if cp "$APP_DIR/.env.example" "$APP_DIR/.env" && (cd "$APP_DIR" && node ace generate:key >/dev/null 2>&1); then
            log ".env created from .env.example with a new APP_KEY"
        else
            rm -f "$APP_DIR/.env"
            log "could not create .env (run: cp .env.example .env && node ace generate:key)"
        fi
    fi
fi
exit 0
