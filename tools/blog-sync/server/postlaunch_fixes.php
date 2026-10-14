<?php
// Post-launch blog fixes (Oct 14 2026, Ectesso's "Post Launch Checkings"), meant for the LIVE site's WordPress.
// Edits post bodies in the database (never dates or revisions) and sets 10 category titles and descriptions.
// usage: wp eval-file postlaunch_fixes.php            (dry run: prints what would change, writes nothing)
//        wp eval-file postlaunch_fixes.php apply
// After "apply": wp rankmath sitemap generate ; wp kinsta cache purge --all ; wp cache flush
//
// 1. Image paths. Some posts write their pictures as src="/blog/wp-content/uploads/..." (root-relative). The browser is fine
//    with that, but Rank Math puts the site address in front of it when it builds the image sitemap, so the sitemap listed
//    https://consultusdigital.com/blog/blog/wp-content/... (a 404, 45 of them in 17 posts). They become absolute addresses.
// 2. Outside links that now redirect: twitter.com to x.com (4 links), a Google Workspace Marketplace page, a PubMed Central
//    article and an Ahrefs article, each pointed at the address the publisher redirects to. Two links are NOT changed here:
//    the HubSpot benchmark link (its new page no longer contains the figure the sentence quotes) and the Starbucks tweet in
//    real-time-marketing-social-media-2019: that one is a bare URL that WordPress turns into an embed, and WordPress 7.1.3
//    only recognises twitter.com addresses, so an x.com address would stop being embedded. The theme rewrites the link inside
//    the embed instead (embed_oembed_html filter in functions.php).
// 3. Dead CDAP links (https://growth.consultusdigital.com/cdap/ answers 404): the link is removed, its text stays.
// 4. Category meta: Rank Math title and description for the 10 categories, as listed in the agency's sheet.
global $wpdb;
$apply = isset( $args ) && in_array( 'apply', $args, true );

$abs = untrailingslashit( home_url() );   // https://consultusdigital.com/blog

$ops = array(
	'image path'      => array( '#(?<=["\'(,\s])/blog/wp-content/#', $abs . '/wp-content/' ),
	'twitter status 1' => array( '#https://twitter\.com/random_walker/status/960536723095719937#', 'https://x.com/random_walker/status/960536723095719937' ),
	'twitter home'    => array( '#href=(["\'])https://twitter\.com/\1#', 'href=$1https://x.com/$1' ),
	'twitter status 3' => array( '#https://twitter\.com/GameOfThrones/status/1125502368056053762#', 'https://x.com/GameOfThrones/status/1125502368056053762' ),
	'workspace app'   => array( '#https://workspace\.google\.com/marketplace/app/sign_pdf_with_jotform_sign/51218518078#', 'https://workspace.google.com/marketplace/app/sign_pdf/51218518078' ),
	'pmc article'     => array( '#https://www\.ncbi\.nlm\.nih\.gov/pmc/articles/PMC4445577/#', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4445577/' ),
	'ahrefs eeat'     => array( '#https://ahrefs\.com/blog/eat-seo/#', 'https://ahrefs.com/blog/eeat-seo/' ),
	'cdap link'       => array( '#<a\s[^>]*href=(["\'])https://growth\.consultusdigital\.com/cdap/?\1[^>]*>(.*?)</a>#is', '$2' ),
);

$cats = array(
	'digital-transformation'       => array( 'Digital Transformation Insights | Consultus Digital', 'Discover how digital transformation can streamline operations, improve efficiency, and drive business growth with Consultus Digital. Explore insights today!' ),
	'strategy'                     => array( 'Marketing Strategy Tips | Consultus Digital', 'Unlock smarter marketing strategies to reach your target audience, boost engagement, and grow your business with Consultus Digital. Explore tips today!' ),
	'social-media'                 => array( 'Social Media Marketing Tips | Consultus Digital', 'Discover social media marketing tips to boost engagement, expand your reach, and build your brand with Consultus Digital. Explore strategies today!' ),
	'facebook-ads'                 => array( 'Facebook Ads Strategies | Consultus Digital', 'Maximize Facebook ad performance, reach the right audience, and increase conversions with Consultus Digital. Discover expert strategies and tips today!' ),
	'cdap'                         => array( 'CDAP Digital Adoption Insights | Consultus Digital', 'Explore CDAP insights and digital adoption strategies to modernize operations and drive business growth with Consultus Digital. Learn more today!' ),
	'conversion-rate-optimization' => array( 'Conversion Rate Optimization | Consultus Digital', 'Turn more visitors into customers with conversion rate optimization tips from Consultus Digital. Improve user experience and boost conversions today!' ),
	'growth-marketing'             => array( 'Growth Marketing Strategies | Consultus Digital', 'Accelerate business growth with proven marketing strategies that attract leads and improve retention. Explore expert insights from Consultus Digital!' ),
	'sales'                        => array( 'Sales Growth Strategies | Consultus Digital', 'Discover sales growth strategies to attract qualified leads, improve conversions, and increase revenue with Consultus Digital. Explore expert tips today!' ),
	'google-ads'                   => array( 'Google Ads Tips and Strategies | Consultus Digital', 'Improve Google Ads performance, reach high-intent customers, and maximize ROI with Consultus Digital. Discover winning strategies and expert tips today!' ),
	'seo'                          => array( 'SEO Tips and Strategies | Consultus Digital', 'Boost search visibility, attract quality traffic, and improve rankings with SEO tips from Consultus Digital. Explore expert strategies to grow today!' ),
);

echo ( $apply ? 'APPLY' : 'DRY RUN' ) . " on " . home_url() . "\n";

// ---- posts
$posts = $wpdb->get_results( "SELECT ID, post_name, post_status, post_content FROM {$wpdb->posts} WHERE post_status IN ('publish','draft','private','future','pending') AND post_type IN ('post','page')" );
$totals = array(); $changed_posts = 0; $report = array();
foreach ( $posts as $p ) {
	$content = $p->post_content;
	$counts  = array();
	foreach ( $ops as $name => $op ) {
		$n = 0;
		$content = preg_replace( $op[0], $op[1], $content, -1, $n );
		if ( $n ) { $counts[ $name ] = $n; $totals[ $name ] = ( isset( $totals[ $name ] ) ? $totals[ $name ] : 0 ) + $n; }
	}
	if ( $counts && $content !== $p->post_content ) {
		$changed_posts++;
		$report[] = sprintf( '  %-6d %-9s %-70s %s', $p->ID, $p->post_status, substr( $p->post_name, 0, 70 ), json_encode( $counts ) );
		if ( $apply ) {
			$wpdb->update( $wpdb->posts, array( 'post_content' => $content ), array( 'ID' => $p->ID ) );
			clean_post_cache( $p->ID );
		}
	}
}
echo "\nPosts: {$changed_posts} of " . count( $posts ) . " would change\n";
foreach ( $report as $line ) { echo $line . "\n"; }
echo "\nTotals by operation:\n";
foreach ( $ops as $name => $op ) { printf( "  %-18s %d\n", $name, isset( $totals[ $name ] ) ? $totals[ $name ] : 0 ); }

// what is still left that this script does not touch (for the report)
$left = array( 'twitter.com' => 0, 'blog/wp-content root-relative' => 0, 'growth.consultusdigital.com' => 0, 'backlinko.com' => 0 );
foreach ( $posts as $p ) {
	$c = $p->post_content;
	if ( false !== strpos( $c, 'twitter.com' ) ) { $left['twitter.com']++; }
	if ( preg_match( '#(?<=["\'(,\s])/blog/wp-content/#', $c ) ) { $left['blog/wp-content root-relative']++; }
	if ( false !== strpos( $c, 'growth.consultusdigital.com' ) ) { $left['growth.consultusdigital.com']++; }
	if ( false !== strpos( $c, 'backlinko.com' ) ) { $left['backlinko.com']++; }
}
echo "\nPosts that mention (before this run's changes; apply run: after them it should read 0, except as noted):\n";
foreach ( $left as $k => $v ) { echo "  {$v}  {$k}\n"; }

// ---- category meta
echo "\nCategories:\n";
foreach ( $cats as $slug => $m ) {
	$t = get_term_by( 'slug', $slug, 'category' );
	if ( ! $t ) { echo "  MISSING category {$slug}\n"; continue; }
	$old_t = get_term_meta( $t->term_id, 'rank_math_title', true );
	$old_d = get_term_meta( $t->term_id, 'rank_math_description', true );
	$same  = ( $old_t === $m[0] && $old_d === $m[1] );
	echo sprintf( "  %-30s id %-4d %s (title %d chars, description %d chars)\n", $slug, $t->term_id, $same ? 'already set' : ( $apply ? 'SET' : 'would set' ), strlen( $m[0] ), strlen( $m[1] ) );
	if ( $apply && ! $same ) {
		update_term_meta( $t->term_id, 'rank_math_title', $m[0] );
		update_term_meta( $t->term_id, 'rank_math_description', $m[1] );
	}
}
echo "\n" . ( $apply ? 'Done. Now run: wp rankmath sitemap generate ; wp kinsta cache purge --all ; wp cache flush' : 'Dry run only. Nothing was written.' ) . "\n";
