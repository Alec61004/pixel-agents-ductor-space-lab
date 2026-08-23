#!/usr/bin/env python3
"""
Generate in-world tileset assets for Ductor Space Lab:
1. Dark metallic modular floor tiles
2. Sci-Fi bulkhead panel wall sets (16-bitmask)
3. Large observation window frames & cosmic purple galaxy background
   based on telegram_files/2026-08-22/photo_AQADaxFrG51tSVR-.webp

Outputs:
1. PNG tileset assets in webview-ui/public/assets/themes/ductor-space-lab/
   - floor-dark-metal.png
   - wall-panel.png
   - window-galaxy.png
2. Decoded JSON in webview-ui/src/office/sprites/ductorSpaceLabTiles.json
"""

import json
import os
from PIL import Image

def hex_to_rgba(hex_str, alpha=255):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 6:
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
        return (r, g, b, alpha)
    elif len(hex_str) == 8:
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
        a = int(hex_str[6:8], 16)
        return (r, g, b, a)
    return (0, 0, 0, 0)

def rgba_to_hex(r, g, b, a):
    if a < 2:
        return ""
    rgb = f"#{r:02X}{g:02X}{b:02X}"
    if a >= 255:
        return rgb
    return f"{rgb}{a:02X}"

# Palette definitions matching photo_AQADaxFrG51tSVR-.webp
PALETTE = {
    # Void & Galaxy
    'space_deep': '#090714',
    'space_dark': '#110D24',
    'space_mid': '#1E143B',
    'nebula_deep': '#341556',
    'nebula_mid': '#5A2086',
    'nebula_bright': '#8C32C2',
    'nebula_glow': '#C05CE8',
    'nebula_hot': '#F0A0FF',
    'star_white': '#FFFFFF',
    'star_cyan': '#B0F6FF',
    'star_gold': '#FFE8A0',
    'star_dim': '#9070B8',

    # Dark Metallic Floor
    'floor_hi': '#545D7E',
    'floor_lt': '#3C435E',
    'floor_md': '#2B3045',
    'floor_dk': '#1F2333',
    'floor_deep': '#141622',
    'floor_seam': '#0D0E16',
    'floor_rivet': '#7684B0',
    'floor_accent_cyan': '#38E0F8',

    # Sci-Fi Bulkhead Wall Panels
    'wall_top_hi': '#7A75A8',
    'wall_top_lt': '#5E588A',
    'wall_top_md': '#47426E',
    'wall_plate_hi': '#3E3860',
    'wall_plate_lt': '#2E2A4A',
    'wall_plate_md': '#221F38',
    'wall_plate_dk': '#181528',
    'wall_plate_deep': '#100E1C',
    'wall_seam': '#0A0814',
    'wall_rivet': '#6C669A',
    'wall_conduit_cyan': '#40E8FF',
    'wall_conduit_purple': '#B84AFF',

    # Window Frames & Glass
    'window_frame_hi': '#6B6888',
    'window_frame_md': '#484462',
    'window_frame_dk': '#2A273C',
    'window_frame_deep': '#161424',
    'window_glass_glare': '#FFFFFF30',
    'window_glass_tint': '#20104040',
}

def create_dark_metal_floor_tile():
    """Generates 16x16 dark metallic sci-fi floor tile."""
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    c = {k: hex_to_rgba(v) for k, v in PALETTE.items()}

    # Base panel background
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), c['floor_md'])

    # Beveled borders (top-left light, bottom-right shadow)
    for x in range(16):
        img.putpixel((x, 0), c['floor_hi'])
        img.putpixel((x, 15), c['floor_seam'])
        if 1 <= x <= 14:
            img.putpixel((x, 1), c['floor_lt'])
            img.putpixel((x, 14), c['floor_deep'])

    for y in range(16):
        img.putpixel((0, y), c['floor_hi'])
        img.putpixel((15, y), c['floor_seam'])
        if 1 <= y <= 14:
            img.putpixel((1, y), c['floor_lt'])
            img.putpixel((14, y), c['floor_deep'])

    # Inner quadrant grooves (subtle 2x2 grid texture inside 16x16)
    for i in range(2, 14):
        img.putpixel((i, 7), c['floor_dk'])
        img.putpixel((i, 8), c['floor_deep'])
        img.putpixel((7, i), c['floor_dk'])
        img.putpixel((8, i), c['floor_deep'])

    # Corner industrial bolts / rivets (subtle metallic hex pins)
    rivet_coords = [(3, 3), (12, 3), (3, 12), (12, 12)]
    for rx, ry in rivet_coords:
        img.putpixel((rx, ry), c['floor_rivet'])
        img.putpixel((rx + 1, ry), c['floor_dk'])
        img.putpixel((rx, ry + 1), c['floor_dk'])

    # Subtle brushed metallic specks
    speck_coords = [(5, 4), (10, 5), (4, 10), (11, 10)]
    for sx, sy in speck_coords:
        img.putpixel((sx, sy), c['floor_lt'])

    return img

def create_sci_fi_wall_piece(mask):
    """
    Generates a 16x32 sci-fi bulkhead panel wall sprite for bitmask 0..15.
    Bitmask: N=1, E=2, S=4, W=8
    Top 16px (y: 0..15): Wall top cap/fascia
    Bottom 16px (y: 16..31): Wall front facade
    """
    img = Image.new('RGBA', (16, 32), (0, 0, 0, 0))
    c = {k: hex_to_rgba(v) for k, v in PALETTE.items()}

    has_n = bool(mask & 1)
    has_e = bool(mask & 2)
    has_s = bool(mask & 4)
    has_w = bool(mask & 8)

    # 1. Fill top section (y: 0..15) - Bulkhead cap
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), c['wall_top_md'])

    # Top surface highlights & bevels
    for x in range(16):
        img.putpixel((x, 0), c['wall_top_hi'] if not has_n else c['wall_top_lt'])
        img.putpixel((x, 1), c['wall_top_lt'])
        img.putpixel((x, 15), c['wall_seam'])
        img.putpixel((x, 14), c['wall_top_md'])

    for y in range(16):
        if not has_w:
            img.putpixel((0, y), c['wall_top_hi'])
            img.putpixel((1, y), c['wall_top_lt'])
        if not has_e:
            img.putpixel((15, y), c['wall_seam'])
            img.putpixel((14, y), c['wall_plate_deep'])

    # Top armor plate seams
    if not has_w and not has_e:
        img.putpixel((7, 7), c['wall_seam'])
        img.putpixel((8, 7), c['wall_seam'])
        img.putpixel((7, 8), c['wall_top_hi'])
        img.putpixel((8, 8), c['wall_top_hi'])

    # 2. Fill bottom section (y: 16..31) - Front armor facade
    for y in range(16, 32):
        for x in range(16):
            img.putpixel((x, y), c['wall_plate_md'])

    # Front panel bevels
    for y in range(16, 32):
        img.putpixel((0, y), c['wall_plate_hi'] if not has_w else c['wall_plate_lt'])
        img.putpixel((1, y), c['wall_plate_lt'] if not has_w else c['wall_plate_md'])
        img.putpixel((15, y), c['wall_seam'] if not has_e else c['wall_plate_dk'])
        img.putpixel((14, y), c['wall_plate_deep'] if not has_e else c['wall_plate_dk'])

    # Horizontal seam between plates & bottom baseboard
    for x in range(16):
        img.putpixel((x, 16), c['wall_seam'])
        img.putpixel((x, 17), c['wall_plate_hi'])
        img.putpixel((x, 23), c['wall_seam'])
        img.putpixel((x, 24), c['wall_plate_lt'])
        img.putpixel((x, 30), c['wall_plate_deep'])
        img.putpixel((x, 31), c['wall_seam'])

    # Vertical armor panel divider line
    for y in range(18, 30):
        if y != 23:
            img.putpixel((8, y), c['wall_seam'])
            img.putpixel((9, y), c['wall_plate_lt'])

    # Center conduit glowing accent (cyan / violet sci-fi light strip)
    conduit_color = c['wall_conduit_cyan'] if (mask % 2 == 0) else c['wall_conduit_purple']
    img.putpixel((4, 20), conduit_color)
    img.putpixel((11, 20), conduit_color)
    img.putpixel((4, 27), conduit_color)
    img.putpixel((11, 27), conduit_color)

    # Rivets
    if not has_w:
        img.putpixel((2, 19), c['wall_rivet'])
        img.putpixel((2, 28), c['wall_rivet'])
    if not has_e:
        img.putpixel((13, 19), c['wall_rivet'])
        img.putpixel((13, 28), c['wall_rivet'])

    return img

def create_sci_fi_wall_set_image():
    """Generates the full 64x128 16-bitmask wall set image."""
    full_img = Image.new('RGBA', (64, 128), (0, 0, 0, 0))
    for mask in range(16):
        col = mask % 4
        row = mask // 4
        piece = create_sci_fi_wall_piece(mask)
        full_img.paste(piece, (col * 16, row * 32), piece)
    return full_img

def create_galaxy_window_image(width_tiles=6, height_tiles=2):
    """
    Generates panoramic observation window with purple galaxy background & space station frame.
    Width: width_tiles * 16 (e.g. 6 * 16 = 96px)
    Height: height_tiles * 16 (e.g. 2 * 16 = 32px)
    """
    w = width_tiles * 16
    h = height_tiles * 16
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    c = {k: hex_to_rgba(v) for k, v in PALETTE.items()}

    # 1. Cosmic space background with purple nebula gradient
    for y in range(h):
        for x in range(w):
            # Distance from nebula centers
            nx1 = w * 0.35
            ny1 = h * 0.45
            dist1 = ((x - nx1) ** 2 + (y - ny1) ** 2) ** 0.5

            nx2 = w * 0.75
            ny2 = h * 0.35
            dist2 = ((x - nx2) ** 2 + (y - ny2) ** 2) ** 0.5

            if dist1 < 10:
                col = c['nebula_hot']
            elif dist1 < 20:
                col = c['nebula_glow']
            elif dist1 < 35:
                col = c['nebula_bright']
            elif dist1 < 50 or dist2 < 18:
                col = c['nebula_mid']
            elif dist1 < 65 or dist2 < 30:
                col = c['nebula_deep']
            elif dist2 < 45:
                col = c['space_mid']
            elif (y % 4 == 0 and x % 3 == 0):
                col = c['space_dark']
            else:
                col = c['space_deep']

            img.putpixel((x, y), col)

    # 2. Scattered twinkling stars
    stars = [
        (8, 6, 'star_white'), (24, 12, 'star_cyan'), (38, 5, 'star_gold'),
        (52, 18, 'star_white'), (68, 8, 'star_dim'), (82, 14, 'star_cyan'),
        (15, 22, 'star_dim'), (45, 25, 'star_white'), (75, 24, 'star_gold'),
        (33, 9, 'star_white'), (62, 15, 'star_cyan'), (88, 7, 'star_white'),
    ]
    for sx, sy, stype in stars:
        if sx < w and sy < h:
            img.putpixel((sx, sy), c[stype])
            # 2px star glow for bright stars
            if stype == 'star_white':
                if sx + 1 < w: img.putpixel((sx + 1, sy), c['star_dim'])
                if sy + 1 < h: img.putpixel((sx, sy + 1), c['star_dim'])

    # 3. Diagonal glass glare reflection
    for x in range(w):
        for y in range(h):
            if (x - y * 2) % 32 in (0, 1):
                cur = img.getpixel((x, y))
                # Alpha blend
                r = int(cur[0] * 0.82 + 255 * 0.18)
                g = int(cur[1] * 0.82 + 255 * 0.18)
                b = int(cur[2] * 0.82 + 255 * 0.18)
                img.putpixel((x, y), (r, g, b, 255))

    # 4. Outer heavy bulkhead window frame borders
    # Top frame lintel (y: 0..3)
    for x in range(w):
        img.putpixel((x, 0), c['window_frame_hi'])
        img.putpixel((x, 1), c['window_frame_md'])
        img.putpixel((x, 2), c['window_frame_dk'])
        img.putpixel((x, 3), c['window_frame_deep'])

    # Bottom frame sill (y: h-4..h-1)
    for x in range(w):
        img.putpixel((x, h - 4), c['window_frame_deep'])
        img.putpixel((x, h - 3), c['window_frame_md'])
        img.putpixel((x, h - 2), c['window_frame_hi'])
        img.putpixel((x, h - 1), c['window_frame_dk'])

    # Left & Right frame jambs
    for y in range(h):
        img.putpixel((0, y), c['window_frame_hi'])
        img.putpixel((1, y), c['window_frame_md'])
        img.putpixel((2, y), c['window_frame_deep'])
        img.putpixel((w - 3, y), c['window_frame_deep'])
        img.putpixel((w - 2, y), c['window_frame_md'])
        img.putpixel((w - 1, y), c['window_frame_dk'])

    # Center vertical window mullion/strut
    cx = w // 2
    for y in range(h):
        img.putpixel((cx - 2, y), c['window_frame_deep'])
        img.putpixel((cx - 1, y), c['window_frame_md'])
        img.putpixel((cx, y), c['window_frame_hi'])
        img.putpixel((cx + 1, y), c['window_frame_md'])
        img.putpixel((cx + 2, y), c['window_frame_deep'])

    return img

def image_to_grid(img):
    """Converts a PIL image to a 2D array of hex strings."""
    w, h = img.size
    grid = []
    for y in range(h):
        row = []
        for x in range(w):
            r, g, b, a = img.getpixel((x, y))
            row.append(rgba_to_hex(r, g, b, a))
        grid.append(row)
    return grid

def main():
    base_dir = '/home/bao/.ductor/workspace/projects/pixel-agents-ductor-lab'
    out_dir = os.path.join(base_dir, 'webview-ui/public/assets/themes/ductor-space-lab')
    os.makedirs(out_dir, exist_ok=True)

    # 1. Floor tile
    floor_img = create_dark_metal_floor_tile()
    floor_path = os.path.join(out_dir, 'floor-dark-metal.png')
    floor_img.save(floor_path, format='PNG')
    print(f'✓ Generated {floor_path} ({floor_img.size[0]}x{floor_img.size[1]})')

    # 2. Wall tile set (16 bitmasks, 64x128)
    wall_img = create_sci_fi_wall_set_image()
    wall_path = os.path.join(out_dir, 'wall-panel.png')
    wall_img.save(wall_path, format='PNG')
    print(f'✓ Generated {wall_path} ({wall_img.size[0]}x{wall_img.size[1]})')

    # 3. Observation window & purple galaxy (96x32 = 6x2 tiles)
    window_img = create_galaxy_window_image(6, 2)
    window_path = os.path.join(out_dir, 'window-galaxy.png')
    window_img.save(window_path, format='PNG')
    print(f'✓ Generated {window_path} ({window_img.size[0]}x{window_img.size[1]})')

    # 4. Decoded JSON bundle
    wall_pieces = []
    for mask in range(16):
        piece = create_sci_fi_wall_piece(mask)
        wall_pieces.append(image_to_grid(piece))

    json_bundle = {
        'floor': image_to_grid(floor_img),
        'wallSet': wall_pieces,
        'window': image_to_grid(window_img),
        'palette': PALETTE,
    }

    json_path = os.path.join(base_dir, 'webview-ui/src/office/sprites/ductorSpaceLabTiles.json')
    with open(json_path, 'w') as f:
        json.dump(json_bundle, f, indent=2)
    print(f'✓ Saved decoded tileset to {json_path}')

if __name__ == '__main__':
    main()
