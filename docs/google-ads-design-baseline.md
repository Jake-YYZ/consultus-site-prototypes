# Google Ads design baseline

Implemented in `google-ads/index.html` from the Consultus Digital Website Revamp 2026 Figma prototype, node 262:182.

Reference: https://www.figma.com/proto/mbaW5wYYR0HC3Ka41DNwTr/Consultus-Digital-Website-Revamp-2026?node-id=262-182

## Reuse on the next service page

Copy the page shell and retain its self-contained styles, shared navigation, footer, metadata structure, and responsive rules. The page-specific design is scoped to `body.gads-revamp` and `.gads-page`. Replace the service content, metadata, FAQ structured data, evidence, and imagery together. Do not copy Google Ads claims into another service.

- NuberNext regular display headlines with blue italic emphasis on light sections, yellow on dark.
- Page accent `#3033BB`, warm background `#FAF8F3`, dark section background `#101010`.
- 1,200px content width, generous section spacing, pill buttons, restrained borders.
- Split hero and browser mockup, trust strip, dark results section, alternating editorial sections.
- Reusable treatments: rising process steps, photo cards, border benefit cards, numbered metric grid, alternating question table, case-study feature, testimonial carousel, native FAQ disclosures, blue closing CTA.
- Responsive layouts stack content on smaller screens. Horizontal format and testimonial rails support touch, buttons, and keyboard navigation. Motion respects the reduced-motion preference.

This is a responsive interpretation of the prototype. Stock photos replace the yellow-jacket people. Existing shared navigation/footer remain. The map, browser illustration, and video poster use web-native treatments rather than exact Figma exports.

## Image sources

New stock images, stored locally as optimized WebP:

- `assets/google-ads/strategy-team.webp`: Yan Krukau, Pexels photo 7698802. https://www.pexels.com/photo/coworkers-looking-at-a-laptop-in-a-meeting-7698802/
- `assets/google-ads/campaign-planning.webp`: Mikael Blomkvist, Pexels photo 6476252. https://www.pexels.com/photo/a-person-creating-marketing-plans-on-a-laptop-6476252/

Client testimonial portraits and Kase logo come from the existing public Consultus Digital Google Ads page and its WordPress uploads. They represent the named clients, not substitute stock identities.

- https://consultusdigital.com/google-ads-management-toronto/
- Portraits: `Rectangle-54-1.png`, `Rectangle-54.png`, `Rectangle-55.png`, `Rectangle-54-2.png`, `Rectangle-54-3.png` under `/wp-content/uploads/2025/07/`.
- Kase logo: `image-2-1.png` in the same uploads directory.

The dotted North America map derives from public-domain Natural Earth country boundaries. Existing service imagery remains in `assets/service-photos/`.

## Verification

Checked desktop and mobile layouts, horizontal overflow, image loading, local links and anchors, carousel controls, scope disclosures, FAQ disclosures, and video iframe launch. Checked one H1, unique IDs, balanced page structure, all five practical-question panels, and valid FAQ JSON-LD. No contact forms were submitted.

Local: http://localhost:8080/google-ads/

GitHub Pages: https://jake-yyz.github.io/consultus-site-prototypes/google-ads/
