from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
VIDEO_DIR = ROOT / "demo_video"
FRAMES_DIR = VIDEO_DIR / "frames"
VIDEO_PATH = VIDEO_DIR / "todays_poc_demo.mp4"

LOG_FILES = [
    ROOT / "academic_notices" / "output" / "academic_notices_demo_log.json",
    ROOT / "new_term_course_prep" / "output" / "new_term_course_prep_demo_log.json",
]

WIDTH = 1280
HEIGHT = 720
BG = "#0b1220"
PANEL = "#111827"
TEXT = "#e5e7eb"
ACCENT = "#22c55e"
MUTED = "#94a3b8"


def load_font(size: int, mono: bool = False):
    candidates = []
    if mono:
      candidates = [
          "/System/Library/Fonts/SFNSMono.ttf",
          "/System/Library/Fonts/Menlo.ttc",
          "/Library/Fonts/Courier New.ttf",
      ]
    else:
      candidates = [
          "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
          "/System/Library/Fonts/SFNS.ttf",
          "/Library/Fonts/Arial.ttf",
      ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


TITLE_FONT = load_font(42)
BODY_FONT = load_font(28)
MONO_FONT = load_font(24, mono=True)


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, width: int):
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        proposal = word if not current else f"{current} {word}"
        if draw.textlength(proposal, font=font) <= width:
            current = proposal
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def render_frame(index: int, title: str, lines: list[str], highlight_count: int):
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((40, 40, WIDTH - 40, HEIGHT - 40), radius=24, fill=PANEL)
    draw.text((80, 80), "ALLTERNIT / SUMMIT OIC", font=BODY_FONT, fill=ACCENT)
    draw.text((80, 130), title, font=TITLE_FONT, fill=TEXT)
    draw.text((80, 190), "PoC demo capture generated from live script output", font=BODY_FONT, fill=MUTED)

    y = 260
    for i, line in enumerate(lines):
        color = ACCENT if i >= max(0, len(lines) - highlight_count) else TEXT
        wrapped = wrap(draw, line, MONO_FONT, WIDTH - 180)
        for subline in wrapped:
            draw.text((90, y), subline, font=MONO_FONT, fill=color)
            y += 34
        y += 6

    image.save(FRAMES_DIR / f"frame_{index:04d}.png")


def main():
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    frame_index = 0
    for log_file in LOG_FILES:
        if not log_file.exists():
            continue
        data = json.loads(log_file.read_text())
        title = data.get("title", "PoC Demo")
        lines = data.get("lines", [])
        progressive: list[str] = []
        for line in lines:
            progressive.append(line)
            render_frame(frame_index, title, progressive[-10:], 1)
            frame_index += 1
            render_frame(frame_index, title, progressive[-10:], 1)
            frame_index += 1

    if frame_index == 0:
        raise SystemExit("No demo logs found. Run the demo scripts first.")

    cmd = [
        "/opt/homebrew/bin/ffmpeg",
        "-y",
        "-framerate",
        "1.5",
        "-i",
        str(FRAMES_DIR / "frame_%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        str(VIDEO_PATH),
    ]
    subprocess.run(cmd, check=True)
    print(f"Created demo video: {VIDEO_PATH}")


if __name__ == "__main__":
    main()
