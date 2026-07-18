import os
import json

from PIL import Image

BIOME_COLORS = {
    "ocean": (40, 90, 200),
    "mountain": (130, 130, 130),
    "desert": (235, 205, 90),
    "plains": (170, 220, 110),
    "jungle": (25, 110, 40),
}


def main():
    with open(
        os.path.join(os.path.dirname(__file__), "worldGrid.json"), "r"
    ) as f:
        data = json.load(f)

    rows = data["info"]["rows"]
    cols = data["info"]["cols"]

    img = Image.new("RGB", (cols, rows))
    pixels = img.load()

    for row in data["grid"]:
        for tile in row:
            r, c = tile["row"], tile["col"]
            color = BIOME_COLORS.get(tile["biome"])
            pixels[c, r] = color  # type: ignore

    img.show()


if __name__ == "__main__":
    main()
