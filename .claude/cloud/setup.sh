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

# Node.js LTS (D-412). Cloud images put /opt/node22/bin early on PATH, so check the install folder itself, not
# whatever `node` PATH finds, and link the binaries into a folder that comes before it (~/.local/bin).
NODE_BIN="/opt/node${NODE_MAJOR}/bin"
if ! "$NODE_BIN/node" -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
    ver=$(curl -fsSL https://nodejs.org/dist/index.json 2>/dev/null \
        | python3 -c "import json,sys;print(next(x['version'] for x in json.load(sys.stdin) if x['version'].startswith('v${NODE_MAJOR}.')))" 2>/dev/null)
    if [ -n "$ver" ] && curl -fsSL "https://nodejs.org/dist/${ver}/node-${ver}-linux-x64.tar.xz" -o /tmp/node.tar.xz; then
        mkdir -p "/opt/node${NODE_MAJOR}" && tar -xJf /tmp/node.tar.xz -C "/opt/node${NODE_MAJOR}" --strip-components=1
        rm -f /tmp/node.tar.xz
        log "node $ver installed"
    else
        log "could not install Node.js ${NODE_MAJOR} (optional; found $(node -v 2>/dev/null || echo none))"
    fi
fi
link_node_bins() {
    local dir
    for dir in /usr/local/bin "${HOME:-/root}/.local/bin"; do
        mkdir -p "$dir"
        for b in node npm npx corepack pnpm pnpx; do
            if [ -x "$NODE_BIN/$b" ]; then
                ln -sf "$NODE_BIN/$b" "$dir/$b"
            elif [ -L "$dir/$b" ] && [ ! -e "$dir/$b" ]; then
                rm -f "$dir/$b"   # dangling, e.g. corepack, which Node 25+ no longer ships
            fi
        done
    done
    return 0
}
if [ -x "$NODE_BIN/node" ]; then
    link_node_bins
    # Login shells read /etc/profile.d/ in name order; this file sorts after the image's nodejs.sh.
    echo "export PATH=$NODE_BIN:\$PATH" > "/etc/profile.d/zz-node${NODE_MAJOR}.sh"
    export PATH="$NODE_BIN:$PATH"
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
# One Redis: the app's cache connection uses database 3 of it while REDIS_CACHE_HOST is empty (D-480).
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
        # pnpm version pinned in package.json "packageManager" (D-422), installed under the Node above
        pm=$(python3 -c "import json;print(json.load(open('$APP_DIR/package.json')).get('packageManager',''))" 2>/dev/null)
        pnpm_ver="${pm#pnpm@}"
        if [ -n "$pnpm_ver" ] && ! "$NODE_BIN/pnpm" -v 2>/dev/null | grep -qx "$pnpm_ver"; then
            "$NODE_BIN/npm" i -g "pnpm@${pnpm_ver}" --no-fund --no-audit >/dev/null 2>&1 \
                && link_node_bins && log "pnpm $pnpm_ver installed" \
                || log "could not install pnpm $pnpm_ver (optional)"
        fi
        (cd "$APP_DIR" && pnpm install --frozen-lockfile >/dev/null 2>&1) && log "pnpm install done" \
            || log "pnpm install failed (run it in the session)"
    fi
    # Local .env for `pnpm test` and `pnpm dev`, the same step CI runs; never overwrites an existing one.
    if [ ! -f "$APP_DIR/.env" ] && [ -f "$APP_DIR/.env.example" ] && [ -d "$APP_DIR/node_modules" ]; then
        if cp "$APP_DIR/.env.example" "$APP_DIR/.env" && (cd "$APP_DIR" && node ace generate:key >/dev/null 2>&1); then
            log ".env created from .env.example"
        else
            rm -f "$APP_DIR/.env"   # created by this run only; retried next run
            log "could not create .env (run: cp .env.example .env && node ace generate:key)"
        fi
    fi
fi
exit 0
