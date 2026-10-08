<?php
/** Numbered pagination. */
$links = paginate_links( array( 'type' => 'array', 'prev_text' => '&larr; Newer', 'next_text' => 'Older &rarr;', 'mid_size' => 1 ) );
if ( $links ) {
	echo '<nav class="bl-pagination" aria-label="Pages">' . implode( '', $links ) . '</nav>';
}
