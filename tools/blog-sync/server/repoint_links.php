<?php
// One-off (Oct 9 2026): point internal links inside post bodies at the final pages of the 30 merged posts.
// usage: wp --user=2 eval-file repoint_links.php            (dry run)
//        wp --user=2 eval-file repoint_links.php apply
global $wpdb;
$apply = isset( $args ) && in_array( 'apply', $args, true );
$map = array(
	'5-tips-facebook-ads-creation' => '/blog/how-to-create-compelling-visuals-for-your-facebook-ads/',
	'7-tips-for-creating-effective-facebook-ads-that-convert' => '/blog/how-to-create-compelling-visuals-for-your-facebook-ads/',
	'how-to-create-a-facebook-ads-strategy-that-works-for-your-business' => '/blog/the-dos-and-donts-of-facebook-advertising/',
	'work-with-facebook-advertising-agency' => '/meta-ads/',
	'6-benefits-google-ads-management-agency' => '/blog/5-benefits-working-with-a-google-partner-agency/',
	'why-google-ads-management-service-agency' => '/blog/5-benefits-working-with-a-google-partner-agency/',
	'google-ads-paid-search' => '/blog/quick-guide-to-google-ads/',
	'guide-to-google-ad-campaigns-search-ads' => '/blog/quick-guide-to-google-ads/',
	'boost-your-conversion-rates-with-these-tips' => '/blog/9-best-practices-for-conversion-rate-optimization/',
	'improve-website-conversion-rate' => '/blog/why-your-website-conversion-rates-suck/',
	'power-of-social-proof-with-conversion-rate-optimization' => '/blog/9-best-practices-for-conversion-rate-optimization/',
	'why-every-business-should-be-a-b-testing' => '/blog/5-a-b-testing-techniques-for-boosting-your-websites-conversion-rate/',
	'social-proof' => '/blog/video-testimonials-benefits-for-business/',
	'strategies-to-boost-your-seo' => '/blog/future-proof-seo-strategy/',
	'ecommerce-seo-how-to-get-started' => '/blog/10-seo-ecommerce-tips-that-actually-work/',
	'ecommerce-seo-tips-to-increase-traffic' => '/blog/10-seo-ecommerce-tips-that-actually-work/',
	'local-seo-improve-visibility-google' => '/blog/the-ultimate-local-seo-tactic-how-to-optimize-your-business-for-ai-voice-search/',
	'rank-business-locally-maps' => '/blog/the-ultimate-local-seo-tactic-how-to-optimize-your-business-for-ai-voice-search/',
	'expert-remarketing-strategies' => '/google-ads/',
	'remarketing-advertising-for-ecommerce' => '/google-ads/',
	'remarketing-right-business' => '/google-ads/',
	'the-beginners-guide-to-microsoft-advertising-how-to-get-started' => '/microsoft-ads/',
	'the-power-of-bing-ads-why-your-business-should-be-using-microsoft-advertising' => '/microsoft-ads/',
	'crm-for-small-businesses-how-to-implement-and-leverage-crm-for-growth-and-success' => '/zoho-crm/',
	'how-to-choose-the-right-crm-system-for-your-business-tips-and-best-practices' => '/zoho-crm/',
	'the-beginners-guide-to-crm-understanding-the-basics-and-benefits-for-your-business' => '/zoho-crm/',
	'which-crm-system-is-right-for-your-business' => '/zoho-crm/',
	'why-your-business-needs-crm' => '/zoho-crm/',
	'how-your-business-can-grow-with-influencer-marketing' => '/blog/benefits-of-influencer-marketing/',
	'tiktok-ads-how-to-win-more-customers' => '/blog/how-to-create-high-converting-tiktok-ads/',
);
$home = untrailingslashit( home_url() );            // https://host/blog
$root = preg_replace( '#/blog$#', '', $home );      // https://host
$re = '#href=(["\'])(?:https?://(?:stg-consultusdigital-staging\.kinsta\.cloud|(?:www\.)?consultusdigital\.com))?/{1,2}blog/([a-z0-9-]+)/?\1#i';
$posts = $wpdb->get_results( "SELECT ID, post_content FROM {$wpdb->posts} WHERE post_status IN ('publish','draft','private') AND post_type IN ('post','page') AND post_content LIKE '%/blog/%'" );
$changed_posts = 0; $changed_links = 0; $per = array();
foreach ( $posts as $p ) {
	$n = 0;
	$new = preg_replace_callback( $re, function ( $m ) use ( $map, $home, $root, &$n, &$per ) {
		$slug = strtolower( $m[2] );
		if ( ! isset( $map[ $slug ] ) ) { return $m[0]; }
		$t   = $map[ $slug ];
		$url = ( 0 === strpos( $t, '/blog/' ) ) ? $home . substr( $t, 5 ) : $root . $t;
		$n++; $per[ $slug ] = ( isset( $per[ $slug ] ) ? $per[ $slug ] : 0 ) + 1;
		return 'href=' . $m[1] . $url . $m[1];
	}, $p->post_content );
	if ( $n && $new !== $p->post_content ) {
		$changed_posts++; $changed_links += $n;
		if ( $apply ) { $wpdb->update( $wpdb->posts, array( 'post_content' => $new ), array( 'ID' => $p->ID ) ); clean_post_cache( $p->ID ); }
	}
}
echo ( $apply ? 'APPLIED' : 'DRY RUN' ) . ": {$changed_links} links in {$changed_posts} posts\n";
ksort( $per ); foreach ( $per as $s => $c ) { echo "  $c  $s\n"; }
