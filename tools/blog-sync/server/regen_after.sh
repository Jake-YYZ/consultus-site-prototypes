#!/bin/sh
# Wait for any running thumbnail pass to finish, then run another (picks up newly created records).
while pgrep -f "ensure_media.php ../../private/blog-sync/media_plan.json regen" > /dev/null; do sleep 30; done
cd /www/consultusdigital_643/public/blog && wp eval-file ../../private/blog-sync/ensure_media_next.php ../../private/blog-sync/media_plan.json regen
