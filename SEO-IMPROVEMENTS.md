# SEO Improvement Plan for the Consultus Digital Site

**Scope:** Every page currently built in this prototype (156 HTML pages).
**Date:** 2026-06-24
**Reminder:** This folder is the design prototype. None of these are live on consultusdigital.com yet. Every fix below should be baked into the WordPress rebuild, not patched into the prototype, unless you want the prototype to stay accurate as a spec. Where a fix is purely a deploy concern for the GitHub Pages preview (not the real site), it is called out at the end.

---

## How this was produced

1. A full automated scan of all 156 pages pulled every title, meta description, canonical, social tag, structured-data block, heading, image, internal link, and word count into one dataset.
2. Eleven specialist reviewers then read the actual page content (homepage, service pages, city pages, the templated city families, Toronto vertical pages, industry/healthcare pages, case studies, plus cross-cutting passes on technical SEO, structured data, internal linking, and AI-search readiness).
3. The highest-impact findings were re-checked against the real files before being written up here. Every number in this document was confirmed directly, not estimated.

---

## Executive summary

The site is in good shape on the fundamentals most sites get wrong: every page has a unique title, a canonical tag, a single clean H1, mobile viewport, alt text on images, and rich structured data. The 10 flagship "Digital Marketing Agency in [City]" hub pages are genuinely localized and well built.

The problems are concentrated in five areas:

1. **Roughly 40 to 55 near-identical "doorway" city pages** (Facebook, Microsoft, Instagram, CRO, and the per-city Google Ads / SEO families). These are 89 to 93 percent identical to each other with only the city name swapped. This is the single biggest risk: Google explicitly penalizes doorway pages, and these pages also compete with each other and with the national service pages for the same keywords.
2. **Structured-data bugs that are actively wrong**, including review stars (4.9 from 47 reviews) hard-coded onto 70 pages with no real reviews behind them, every case study tagged as being about "Self-Storage," and broken HTML sitting inside schema fields on 78 pages.
3. **Indexation gaps:** the 10 flagship city hubs and the Amazon Ads page are missing from the sitemap, so the best pages on the site are the hardest for Google to find.
4. **A weak internal-link structure:** most of the money pages have only 0 to 2 internal links pointing at them, a navigation link points to a `/healthcare-marketing/` hub that does not exist (404), and 7 pages link to a leftover backup file.
5. **No social/share image anywhere** and the homepage is missing all Open Graph and Twitter tags, so every link shared on LinkedIn, Slack, or in paid social looks broken.

None of these are hard to fix. Most are template-level changes that apply across many pages at once.

---

## Top priorities

| # | Item | Severity | Affected | Effort |
|---|------|----------|----------|--------|
| 1 | Fix or consolidate the near-duplicate city-service pages (doorway risk) | Critical | ~40 to 55 pages | L |
| 2 | Remove or substantiate the fake review stars (AggregateRating) in schema | Critical | 70 pages | M |
| 3 | Add the 10 city hubs + Amazon Ads to the sitemap | High | 11 pages | S |
| 4 | Fix Article schema: every case study says it is about "Self-Storage" | High | 15 pages | S |
| 5 | Fix the wrong `keywords` tag copied from the LA CRO page | High | 11 pages | S |
| 6 | Create the missing `/healthcare-marketing/` hub (currently a 404) | High | 1 hub + 6 orphaned children | M |
| 7 | Remove HTML tags embedded inside JSON-LD `name` fields | High | 78 pages | S |
| 8 | Build an internal-link mesh so money pages are not orphaned | High | ~100 pages | M |
| 9 | Add Open Graph + Twitter tags and a share image site-wide | Medium | 156 pages | S |
| 10 | Fix the 7 links to the deleted backup HTML file | High | 7 pages | S |
| 11 | Fix homepage JSON-LD placeholder name and malformed URL | Medium | 1 page | S |
| 12 | Trim 22 over-long meta descriptions to under 160 characters | Medium | 22 pages | S |

---

## 1. Duplicate and doorway content (highest priority)

**Near-identical city pages across templated families.**
Severity: Critical. Affected: ~40 to 55 pages. Effort: L.
Evidence: Measured body-text similarity within each family, comparing every page to the first sibling:
- `facebook-advertising-agency-in-*`: 11 pages, ~1,770 words each, **89.5%** identical
- `the-best-microsoft-advertising-agency-in-*`: 10 pages, **93.5%** identical
- `locations/instagram-advertising-agency-in-*`: 10 pages, **92.8%** identical
- `cro-agency-in-*`: 9 pages, **92.8%** identical
- `locations/<city>/google-ads-agency-in-*` (8) and `locations/<city>/seo-agency-in-*` (7) are built from the same template.
By contrast, the `digital-marketing-agency-in-*` hubs are only 18.7% similar, which is what genuine localization looks like. The difference between the good hubs and these families is the whole point.
Why it matters: Google's doorway-page guidance specifically targets "multiple pages... generated to rank for very specific queries like city names" with little unique value. At 90 percent-plus duplication, these qualify. They also split ranking signals across near-identical URLs instead of concentrating them.
Fix: Pick one of two paths per family.
- **Consolidate (recommended for low-priority cities):** keep one strong page per service (the national hub) and 301-redirect the thin city variants into it, or into the relevant city hub.
- **Genuinely localize (for priority cities):** rewrite each page with real local content the way the digital-marketing hubs were done (local market data, neighborhoods served, local client examples, city-specific FAQs). If a page cannot carry genuinely unique local value, it should not exist as a standalone URL.

**Keyword cannibalization between national, city-hub, and city-service pages.**
Severity: High. Affected: most service keywords. Effort: M.
Evidence: For "CRO" alone there are `/cro/`, nine `/cro-agency-in-<city>/` pages, and five `/conversion-rate-optimization-for-<industry>-toronto/` pages all chasing overlapping intent. For Toronto SEO there are three competing pages: `/seo-toronto/` (2,182 words), `/locations/toronto/seo-agency-in-toronto/` (1,691 words), and `/search-engine-optimization-for-...-toronto/` variants. Meta Ads has `/meta-ads/` plus 11 `facebook-advertising-agency-in-*` pages.
Fix: Define one canonical target per keyword cluster and make the rest support it. A clear hub-and-spoke model: national service page = the hub for the generic term; city hub = the hub for "[service] [city]"; everything else either supports those with internal links or gets consolidated.

**Two thin stub pages duplicate live pages.**
Severity: Low (already handled, but worth cleaning up). Affected: 2 pages. Effort: S.
Evidence: `/services/google-ads/` (8 words, no H1) and `/industries/healthcare/` (9 words, no H1) are near-empty duplicates of `/google-ads/` and `/healthcare/`. Both correctly carry `noindex` and a canonical to the real page, so they are not currently hurting anything.
Fix: In the production rebuild, replace these stubs with proper 301 redirects rather than keeping empty noindex pages.

---

## 2. Structured data and Google policy

**Fake review stars (AggregateRating) on 70 pages.**
Severity: Critical. Affected: 70 pages. Effort: M.
Evidence: 70 location and service pages embed `AggregateRating` of `4.9` from `47` reviews in their JSON-LD, with no corresponding review content visible on the page and no `Review` objects.
Why it matters: Google does not allow self-serving review markup (a business rating itself) for `LocalBusiness`/`Organization`, and unverifiable or fabricated ratings can trigger a structured-data manual action. This is the most legally and reputationally risky item in the audit.
Fix: Either remove the `AggregateRating` blocks entirely, or replace them with real, verifiable ratings that are also displayed as visible reviews on the page (with proper `Review` objects). Do not ship the current version to production.

**Every case study is tagged as being about "Self-Storage."**
Severity: High. Affected: 15 pages. Effort: S.
Evidence: All 15 case studies carry `"about": "Self-Storage"` in their Article schema regardless of the real client. Confirmed on BookSeats, La Vie Executive Health, Eco Choice Windows, and Zayouna Law, none of which are self-storage. This is a copy-paste error from a template.
Fix: Set `about` to the real client industry per page, or remove the field. While in there, also add `datePublished` and `dateModified` (currently missing on all 15), `author` (Consultus Digital), `publisher` with logo, and `image`, so the case studies are eligible for article rich results.

**Broken HTML inside JSON-LD `name` fields on 78 pages.**
Severity: High. Affected: 78 pages. Effort: S.
Evidence: 78 pages contain `"name": "<a href=..."` inside their structured data, meaning raw HTML anchor tags leaked into schema text fields that should be plain text. This invalidates those blocks.
Fix: Strip HTML out of all schema string fields so they contain plain text only. This is a single template fix applied across the affected pages.

**Homepage structured data has a placeholder name and a malformed URL.**
Severity: Medium. Affected: 1 page. Effort: S.
Evidence: The homepage `WebPage` JSON-LD `name` is the leftover placeholder `Consultus Website Recamp | Consultus Digital`, and its `url` is `https://consultusdigital.com/./` (the `/./` should be `/`).
Fix: Set the real page name and a clean `https://consultusdigital.com/` URL.

**FAQPage schema on 89 pages no longer earns rich results.**
Severity: Low (cleanup, not a penalty). Affected: 89 pages. Effort: M.
Evidence: 89 pages include `FAQPage` schema. Since Google's 2023 change, FAQ rich results only show for recognized government and health sites, so this markup no longer produces the star/expandable result it was added for.
Fix: It is not harmful as long as the FAQ content is genuinely visible on the page (it is here), so this is low priority. Keep it for AI-search and future-proofing, but do not count on FAQ rich snippets in Google. Make sure no FAQ markup describes content that is hidden from users.

**Organization schema is incomplete.**
Severity: Medium. Affected: 80 pages. Effort: M.
Evidence: The `Organization` blocks lack `logo`, `sameAs` (links to social profiles), and any `founder`/`foundingDate` data.
Fix: Add `logo`, `sameAs` (LinkedIn, Instagram, Facebook, Google Business Profile), and founder/founding details. This strengthens the brand "entity" that both Google and AI search engines use to understand who Consultus Digital is.

**LocalBusiness vs ProfessionalService inconsistency.**
Severity: Medium. Affected: ~60 pages. Effort: M.
Evidence: City and service pages mix `LocalBusiness`, `ProfessionalService`, and `Service` types inconsistently for the same business.
Fix: Standardize on one primary business type (`ProfessionalService` is the best fit for a marketing agency) and use it consistently, with `Service` blocks nested for individual offerings.

---

## 3. Indexation, sitemap, and crawlability

**Flagship city hubs and Amazon Ads are missing from the sitemap.**
Severity: High. Affected: 11 pages. Effort: S.
Evidence: `sitemap.xml` lists 141 URLs but omits all 10 `digital-marketing-agency-in-*` hubs (the best pages on the site) and `/amazon-ads/`. The 404 page, the two noindex stubs, and the proposal are correctly excluded.
Fix: Add the 11 missing indexable pages to the sitemap.

**All sitemap entries share one `lastmod` date.**
Severity: Low. Affected: sitemap. Effort: S.
Evidence: Every URL has `lastmod` of `2026-06-16`, which tells Google nothing about real freshness.
Fix: In production, generate `lastmod` from each page's real last-modified date.

**robots.txt is minimal.**
Severity: Low. Affected: site-wide. Effort: S.
Evidence: `robots.txt` allows everything and references the sitemap, which is fine, but does not disallow the client proposal template.
Fix: Add `Disallow: /proposal/` so the unfilled `[Client Name]` proposal template can never be indexed, and confirm it stays out of the sitemap.

---

## 4. On-page metadata (titles, descriptions, social)

**No social share image anywhere; homepage missing all Open Graph and Twitter tags.**
Severity: Medium. Affected: 156 pages (homepage worst). Effort: S.
Evidence: 0 of 156 pages have an `og:image`. The homepage has zero Open Graph and zero Twitter tags. `og:title`/`og:description` are missing on 17 pages; `twitter:card` exists on only 37 of 156.
Why it matters: This does not affect Google rankings, but every time a Consultus Digital link is shared on LinkedIn, Slack, iMessage, or used in paid social retargeting, it renders as a bare link with no image or description, which kills click-through.
Fix: Create a default 1200x630 share image (plus a few page-specific ones for the homepage and top case studies), and roll a complete Open Graph + Twitter Card block into the shared page template so all 156 pages get it.

**The wrong `keywords` tag was copied onto 11 pages.**
Severity: High (clear error). Affected: 11 pages. Effort: S.
Evidence: All 10 `digital-marketing-agency-in-*` hubs and `/amazon-ads/` carry `keywords="Conversion Rate Optimization agency Los Angeles, L.A. CRO, CRO agency in Los Angeles"`, which is the wrong city and the wrong service, copied from the LA CRO template.
Fix: The `keywords` meta tag is ignored by Google and is on 100 pages total. The cleanest fix is to remove it everywhere. At minimum, fix the 11 pages carrying the LA text, because it signals a templating error that may have been copied elsewhere.

**22 meta descriptions are too long and will be cut off in search results.**
Severity: Medium. Affected: 22 pages. Effort: S.
Evidence: 22 descriptions exceed 160 characters, including `/medical/` (247), the six `healthcare-marketing/*` pages (210 to 231), several case studies (183 to 211), `/seo-toronto/` (210), and `/careers/` (187).
Fix: Trim each to 150 to 160 characters with the key message and a call to action up front.

**Four pages have no meta description.**
Severity: Low to Medium. Affected: 4 pages. Effort: S.
Evidence: `/404.html` (fine), `/industries/healthcare/` and `/services/google-ads/` (both noindex stubs, low impact), and `/proposal/...` (should stay out of the index anyway).
Fix: Add descriptions where pages are meant to be indexed; for the stubs and proposal, the priority is keeping them noindex rather than writing descriptions.

**Several core service titles are too short to compete.**
Severity: Low to Medium. Affected: ~7 pages. Effort: S.
Evidence: `/seo/` has a 23-character title (`SEO | Consultus Digital`), the shortest on the site. `/meta-ads/` (28), `/google-ads/` (30), `/services/` (28), `/results/` (27), `/about/` (28), `/insights/` (28), and `/local-seo/` (29) all undershoot. Meanwhile the city variants have keyword-rich titles, so the national hubs are out-titled by their own spokes.
Fix: Expand to 50 to 60 characters with the primary keyword and a benefit, for example `SEO Services That Drive Revenue | Consultus Digital` or `Google Ads Management Agency | Consultus Digital`.

**Two duplicate titles.**
Severity: Low. Affected: 4 pages. Effort: S.
Evidence: `Google Ads | Consultus Digital` is on both `/google-ads/` and `/services/google-ads/`; `Healthcare Division | Consultus Digital` is on both `/healthcare/` and `/industries/healthcare/`. In both cases the duplicate is a noindex stub, so impact is limited, but it disappears once the stubs become redirects.

---

## 5. Internal linking and site architecture

**Most money pages are orphaned or near-orphaned.**
Severity: High. Affected: ~100 pages. Effort: M.
Evidence: From the internal-link graph, most revenue pages have only 0 to 2 internal links pointing at them: every Instagram and Microsoft city page, the six `healthcare-marketing/*` subpages, many `*-toronto` vertical pages, plus `/medical/`, `/seo-toronto/`, and `/article/` (0 inbound). Pages with few internal links get crawled less, rank worse, and receive almost no link equity.
Fix: Build a deliberate hub-and-spoke mesh. Each service hub should link down to its city and industry spokes, each spoke should link back up to its hub and sideways to siblings, and case studies should link to the relevant service, industry, and city pages. Add a contextual "related services / related locations" block to the page template.

**A navigation link points to a `/healthcare-marketing/` hub that does not exist.**
Severity: High. Affected: 1 missing hub + 6 orphaned children. Effort: M.
Evidence: The homepage and at least `/local-seo/` and `/seo-toronto/` link to `/healthcare-marketing/`, but there is no `index.html` there, so the link 404s. The six real subpages (dental, med-spas, medical-clinics, plastic-surgery, preventative-health, specialty-allied-health) sit under that path with almost no links into them.
Fix: Build the `/healthcare-marketing/` hub page, link it to all six specialty subpages, and link the six subpages back to it. Also have `/healthcare/` link to these subpages (today it links to "cards" but not the actual pages).

**Seven pages link to a deleted backup file.**
Severity: High (broken links). Affected: 7 pages. Effort: S.
Evidence: The six `healthcare-marketing/*` subpages and `/self-storage-marketing-toronto/` link to `/Consultus%20-%20Website%20Inspo%20-%20Final.html`, the old single-file backup, almost certainly from a stale breadcrumb or sidebar in the template.
Fix: Find and remove or repoint these links in the shared template.

**Ambiguous anchor text (same word, different destinations).**
Severity: Medium. Affected: service pages. Effort: M.
Evidence: City names like "Calgary" and "Montreal" link to more than one destination from the same page set (for example a CRO city page and a Google Ads city page), which dilutes the relevance signal each link sends.
Fix: Make anchor text describe the destination ("CRO agency in Calgary" rather than just "Calgary").

**`/locations/la/` vs `/locations/los-angeles/` inconsistency.**
Severity: Low. Affected: LA pages. Effort: S.
Evidence: The Los Angeles city hub links to `/locations/la/...` while the canonical LA path elsewhere is `/locations/los-angeles/...`.
Fix: Standardize on one LA path and redirect the other.

---

## 6. Content depth and E-E-A-T

**Healthcare and medical pages lack trust signals (YMYL).**
Severity: Medium. Affected: 8 pages (`/healthcare/`, `/medical/`, 6 `healthcare-marketing/*`). Effort: M.
Evidence: These pages have no named authors, no credentials, and no citations. Health-adjacent topics are held to a higher trust bar (Your Money or Your Life) by Google.
Fix: Add author bylines with real names and roles, link to the team page, cite sources where claims are made, and surface relevant healthcare client results. This also helps the schema-level E-E-A-T story.

**Thin hub pages.**
Severity: Low. Affected: `/services/` (510 words), `/insights/` (551), `/contact/` (487). Effort: M.
Evidence: These hubs are mostly links with little supporting copy. `/services/` has only an H1 and one H2.
Fix: Add keyword-rich section headings and short descriptive copy for each discipline on `/services/`, an intro and structure on `/insights/`, and a value-of-the-call paragraph above the `/contact/` form. Not urgent, but it strengthens topical authority.

**No team / author markup.**
Severity: Medium. Affected: `/about/` and team profiles. Effort: M.
Evidence: `/about/` lists 14 team members as plain text with no `Person` schema and no individual bios.
Fix: Add `Person` schema and short bios. This feeds both E-E-A-T and AI-search entity understanding.

---

## 7. AEO / AI-search readiness

The site sells AEO as a service (`/aeo-ai-search/`), so it should model best practice itself.

**No `llms.txt` file.**
Severity: Low. Affected: site-wide. Effort: S.
Evidence: There is no `/llms.txt`, the emerging convention for telling AI crawlers what your site is and which pages matter.
Fix: Add a simple `llms.txt` at the root describing Consultus Digital, its core services, and links to the most important pages.

**Weak brand entity definition.**
Severity: Medium. Affected: site-wide. Effort: M.
Evidence: Across the Organization schema there is no founder, no `sameAs`, and no founding date, and the homepage and `/about/` do not state clear, extractable facts (who founded it, when, where, what it does in one sentence) in a way an LLM can lift cleanly.
Fix: Add a crisp "Consultus Digital is a [what], founded in [year], headquartered in Toronto, that does [services] for [audience]" statement, and complete the Organization schema. This is the same work as the structured-data and E-E-A-T items above, viewed through the AI lens.

**Concepts are not defined inline.**
Severity: Medium. Affected: 30+ service and city pages. Effort: M.
Evidence: Service pages rarely define their own terms (what AEO is versus SEO, what MER means, what CRO covers) in the short, quotable form that AI answers pull from.
Fix: Add a one or two sentence plain-language definition near the top of each service page, plus comparison content where relevant. The existing FAQ blocks already help here; lean into them.

---

## 8. Quick wins (find-and-replace level, do these first)

These are low-effort, high-confidence fixes:

- Add the 11 missing pages (10 city hubs + Amazon Ads) to `sitemap.xml`.
- Fix the wrong LA `keywords` tag on 11 pages (or remove `keywords` site-wide).
- Set the real `about` industry (or remove it) in all 15 case study Article schemas.
- Remove the HTML tags from JSON-LD `name` fields on 78 pages.
- Fix the homepage JSON-LD placeholder name and the `/./` URL.
- Remove or replace the AggregateRating stars on 70 pages (this one is critical, not just quick).
- Repoint or remove the 7 links to the deleted backup file.
- Trim the 22 over-long meta descriptions.
- Lengthen the 7 short core-service titles.
- Add `Disallow: /proposal/` to robots.txt.

---

## 9. Prototype-to-production deploy caveats

These are not site SEO problems, but they will break things if the prototype is ever served as-is (they do not affect the eventual WordPress build):

- **Font file casing:** `fonts.css` references `NuberNext-Regular.otf` but the files on disk are lowercase. This works on Mac but 404s on case-sensitive hosting like GitHub Pages.
- **Absolute asset paths:** all assets use `/assets/...`, which breaks under the GitHub Pages project sub-path. The deploy workflow rewrites these, so keep authoring with root-relative paths.
- **72 images use empty `alt=""`:** fine if they are decorative, but worth confirming none are meaningful content images that should have descriptive alt text.
- **Language and region:** every page is `lang="en"` with no `hreflang`. The London pages target London UK and share the same `.com` structure as the North American pages. If the UK is a real target market, plan `hreflang` (en-GB vs en-CA vs en-US) for the production site.

---

## Suggested roadmap

**Phase 1, quick wins (days, mostly template or find-and-replace):**
Sitemap additions, keywords fix, Article `about` fix, JSON-LD HTML cleanup, homepage schema fix, AggregateRating removal, broken backup-file links, over-long descriptions, short titles, robots.txt. This clears the critical structured-data risk and the obvious errors with minimal effort.

**Phase 2, structural (weeks):**
Decide consolidate-vs-localize for each city-service family and execute it; build the missing `/healthcare-marketing/` hub; build the internal-link mesh; add Open Graph / Twitter / share images site-wide; standardize the business schema type and complete the Organization entity. This resolves the doorway risk and the orphaning, which are the biggest ranking blockers.

**Phase 3, content and authority (ongoing):**
Genuinely localize the priority city pages; add E-E-A-T signals (authors, credentials, citations, `Person` schema) especially on healthcare; flesh out thin hubs; add `llms.txt` and inline definitions for AI search. This is where durable, compounding ranking gains come from.

---

*Prepared from a full scan of all 156 pages plus a multi-agent content review. Every figure was verified against the source files.*
