---
id: NNN
name: <kebab-name>                      # file base name, Indonesian kebab-case; a set lists several, comma separated
kind: painting
area: hero | section | guide | state | share | ikon | langkah
generate: landscape 1536x1024 | portrait 1024x1536 | square 1024x1024
background: transparent                 # paintings are always transparent (style guide §6)
variants: light                         # no dark copies (style guide §5)
batch: <batch-slug>                     # pull request group, e.g. pages-login
status: requested                       # requested → generated (Codex) → done (Claude)
---

# NNN — <kebab-name>

## Purpose

<What the viewer should feel or understand.>

## Where it is used

<Route and component; where the HTML text sits; how big it shows at 360 px and at 1280 px.>

## Composition

- <Where the subject sits, which area stays empty.>

## Characters (cast in `ai/style-guide.md` §3)

- <Cast codes, clothing, pose, expression. "None." for object-only images.>

## Setting and props

- <Objects and background (style guide §4); screens and papers show only abstract shapes.>

## Colour and light

<Main colours and where the single teal accent goes.>

## Avoid

- <Things specific to this image>
- Everything in the style guide: §2 "Respect rules", §10 "Never" and §11 "Rules for every painting"

## Prompt

```
<base style block, style guide §7, unchanged>

<light-and-dark block, style guide §8, unchanged>

<one self-contained paragraph: shape, background, composition, characters, setting, mood>
```

## Files

| Variant | Master | Installed (`ai/generated/install/img/…`) |
| --- | --- | --- |
| light | `ai/generated/<name>.webp` | `<area>/<name>.webp` |

## Alt text (Indonesian, used in the view)

<One short plain sentence that says what the picture shows. No "Gambar …" or "Ilustrasi …". Use `alt=""` only when the brief says the image is decorative.>

## Acceptance checks

- [ ] `python3 ai/tools/check_assets.py NNN` passes
- [ ] Empty area really empty; no text, letters, Arabic-like marks or emblems anywhere
- [ ] Reads on `#FFFFFF` and on `#151B19`; no glow, halo or light rim
- [ ] Respect rules (style guide §2) checked: religion, dress, people, places
- [ ] <brief-specific checks>
