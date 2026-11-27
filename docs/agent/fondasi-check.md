# Checking Fondasi for updates

SIGRAK adapts `arumiforge/fondasi` but keeps its own copies and adjustments (D-401). Nothing updates by itself: when a developer asks ("cek Fondasi", "ambil data terbaru dari Fondasi"), an agent runs this check and brings changes in as a normal reviewed PR.

## 1. Get read access (the repository is private)

| Where | How |
|---|---|
| Claude cloud session (claude.ai/code) | Preferred: in the SIGRAK cloud environment settings (environment menu in the session title bar → Edit → Repositories) add `arumiforge/fondasi` as a second repository, then start a new session. Or, inside a running session, attach it with `add_repo` (owner `arumiforge`, repo `fondasi`, access `read`); it clones to `/home/user/fondasi` or the path the tool gives. If access is refused: the owner reconnects GitHub at claude.ai/connect-github and makes sure the Claude GitHub App is installed on `arumiforge/fondasi`. |
| Developer laptop | `gh auth login` with an account that can read the repository, then `git clone git@github.com:arumiforge/fondasi.git ../fondasi` (SSH key on the GitHub account) or `gh repo clone arumiforge/fondasi ../fondasi`. |
| Server | Fondasi's own checkout at `/opt/apps/_fondasi` (F-002) is pulled with the server's read-only deploy key; never copy a personal token to the server. |

Never write to Fondasi from a SIGRAK session. Fondasi changes go to its own repository and sessions.

## 2. What to compare

1. `git -C <fondasi> pull`, note the new head commit.
2. Read since the commit last recorded in `docs/drafts/fondasi-uptake.md` ("Last checked"): `docs/decisions.md` (new `F-…`), `docs/progress.md`, `CHANGELOG.md`, and `git log --stat <last>..HEAD -- data docs templates .claude/skills`.
3. For each data set SIGRAK keeps a copy of (table in `fondasi-uptake.md`), compare the Fondasi version in `data/<set>/manifest.json` with the version SIGRAK copied. A newer version: read its changelog and `SHA256SUMS`, decide with the developer what to take.
4. New rules or templates: list them under "Take from Fondasi" or "Owner must decide" in `fondasi-uptake.md`.

## 3. Bringing changes in

- Data: copy the needed files into `docs/data/…` (or the app's import folder), keep SIGRAK's own codes and fixes, record the Fondasi set, version and SHA-256 in the file's `source` block and in `fondasi-uptake.md`. Re-run the importer and its tests.
- Rules: apply in code/docs, or record an exception as a `D-…` decision when SIGRAK differs.
- Update "Last checked" in `fondasi-uptake.md` with the date and Fondasi commit, and report the new items to the owner in Indonesian.
