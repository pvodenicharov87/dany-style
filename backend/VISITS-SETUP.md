# Per-tab visit statistics v3

Replace the complete Cloudflare Worker source with backend/worker-final.txt. Keep the current D1 binding and secrets. No new environment variable is needed. GET /api/schedule exposes analyticsVisitVersion:3 after deployment. Deploy the matching frontend assets/site-analytics.js and admin.html from the same commit.

The user explicitly requested no consent popup. This is not a determination that the collection is exempt from consent requirements. This version uses a temporary pseudonymous UUID in sessionStorage, scoped to a browser tab, to link pages and selected clicks. It must not be described as identifier-free or anonymous. The footer disclosure accurately describes the temporary code. No persistent localStorage identifier, cookies, IP/UA hashing or device fingerprint is used. DNT/GPC suppress telemetry. Browser sessionStorage lifetime/restoration and opener copying mean this is an estimate of visits, never a count of unique humans. Storage-blocked browsers cannot reliably group pages. No ten-minute inactivity rule.

A direct/external navigate starts a new visit; internal navigation, reload and back/forward reuse the tab's code. A new tab normally has a new code, but browser duplication/opener copying may share an existing tab code. The server counts each visit UUID once. History contains page paths, timestamps, selected click categories, initial network country/city and referring hostname. It excludes form text, photos, names, email, phone values, URL queries, raw IP addresses and raw user-agent strings. Existing transient IP abuse rate limiting remains.

Active time: client ticks while document is visible and there has been pointer, keyboard or scroll activity within 30 seconds; heartbeat every 15 seconds while time changes, plus visibility/pagehide flush. Values are cumulative per page view; server keeps max rather than summing repeated heartbeats and caps by server-observed elapsed time. Hidden, idle and lost final requests can reduce recorded time. This estimates visible active time, not attention or reading time. No outgoing requests during automated tests except mocks.

D1 schema is additive: site_visit_pages is created automatically. Existing reservations and analytics remain untouched. Old visits may have no timed data: the UI shows unavailable, not invented zero. Detailed records age out after 30 days; daily totals persist. Pre-v3 records have different measurement semantics. Do not compare historic/new totals as identical unique-person counts.

UI: existing collapsed statistics and period dropdown preserved. Global period breakdowns remain outside visits. Opening one visit hides global aggregates and shows its summary table, per-visit page/view/time table, selected clicks, source, country, city and chronology. Back restores focus, scroll and list without losing period. No long explanatory paragraphs in the admin UI. Public SEO content and metadata are unchanged.

Checks: analytics-admin, analytics-tracker, analytics-visits, analytics and booking-ui tests; SMS mock regression. Publishing GitHub frontend and manually deploying Worker are separate steps; uploading the Worker alone cannot update admin.html.

## Display/history update v4

Use backend/worker-visits-v4-final.txt for this update (same content as worker.js and worker-final.txt). Tracking protocol stays visits-v3; /api/schedule advertises analyticsVisitVersion:4. The authenticated detail response adds detailVersion:4 and pageHistory with separate timestamp/page/activeMs for every page opening. It reads existing site_visit_pages rows, including already recorded v3 data, without changing collection or DB schema. Old visits without timed rows still have unknown durations.

Admin names all allowed BG/EN pages using site navigation names. It displays distinct page count separately from total openings; the visited-pages table shows per-page summed views/time. Chronology lists individual page openings and their own active time, including repeated opens of the same page. Click sections and the global click summary are removed from the UI; existing collection protocol remains compatible. Back/period/global breakdown behavior is preserved.


## Simplified visit and period summaries v5

Use worker-visits-v5-final.txt (identical to worker.js and worker-final.txt). /api/schedule advertises analyticsVisitVersion:5. Tracker/session protocol and D1 schema remain unchanged.

Individual summary has exactly three rows: date/time, distinct named pages, and total approximate active time. Visited pages is a deduplicated name-only list, without per-page counters or times. Only source/country/city sections remain; chronology and clicks are absent. Entering a service page directly does not imply a home-page view. Internal navigation preserves the same tab visit and initial referring source.

GET /api/admin/visits adds a summary for the entire selected period, independently of the latest-100 list. It counts each visit once for sources/countries/cities, groups page openings by page, and sums recorded page active time. UI shows overall distinct pages, summed active time, page-name/openings list and source/country/city visit counts. Old/expired records without timed history are not fabricated as fully measured; partial time is labeled available data. Detailed retention remains 30 days and lifetime daily counts remain separate.


## Calendar days and explicitly authorized history reset v6

Use worker-visits-v6-final.txt (identical to worker.js and worker-final.txt). /api/schedule advertises analyticsVisitVersion:6, analyticsDayTimeZone:Europe/Sofia and analyticsReset:visits-reset-2026-11-06-v6.

On the first schedule/analytics request after this Worker is deployed, ensureAnalyticsReady performs the user's explicitly requested reset. A single D1 transaction conditionally deletes ONLY site_analytics, site_visits, site_visit_daily, site_visit_events, site_visit_pages and site_visit_page_bases, then writes the reset marker into site_analytics_meta. Bookings/slots, forms, photos, email/SMS records and all unrelated tables are untouched. Concurrent requests and subsequent cold starts see the marker and do not reset again. Do not change this reset marker in later upgrades unless the user explicitly requests another reset. GitHub publication alone does not execute the production reset; Worker deployment and its first request are required.

Each visit/view/event ID is scoped server-side to its Europe/Sofia calendar date. Dates are taken from server receipt time, never client timezone or body.day. A continuing browser tab becomes a separate day segment after midnight; the visible page is counted for that new day on activity. Cumulative active time is rebased for a carried page, preventing the previous day's cumulative total leaking into today. Timing remains approximate: a partial heartbeat interval around midnight can be omitted. This does not create 10-minute sessions. Initial referring source remains the same in a carried visit.

Today/yesterday/week/month use Sofia dates and inclusive calendar-day keys; no rolling 24-hour window. Preset admin reports refresh across midnight when open; manual date ranges remain fixed. DST 23- and 25-hour days are covered by tests. analytics-calendar-day.test.mjs verifies winter midnight, DST boundaries, source preservation, scoped IDs, reset-once/concurrency, future data retention and booking preservation. No production data was deleted by local tests.
