#!/usr/bin/env python3
"""Extract two intact Alec interaction poses from the original crew reference.

Uses the same background cleanup as generate-ductor-crew-sprites.py, preserving
the original 80px-wide artwork instead of resizing it into the 16x32 office grid.
Source: crew-sprites.webp, Alec's first row (488:598), columns 5 and 6.
Output: two 80x112 frames; both frames retain the original cell alignment.
"""
from pathlib import Path
import runpy
from PIL import Image


def main():
    root = Path(__file__).resolve().parents[1]
    assets = root / "webview-ui/public/assets/themes/ductor-space-lab"
    builder = runpy.run_path(str(root / "scripts/generate-ductor-crew-sprites.py"))
    source = Image.open(assets / "crew-sprites.webp")
    sheet = Image.new("RGBA", (160, 112))
    for index, column in enumerate((5, 6)):
        cell = source.crop((column * 80, 488, (column + 1) * 80, 598))
        frame = builder["remove_background_floodfill"](cell)
        sheet.paste(frame, (index * 80, 1))
    sheet.save(assets / "alec-keyboard.png")


if __name__ == "__main__":
    main()
