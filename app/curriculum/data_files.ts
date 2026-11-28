/**
 * The curriculum files `curriculum:import` loads when no file is given,
 * in load order (data model: Curriculum, Import): subjects, CP sets,
 * the SD structure (13/2025), the MI allocation, then the SIGRAK topic
 * files. Paths are relative to the app root. The crosswalk is never
 * imported (D-365).
 */
export const defaultCurriculumFiles = [
  'docs/data/curriculum/subjects.json',
  'docs/data/curriculum/cp-umum-sd-bskap-046-2025.json',
  'docs/data/curriculum/cp-pendidikan-agama-sd-bkpdm-020-2026.json',
  'docs/data/curriculum/cp-pai-bahasa-arab-mi-sk-dirjen-9941-2025.json',
  'docs/data/regulations/curriculum-structure-permendikdasmen-13-2025.json',
  'docs/data/curriculum/mi-allocation-kma-1503-2025.json',
  'docs/data/curriculum/sigrak-sd-2026-r1-umum.json',
  'docs/data/curriculum/sigrak-sd-2026-r1-agama.json',
  'docs/data/curriculum/sigrak-mi-2026-r1.json',
] as const
