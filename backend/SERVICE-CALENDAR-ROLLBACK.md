# Service duration calendar — 2026-11-03

Restore point before this change:
- Commit: e7c7d0ddea37a70333bcee25b86fbfd94590462e
- Preserved branch: backup/before-service-durations-2026-11-03
- Worker source: backend/worker-before-service-durations.txt (exact pre-change source).

Activation: publish frontend, then paste backend/worker-service-durations.txt into the existing Cloudflare Worker and Deploy. Check /api/schedule returns service-duration-v1. Until activation the new pages retain the old Worker flow.

Rollback: restore changed frontend files from the preserved commit and manually deploy its Worker source. Preserve all database rows and explicit duration_minutes; never reset the database. Old reservations retain their90min fallback. New variable-duration reservations retain their stored duration even after code rollback. Existing database blocks are not rewritten.

Services (minutes): ingrown30/60; onycholysis30/60; thickened40/80; fungal40/60; hyperkeratosis30/60; NiTi30; gel polish90; natural gel150; extensions165. Starts10:00–17:00 every30min; no end-time cap. Whole intervals must fit. Public availability exposes no client details. Server owns duration and atomic conflict checking; no client-supplied duration is trusted for bookings. Legacy clients without serviceId continue90min bookings for safe rollout.

Checks: node tests/booking-schedule.test.mjs; node tests/booking-ui.test.mjs.
