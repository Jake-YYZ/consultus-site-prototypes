<?php
/** A post card for the hub and archives. */
$cat = cb_category_label();
$img = cb_card_image();
?>
<a class="bl-card" href="<?php the_permalink(); ?>">
	<div class="bl-card-img<?php echo $img ? '' : ' is-empty'; ?>">
		<?php echo $img; // phpcs:ignore ?>
	</div>
	<div class="bl-card-body">
		<div class="bl-card-cat"><?php echo esc_html( $cat ? $cat : 'Insights' ); ?></div>
		<h3 class="bl-card-title"><?php the_title(); ?></h3>
		<div class="bl-card-meta"><?php echo esc_html( cb_reading_time() . ' · ' . get_the_date( 'F Y' ) ); ?></div>
	</div>
</a>
