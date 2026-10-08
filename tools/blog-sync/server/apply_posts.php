<?php
/**
 * Align staging posts with the live blog.
 *   - author profiles (name, title, bio) to the live values
 *   - every post: featured image, permalink (Permalink Manager URI), author
 *   - posts missing on staging: created (same ID, slug, date, terms, SEO title/description)
 *   - posts listed in plan.replace: article body replaced with the clean live body
 *
 * Usage: wp --user=2 eval-file apply_posts.php PLAN.json MEDIA_MAP.json          (dry run)
 *        wp --user=2 eval-file apply_posts.php PLAN.json MEDIA_MAP.json apply
 * (--user is needed so WordPress does not strip iframes/styles from post bodies.)
 */
global $wpdb;
$plan  = json_decode( file_get_contents( $args[0] ), true );
$map   = json_decode( file_get_contents( $args[1] ), true );
$apply = isset( $args[2] ) && 'apply' === $args[2];
$replace  = array_flip( $plan['replace'] );
$seo_sync = array_flip( isset( $plan['seo_sync'] ) ? $plan['seo_sync'] : array() );
$say   = function ( $m ) { WP_CLI::log( $m ); };

// Live author -> staging user. "Shannon Stoneburgh" is staging's user 6 (shown as "Isaac Fergurson"):
// the staging bio is word-for-word Shannon's live bio apart from the name, pronoun and job title.
$explicit = array( 'Shannon Stoneburgh' => 6 );
$user_for = array();
$users    = get_users();
foreach ( $plan['authors'] as $name => $a ) {
	$uid = isset( $explicit[ $name ] ) ? $explicit[ $name ] : 0;
	if ( ! $uid ) {
		foreach ( $users as $u ) {
			if ( $u->display_name === $name ) { $uid = $u->ID; }
		}
	}
	if ( ! $uid ) { $say( "!! no staging user for author $name" ); continue; }
	$user_for[ $name ] = $uid;
	$u    = get_userdata( $uid );
	$want = array( 'display_name' => $name, 'nickname' => $name, 'description' => $a['bio'] );
	if ( 'Shannon Stoneburgh' === $name ) { $want['user_nicename'] = 'shannon-stoneburgh'; }
	$changes = array();
	$norm    = function ( $s ) { return str_replace( array( "\u{2019}", "\u{2018}" ), "'", (string) $s ); }; // curly vs straight quotes are not a difference
	foreach ( $want as $k => $v ) {
		$cur = in_array( $k, array( 'nickname', 'description' ), true ) ? get_user_meta( $uid, $k, true ) : $u->$k;
		if ( $norm( $cur ) !== $norm( $v ) ) { $changes[ $k ] = $v; }
	}
	if ( $norm( get_user_meta( $uid, 'job_title', true ) ) !== $norm( $a['title'] ) ) { $changes['job_title'] = $a['title']; }
	if ( $changes ) {
		$say( "author $name (user $uid): update " . implode( ', ', array_keys( $changes ) ) );
		if ( $apply ) {
			$core = array_diff_key( $changes, array( 'job_title' => 1, 'nickname' => 1, 'description' => 1 ) );
			$core['ID'] = $uid;
			foreach ( array( 'nickname', 'description' ) as $k ) { if ( isset( $changes[ $k ] ) ) { $core[ $k ] = $changes[ $k ]; } }
			wp_update_user( $core );
			if ( isset( $changes['job_title'] ) ) { update_user_meta( $uid, 'job_title', $changes['job_title'] ); }
		}
	}
}

$uris  = get_option( 'permalink-manager-uris', array() );
$stat  = array( 'thumb' => 0, 'uri' => 0, 'author' => 0, 'replaced' => 0, 'created' => 0, 'conflict' => 0, 'no_thumb' => 0 );
$new_ids = array();

foreach ( $plan['posts'] as $p ) {
	$id    = (int) $p['id'];
	$thumb = ( $p['featured_live_id'] && isset( $map[ $p['featured_live_id'] ] ) ) ? (int) $map[ $p['featured_live_id'] ] : 0;
	if ( ! $thumb ) { $stat['no_thumb']++; }
	$uid   = isset( $user_for[ $p['author'] ] ) ? $user_for[ $p['author'] ] : 0;
	$post  = get_post( $id );

	if ( $post && 'post' !== $post->post_type ) { $stat['conflict']++; $say( "!! ID $id is a {$post->post_type}" ); continue; }

	if ( ! $post ) {
		$stat['created']++;
		$new_ids[] = $id;
		$say( "create $id {$p['uri']} | author {$p['author']}" );
		if ( ! $apply ) { continue; }
		$res = wp_insert_post( array(
			'import_id' => $id, 'post_type' => 'post', 'post_status' => 'publish',
			'post_title' => $p['title'], 'post_name' => $p['slug'], 'post_content' => $p['body'],
			'post_date' => $p['date'], 'post_date_gmt' => $p['date_gmt'], 'post_author' => $uid ? $uid : 1,
			'comment_status' => 'closed', 'ping_status' => 'closed',
		), true );
		if ( is_wp_error( $res ) ) { $say( "!! insert failed $id: " . $res->get_error_message() ); continue; }
		$post = get_post( $res );
		$wpdb->update( $wpdb->posts, array( 'post_modified' => $p['modified'], 'post_modified_gmt' => get_gmt_from_date( $p['modified'] ) ), array( 'ID' => $post->ID ) );
		$cat_ids = array();
		foreach ( $p['categories'] as $c ) {
			$t = get_term_by( 'slug', $c['slug'], 'category' );
			if ( ! $t ) {
				$parent = 0;
				if ( $c['parent'] ) { $pt = get_term_by( 'slug', $c['parent'], 'category' ); $parent = $pt ? $pt->term_id : 0; }
				$ins = wp_insert_term( $c['name'], 'category', array( 'slug' => $c['slug'], 'parent' => $parent ) );
				$cat_ids[] = is_wp_error( $ins ) ? 0 : (int) $ins['term_id'];
			} else { $cat_ids[] = (int) $t->term_id; }
		}
		if ( $cat_ids ) { wp_set_post_terms( $post->ID, array_filter( $cat_ids ), 'category' ); }
		$tag_names = array();
		foreach ( $p['tags'] as $t ) {
			$ex = get_term_by( 'slug', $t['slug'], 'post_tag' );
			if ( ! $ex ) { wp_insert_term( $t['name'], 'post_tag', array( 'slug' => $t['slug'] ) ); $ex = get_term_by( 'slug', $t['slug'], 'post_tag' ); }
			if ( $ex ) { $tag_names[] = (int) $ex->term_id; }
		}
		if ( $tag_names ) { wp_set_post_terms( $post->ID, $tag_names, 'post_tag' ); }
		if ( ! empty( $p['seo']['title'] ) ) { update_post_meta( $post->ID, 'rank_math_title', $p['seo']['title'] ); }
		if ( ! empty( $p['seo']['description'] ) ) { update_post_meta( $post->ID, 'rank_math_description', $p['seo']['description'] ); }
		$post = get_post( $post->ID );
	}

	if ( $thumb && (int) get_post_meta( $id, '_thumbnail_id', true ) !== $thumb ) {
		$stat['thumb']++;
		if ( $apply ) { update_post_meta( $id, '_thumbnail_id', $thumb ); }
	}
	if ( ( isset( $uris[ $id ] ) ? $uris[ $id ] : null ) !== $p['uri'] ) {
		$stat['uri']++;
		$uris[ $id ] = $p['uri'];
	}
	if ( $uid && $post && (int) $post->post_author !== $uid ) {
		$stat['author']++;
		if ( $apply ) { $wpdb->update( $wpdb->posts, array( 'post_author' => $uid ), array( 'ID' => $id ) ); clean_post_cache( $id ); }
	}
	if ( isset( $seo_sync[ $id ] ) ) {
		$stat['seo'] = isset( $stat['seo'] ) ? $stat['seo'] + 1 : 1;
		if ( $apply ) {
			if ( ! empty( $p['seo']['title'] ) ) { update_post_meta( $id, 'rank_math_title', $p['seo']['title'] ); }
			if ( ! empty( $p['seo']['description'] ) ) { update_post_meta( $id, 'rank_math_description', $p['seo']['description'] ); }
		}
	}
	if ( isset( $replace[ $id ] ) ) {
		$stat['replaced']++;
		if ( $apply ) {
			$wpdb->update( $wpdb->posts, array( 'post_content' => $p['body'], 'post_modified' => $p['modified'], 'post_modified_gmt' => get_gmt_from_date( $p['modified'] ) ), array( 'ID' => $id ) );
			clean_post_cache( $id );
		}
	}
}
if ( $apply ) { update_option( 'permalink-manager-uris', $uris ); }
$say( json_encode( $stat ) . ( $apply ? ' APPLIED' : ' dry run' ) );
if ( $new_ids ) { $say( 'new posts: ' . implode( ',', $new_ids ) ); }
