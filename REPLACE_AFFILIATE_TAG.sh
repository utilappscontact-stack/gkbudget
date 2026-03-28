#!/bin/bash
# Run this script once after unzipping, to replace the placeholder affiliate tag
# with your real Amazon Associates tag
#
# Usage: bash REPLACE_AFFILIATE_TAG.sh YOUR-ACTUAL-TAG
#
# Example: bash REPLACE_AFFILIATE_TAG.sh myname-21
#
if [ -z "$1" ]; then
  echo "ERROR: Please provide your Amazon Associates tag"
  echo "Usage: bash REPLACE_AFFILIATE_TAG.sh your-tag-21"
  exit 1
fi

PLACEHOLDER="gharkabudge-21"
YOUR_TAG="$1"

echo "Replacing '$PLACEHOLDER' with '$YOUR_TAG' in all HTML files..."
find . -name "*.html" -exec sed -i "s/$PLACEHOLDER/$YOUR_TAG/g" {} +
echo "Done! Found and replaced in:"
grep -rl "$YOUR_TAG" . --include="*.html" | wc -l
echo "files."
echo ""
echo "Now commit and push to GitHub to deploy."
