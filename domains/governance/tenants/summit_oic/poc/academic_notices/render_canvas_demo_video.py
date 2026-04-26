from __future__ import annotations

from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
VIDEO_DIR = ROOT / "canvas_demo_video"
FRAMES_DIR = VIDEO_DIR / "frames"
VIDEO_PATH = VIDEO_DIR / "academic_notice_canvas_flow.mp4"

WIDTH = 1440
HEIGHT = 900
BG = "#f7f4ee"
INK = "#1e293b"
MUTED = "#64748b"
LINE = "#d7d2c7"
CARD = "#fffdf8"
ACCENT = "#b6461d"
GREEN = "#1f7a5c"
CANVAS = "#a92f41"


def font(size: int, mono: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    if mono:
        candidates = [
            "/System/Library/Fonts/SFNSMono.ttf",
            "/System/Library/Fonts/Menlo.ttc",
        ] + candidates
    for c in candidates:
        p = Path(c)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


TITLE = font(44)
SUB = font(22)
BODY = font(26)
MONO = font(22, mono=True)


def card(draw, x1, y1, x2, y2, title, subtitle=None, accent=None):
    draw.rounded_rectangle((x1, y1, x2, y2), radius=22, fill=CARD, outline=LINE, width=2)
    if accent:
        draw.rounded_rectangle((x1, y1, x2, y1 + 12), radius=22, fill=accent)
        draw.rectangle((x1, y1 + 12, x2, y1 + 22), fill=accent)
    draw.text((x1 + 24, y1 + 30), title, font=SUB, fill=INK)
    if subtitle:
        draw.text((x1 + 24, y1 + 68), subtitle, font=MONO, fill=MUTED)


def render_frame(index: int, step_title: str, left_lines: list[str], right_lines: list[str], footer: str):
    im = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(im)
    draw.text((60, 42), "Summit OIC / Academic Notice Canvas Flow", font=TITLE, fill=INK)
    draw.text((60, 100), step_title, font=SUB, fill=ACCENT)

    card(draw, 60, 150, 700, 760, "Canvas", "Course workflow", CANVAS)
    card(draw, 740, 150, 1380, 760, "A:// + Notice Engine", "Exact form + routing + sign", GREEN)

    y = 240
    for line in left_lines:
        draw.text((92, y), line, font=BODY, fill=INK)
        y += 42

    y = 240
    for line in right_lines:
        draw.text((772, y), line, font=BODY, fill=INK)
        y += 42

    draw.line((60, 810, 1380, 810), fill=LINE, width=2)
    draw.text((60, 830), footer, font=MONO, fill=MUTED)
    im.save(FRAMES_DIR / f"frame_{index:04d}.png")


def main():
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    scenes = [
        (
            "1. Select Canvas course and milestone week",
            [
                "Course: IT Fundamentals Phase 1",
                "Milestone: Week 3",
                "Canvas reads current grades at runtime",
                "Canvas reads missing assignments at runtime",
            ],
            [
                "Policy threshold: 70%",
                "Trigger date: 2026-08-17",
                "No manual paper prep",
            ],
            "Faculty starts from the active Canvas course rather than filling notices by hand.",
        ),
        (
            "2. Target students below threshold",
            [
                "Students evaluated: 3",
                "Maya Patel: 64.2%",
                "Luis Garcia: 72.8%",
                "Tiana Moore: 58.5%",
            ],
            [
                "Targeted students: 2",
                "Maya Patel",
                "Tiana Moore",
                "Luis Garcia not targeted",
            ],
            "The selection is deterministic: grade < 70 means generate a notice.",
        ),
        (
            "3. Fill the exact institutional PDF",
            [
                "Source form: Course Academic Status Notification",
                "Layout unchanged",
                "Only field values are populated",
            ],
            [
                "Date: 2026-08-17",
                "Student: Maya Patel",
                "Course: IT Fundamentals Phase 1",
                "Grade and attendance: 64.2%, 82%",
            ],
            "This uses the original fillable PDF template, not a rewritten substitute.",
        ),
        (
            "4. Generate supporting artifacts",
            [
                "Missing assignments attachment",
                "Student email draft",
                "Anonymized instructor summary",
            ],
            [
                "Attachment: missing assignments",
                "Routing: student + instructor + manager + advisor + registrar",
                "Instructor report excludes student names",
            ],
            "Named student data is separated from multi-student reporting.",
        ),
        (
            "5. Send hosted signature request",
            [
                "Upload exact PDF to free e-sign provider",
                "Create student signer request",
                "No student account required",
            ],
            [
                "Student receives secure link",
                "Sign on phone or laptop",
                "Webhook updates signed status",
            ],
            "For the free PoC path, use Dropbox Sign or SignWell as the hosted signing layer.",
        ),
        (
            "6. Return status to the notice queue",
            [
                "Signed status visible to staff",
                "Signed PDF retained per policy",
                "Audit metadata retained",
            ],
            [
                "No raw grade ledger retained",
                "Traceable notice lifecycle",
                "Less friction for the student",
            ],
            "This closes the loop from Canvas data to institutional notice to student acknowledgment.",
        ),
    ]

    idx = 0
    for scene in scenes:
        for _ in range(3):
            render_frame(idx, *scene)
            idx += 1

    subprocess.run([
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
    ], check=True)
    print(VIDEO_PATH)


if __name__ == "__main__":
    main()
