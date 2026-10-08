<?php
/**
 * Give a staging author the same profile photo the live site uses.
 * The original photo must already be in uploads/ (REL_PATH); LIVE_THUMB is live's own 150x150 crop of it,
 * copied over the generated thumbnail so the small round avatar is framed exactly as on live.
 *
 * Usage: wp eval-file set_author_avatar.php USER_ID REL_PATH LIVE_THUMB_FILE ALT
 */
list( $uid, $rel, $live_thumb, $alt ) = array_pad( $args, 4, '' );
$uid = (int) $uid;
$up  = wp_get_upload_dir();
$abs = trailingslashit( $up['basedir'] ) . $rel;
if ( ! get_userdata( $uid ) || ! file_exists( $abs ) || ! file_exists( $live_thumb ) ) {
	WP_CLI::error( 'user, photo or live thumbnail missing' );
}
require_once ABSPATH . 'wp-admin/includes/image.php';
$type = wp_check_filetype( basename( $abs ), null );
$att  = wp_insert_attachment( array(
	'post_mime_type' => $type['type'],
	'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $abs ) ),
	'post_status'    => 'inherit',
), $abs, 0, true );
if ( is_wp_error( $att ) ) { WP_CLI::error( $att->get_error_message() ); }
$meta = wp_generate_attachment_metadata( $att, $abs );
wp_update_attachment_metadata( $att, $meta );
if ( $alt ) { update_post_meta( $att, '_wp_attachment_image_alt', $alt ); }
if ( ! empty( $meta['sizes']['thumbnail']['file'] ) ) {
	copy( $live_thumb, dirname( $abs ) . '/' . $meta['sizes']['thumbnail']['file'] );
}
$old = get_user_meta( $uid, 'wp_user_avatar', true );
update_user_meta( $uid, 'wp_user_avatar', $att );
WP_CLI::log( "user $uid avatar: attachment $old -> $att (" . $rel . ')' );
