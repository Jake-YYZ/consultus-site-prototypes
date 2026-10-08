<?php
/** Search results. */
get_header(); ?>
<section class="sec bl-hero">
	<div class="eyebrow"><span class="eyebrow-dot"></span><span>Search</span></div>
	<h1 class="bl-hero-title">Results for <span class="sem"><?php echo esc_html( get_search_query() ); ?></span></h1>
	<?php get_search_form(); ?>
</section>
<section class="sec bl-grid-sec">
	<?php if ( have_posts() ) : ?>
		<div class="bl-grid"><?php while ( have_posts() ) : the_post(); get_template_part( 'template-parts/card' ); endwhile; ?></div>
		<?php get_template_part( 'template-parts/pagination' ); ?>
	<?php else : ?><p>No posts matched that search.</p><?php endif; ?>
</section>
<?php get_footer();
