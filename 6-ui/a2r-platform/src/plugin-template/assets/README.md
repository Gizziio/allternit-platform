# Assets

This directory contains static assets for your plugin.

## Required Files

### Icon (`icon.svg` or `icon.png`)

Your plugin icon should be:
- **Format**: SVG (preferred) or PNG
- **Size**: 512x512px for PNG
- **Style**: Simple, recognizable at small sizes
- **Colors**: Works on both light and dark backgrounds

Example SVG icon structure:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
</svg>
```

## Optional Files

### Hero Image (`hero.png`)

- **Size**: 1280x640px (2:1 ratio)
- **Purpose**: Featured image on marketplace detail page

### Screenshots

Name screenshots sequentially:
- `screenshot-1.png` - Main interface
- `screenshot-2.png` - Settings panel
- `screenshot-3.png` - Feature highlight

- **Size**: 1200x800px recommended
- **Format**: PNG for best quality

### Demo Video (`demo.mp4`)

- **Duration**: 30 seconds to 2 minutes
- **Format**: MP4 (H.264)
- **Resolution**: 1080p recommended

## Tips

1. **Keep file sizes reasonable** - Optimize images before committing
2. **Use descriptive names** - Make it clear what each asset shows
3. **Follow the template** - Start with placeholder files and replace them
4. **Test in both themes** - Ensure icons work in light and dark mode
