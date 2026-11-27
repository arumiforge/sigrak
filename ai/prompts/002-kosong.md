---
id: 002
name: kosong-murid, kosong-dokumen, kosong-bank-soal, kosong-jadwal, kosong-pencarian, kosong-notifikasi
kind: painting
area: state
generate: square 1024x1024
background: transparent
variants: light
batch: states-empty
status: requested
---

# 002 — kosong (empty-state set)

## Purpose

Six small paintings for honest empty states (Fondasi `ui.md`: "what it means + the next step"). They make an empty
list feel like the start of work, not an error, and show the app's people and places in small, quiet moments.

## Where it is used

The shared Empty state component (`docs/final/design-system.md`, Feedback): painting above a sentence-case title, one
line of explanation and the next-step button, all in HTML. Shown at about 160 px at 360 px wide and about 240 px at
1280 px, centred above the text in a card or table area. Decorative: the HTML text carries the meaning.

| File | Shown when |
| --- | --- |
| `kosong-murid` | Class has no pupils yet ("Belum ada murid. Tambahkan satu per satu atau impor dari Excel.") |
| `kosong-dokumen` | No RPM, LKPD or other documents yet |
| `kosong-bank-soal` | Question bank is empty |
| `kosong-jadwal` | No timetable or no lessons today |
| `kosong-pencarian` | A search or filter finds nothing |
| `kosong-notifikasi` | No notifications |

## Composition

- Each one a small, centred vignette with one subject, readable at 160 px: simple silhouette, little detail, generous
  transparent space around it.
- Same light, scale and brush texture across all six so they look like one set; the subject fills about 70 % of the
  square.

## Characters (cast in `ai/style-guide.md` §3)

- `kosong-murid`: `MURID-4` (wheelchair) and `MURID-1` (white hijab) arriving at an empty classroom doorway, bags on
  their backs, morning light; seen from behind and side, no faces in close-up.
- `kosong-jadwal`: `GURU-E` Bu Siti (MI, olive hijab) pinning a blank timetable sheet on a cork board, seen from the side.
- The other four: no people.

## Setting and props

- `kosong-dokumen`: an empty wooden teacher's desk with a neat empty folder, a pen and a glass of tea.
- `kosong-bank-soal`: an open wooden box of blank index cards, a pencil resting on top.
- `kosong-pencarian`: a magnifying glass lying on an open notebook with blank pages, a small pot plant beside it.
- `kosong-notifikasi`: a school bell (hand bell) resting quietly on a stack of closed books.
- Every paper, card, sheet and page is blank or shows abstract lines only.

## Colour and light

Soft morning daylight from the upper left in all six. Cream, sand, wood brown, sage. One small teal accent per image:
a bag (`kosong-murid`), the folder (`kosong-dokumen`), a card divider (`kosong-bank-soal`), a push pin (`kosong-jadwal`),
the magnifying-glass handle (`kosong-pencarian`), a book spine (`kosong-notifikasi`).

## Avoid

- Sad, lonely or "error" moods; cobwebs, dust, tumbleweed, empty-box clichés, question marks.
- Cartoon mascots, emoji faces on objects, flat vector icon style.
- Everything in the style guide: §2 "Respect rules", §10 "Never" and §11 "Rules for every painting"

## Prompt

Use the same three blocks for every file; only the last paragraph changes.

```
Hand-painted gouache and pencil illustration, warm natural palette (chalk white, paper cream, terracotta, sage, sand, soft ink blue, wood brown) with one small teal (#0F766E) accent. Indonesian primary school, everyday and real, seen by a teacher who works there. Calm soft daylight, gentle visible brush texture, clear silhouettes, simple flat-ish shading. People are busy with a task, not posing or smiling at the camera. Modest neat clothing. No text, letters, numbers, Arabic or other script, logos, emblems, flags with text or watermarks anywhere; boards, books and screens show only abstract shapes.

Isolated vignette on a fully transparent background, edges fading softly into transparency, no floor shadow box, no frame, no glow, halo or light rim around the figures. Colours must read on both a white page and a near-black green-grey page (#151B19).

<paragraph for the file, below>
```

- `kosong-murid`: Small square vignette, centred: two Indonesian primary-school pupils seen from behind and the side, arriving at the open wooden doorway of an empty classroom in soft morning light. One girl in a white hijab and the red-and-white school uniform with a long skirt; one boy in a wheelchair in the same uniform with a teal school bag on the back of his chair. Inside the door, empty paired wooden desks. Simple, hopeful, a fresh start.
- `kosong-dokumen`: Small square vignette, centred: an empty wooden teacher's desk seen from the front at a slight angle, with one neat closed teal folder, a pen and a glass of tea, soft morning light from the upper left. Simple, calm, ready to begin.
- `kosong-bank-soal`: Small square vignette, centred: an open wooden box of blank white index cards with one teal card divider, a pencil resting on top, soft morning light from the upper left. Simple, tidy, ready to fill.
- `kosong-jadwal`: Small square vignette, centred: an Indonesian woman teacher of about 28 in an olive hijab and long tunic, seen from the side, pinning a blank timetable sheet with an empty grid onto a cork board with a teal push pin. Soft morning light. Simple, organised.
- `kosong-pencarian`: Small square vignette, centred: a magnifying glass with a teal handle lying on an open notebook with blank pages, a small pot plant beside it, soft morning light from the upper left. Simple, quiet, nothing found yet.
- `kosong-notifikasi`: Small square vignette, centred: a brass hand-held school bell resting quietly on a small stack of closed books, one book with a teal spine, soft morning light from the upper left. Simple, peaceful, nothing new.

## Files

| Variant | Master | Installed (`ai/generated/install/img/…`) |
| --- | --- | --- |
| light | `ai/generated/kosong-murid.webp` | `state/kosong-murid.webp` |
| light | `ai/generated/kosong-dokumen.webp` | `state/kosong-dokumen.webp` |
| light | `ai/generated/kosong-bank-soal.webp` | `state/kosong-bank-soal.webp` |
| light | `ai/generated/kosong-jadwal.webp` | `state/kosong-jadwal.webp` |
| light | `ai/generated/kosong-pencarian.webp` | `state/kosong-pencarian.webp` |
| light | `ai/generated/kosong-notifikasi.webp` | `state/kosong-notifikasi.webp` |

## Alt text (Indonesian, used in the view)

Decorative: `alt=""` and `aria-hidden="true"`; the empty-state title and text in HTML say what is missing.

## Acceptance checks

- [ ] `python3 ai/tools/check_assets.py 002` passes (all six files, longest side ≤ 480 px, ≤ 70 KB each)
- [ ] No text, letters, numbers or marks on any paper, card, board or book
- [ ] Reads on `#FFFFFF` and on `#151B19`; no glow, halo or light rim
- [ ] The six look like one set (light direction, scale, texture) when shown side by side at 160 px
- [ ] Respect rules (style guide §2): hijab covers hair, wheelchair shown as an ordinary part of the scene
