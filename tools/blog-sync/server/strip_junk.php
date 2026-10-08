<?php
/**
 * Remove leftover Elementor / WPCode shortcodes (and editor residue) from post bodies.
 * They point at the old live site's shared template blocks and print as raw text on staging.
 * Other bracketed text (e.g. "[city]" used as a placeholder inside an article) is left alone.
 *
 * Usage: wp eval-file strip_junk.php          (dry run)
 *        wp eval-file strip_junk.php apply
 */
global $wpdb;
$apply = isset( $args[0] ) && 'apply' === $args[0];
$ids   = get_posts( array( 'post_type' => 'post', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids' ) );
$changed = 0;
$removed = 0;
foreach ( $ids as $id ) {
	$c = get_post_field( 'post_content', $id, 'raw' );
	$n = preg_replace( '#<p>\s*(?:\[(?:elementor-template|wpcode)\b[^\]]*\]\s*)+</p>#i', '', $c, -1, $k1 );
	$n = preg_replace( '#\[(?:elementor-template|wpcode)\b[^\]]*\]#i', '', $n, -1, $k2 );
	$n = str_replace( ' data-wp-editing="1"', '', $n );
	$n = rtrim( $n );
	if ( $n !== $c ) {
		$changed++;
		$removed += $k1 + $k2;
		if ( $apply ) {
			$wpdb->update( $wpdb->posts, array( 'post_content' => $n ), array( 'ID' => $id ) );
			clean_post_cache( $id );
		}
	}
}
WP_CLI::log( sprintf( 'posts checked: %d | posts changed: %d | shortcode runs removed: %d | %s', count( $ids ), $changed, $removed, $apply ? 'APPLIED' : 'dry run' ) );
