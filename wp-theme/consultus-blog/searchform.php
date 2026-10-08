<form class="bl-search" role="search" method="get" action="<?php echo esc_url( home_url( '/' ) ); ?>">
	<label class="screen-reader-text" for="bl-s">Search</label>
	<input id="bl-s" type="search" name="s" placeholder="Search the blog" value="<?php echo esc_attr( get_search_query() ); ?>">
	<button class="btn primary cta-yellow-hover" type="submit">Search</button>
</form>
