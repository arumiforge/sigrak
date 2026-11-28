# R1-12 — UI shell: layouts, navigation, icons, design tokens, SPA feel

- **Phase:** R1
- **Status:** todo
- **Owner:** —
- **Depends on:** R1-08, R1-09 (so their pages are in place); D-473
- **Can run in parallel with:** R1-11

## Goal

One UI shell every page uses, so the app looks and feels like SIGRAK on phones and desktops: persistent layouts and navigation per area, Hugeicons Pro, design tokens from the design system, shadcn/studio Pro blocks restyled, and the SPA behaviour of D-389. The R1 pages are moved onto it; R5 builds on the same patterns.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/final/design-system.md` (Direction, Stack mapping, Colour tokens, Type/space/shape, Components, Status labels, Mobile rules, UI writing rules)
- `docs/final/product-concept.md` (roles and navigation per role)
- Decisions D-389, D-390, D-402, D-434, D-445, D-471, D-472, D-473
- `docs/drafts/shadcn-studio-catalog.md`, `inertia/icons/hugeicons/README.md`, `docs/drafts/eyd-rules.md`
- Existing shell: `inertia/layouts/`, `inertia/components/`, `inertia/app.tsx` (or the Inertia entry), the R1 pages in `inertia/pages/`
- Fondasi `fondasi-ui` and `fondasi-feedback` skills only if Fondasi is attached (`docs/agent/fondasi-check.md` §1)

## Output

- **Layouts per area:** `app.` (school roles), `admin.` (staff console), `ujian.` (exam site), guest/auth. Persistent layouts so navigation keeps state. App: bottom navigation on phones (max five items per role), sidebar on desktop, role switch and account in the header; menus from one role-aware config, labels from `nav.json` (first word capitalised, D-472). The layer pages of R1-07 and every R1 page get their menu entries.
- **Icons:** `inertia/components/icon.tsx` maps names to the licensed Hugeicons Pro files (Rounded Stroke default, Rounded Solid for active states only, D-402, D-434); placeholder icons removed; unused icons tree-shaken.
- **Design tokens:** colours, type scale, spacing, radius and shadows from the design system as Tailwind 4 theme tokens (light and dark), status label colours (D-445); shadcn/ui components restyled to them; one place to change them.
- **Shared patterns:** page header, empty state, skeletons, toast (Sonner) with undo, confirm dialog, drawer (Vaul) on phones vs dialog on desktop, data table (TanStack Table + Virtual) with mobile cards, form field with hint and error, source badge from R1-07 aligned to the tokens.
- **SPA feel (D-389):** persistent layouts, link prefetch on hover/touch, deferred props with skeletons, optimistic updates with undo where a page already saves, view transitions between pages, progress bar for slow visits; respects reduced motion.
- **Pages moved onto the shell:** login and auth pages, Akun, Guru, Tahun Ajaran, Kelas, Kalender, Jadwal, the layer pages, the console pages, the exam home, error pages.
- **Checks:** Playwright screenshots of every page at 360 and 1280 px, light and dark; no horizontal scroll; tap targets at least 44 px; visible focus; axe accessibility check without serious issues; translation and EYD tests still pass. Screenshots go in the PR description summary, not the repository.

## Done when

- [ ] Every R1 page uses the shell; tests, lint, typecheck and format check pass
- [ ] Screenshot set reviewed by the owner (360 and 1280 px)
- [ ] Result filled, open questions listed (visual direction choices for the owner)

## Result
