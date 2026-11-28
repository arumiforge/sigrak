# Hugeicons Pro (licensed)

Licensed icon files used under the owner's commercial Hugeicons Pro licence (D-402, D-434). They are **not** covered by SIGRAK's `LICENSE` and may not be extracted, reused or redistributed outside this app. See `THIRD_PARTY_NOTICES.md`.

## What is here

Only two styles, imported on 2026-11-27 from the owner's files:

| Folder | Style | Files |
|---|---|---|
| `rounded-stroke/<category>/<name>.svg` | Rounded Stroke (default UI icons) | 3,670 |
| `rounded-solid/<category>/<name>.svg` | Rounded Solid (active and selected states) | 3,674 |

The other styles in the owner's set (Rounded Bulk, Duotone, Twotone, Sharp Stroke and Solid) are not imported.

## How the files were normalised

- Folder and file names are lowercase kebab-case: spaces, `&` and brackets removed (`Game & Sports` → `game-sports`, `Arrows (Round)` → `arrows-round`, `comment block-01` → `comment-block-01`, `voice-iD` → `voice-id`).
- Categories stay as folders, because about 40 names exist in two categories with different drawings (for example `education/school.svg` and `building-landmark-places/school.svg`).
- `.DS_Store` files removed. SVG contents are unchanged; each file was checked for scripts, event handlers and external links before import.
- The zip and the licence certificate are never committed; the certificate stays in the password manager.

## Use

Components never import these files directly. `inertia/components/icon.tsx` is the one place that maps SIGRAK icon names to files (R1-12): `<Icon name="calendar" />` draws Rounded Stroke, `<Icon name="calendar" active />` the Rounded Solid twin (active and selected states only). Each file is a static `?raw` import, so only the mapped icons reach the bundle; the colour `#141B34` becomes `currentColor`.

To add an icon: pick the file here, add one import and one entry in `strokeIcons` (and in `solidIcons` when it can mark an active item), then use the new name.
