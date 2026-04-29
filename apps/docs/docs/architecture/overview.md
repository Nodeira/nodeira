---
id: overview
sidebar_position: 1
---

# Architecture Overview

Nodeira is a monorepo managed by [Turborepo](https://turbo.build) and [Bun workspaces](https://bun.sh/docs/install/workspaces).

## Packages

```
nodeira/
├── apps/
│   ├── web/     # React 19 + Vite frontend
│   ├── server/  # NestJS 10 + Prisma backend
│   └── docs/    # Docusaurus documentation
└── packages/
    └── shared-types/  # Shared TypeScript interfaces
```

## Request flow

```
Browser (localhost:5173)
  ├── REST  → Vite proxy /api  → NestJS :3001
  └── WS    → Vite proxy /sync → NestJS :3001 (Hocuspocus)
```

Vite's dev proxy keeps the browser origin consistent so cookies and WebSocket upgrades work without CORS.

## Tech stack summary

| Layer        | Technology                                           |
| ------------ | ---------------------------------------------------- |
| Frontend     | React 19, Vite 6, TanStack Router, TanStack Query v5 |
| Editor       | TipTap (ProseMirror-based)                           |
| UI           | Mantine v9                                           |
| Client state | Jotai atoms                                          |
| Sync         | Yjs CRDTs, y-websocket, y-indexeddb                  |
| Backend      | NestJS 10, WsAdapter (raw WebSocket)                 |
| Real-time    | Hocuspocus (Yjs WebSocket server)                    |
| ORM          | Prisma                                               |
| Database     | PostgreSQL                                           |
| Monorepo     | Turborepo, Bun workspaces                            |
