<?php
/** Fallback. */
get_header(); ?>
<section class="sec bl-grid-sec">
	<div class="bl-grid"><?php while ( have_posts() ) : the_post(); get_template_part( 'template-parts/card' ); endwhile; ?></div>
	<?php get_template_part( 'template-parts/pagination' ); ?>
</section>
<?php get_footer();
