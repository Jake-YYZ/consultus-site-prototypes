<?php
/** Category, tag, author and date archives. */
get_header(); ?>
<section class="sec bl-hero">
	<div class="eyebrow"><span class="eyebrow-dot"></span><span><?php echo is_category() ? 'Category' : 'Archive'; ?></span></div>
	<h1 class="bl-hero-title"><?php echo esc_html( wp_strip_all_tags( get_the_archive_title() ) ); ?></h1>
	<?php if ( get_the_archive_description() ) : ?><div class="bl-lede"><?php echo wp_kses_post( get_the_archive_description() ); ?></div><?php endif; ?>
</section>
<section class="sec bl-grid-sec">
	<?php if ( have_posts() ) : ?>
		<div class="bl-grid"><?php while ( have_posts() ) : the_post(); get_template_part( 'template-parts/card' ); endwhile; ?></div>
		<?php get_template_part( 'template-parts/pagination' ); ?>
	<?php else : ?><p>Nothing here yet.</p><?php endif; ?>
</section>
<?php get_footer();
