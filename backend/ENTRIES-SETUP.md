# Entry statistics v2

Deploy backend/worker-entries.txt as the complete Worker source. Existing DB binding and secrets remain unchanged. No new secret or binding. Frontend assets/site-analytics.js and admin.html must be deployed together with this Worker version. GET /api/admin/visits returns visitVersion:2 after deployment.

The primary count is an estimate of entries, NOT unique people. An initial page with an external or absent referrer counts once; internal referrals, reloads and back/forward restorations do not count as entries. Every initial page load is counted separately as a page view. Explicit new direct loads and external links can create new entries, including the same person. Referrer suppression can overcount internal navigation; redirects, restored tabs, blockers, offline requests and bots can cause errors. No ten-minute rule. No IP/UA hashing, cookies, browser storage or device fingerprint. DNT/GPC clients are omitted. Existing old browser tokens are no longer read or transmitted; previously stored values may remain unused until browser site data is cleared.

No cross-page visitor identity. The server generates an unrelated random record ID for each entry solely so the authenticated admin can open its entry details. That ID is never returned to the visitor and cannot link later pages. The entry stores time, entry page, referrer hostname and approximate country/city for 30 days. Daily totals and aggregate page/click breakdowns persist. No raw IP, user agent, URL query, form fields or booking IDs in entry records. Network IP remains transiently used by the pre-existing abuse rate limiter. Historical consent-based visits retain their old meaning and age out normally; historical totals cannot be converted into entry counts.

Admin: collapsed statistics, presets/custom range; click an entry button to open a detail view. Back restores list, focus and scroll without refetching. No nested accordion per entry. City is explicitly approximate. SEO metadata, public HTML content, sitemap, canonical links and booking/email/SMS logic are unchanged.

Transparency notice is available as a collapsed footer section. Removing browser identifiers does not itself constitute a legal determination that consent is unnecessary; site operator must assess the limited collection and applicable requirements. No claim of exact unique visitor counts or universal consent exemption.

Checks: analytics-tracker.test.mjs, analytics-visits.test.mjs, analytics.test.mjs and booking-ui.test.mjs. All mocked; no real SMS, mail, reservations or analytics events sent by tests.
