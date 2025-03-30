#!/usr/bin/env python3
"""
Generate placeholder icons for the Chrome extension.
This script creates simple colored squares with text for the extension icons.
"""

import os
from PIL import Image, ImageDraw, ImageFont

# Create images directory if it doesn't exist
if not os.path.exists('images'):
    os.makedirs('images')

# Icon sizes to generate
SIZES = [16, 48, 128]

# Colors
BACKGROUND_COLOR = (52, 152, 219)  # Blue
TEXT_COLOR = (255, 255, 255)  # White

for size in SIZES:
    # Create a new image with blue background
    img = Image.new('RGB', (size, size), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Try to use a built-in font
    try:
        # Font size - scale according to image size
        font_size = max(size // 3, 8)
        
        # Try to load a system font
        font = None
        try:
            # Try common system fonts
            for font_name in ['Arial.ttf', 'Verdana.ttf', 'DejaVuSans.ttf', 'Menlo.ttf', 'Monaco.ttf']:
                try:
                    font = ImageFont.truetype(font_name, font_size)
                    break
                except IOError:
                    continue
        except:
            pass
            
        # If no system font, use default
        if font is None:
            font = ImageFont.load_default()
            
        # Draw text
        text = "PM"
        text_width, text_height = draw.textsize(text, font=font) if hasattr(draw, 'textsize') else (font_size * len(text) * 0.6, font_size)
        position = ((size - text_width) // 2, (size - text_height) // 2)
        draw.text(position, text, TEXT_COLOR, font=font)
    except Exception as e:
        # If text rendering fails, create a simple circle in the middle
        print(f"Could not add text to {size}x{size} icon: {e}")
        center = size // 2
        radius = size // 4
        draw.ellipse((center - radius, center - radius, center + radius, center + radius), fill=TEXT_COLOR)
    
    # Save the image
    file_path = f"images/icon{size}.png"
    img.save(file_path)
    print(f"Created {file_path} ({size}x{size})")

print("\nIcon files generated in the images directory.")
print("These are placeholder icons with a blue background.")
print("For a production extension, you should replace these with professionally designed icons.") 