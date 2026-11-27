---
id: 003
name: memuat
kind: svg
batch: loaders
files: img/memuat/memuat-kecil.svg, img/memuat/memuat-halaman.svg, css/memuat.css
status: requested
---

# 003 — memuat (loaders)

## Purpose

SIGRAK's own loading indicators instead of a generic spinner: a small one for buttons and inline waits, a page loader
for AI generation and long exports, and a skeleton shimmer for deferred props (D-389: skeletons instead of blank areas,
no layout shift). They carry the school motif quietly and follow the brand colour.

## Where it is used

- `memuat-kecil.svg`: inside buttons while a form is sent ("Menyimpan…") and next to inline text; 16–20 px. Used as a
  CSS mask on a `<span class="loader-sm">`, painted with `currentColor`, so it takes the button's text colour.
- `memuat-halaman.svg`: centre of a panel while the AI writes a document or an export is prepared; 64–96 px. Inlined
  in the React component (not `<img>`), so `css/memuat.css` can animate its parts; strokes in `currentColor`, the
  wrapper sets `color: var(--brand)`.
- Skeleton classes in `css/memuat.css`: grey blocks in the shape of the coming content (lines, cards, table rows).

## Design

- `memuat-kecil`: a pencil-tip ring — a 300° circular arc with a small pencil tip at one end, stroke about 2 px at
  20 px size. Mask: `#000` only (style guide §9). The element rotates (CSS), the SVG itself is static.
- `memuat-halaman`: an open book seen from the front; a pencil draws a line across the right page, then the page turns.
  Line drawing only, rounded caps and joins, stroke 2.5 at a 96×96 `viewBox`. Parts with ids/classes for CSS:
  `.loader-page__book`, `.loader-page__line`, `.loader-page__pencil`, `.loader-page__leaf`. Loop of about 2.4 s, calm
  easing, no bounce.
- Skeleton: `--border`-coloured blocks on `--surface` or `--bg` with a soft left-to-right shimmer, radius 6 px.
- Avoid: dots that bounce, rainbow or gradient arcs, glow, 3D, text or letters in the SVG.

## Files

| File (`ai/generated/install/…`) | What |
| --- | --- |
| `img/memuat/memuat-kecil.svg` | Small loader mask (`#000` only), ≤ 4 KB |
| `img/memuat/memuat-halaman.svg` | Page loader, `currentColor` strokes, part classes, ≤ 4 KB |
| `css/memuat.css` | `.loader-sm`, `.loader-page`, `.skeleton`, `.skeleton--line`, `.skeleton--block`, in `@layer components` |

## CSS contract

- `.loader-sm`: `display:inline-block; width:1.25em; height:1.25em; background-color:currentColor;` with `mask` and
  `-webkit-mask` from `memuat-kecil.svg` (path set by a custom property `--loader-sm-url`), rotating 0.9 s linear.
- `.loader-page`: wrapper of the inline SVG; `color: var(--brand)`; animates the four part classes.
- `.skeleton`: `background: var(--border)` with a soft shimmer towards `var(--surface)`; `--border`, `--surface` and
  `--bg` come from the app's tokens (`docs/final/design-system.md`), so light and dark both work without extra rules. `.skeleton--line` 0.75em high,
  full width; `.skeleton--block` takes its size from the parent.
- `@media (prefers-reduced-motion: reduce)`: no rotation, no drawing or page turn, no shimmer; `.loader-sm` shows the
  static ring, `.loader-page` shows the open book with the full line, skeletons stay plain grey.
- No hard-coded brand colours, no `@apply`, no external URLs.

## Alt text / accessibility

SVGs are decorative (`aria-hidden="true"`). The wrapper has `role="status"` and a visually hidden Indonesian text
from the translation files ("Memuat…", or the specific task such as "Menyusun RPM…"). Skeleton areas set
`aria-busy="true"` on their container.

## Acceptance checks

- [ ] `python3 ai/tools/check_assets.py 003` passes
- [ ] Demo page shows it in light and dark at 360 and 1280 px without overflow
- [ ] `.loader-sm` inside a primary and a secondary button takes the button text colour
- [ ] With reduced motion turned on, nothing moves and every state still reads as "loading"
- [ ] No layout shift when the skeleton is replaced by content of the same shape
