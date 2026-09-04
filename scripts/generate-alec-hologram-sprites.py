#!/usr/bin/env python3
"""Extract intact purple rear-view crew poses for Alec's hologram controller.

Source: crew-sprites.webp, second row (124:236), columns 9 and 10.
These are genuine rear views; the previous side-facing interaction poses cannot
be made into rear views by mirroring. No limb transforms or resizing are used.
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
    for index, column in enumerate((9, 10)):
        cell = source.crop((column * 80, 124, (column + 1) * 80, 236))
        sheet.paste(builder["remove_background_floodfill"](cell), (index * 80, 0))
    sheet.save(assets / "alec-hologram.png")


if __name__ == "__main__":
    main()
