# 07: Developer Handoff Brief (relaunch SEO runbook)

> One page for the WordPress rebuild team. The goal of the relaunch is zero lost SEO. The new design changes URLs and drops content the live site still ranks for, so the work below is mandatory, not optional. Everything references files in this `seo-migration/` folder.

## The situation in two sentences
The live site has 373 indexed URLs (148 pages, 214 blog posts, 11 case studies). The new design covers 143 pages, uses different URLs, and has no blog yet. Without the steps below, roughly 280 ranking URLs return 404 on launch day.

## Pre-launch checklist (do all before cutover)

**1. Deploy the 301 redirect map.** Pick the format that matches the stack:
- WordPress (recommended): import `redirects/redirection-plugin-import.csv` into the **Redirection** plugin (Tools, Import).
- Apache: paste `redirects/htaccess-redirects.txt` above the `# BEGIN WordPress` block in `.htaccess`.
- nginx: include `redirects/nginx-redirects.conf` in the `server { }` block.
- Source of truth (all formats are generated from this): `03-redirect-map.csv`.
- Rules: server-side 301, one hop, no chains. Never redirect to the homepage.

**2. Migrate the blog.** Bring all 214 posts to the **same** `/blog/<slug>/` URLs. Build the blog templates (post, category, author, pagination) and the `/blog/` hub. The redesigned "Insights" hub design should be served at `/blog/` (or 301 `/insights/` to `/blog/`). Triage in `06-blog-inventory.csv`: 156 keep, 28 refresh (migrate now, update copy later), 30 consolidate (merge into the best version, then 301 the duplicates).

**3. Build the rebuild and orphan pages.** Three rebuild-at-same-URL pages: `/privacy-policy/`, `/insurance-industry/`, `/reputation-advertising-toronto/`. Plus the higher-value orphaned service pages in `03-redirect-map.csv` that you would rather rebuild than redirect.

**4. Ship the on-page meta.** The prototype already has the corrected title tags, meta descriptions, canonicals, `sitemap.xml`, and `robots.txt`. Carry these exact values into the WordPress build (Yoast/RankMath title + meta fields). Do not let the CMS regenerate brand-only titles on the commercial pages. Full reference: `04-meta-and-headers-comparison.csv`.

**5. Keep the internal linking dense.** Reproduce the sitewide mega-menu and footer link breadth (~180 money pages). That sitewide linking is what keeps the deep service, location, and vertical pages ranking.

## Launch day
1. Publish, then immediately verify a sample of redirects resolve (one per type) with `curl -I`.
2. Submit the new `sitemap.xml` in Google Search Console.
3. Keep the old XML sitemaps reachable for ~30 days so Google re-crawls and processes the redirects.

## First 8 weeks
- Search Console: watch the Pages/Coverage report for 404 spikes and "Crawled, not indexed."
- Fix any redirect that resolves to a 404 or a chain.
- Track the core commercial terms (CRO Toronto, SEO Toronto, Google Ads management Toronto, the city set). Expect a short dip then recovery if the redirects are clean.

## File index
- `00-START-HERE.md`, executive summary and decision log.
- `01-existing-site-map.md`, full inventory of the 373 live URLs.
- `02-gap-analysis.md`, old vs new, the five buckets.
- `03-redirect-map.csv`, every URL with its disposition (the master file).
- `04-meta-and-headers-comparison.csv`, per-page title and header decisions.
- `05-new-site-seo-requirements.md`, the full technical spec (P0 to P2).
- `06-blog-inventory.csv`, the 214 posts and their triage.
- `redirects/`, the deploy-ready redirect files (Apache, nginx, Redirection CSV).
- `data/`, the raw extracted data behind everything.
