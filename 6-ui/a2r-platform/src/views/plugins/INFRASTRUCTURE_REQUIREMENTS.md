# A2R Plugin Ecosystem - Infrastructure Requirements

> **Document Version:** 1.0  
> **Last Updated:** March 7, 2026  
> **Status:** Planning Phase  
> **Related Files:** `PluginManager.tsx`, `marketplaceApi.ts`

---

## Overview

This document outlines the infrastructure requirements for the A2R plugin ecosystem URLs that are currently used as placeholders in the Plugin Manager UI. These URLs represent future services that need to be built to support a complete plugin publishing and discovery experience.

---

## Infrastructure Components

### 1. Developer Portal (`https://dev.a2r.dev`)

**Purpose:** Main developer documentation and resources hub for plugin creators.

#### Required Pages
| Path | Description | Priority |
|------|-------------|----------|
| `/` | Landing page with quick start guide | High |
| `/docs` | Comprehensive plugin development documentation | High |
| `/api` | API reference for plugin runtime | High |
| `/templates` | Template browser and download | Medium |
| `/publish-guide` | Step-by-step publishing instructions | High |
| `/sdk` | SDK download and installation | Medium |
| `/examples` | Example plugins with source code | Medium |

#### Features Needed

**MVP:**
- Static documentation site (can use GitHub Pages initially)
- Markdown-based docs with search
- Plugin manifest schema documentation
- Quick start tutorial

**Nice-to-Have:**
- Interactive API explorer (Swagger/OpenAPI UI)
- Template browser with live preview
- Plugin validator web tool
- Developer dashboard (auth required)
- Usage analytics for published plugins

#### Setup Requirements
```
Domain: dev.a2r.dev
Hosting: Vercel/Netlify (static) or AWS/GCP (dynamic)
CDN: CloudFlare (recommended)
SSL: Let's Encrypt or CloudFlare

Tech Stack Options:
- Static: Docusaurus, Nextra, or MkDocs
- Dynamic: Next.js + CMS (Contentful/Sanity)
```

#### Dependencies
- docs.a2r.dev (for overlapping content)
- GitHub OAuth (for developer dashboard)

#### Current Workaround
Link to GitHub README and inline documentation in PluginManager forms.

#### Effort Estimate
- **Static MVP:** 1-2 days (using Docusaurus template)
- **Full Implementation:** 2-3 weeks

---

### 2. Plugin Marketplace Web (`https://marketplace.a2r.dev`)

**Purpose:** Web-facing plugin discovery and browsing for end users.

#### Required Pages
| Path | Description | Priority |
|------|-------------|----------|
| `/browse` | Main plugin listing with search/filter | High |
| `/plugins/{id}` | Individual plugin detail page | High |
| `/publish` | Plugin submission form | Medium |
| `/categories/{slug}` | Category-browse pages | Medium |
| `/search` | Search results page | High |
| `/author/{username}` | Author profile pages | Low |

#### Features Needed

**MVP:**
- Plugin catalog with search and category filters
- Plugin detail pages (description, version, author, install button)
- "Open in A2R" deep-link buttons
- Basic rating/review display

**Nice-to-Have:**
- User authentication and favorites
- In-browser plugin preview
- Version history and changelogs
- Author analytics dashboard
- Featured/c promoted plugins
- Review and rating system

#### Setup Requirements
```
Domain: marketplace.a2r.dev
Hosting: Vercel/Netlify (frontend) + API backend
Database: PostgreSQL (plugins metadata) + Redis (caching)
CDN: CloudFlare
Storage: S3/R2 (plugin assets, icons)

Tech Stack:
- Frontend: Next.js (App Router) or Remix
- API: Node.js/Express or Python/FastAPI
- Search: Algolia or Meilisearch
- Auth: Auth0/Clerk or custom JWT
```

#### Dependencies
- dev.a2r.dev (documentation links)
- docs.a2r.dev (API reference)
- GitHub API (for plugin source validation)

#### Current Workaround
PluginManager's "Browse" overlay with curated GitHub sources and personal marketplace URLs.

#### Effort Estimate
- **MVP (read-only catalog):** 1-2 weeks
- **Full Implementation (with auth/publish):** 4-6 weeks

---

### 3. Documentation Site (`https://docs.a2r.dev`)

**Purpose:** Technical documentation for plugin development, API reference, and validation tools.

#### Required Pages
| Path | Description | Priority |
|------|-------------|----------|
| `/plugins/publish` | Publishing guide and requirements | High |
| `/plugins/validate` | Online manifest validator tool | Medium |
| `/api-reference` | Runtime API documentation | Medium |
| `/manifest-schema` | plugin.json schema reference | High |
| `/connectors` | Connector development guide | High |
| `/skills` | Skill development best practices | Medium |
| `/cli-tools` | CLI tool integration guide | Low |

#### Features Needed

**MVP:**
- Static documentation with versioned content
- Plugin manifest schema documentation
- Publishing checklist
- Search functionality

**Nice-to-Have:**
- **Online Validator Tool:** Paste plugin.json → get validation results
- Interactive code examples
- Multi-version documentation
- Community contributions (edit on GitHub)

#### Setup Requirements
```
Domain: docs.a2r.dev
Hosting: GitHub Pages (free, automatic deployments)
       or Vercel/Netlify

Tech Stack:
- Docusaurus (recommended - versioning built-in)
- Nextra (if using Next.js ecosystem)
- GitBook (hosted option, less control)
```

#### Dependencies
- None (can be deployed independently)

#### Current Workaround
GitHub README files and inline help text in PluginManager UI.

#### Effort Estimate
- **GitHub Pages MVP:** 1 day
- **Custom domain + styling:** 2-3 days

---

### 4. GitHub Template Repository (`github.com/a2rchitect/plugin-template`)

**Purpose:** Template repository for scaffolding new plugins with proper structure.

#### Required Files
```
plugin-template/
├── README.md                    # Template usage instructions
├── LICENSE                      # MIT/Apache-2.0 license
├── plugin.json                  # Manifest template with placeholders
├── marketplace.json             # Marketplace metadata template
├── src/
│   └── index.ts                 # Example entry point
├── .github/
│   └── workflows/
│       └── validate.yml         # CI workflow for manifest validation
├── .gitignore                   # Standard Node/git ignores
└── package.json                 # Dependencies and scripts
```

#### Features Needed

**MVP:**
- Working "Use this template" GitHub button
- Basic plugin.json template with field descriptions
- README with setup instructions
- LICENSE file (MIT recommended)

**Nice-to-Have:**
- GitHub Actions workflow for validation
- Multiple template variants (skill, connector, webhook)
- CLI tool for template initialization
- Automated testing boilerplate

#### Setup Requirements
```
Platform: GitHub
Repository: a2rchitect/plugin-template
Visibility: Public
Settings: Enable "Template repository" checkbox
```

#### Dependencies
- None (independent GitHub repo)

#### Current Workaround
PluginManager's "Create" flow generates basic plugin structure, but users manually create files.

#### Effort Estimate
- **Basic template:** 2-4 hours
- **Multiple variants + CI:** 1-2 days

---

### 5. Discord Community Server (`discord.gg/a2rchitect`)

**Purpose:** Community support channel for plugin developers and users.

#### Required Channels
| Channel | Purpose | Priority |
|---------|---------|----------|
| `#welcome` | Rules and getting started | High |
| `#general` | General discussion | High |
| `#plugins` | Plugin development help | High |
| `#help` | Technical support | High |
| `#showcase` | Plugin announcements | Medium |
| `#bug-reports` | Issue triage | Medium |
| `#feature-requests` | Product feedback | Low |
| `#dev-updates` | A2R team announcements | Medium |

#### Features Needed

**MVP:**
- Basic server with moderation
- Role-based access (verified plugin devs)
- Pinned messages with resources

**Nice-to-Have:**
- GitHub bot integration (issue/PR notifications)
- Auto-moderation bot (Carl-bot, MEE6)
- Ticket system for private support
- Voice channels for office hours

#### Setup Requirements
```
Platform: Discord
Invite: discord.gg/a2rchitect (custom invite)
Server Boost: Level 1 (for custom invite URL)

Roles to Create:
- @Admin
- @Moderator
- @Plugin Developer (verified)
- @Contributor
```

#### Dependencies
- None

#### Current Workaround
GitHub Issues for support, no real-time community.

#### Effort Estimate
- **Basic server:** 1-2 hours
- **Full moderation setup:** 1 day

---

## Implementation Roadmap

### Phase 1: MVP (Immediate)
1. **docs.a2r.dev** - Deploy Docusaurus to GitHub Pages
2. **GitHub Template** - Create `a2rchitect/plugin-template` repo
3. **Update PluginManager** - Point to actual docs URL

### Phase 2: Community (Month 1-2)
4. **Discord Server** - Set up and announce
5. **dev.a2r.dev** - Deploy static developer portal
6. **Validator Tool** - Add to docs site (client-side JSON validation)

### Phase 3: Marketplace (Month 2-4)
7. **marketplace.a2r.dev** - Read-only catalog
8. **API Backend** - Plugin metadata service
9. **Submission Form** - Web-based plugin publishing

---

## URL Summary Table

| URL | Service | Priority | Status | Effort |
|-----|---------|----------|--------|--------|
| `https://dev.a2r.dev` | Developer Portal | High | Planned | Medium |
| `https://marketplace.a2r.dev` | Marketplace Web | High | Planned | Medium |
| `https://docs.a2r.dev` | Documentation | Medium | Ready to Deploy | Low |
| `github.com/a2rchitect/plugin-template` | Template Repo | Medium | Ready to Create | Low |
| `discord.gg/a2rchitect` | Discord Server | Low | Planned | Low |

---

## Code References

The following locations in `PluginManager.tsx` reference these URLs:

```typescript
// Line ~3553 - Connector documentation
window.open('https://docs.a2r.dev/connectors', '_blank')

// Line ~4649 - Publish guide
window.open('https://docs.a2r.dev/plugins/publish', '_blank')

// Line ~5204 - Publish tab info box
<li><strong>Documentation site</strong> at docs.a2r.dev/plugins/publish</li>

// Line ~5384 - Quick Start Template card
🚧 Needs: GitHub repo a2rchitect/plugin-template

// Line ~5411 - Plugin Manifest Validator card  
🚧 Needs: Validator service at docs.a2r.dev

// Line ~5438 - Developer Community card
🚧 Needs: Discord server setup
```

---

## Current Workarounds in UI

Until the infrastructure is ready, the PluginManager provides these alternatives:

| Missing Feature | Current Workaround |
|-----------------|-------------------|
| Official marketplace | Personal sources (GitHub/URL) |
| Template repository | "Create" flow with generated structure |
| Validator service | JSON schema validation on load |
| Discord community | GitHub Issues |
| Developer portal | Inline documentation in forms |

---

## Questions or Updates?

This document should be updated when:
- Infrastructure is deployed
- URLs change
- New requirements are identified
- Priorities shift

Contact: Platform team / Open an issue in the main repo
