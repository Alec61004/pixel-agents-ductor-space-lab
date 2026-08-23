#!/usr/bin/env python3
"""
Generate in-world tileset and prop assets for Ductor Space Lab:
1. Dark metallic modular floor tiles
2. Sci-Fi bulkhead panel wall sets (16-bitmask)
3. Large observation window frames & cosmic purple galaxy background
4. Space Lab Props:
   - Console Neon (Control console with cyan/magenta HUD displays)
   - Specimen Tank (Glass containment tube with bioluminescent alien)
   - Holo Table (Hologram star map projection table)
   - Weapon Rack (Wall-mounted plasma rifle and energy blasters)
   based on telegram_files/2026-08-22/photo_AQADaxFrG51tSVR-.webp

Outputs:
1. PNG tileset & prop assets in webview-ui/public/assets/themes/ductor-space-lab/
   - floor-dark-metal.png
   - wall-panel.png
   - window-galaxy.png
   - console-neon.png
   - specimen-tank.png
   - holo-table.png
   - weapon-rack.png
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

    # Neon & Props Palette
    'neon_cyan': '#00F0FF',
    'neon_cyan_hi': '#B0F6FF',
    'neon_cyan_dk': '#008499',
    'neon_magenta': '#FF2A8D',
    'neon_magenta_hi': '#FFA0D0',
    'neon_magenta_dk': '#991054',
    'neon_purple': '#B84AFF',
    'neon_green': '#00FF99',
    'neon_amber': '#FFB830',
    'screen_bg': '#090B14',
    'screen_border': '#151928',
    'gunmetal_hi': '#828CA8',
    'gunmetal_md': '#4E5568',
    'gunmetal_dk': '#272B36',
    'gunmetal_deep': '#14161C',
    'fluid_deep': '#092128',
    'fluid_mid': '#11424C',
    'fluid_glow': '#1A6B7B',
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

def create_neon_console_image():
    """
    Generates 48x32 neon sci-fi control console (3x2 tiles).
    - Top 16px (y: 0..15): Triple monitor displays with cyan/magenta HUD graphs, radar, diagnostics.
    - Bottom 16px (y: 16..31): Slanted desk with illuminated keyboards, sliders, trackball, neon underglow.
    """
    img = Image.new('RGBA', (48, 32), (0, 0, 0, 0))
    c = {k: hex_to_rgba(v) for k, v in PALETTE.items()}

    # Top housing & monitors (y: 0..15, x: 2..45)
    for y in range(0, 16):
        for x in range(2, 46):
            img.putpixel((x, y), c['floor_md'])

    # Outer top bevel & border
    for x in range(2, 46):
        img.putpixel((x, 0), c['floor_hi'])
        img.putpixel((x, 1), c['floor_lt'])
    for y in range(0, 16):
        img.putpixel((2, y), c['floor_hi'])
        img.putpixel((45, y), c['floor_dk'])

    # Top mini indicator strip (y: 1, x: 18..29)
    for x in range(18, 30):
        if x % 2 == 0:
            img.putpixel((x, 1), c['neon_cyan'] if x < 24 else c['neon_magenta'])

    # 1. Left Display (x: 4..16, y: 2..13) - Cyan telemetry & waveform
    for y in range(2, 14):
        for x in range(4, 17):
            if x in (4, 16) or y in (2, 13):
                img.putpixel((x, y), c['screen_border'])
            else:
                img.putpixel((x, y), c['screen_bg'])
    # Header bar
    for x in range(6, 15):
        img.putpixel((x, 4), c['neon_cyan_dk'])
    # Cyan Waveform sine line
    wave_pts = [(5,8), (6,8), (7,7), (8,6), (9,6), (10,7), (11,9), (12,10), (13,10), (14,9), (15,8)]
    for wx, wy in wave_pts:
        img.putpixel((wx, wy), c['neon_cyan'])
        img.putpixel((wx, wy-1), c['neon_cyan_hi'])
    # Vertical mini bars
    for bx in (6, 8, 10, 12, 14):
        h = (bx * 3) % 4 + 1
        for by in range(12 - h, 13):
            img.putpixel((bx, by), c['neon_cyan'])

    # 2. Center Main Display (x: 18..30, y: 1..14) - Magenta holographic target & status
    for y in range(1, 15):
        for x in range(18, 31):
            if x in (18, 30) or y in (1, 14):
                img.putpixel((x, y), c['floor_dk'])
            else:
                img.putpixel((x, y), c['screen_bg'])
    # Center target wireframe (Magenta / Purple)
    center_x, center_y = 24, 7
    # Magenta Diamond / Hexagon
    for dx, dy in [(-3, 0), (3, 0), (0, -3), (0, 3), (-2, -2), (2, -2), (-2, 2), (2, 2)]:
        img.putpixel((center_x + dx, center_y + dy), c['neon_magenta'])
    # Glowing core
    img.putpixel((center_x, center_y), c['star_white'])
    img.putpixel((center_x + 1, center_y), c['neon_magenta_hi'])
    img.putpixel((center_x - 1, center_y), c['neon_magenta_hi'])
    # Orbiting cyan blip
    img.putpixel((center_x + 3, center_y - 2), c['neon_cyan'])
    # Bottom diagnostic readouts
    for x in range(20, 29):
        img.putpixel((x, 12), c['neon_magenta'] if x < 25 else c['neon_cyan'])

    # 3. Right Display (x: 32..44, y: 2..13) - Cyan radar sweep & frequency
    for y in range(2, 14):
        for x in range(32, 45):
            if x in (32, 44) or y in (2, 13):
                img.putpixel((x, y), c['screen_border'])
            else:
                img.putpixel((x, y), c['screen_bg'])
    # Radar ring
    rx, ry = 38, 7
    for dx, dy in [(-3,0),(3,0),(0,-3),(0,3),(-2,-2),(2,-2),(-2,2),(2,2)]:
        img.putpixel((rx + dx, ry + dy), c['neon_cyan_dk'])
    # Sweep beam
    img.putpixel((rx, ry), c['neon_cyan'])
    img.putpixel((rx + 1, ry - 1), c['neon_cyan'])
    img.putpixel((rx + 2, ry - 2), c['neon_cyan_hi'])
    # Target blips
    img.putpixel((rx - 1, ry - 1), c['star_gold'])
    img.putpixel((rx + 2, ry + 1), c['neon_magenta'])
    # Frequency bars
    for fx in range(34, 43):
        fh = ((fx * 7) % 3) + 1
        for fy in range(12 - fh, 13):
            img.putpixel((fx, fy), c['neon_purple'])

    # Bottom Desk Surface (y: 15..22, x: 2..46)
    for y in range(15, 23):
        for x in range(2, 46):
            img.putpixel((x, y), c['floor_lt'])
    for x in range(2, 46):
        img.putpixel((x, 15), c['floor_hi'])
        img.putpixel((x, 22), c['floor_deep'])
    for y in range(15, 23):
        img.putpixel((2, y), c['floor_hi'])
        img.putpixel((45, y), c['floor_seam'])

    # Left illuminated keyboard (x: 5..16, y: 17..20)
    for y in range(17, 21):
        for x in range(5, 17):
            if (x + y) % 2 == 0:
                img.putpixel((x, y), c['neon_cyan'])
            else:
                img.putpixel((x, y), c['floor_dk'])

    # Center sliders / toggle bank (x: 19..29, y: 17..21)
    for sx in (20, 22, 24, 26, 28):
        for sy in range(17, 21):
            img.putpixel((sx, sy), c['floor_deep'])
        # Illuminated slider knob
        slider_y = 18 if sx in (20, 24, 28) else 19
        col = c['neon_magenta'] if sx < 25 else c['neon_cyan']
        img.putpixel((sx, slider_y), col)
        img.putpixel((sx, slider_y - 1), c['star_white'] if sx == 20 else col)

    # Right trackball & dial (x: 32..43, y: 17..21)
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            img.putpixel((37 + dx, 19 + dy), c['floor_deep'])
    img.putpixel((37, 19), c['neon_cyan_hi'])
    img.putpixel((36, 19), c['neon_cyan'])
    # Dial buttons
    for bx in (33, 34, 40, 41, 42):
        img.putpixel((bx, 18), c['neon_amber'])
        img.putpixel((bx, 20), c['neon_green'])

    # Neon underglow strip (y: 22, x: 3..45)
    for x in range(3, 45):
        t = (x - 3) / 42.0
        # Gradient from Cyan to Magenta
        if t < 0.5:
            img.putpixel((x, 22), c['neon_cyan'])
        else:
            img.putpixel((x, 22), c['neon_magenta'])

    # Lower desk pillars & base (y: 23..31)
    # Left pedestal (x: 2..9, y: 23..31)
    for y in range(23, 31):
        for x in range(2, 10):
            img.putpixel((x, y), c['floor_md'])
        img.putpixel((2, y), c['floor_hi'])
        img.putpixel((9, y), c['floor_deep'])
    # Right pedestal (x: 38..45, y: 23..31)
    for y in range(23, 31):
        for x in range(38, 46):
            img.putpixel((x, y), c['floor_md'])
        img.putpixel((38, y), c['floor_hi'])
        img.putpixel((45, y), c['floor_deep'])

    # Center knee bay shadow (x: 10..37, y: 23..31)
    for y in range(23, 31):
        for x in range(10, 38):
            img.putpixel((x, y), c['floor_deep'])
    # Vertical illuminated conduits in knee bay
    for y in range(23, 31):
        img.putpixel((15, y), c['neon_cyan_dk'])
        img.putpixel((32, y), c['neon_magenta_dk'])

    # Base foot plates (y: 30..31)
    for x in range(1, 11):
        img.putpixel((x, 30), c['floor_hi'])
        img.putpixel((x, 31), c['floor_seam'])
    for x in range(37, 47):
        img.putpixel((x, 30), c['floor_hi'])
        img.putpixel((x, 31), c['floor_seam'])
    # Rivets
    for rx, ry in [(3, 30), (8, 30), (39, 30), (44, 30)]:
        img.putpixel((rx, ry), c['floor_rivet'])

    return img

def create_specimen_tank_image():
    """
    Generates 32x48 specimen containment cylinder tank (2x3 tiles).
    - Top 10px (y: 0..9): Pressurized filtration dome, pressure gauge, status LEDs.
    - Middle 28px (y: 10..37): Glass cylinder with bioluminescent alien specimen suspended in fluid.
    - Bottom 10px (y: 38..47): Reinforced base pedestal with digital telemetry readout & conduits.
    """
    img = Image.new('RGBA', (32, 48), (0, 0, 0, 0))
    c = {k: hex_to_rgba(v) for k, v in PALETTE.items()}

    # Top Cap (y: 0..9, x: 4..27)
    # Top pipe & manifold (x: 12..19, y: 0..2)
    for y in range(0, 3):
        for x in range(12, 20):
            img.putpixel((x, y), c['floor_lt'])
        img.putpixel((12, y), c['floor_hi'])
        img.putpixel((19, y), c['floor_deep'])
    # Dome cowl (y: 3..9, x: 4..27)
    for y in range(3, 10):
        for x in range(4, 28):
            img.putpixel((x, y), c['floor_md'])
    for x in range(5, 27):
        img.putpixel((x, 3), c['floor_hi'])
        img.putpixel((x, 9), c['floor_seam'])
    for y in range(3, 10):
        img.putpixel((4, y), c['floor_hi'])
        img.putpixel((27, y), c['floor_dk'])
    # Pressure Gauge (x: 20..25, y: 4..8)
    for y in range(4, 9):
        for x in range(20, 26):
            img.putpixel((x, y), c['star_gold'])
    for y in range(5, 8):
        for x in range(21, 25):
            img.putpixel((x, y), c['star_white'])
    # Gauge needle
    img.putpixel((22, 6), c['neon_magenta'])
    img.putpixel((23, 5), c['neon_magenta'])
    # Status LED strip (x: 7..14, y: 5..6)
    for x in range(7, 15):
        img.putpixel((x, 5), c['neon_green'] if x % 2 == 0 else c['floor_dk'])
        img.putpixel((x, 6), c['neon_cyan_dk'] if x % 2 == 0 else c['floor_dk'])

    # Glass Chamber (y: 10..37, x: 3..28)
    # Struts (x: 3..5 and x: 26..28)
    for y in range(10, 38):
        for x in (3, 4, 5):
            img.putpixel((x, y), c['floor_md'])
        img.putpixel((3, y), c['floor_hi'])
        img.putpixel((5, y), c['floor_seam'])
        for x in (26, 27, 28):
            img.putpixel((x, y), c['floor_md'])
        img.putpixel((26, y), c['floor_lt'])
        img.putpixel((28, y), c['floor_seam'])
    # Strut bolt rivets
    for sy in (12, 23, 35):
        img.putpixel((4, sy), c['floor_rivet'])
        img.putpixel((27, sy), c['floor_rivet'])

    # Fluid Interior (x: 6..25, y: 10..37)
    for y in range(10, 38):
        for x in range(6, 26):
            if y < 14:
                col = c['fluid_deep']
            elif y < 28:
                col = c['fluid_glow'] if 10 <= x <= 21 and 18 <= y <= 28 else c['fluid_mid']
            else:
                col = c['fluid_mid']
            img.putpixel((x, y), col)

    # Glass glare reflection lines (Left and Right curved glass)
    for y in range(11, 37):
        img.putpixel((7, y), hex_to_rgba('#FFFFFF', 160))
        img.putpixel((8, y), hex_to_rgba('#70F6FF', 100))
        img.putpixel((24, y), hex_to_rgba('#70F6FF', 80))

    # Floating Alien Organism (y: 18..31, x: 11..21)
    # Organism Mantle/Head (x: 13..19, y: 18..23)
    for y in range(18, 24):
        for x in range(13, 20):
            img.putpixel((x, y), c['nebula_bright'])
    for x in range(14, 19):
        img.putpixel((x, 18), c['nebula_glow'])
        img.putpixel((x, 19), c['neon_magenta'])
    # Glowing nucleus core
    img.putpixel((16, 20), c['star_white'])
    img.putpixel((15, 20), c['neon_magenta_hi'])
    img.putpixel((17, 20), c['neon_magenta_hi'])
    img.putpixel((16, 21), c['neon_magenta'])
    # Bioluminescent eyes / sensors
    img.putpixel((14, 21), c['neon_cyan'])
    img.putpixel((18, 21), c['neon_cyan'])

    # Organism Tentacles / Tendrils (y: 24..31)
    tentacle_pts = [
        # Tentacle 1
        (13, 24), (12, 25), (12, 26), (11, 27), (11, 28), (12, 29), (12, 30),
        # Tentacle 2 (Center)
        (15, 24), (15, 25), (16, 26), (16, 27), (15, 28), (15, 29), (16, 30), (15, 31),
        # Tentacle 3
        (17, 24), (18, 25), (18, 26), (17, 27), (18, 28), (18, 29), (19, 30),
        # Tentacle 4
        (19, 24), (20, 25), (20, 26), (21, 27), (20, 28), (20, 29)
    ]
    for tx, ty in tentacle_pts:
        img.putpixel((tx, ty), c['neon_magenta'] if (tx+ty)%2==0 else c['nebula_glow'])

    # Floating spore particles
    for px, py in [(10, 19), (22, 22), (10, 32), (21, 15), (12, 33)]:
        img.putpixel((px, py), c['neon_cyan_hi'])

    # Rising micro-bubbles
    for bx, by in [(9, 13), (9, 23), (22, 17), (23, 28), (14, 34), (18, 36), (10, 16)]:
        img.putpixel((bx, by), c['star_cyan'])

    # Bottom Base Pedestal (y: 38..47, x: 2..29)
    # Upper collar (y: 38..39, x: 4..27)
    for y in range(38, 40):
        for x in range(4, 28):
            img.putpixel((x, y), c['floor_md'])
        img.putpixel((4, y), c['floor_hi'])
        img.putpixel((27, y), c['floor_seam'])
    # Base housing (y: 40..45, x: 3..28)
    for y in range(40, 46):
        for x in range(3, 29):
            img.putpixel((x, y), c['floor_dk'])
        img.putpixel((3, y), c['floor_hi'])
        img.putpixel((28, y), c['floor_seam'])
    # Digital readout monitor on base (x: 10..21, y: 41..44)
    for y in range(41, 45):
        for x in range(10, 22):
            img.putpixel((x, y), c['screen_bg'])
    # Bio-stats digital graphs
    for x in range(11, 21):
        img.putpixel((x, 42), c['neon_cyan'])
        if x % 2 == 0:
            img.putpixel((x, 43), c['neon_cyan_hi'])
    # Coolant conduits on base sides (x: 5..8 and 23..26)
    for y in range(41, 45):
        img.putpixel((6, y), c['neon_cyan_dk'])
        img.putpixel((25, y), c['neon_purple'])
    # Bottom floor mounting flange (y: 46..47, x: 2..29)
    for x in range(2, 30):
        img.putpixel((x, 46), c['floor_hi'])
        img.putpixel((x, 47), c['floor_seam'])
    for rx, ry in [(4, 46), (9, 46), (22, 46), (27, 46)]:
        img.putpixel((rx, ry), c['floor_rivet'])

    return img

def create_holo_table_image():
    """
    Generates 32x32 Hologram Star Map Table (2x2 tiles).
    - Top 14px (y: 0..14): Floating 3D Star Map Hologram with glowing star, orbits, planets, light cones.
    - Bottom 18px (y: 15..31): Beveled pedestal table with central projector lens and touch interface.
    """
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    c = {k: hex_to_rgba(v) for k, v in PALETTE.items()}

    # 1. Floating Hologram Star Map (y: 0..14)
    # Central Star (x: 15..16, y: 5..6)
    img.putpixel((15, 5), c['star_white'])
    img.putpixel((16, 5), c['star_white'])
    img.putpixel((15, 6), c['star_white'])
    img.putpixel((16, 6), c['star_white'])
    for dx, dy in [(-1,0),(2,0),(0,-1),(1,-1),(0,2),(1,2),(-1,-1),(2,-1),(-1,2),(2,2)]:
        img.putpixel((15 + dx, 5 + dy), c['star_gold'])

    # Inner Planetary Orbit Ellipse (Perspective circle in cyan)
    inner_orbit = [
        (11, 5), (12, 4), (13, 4), (14, 3), (15, 3), (16, 3), (17, 3), (18, 4), (19, 4), (20, 5),
        (20, 6), (19, 7), (18, 7), (17, 8), (16, 8), (15, 8), (14, 8), (13, 7), (12, 7), (11, 6)
    ]
    for ox, oy in inner_orbit:
        img.putpixel((ox, oy), hex_to_rgba('#00F0FF', 140))
    # Terrestrial Planet (x: 11, y: 4)
    img.putpixel((11, 4), c['neon_cyan_hi'])
    img.putpixel((10, 4), c['neon_cyan'])

    # Outer Planetary Orbit Ellipse (Wider purple ellipse)
    outer_orbit = [
        (5, 5), (6, 4), (7, 3), (9, 2), (12, 1), (15, 1), (18, 1), (21, 2), (23, 3), (25, 4), (26, 5),
        (26, 6), (25, 7), (23, 8), (21, 9), (18, 10), (15, 10), (12, 10), (9, 9), (7, 8), (6, 7), (5, 6)
    ]
    for ox, oy in outer_orbit:
        img.putpixel((ox, oy), hex_to_rgba('#B84AFF', 120))
    # Gas Giant with rings (x: 23, y: 3..4)
    img.putpixel((23, 3), c['neon_magenta'])
    img.putpixel((23, 4), c['neon_magenta'])
    # Ring
    img.putpixel((22, 4), c['neon_magenta_hi'])
    img.putpixel((24, 3), c['neon_magenta_hi'])
    # Moon
    img.putpixel((25, 2), c['star_gold'])

    # Coordinate crosshair & vertical grid lines
    for gy in range(2, 9):
        if gy % 2 == 0:
            img.putpixel((7, gy), hex_to_rgba('#00F0FF', 100))
            img.putpixel((24, gy), hex_to_rgba('#00F0FF', 100))

    # Projection Light Rays (y: 10..14)
    for ly in range(10, 15):
        t = (ly - 10) / 4.0
        lx1 = int(7 + t * 6)
        lx2 = int(24 - t * 6)
        lx3 = 15 if ly % 2 == 0 else 16
        img.putpixel((lx1, ly), hex_to_rgba('#00F0FF', 80))
        img.putpixel((lx2, ly), hex_to_rgba('#00F0FF', 80))
        img.putpixel((lx3, ly), hex_to_rgba('#00F0FF', 100))

    # 2. Hologram Table Base (y: 15..31)
    # Octagonal Tabletop (y: 15..20, x: 3..28)
    for y in range(15, 21):
        for x in range(3, 29):
            img.putpixel((x, y), c['floor_md'])
    for x in range(5, 27):
        img.putpixel((x, 15), c['floor_hi'])
        img.putpixel((x, 20), c['floor_seam'])
    img.putpixel((3, 16), c['floor_hi'])
    img.putpixel((4, 15), c['floor_hi'])
    img.putpixel((28, 16), c['floor_dk'])
    img.putpixel((27, 15), c['floor_dk'])

    # Central Hologram Emitter Lens (x: 12..19, y: 15..17)
    for y in range(15, 18):
        for x in range(12, 20):
            img.putpixel((x, y), c['screen_bg'])
    for x in range(14, 18):
        img.putpixel((x, 16), c['star_white'])
    img.putpixel((13, 16), c['neon_cyan_hi'])
    img.putpixel((18, 16), c['neon_cyan_hi'])

    # Rim touch pads & control buttons (x: 5..10 and x: 21..26)
    for bx in (6, 8, 23, 25):
        img.putpixel((bx, 18), c['neon_cyan'])
        img.putpixel((bx+1, 18), c['neon_magenta'])

    # Central support column (y: 21..28, x: 9..22)
    for y in range(21, 29):
        for x in range(9, 23):
            img.putpixel((x, y), c['floor_dk'])
        img.putpixel((9, y), c['floor_hi'])
        img.putpixel((22, y), c['floor_seam'])
        # Center vertical glowing blue power channel
        img.putpixel((15, y), c['neon_cyan'])
        img.putpixel((16, y), c['neon_cyan_hi'])

    # Side angled support struts
    for sy in range(23, 29):
        img.putpixel((7, sy), c['floor_lt'])
        img.putpixel((24, sy), c['floor_md'])

    # Heavy Floor Flange Disc (y: 29..31, x: 4..27)
    for y in range(29, 32):
        for x in range(4, 28):
            img.putpixel((x, y), c['floor_md'])
    for x in range(5, 27):
        img.putpixel((x, 29), c['floor_hi'])
        img.putpixel((x, 31), c['floor_seam'])
    for rx, ry in [(6, 30), (11, 30), (20, 30), (25, 30)]:
        img.putpixel((rx, ry), c['floor_rivet'])

    return img

def create_weapon_rack_image():
    """
    Generates 32x32 Wall-Mounted Weapon Rack (2x2 tiles).
    - Heavy bulkhead armor backplate with magnetic mounting brackets.
    - Top tier: Heavy Plasma Rifle with illuminated cyan plasma coils and scope.
    - Bottom tier: Dual Energy Blasters with magenta power cells and status indicators.
    """
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    c = {k: hex_to_rgba(v) for k, v in PALETTE.items()}

    # Wall Mount Backplate (y: 2..30, x: 2..29)
    for y in range(2, 31):
        for x in range(2, 30):
            img.putpixel((x, y), c['wall_plate_lt'])
    for x in range(2, 30):
        img.putpixel((x, 2), c['wall_top_hi'])
        img.putpixel((x, 30), c['wall_seam'])
    for y in range(2, 31):
        img.putpixel((2, y), c['wall_top_hi'])
        img.putpixel((29, y), c['wall_seam'])

    # Mounting slot grid pattern
    for y in range(5, 28):
        for sx in (7, 12, 17, 22):
            if y % 3 != 0:
                img.putpixel((sx, y), c['wall_plate_deep'])

    # Corner Bolts
    for rx, ry in [(4, 4), (27, 4), (4, 28), (27, 28)]:
        img.putpixel((rx, ry), c['wall_rivet'])
        img.putpixel((rx+1, ry), c['wall_seam'])

    # Top Security Status Banner (x: 11..20, y: 3..4)
    for y in (3, 4):
        for x in range(11, 21):
            img.putpixel((x, y), c['screen_bg'])
    for x in range(12, 20):
        img.putpixel((x, 3), c['neon_green'])

    # 1. Top Weapon: Heavy Sci-Fi Plasma Assault Rifle (y: 7..14, x: 4..27)
    # Magnetic Rack Brackets (x: 9, 22, y: 12..14)
    for by in (12, 13, 14):
        img.putpixel((9, by), c['star_gold'])
        img.putpixel((22, by), c['star_gold'])

    # Barrel & Muzzle (x: 4..11, y: 8..9)
    for x in range(4, 12):
        img.putpixel((x, 8), c['gunmetal_hi'])
        img.putpixel((x, 9), c['gunmetal_md'])
    # Muzzle flash suppressor
    img.putpixel((4, 7), c['gunmetal_dk'])
    img.putpixel((4, 10), c['gunmetal_dk'])

    # Plasma Heatsink / Glowing Cyan Energy Coil (x: 11..19, y: 7..8)
    for x in range(11, 20):
        img.putpixel((x, 7), c['neon_cyan_hi'] if x % 2 == 0 else c['neon_cyan'])
        img.putpixel((x, 8), c['neon_cyan'] if x % 2 == 0 else c['neon_cyan_dk'])

    # Receiver Housing & Tactical Frame (x: 18..24, y: 8..11)
    for y in range(8, 12):
        for x in range(18, 25):
            img.putpixel((x, y), c['gunmetal_md'])
    for x in range(18, 25):
        img.putpixel((x, 8), c['gunmetal_hi'])
    # Scope on top rail (x: 14..18, y: 6)
    for x in range(14, 19):
        img.putpixel((x, 6), c['gunmetal_dk'])
    img.putpixel((16, 6), c['neon_cyan'])

    # Pistol Grip & Trigger (x: 20..22, y: 11..13)
    for y in (11, 12, 13):
        img.putpixel((21, y), c['gunmetal_deep'])
    img.putpixel((20, 12), c['gunmetal_hi'])

    # Tactical Skeletal Stock (x: 24..27, y: 8..11)
    img.putpixel((25, 8), c['gunmetal_hi'])
    img.putpixel((26, 9), c['gunmetal_md'])
    img.putpixel((27, 9), c['gunmetal_hi'])
    img.putpixel((27, 10), c['gunmetal_md'])
    img.putpixel((27, 11), c['gunmetal_dk'])
    img.putpixel((25, 11), c['gunmetal_dk'])

    # 2. Bottom Weapon Tier: Dual Energy Blasters (y: 17..27, x: 4..27)
    # Left Blaster: Compact Plasma SMG (x: 4..15, y: 18..24)
    for x in range(4, 15):
        img.putpixel((x, 19), c['gunmetal_hi'])
        img.putpixel((x, 20), c['gunmetal_md'])
    # Magenta glowing power cell (x: 8..12, y: 18)
    for x in range(8, 13):
        img.putpixel((x, 18), c['neon_magenta'])
        img.putpixel((x, 19), c['neon_magenta_hi'])
    # Grip & Mag (x: 11..13, y: 21..24)
    for y in range(21, 25):
        img.putpixel((12, y), c['gunmetal_deep'])
        img.putpixel((11, y), c['gunmetal_md'])

    # Right Blaster: Heavy Ion Pistol (x: 16..27, y: 18..24)
    for x in range(16, 27):
        img.putpixel((x, 19), c['gunmetal_hi'])
        img.putpixel((x, 20), c['gunmetal_md'])
    # Cyan charge indicator along slide (x: 18..23, y: 18)
    for x in range(18, 24):
        img.putpixel((x, 18), c['neon_cyan'])
    # Grip (x: 23..25, y: 21..24)
    for y in range(21, 25):
        img.putpixel((24, y), c['gunmetal_deep'])
        img.putpixel((25, y), c['gunmetal_md'])

    # Bottom rack shelf bracket & status indicators (y: 26..28)
    for x in range(4, 28):
        img.putpixel((x, 26), c['wall_plate_hi'])
    img.putpixel((8, 27), c['neon_green'])
    img.putpixel((23, 27), c['neon_green'])

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

    # 4. Props:
    # (1) Neon Control Console (48x32 = 3x2 tiles)
    console_neon_img = create_neon_console_image()
    console_neon_path = os.path.join(out_dir, 'console-neon.png')
    console_neon_img.save(console_neon_path, format='PNG')
    print(f'✓ Generated {console_neon_path} ({console_neon_img.size[0]}x{console_neon_img.size[1]})')

    # (2) Specimen Containment Tank (32x48 = 2x3 tiles)
    specimen_tank_img = create_specimen_tank_image()
    specimen_tank_path = os.path.join(out_dir, 'specimen-tank.png')
    specimen_tank_img.save(specimen_tank_path, format='PNG')
    print(f'✓ Generated {specimen_tank_path} ({specimen_tank_img.size[0]}x{specimen_tank_img.size[1]})')

    # (3) Hologram Star Map Table (32x32 = 2x2 tiles)
    holo_table_img = create_holo_table_image()
    holo_table_path = os.path.join(out_dir, 'holo-table.png')
    holo_table_img.save(holo_table_path, format='PNG')
    print(f'✓ Generated {holo_table_path} ({holo_table_img.size[0]}x{holo_table_img.size[1]})')

    # (4) Wall Weapon Rack (32x32 = 2x2 tiles)
    weapon_rack_img = create_weapon_rack_image()
    weapon_rack_path = os.path.join(out_dir, 'weapon-rack.png')
    weapon_rack_img.save(weapon_rack_path, format='PNG')
    print(f'✓ Generated {weapon_rack_path} ({weapon_rack_img.size[0]}x{weapon_rack_img.size[1]})')

    # 5. Decoded JSON bundle
    wall_pieces = []
    for mask in range(16):
        piece = create_sci_fi_wall_piece(mask)
        wall_pieces.append(image_to_grid(piece))

    json_bundle = {
        'floor': image_to_grid(floor_img),
        'wallSet': wall_pieces,
        'window': image_to_grid(window_img),
        'consoleNeon': image_to_grid(console_neon_img),
        'specimenTank': image_to_grid(specimen_tank_img),
        'holoTable': image_to_grid(holo_table_img),
        'weaponRack': image_to_grid(weapon_rack_img),
        'palette': PALETTE,
    }

    json_path = os.path.join(base_dir, 'webview-ui/src/office/sprites/ductorSpaceLabTiles.json')
    with open(json_path, 'w') as f:
        json.dump(json_bundle, f, indent=2)
    print(f'✓ Saved decoded tileset to {json_path}')

if __name__ == '__main__':
    main()

