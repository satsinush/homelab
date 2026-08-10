# Roadmap, Known Issues, and Limitations

This document tracks planned feature additions, proposed service expansions, known issues, and architectural limitations across the homelab infrastructure.

---

## 🗺️ Service Roadmap

### High Priority / Planned
* **Jellyfin**: Self-hosted media server for local video and audio streaming (`media.home.aneedham.com`).
* **Paperless-ngx**: Document management system for archiving, OCR indexing, and organizing personal documents (`paperless.home.aneedham.com`).
* **Gitea / Forgejo**: Lightweight self-hosted Git service (`git.home.aneedham.com`).
* **Headplane**: Web-based administration dashboard for the Headscale VPN controller (`headplane.home.aneedham.com`).
* **MCP (Model Context Protocol) Servers**: Integration of proper Model Context Protocol (MCP) servers into the Dashboard AI Chat component for enhanced AI assistant tooling.

---

## 🛠️ Optimizations & Architectural Improvements

* **PostgreSQL & Redis Container Consolidation**: Evaluate consolidating multiple container-specific PostgreSQL databases (Authentik, Immich, Nextcloud) into a shared multi-database cluster or single optimized database service to reduce memory consumption.

---

## 📱 Mobile & Application Deployments

* **Puzzle++ APK Build**: Package and publish the C++ Qt `puzzle-plus-plus` suite into a standalone Android APK for mobile devices using Qt for Android tooling.

---

## 🐛 Known Issues & Limitations

* **Host API Package Audit**: Pacman package updates check requires `sudo pacman -Sy` privileges executed by the `homelab-host-api` service.

---

## 📚 Documentation Index
1. [Prerequisites & Workstation Setup](./1-prerequisites.md)
2. [Storage Configuration](./2-storage.md)
3. [Network & DNS Configuration](./3-network-and-dns.md)
4. [Post-Setup Verification Checklist](./4-checklist.md)
5. [Service Management & Docker Compose](./5-services.md)
6. [Development & Git Hooks](./6-development.md)
7. [Troubleshooting & Maintenance](./7-troubleshooting.md)
8. [Services Catalog](./8-services.md)
9. [Screenshots Gallery](./9-screenshots.md)
10. **[Roadmap & Known Issues](./10-roadmap-and-issues.md)**
