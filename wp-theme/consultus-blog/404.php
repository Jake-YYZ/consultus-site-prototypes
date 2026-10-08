<?php
/** Not found. */
get_header(); ?>
<section class="sec bl-hero">
	<div class="eyebrow"><span class="eyebrow-dot"></span><span>404</span></div>
	<h1 class="bl-hero-title">That page <span class="sem">isn't here</span>.</h1>
	<p class="bl-lede">Try a search, or head back to the latest posts.</p>
	<?php get_search_form(); ?>
	<p style="margin-top:32px"><a class="btn primary cta-yellow-hover" href="<?php echo esc_url( home_url( '/' ) ); ?>">Back to Insights</a></p>
</section>
<?php get_footer();
