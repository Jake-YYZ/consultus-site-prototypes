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
remove_action( 'wp_head', 'wp_generator' );   // do not print the WordPress version in every page

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

/**
 * Old blog URLs that the current live site answers with a 301, and the 30 posts that were merged away. WordPress
 * only knows the posts that exist, so without this an old link gets a 404 instead of the page it moved to. Keys and
 * values are full paths from the site root with a trailing slash (a value may point outside /blog, at a service page).
 */
function cb_blog_redirects() {
	return array(
		'/blog/my-take-on-how-ai-will-transform-digital-marketing-in-2023/' => '/blog/how-ai-will-transform-digital-marketing-in-2025/',
		// The 30 merged posts (seo-migration/blog-consolidation-proposal.csv, approved Oct 9 2026). The posts themselves are set to draft,
		// which makes WordPress answer their old URL with a 404, and the rule below turns that into a 301.
		'/blog/ecommerce-seo-how-to-get-started/' => '/blog/10-seo-ecommerce-tips-that-actually-work/',
		'/blog/ecommerce-seo-tips-to-increase-traffic/' => '/blog/10-seo-ecommerce-tips-that-actually-work/',
		'/blog/why-every-business-should-be-a-b-testing/' => '/blog/5-a-b-testing-techniques-for-boosting-your-websites-conversion-rate/',
		'/blog/6-benefits-google-ads-management-agency/' => '/blog/5-benefits-working-with-a-google-partner-agency/',
		'/blog/why-google-ads-management-service-agency/' => '/blog/5-benefits-working-with-a-google-partner-agency/',
		'/blog/boost-your-conversion-rates-with-these-tips/' => '/blog/9-best-practices-for-conversion-rate-optimization/',
		'/blog/power-of-social-proof-with-conversion-rate-optimization/' => '/blog/9-best-practices-for-conversion-rate-optimization/',
		'/blog/how-your-business-can-grow-with-influencer-marketing/' => '/blog/benefits-of-influencer-marketing/',
		'/blog/strategies-to-boost-your-seo/' => '/blog/future-proof-seo-strategy/',
		'/blog/5-tips-facebook-ads-creation/' => '/blog/how-to-create-compelling-visuals-for-your-facebook-ads/',
		'/blog/7-tips-for-creating-effective-facebook-ads-that-convert/' => '/blog/how-to-create-compelling-visuals-for-your-facebook-ads/',
		'/blog/tiktok-ads-how-to-win-more-customers/' => '/blog/how-to-create-high-converting-tiktok-ads/',
		'/blog/google-ads-paid-search/' => '/blog/quick-guide-to-google-ads/',
		'/blog/guide-to-google-ad-campaigns-search-ads/' => '/blog/quick-guide-to-google-ads/',
		'/blog/how-to-create-a-facebook-ads-strategy-that-works-for-your-business/' => '/blog/the-dos-and-donts-of-facebook-advertising/',
		'/blog/local-seo-improve-visibility-google/' => '/blog/the-ultimate-local-seo-tactic-how-to-optimize-your-business-for-ai-voice-search/',
		'/blog/rank-business-locally-maps/' => '/blog/the-ultimate-local-seo-tactic-how-to-optimize-your-business-for-ai-voice-search/',
		'/blog/social-proof/' => '/blog/video-testimonials-benefits-for-business/',
		'/blog/improve-website-conversion-rate/' => '/blog/why-your-website-conversion-rates-suck/',
		'/blog/expert-remarketing-strategies/' => '/google-ads/',
		'/blog/remarketing-advertising-for-ecommerce/' => '/google-ads/',
		'/blog/remarketing-right-business/' => '/google-ads/',
		'/blog/work-with-facebook-advertising-agency/' => '/meta-ads/',
		'/blog/the-beginners-guide-to-microsoft-advertising-how-to-get-started/' => '/microsoft-ads/',
		'/blog/the-power-of-bing-ads-why-your-business-should-be-using-microsoft-advertising/' => '/microsoft-ads/',
		'/blog/crm-for-small-businesses-how-to-implement-and-leverage-crm-for-growth-and-success/' => '/zoho-crm/',
		'/blog/how-to-choose-the-right-crm-system-for-your-business-tips-and-best-practices/' => '/zoho-crm/',
		'/blog/the-beginners-guide-to-crm-understanding-the-basics-and-benefits-for-your-business/' => '/zoho-crm/',
		'/blog/which-crm-system-is-right-for-your-business/' => '/zoho-crm/',
		'/blog/why-your-business-needs-crm/' => '/zoho-crm/',
	);
}

/**
 * Full URL for a root path of the site: /blog/... lives in WordPress (home_url() already ends in /blog), anything
 * else is a static page on the same host.
 */
function cb_site_url( $path ) {
	if ( 0 === strpos( $path, '/blog/' ) ) {
		return home_url( substr( $path, 5 ) );
	}
	return preg_replace( '#/blog$#', '', untrailingslashit( home_url() ) ) . $path;
}

add_action(
	'template_redirect',
	function () {
		if ( ! is_404() ) {
			return;
		}
		$path = trailingslashit( strtolower( (string) strtok( isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '', '?' ) ) );
		$map  = cb_blog_redirects();
		if ( isset( $map[ $path ] ) ) {
			wp_redirect( cb_site_url( $map[ $path ] ), 301 );
			exit;
		}
	},
	1
);
