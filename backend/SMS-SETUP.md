# Dany Style: Mobica SMS setup

SMS is prepared but OFF until a funded/approved Mobica account and Worker secrets exist. Never put a password into source code, chat, URLs, or public files.

1. Register at https://user.mobica.bg/register (or sign in). The provider documents initial test funds; confirm your account's sender route, minimum top-up and actual rates in its portal. Published Bulgaria rate for0–25000 SMS is0.049 EUR excluding VAT per part.100 parts cost5.88 EUR if20% VAT applies; this is usage cost, not a confirmed minimum purchase.
2. In Cloudflare > Workers & Pages > dany-style > Settings > Variables and Secrets, add:
   - MOBICA_USER: Secret, the provider account username.
   - MOBICA_PASSWORD: Secret, the provider API/account password.
   - SMS_ADMIN_PHONE: Secret, Daniela's Bulgarian mobile in+359 format. Confirm the actual destination; the public studio contact is0897001475.
   - SMS_MAX_MESSAGES: text100.
   - SMS_ENABLED: texttrue (enable only when the account and balance are ready).
3. Replace the entire existing Worker code with backend/worker-sms-mobica.txt and Deploy. Keep all existing D1 bindings, mail and auth secrets.
4. /api/schedule must return smsVersion1 and smsEnabled true. The authorized /api/admin/sms-status shows local quota usage.100 is a total attempt cap, not a monthly allowance.100 SMS cover about50 reservations when both destinations differ; cancellation uses another two. Failed or uncertain attempts count conservatively too. Existing ledger rows are retained; raising SMS_MAX_MESSAGES increases the total cap after a new top-up.
5. Verify one controlled booking and cancellation, with the customer and Daniela approving their own test numbers. Verify receipt on both phones. The provider's accepted response is not proof of delivery. No live SMS has been sent during development.

Message templates are Bulgarian, max67 Unicode characters, so each consumes at most one SMS part. No service names, diagnoses, arbitrary cancellation reasons, or client names go into SMS. Cancellation reasons remain in email. Client booking SMS includes date/time; Daniela's booking SMS also includes the customer's phone. Both receive cancellation date/time. No home-visit SMS in this release.

For this lowest-cost Bulgaria configuration, only+359 mobile prefixes87/88/89/98/99 are eligible. Domestic08…/09… normalize to+359. Non-Bulgarian/invalid numbers are skipped without failing the booking; Daniela still receives her own SMS. Do not advertise international SMS until routes/prices are separately approved.

The server atomically claims each booking/event/recipient key and a quota slot before calling Mobica. Repeated requests never auto-resend an uncertain message. Network timeouts are unknown, not delivered. No automatic retries that could double-charge. No recurring subscription, paid sender ID, sender registration, premium number, marketing campaigns or automatic recharge is configured.

Provider docs: https://mobica.bg/en/docs/v2/api-application-programming-interface
Pricing: https://mobica.bg/bg/prices

Tests: node tests/booking-sms.test.mjs; node tests/booking-schedule.test.mjs; node tests/booking-cancellation.test.mjs.


## Version 2
Booking: client and Daniela. Home request: client and Daniela after successful email; this does not confirm an appointment. Cancellation: client only. Bulgarian and Belgian mobiles supported. Identical home requests within a UTC day share an SMS key. The 100-attempt cap includes failed and unknown attempts, is not monthly, and never automatically resets. Keep SMS_ENABLED=false until deployment and controlled testing.

## Version 3: temporary second administrator
SMS_ADMIN_PHONE=359897001475 (Daniela); SMS_ADMIN_PHONE_EXTRA=32471387908 (Petko). Booking/home requests send to client and both administrators; cancellation sends only to client. Identical phones are deduplicated. Existing SMS_MAX_MESSAGES=100 is a lifetime attempt cap including tests and failures, not a monthly reset. Existing failed notifications are not resent on top-up.
