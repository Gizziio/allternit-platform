# A2rchitect Documentation

Welcome to the A2rchitect platform documentation.

## Quick Links

- [User Guide](./user-guide/README.md) - For end users
- [Developer Guide](./developer-guide/README.md) - For developers
- [Deployment Guide](./deployment/README.md) - For DevOps

## Overview

A2rchitect is an AI-powered development environment featuring:
- **Shell UI**: Multi-mode workspace with canvas, chats, browser, and more
- **Gizzi AI Assistant**: Voice-enabled AI helper with 3 interaction modes
- **Capsule System**: Modular, spawnable view components
- **UI LAW Architecture**: Enforced invariants for reliable UI behavior

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        SHELL UI                              │
│  ┌─────────┐  ┌─────────────────────────────────────────┐  │
│  │ Left    │  │         PRIMARY VIEW HOST                │  │
│  │ Rail    │  │  (Canvas | Browser | Chats | Studio)    │  │
│  │         │  └─────────────────────────────────────────┘  │
│  │         │  ┌─────────────────────────────────────────┐  │
│  │         │  │         DRAWER OVERLAYS                │  │
│  │         │  │  (Console | Inspector | Memory)         │  │
│  └─────────┘  └─────────────────────────────────────────┘  │
│                    [GIZZI PANEL - Bottom Right]            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐           ┌─────────┐
   │ Gateway │◄────────►│ Kernel  │◄─────────►│ UI-TARS │
   │ (3000)  │          │ (3004)  │           │ (3007)  │
   └─────────┘          └─────────┘           └─────────┘
```

## Getting Started

### For Users
See the [User Guide](./user-guide/getting-started.md) to learn how to use the Shell UI.

### For Developers
See the [Developer Guide](./developer-guide/README.md) to understand the architecture and contribute.

### For Deployment
See the [Deployment Guide](./deployment/README.md) for production setup.

---

*Last updated: 2026-01-31*
