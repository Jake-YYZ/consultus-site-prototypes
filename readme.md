# Consultus Digital — Website Rebuild

This folder contains the in-progress rebuild of the Consultus Digital website as a single self-contained HTML file. Drop it into any browser and it runs — no server, no build step, no dependencies.

## What's in here

- **`Consultus - Website Inspo - Final.html`** — the working file. This is what you open and edit.
- **`assets/team/`** — drop team portrait JPGs here with these exact filenames:
  - `jake-matzanke.jpg`
  - `grace-natarelli-matzanke.jpg`
  - `mo-farazi.jpg`
  - `shannon-stoneburgh.jpg`
  - `isaac-ferguson.jpg`
- **`*.pre-*.html`** — snapshot backups from prior edit sessions. Safe to ignore or delete.

## How to work on it

### Open it
Double-click `Consultus - Website Inspo - Final.html`. It opens in your default browser. The whole site is inside that one file — all pages, CSS, JS, logos. Everything.

### Navigate
The nav pills at the top switch between pages (Home, Scorecard, Services, Industries, Work, About, Insights). Click around.

### Swap in photos and videos (no code required)
Most images and videos on the site are drop targets. Drag a file from Finder onto any:
- Team portrait tile on the About page
- Results page card
- Hero illustration on Home, Healthcare, Services, Influencer, etc.
- Video testimonial thumbnail

The file resizes on drop and saves into your browser's local storage. Page renders immediately. Reloading the page keeps it.

Videos go into IndexedDB (no localStorage size cap). Photos are resized to a reasonable size and stored as base64.

### Dev console helpers
Open DevTools (Cmd+Opt+I in Chrome/Safari) → Console, and you have:

- `consultusExportMedia()` — downloads a JSON snapshot of every image + video you've dropped onto the site. Back this up before switching computers.
- `consultusImportMedia()` — opens a file picker to restore from that JSON snapshot.
- `consultusListMedia()` — prints what's currently stored.
- `consultusClearMedia()` — wipes all stored media.
- `consultusListLeads()` — prints everyone who submitted the Scorecard audit form.
- `consultusExportLeads()` — downloads a CSV of leads.
- `consultusClearLeads()` — wipes stored leads.

## Working on it from a different computer

1. On your current machine, open DevTools console and run `consultusExportMedia()`. It downloads a JSON snapshot of all your dropped-in media.
2. Copy this whole folder (HTML + backups + assets + the JSON snapshot) to the new machine — email, Drive, Dropbox, Git, USB, whatever.
3. On the new machine, open the HTML file, then run `consultusImportMedia()` in the console and select the JSON snapshot. Everything comes back.

## Handing it off to a collaborator

Same as above. The whole project is:
- One HTML file (≈4 MB, self-contained, works offline)
- Optional `assets/team/` folder if you want portraits to ship as real files rather than in-browser storage
- Optional `consultus-media-snapshot-*.json` if you want them to inherit your dropped-in media

Zip the folder and send.

## Production path (when you're ready to deploy)

- Save real image files (hero illustrations, case study imagery, team portraits) into `assets/` and swap the HTML to reference them directly instead of relying on in-browser storage.
- Wire the `/scorecard` page's audit flow to a real backend (Cloudflare Worker + PageSpeed Insights + ScreenshotOne would work — the JS in `runAuditPreview()` is structured to swap with a single fetch call).
- The HTML has ~3MB of logo PNG base64 baked in 28 times. Replace with a single SVG `<symbol>` + `<use>` pattern to cut the file to ~40 KB.

## Open items the next person should know about

- Team bios in the About page lightbox are drafts marked `[placeholder]`. Rewrite in the team's own voice.
- Partner section lists Google, Meta, Zoho, Clutch only. HubSpot and Klaviyo were removed — we are not their partners.
- Timeline in About dates from 2020 (company founding year), not 2015.
- Some stats on the home page (127% pipeline growth, $42M ad spend, 47 Clutch reviews, 94% retention) need verification before ship.
- Em-dash audit: style guide forbids em dashes. Scan and replace site-wide with en dashes, parentheses, or restructured sentences.
