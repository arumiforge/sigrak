# Owner's handbook

`index.html` is the owner's personal handbook (Indonesian, at the owner's request): one page that summarises the overhaul decisions, the stack and versions, the server, access, backups, AI, payments, Fondasi exceptions, the phase plan, open proposals and open questions. Open it in a browser (download the file from the private repository, or open it from a local clone). Checkboxes are saved only in that browser.

It covers stack and server topics for now. SIGRAK's education content (curriculum, teacher features) gets its own sections later.

## Keeping it up to date

- Update it in the same PR as any decision that changes what it says: `DECISIONS.md` stays the source of truth, the handbook is the readable summary.
- Bump the version and date in the hero line (`versi N · diperbarui …`) and add a line to section 15 "Riwayat handbook".
- Keep it one self-contained file: styles inline, no build step, only Google Fonts loaded from outside. It must stay readable at 375 px (no horizontal scroll).
- Never put IP addresses, ports, passwords, keys or personal data in it.
