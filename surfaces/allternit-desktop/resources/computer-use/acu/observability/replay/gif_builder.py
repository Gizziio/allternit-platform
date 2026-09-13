"""
GIF replay builder using PIL

Creates animated GIFs from screenshot sequences.
Optimized for file size and compatibility.
"""

from io import BytesIO
from pathlib import Path
from typing import Optional

from .builder import ReplayBuilder, ReplayConfig, ReplayFormat


class GIFBuilder(ReplayBuilder):
    """Builds animated GIF from screenshot frames."""
    
    def __init__(self, config: ReplayConfig):
        super().__init__(config)
        self._pil_available = self._check_pil()
    
    def _check_pil(self) -> bool:
        """Check if PIL is available."""
        try:
            from PIL import Image
            return True
        except ImportError:
            return False
    
    def supported_formats(self) -> list[ReplayFormat]:
        return [ReplayFormat.GIF]
    
    async def build(
        self,
        frame_paths: list[tuple[int, str]],  # (step_index, path)
        output_path: str,
        labels: Optional[list[str]] = None,
    ) -> str:
        """
        Build animated GIF from frames.
        
        Args:
            frame_paths: Ordered list of (step_index, screenshot_path)
            output_path: Where to save the GIF
            labels: Optional labels for each frame
        
        Returns:
            Path to generated GIF
        """
        if not self._pil_available:
            raise RuntimeError("PIL (Pillow) is required for GIF building. Install: pip install Pillow")
        
        from PIL import Image, ImageDraw, ImageFont
        
        if not frame_paths:
            raise ValueError("No frames provided for GIF")
        
        # Load and process frames
        frames = []
        durations = []
        
        # Duration per frame in milliseconds
        frame_duration = int(1000 / self.config.gif_fps)
        
        for i, (step, path) in enumerate(frame_paths):
            if not Path(path).exists():
                continue
            
            # Load image
            img = Image.open(path)
            
            # Convert to RGB if necessary (for consistency)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Resize if too large
            max_dim = self.config.max_dimension
            if img.width > max_dim or img.height > max_dim:
                ratio = min(max_dim / img.width, max_dim / img.height)
                new_size = (int(img.width * ratio), int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            
            # Add label if requested and we have labels
            if labels and i < len(labels):
                img = self._add_label(img, labels[i])
            
            frames.append(img)
            
            # First and last frames get longer duration for visibility
            if i == 0 or i == len(frame_paths) - 1:
                durations.append(frame_duration * 2)
            else:
                durations.append(frame_duration)
        
        if not frames:
            raise ValueError("No valid frames loaded for GIF")
        
        # Save as animated GIF
        output = BytesIO()
        
        frames[0].save(
            output,
            format='GIF',
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=self.config.gif_loop,
            optimize=self.config.gif_optimize,
        )
        
        # Write to file
        with open(output_path, 'wb') as f:
            f.write(output.getvalue())
        
        # Clean up
        for frame in frames:
            frame.close()
        
        return output_path
    
    def _add_label(self, img, label: str) -> 'Image':
        """Add step label to bottom of image."""
        from PIL import ImageDraw, ImageFont
        
        # Create a copy to draw on
        img = img.copy()
        draw = ImageDraw.Draw(img)
        
        # Try to load a font, fall back to default
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
        except:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
            except:
                font = ImageFont.load_default()
        
        # Calculate text size
        bbox = draw.textbbox((0, 0), label, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Draw background bar
        bar_height = text_height + 10
        draw.rectangle(
            [(0, img.height - bar_height), (img.width, img.height)],
            fill=(0, 0, 0, 180)
        )
        
        # Draw text
        text_x = (img.width - text_width) // 2
        text_y = img.height - bar_height + 5
        draw.text((text_x, text_y), label, fill=(255, 255, 255), font=font)
        
        return img


class ContactSheetBuilder(ReplayBuilder):
    """Builds contact sheet (grid of screenshots)."""
    
    def __init__(self, config: ReplayConfig):
        super().__init__(config)
        self._pil_available = self._check_pil()
    
    def _check_pil(self) -> bool:
        try:
            from PIL import Image
            return True
        except ImportError:
            return False
    
    def supported_formats(self) -> list[ReplayFormat]:
        return [ReplayFormat.CONTACT_SHEET]
    
    async def build(
        self,
        frame_paths: list[tuple[int, str]],
        output_path: str,
        labels: Optional[list[str]] = None,
    ) -> str:
        """Build contact sheet grid."""
        if not self._pil_available:
            raise RuntimeError("PIL (Pillow) is required")
        
        from PIL import Image, ImageDraw, ImageFont
        
        if not frame_paths:
            raise ValueError("No frames provided")
        
        cols = self.config.contact_sheet_cols
        rows = (len(frame_paths) + cols - 1) // cols
        
        # Load first frame to get dimensions
        first_img = Image.open(frame_paths[0][1])
        thumb_width = self.config.contact_sheet_width // cols
        thumb_height = int(thumb_width * first_img.height / first_img.width)
        
        # Create canvas
        sheet_width = thumb_width * cols
        sheet_height = thumb_height * rows
        contact_sheet = Image.new('RGB', (sheet_width, sheet_height), (255, 255, 255))
        
        # Load font for labels
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
        except:
            font = ImageFont.load_default()
        
        # Place thumbnails
        for i, (step, path) in enumerate(frame_paths):
            if not Path(path).exists():
                continue
            
            img = Image.open(path)
            img = img.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            
            col = i % cols
            row = i // cols
            x = col * thumb_width
            y = row * thumb_height
            
            contact_sheet.paste(img, (x, y))
            
            # Add label
            if self.config.contact_sheet_label and labels and i < len(labels):
                draw = ImageDraw.Draw(contact_sheet)
                label = labels[i]
                draw.rectangle(
                    [(x, y + thumb_height - 20), (x + thumb_width, y + thumb_height)],
                    fill=(0, 0, 0, 128)
                )
                draw.text((x + 5, y + thumb_height - 18), label, fill=(255, 255, 255), font=font)
            
            img.close()
        
        first_img.close()
        
        # Save
        contact_sheet.save(output_path, 'PNG')
        contact_sheet.close()
        
        return output_path
