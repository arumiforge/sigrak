# R0-06 — Spike: BullMQ AI job with SSE progress

- **Phase:** R0
- **Status:** todo
- **Owner:** —
- **Depends on:** R0-05
- **Can run in parallel with:** R0-07

## Goal

One AI generation job on the `worker-ai` role with live progress in the browser over Transmit (D-388), using the teacher-key rotation of `docs/final/ai-provider-engine.md`.

## Read first

- `docs/final/ai-provider-engine.md`, `docs/final/content-engine.md` (one job per content type), Fondasi `ai-assistant.md`

## Output

- BullMQ queue + worker process role, Transmit channel per user, a demo page that starts a job and shows steps, cancel, retry
- Japa tests with a fake provider (429, timeout, empty reply → failover)

## Done when

- [ ] Progress reaches the page within 1 s of each step; a worker restart does not lose the job
