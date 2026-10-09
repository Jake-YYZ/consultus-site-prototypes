<?php
/**
 * Site header: head, nav, services bar. Markup is lifted from the static site so the blog matches it.
 */
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<!-- Cookie consent: Google Tag Manager and the chat widget load on consultusdigital.com only, and only after the visitor accepts -->
<script src="/assets/consent.js" defer></script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="theme-color" content="#FAF8F3">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/css/site.css">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link" href="#main-content">Skip to content</a>

<nav class="main">
    <div class="logo" onclick="window.location.href='/'" style="cursor:pointer"><img src="/assets/brand/consultus-wordmark-dark.png" alt="Consultus Digital" style="height:28px;width:auto;display:block" /></div>
    <div class="nav-links">
      <a onclick="toggleMega('services-mega-menu')">Services ▾</a>
      <a href="/divisions/">Divisions</a>
      
      <a href="/results/">Results</a>
      <a href="/about/">About</a><a href="/careers/">Careers</a>
      <a href="/blog/">Insights</a>
      <a class="nav-cta" href="/contact/">Book a Call</a>
      <button type="button" class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav" hidden><span class="nav-toggle-bars" aria-hidden="true"></span></button>
    </div>
  </nav>
<div class="svc-marquee-bar" aria-label="Services"><div class="svc-marquee"><div class="svc-marquee-track"><a class="svc-pill" href="/google-ads/">Google Ads</a><a class="svc-pill" href="/meta-ads/">Meta Ads</a><a class="svc-pill" href="/microsoft-ads/">Microsoft Ads</a><a class="svc-pill" href="/amazon-ads/">Amazon Ads</a><a class="svc-pill" href="/seo/">SEO</a><a class="svc-pill" href="/local-seo/">Local SEO</a><a class="svc-pill" href="/content-marketing/">Content Marketing</a><a class="svc-pill" href="/aeo-ai-search/">AEO / AI Search</a><a class="svc-pill" href="/influencer-marketing/">Influencer Marketing</a><a class="svc-pill" href="/performance-creatives/">Performance Creatives</a><a class="svc-pill" href="/web-development/">Web Development</a><a class="svc-pill" href="/landing-pages/">Landing Pages</a><a class="svc-pill" href="/cro/">Conversion Rate Optimization</a><a class="svc-pill" href="/ab-testing/">A/B Testing</a><a class="svc-pill" href="/zoho-crm/">Zoho CRM</a><a class="svc-pill" href="/marketing-automation/">Marketing Automation</a><a class="svc-pill" href="/analytics-attribution/">Analytics & Attribution</a><a class="svc-pill" href="/sales-enablement/">Sales Enablement</a><a class="svc-pill" href="/google-ads/">Google Ads</a><a class="svc-pill" href="/meta-ads/">Meta Ads</a><a class="svc-pill" href="/microsoft-ads/">Microsoft Ads</a><a class="svc-pill" href="/amazon-ads/">Amazon Ads</a><a class="svc-pill" href="/seo/">SEO</a><a class="svc-pill" href="/local-seo/">Local SEO</a><a class="svc-pill" href="/content-marketing/">Content Marketing</a><a class="svc-pill" href="/aeo-ai-search/">AEO / AI Search</a><a class="svc-pill" href="/influencer-marketing/">Influencer Marketing</a><a class="svc-pill" href="/performance-creatives/">Performance Creatives</a><a class="svc-pill" href="/web-development/">Web Development</a><a class="svc-pill" href="/landing-pages/">Landing Pages</a><a class="svc-pill" href="/cro/">Conversion Rate Optimization</a><a class="svc-pill" href="/ab-testing/">A/B Testing</a><a class="svc-pill" href="/zoho-crm/">Zoho CRM</a><a class="svc-pill" href="/marketing-automation/">Marketing Automation</a><a class="svc-pill" href="/analytics-attribution/">Analytics & Attribution</a><a class="svc-pill" href="/sales-enablement/">Sales Enablement</a></div></div></div>
<main id="main-content">
