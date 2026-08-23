#!/usr/bin/env python3
"""
Generate in-world armored crew sprite sheets for Ductor Space Lab:
- Alec: Purple tactical space armor & helmet
- Kevin: Cyan / Teal heavy engineering exo-armor & helmet
- Benjamin: Crimson / Black tactical guardian armor & helmet

Generates:
1. PNG sprite sheets in webview-ui/public/assets/themes/ductor-space-lab/
   - alec.png (112x96)
   - kevin.png (112x96)
   - benjamin.png (112x96)
   (and aliases crew_*.png, crew-*.png)
2. Decoded JSON in webview-ui/src/office/sprites/ductorCrewSprites.json
   for instant registration in spriteData.ts
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

PALETTES = {
    'alec': {
        'name': 'Alec (Purple Commander)',
        'armor_highlight': '#C8A0F8',
        'armor_light': '#9E64E8',
        'armor_main': '#7438C0',
        'armor_dark': '#4E2088',
        'armor_deep': '#2E1058',
        'chassis_light': '#5A5C70',
        'chassis_main': '#343648',
        'chassis_dark': '#1E202C',
        'chassis_deep': '#10121A',
        'visor_core': '#FFFFFF',
        'visor_bright': '#F4B8FF',
        'visor_main': '#D060F8',
        'visor_glow': '#9020C8',
        'reactor_glow': '#FFE066',
        'accent_dot': '#40FFFF',
        'pad_screen': '#C080FF',
    },
    'kevin': {
        'name': 'Kevin (Cyan Builder)',
        'armor_highlight': '#8CEEFA',
        'armor_light': '#36D0E8',
        'armor_main': '#16A4C2',
        'armor_dark': '#0E6C84',
        'armor_deep': '#064252',
        'chassis_light': '#505E6C',
        'chassis_main': '#2E3842',
        'chassis_dark': '#1A2228',
        'chassis_deep': '#0E1418',
        'visor_core': '#FFFFFF',
        'visor_bright': '#C8FFFF',
        'visor_main': '#38F0FF',
        'visor_glow': '#00A8C8',
        'reactor_glow': '#FFAA00',
        'accent_dot': '#FFDD33',
        'pad_screen': '#40FFFF',
    },
    'benjamin': {
        'name': 'Benjamin (Red/Black Guardian)',
        'armor_highlight': '#FFA0AC',
        'armor_light': '#F04058',
        'armor_main': '#C42036',
        'armor_dark': '#841022',
        'armor_deep': '#4E0814',
        'chassis_light': '#525262',
        'chassis_main': '#262630',
        'chassis_dark': '#14141A',
        'chassis_deep': '#08080C',
        'visor_core': '#FFFFFF',
        'visor_bright': '#FFA8B4',
        'visor_main': '#FF2844',
        'visor_glow': '#A8081C',
        'reactor_glow': '#FFFFFF',
        'accent_dot': '#FFA030',
        'pad_screen': '#FF4466',
    },
}

def generate_crew_sprite(char_key):
    pal = PALETTES[char_key]
    img = Image.new('RGBA', (112, 96), (0, 0, 0, 0))

    ref_im = Image.open('webview-ui/public/assets/characters/char_0.png')

    H_HI = hex_to_rgba(pal['armor_highlight'])
    H_LT = hex_to_rgba(pal['armor_light'])
    H_MD = hex_to_rgba(pal['armor_main'])
    H_DK = hex_to_rgba(pal['armor_dark'])
    H_DP = hex_to_rgba(pal['armor_deep'])

    C_LT = hex_to_rgba(pal['chassis_light'])
    C_MD = hex_to_rgba(pal['chassis_main'])
    C_DK = hex_to_rgba(pal['chassis_dark'])
    C_DP = hex_to_rgba(pal['chassis_deep'])

    V_CR = hex_to_rgba(pal['visor_core'])
    V_BR = hex_to_rgba(pal['visor_bright'])
    V_MD = hex_to_rgba(pal['visor_main'])
    V_GL = hex_to_rgba(pal['visor_glow'])

    R_GL = hex_to_rgba(pal['reactor_glow'])
    A_DT = hex_to_rgba(pal['accent_dot'])
    P_SC = hex_to_rgba(pal['pad_screen'])

    for dir_idx, dir_name in enumerate(['down', 'up', 'right']):
        row_y = dir_idx * 32
        for f_idx in range(7):
            col_x = f_idx * 16
            ref_frame = ref_im.crop((col_x, row_y, col_x + 16, row_y + 32))
            frame_img = Image.new('RGBA', (16, 32), (0, 0, 0, 0))
            
            for y in range(32):
                for x in range(16):
                    r_ref, g_ref, b_ref, a_ref = ref_frame.getpixel((x, y))
                    if a_ref < 30:
                        continue

                    # Armor generation logic
                    if y <= 2:
                        if x in (7, 8):
                            frame_img.putpixel((x, y), H_HI)
                        else:
                            frame_img.putpixel((x, y), H_DP)
                    elif 3 <= y <= 7:
                        if y == 3:
                            if x in (4, 11):
                                frame_img.putpixel((x, y), H_DP)
                            elif x in (5, 6, 7, 8, 9, 10):
                                frame_img.putpixel((x, y), H_HI if (x in (6, 7) and dir_name != 'up') else H_LT)
                            else:
                                frame_img.putpixel((x, y), H_DP)
                        elif y in (4, 5):
                            if x in (2, 13) or (dir_name == 'right' and x in (2, 14)):
                                frame_img.putpixel((x, y), H_DP)
                            elif x in (3, 4):
                                frame_img.putpixel((x, y), H_LT if dir_name != 'right' else H_HI)
                            elif x in (5, 6, 7):
                                frame_img.putpixel((x, y), H_HI if (dir_name != 'up') else H_LT)
                            elif x in (8, 9, 10):
                                frame_img.putpixel((x, y), H_LT if (dir_name != 'up') else H_MD)
                            elif x in (11, 12):
                                frame_img.putpixel((x, y), H_MD if (dir_name != 'up') else H_DK)
                            else:
                                frame_img.putpixel((x, y), H_DK)
                        else:
                            if dir_name == 'down':
                                if x in (1, 14):
                                    frame_img.putpixel((x, y), H_DP)
                                elif x in (2, 13):
                                    frame_img.putpixel((x, y), A_DT if y == 6 else H_DK)
                                elif x in (3, 12):
                                    frame_img.putpixel((x, y), H_DK)
                                elif y == 6:
                                    if x in (4, 5):
                                        frame_img.putpixel((x, y), V_BR)
                                    elif x in (6, 7, 8, 9):
                                        frame_img.putpixel((x, y), V_CR)
                                    else:
                                        frame_img.putpixel((x, y), V_BR)
                                elif y == 7:
                                    if x in (4, 5):
                                        frame_img.putpixel((x, y), V_MD)
                                    elif x in (6, 7, 8, 9):
                                        frame_img.putpixel((x, y), V_BR)
                                    else:
                                        frame_img.putpixel((x, y), V_MD)
                            elif dir_name == 'right':
                                if x in (2, 14):
                                    frame_img.putpixel((x, y), H_DP)
                                elif x in (3, 4):
                                    frame_img.putpixel((x, y), H_DK)
                                elif x in (5, 6):
                                    frame_img.putpixel((x, y), H_MD)
                                elif x in (7, 8):
                                    frame_img.putpixel((x, y), A_DT if y == 6 else H_LT)
                                elif x in (9, 10):
                                    frame_img.putpixel((x, y), H_DK)
                                elif x in (11, 12):
                                    frame_img.putpixel((x, y), V_CR if y == 6 else V_BR)
                                elif x in (13,):
                                    frame_img.putpixel((x, y), V_BR if y == 6 else V_MD)
                                else:
                                    frame_img.putpixel((x, y), H_DP)
                            else:
                                if x in (1, 14):
                                    frame_img.putpixel((x, y), H_DP)
                                elif x in (2, 13):
                                    frame_img.putpixel((x, y), H_DK)
                                elif x in (7, 8):
                                    frame_img.putpixel((x, y), H_HI if y == 6 else H_LT)
                                elif x in (5, 6, 9, 10):
                                    frame_img.putpixel((x, y), H_LT if y == 6 else H_MD)
                                else:
                                    frame_img.putpixel((x, y), H_DK)
                    elif 8 <= y <= 15:
                        if dir_name == 'down':
                            if y in (8, 9):
                                if x in (1, 14):
                                    frame_img.putpixel((x, y), H_DP)
                                elif x in (2, 13):
                                    frame_img.putpixel((x, y), H_DK)
                                elif x in (3, 12):
                                    frame_img.putpixel((x, y), H_MD)
                                elif x in (4, 11):
                                    frame_img.putpixel((x, y), V_MD)
                                else:
                                    frame_img.putpixel((x, y), V_GL if y == 9 else V_MD)
                            elif y in (10, 11, 12):
                                if x in (1, 14):
                                    frame_img.putpixel((x, y), H_DP)
                                elif x in (2, 13):
                                    frame_img.putpixel((x, y), H_DK)
                                elif x in (6, 7, 8, 9):
                                    frame_img.putpixel((x, y), H_HI if y == 10 else (C_MD if y == 11 else H_MD))
                                else:
                                    frame_img.putpixel((x, y), H_LT if x < 8 else H_MD)
                            else:
                                if x in (6, 7, 8, 9):
                                    frame_img.putpixel((x, y), C_MD if y < 15 else H_HI)
                                elif x in (4, 5, 10, 11):
                                    frame_img.putpixel((x, y), C_DK)
                                else:
                                    frame_img.putpixel((x, y), H_DP)
                        elif dir_name == 'right':
                            if y in (8, 9):
                                if x in (11, 12):
                                    frame_img.putpixel((x, y), V_GL)
                                elif x in (9, 10):
                                    frame_img.putpixel((x, y), H_MD)
                                elif x in (3, 4, 5):
                                    frame_img.putpixel((x, y), H_DK)
                                else:
                                    frame_img.putpixel((x, y), H_LT)
                            elif y in (10, 11, 12):
                                if x in (10, 11):
                                    frame_img.putpixel((x, y), H_HI if y == 10 else H_MD)
                                elif x in (7, 8, 9):
                                    frame_img.putpixel((x, y), C_MD)
                                else:
                                    frame_img.putpixel((x, y), H_DK)
                            else:
                                if x in (3, 4):
                                    frame_img.putpixel((x, y), H_HI)
                                elif x in (5, 6, 7):
                                    frame_img.putpixel((x, y), C_DK)
                                else:
                                    frame_img.putpixel((x, y), H_MD)
                        else:
                            if y in (8, 9, 10):
                                if x in (7, 8):
                                    frame_img.putpixel((x, y), H_LT)
                                elif x in (4, 5, 10, 11):
                                    frame_img.putpixel((x, y), H_MD)
                                else:
                                    frame_img.putpixel((x, y), H_DK)
                            else:
                                if x in (5, 6, 9, 10):
                                    frame_img.putpixel((x, y), H_HI if y == 15 else C_MD)
                                else:
                                    frame_img.putpixel((x, y), C_DK)
                    elif 16 <= y <= 24:
                        is_typing = (f_idx in (3, 4))
                        is_reading = (f_idx in (5, 6))

                        if dir_name == 'down':
                            if (x <= 3 or x >= 12) and y <= 19:
                                frame_img.putpixel((x, y), H_HI if (x in (2, 3) and y <= 17) else H_MD)
                            elif y in (18, 19) and x in (7, 8):
                                frame_img.putpixel((x, y), R_GL)
                            elif y in (17, 20) and x in (7, 8):
                                frame_img.putpixel((x, y), H_HI)
                            elif y <= 20 and 4 <= x <= 11:
                                if x in (4, 5, 6):
                                    frame_img.putpixel((x, y), H_LT if y in (17, 18) else H_MD)
                                else:
                                    frame_img.putpixel((x, y), H_MD if y in (17, 18) else H_DK)
                            elif y in (21, 22):
                                if x in (7, 8):
                                    frame_img.putpixel((x, y), A_DT)
                                elif x in (4, 5, 10, 11):
                                    frame_img.putpixel((x, y), C_MD)
                                else:
                                    frame_img.putpixel((x, y), C_DK)
                            else:
                                if x in (5, 6):
                                    frame_img.putpixel((x, y), H_LT)
                                elif x in (9, 10):
                                    frame_img.putpixel((x, y), H_MD)
                                else:
                                    frame_img.putpixel((x, y), C_DK)

                            if is_typing:
                                if y in (20, 21):
                                    if f_idx == 3 and x in (4, 5, 10, 11):
                                        frame_img.putpixel((x, y), A_DT if x in (5, 10) else H_HI)
                                    elif f_idx == 4 and x in (3, 4, 11, 12):
                                        frame_img.putpixel((x, y), A_DT if x in (4, 11) else H_HI)
                            elif is_reading:
                                if y in (19, 20, 21, 22) and 5 <= x <= 10:
                                    if y == 19 or y == 22 or x in (5, 10):
                                        frame_img.putpixel((x, y), C_LT)
                                    else:
                                        frame_img.putpixel((x, y), P_SC if (f_idx == 5 or (x + y) % 2 == 0) else V_CR)

                        elif dir_name == 'right':
                            if x <= 5 and y <= 21:
                                if y in (16, 17):
                                    frame_img.putpixel((x, y), H_HI if x == 4 else H_MD)
                                elif y in (18, 19):
                                    frame_img.putpixel((x, y), R_GL if x == 3 else C_MD)
                                else:
                                    frame_img.putpixel((x, y), C_DK)
                            elif x in (6, 7, 8, 9) and y <= 19:
                                frame_img.putpixel((x, y), H_HI if y <= 17 and x in (7, 8) else H_MD)
                            elif x >= 10 and y <= 20:
                                if y in (18, 19) and x in (11, 12):
                                    frame_img.putpixel((x, y), R_GL if x == 12 else H_LT)
                                else:
                                    frame_img.putpixel((x, y), H_MD)
                            elif y in (21, 22):
                                frame_img.putpixel((x, y), A_DT if x in (8, 9) else C_MD)
                            else:
                                frame_img.putpixel((x, y), H_DK)

                            if is_typing:
                                if y in (19, 20) and x in (12, 13, 14):
                                    frame_img.putpixel((x, y), A_DT if x == 13 else H_HI)
                            elif is_reading:
                                if y in (18, 19, 20, 21) and x in (11, 12, 13, 14):
                                    if x == 14 or y in (18, 21):
                                        frame_img.putpixel((x, y), C_LT)
                                    else:
                                        frame_img.putpixel((x, y), P_SC)

                        else:
                            if 5 <= x <= 10 and 16 <= y <= 22:
                                if y in (17, 18):
                                    if x in (6, 9):
                                        frame_img.putpixel((x, y), H_HI)
                                    elif x in (7, 8):
                                        frame_img.putpixel((x, y), C_LT)
                                    else:
                                        frame_img.putpixel((x, y), H_MD)
                                elif y in (19, 20):
                                    if x in (6, 9):
                                        frame_img.putpixel((x, y), R_GL)
                                    else:
                                        frame_img.putpixel((x, y), C_MD)
                                else:
                                    frame_img.putpixel((x, y), C_DK)
                            elif (x <= 4 or x >= 11) and y <= 19:
                                frame_img.putpixel((x, y), H_MD if (x in (3, 12)) else H_DK)
                            elif y in (21, 22):
                                frame_img.putpixel((x, y), C_MD if x in (7, 8) else C_DK)
                            else:
                                frame_img.putpixel((x, y), H_DK)

                            if is_typing:
                                if y in (19, 20) and (x in (2, 3, 12, 13)):
                                    frame_img.putpixel((x, y), H_HI if x in (3, 12) else H_MD)
                            elif is_reading:
                                if y in (18, 19) and (x in (3, 4, 11, 12)):
                                    frame_img.putpixel((x, y), P_SC if x in (4, 11) else H_HI)

                    elif y >= 25:
                        if y <= 28:
                            if x in (4, 5, 6):
                                frame_img.putpixel((x, y), H_LT if dir_name != 'up' else H_MD)
                            elif x in (9, 10, 11):
                                frame_img.putpixel((x, y), H_MD if dir_name != 'up' else H_DK)
                            else:
                                frame_img.putpixel((x, y), C_DK)
                        else:
                            if y == 30:
                                frame_img.putpixel((x, y), C_LT if (x in (5, 6, 9, 10)) else C_DK)
                            else:
                                frame_img.putpixel((x, y), H_DK if x in (4, 11) else C_MD)

            img.paste(frame_img, (col_x, row_y), frame_img)

    return img

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
    out_dir = 'webview-ui/public/assets/themes/ductor-space-lab'
    os.makedirs(out_dir, exist_ok=True)

    json_data = {}

    for char_key in ['alec', 'kevin', 'benjamin']:
        sprite = generate_crew_sprite(char_key)
        
        out_path = os.path.join(out_dir, f'crew-{char_key}.png')
        sprite.save(out_path, format='PNG')
        print(f'✓ Generated {out_path} ({sprite.size[0]}x{sprite.size[1]})')

        json_data[char_key] = decode_image_to_sprite_data(sprite)

    # Save decoded JSON
    json_path = 'webview-ui/src/office/sprites/ductorCrewSprites.json'
    with open(json_path, 'w') as f:
        json.dump(json_data, f, indent=2)
    print(f'✓ Saved decoded crew sprites to {json_path}')

if __name__ == '__main__':
    main()
