# A2R Developer Portal

The official developer portal for the A2R Platform. Built with Vite, React, and Tailwind CSS.

![A2R Developer Portal](https://a2r.dev/og-image.png)

## Overview

The A2R Developer Portal provides comprehensive documentation, API reference, templates, and publishing guides for developers building skills on the A2R Platform.

**Live URL:** https://dev.a2r.dev

## Features

- 📚 **Documentation** - Comprehensive guides and tutorials
- 🔌 **API Explorer** - Interactive REST and WebSocket API documentation
- 📦 **Templates** - Pre-built skill templates and boilerplates
- 🚀 **Publish Guide** - Step-by-step publishing instructions
- 🎨 **Dark Theme** - Matching A2R design system (#0a0a0a bg, #d4b08c accent)
- 📱 **Responsive** - Works on desktop, tablet, and mobile

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 5
- **Routing:** React Router DOM 6
- **Styling:** Tailwind CSS 3
- **Icons:** Lucide React
- **Font:** Inter + JetBrains Mono

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/a2r-platform/dev-portal.git
cd dev-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

The development server will start at http://localhost:5173

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## Project Structure

```
dev-portal/
├── public/               # Static assets
├── src/
│   ├── components/       # React components
│   │   └── Layout.tsx    # Main layout shell
│   ├── pages/            # Page components
│   │   ├── Home.tsx      # Landing page
│   │   ├── Docs.tsx      # Documentation
│   │   ├── ApiExplorer.tsx # API reference
│   │   ├── Templates.tsx # Template browser
│   │   └── PublishGuide.tsx # Publishing guide
│   ├── styles/
│   │   └── index.css     # Global styles + Tailwind
│   ├── App.tsx           # Main app with routing
│   └── main.tsx          # Entry point
├── index.html            # HTML entry
├── package.json          # Dependencies
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind theme
└── tsconfig.json         # TypeScript config
```

## Available Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with quick start cards |
| `/docs` | Documentation | Full documentation with sidebar nav |
| `/docs/:section` | Doc Section | Specific documentation section |
| `/api` | API Explorer | Interactive API documentation |
| `/templates` | Templates | Browse skill templates |
| `/publish` | Publish Guide | Step-by-step publishing guide |

## Design System

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--a2r-bg` | `#0a0a0a` | Page background |
| `--a2r-surface` | `#111111` | Card backgrounds |
| `--a2r-surface-elevated` | `#1a1a1a` | Elevated surfaces |
| `--a2r-border` | `#2a2a2a` | Borders and dividers |
| `--a2r-accent` | `#d4b08c` | Primary accent color |
| `--a2r-text` | `#e5e5e5` | Primary text |
| `--a2r-text-secondary` | `#a0a0a0` | Secondary text |
| `--a2r-text-muted` | `#666666` | Muted text |

### Typography

- **Primary Font:** Inter (weights: 300, 400, 500, 600, 700)
- **Monospace:** JetBrains Mono (weights: 400, 500)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### Static Hosting

The `dist` folder contains static files that can be deployed to any static hosting service:

- AWS S3 + CloudFront
- GitHub Pages
- Cloudflare Pages
- Firebase Hosting

## Environment Variables

Create a `.env` file for local development:

```env
# API Base URL (optional, defaults to production)
VITE_API_URL=https://api.a2r.dev

# Analytics (optional)
VITE_ANALYTICS_ID=your_analytics_id
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details

## Support

- 📧 Email: dev@a2r.dev
- 💬 Discord: https://discord.gg/a2r
- 🐦 Twitter: https://twitter.com/a2r

---

Built with ❤️ by the A2R Team
