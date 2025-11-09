# Originary Trace Documentation Assets

This directory contains screenshots and demo materials for the README.

## Required Screenshots

To complete the README presentation, create the following screenshots from the live demo at [demo.trace.originary.xyz](https://demo.trace.originary.xyz):

### 1. Dashboard Screenshot (`screenshots/dashboard.png`)

**Page**: Main dashboard (/)

**What to capture**:
- Full browser window showing the dashboard
- Time-series line chart with bot vs human traffic
- Bot percentage stat cards
- Recent crawlers list
- Clean, professional crop

**Recommended size**: 1920x1080 or 2560x1440
**Format**: PNG
**Tool**: Use browser screenshot tool or [Shottr](https://shottr.cc/) (Mac)

### 2. Crawlers Screenshot (`screenshots/crawlers.png`)

**Page**: Crawlers page (/crawlers)

**What to capture**:
- Pie chart showing crawler distribution
- Table with crawler families (GPTBot, ClaudeBot, etc.)
- Request counts and percentages
- Navigation sidebar visible

**Recommended size**: 1920x1080 or 2560x1440
**Format**: PNG

### 3. Paths Screenshot (`screenshots/paths.png`)

**Page**: Paths page (/paths)

**What to capture**:
- Bar chart showing top crawled paths
- Table with path analytics
- Bot vs human breakdown per path
- Full layout

**Recommended size**: 1920x1080 or 2560x1440
**Format**: PNG

## Demo GIF (`demo.gif`)

**What to show** (10-15 seconds):
1. Landing on dashboard (2s)
2. Scroll to show charts (2s)
3. Click to Crawlers page (2s)
4. Show pie chart and table (3s)
5. Click to Paths page (2s)
6. Show bar chart (2s)

**Tools**:
- **Mac**: [Kap](https://getkap.co/) or [Gifox](https://gifox.app/)
- **Windows**: [ScreenToGif](https://www.screentogif.com/)
- **Linux**: [Peek](https://github.com/phw/peek)

**Settings**:
- FPS: 10-15 (keep file size manageable)
- Resolution: 1280x720 or 1920x1080
- Max file size: 5MB (compress if needed)
- Format: GIF
- Optimize with [ezgif.com](https://ezgif.com/optimize) if too large

## Tips for Great Screenshots

1. **Use sample data**: Make sure the demo site has realistic data (run `pnpm seed` first)
2. **Clean browser**: Hide bookmarks bar, close unnecessary tabs
3. **Consistent theme**: Use same light/dark mode across all screenshots
4. **High resolution**: Capture at 2x for retina displays
5. **Proper timing**: Ensure charts are fully loaded before capturing
6. **Professional**: Avoid browser dev tools, console, or personal info in screenshots

## Alternative: Use Figma Mockups

If the demo isn't live yet, you can create mockups in Figma:

1. Export the Next.js components as screenshots locally
2. Use Figma to arrange and polish
3. Export at 2x resolution

## Placeholder Images

Currently, the README references these placeholder paths:
- `docs/screenshots/dashboard.png`
- `docs/screenshots/crawlers.png`
- `docs/screenshots/paths.png`
- `docs/demo.gif`

Replace these files once created to automatically update the README display.

## GitHub Display

GitHub will automatically display these images in the README when the files are committed to the repository. Make sure images are optimized for web (compressed but high quality).

**PNG optimization tools**:
- [TinyPNG](https://tinypng.com/)
- [ImageOptim](https://imageoptim.com/) (Mac)
- `pngquant` or `optipng` (CLI)

**GIF optimization**:
- [ezgif.com/optimize](https://ezgif.com/optimize)
- [gifsicle](https://www.lcdf.org/gifsicle/) (CLI)

## Accessibility

Ensure screenshots have descriptive alt text in the README (already added). This helps users with screen readers understand the content.
