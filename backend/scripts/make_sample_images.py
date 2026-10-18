"""Generate the two synthetic sample oil photos used by "Use sample photo".

They are bundled so that, in live mode, Gemini judges a real image instead of
returning a canned result:
  hazy_oil.jpg   oil sample bottle against a light, milky and cloudy (free water)
  clear_oil.jpg  the same bottle with clear and bright amber oil (control)

Writes to backend/data/samples/ and frontend/public/samples/.
Run: python -I backend/scripts/make_sample_images.py
"""
from __future__ import annotations

import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT_DIRS = [os.path.join(ROOT, "backend", "data", "samples"), os.path.join(ROOT, "frontend", "public", "samples")]
W, H = 900, 1200


def background() -> Image.Image:
    """Bright window light behind the bottle, falling off to a grey workshop wall."""
    img = Image.new("RGB", (W, H), (70, 72, 76))
    glow = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(glow)
    d.ellipse([W * 0.1, H * 0.05, W * 0.9, H * 0.85], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    light = Image.new("RGB", (W, H), (236, 238, 240))
    return Image.composite(light, img, glow)


def bottle_mask() -> Image.Image:
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([W * 0.30, H * 0.30, W * 0.70, H * 0.92], radius=60, fill=255)   # body
    d.polygon([(W * 0.30, H * 0.33), (W * 0.42, H * 0.20), (W * 0.58, H * 0.20), (W * 0.70, H * 0.33)], fill=255)  # shoulder
    d.rectangle([W * 0.43, H * 0.13, W * 0.57, H * 0.21], fill=255)  # neck
    return m.filter(ImageFilter.GaussianBlur(1.5))


def make(kind: str, seed: int) -> Image.Image:
    rnd = random.Random(seed)
    img = background()
    mask = bottle_mask()
    fill_top = int(H * 0.40)

    # empty part of the bottle: slightly darker clear plastic
    plastic = Image.new("RGB", (W, H), (210, 214, 218))
    img = Image.composite(Image.blend(img, plastic, 0.25), img, mask)

    liquid_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(liquid_mask).rectangle([0, fill_top, W, H], fill=255)
    liquid_mask = Image.fromarray(__import__("numpy").minimum(
        __import__("numpy").array(liquid_mask), __import__("numpy").array(mask)))

    if kind == "clear":
        # clear and bright amber: transmits the light, background stays visible
        tint = Image.new("RGB", (W, H), (214, 150, 40))
        liquid = Image.blend(img, tint, 0.55)
        hl = Image.new("L", (W, H), 0)
        ImageDraw.Draw(hl).rectangle([W * 0.36, fill_top + 30, W * 0.40, H * 0.88], fill=150)
        hl = hl.filter(ImageFilter.GaussianBlur(12))
        liquid = Image.composite(Image.new("RGB", (W, H), (255, 236, 180)), liquid, hl)
    else:
        # milky, cloudy emulsion: opaque, pale tan, no background visible, fine bubbles
        base = Image.new("RGB", (W, H), (205, 188, 150))
        liquid = Image.blend(img, base, 0.88)
        haze = Image.effect_noise((W, H), 28).convert("L").filter(ImageFilter.GaussianBlur(6))
        liquid = Image.composite(Image.new("RGB", (W, H), (226, 214, 186)), liquid, haze.point(lambda v: int(v * 0.45)))
        dots = ImageDraw.Draw(liquid)
        for _ in range(900):
            x = rnd.uniform(W * 0.32, W * 0.68)
            y = rnd.uniform(fill_top + 10, H * 0.90)
            r = rnd.uniform(0.8, 2.6)
            c = rnd.randint(228, 245)
            dots.ellipse([x - r, y - r, x + r, y + r], fill=(c, c - 6, c - 20))
        liquid = liquid.filter(ImageFilter.GaussianBlur(1.2))
    img = Image.composite(liquid, img, liquid_mask)

    d = ImageDraw.Draw(img)
    # meniscus line and bottle outline
    d.line([(W * 0.31, fill_top), (W * 0.69, fill_top)], fill=(120, 110, 90) if kind == "hazy" else (150, 100, 30), width=4)
    edge = mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    img = Image.composite(Image.new("RGB", (W, H), (150, 154, 160)), img, edge.point(lambda v: 140 if v > 40 else 0))
    # white cap
    d.rounded_rectangle([W * 0.42, H * 0.08, W * 0.58, H * 0.14], radius=10, fill=(235, 235, 235), outline=(170, 170, 170), width=3)
    # glove-coloured hand hint at the bottom
    d.rounded_rectangle([W * 0.18, H * 0.86, W * 0.82, H * 1.05], radius=80, fill=(60, 90, 140))
    # honest label in the corner
    d.text((18, H - 30), "Synthetic sample image", fill=(200, 200, 200))
    return img.filter(ImageFilter.GaussianBlur(0.6))


def main() -> None:
    for out in OUT_DIRS:
        os.makedirs(out, exist_ok=True)
        make("hazy", 7).save(os.path.join(out, "hazy_oil.jpg"), quality=88)
        make("clear", 11).save(os.path.join(out, "clear_oil.jpg"), quality=88)
        print("wrote", out)


if __name__ == "__main__":
    main()
