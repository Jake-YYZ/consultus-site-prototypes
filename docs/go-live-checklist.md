# Go-live checklist (written Oct 9 2026)

Plain-English list of what has to happen on the day the static site and the blog replace the live WordPress site.
Everything under "Already done on staging" is finished and only needs repeating on production where it says so.

## 1. Before the DNS switch

- **Production deploy.** `tools/kinsta/deploy_site.py` has the staging host, folder and URL as constants at the top;
  point them at production (or run it against the production Kinsta site) and deploy with `--apply`.
- **Blog domain.** Take a database export, then replace the staging address inside the blog database:
  `wp search-replace 'https://stg-consultusdigital-staging.kinsta.cloud' 'https://consultusdigital.com' --all-tables --skip-columns=guid`
  (run from `public/blog`), then `wp cache flush`, `wp rankmath sitemap generate` and a Kinsta cache purge.
- **Staging noindex.** Staging sends `X-Robots-Tag: noindex, nofollow` on every page. Production must not:
  check with `curl -sI https://consultusdigital.com/ | grep -i robots` (no output is correct).
- **Sitemap dates.** 130 of the 145 `<lastmod>` dates in `sitemap-pages.xml` say June 2026. Set them to the launch date.
- **Front controller.** Upload `tools/kinsta/index.php` to the production `public/index.php` (92 rules: 89 redirects,
  3 `410 Gone`). Then run `python3 tools/kinsta/test_redirects.py https://consultusdigital.com`.

## 2. Redirects the host has to do (they are not in the repo)

- `http://` to `https://` and `www.` to the bare domain, both as 301. Other sites still link to `http://consultusdigital.com/`
  (64 links), `https://www.consultusdigital.com/` (32) and `http://www.` (23), so this keeps their link value.
- The subdomains `growth.consultusdigital.com` and `strategy.consultusdigital.com` carry links and must keep resolving.
  `ns1.` and `ns2.` are nameserver names; nothing to do.

## 3. Security headers (Kinsta support or a Cloudflare response-header rule)

Staging sends only `X-Content-Type-Options: nosniff` (checked Oct 9 2026). Production should send:

| Header | Value | What it does |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Browsers only ever use https for the site. Add this only after https and the redirects above work everywhere, including the subdomains. |
| `X-Content-Type-Options` | `nosniff` | Already sent. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Other sites see the domain, not the full page address. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Switches off browser features the site never uses. |
| `X-Frame-Options` | `SAMEORIGIN` | Other sites cannot put ours in a frame. |

Not now: a `Content-Security-Policy`. The site uses inline scripts, Google Tag Manager and embedded video, so a strict
policy needs a "report only" trial first. After the change, check the result at securityheaders.com.

Already fine on staging: `/blog/xmlrpc.php` answers 403, the user list and author pages are closed, no internal file
(CLAUDE.md, tools, seo-migration, `_redirects`) is served, WordPress's `readme.html` is deleted (WordPress puts it back
on a core update; delete it again) and the blog no longer prints its version.

## 4. Tracking

- Google Tag Manager (`GTM-MGSZK8WC`) and the Zoho chat load for every visitor on consultusdigital.com and `www.`, as on the
  old site, from the head of every page (they never load on staging, GitHub Pages or localhost).
- There is no cookie banner. One was built on Oct 9 2026 and removed the same day because it was not wanted. If a lawyer
  later says one is needed for UK, EU or Quebec visitors, it is a separate piece of work.
- After launch run GTM Preview. The container needs a trigger on the `zoho_form_submit` event or ad conversions for the
  contact form will not fire.

## 5. Contact form

- A test lead labelled TEST is in Zoho CRM (Leads, id 4629781000074923001, name and company "TEST website QA (ignore)", sent Oct 9 2026). Delete it in Zoho. Note for later tests: Zoho silently drops a submission whose email it rejects (`example.com` never arrived), and a lead shows up about a minute after the post.
- Spam: the form has only a hidden trap and a 2 second delay. Add Cloudflare Turnstile (needs keys from Cloudflare and a
  small server relay) before launch if the junk-lead rate of the old form (11 of the last 12) matters.

## 6. After the switch

- Search Console: add the property, submit `https://consultusdigital.com/sitemap.xml`.
- Keep the OLD sitemap files (`/page-sitemap.xml`, `/case_study-sitemap.xml`, `/author-sitemap.xml`) reachable for about
  30 days so Google re-crawls the old URLs and meets the redirects (frozen copies from the live site are needed).
- LinkedIn, Facebook and Slack cache link previews: re-scrape the key pages with their debug tools (the share image is the
  new `og-share.jpg`).
- Re-run `python3 tools/kinsta/deploy_site.py --verify-only` and the page checks in `tools/qa/` against production.
