# Go-live checklist (written Oct 9 2026)

Plain-English list of what has to happen on the day the static site and the blog replace the live WordPress site.
Everything under "Already done on staging" is finished and only needs repeating on production where it says so.

## 1. Before the DNS switch

- **Production deploy.** `tools/kinsta/deploy_site.py` has the staging host, folder and URL as constants at the top;
  point them at production (or run it against the production Kinsta site) and deploy with `--apply`.
- **Blog, one more time before the switch.** The staging blog REPLACES the live blog, so staging is the source of truth and its
  edits stay (repointed links, alt text, the `//` fixes). The live blog keeps changing meanwhile (posts scheduled or edited there,
  for example `offline-conversion-tracking-clinics`): copy over only what is new or changed on live (`tools/blog-sync`, see
  CLAUDE.md), and never overwrite a post that was edited on staging. If `offline-conversion-tracking-clinics` comes over, put its link
  back in `healthcare-ads-rejected` (it was unlinked because the page did not exist on staging). Then collapse the double slashes
  in what came over (both forms, `--all-tables --skip-columns=guid`, `--dry-run` first):
  `wp search-replace 'kinsta.cloud//' 'kinsta.cloud/'` and `wp search-replace 'consultusdigital.com//' 'consultusdigital.com/'`,
  then repoint the internal links (`tools/blog-sync/server/repoint_redirects.php`, dry run first). Images written as
  `consultusdigital.com/wp-content/uploads/...` (root path) 404 here, uploads live under `/blog/wp-content/uploads/`.
  Run `python3 tools/qa/crawl_site.py` afterwards: it must report 0 links with `//`, 0 links to redirecting URLs and 0 failing targets.
- **Blog domain.** Take a database export, then replace the staging address inside the blog database:
  `wp search-replace 'https://stg-consultusdigital-staging.kinsta.cloud' 'https://consultusdigital.com' --all-tables --skip-columns=guid`
  (run from `public/blog`), then `wp cache flush`, `wp rankmath sitemap generate` and a Kinsta cache purge.
- **Staging noindex.** Staging sends `X-Robots-Tag: noindex, nofollow` on every page. Production must not:
  check with `curl -sI https://consultusdigital.com/ | grep -i robots` (no output is correct).
- **Sitemap dates.** Most of the 146 `<lastmod>` dates in `sitemap-pages.xml` say June 2026. Set them to the launch date.
- **Front controller.** Upload `tools/kinsta/index.php` to the production `public/index.php` (93 rules: 91 redirects,
  one of them the `/author/*` prefix rule, and 2 `410 Gone`; it also sends any URL with `//` to the clean address). Then run
  `python3 tools/kinsta/test_redirects.py https://consultusdigital.com`.
- **Search Console tag.** `google-site-verification` (the same value the live homepage carries) is in the homepage and the
  blog header, so ownership carries over. Check it is in the production HTML of `/`.
- **Look at the site on a real iPhone once.** Safari's engine was tested with Playwright's WebKit (Oct 9 2026: four bugs
  found and fixed), but that has no Safari toolbar and none of iOS's media rules (Low Power Mode stops autoplay). On an
  iPhone open the homepage, a city page (the hero photo), a service page (the hero animation, scroll away and back), About
  (open a team bio) and Contact (the form).

- **Client reviews (Jake's testimonials kit).** The new reviews component is built on 35 pages (see CLAUDE.md "Client reviews"). The
  user decided that quotes Jake sourced are accurate and real, so only the photos hold up go-live: Jake has to say where his photos came
  from and that each person agreed (his Drive folder "Enhanced sources (Gemini)" holds `-gemini.jpg` source files for 13 of the 23, and
  Stanislav's and Laura's new photos look different from the portraits that were on the site). Also open with Jake: whether the two
  Healthcare quotes approved on Oct 5 are approved for every page, whether Tricia Oldfield wrote the Zoho directory review (it is not
  used yet), photos for Siea Newton (Bow City) and Sara Cumming (Harmony), and the Comwave logo (a Rogers lockup). Justin Stone,
  Daniel Szypka and Dave Bangar stay out until Jake confirms; they are not in `tools/reviews/reviews.json` (the repository is public).
  When Jake clears one: add the person to the JSON, run `python3 tools/reviews/make_assets.py` and
  `python3 tools/build_reviews.py --write`, then `node tools/qa/qa_reviews.mjs`.

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
- After launch run GTM Preview. The contact form now goes to `/thank-you/` after sending (it pushes `zoho_form_submit` first).
  The live container already has triggers on `/thank-you/`, `/thank-you-cdap/` and `/thankyou`: submit one form and confirm the
  conversion tags fire on `/thank-you/` and that GA4 (`G-CJZMEB102J`) and Google Ads (`AW-11041559906`) load from the container.

## 5. Contact form

- A test lead labelled TEST is in Zoho CRM (Leads, id 4629781000074923001, name and company "TEST website QA (ignore)", sent Oct 9 2026). Delete it in Zoho. Note for later tests: Zoho silently drops a submission whose email it rejects (`example.com` never arrived), and a lead shows up about a minute after the post.
- Spam: the form has only a hidden trap and a 2 second delay. Add Cloudflare Turnstile (needs keys from Cloudflare and a
  small server relay) before launch if the junk-lead rate of the old form (11 of the last 12) matters.

## 6. After the switch

- Search Console: add the property (the tag is already in the pages), submit `https://consultusdigital.com/sitemap.xml`.
- Keep the OLD sitemap files (`/page-sitemap.xml`, `/case_study-sitemap.xml`, `/author-sitemap.xml`) reachable for about
  30 days so Google re-crawls the old URLs and meets the redirects (frozen copies from the live site are needed).
- LinkedIn, Facebook and Slack cache link previews: re-scrape the key pages with their debug tools (the share image is the
  new `og-share.jpg`).
- Re-run `python3 tools/kinsta/deploy_site.py --verify-only` and the page checks in `tools/qa/` against production.
