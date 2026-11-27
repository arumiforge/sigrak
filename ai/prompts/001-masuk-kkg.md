---
id: 001
name: masuk-kkg
kind: painting
area: hero
generate: landscape 1536x1024
background: transparent
variants: light
batch: pages-login
status: requested
---

# 001 — masuk-kkg

## Purpose

The first thing every SD and MI teacher, principal and supervisor sees. It should say "this is made for us": real
Indonesian teachers working together on lesson plans, calm and capable, no hype.

## Where it is used

Login page `/masuk` (server-rendered public page; also `/lupa-kata-sandi`). At 1024 px and wider the form sits in the
left column and the painting fills the right column, shown at about 560 px wide (up to 1100 px on large screens). At
360 px it shows as a band above the form, about 328 px wide, cropped to the centre; the three faces must stay inside
the middle 60 % of the width.

## Composition

- A KKG (teachers' working group) meeting after school in a public SD classroom: three teachers around two desks
  pushed together, seen from slightly above eye level, three-quarter view.
- Figures in the middle; the top quarter (wall, window light) stays quiet and plain so the band crop at 360 px works.
- Edges fade into transparency (vignette), no hard background rectangle.

## Characters (cast in `ai/style-guide.md` §3)

- `GURU-A` Bu Ratna (SD, white hijab, khaki ASN uniform, glasses on a cord) points at a printed worksheet.
- `GURU-D` Pak Hasan (MI, black peci, light green shirt) holds a phone, showing her something on the screen.
- `GURU-C` Bu Made (SD, no hijab, low bun, batik blouse) writes in a notebook, listening, half smiling.
- All three are busy with the work; nobody looks at the viewer.

## Setting and props

- Wooden desks with folders, a stack of printed worksheets (abstract lines only), a thermos and three glasses of tea,
  a plastic snack box, a pencil case.
- Behind them, softly out of focus: louvre window with afternoon light, a whiteboard with abstract shapes, a pot plant.

## Colour and light

Warm afternoon daylight from the window on the left. Cream paper, khaki, batik browns, sage wall. The single teal
accent is Pak Hasan's phone case.

## Avoid

- Laptops, office cubicles, a projector screen, a "business meeting" look.
- Readable writing on the worksheets, board or phone; school names or logos; Garuda or portraits on the wall.
- Everything in the style guide: §2 "Respect rules", §10 "Never" and §11 "Rules for every painting"

## Prompt

```
Hand-painted gouache and pencil illustration, warm natural palette (chalk white, paper cream, terracotta, sage, sand, soft ink blue, wood brown) with one small teal (#0F766E) accent. Indonesian primary school, everyday and real, seen by a teacher who works there. Calm soft daylight, gentle visible brush texture, clear silhouettes, simple flat-ish shading. People are busy with a task, not posing or smiling at the camera. Modest neat clothing. No text, letters, numbers, Arabic or other script, logos, emblems, flags with text or watermarks anywhere; boards, books and screens show only abstract shapes.

Isolated vignette on a fully transparent background, edges fading softly into transparency, no floor shadow box, no frame, no glow, halo or light rim around the figures. Colours must read on both a white page and a near-black green-grey page (#151B19).

Landscape scene: an after-school teachers' working group meeting in an Indonesian public primary school classroom. Three teachers sit around two wooden desks pushed together, seen from slightly above, three-quarter view, figures in the centre. A Javanese woman of about 40 in a khaki civil-servant uniform and white hijab, reading glasses on a cord, points at a printed worksheet. A Sundanese man of about 45 in a black peci and light green shirt holds a phone with a teal case and shows her the screen. A Balinese woman of about 35 without hijab, hair in a low bun, batik blouse, writes in a notebook and listens. On the desks: folders, a stack of worksheets with only abstract lines, a thermos, three glasses of tea, a snack box, a pencil case. Behind them, soft and out of focus: a louvre window with warm afternoon light from the left, a whiteboard with abstract shapes, a pot plant. The top quarter stays plain and quiet. Focused, friendly, unhurried.
```

## Files

| Variant | Master | Installed (`ai/generated/install/img/…`) |
| --- | --- | --- |
| light | `ai/generated/masuk-kkg.webp` | `hero/masuk-kkg.webp` |

## Alt text (Indonesian, used in the view)

Tiga guru SD dan MI berdiskusi menyusun lembar kerja di meja kelas.

## Acceptance checks

- [ ] `python3 ai/tools/check_assets.py 001` passes
- [ ] Empty area really empty; no text, letters, Arabic-like marks or emblems anywhere
- [ ] Reads on `#FFFFFF` and on `#151B19`; no glow, halo or light rim
- [ ] Respect rules (style guide §2) checked: hijab fully covers hair, peci correct, modest clothes
- [ ] Centre crop at 328 px wide keeps all three faces
- [ ] Faces and clothes become the reference for `GURU-A`, `GURU-C`, `GURU-D` in later briefs
