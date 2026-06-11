# Consultus Digital — Design Prototyping Environment

## What this project is

A complete static export of consultusdigital.com (downloaded from Netlify). It is a **design prototyping environment, not a production site**. Jake (President of Consultus Digital, not a developer) uses it to design campaign landing pages, interactive concepts, and page redesigns. Everything built here is a visual and behavioral spec that his team will rebuild in WordPress. Explain technical things in plain English and handle all technical steps for him.

## How the site is structured

- Every page is a folder containing a single `index.html` (e.g. `about/index.html`, `seo-toronto/index.html`). URLs map 1:1 to folders.
- Each `index.html` is **self-contained**: the full CSS design system is inlined in a `<style>` block in the `<head>`. There is no shared stylesheet except `/assets/fonts.css` (font declarations only).
- **To create a new page that matches the brand:** copy an existing page (the homepage `index.html` or a service page like `cro/index.html`), keep the `<style>` block, nav, and footer, and replace the body sections. This guarantees brand consistency.
- Shared assets live in `assets/`: fonts (`assets/fonts/`), brand mark (`assets/brand/consultus-mark.svg`), hero/team videos (`assets/video/`).
- The logo is embedded as a base64 PNG inside each page (large but works offline).
- Ignore: `consultus - website inspo - final.backup.html` (old single-file prototype), `zi4edkzp`, `zirh7zqj`, `zivb9k9s` (leftover zip bundles from the Netlify download), `launch-qa-report.txt`, `link_audit.md`, `redirects.csv`, `_redirects`.

## Fonts

One typeface, custom licensed: **NuberNext**. Loaded via `/assets/fonts.css`. Brand rule: "One face. Two voices."

- `NuberNext` Regular (400) + Italic — body text and all display headlines
- `NuberNext` DemiBold (600) + Italic — emphasis, sub-heads
- `NuberNext Wide` DemiBold (600) — H3s and section labels ONLY, never body text

CSS variables (defined in every page's `:root`):
- `--sans` and `--serif` both resolve to `'NuberNext', 'Helvetica Neue', Arial, sans-serif` (ignore stale CSS comments mentioning Fraunces/Inter, those refer to an older direction)
- `--wide`: `'NuberNext Wide', ...` for labels
- `--mono`: `ui-monospace, 'SF Mono', Menlo, Consolas, monospace` for eyebrows/labels

⚠️ Path gotcha: `fonts.css` references `NuberNext-Regular.otf` (capitalized) but the files on disk are lowercase (`nubernext-regular.otf`). Works on a Mac (case-insensitive), **will 404 on GitHub Pages** (case-sensitive). Also all asset URLs are absolute (`/assets/...`), which breaks under a GitHub Pages project URL prefix. Fix both when deploying.

## Color palette (canonical, from `:root` in every page)

Light surfaces:
- `--paper: #FAF8F3` — main page background (also the theme-color)
- `--bone: #F5F2EC` — secondary/alt section background
- `--bone-border: #E1DCD1` — borders on light
- `--pure: #FFFFFF` — cards on bone

Dark surfaces:
- `--ink: #141414` — primary black (dark sections, footer, primary buttons, text on light)
- `--onyx: #0D0D0D`, `--onyx-2: #161616`, `--onyx-3: #1E1E1E`, `--onyx-border: #262626` — deepest blacks for layered dark sections
- `--graphite: #2A2A2A` — secondary button borders, dark text

Brand accents:
- `--deep-blue: #1A40C7` (alias `--blue`) — primary accent on LIGHT backgrounds
- `--yellow: #FFEC00` — primary accent on DARK backgrounds, hover states, text selection
- `--yellow-dark: #FDD200` — deeper yellow variant
- `--blue-soft: #5D7BEA`, `--blue-light: #B4BFEB`, `--deep-blue-pale: #E9EEFD` — blue tints

Text greys: `--charcoal: #6A686B` (muted text on light), `--char-2: #8A878B`, `--muted: #8C8A87`, `--grey: #C7C5C8` (muted text on dark), `--paper-dim: #A8A5A0`

Status: `--green: #2D8F5F`, `--red: #D94545`

**The core rule:** blue is the accent on light backgrounds, yellow is the accent on dark backgrounds. Accent words in headlines use `<span class="sem">` (italic, blue on light / yellow on dark).

## Typography scale

- Hero H1: `clamp(40px, 7vw, 96px)`, weight 400, line-height 0.98, letter-spacing -0.025em
- Section title (`.sec-title`): `clamp(32px, 4.5vw, 56px)`, weight 400, line-height 1.05, letter-spacing -0.02em
- CTA title: `clamp(40px, 6vw, 88px)`, same tight leading
- Pull quote (`.quote`): `clamp(24px, 3vw, 38px)`, line-height 1.3
- Stat numbers (`.stat-num`): `clamp(48px, 5vw, 84px)`, weight 500, letter-spacing -0.04em
- Hero subtitle (`.hero-sub`): 18px, line-height 1.55, color `#E8E6E1` on dark, max-width 640px
- Body: 16–17.5px, line-height ~1.55, `--charcoal` or `--graphite` on light
- Eyebrow (`.eyebrow`): mono, 11px, weight 500, uppercase, letter-spacing 0.08em, with a 6px round dot (`.eyebrow-dot`, blue on light / yellow on dark)
- Section label (`.section-lbl`): same mono style with a 32px horizontal line before it (blue on light, yellow on dark)
- Headlines are LIGHT (weight 400) with tight negative letter-spacing. Never bold display headlines.
- Text selection is yellow on black (`::selection`).

## Buttons

All buttons are pills (`border-radius: 100px`):
- `.btn` base: padding 15px 26px, 14px, weight 500, inline-flex with 10px gap
- `.btn.primary`: black `#141414` background, paper `#FAF8F3` text
- `.btn.primary.on-dark`: inverted (paper background, black text)
- `.btn.secondary`: transparent, 1px `#2A2A2A` border, black text
- `.btn.secondary.on-dark`: border `rgba(255,255,255,0.4)`, paper text
- `.btn.cta-yellow-hover`: the signature interaction. Black button that turns **yellow with black text** on hover, plus `translateY(-1px)` lift. Transitions: 0.25s ease background/color, 0.2s ease transform.
- Nav CTA (`.nav-cta`): same black pill → yellow hover pattern, padding 10px 18px, 13px

## Header / nav pattern

`<nav class="main">`: sticky frosted-glass bar. Background `rgba(251, 250, 247, 0.92)` with `backdrop-filter: blur(20px) saturate(180%)`, bottom border `rgba(20,20,20,0.06)`, padding 16px 32px. Logo left (click → `/`), `.nav-links` right, black pill "Book a Call" CTA linking to `/contact/`. On mobile most links hide; a `.mobile-show` link gets a yellow-tinted pill treatment.

## Footer pattern

`<footer>`: ink `#141414` background, `#C7C5C8` text, padding 80px 32px 32px. Inner wrapper max-width 1280px. Logo row (32px tall logo) with 56px below, then `.footer-cols` grid: `repeat(5, 1fr) 1.4fr`, 40px gap. Columns are link lists with `<h4>` headers (Company / service categories / contact).

## Section & layout system

- Content sections: `.sec` — `padding: 100px 32px; max-width: 1200px; margin: 0 auto`
- Full-bleed dark: `.sec.dark-full` (ink background) with `.sec-inner` (max-width 1200px, padding 100px 32px) inside
- Full-bleed bone: `.sec.bone-full`, same inner pattern
- Section header: `.sec-head` — 2-col grid `1fr 1.3fr`, 60px gap, 60px margin-bottom (label/title left, supporting copy right)
- Standard content width: **1200px**. Footer inner: 1280px. Side padding: **32px** desktop, 16px mobile
- Vertical rhythm: 100px section padding, 60px between section head and content, 40px between major elements, 28px after headlines
- Cards: white or bone backgrounds, ~10px border-radius, subtle `rgba(20,20,20,0.08)` borders
- Page texture alternates light (paper) → bone → dark (ink) sections; heroes are typically dark with yellow accents or paper with blue accents

## Site-wide components

**Sticky case study video banner** (`assets/case-study-banner.js`, loaded by every page via a `<script defer>` tag before `</body>`):
- Floating bottom-right card promoting the E11ement case study video (Wistia media `3fl1o2nq2n`, account `consultus.wistia.com`).
- First page of a session: card slides in after 1.2s, video auto-plays muted and loops. Click anywhere on it = full-screen theater with sound, resuming from the teaser's position, with "See All Case Studies" and "Book a Call" CTAs.
- Closing the card, closing the theater, or visiting later pages in the same session collapses it to a black pill ("Watch: E11ement Case Study"). State lives in sessionStorage key `csBannerState`; clear sessionStorage to see the auto-open again.
- Skips the `/case-studies/` hub, respects `prefers-reduced-motion`, detects the GitHub Pages prefix at runtime for its CTA links.
- Muted autoplay must be triggered through the Wistia player API in `onReady` (`video.mute(); video.play()`); the `autoPlay=true` embed option alone does not fire.
- To swap in a future video: change `WISTIA_ID` and `TITLE` at the top of the file.

## Working preferences (Jake's rules)

1. **Never use em dashes in any copy.** Use commas, periods, or restructure. (This is also official Consultus style, enforced in their QA.)
2. Marketing copy: punchy, confident, direct.
3. Always confirm before deleting anything or making changes that can't be undone.
4. When a page is done, give both the local preview path AND the shareable GitHub Pages link.
5. Jake is not a developer. Plain English, no jargon, handle all technical steps for him.

## Previewing locally

Run a local server from the project root (absolute `/...` paths require a server, double-clicking individual HTML files won't work):

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` (homepage) or `http://localhost:8080/<folder>/` for any page. Jake can also double-click `Preview Site.command` in Finder, which does the same thing.

## Deployment (already set up, working as of June 2026)

- GitHub account: **Jake-YYZ**. Repo: **public**, `https://github.com/Jake-YYZ/consultus-site-prototypes`
- `gh` CLI installed at `~/.local/bin/gh`, authenticated, and wired into git credentials.
- GitHub Pages deploys automatically on every push to `main` via `.github/workflows/deploy-pages.yml`.
- Live preview URL format: `https://jake-yyz.github.io/consultus-site-prototypes/<folder>/`
  (homepage: `https://jake-yyz.github.io/consultus-site-prototypes/`)
- The workflow rewrites root-relative URLs (`href="/..."`, `src="/..."`, `location.href='/...'`, `url(/...)`) to include the `/consultus-site-prototypes/` prefix at publish time. **Local files keep plain root-relative paths** — write new pages with `/assets/...` and `/contact/`-style links and the workflow handles the rest.
- After a push, deploys take about 1 minute. When a page is done, give Jake BOTH links: local (`http://localhost:8080/<folder>/`) and live (`https://jake-yyz.github.io/consultus-site-prototypes/<folder>/`).
