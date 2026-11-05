# Aggregate site statistics

Deploy backend/worker-analytics.txt to the existing Cloudflare Worker, keeping all environment variables and DB binding. No new secret or provider account is needed. The first valid event creates the separate site_analytics table; slots and SMS logs are not deleted.

The private admin accordion loads only on expansion. Presets use Europe/Sofia and Monday-start weeks; inclusive manual ranges permit up to 367 days. Views, click event counts, page paths, referrer hosts, approximate country/city and day/hour totals are available. There are no unique-person counts, demographic guesses, precise locations or historic reconstruction.

Public pages load a small deferred script. It sends no cookie/identifier, form fields, phone values, URL query or referrer paths. No IP or user-agent is stored in D1; a transient in-memory IP rate limit is used at ingestion. GPC and Do Not Track suppress the client script. Known bot user agents are skipped, but counts are not guaranteed bot-free or complete. Referrer host means the immediately preceding site/page, not session-level marketing attribution. No precise districts are inferred.

Reports require the existing admin token. No third-party analytics vendor is used. Existing titles, descriptions, canonical/hreflang, headings, content, schema, sitemap and robots are unchanged. The only modification to the 24 public pages is the deferred script tag. Trackers blocked by browser/privacy settings will not be counted.
