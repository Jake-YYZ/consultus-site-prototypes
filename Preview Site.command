#!/bin/zsh
# Double-click this file to preview the site locally in your browser.
# Keep the Terminal window it opens running while you browse.
# Press Ctrl+C in that window (or just close it) to stop the preview.
cd "$(dirname "$0")"
( sleep 1 && open "http://localhost:8080/" ) &
echo "Local preview running at http://localhost:8080/"
echo "Press Ctrl+C to stop."
python3 -m http.server 8080
