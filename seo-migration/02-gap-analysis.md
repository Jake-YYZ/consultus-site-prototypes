# 02 — Gap Analysis & Action Plan (old site vs new site)

> What exists on the live site, what the new design covers, and what to do about the difference. Every one of the 373 live URLs is assigned a disposition in `03-redirect-map.csv`. This document is the readable summary plus the decisions that are yours to make.

## Every live URL falls into one of five buckets

| Disposition | URLs | What it means |
|---|---:|---|
| **Keep** (same URL, 200) | 272 | 88 pages + 184 blog posts already live at a URL the new site will reuse. No redirect needed, but the page must actually exist in the new build. |
| **Redirect** (301) | 95 | Old URL is being retired or renamed. Must 301 to the closest new page or rankings die. |
| **Rebuild** (keep URL) | 3 | Valuable page with no new equivalent. Build it on the new site at the same URL. |
| **Prune** (410) | 3 | Expired one-off pages with no lasting value. Let them go. |
| **Brand-new** | 55 | Net-new pages in the redesign with no old URL. Nothing to migrate; just make sure they get into the sitemap and internal links. |

The 95 redirects + the missing blog are where the SEO risk lives.

---

## Bucket 1 — Keep (272 URLs, no redirect)
88 marketing pages keep their exact URL (all the `*-toronto` vertical pages, the location grid, most service-vertical pages, 7 case studies). **But the blog (184 of these) only "keeps" its URL if the blog is actually migrated** — see the blog section below. A "kept" URL that isn't rebuilt is just a 404 with extra steps.

## Bucket 2 — Redirect (95 URLs, 301)
Two kinds:

**a) URL restructure** — the page survives but the slug changes. These are clean, high-confidence 1:1 redirects:

| Old URL | New URL |
|---|---|
| `/conversion-rate-optimization/` | `/cro/` |
| `/about-us-online-marketing-agency/` | `/about/` |
| `/contact-us/` | `/contact/` |
| `/google-ads-management-toronto/` | `/locations/toronto/google-ads-agency-in-toronto/` |
| `/facebook-advertising-toronto/` | `/facebook-advertising-agency-in-toronto/` |
| `/content-marketing-toronto/` | `/content-marketing/` |
| `/bing-advertising-toronto/` | `/microsoft-ads/` |
| `/answer-engine-optimization/`, `/generative-engine-optimization/`, `/llm-seo-services/` | `/aeo-ai-search/` |
| `/ad-creatives/` | `/performance-creatives/` |
| `/locations/nyc/seo-agency-in-new-york-city/` | `/locations/new-york/seo-agency-in-new-york/` |

**b) Retired services with no exact equivalent** — these 301 to the closest parent. They work, but they're judgment calls you should confirm (full list with confidence levels in the CSV; the 24 medium/low-confidence ones are the "Decisions for you" list at the bottom). Examples: `/youtube-advertising-toronto/` and `/remarketing-marketing-toronto/` → `/google-ads/`; `/linkedin-advertising-toronto/` and `/tik-tok-advertising-agency-toronto/` → `/meta-ads/` (weak — these are distinct channels; consider rebuilding).

## Bucket 3 — Rebuild at same URL (3)
- `/privacy-policy/` — legally required. Rebuild it; do **not** redirect to contact.
- `/insurance-industry/` — an industry landing page with no new equivalent. Rebuild or fold into the verticals.
- `/reputation-advertising-toronto/` — a distinct service; rebuild rather than dumping into Meta Ads.

## Bucket 4 — Prune / 410 (3)
- `/landing/andromeda-unpacked-webinar/` — expired webinar LP.
- `/links/` — link-in-bio page.
- `/site-map/` — old HTML sitemap (replaced by the XML sitemap).

These have little to no SEO value. 410 ("gone") is fine, **unless** any has backlinks, in which case 301 it instead. Quick to check in Search Console / Ahrefs.

## Bucket 5 — Brand-new pages (55)
The redesign adds 55 pages with no old URL: `/about/`, `/cro/`, `/seo/`, `/meta-ads/`, `/google-ads/`, the healthcare sub-verticals, `/scorecard/`, `/zoho-crm/`, `/performance-creatives/`, the new case studies, etc. No migration needed. Just make sure they land in the XML sitemap and get internal links so Google finds them.

---

## The big one: the blog (214 posts, currently $0 in the new design)
The entire `/blog/` is missing from the new design. It is the largest content asset on the site and a major source of internal links into the money pages. Recommended policy: **migrate all 214 posts at their existing URLs.** Triage (`06-blog-inventory.csv`):

| Disposition | Posts | Action |
|---|---:|---|
| Keep as-is | 156 | Migrate unchanged. |
| Refresh | 28 | Migrate the URL now; update dated/thin content later. 12 have a year in the title (e.g. "…2019", "…2023") and read as stale. |
| Consolidate | 30 | Several near-duplicate posts (lots of overlapping CRO, UGC, and Google Ads "tips" articles). Merge into the strongest version, then 301 the others. Never just delete. |

Topic mix: Paid Media 48, Strategy/Agency 35, SEO 33, CRO 25, Content 18, Influencer/UGC 14, CRM 8, Social 9, Email 6, CDAP/Grants 7, Client Spotlights 3.

---

## Case studies — clean up the three URL patterns
The live site has case studies under three different paths. Consolidate onto the new `/case-studies/<client>/`:
- `/portfolio/<client>/` (7 legacy) → new `/case-studies/<client>/` where it exists, else the `/case-studies/` hub.
- `/case-study/ecycle-crm/` → `/case-studies/ecycle/`; `/case-study/tonic-eye-care/` → `/case-studies/tonic-eye-care/`; `/case-studies/the-office-shop/` → `/case-studies/office-shop/`.
- **`/case-studies/comwave/` and `/portfolio/comwave/`, `/portfolio/asi-group/`, `/portfolio/gorilla-bins/`, `/portfolio/orr-insurance-investment/`** have no new case study. 301 to the `/case-studies/` hub, or rebuild if any of these clients are worth showcasing.

---

## On-page titles & headers — 34 SEO regressions to rule on
The redesign rewrote 71 of 88 existing titles. Most are fine or better (the case studies now lead with real results — great for click-through). But **34 are SEO regressions** (31 are high-priority commercial pages) where the rewrite dropped the keyword, the geo modifier, or the rank signal the page ranks on. The clearest example:

| Page | Old title (ranks today) | New title (proposed) | Recommended |
|---|---|---|---|
| Homepage | #1 Performance Marketing Agency In Toronto [2026] | Consultus Digital / Marketing Engineered for Scaling Brands | **Performance Marketing Agency Toronto / Consultus Digital** |
| `/seo-toronto/` | #1 Performance SEO Agency Toronto | SEO Agency in Toronto / SEO + GEO | SEO Agency in Toronto / SEO + AI Search |
| `/cro-agency-in-*` (9 cities) | The Best CRO Agency [City] | The Best Conversion Rate Optimization Agency in [City] (too long, truncates) | CRO Agency in [City] / Consultus Digital |

Full page-by-page comparison with a recommended title, H1, and meta description for each, plus a blank **Decision** column, is in `04-meta-and-headers-comparison.csv`. The redesign's brand voice can stay; the recommendations just put the ranking keyword and geo back in the title tag.

---

## Decisions for you (the judgment calls)
Everything above is staged so you can decide rather than have it decided for you:

1. **Blog:** migrate all 214 at the same URLs? (Strong recommend: yes.) Approve the 30 consolidations and 28 refreshes, or keep everything as-is.
2. **24 medium/low-confidence redirects** (in `03-redirect-map.csv`, filter confidence ≠ high): mainly retired channel pages (LinkedIn, TikTok, YouTube, programmatic, social, reputation, email, UGC, photography/video) pointing to the closest surviving page. Confirm the targets, or decide which deserve a rebuilt page instead.
3. **3 prune (410) pages:** OK to let go, or 301 them somewhere?
4. **34 title regressions:** work the Decision column in `04-…csv` — keep new / use recommended / write your own.
5. **Internal linking:** keep the sitewide mega-menu breadth (preserves long-tail rankings) or slim it for the cleaner design?
