#!/usr/bin/env python3
"""
Generate authentic armored crew sprite sheets for Ductor Space Lab
cut directly from the reference sprite sheet:
- telegram_files/2026-08-22/photo_AQADbBFrG51tSVR-.webp (or webview-ui/public/assets/themes/ductor-space-lab/crew-sprites.webp)

Variants mapped from 2-row clusters:
- Rows 0 & 1: Benjamin (Red / Black tactical guardian armor & visor)
- Rows 2 & 3: Kevin (Teal / Cyan heavy engineering exo-armor & visor)
- Rows 4 & 5: Alec (Purple / Magenta tactical space armor & visor)

Generates:
1. PNG sprite sheets in webview-ui/public/assets/themes/ductor-space-lab/
   - crew-alec.png (112x96)
   - crew-kevin.png (112x96)
   - crew-benjamin.png (112x96)
   - individual frame PNGs in frames/ subfolder
2. Decoded JSON in webview-ui/src/office/sprites/ductorCrewSprites.json
   for instant registration in spriteData.ts
"""

import json
import os
from collections import deque
from PIL import Image

def rgba_to_hex(r, g, b, a):
    if a < 2:
        return ""
    rgb = f"#{r:02X}{g:02X}{b:02X}"
    if a >= 255:
        return rgb
    return f"{rgb}{a:02X}"

def remove_background_floodfill(img):
    """
    Remove the neutral light-grey parchment background using flood fill from edges.
    """
    img = img.convert('RGBA')
    w, h = img.size
    
    def is_bg_pixel(r, g, b):
        diff = max(r, g, b) - min(r, g, b)
        return (r > 135 and g > 135 and b > 125 and diff < 32) or (r > 225 and g > 225 and b > 225)
    
    visited = [[False]*w for _ in range(h)]
    is_bg_mask = [[False]*w for _ in range(h)]
    queue = deque()
    
    for x in range(w):
        for y in [0, h - 1]:
            r, g, b, a = img.getpixel((x, y))
            if is_bg_pixel(r, g, b):
                queue.append((x, y))
                visited[y][x] = True
                is_bg_mask[y][x] = True
    for y in range(h):
        for x in [0, w - 1]:
            if not visited[y][x]:
                r, g, b, a = img.getpixel((x, y))
                if is_bg_pixel(r, g, b):
                    queue.append((x, y))
                    visited[y][x] = True
                    is_bg_mask[y][x] = True
    
    while queue:
        cx, cy = queue.popleft()
        for nx, ny in [(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)]:
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                visited[ny][nx] = True
                r, g, b, a = img.getpixel((nx, ny))
                if is_bg_pixel(r, g, b):
                    is_bg_mask[ny][nx] = True
                    queue.append((nx, ny))
    
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            if not is_bg_mask[y][x]:
                out.putpixel((x, y), img.getpixel((x, y)))
    return out

def process_frame(source_img, y0, y1, col_idx):
    """
    Extracts a cell, removes background, scales keeping aspect ratio, and centers into 16x32 frame.
    """
    cell = source_img.crop((col_idx * 80, y0, (col_idx + 1) * 80, y1))
    cleaned = remove_background_floodfill(cell)
    bbox = cleaned.getbbox()
    if not bbox:
        return Image.new('RGBA', (16, 32), (0, 0, 0, 0))
    cropped = cleaned.crop(bbox)
    
    orig_w, orig_h = cropped.size
    new_h = min(28, max(1, int(round(orig_h * (28.0 / 108.0)))))
    new_w = min(14, max(1, int(round(orig_w * (28.0 / 108.0)))))
    
    scaled = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Crisp pixel art thresholding
    crisp = Image.new('RGBA', (new_w, new_h), (0, 0, 0, 0))
    for y in range(new_h):
        for x in range(new_w):
            r, g, b, a = scaled.getpixel((x, y))
            if a > 70:
                crisp.putpixel((x, y), (r, g, b, 255))
    
    # Place on 16x32 canvas (horizontally centered, bottom aligned at y=31)
    canvas = Image.new('RGBA', (16, 32), (0, 0, 0, 0))
    ox = (16 - new_w) // 2
    oy = 31 - new_h
    canvas.paste(crisp, (ox, oy), crisp)
    return canvas

def decode_image_to_sprite_data(img):
    """
    Decodes a 112x96 Image into { down: SpriteData[], up: SpriteData[], right: SpriteData[] }
    """
    result = {'down': [], 'up': [], 'right': []}
    for dir_idx, dir_name in enumerate(['down', 'up', 'right']):
        row_y = dir_idx * 32
        for f in range(7):
            col_x = f * 16
            frame_grid = []
            for y in range(32):
                row = []
                for x in range(16):
                    r, g, b, a = img.getpixel((col_x + x, row_y + y))
                    row.append(rgba_to_hex(r, g, b, a))
                frame_grid.append(row)
            result[dir_name].append(frame_grid)
    return result

def main():
    # Source image search paths
    candidates = [
        '/home/bao/.ductor/workspace/telegram_files/2026-08-22/photo_AQADbBFrG51tSVR-.webp',
        'webview-ui/public/assets/themes/ductor-space-lab/crew-sprites.webp',
        'telegram_files/2026-08-22/photo_AQADbBFrG51tSVR-.webp',
    ]
    src_path = None
    for p in candidates:
        if os.path.exists(p):
            src_path = p
            break
    if not src_path:
        raise FileNotFoundError('Could not locate reference sprite sheet webp file')
    
    print(f'Loading reference sprite sheet from {src_path}')
    im = Image.open(src_path)

    out_dir = 'webview-ui/public/assets/themes/ductor-space-lab'
    frames_dir = os.path.join(out_dir, 'frames')
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(frames_dir, exist_ok=True)

    mappings = {
        'benjamin': {
            'r0': (0, 118),
            'r1': (124, 236),
            'down': [(0, 0), (0, 1), (0, 2), (1, 0), (1, 3), (1, 6), (1, 7)],
            'up':   [(0, 8), (0, 9), (0, 10), (1, 8), (1, 9), (1, 10), (1, 11)],
            'right':[(0, 4), (0, 5), (0, 6), (1, 1), (1, 2), (1, 12), (1, 13)],
        },
        'kevin': {
            'r0': (245, 357),
            'r1': (366, 478),
            'down': [(0, 0), (0, 1), (0, 2), (1, 0), (1, 3), (1, 6), (1, 7)],
            'up':   [(0, 8), (0, 10), (0, 11), (1, 8), (1, 9), (1, 10), (1, 11)],
            'right':[(0, 4), (0, 5), (0, 6), (1, 1), (1, 2), (1, 4), (1, 5)],
        },
        'alec': {
            'r0': (488, 598),
            'r1': (608, 718),
            'down': [(0, 0), (0, 1), (0, 2), (1, 0), (1, 3), (1, 6), (1, 7)],
            'up':   [(0, 8), (0, 9), (0, 10), (1, 8), (1, 9), (1, 10), (1, 11)],
            'right':[(0, 4), (0, 5), (0, 6), (1, 1), (1, 2), (1, 12), (1, 13)],
        },
    }

    json_data = {}

    for char_key in ['alec', 'kevin', 'benjamin']:
        cfg = mappings[char_key]
        sheet = Image.new('RGBA', (112, 96), (0, 0, 0, 0))
        
        for dir_idx, dir_name in enumerate(['down', 'up', 'right']):
            frames = cfg[dir_name]
            for f_idx, (r_sel, col_idx) in enumerate(frames):
                y_range = cfg['r0'] if r_sel == 0 else cfg['r1']
                frame = process_frame(im, y_range[0], y_range[1], col_idx)
                sheet.paste(frame, (f_idx * 16, dir_idx * 32), frame)
                
                # Save individual frame PNG
                frame_path = os.path.join(frames_dir, f'{char_key}_{dir_name}_{f_idx}.png')
                frame.save(frame_path, format='PNG')
        
        out_path = os.path.join(out_dir, f'crew-{char_key}.png')
        sheet.save(out_path, format='PNG')
        # Also alias without prefix
        alias_path = os.path.join(out_dir, f'{char_key}.png')
        sheet.save(alias_path, format='PNG')
        print(f'✓ Generated {out_path} ({sheet.size[0]}x{sheet.size[1]})')

        json_data[char_key] = decode_image_to_sprite_data(sheet)

    # Save decoded JSON
    json_path = 'webview-ui/src/office/sprites/ductorCrewSprites.json'
    with open(json_path, 'w') as f:
        json.dump(json_data, f, indent=2)
    print(f'✓ Saved decoded authentic crew sprites to {json_path}')

if __name__ == '__main__':
    main()
