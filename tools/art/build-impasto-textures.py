#!/usr/bin/env python3
"""Build compact Katelya impasto textures from a dense SVG brush sample.

The source SVG is used only offline. Its rasterized stroke structure feeds a
structure-tensor direction field; output colours and composition are original
Katelya day/night palettes rather than a reproduction of the source painting.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from xml.etree import ElementTree as ET

import cairosvg
import cv2
import numpy as np
from PIL import Image

GENERATOR = "katelya-impasto-v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    return parser.parse_args()


def source_metadata(path: Path) -> tuple[str, int, tuple[float, float]]:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    path_count = 0
    width = height = 0.0
    for _event, element in ET.iterparse(path, events=("start",)):
        tag = element.tag.rsplit("}", 1)[-1]
        if tag == "svg":
            view_box = element.attrib.get("viewBox", "0 0 1010 800").split()
            if len(view_box) == 4:
                width, height = float(view_box[2]), float(view_box[3])
        elif tag == "path":
            path_count += 1
        element.clear()
    return digest, path_count, (width, height)


def render_source(svg_path: Path, width: int, height: int) -> np.ndarray:
    source_ratio = 1010 / 800
    target_ratio = width / height
    if source_ratio < target_ratio:
        render_w = width
        render_h = int(round(width / source_ratio))
    else:
        render_h = height
        render_w = int(round(height * source_ratio))
    png = cairosvg.svg2png(
        url=str(svg_path),
        output_width=render_w,
        output_height=render_h,
    )
    image = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_COLOR)
    y0 = max(0, (image.shape[0] - height) // 2)
    x0 = max(0, (image.shape[1] - width) // 2)
    return image[y0 : y0 + height, x0 : x0 + width]


def smooth01(array: np.ndarray, sigma: float) -> np.ndarray:
    blurred = cv2.GaussianBlur(array.astype(np.float32), (0, 0), sigma)
    mn, mx = float(blurred.min()), float(blurred.max())
    return (blurred - mn) / max(mx - mn, 1e-6)


def structure_tensor(bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    gx = cv2.Scharr(gray, cv2.CV_32F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_32F, 0, 1)
    jxx = cv2.GaussianBlur(gx * gx, (0, 0), 3.2)
    jyy = cv2.GaussianBlur(gy * gy, (0, 0), 3.2)
    jxy = cv2.GaussianBlur(gx * gy, (0, 0), 3.2)
    angle = 0.5 * np.arctan2(2.0 * jxy, jxx - jyy) + math.pi / 2.0
    coherence = np.sqrt((jxx - jyy) ** 2 + 4.0 * jxy * jxy) / (
        jxx + jyy + 1e-6
    )
    energy = smooth01(np.sqrt(jxx + jyy), 1.2)
    return angle, np.clip(coherence, 0.0, 1.0), energy


def central_protection(width: int, height: int) -> np.ndarray:
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    nx = (x - width * 0.5) / (width * 0.34)
    ny = (y - height * 0.43) / (height * 0.26)
    return np.clip(np.exp(-(nx * nx + ny * ny) * 1.65), 0.0, 1.0)


def palette_map(
    angle: np.ndarray,
    coherence: np.ndarray,
    energy: np.ndarray,
    protection: np.ndarray,
    dark: bool,
) -> np.ndarray:
    h, w = angle.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = x / w, y / h
    wave = 0.5 + 0.5 * np.sin(angle * 2.0 + nx * 4.4 - ny * 2.2)
    broad = smooth01(0.55 * energy + 0.45 * wave, 8.0)
    if dark:
        stops = np.array(
            [[5, 18, 52], [15, 48, 91], [23, 77, 112], [43, 111, 128], [239, 191, 74]],
            dtype=np.float32,
        )
        gold = np.clip((energy - 0.72) * 3.8, 0, 1) * np.clip(coherence, 0.25, 1)
        t = np.clip(0.10 + 0.62 * broad + 0.18 * wave, 0, 0.82)
    else:
        stops = np.array(
            [[31, 82, 86], [61, 126, 122], [114, 177, 166], [210, 232, 219], [246, 239, 205]],
            dtype=np.float32,
        )
        gold = np.clip((energy - 0.82) * 4.8, 0, 1) * coherence * 0.38
        t = np.clip(0.18 + 0.72 * broad, 0, 0.92)

    scaled = t * (len(stops) - 2)
    index = np.floor(scaled).astype(np.int32)
    frac = (scaled - index)[..., None]
    base = stops[index] * (1.0 - frac) + stops[index + 1] * frac
    base = base * (1.0 - gold[..., None]) + stops[-1] * gold[..., None]

    violet = np.array([100, 75, 154] if not dark else [81, 73, 164], np.float32)
    edge_mask = np.clip((np.abs(nx - 0.5) - 0.22) * 2.8, 0, 1)
    violet_mask = (
        edge_mask
        * np.clip(np.sin(angle * 3.0 + ny * 7.0), 0, 1)
        * coherence
        * 0.18
    )
    base = base * (1.0 - violet_mask[..., None]) + violet * violet_mask[..., None]

    calm = protection[..., None] * (0.42 if not dark else 0.32)
    calm_colour = np.array([221, 235, 225] if not dark else [20, 49, 76], np.float32)
    base = base * (1.0 - calm) + calm_colour * calm
    return np.clip(base[..., ::-1], 0, 255).astype(np.uint8)


def make_maps(
    angle: np.ndarray,
    coherence: np.ndarray,
    energy: np.ndarray,
    protection: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    flow = np.dstack(
        [
            (np.cos(angle) * 0.5 + 0.5) * 255,
            (np.sin(angle) * 0.5 + 0.5) * 255,
            coherence * 255,
        ]
    ).astype(np.uint8)

    height = smooth01(0.72 * energy + 0.28 * coherence, 1.6)
    height *= 1.0 - protection * 0.26
    dx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3)
    dy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3)
    normal = np.dstack([-dx * 2.6, -dy * 2.6, np.ones_like(height)])
    normal /= np.linalg.norm(normal, axis=2, keepdims=True) + 1e-6
    normal = ((normal * 0.5 + 0.5) * 255).astype(np.uint8)

    roughness = 0.42 + 0.38 * (1.0 - coherence) + 0.18 * (1.0 - energy)
    roughness += protection * 0.08
    return flow, normal, (np.clip(roughness, 0, 1) * 255).astype(np.uint8)


def canvas_fibre(h: int, w: int, seed: int = 77) -> np.ndarray:
    rng = np.random.default_rng(seed)
    fine = rng.normal(0, 1, (h, w)).astype(np.float32)
    horizontal = cv2.GaussianBlur(fine, (0, 0), 5.0, sigmaY=0.45)
    vertical = cv2.GaussianBlur(fine, (0, 0), 0.45, sigmaY=5.0)
    return smooth01(horizontal + vertical, 0.35) - 0.5


def fallback(
    albedo: np.ndarray,
    normal: np.ndarray,
    roughness: np.ndarray,
    dark: bool,
) -> np.ndarray:
    n = normal.astype(np.float32) / 255.0 * 2.0 - 1.0
    light = np.array([-0.34, -0.28, 0.90], np.float32)
    light /= np.linalg.norm(light)
    diffuse = np.clip((n * light).sum(axis=2), 0, 1)
    spec = np.power(np.clip(n[..., 2] * 0.76 + diffuse * 0.24, 0, 1), 18)
    rough = roughness.astype(np.float32) / 255.0
    colour = albedo.astype(np.float32) / 255.0
    colour *= 0.80 + diffuse[..., None] * (0.28 if dark else 0.24)
    highlight_rgb = [1.0, 0.80, 0.38] if dark else [1.0, 0.94, 0.72]
    highlight = np.array(highlight_rgb[::-1], np.float32)
    colour += highlight * (spec * (1.0 - rough) * 0.18)[..., None]
    colour += canvas_fibre(*rough.shape)[..., None] * 0.035
    return np.clip(colour * 255, 0, 255).astype(np.uint8)


def save_webp(path: Path, array: np.ndarray, quality: int) -> None:
    Image.fromarray(cv2.cvtColor(array, cv2.COLOR_BGR2RGB)).save(
        path, "WEBP", quality=quality, method=6
    )


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    digest, path_count, viewbox = source_metadata(args.input)
    source = render_source(args.input, args.width, args.height)
    angle, coherence, energy = structure_tensor(source)
    protection = central_protection(args.width, args.height)

    day = palette_map(angle, coherence, energy, protection, dark=False)
    night = palette_map(angle, coherence, energy, protection, dark=True)
    flow, normal, roughness = make_maps(angle, coherence, energy, protection)
    day_fb = fallback(day, normal, roughness, dark=False)
    night_fb = fallback(night, normal, roughness, dark=True)

    save_webp(args.output / "impasto-day-albedo.webp", day, 82)
    save_webp(args.output / "impasto-night-albedo.webp", night, 82)
    map_size = (max(640, args.width // 2), max(360, args.height // 2))
    flow_small = cv2.resize(flow, map_size, interpolation=cv2.INTER_AREA)
    normal_small = cv2.resize(normal, map_size, interpolation=cv2.INTER_AREA)
    cv2.imwrite(
        str(args.output / "impasto-flow.png"),
        flow_small,
        [cv2.IMWRITE_PNG_COMPRESSION, 9],
    )
    cv2.imwrite(
        str(args.output / "impasto-normal.png"),
        normal_small,
        [cv2.IMWRITE_PNG_COMPRESSION, 9],
    )
    Image.fromarray(roughness).save(
        args.output / "impasto-roughness.webp", "WEBP", quality=80, method=6
    )
    save_webp(args.output / "impasto-day-fallback.webp", day_fb, 84)
    save_webp(args.output / "impasto-night-fallback.webp", night_fb, 84)

    files: dict[str, int] = {}
    total = 0
    for path in sorted(args.output.iterdir()):
        if path.name == "impasto-metadata.json":
            continue
        size = path.stat().st_size
        files[path.name] = size
        total += size
    metadata = {
        "generator": GENERATOR,
        "sourceSha256": digest,
        "sourcePathCount": path_count,
        "sourceViewBox": list(viewbox),
        "width": args.width,
        "height": args.height,
        "paletteVersion": "katelya-day-night-2",
        "files": files,
        "totalBytes": total,
    }
    (args.output / "impasto-metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if total > 2_500_000:
        raise SystemExit(f"asset budget exceeded: {total} bytes")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
