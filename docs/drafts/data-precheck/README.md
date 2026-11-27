# Data pre-check (RS-15)

Agents checked the draft data sets against their official sources on 2026-11-27 (D-447). Nothing in `docs/data/` was changed: each report lists flagged items with the data location, what differs, the source page and a suggested fix. People review only the flagged items; a set moves from `draft` to `active` after that review.

| Report | Data checked | High | Medium | Low |
|---|---|---|---|---|
| [sd-cp-general.md](sd-cp-general.md) | SD general subjects: 12 subjects, 432 topics, CP against Kepka BSKAP 046/2025 | 4 | 14 | 11 |
| [religion-mi-cp.md](religion-mi-cp.md) | SD religion CP (BKPDM 020/2026), MI PAI and Bahasa Arab CP (SK Dirjen Pendis 9941/2025), MI allocation (KMA 1503/2025), R1 topic files | 0 | 3 | 4 |
| [regulations.md](regulations.md) | 18 regulation extracts, 3,362 quotes, metadata and hashes | 0 | 4 | 6 |
| [taxonomy.md](taxonomy.md) | 326 taxonomy nodes, 38 registry entries, 28 relations | 2 | 7 | 11 |
| [calendar.md](calendar.md) | 2026 and 2027 national holidays (SKB matched), Jawa Tengah 2026/2027 | 0 | 1 | 3 |
| [catalogs-profiles.md](catalogs-profiles.md) | 206 catalog codes, SD and MI profiles | 3 | 2 | 7 |
| **Total** | | **9** | **31** | **42** |

## Points that need an owner decision

- **CP text (sd-cp-general #1):** topics carry guide-book summaries, not the decree text per element and phase. Store the decree text and link topics to it?
- **KKA (taxonomy, D-208):** Permendikdasmen 13/2025 lists KKA as an optional regular subject in grades 5–6; D-208 files it as kokurikuler only.
- **Pramuka (catalogs):** the catalog locks Pramuka; Pasal 22 ayat (2) of 13/2025 allows Pramuka or another kepanduan.
- **Kokurikuler theme (catalogs):** "Gaya Hidup Berkelanjutan" is hidden although Panduan Kokurikuler 2025 lists it.
- **Supervision instruments (taxonomy):** the two "telaah" instruments are marked mandatory and cite a juknis that does not contain them.
- **AN for MI (catalogs-profiles):** the MI profile lacks Asesmen Nasional, which Permendikdasmen 9/2026 includes.
- **Content outside the decree (sd-cp-general):** PAI tajwid items, Bahasa Inggris Fase A topics, PJOK element names from the older curriculum, content placed in the wrong phase.

The other flags are corrections a data task can make without a decision (wording, references, notes, fokus→TP links).
