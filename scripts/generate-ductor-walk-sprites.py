#!/usr/bin/env python3
"""Extract a clean four-frame walk cycle for each Ductor crew skin.

The source sheet already contains complete alternating-leg side poses. This
keeps those authored silhouettes intact and only removes the reference grid
background; no limbs are rotated, cropped, or redrawn.
"""

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "webview-ui/public/assets/themes/ductor-space-lab/crew-sprites.webp"
OUTPUT = ROOT / "webview-ui/public/assets/themes/ductor-space-lab/crew-walk.png"


def is_background(pixel):
    r, g, b, _ = pixel
    return (r > 135 and g > 135 and b > 125 and max(r, g, b) - min(r, g, b) < 32) or (
        r > 225 and g > 225 and b > 225
    )


def remove_background(cell):
    cell = cell.convert("RGBA")
    width, height = cell.size
    seen = set()
    queue = deque()
    for x in range(width):
        for y in (0, height - 1):
            if is_background(cell.getpixel((x, y))):
                seen.add((x, y))
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if (x, y) not in seen and is_background(cell.getpixel((x, y))):
                seen.add((x, y))
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
                if is_background(cell.getpixel((nx, ny))):
                    seen.add((nx, ny))
                    queue.append((nx, ny))
    output = Image.new("RGBA", cell.size, (0, 0, 0, 0))
    for y in range(height):
        for x in range(width):
            if (x, y) not in seen:
                output.putpixel((x, y), cell.getpixel((x, y)))
    return output


def main():
    source = Image.open(SOURCE).convert("RGBA")
    # Each role gets three complete four-frame cycles: side, front, and back.
    # The lower rows contain the authored alternating-leg poses for all three.
    row_ranges = [(124, 236), (366, 478), (608, 718)]  # Benjamin, Kevin, Alec
    output = Image.new("RGBA", (960, 336), (0, 0, 0, 0))
    for role_row, (top, bottom) in enumerate(row_ranges):
        for frame, column in enumerate((2, 3, 4, 5)):
            cell = source.crop((column * 80, top, (column + 1) * 80, bottom))
            output.paste(remove_background(cell), (frame * 80, role_row * 112))
        for frame, column in enumerate((0, 1, 2, 3)):
            cell = source.crop((column * 80, top, (column + 1) * 80, bottom))
            output.paste(remove_background(cell), ((frame + 4) * 80, role_row * 112))
        for frame, column in enumerate((8, 9, 10, 11)):
            cell = source.crop((column * 80, top, (column + 1) * 80, bottom))
            output.paste(remove_background(cell), ((frame + 8) * 80, role_row * 112))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    output.save(OUTPUT)
    print(f"Generated {OUTPUT} ({output.width}x{output.height})")


if __name__ == "__main__":
    main()
