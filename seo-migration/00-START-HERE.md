# SEO Migration Pack — Consultus Digital relaunch

**Prepared for:** Jake · **Date:** June 2026 · **Question answered:** "If we launch the new site, do we lose any of the SEO we've built?"

## The short answer
Yes — a lot, if we launch as-is. But it's all fixable, and this pack tells the rebuild team exactly how. The new design is both a **URL restructure** and a **content cut**, and the live site has far more indexed content than the new prototype contains.

## The picture in one table
| | Live site (today) | New design (prototype) |
|---|---:|---|
| Service / location / industry pages | 148 | 81 kept · **67 retired or renamed** |
| **Blog posts** | **214** | **0 (entire blog missing)** |
| Case studies | 18 (across 3 URL patterns) | 15 (some renamed, some new) |
| **Total indexed URLs** | **373** | |

**Three launch-day risks:**
1. ~95 ranking URLs change or disappear → **404s unless we deploy 301 redirects.**
2. The **214-post blog isn't in the new design** → biggest content asset and internal-link source, gone.
3. **34 page titles** were rewritten in a way that drops the keyword/geo they rank on (homepage included).

None of this is a reason not to launch. It's a checklist to launch *without* losing rankings.

## What's in this folder
| File | What it is |
|---|---|
| **`00-START-HERE.md`** | This summary. |
| **`01-existing-site-map.md`** | Complete inventory of all 373 live URLs, grouped, with current titles and the internal-link structure. |
| **`02-gap-analysis.md`** | Old vs new, the five buckets (keep / redirect / rebuild / prune / new), the blog plan, and the decisions that are yours. |
| **`03-redirect-map.csv`** | The deploy-ready list: every live URL → keep / 301-to-X / 410, with a confidence level and a Decision column. **This is the single most important file for launch.** |
| **`04-meta-and-headers-comparison.csv`** | Page-by-page old vs new title + H1, a recommended title/H1/description for each, and a blank Decision column for you. |
| **`05-new-site-seo-requirements.md`** | The spec for the rebuild team: P0 launch blockers → P2 polish. |
| **`06-blog-inventory.csv`** | All 214 posts with topic, type, and a keep/refresh/consolidate call. |
| `data/` | The raw extracted data behind all of the above (for the dev team). |

## Decisions — APPROVED & APPLIED (Jun 16 2026)
Jake approved all five; here's what was done.
1. **Blog:** migrate all 214 at existing `/blog/` URLs. Confirmed in `03-redirect-map.csv` (the `/blog/` hub stays put too) and `06-blog-inventory.csv` (30 consolidations + 28 refreshes approved).
2. **Redirects:** all confirmed. Deploy file `_redirects` generated at the project root (64 active 301s); full map in `03-…csv`.
3. **Prune (410):** 3 pages confirmed (check backlinks first — noted in the file).
4. **Title tags:** recommended titles + meta descriptions written into the **39 regression pages** (title, meta description, og:title, og:description). The 88 already-good titles were left as designed. Each page's status is in the Decision column of `04-…csv`.
5. **Internal linking:** keep the sitewide mega-menu breadth (already preserved in the new nav/footer).

## What's been applied to the files
- ✅ Title + meta + OG tags rewritten on the 39 pages whose titles had regressed (incl. homepage, the 9 CRO city pages, the Toronto vertical pages).
- ✅ Both canonical bugs fixed (`/locations/` + the doubled `/locations/locations/…`), plus 4 leftover copy-pasted Calgary tags on the locations hub. Full rescan: every indexable page now has a correct self-canonical.
- ✅ `sitemap.xml` (141 indexable URLs) and `robots.txt` generated at the project root.
- ✅ `_redirects` regenerated with the real 301 map (replacing the stale 2-line file).

## Still owned by the rebuild team (WordPress)
These are migration tasks the prototype can't perform, specified in `05-new-site-seo-requirements.md`: actually moving the 214 blog posts across, deploying the redirect map server-side, building the missing/rebuild pages, and submitting the new sitemap in Search Console at cutover.
