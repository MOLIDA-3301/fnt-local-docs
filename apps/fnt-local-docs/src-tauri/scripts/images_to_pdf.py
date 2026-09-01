import argparse
import json
import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination")
    parser.add_argument("--source", action="append", default=[])
    args = parser.parse_args()
    if args.destination:
        sources = [Path(value) for value in args.source]
        destination = Path(args.destination)
    else:
        request = json.loads(sys.stdin.read())
        sources = [Path(value) for value in request["sources"]]
        destination = Path(request["destination"])
    if not sources:
        raise ValueError("至少需要一张图片")

    images = []
    total_pixels = 0
    try:
        for source in sources:
            with Image.open(source) as opened:
                width, height = opened.size
                pixels = width * height
                if pixels > 50_000_000 or width > 16384 or height > 16384:
                    raise ValueError(f"图片超出限制：{source.name}（最大 50MP / 16384px）")
                total_pixels += pixels
                if total_pixels > 100_000_000:
                    raise ValueError("图片合并任务总计超过 100MP")
                image = opened.convert("RGB")
                images.append(image.copy())
        destination.parent.mkdir(parents=True, exist_ok=True)
        images[0].save(destination, "PDF", save_all=True, append_images=images[1:], resolution=150)
    finally:
        for image in images:
            image.close()


if __name__ == "__main__":
    main()
