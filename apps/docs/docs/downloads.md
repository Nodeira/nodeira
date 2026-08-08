---
id: downloads
title: Downloads
---

# Downloads

Every link on this page points at **the latest release** and never needs updating — GitHub
redirects `releases/latest/download/<file>` to whichever release is newest.

To pin a specific version instead, replace `latest/download` with `download/v1.2.3`.

## Desktop app

| Platform              | Installer                                                                                             | Portable                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Windows (x64)         | [Setup .exe](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-win32-x64-Setup.exe) | [.zip](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-win32-x64.zip)    |
| macOS (Apple silicon) | [.dmg](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-darwin-arm64.dmg)          | [.zip](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-darwin-arm64.zip) |
| Linux (x64)           | [.deb](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-linux-x64.deb)             | [.zip](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-linux-x64.zip)    |

The portable `.zip` is the packaged app with no installer — unpack it and run the `nodeira`
executable inside. Use it when you cannot or would rather not run an installer.

The desktop app needs a Nodeira server to talk to. On first launch it asks for the server
URL; you can change it later under **Settings → Connection**.

## Command-line client

The CLI is a single static binary. It is how AI agents read and write notes.

| Platform              | Download                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Linux (x64)           | [nodeira-linux-amd64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-linux-amd64)             |
| Linux (arm64)         | [nodeira-linux-arm64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-linux-arm64)             |
| macOS (Intel)         | [nodeira-darwin-amd64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-darwin-amd64)           |
| macOS (Apple silicon) | [nodeira-darwin-arm64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-darwin-arm64)           |
| Windows (x64)         | [nodeira-windows-amd64.exe](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-windows-amd64.exe) |

Install on Linux or macOS:

```bash
curl -L -o nodeira https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-linux-amd64
chmod +x nodeira
sudo mv nodeira /usr/local/bin/
nodeira login
```

## Android

The Android app ships through a self-hosted F-Droid repository rather than as a direct
download, so it can update itself. Add the repo to your F-Droid client:

```
https://deranjer.github.io/fdroid/repo
```

APKs are also attached to each [GitHub release](https://github.com/Nodeira/nodeira/releases)
if you would rather sideload one.

## Server

The server is published as a container image on GHCR:

```bash
docker pull ghcr.io/nodeira/nodeira:latest
```

See [Deployment](./development/deployment.md) for a full self-hosting walkthrough.
