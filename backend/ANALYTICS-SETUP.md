# Aggregate site statistics

Deploy backend/worker-analytics.txt to the existing Cloudflare Worker, keeping all environment variables and DB binding. No new secret or provider account is needed. The first valid event creates the separate site_analytics table; slots and SMS logs are not deleted.

The private admin accordion loads only on expansion. Presets use Europe/Sofia and Monday-start weeks; inclusive manual ranges permit up to 367 days. Views, click event counts, page paths, referrer hosts, approximate country/city and day/hour totals are available. There are no unique-person counts, demographic guesses, precise locations or historic reconstruction.

Public pages load a small deferred script. It sends no cookie/identifier, form fields, phone values, URL query or referrer paths. No IP or user-agent is stored in D1; a transient in-memory IP rate limit is used at ingestion. GPC and Do Not Track suppress the client script. Known bot user agents are skipped, but counts are not guaranteed bot-free or complete. Referrer host means the immediately preceding site/page, not session-level marketing attribution. No precise districts are inferred.

Reports require the existing admin token. No third-party analytics vendor is used. Existing titles, descriptions, canonical/hreflang, headings, content, schema, sitemap and robots are unchanged. The only modification to the 24 public pages is the deferred script tag. Trackers blocked by browser/privacy settings will not be counted.

## Visit-based measurement v2
Deploy worker-visits.txt instead of the older aggregate-only Worker. Public tracker now offers Allow/Decline before recording visits and includes a Statistics preferences button to revoke consent. It uses a random first-party localStorage visit token shared across pages/tabs; a new token is generated after 10 minutes without activity. There is no permanent person ID, fingerprint, stored IP or link to bookings.

Private /api/admin/visits returns counts of visits starting within the selected Bulgarian dates plus the latest 100 histories. /api/admin/visit-details loads each history on expansion. Individual histories expire after 30 days; daily aggregate visit totals remain available for longer periods. Existing aggregate pageview history stays separate and cannot be converted into visits. Counts exclude users declining consent, GPC/DNT and blocked scripts; sessions are not unique people. Geo remains approximate and no demographics are guessed.

SEO metadata and public HTML are unchanged by this update; only the previously linked analytics script changes. Optional measurement preferences appear through that script. All old booking/SMS configuration remains unchanged.
