<?php
/**
 * Consultus Blog theme setup.
 */

add_action( 'after_setup_theme', function () {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'responsive-embeds' );
	add_image_size( 'cb-card', 800, 450, true );
} );

add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style( 'consultus-blog', get_template_directory_uri() . '/blog.css', array(), filemtime( get_template_directory() . '/blog.css' ) );
	// The static site's stylesheets are linked in header.php; skip WordPress's own front-end extras.
	wp_dequeue_style( 'global-styles' );
	wp_dequeue_style( 'classic-theme-styles' );
}, 20 );

// Comments are off site-wide.
add_filter( 'comments_open', '__return_false', 20 );
add_filter( 'pings_open', '__return_false', 20 );
add_filter( 'comments_array', '__return_empty_array', 20 );

// Archive headings read "Facebook Ads", not "Category: Facebook Ads" (the eyebrow above the heading already says Category).
add_filter( 'get_the_archive_title_prefix', '__return_empty_string' );

// Share image. Rank Math only falls back to a media-library attachment, so the hub, category pages and posts without a
// featured image had no og:image. Give them the same file every static page uses (the site root's /assets/brand/og-share.jpg).
function cb_default_share_image() {
	return 'https://' . wp_parse_url( home_url(), PHP_URL_HOST ) . '/assets/brand/og-share.jpg';
}
foreach ( array( 'facebook', 'twitter' ) as $cb_network ) {
	add_filter( "rank_math/opengraph/{$cb_network}/image", function ( $url ) {
		return $url ? $url : cb_default_share_image();
	} );
	add_filter( "rank_math/opengraph/{$cb_network}/image_array", function ( $image ) {
		if ( is_array( $image ) && isset( $image['url'] ) && cb_default_share_image() === $image['url'] ) {
			$image += array( 'width' => 1200, 'height' => 630, 'type' => 'image/jpeg', 'alt' => 'Consultus Digital' );
		}
		return $image;
	} );
}

// Don't reveal login names. The old site answered 404 to /?author=1 and 401 to the REST user list; without this,
// /?author=1 redirects to /author/<login>/ and /wp-json/wp/v2/users prints every account, the administrator included.
add_action( 'template_redirect', function () {
	if ( isset( $_GET['author'] ) && ! is_admin() ) { // phpcs:ignore WordPress.Security.NonceVerification
		global $wp_query;
		$wp_query->set_404();
		status_header( 404 );
		nocache_headers();
		include get_404_template();
		exit;
	}
}, 1 );
add_filter( 'rest_endpoints', function ( $endpoints ) {
	if ( ! is_user_logged_in() ) {
		foreach ( array_keys( $endpoints ) as $route ) {
			if ( 0 === strpos( $route, '/wp/v2/users' ) ) {
				unset( $endpoints[ $route ] );
			}
		}
	}
	return $endpoints;
} );

// Cleaner head.
remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
remove_action( 'wp_print_styles', 'print_emoji_styles' );

// Listing pages: 9 cards per page (3 x 3 grid). The hub also pins the latest post as a feature, which is excluded from the grid.
function cb_featured_post_id() {
	static $id = null;
	if ( null === $id ) {
		$p  = get_posts( array( 'numberposts' => 1, 'post_status' => 'publish', 'fields' => 'ids', 'ignore_sticky_posts' => true ) );
		$id = $p ? (int) $p[0] : 0;
	}
	return $id;
}

add_action( 'pre_get_posts', function ( $q ) {
	if ( is_admin() || ! $q->is_main_query() ) {
		return;
	}
	if ( $q->is_home() || $q->is_archive() || $q->is_search() ) {
		$q->set( 'posts_per_page', 9 );
		$q->set( 'ignore_sticky_posts', true );
	}
	if ( $q->is_home() && $q->get( 'paged' ) < 2 ) {
		// Feature the newest post on the first page only.
		$q->set( 'post__not_in', array( cb_featured_post_id() ) );
	}
} );

// Helpers.
function cb_reading_time( $post_id = null ) {
	$words = str_word_count( wp_strip_all_tags( get_post_field( 'post_content', $post_id ) ) );
	return max( 1, (int) ceil( $words / 220 ) ) . ' min read';
}

function cb_category_label( $post_id = null ) {
	$skip = array( 'uncategorized', 'general-category' );
	foreach ( (array) get_the_category( $post_id ) as $c ) {
		if ( ! in_array( $c->slug, $skip, true ) ) {
			return $c->name;
		}
	}
	return '';
}

/**
 * Card / feature image. Many imported posts point at a featured-image record that no longer exists,
 * so fall back to the first uploaded image inside the post body.
 */
define( 'CB_IMG_FALLBACK', "this.parentNode.classList.add('is-empty');this.remove()" );

function cb_card_image( $post_id = null, $size = 'cb-card' ) {
	$post_id = $post_id ? $post_id : get_the_ID();
	if ( has_post_thumbnail( $post_id ) ) {
		$html = get_the_post_thumbnail( $post_id, $size, array( 'loading' => 'lazy', 'onerror' => CB_IMG_FALLBACK ) );
		if ( $html ) {
			return $html;
		}
	}
	$content = get_post_field( 'post_content', $post_id );
	if ( preg_match( '#<img[^>]+src=["\']([^"\']*/wp-content/uploads/[^"\']+)["\']#i', $content, $m ) ) {
		return '<img src="' . esc_url( $m[1] ) . '" alt="" loading="lazy" onerror="' . CB_IMG_FALLBACK . '">';
	}
	return '';
}
