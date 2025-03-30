#!/bin/bash

# This script generates simple placeholder icon files for the Chrome extension
# It requires ImageMagick to be installed (https://imagemagick.org/)
# Install on macOS with: brew install imagemagick
# Install on Ubuntu/Debian with: sudo apt-get install imagemagick

# Create images directory if it doesn't exist
mkdir -p images

# Generate a 16x16 icon
convert -size 16x16 xc:#3498db -fill white -gravity center -pointsize 8 -annotate 0 "PM" images/icon16.png

# Generate a 48x48 icon
convert -size 48x48 xc:#3498db -fill white -gravity center -pointsize 20 -annotate 0 "PM" images/icon48.png

# Generate a 128x128 icon
convert -size 128x128 xc:#3498db -fill white -gravity center -pointsize 50 -annotate 0 "PM" images/icon128.png

echo "Icon files generated in the images directory:"
echo "- images/icon16.png (16x16)"
echo "- images/icon48.png (48x48)"
echo "- images/icon128.png (128x128)"
echo ""
echo "These are placeholder icons with a blue background and 'PM' text."
echo "For a production extension, you should replace these with professionally designed icons." 