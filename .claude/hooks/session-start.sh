#!/bin/bash
# Commit as the repository owner in every session (D-148).
# Local config overrides the session's global git identity.
# core.hooksPath turns on .githooks/commit-msg (no AI attribution, owner as author; D-408).
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
git config --local user.name "Arumi Studios"
git config --local user.email "arumiforge@gmail.com"
git config --local commit.gpgsign false
git config --local core.hooksPath .githooks
exit 0
