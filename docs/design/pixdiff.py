"""Compare two screenshots from verify.py and say what moved.

    python docs/design/pixdiff.py BEFORE.png AFTER.png [--out DIFF.png] [--tolerance N]

Prints the share of pixels that differ and the box that contains them, and
exits 1 when anything differs. A refactor that must not change the rendering
is verified by capturing the same scenario before and after and comparing:
the suite says the page still behaves, this says it still looks the same.

Different image sizes are a difference in themselves, and are reported as one.
Whatever the page generates fresh on every load, such as the timestamps in a
schema example, differs between two runs of the same code and would be read
as a regression. The scenario reports those regions under a key in its log
(`--ignore-from LOG.json --ignore-key dynamic`) and they are masked out.
"""
import argparse
import json
import sys

from PIL import Image, ImageChops, ImageDraw


def masked_boxes(log_path, key, scale):
    """Regions the scenario reported as generated per load, in image pixels."""
    with open(log_path, encoding="utf-8") as log:
        boxes = json.load(log).get(key) or []
    return [(round(b["x"] * scale), round(b["y"] * scale),
             round((b["x"] + b["width"]) * scale), round((b["y"] + b["height"]) * scale))
            for b in boxes]


def compare(before_path, after_path, out_path, tolerance, ignore):
    before = Image.open(before_path).convert("RGB")
    after = Image.open(after_path).convert("RGB")
    if before.size != after.size:
        print(f"size changed: {before.size} -> {after.size}")
        return 1

    diff = ImageChops.difference(before, after).convert("L")
    if ignore:
        mask = ImageDraw.Draw(diff)
        for box in ignore:
            mask.rectangle(box, fill=0)
    if tolerance:
        diff = diff.point(lambda value: 255 if value > tolerance else 0)

    box = diff.getbbox()
    histogram = diff.histogram()
    changed = sum(histogram[1:])
    total = before.size[0] * before.size[1]
    share = 100 * changed / total

    if not changed:
        print(f"identical: {total} pixels, {before.size[0]}x{before.size[1]}")
        return 0

    print(f"{changed} of {total} pixels differ ({share:.3f}%), inside {box}")
    if out_path:
        diff.save(out_path)
        print(f"diff written to {out_path}")
    return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("before")
    parser.add_argument("after")
    parser.add_argument("--out", help="write a mask of the differing pixels here")
    parser.add_argument("--tolerance", type=int, default=0,
                        help="per-channel difference to ignore, for antialiasing noise")
    parser.add_argument("--ignore-from", help="a scenario log holding the regions to mask")
    parser.add_argument("--ignore-key", default="dynamic", help="the key holding them (default: dynamic)")
    parser.add_argument("--scale", type=float, default=2.0, help="screenshot scale (verify.py captures at 2x)")
    args = parser.parse_args()
    ignore = masked_boxes(args.ignore_from, args.ignore_key, args.scale) if args.ignore_from else []
    return compare(args.before, args.after, args.out, args.tolerance, ignore)


if __name__ == "__main__":
    sys.exit(main())
