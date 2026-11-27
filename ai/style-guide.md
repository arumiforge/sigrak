# Visual identity and style guide — SIGRAK

These rules win over any brief. Shared rules: Fondasi `docs/visual-assets.md` and `docs/ui.md` (D-390, F-011, F-022).
The app itself stays a calm work tool (`docs/final/design-system.md`); the paintings give it warmth and a place.

## 1. Identity

- **Who**: Indonesian SD and MI teachers, principals and supervisors at work, and their pupils (grades 1–6, about
  6–12 years old). Teachers are the main characters; pupils appear with them in class.
- **Where**: public SD and MI (madrasah) all over Indonesia, in cities, small towns and villages; Java, Sumatra,
  Kalimantan, Sulawesi, Bali, Nusa Tenggara, Maluku and Papua.
- **Values**: Bhinneka Tunggal Ika — different regions, skin tones, faces, religions, dress and abilities, side by side
  as ordinary classmates and colleagues. Diligent, warm, a little humour, never preachy.
- **Feel**: real classrooms on a real school day, seen by someone who has taught there. Not a stock photo, not an
  advertisement, not a Western classroom.

## 2. Respect rules (strict)

**Religion**
- MI scenes are Islamic in a quiet, everyday way (a mushola in the background, a teacher with a peci, a prayer mat
  folded on a shelf). Public SD scenes mix pupils and teachers of Islam, Protestant and Catholic Christianity,
  Hinduism, Buddhism and Konghucu; religion is shown only through ordinary dress and setting, never as a costume.
- Never depict Allah, the Prophet, angels, gods or saints in human form; no faces on religious figures; no Kaaba close-ups.
- No legible or pseudo-Arabic, Javanese, Balinese or Latin script anywhere, also not on the board, books or banners.
  Books and boards show abstract lines and shapes only. A Qur'an, Bible or other holy book is never on the floor, under
  feet, open with visible text, or used as a prop.
- No religious symbol as decoration (no crosses, crescents, om signs or temple roofs as patterns).
- Never place religion next to a stereotype (no "the Christian pupil is from Papua" or "the hijab girl is shy").

**Dress**
- SD pupils: the national uniform (white shirt, red shorts, trousers or skirt; long sleeves and long skirt or trousers
  for some), on some days batik or Pramuka. MI pupils: the madrasah uniform as the brief says (often green or white
  with long sleeves; boys with peci on some days).
- Girls: some wear a hijab (white or matching the uniform, worn properly, no hair showing), some do not; both are
  normal in the same public SD class. In MI scenes Muslim girls wear a hijab.
- Teachers: ASN khaki uniform, batik, or modest everyday clothes; female teachers with and without hijab in SD,
  with hijab in MI; male teachers with or without peci.
- Clothing is always modest and neat: no tight, short or see-through clothes, no bare shoulders.
- Regional dress only when the brief says so (for example a school event); never as the default "look" of a region.

**People**
- Bodies, faces and skin tones vary; Papuan, Batak, Javanese, Sundanese, Balinese, Bugis, Chinese-Indonesian, Dayak,
  Minang and other features without caricature. No lightened skin, no "beauty filter".
- Disabilities appear naturally and taking part, never as pity or inspiration: a pupil in a wheelchair at a desk, a
  pupil with a hearing aid, a pupil with a white cane or low-vision glasses, a pupil with Down syndrome. At most one per
  scene unless the brief says otherwise, never the joke and never the only one left out.
- Children are always fully clothed, safe and supervised; no child alone with an adult in a closed room; no
  physical punishment, no crying child as decoration, no dangerous play.
- Adults and children are generic: never the likeness of a real person, official, celebrity or teacher.

**Places and objects**
- No real school names, logos, crests, flags with text, Garuda Pancasila, portraits of the president or other
  officials, or brand logos. The red-and-white flag may appear small and correct (red on top) when the brief asks.
- Screens and papers show only abstract shapes; no readable dates, scores, names or AI wording.

## 3. Cast (the same people across images)

| Code | Who | Look |
|---|---|---|
| `GURU-A` | Bu Ratna, class teacher in a public SD, about 40 | Javanese features, khaki ASN uniform or batik, white hijab, reading glasses on a cord |
| `GURU-B` | Pak Yosef, SD teacher, about 30 | Papuan features, short curly hair, batik shirt, lanyard |
| `GURU-C` | Bu Made, SD teacher, about 35 | Balinese features, hair in a low bun, no hijab, batik blouse |
| `GURU-D` | Pak Hasan, MI teacher, about 45 | Sundanese features, black peci, light green shirt |
| `GURU-E` | Bu Siti, MI teacher, about 28 | Bugis features, olive hijab, long tunic, uses a tablet |
| `KEPSEK` | Bu Lina, principal, about 50 | Chinese-Indonesian features, short grey hair, no hijab, dark blazer over batik |
| `MURID-1…6` | Pupils | Mixed: hijab and no hijab, boys and girls, one in a wheelchair (`MURID-4`), one with a hearing aid (`MURID-5`), different skin tones and hair |

A brief names the cast codes it uses; Codex keeps faces, proportions and clothing consistent between images.

## 4. Settings

Real Indonesian classrooms: whiteboard or old blackboard, louvre windows, ceiling fan, tiled floor, wooden desks in
pairs, wall charts with abstract shapes, a pot plant, a broom in the corner, school bags on chair backs, shoes at the
door in some scenes. Staff room with stacked folders and a shared printer. School yard with a flagpole, a banyan or
mango tree, a canteen. MI: the same, plus a small mushola or wudu taps in the background. Light, tidy, slightly worn;
not luxurious, not poor.

## 5. Colour

- The app's brand colour is teal (`--brand` `#0F766E` light, `#2DD4BF` dark) and comes from CSS variables; assets never
  hard-code it in CSS or SVG.
- Painting palette: warm natural tones — chalk white, paper cream, terracotta, sage, sand, soft ink blue, wood brown —
  with **one** small teal accent (a lanyard, a book cover, a bag) so the image belongs to the app.
- Every painting reads on the light page (`#F7F8F7`, `#FFFFFF`) and on the dark page (`#151B19`, `#1C2321`); there are
  no separate dark copies.

## 6. Paintings

- **Look**: hand-painted gouache-and-pencil illustration, visible but quiet brush texture, soft natural light, clear
  silhouettes, flat-ish shading; people look busy with a task, not posing for the camera.
- **Background**: real transparency; the subject is a cut-out vignette that fades into nothing at the edges.
- **Sizes and budgets** (installed WebP, longest side / max size): `hero` 1100 px / 220 KB, `section` 800 px / 140 KB,
  `guide` 1000 px / 180 KB, `state` 480 px / 70 KB, `share` 1200×630 / 180 KB, `ikon` 512 px / 60 KB,
  `langkah` 640 px / 90 KB. Masters in `ai/generated/` may be larger.
- **Variants**: `light` only, unless a brief asks for more. No dark copies.

## 7. Base style block (copy unchanged into every painting prompt)

```
Hand-painted gouache and pencil illustration, warm natural palette (chalk white, paper cream, terracotta, sage, sand, soft ink blue, wood brown) with one small teal (#0F766E) accent. Indonesian primary school, everyday and real, seen by a teacher who works there. Calm soft daylight, gentle visible brush texture, clear silhouettes, simple flat-ish shading. People are busy with a task, not posing or smiling at the camera. Modest neat clothing. No text, letters, numbers, Arabic or other script, logos, emblems, flags with text or watermarks anywhere; boards, books and screens show only abstract shapes.
```

## 8. Light-and-dark block (copy unchanged into every painting prompt)

```
Isolated vignette on a fully transparent background, edges fading softly into transparency, no floor shadow box, no frame, no glow, halo or light rim around the figures. Colours must read on both a white page and a near-black green-grey page (#151B19).
```

## 9. Vectors (SVG) and CSS

- Patterns, dividers and button shapes are masks: only `#000` fills, painted by CSS through `mask-image` with
  `var(--brand)` or another token; always with the `-webkit-mask` fallback.
- Loaders and icons drawn in strokes use `currentColor`.
- No `<text>`, `<script>`, `<image>`, `<foreignObject>`, event handlers or external references; a `viewBox` always.
- CSS is plain CSS in `@layer components`, no `@apply`, no hard-coded brand colours, no uppercase text, no thick
  coloured top or side borders; every animation stops under `prefers-reduced-motion: reduce`.
- Budgets: pattern 4 KB, divider 3 KB, button 6 KB, loader 4 KB per SVG.

## 10. Never (Fondasi `docs/ui.md`)

- AI-slop looks: purple–blue gradients, glowing blobs, glassmorphism, floating 3D shapes, lens flares, plastic
  "3D character" style, generic stock-photo smiles, everyone looking at the camera, laptops on every desk, Western
  classrooms (lockers, carpets, a fireplace), snow, autumn leaves.
- Text, letters or numbers in images; emoji; icons inside tinted circles; eyebrow labels.
- Copyrighted characters or look-alikes; real people; real school or organisation logos.

## 11. Rules for every painting

- Check against §2 before delivering: religion, dress, people, places.
- One clear subject; the area named in the brief stays empty for the HTML text.
- Same cast faces and clothes as earlier deliveries (§3).
- No hands with extra or missing fingers, no melted faces, no mixed-up uniforms; redo instead of delivering.
