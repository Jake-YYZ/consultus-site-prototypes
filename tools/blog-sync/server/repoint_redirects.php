<?php
// One-off (Oct 12 2026, agency QA): inside post bodies, point internal links at the final page instead of an old URL that
// only redirects, and take out the links to pages that do not exist (the anchor text stays).
// usage: wp --user=2 eval-file repoint_redirects.php            (dry run)
//        wp --user=2 eval-file repoint_redirects.php apply
// Needs repoint_map.json beside it: python3 tools/blog-sync/build_repoint_map.py
global $wpdb;
$apply = isset( $args ) && in_array( 'apply', $args, true );
$map   = json_decode( (string) file_get_contents( dirname( __FILE__ ) . '/repoint_map.json' ), true );
if ( ! is_array( $map ) || ! $map ) {
	echo "repoint_map.json is missing or empty\n";
	return;
}
$hosts = array( 'stg-consultusdigital-staging.kinsta.cloud', 'consultusdigital.com', 'www.consultusdigital.com' );
// Pages that do not exist: lowercase, no trailing slash. Internal ones are matched by path, external ones by host + path.
$unlink_internal = array( '/blog/offline-conversion-tracking-clinics' );   // scheduled on the live site, not published anywhere yet
$unlink_external = array( 'www.seosmarty.com/image-seo.htm', 'www.convertcart.com/blog/why-is-my-conversion-rate-dropping' );   // both answer 404

$posts = $wpdb->get_results( "SELECT ID, post_content FROM {$wpdb->posts} WHERE post_status IN ('publish','draft','private') AND post_type IN ('post','page') AND post_content LIKE '%href=%'" );
$re    = '#<a\b([^>]*?)\bhref=(["\'])([^"\']*)\2([^>]*)>(.*?)</a>#is';
$per = array(); $unlinked = array(); $changed_posts = 0; $changed_links = 0; $removed = 0;
foreach ( $posts as $p ) {
	$n_here = 0;
	$new = preg_replace_callback(
		$re,
		function ( $m ) use ( $map, $hosts, $unlink_internal, $unlink_external, &$per, &$unlinked, &$n_here, &$removed ) {
			$u = $m[3];
			if ( ! preg_match( '#^([^?\#]*)(.*)$#s', $u, $parts ) ) {
				return $m[0];
			}
			$u0 = $parts[1]; $suffix = $parts[2];
			$host = ''; $path = ''; $prefix = '';
			if ( preg_match( '#^https?://([^/]+)(/.*)?$#i', $u0, $h ) ) {
				$host   = strtolower( $h[1] );
				$path   = isset( $h[2] ) ? $h[2] : '';
				$prefix = substr( $u0, 0, strlen( $u0 ) - strlen( $path ) );
			} elseif ( 0 === strpos( $u0, '/' ) && 0 !== strpos( $u0, '//' ) ) {
				$path = $u0;
			} else {
				return $m[0];
			}
			$norm = strtolower( rtrim( preg_replace( '#/{2,}#', '/', $path ), '/' ) );
			$internal = ( '' === $host || in_array( $host, $hosts, true ) );
			if ( ( $internal && in_array( $norm, $unlink_internal, true ) ) || ( ! $internal && in_array( $host . $norm, $unlink_external, true ) ) ) {
				$removed++; $key = $internal ? $norm : $host . $norm; $unlinked[ $key ] = ( isset( $unlinked[ $key ] ) ? $unlinked[ $key ] : 0 ) + 1;
				return $m[5];
			}
			if ( $internal && '' !== $norm && isset( $map[ $norm ] ) ) {
				$per[ $norm ] = ( isset( $per[ $norm ] ) ? $per[ $norm ] : 0 ) + 1;
				$n_here++;
				return '<a' . $m[1] . 'href=' . $m[2] . $prefix . $map[ $norm ] . $suffix . $m[2] . $m[4] . '>' . $m[5] . '</a>';
			}
			return $m[0];
		},
		$p->post_content
	);
	if ( null === $new || '' === $new ) {   // the regex failed on this post (preg_* returns NULL): never write that back
		echo "SKIPPED post {$p->ID}: regex error " . preg_last_error() . "\n";
		continue;
	}
	if ( $new !== $p->post_content ) {
		$changed_posts++; $changed_links += $n_here;
		if ( $apply ) {
			$wpdb->update( $wpdb->posts, array( 'post_content' => $new ), array( 'ID' => $p->ID ) );
			clean_post_cache( $p->ID );
		}
	}
}
echo ( $apply ? 'APPLIED' : 'DRY RUN' ) . ": {$changed_links} links repointed, {$removed} links removed, in {$changed_posts} posts\n";
arsort( $per ); foreach ( $per as $s => $c ) { echo "  $c  $s -> {$map[$s]}\n"; }
foreach ( $unlinked as $s => $c ) { echo "  removed $c  $s\n"; }
