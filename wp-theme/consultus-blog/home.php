<?php
/** Blog hub (/blog/): newest post as a feature, then a grid. */
get_header();
$feat_id = ( get_query_var( 'paged' ) < 2 ) ? cb_featured_post_id() : 0;
// Filter pills: the 10 topics with the most posts (there are ~40 categories, too many for one row). Catch-alls are left out,
// the same two cb_category_label() skips. Every category still has its own page at /blog/category/<slug>/.
$skip    = array_filter( array( (int) get_option( 'default_category' ), (int) ( ( $gen = get_category_by_slug( 'general-category' ) ) ? $gen->term_id : 0 ) ) );
$cats    = get_terms( array( 'taxonomy' => 'category', 'hide_empty' => true, 'exclude' => $skip, 'orderby' => 'count', 'order' => 'DESC', 'number' => 10 ) );
?>
<section class="sec bl-hero">
	<div class="eyebrow"><span class="eyebrow-dot"></span><span>Insights &amp; Playbooks</span></div>
	<h1 class="bl-hero-title">Field notes from building <span class="sem">growth systems</span>.</h1>
	<?php if ( ! is_wp_error( $cats ) && count( $cats ) > 1 ) : ?>
		<div class="bl-cats">
			<a class="bl-cat is-active" href="<?php echo esc_url( home_url( '/' ) ); ?>">All</a>
			<?php foreach ( $cats as $c ) : ?>
				<a class="bl-cat" href="<?php echo esc_url( get_category_link( $c ) ); ?>"><?php echo esc_html( $c->name ); ?></a>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>
</section>

<?php if ( $feat_id ) : $feat = get_post( $feat_id ); setup_postdata( $feat ); ?>
<section class="sec bl-feature-sec">
	<a class="bl-feature" href="<?php echo esc_url( get_permalink( $feat ) ); ?>">
		<?php $fimg = cb_card_image( $feat_id, 'large' ); ?>
		<div class="bl-feature-img<?php echo $fimg ? '' : ' is-empty'; ?>"><?php echo $fimg; // phpcs:ignore ?></div>
		<div class="bl-feature-body">
			<div class="bl-card-cat"><?php echo esc_html( cb_category_label( $feat ) ? cb_category_label( $feat ) : 'Latest' ); ?></div>
			<h2 class="bl-feature-title"><?php echo esc_html( get_the_title( $feat ) ); ?></h2>
			<p class="bl-feature-excerpt"><?php echo esc_html( wp_trim_words( get_the_excerpt( $feat ), 32 ) ); ?></p>
			<div class="bl-card-meta"><?php echo esc_html( cb_reading_time( $feat_id ) . ' · ' . get_the_date( 'F j, Y', $feat ) ); ?></div>
		</div>
	</a>
</section>
<?php wp_reset_postdata(); endif; ?>

<section class="sec bl-grid-sec">
	<?php if ( have_posts() ) : ?>
		<div class="bl-grid">
			<?php while ( have_posts() ) : the_post(); get_template_part( 'template-parts/card' ); endwhile; ?>
		</div>
		<?php get_template_part( 'template-parts/pagination' ); ?>
	<?php else : ?>
		<p>No posts yet.</p>
	<?php endif; ?>
</section>
<?php get_footer();
