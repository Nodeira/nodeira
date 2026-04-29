---
id: intro
slug: /
sidebar_position: 1
---

# Introduction

Nodeira is an offline-first, AI-enhanced note-taking application inspired by Obsidian. Notes are stored as rich-text documents synced in real time across browser tabs and devices using Yjs CRDTs.

## Key ideas

- **Offline-first** — edits are persisted locally via IndexedDB and merged automatically when you reconnect. No manual conflict resolution.
- **Real-time collaboration** — multiple tabs or users editing the same note see each other's changes instantly via WebSocket.
- **AI-native** — the note store is designed so an AI agent can read and write notes via CLI tool calls, enabling AI "mind" workflows during software development.
- **Vaults** — a top-level namespace that groups notes and folders. Switch between vaults to separate personal, work, or project contexts.

## What's included today

| Feature                                  | Status  |
| ---------------------------------------- | ------- |
| Vaults                                   | ✅      |
| Folders                                  | ✅      |
| Notes (create / edit / delete / reorder) | ✅      |
| Rich-text editor (TipTap)                | ✅      |
| Real-time sync (Yjs + WebSocket)         | ✅      |
| Offline editing (y-indexeddb)            | ✅      |
| Image upload                             | ✅      |
| Bidirectional links                      | Planned |
| Graph view                               | Planned |
| Canvas                                   | Planned |
| Plugin architecture                      | Planned |
| AI skill tool integration                | Planned |
