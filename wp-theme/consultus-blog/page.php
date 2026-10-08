<?php
/** Generic WordPress page. */
get_header(); ?>
<article class="bl-article">
	<?php while ( have_posts() ) : the_post(); ?>
		<h1 class="bl-title"><?php the_title(); ?></h1>
		<div class="bl-content"><?php the_content(); ?></div>
	<?php endwhile; ?>
</article>
<?php get_footer();
