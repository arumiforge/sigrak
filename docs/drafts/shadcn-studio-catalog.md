# shadcn/studio Pro catalog (radix variants)

Names only, taken on 2026-11-27 from the owner's shadcn/studio Pro files (D-434). No licensed source is in the repository. Use this list to pick a block when a screen needs one.

## Rules (D-434)

- Use only the `radix` variants, never `base`.
- Add a block or component only when the app uses it, through their CLI registry. The registry reads the account email and licence key from env (`.env` locally, a CI secret in CI); never commit them.
- Restyle every block to SIGRAK's identity and Fondasi `ui.md`: tokens from `inertia/css/tokens.css`, Indonesian copy through `resources/lang/id`, Hugeicons Pro through `inertia/components/icon.tsx` (the blocks import `@/registry/icons/icon-placeholder`). No generic template look.
- Record each block added in `THIRD_PARTY_NOTICES.md` (component, where it is used).
- Themes from `ss-themes` are references only; SIGRAK keeps its own tokens.

## What the Pro set offers

Counts in brackets are the number of variants.

| Package | Category | Blocks (variants) |
|---|---|---|
| ss-blocks | bento-grid | `bento-grid` (25) |
| ss-blocks | dashboard-and-application | `account-settings` (13), `application-block` (9), `application-shell` (32), `card-nav` (6), `charts-component` (65), `dashboard-dialog` (37), `dashboard-dropdown` (23), `dashboard-footer` (10), `dashboard-header` (18), `dashboard-shell` (12), `dashboard-sidebar` (12), `empty-state` (12), `event-calendar` (6), `file-upload` (7), `form-layout` (14), `gantt-chart` (4), `inbox-app` (3), `kanban-app` (10), `map-blocks` (2), `multi-step-form` (6), `multi-view` (3), `onboarding-feed` (8), `statistics-component` (28), `widgets-component` (28), `workflow-builder` (6) |
| ss-blocks | datatable | `datatable-advanced` (10), `datatable-columns` (6), `datatable-drag-and-drop` (4), `datatable-editing` (5), `datatable-example` (8), `datatable-expansion` (3), `datatable-export` (3), `datatable-filtering` (7), `datatable-grouping` (5), `datatable-infinite-scroll` (3) |
| ss-blocks | ecommerce | `announcement-banner` (12), `category-filter` (7), `checkout-page` (6), `gift-card` (4), `mega-footer` (5), `offer-modal` (5), `order-summary` (9), `product-category` (13), `product-list` (10), `product-overview` (11), `product-quick-view` (5), `product-reviews` (5), `shopping-cart` (4) |
| ss-blocks | marketing-ui | `about-us-page` (30), `ai-chat-bubble-component` (5), `app-integration` (10), `blog-component` (20), `compare` (7), `contact-us-page` (18), `cookies-consent` (3), `cta-section` (17), `download` (6), `error-page` (8), `faq-component` (24), `features-section` (33), `footer-component` (12), `forgot-password` (13), `gallery-component` (11), `hero-section` (53), `login-page` (13), `logo-cloud` (10), `navbar-component` (16), `portfolio` (18), `pricing-component` (23), `register` (13), `reset-password` (13), `social-proof` (12), `team-section` (21), `testimonials-component` (27), `timeline-component` (7), `two-factor-authentication` (13), `user-schedule` (5), `verify-email` (13), `video-call-component` (3), `waitlist-component` (6) |
| shadcn-studio | dashboard-and-application | `account-settings` (1), `application-block` (1), `application-shell` (1), `charts-component` (1), `dashboard-dialog` (4), `dashboard-dropdown` (2), `dashboard-footer` (1), `dashboard-header` (1), `dashboard-shell` (1), `dashboard-sidebar` (1), `empty-state` (1), `event-calendar` (1), `file-upload` (1), `form-layout` (2), `onboarding-feed` (1), `statistics-component` (2), `widgets-component` (2) |
| shadcn-studio | ecommerce | `product-list` (1) |
| shadcn-studio | marketing-ui | `about-us-page` (2), `blog-component` (3), `compare` (1), `cta-section` (2), `faq-component` (2), `footer-component` (1), `forgot-password` (1), `gallery-component` (1), `hero-section` (5), `login-page` (1), `logo-cloud` (2), `portfolio` (1), `register` (1), `reset-password` (1), `social-proof` (1), `testimonials-component` (3), `timeline-component` (1), `two-factor-authentication` (1), `user-schedule` (1), `verify-email` (1) |

**Components (`ss-components`, radix):** `accordion`, `alert`, `aspect-ratio`, `autocomplete`, `avatar`, `badge`, `breadcrumb`, `button`, `button-group`, `calendar`, `card`, `carousel`, `checkbox`, `code-block`, `collapsible`, `color-picker`, `combobox`, `command`, `context-menu`, `data-table`, `date-picker`, `dialog`, `drawer`, `dropdown-menu`, `form`, `input`, `input-mask`, `input-otp`, `kanban`, `kbd`, `label`, `list`, `menubar`, `navigation-menu`, `pagination`, `phone-input`, `popover`, `progress`, `radio-group`, `rating`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `slider`, `sonner`, `sortable`, `spinner`, `stepper`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`, `typography`

**Page examples (`shadcn-studio`):** `about-page-06`, `about-us-page-01`, `app-integration-01`, `changelog-page-01`, `contact-page-09`, `contact-us-page-01`, `cta-section-01`, `faq-component-01`, `faq-page-01`, `feature-page-01`, `features-section-01`, `footer-component-01`, `forgot-password-01`, `hero-section-01`, `integrations-page-01`, `login-page-01`, `navbar-component-01`, `pricing-component-01`, `pricing-page-16`, `register-01`, `reset-password-01`, `social-proof-01`, `team-section-01`, `timeline-component-05`, `two-factor-authentication-01`, `verify-email-01`, `waitlist-01`, `waitlist-02`, `waitlist-03`, `waitlist-04`, `waitlist-06`

**Themes (`ss-themes`):** `art-deco`, `caffeine`, `claude`, `clean-slate`, `corporate`, `elegant-luxury`, `ghibli-studio`, `marshmallow`, `marvel`, `material-design`, `midnight-bloom`, `modern-minimal`, `nature`, `neo-brutalism`, `pastel-dreams`, `perplexity`, `slack`, `spotify`, `summer`, `sunset-horizon`, `valorant`, `vs-code`
