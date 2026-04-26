#!/usr/bin/env python3
"""Generate branded A://Labs course cover images for Canvas."""

import os
from PIL import Image, ImageDraw, ImageFont

COURSES = [
    {
        "code": "ALABS-CORE-COPILOT",
        "title": "Build AI-Assisted Software\nwith Copilot & Cursor",
        "tier": "CORE",
        "color": "#3b82f6",
    },
    {
        "code": "ALABS-CORE-PROMPTS",
        "title": "Prompt Engineering &\nSystematic LLM Reasoning",
        "tier": "CORE",
        "color": "#3b82f6",
    },
    {
        "code": "ALABS-OPS-N8N",
        "title": "Orchestrate Agents &\nAutomations with n8n",
        "tier": "OPS",
        "color": "#8b5cf6",
    },
    {
        "code": "ALABS-OPS-VISION",
        "title": "Computer Vision\nfor Agent Systems",
        "tier": "OPS",
        "color": "#8b5cf6",
    },
    {
        "code": "ALABS-OPS-RAG",
        "title": "Local RAG &\nDocument Intelligence",
        "tier": "OPS",
        "color": "#8b5cf6",
    },
    {
        "code": "ALABS-AGENTS-ML",
        "title": "ML Models as\nAgent Tools",
        "tier": "AGENTS",
        "color": "#ec4899",
    },
    {
        "code": "ALABS-AGENTS-AGENTS",
        "title": "Multi-Agent Systems\n& Orchestration",
        "tier": "AGENTS",
        "color": "#ec4899",
    },
    {
        "code": "ALABS-ADV-PLUGINSDK",
        "title": "Build Plugins\nfor Allternit",
        "tier": "ADV",
        "color": "#f59e0b",
    },
    {
        "code": "ALABS-ADV-WORKFLOW",
        "title": "The Allternit\nWorkflow Engine",
        "tier": "ADV",
        "color": "#f59e0b",
    },
    {
        "code": "ALABS-ADV-ADAPTERS",
        "title": "Provider Adapters\n& Unified APIs",
        "tier": "ADV",
        "color": "#f59e0b",
    },
]

OUTPUT_DIR = "alabs-course-covers"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Canvas recommends 262px height for the course card banner,
# but course images often display wider. We'll use 1200x630
# for crisp display across contexts.
WIDTH, HEIGHT = 1200, 630


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))


def draw_gradient(draw, width, height, color_rgb, darken_factor=0.35):
    """Draw a subtle top-to-bottom gradient from color to dark color."""
    dark_rgb = tuple(int(c * (1 - darken_factor)) for c in color_rgb)
    for y in range(height):
        ratio = y / height
        r = int(color_rgb[0] * (1 - ratio) + dark_rgb[0] * ratio)
        g = int(color_rgb[1] * (1 - ratio) + dark_rgb[1] * ratio)
        b = int(color_rgb[2] * (1 - ratio) + dark_rgb[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))


def get_font(name, size):
    try:
        return ImageFont.truetype(name, size)
    except Exception:
        return ImageFont.load_default()


def main():
    # Try to load nice fonts available on macOS
    font_title = get_font("/System/Library/Fonts/Helvetica.ttc", 56)
    font_brand = get_font("/System/Library/Fonts/Helvetica.ttc", 36)
    font_badge = get_font("/System/Library/Fonts/Helvetica.ttc", 22)
    font_code = get_font("/System/Library/Fonts/Helvetica.ttc", 18)

    for course in COURSES:
        img = Image.new("RGB", (WIDTH, HEIGHT), (15, 15, 20))
        draw = ImageDraw.Draw(img)

        base = hex_to_rgb(course["color"])
        draw_gradient(draw, WIDTH, HEIGHT, base, darken_factor=0.55)

        # Decorative accent shapes
        accent = (255, 255, 255, 18)
        overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        # Large soft circle top-right
        overlay_draw.ellipse(
            [(WIDTH - 400, -200), (WIDTH + 200, 400)],
            fill=(255, 255, 255, 12),
        )
        # Small accent bar left
        overlay_draw.rectangle([(0, 220), (8, 410)], fill=(255, 255, 255, 40))

        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(img)

        # Tier badge
        badge_text = course["tier"]
        badge_w = 110
        badge_h = 36
        badge_x = 70
        badge_y = 70
        draw.rounded_rectangle(
            [(badge_x, badge_y), (badge_x + badge_w, badge_y + badge_h)],
            radius=6,
            fill=(255, 255, 255),
        )
        bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        draw.text(
            (badge_x + (badge_w - text_w) / 2, badge_y + (badge_h - text_h) / 2 - 2),
            badge_text,
            fill=base,
            font=font_badge,
        )

        # A://Labs brand
        draw.text((70, 130), "A://Labs", fill=(255, 255, 255), font=font_brand)

        # Course title
        title_lines = course["title"].split("\n")
        y_offset = 220
        for line in title_lines:
            draw.text((70, y_offset), line, fill=(255, 255, 255), font=font_title)
            y_offset += 68

        # Course code (small, bottom-left)
        draw.text((70, HEIGHT - 70), course["code"], fill=(200, 200, 200), font=font_code)

        out_path = os.path.join(OUTPUT_DIR, f"{course['code']}.png")
        img.save(out_path, "PNG")
        print(f"Saved {out_path}")


if __name__ == "__main__":
    main()
