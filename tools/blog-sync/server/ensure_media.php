<?php
/**
 * Recreate missing media-library records for files that already sit in uploads/, using the SAME IDs
 * as the live site so posts' featured-image links and wp-image-NNN classes line up again.
 *
 * Usage: wp eval-file ensure_media.php PLAN.json          (dry run)
 *        wp eval-file ensure_media.php PLAN.json fast     (create records with basic metadata: quick)
 *        wp eval-file ensure_media.php PLAN.json apply    (create records and generate every image size: slow)
 *        wp eval-file ensure_media.php PLAN.json regen    (generate image sizes for records that lack them)
 * Writes media_map.json next to the plan: {liveId: stagingId} for every entry resolved.
 */
$plan_file = $args[0];
$mode      = isset( $args[1] ) ? $args[1] : 'dry';
$apply     = in_array( $mode, array( 'fast', 'apply' ), true );
$plan      = json_decode( file_get_contents( $plan_file ), true );
$up        = wp_get_upload_dir();
$base      = trailingslashit( $up['basedir'] );
require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';

// Same picture? Compare file names ignoring size suffixes (-300x200) and WordPress's -scaled / -scaled-1.
function cb_norm_name( $path ) {
	$n = strtolower( basename( (string) $path ) );
	$n = preg_replace( '/-scaled(-\d+)?(?=\.\w+$)/', '', $n );
	return preg_replace( '/-\d+x\d+(?=\.\w+$)/', '', $n );
}

$map = array();
$stats = array( 'exists' => 0, 'created' => 0, 'conflict' => 0, 'no_file' => 0 );
$no_file = array();
$conflicts = array();

if ( 'regen' === $mode ) {
	// Work from the live-ID -> staging-ID map (it includes records created under a new ID), featured images first.
	$mapfile = dirname( $plan_file ) . '/media_map.json';
	$idmap   = file_exists( $mapfile ) ? json_decode( file_get_contents( $mapfile ), true ) : array();
	$order   = array();
	foreach ( $plan as $e ) {
		if ( isset( $idmap[ $e['id'] ] ) ) { $order[ (int) $idmap[ $e['id'] ] ] = $e['featured_for'] ? 0 : 1; }
	}
	asort( $order );
	$n = 0;
	foreach ( array_keys( $order ) as $aid ) {
		$att = get_post( $aid );
		if ( ! $att || 'attachment' !== $att->post_type ) { continue; }
		$meta = wp_get_attachment_metadata( $att->ID );
		if ( ! empty( $meta['sizes'] ) ) { continue; }
		$abs = get_attached_file( $att->ID );
		if ( ! $abs || ! file_exists( $abs ) ) { continue; }
		wp_update_attachment_metadata( $att->ID, wp_generate_attachment_metadata( $att->ID, $abs ) );
		$n++;
		if ( 0 === $n % 10 ) { WP_CLI::log( "regenerated $n" ); }
	}
	WP_CLI::log( "regen done: $n" );
	return;
}

foreach ( $plan as $e ) {
	$id  = (int) $e['id'];
	$rel = $e['rel'];
	$orig = preg_replace( '/-\d+x\d+(\.\w+)$/', '$1', $rel );
	$file = file_exists( $base . $orig ) ? $orig : ( file_exists( $base . $rel ) ? $rel : null );

	$existing = get_post( $id );
	$wrong_image = false;
	if ( $existing && 'attachment' === $existing->post_type ) {
		// A featured image must really be this file; a different image sitting under the same ID is a collision.
		if ( ! empty( $e['featured_for'] ) && cb_norm_name( get_post_meta( $id, '_wp_attached_file', true ) ) !== cb_norm_name( $rel ) ) {
			$wrong_image = true;
			$stats['wrong_image'] = isset( $stats['wrong_image'] ) ? $stats['wrong_image'] + 1 : 1;
			$conflicts[] = "$id holds " . get_post_meta( $id, '_wp_attached_file', true ) . ", live has $rel";
		} else {
			$stats['exists']++;
			$map[ $id ] = $id;
			continue;
		}
	}
	if ( ! $file ) {
		$stats['no_file']++;
		$no_file[] = $id . ' ' . $rel;
		continue;
	}
	$conflict = (bool) $existing; // the ID is taken by something else (a non-attachment, or the wrong image)
	if ( $conflict && ! $wrong_image ) {
		$stats['conflict']++;
		$conflicts[] = $id . ' is a ' . $existing->post_type;
	}
	if ( ! $apply ) {
		$stats['created']++;
		continue;
	}
	$abs  = $base . $file;
	$type = wp_check_filetype( basename( $abs ), null );
	$att  = array(
		'post_mime_type' => $type['type'] ? $type['type'] : 'image/jpeg',
		'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $abs ) ),
		'post_content'   => '',
		'post_status'    => 'inherit',
	);
	if ( ! $conflict ) {
		$att['import_id'] = $id;
	}
	$new = wp_insert_attachment( $att, $abs, (int) $e['parent'], true );
	if ( is_wp_error( $new ) ) {
		WP_CLI::warning( "insert failed for $id: " . $new->get_error_message() );
		continue;
	}
	if ( 'fast' === $mode ) {
		$size = wp_getimagesize( $abs );
		wp_update_attachment_metadata( $new, array( 'width' => $size ? $size[0] : 0, 'height' => $size ? $size[1] : 0, 'file' => $file, 'sizes' => array() ) );
	} else {
		wp_update_attachment_metadata( $new, wp_generate_attachment_metadata( $new, $abs ) );
	}
	if ( ! empty( $e['alt'] ) ) {
		update_post_meta( $new, '_wp_attachment_image_alt', $e['alt'] );
	}
	$map[ $id ] = $new;
	$stats['created']++;
}
if ( $apply ) {
	file_put_contents( dirname( $plan_file ) . '/media_map.json', json_encode( $map ) );
}
WP_CLI::log( json_encode( $stats ) . ( $apply ? ' APPLIED (' . $mode . ')' : ' dry run' ) );
if ( $conflicts ) { WP_CLI::log( 'ID conflicts: ' . implode( '; ', $conflicts ) ); }
if ( $no_file ) { WP_CLI::log( 'no file on disk (' . count( $no_file ) . '): ' . implode( ' | ', array_slice( $no_file, 0, 15 ) ) ); }
