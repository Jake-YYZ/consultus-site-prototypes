# 05 — What the New Site Must Have Before Launch (SEO requirements)

> Plain-English spec for the WordPress rebuild team. Ordered by priority. P0 = launch blocker (skip it and we lose rankings/traffic the day we go live). P1 = do it in the first week. P2 = polish.
> Companion files: `01-existing-site-map.md` (what exists today), `02-gap-analysis.md` (what's missing), `03-redirect-map.csv` (the exact 301s), `04-meta-and-headers-comparison.csv` (title/H1 decisions), `06-blog-inventory.csv` (the 214 posts).

---

## P0 — Launch blockers

### 1. Deploy a complete 301 redirect map
Every URL Google currently knows about must resolve to a real page on the new site, or 301-redirect to the closest equivalent. The new site is both a **URL restructure** (e.g. `/conversion-rate-optimization/` becomes `/cro/`) and a **content cut** (214 blog posts + 67 service/location pages have no new home). That is ~280 URLs that will 404 on launch without redirects.
- Use `03-redirect-map.csv` as the source of truth.
- Redirects must be server-side **301** (permanent), one hop, no chains.
- Never blanket-redirect everything to the homepage. Google treats homepage-dumping as a soft-404 and drops the rankings anyway. Each redirect goes to the most topically relevant page.

### 2. Migrate the blog — preserve all 214 `/blog/<slug>/` URLs 1:1
The blog is the single largest content asset on the site and is **completely absent** from the new design. These posts earn informational rankings and internal-link equity that flow to the money pages.
- Bring every post across at the **exact same URL** (`/blog/<slug>/`). Same slug, same content at minimum.
- The new theme needs a working blog template (post, category, author, pagination) and the `/blog/` hub.
- See `06-blog-inventory.csv` for the keep/refresh/consolidate/prune call on each post. Default is **keep**. Anything marked `consolidate` or `prune` must still 301 to its replacement, never just disappear.

### 3. Generate and submit XML sitemaps
The new static export has **no `sitemap.xml` and no `robots.txt`**. Both are required.
- Produce an XML sitemap covering every live new URL (pages + blog + case studies).
- Add `robots.txt` that allows crawling and points to the sitemap.
- On launch day, submit the new sitemap in Google Search Console and keep the old sitemap reachable for a few weeks so Google can re-crawl and process the redirects.

### 4. Fix the canonical tags
Every page must have a **self-referencing** canonical pointing to its own final URL. Two bugs found in the prototype:
- `/locations/` canonical points to `/cro-agency-in-calgary/` (wrong — it tells Google the locations hub *is* the Calgary CRO page).
- `/locations/la/google-ads-agency-in-los-angeles/` canonical is doubled: `/locations/locations/la/...` (a 404 target).
- The two alias stubs (`/services/google-ads/`, `/industries/healthcare/`) are intentionally `noindex` and canonical to `/google-ads/` and `/healthcare/` — that is correct, leave them.

### 5. Lock in the title-tag and H1 decisions
The redesign rewrote **71 of 88** existing titles. Several dropped the keyword + geo that the page ranks on (e.g. the homepage went from "#1 Performance Marketing Agency In Toronto" to a brand-only line). Work through `04-meta-and-headers-comparison.csv`, accept/override each recommendation in the Decision column, then ship those exact titles/H1s. Do not launch with placeholder or brand-only titles on commercial pages.

---

## P1 — First week

### 6. Rebuild or redirect the 67 orphaned service/location pages
These rank today and have no new-site equivalent. For each (see `03-redirect-map.csv`): either rebuild the page at a sensible new URL, or 301 it to the closest parent. High-value ones flagged `rebuild_then_keep_url` should be rebuilt, not just redirected.

### 7. Map the legacy case studies
- Old `/portfolio/<client>/` and singular `/case-study/<slug>/` URLs must 301 to the new `/case-studies/<client>/` pages.
- Clients with no new case study yet (e.g. Comwave, ASI Group, Gorilla Bins, Orr Insurance) 301 to the `/case-studies/` hub until/unless rebuilt.

### 8. Preserve the dense internal linking
The live site links ~180 money pages from a sitewide mega-menu + footer; that is what keeps the deep service/location/vertical pages ranking. The new nav/footer must carry the same breadth (or we consciously decide to slim it and accept the ranking trade-off). Don't let the cleaner design quietly orphan the long-tail pages.

### 9. Per-page on-page essentials
- Exactly **one `<h1>`** per page (all new pages are clean here today — keep it that way).
- A unique **meta description** on every page. Two are currently blank: `/industries/healthcare/` and `/services/google-ads/` (both noindex stubs, low priority, but fill them anyway).
- No duplicate titles on indexable pages.

### 10. Structured data (schema.org JSON-LD)
The homepage has 2 JSON-LD blocks already. Standardize across the site:
- `Organization` + `LocalBusiness` (NAP, logo, sameAs socials) sitewide.
- `BreadcrumbList` on deep pages.
- `Article` on every blog post.
- `Review` / `AggregateRating` where the real Clutch/Google ratings appear.

---

## P2 — Polish

### 11. Social / Open Graph cards
The homepage has **no `og:` tags or `og:image`**. Add Open Graph + Twitter Card tags (title, description, image) sitewide so shared links render properly.

### 12. Performance & front-end hygiene (carried over from the build notes)
- `fonts.css` references `NuberNext-Regular.otf` (capitalized) but the files are lowercase — works on Mac, **404s on case-sensitive hosting**. Rename or fix references before launch.
- Asset URLs are absolute (`/assets/…`); confirm they resolve under the production domain/root.
- The embedded base64 logo and inlined CSS make pages heavy; consider externalizing for cache reuse and Core Web Vitals.

### 13. Post-launch monitoring (first 8 weeks)
- Search Console: submit the new sitemap, watch the Coverage/Pages report for 404 spikes and "Crawled, not indexed."
- Watch the redirect report and fix any that resolve to 404 or chain.
- Track rankings for the top commercial terms (CRO Toronto, SEO Toronto, Google Ads management Toronto, the location set) for 4–8 weeks; expect a brief dip then recovery if redirects are clean.
- Keep the old XML sitemap live for ~30 days so Google re-crawls and retires the old URLs gracefully.
