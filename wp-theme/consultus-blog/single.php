<?php
/** A blog post. */
get_header();
while ( have_posts() ) : the_post();
	$cat    = cb_category_label();
	$author = get_the_author_meta( 'ID' );
	$job    = get_user_meta( $author, 'job_title', true );
	$bio    = get_the_author_meta( 'description' );
	?>
<article class="bl-article">
	<div class="eyebrow"><span class="eyebrow-dot"></span><span><?php echo esc_html( strtoupper( ( $cat ? $cat . ' · ' : '' ) . cb_reading_time() ) ); ?></span></div>
	<h1 class="bl-title"><?php the_title(); ?></h1>
	<div class="bl-meta"><?php echo esc_html( get_the_date( 'F j, Y' ) ); ?> · <?php echo esc_html( get_the_author() ); ?></div>
	<?php if ( has_post_thumbnail() && get_the_post_thumbnail() ) : ?>
		<figure class="bl-hero-img"><?php the_post_thumbnail( 'large' ); ?></figure>
	<?php endif; ?>
	<div class="bl-content"><?php the_content(); ?></div>

	<div class="bl-author">
		<div class="bl-author-img"><?php echo get_avatar( $author, 72 ); ?></div>
		<div>
			<div class="bl-author-name"><?php the_author(); ?></div>
			<?php if ( $job ) : ?><div class="bl-author-job"><?php echo esc_html( $job ); ?></div><?php endif; ?>
			<?php if ( $bio ) : ?><p class="bl-author-bio"><?php echo esc_html( $bio ); ?></p><?php endif; ?>
		</div>
	</div>
</article>
<?php endwhile;

$related = new WP_Query( array(
	'post_type'           => 'post',
	'posts_per_page'      => 3,
	'post__not_in'        => array( get_the_ID() ),
	'category__in'        => wp_get_post_categories( get_the_ID() ),
	'ignore_sticky_posts' => true,
	'no_found_rows'       => true,
) );
if ( ! $related->have_posts() ) {
	$related = new WP_Query( array( 'post_type' => 'post', 'posts_per_page' => 3, 'post__not_in' => array( get_the_ID() ), 'no_found_rows' => true ) );
}
if ( $related->have_posts() ) : ?>
<section class="sec bl-related">
	<div class="section-lbl">Keep reading</div>
	<div class="bl-grid">
		<?php while ( $related->have_posts() ) : $related->the_post(); get_template_part( 'template-parts/card' ); endwhile; wp_reset_postdata(); ?>
	</div>
</section>
<?php endif; ?>

<section class="cta-sec">
	<div class="cta-inner">
		<div class="eyebrow dark" style="margin-bottom:32px"><span class="eyebrow-dot"></span><span>Ready?</span></div>
		<h2 class="cta-title">Let's talk about your <span class="sem">numbers</span>.</h2>
		<a class="btn primary on-dark cta-yellow-hover" href="/contact/">Book a Call →</a>
	</div>
</section>
<?php get_footer();
