<p align="center">
  <img src="services/dashboard/frontend/public/homelab-icon.svg" alt="Homelab Logo" width="128" height="128">
</p>

# 🏠 Homelab Dashboard & Services

This repository contains all the configuration and Docker instructions needed to deploy a comprehensive, self-hosted homelab system.

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License: MIT">
  </a>
  <a href="https://docs.docker.com/compose/">
    <img src="https://img.shields.io/badge/Docker%20Compose-v2-2496ED?style=flat-square&logo=docker" alt="Docker Compose">
  </a>
  <a href="https://archlinux.org/">
    <img src="https://img.shields.io/badge/-Arch%20Linux-grey?style=flat-square&logo=arch-linux" alt="Arch Linux">
  </a>
</p>

## 📚 Table of Contents
- [Overview](#-overview)
- [Quick Start Guide](#-get-started-quick-setup-guide)
- [Services Directory & Architecture](./docs/8-services.md)
- [Dashboard Screenshots Gallery](./docs/9-screenshots.md)
- [License](#️-license)

## ✨ Overview

This project bundles several open-source services, managed via `docker-compose`, and provides a custom web dashboard for easy management and interaction.

![Homelab Dashboard Screenshot](./screenshots/home.png)

### Core Services Included

*Detailed individual service documentation is available in [docs/8-services.md](./docs/8-services.md) and in each service's directory under `services/<service>/README.md`.*

  * **🏠 [Homelab Dashboard](./services/dashboard/README.md)**: A custom web interface with LAN device scanning, WOL support, word puzzle game solvers, package management, and an integrated AI chatbot with [Ollama](./services/ollama/README.md).
  * **🔀 [Traefik v3](./services/traefik/README.md)**: Cloud-native reverse proxy with automatic HTTPS (Let's Encrypt or self-signed).
  * **🔑 [Authentik](./services/authentik/README.md)**: Single Sign-On (SSO) and Identity Provider for securing services.
  * **📈 [Gatus](./services/gatus/README.md)**: Real-time health check monitoring and public status page.
  * **📦 [Dockhand](./services/dockhand/README.md)**: Docker container management UI integrated with Authentik SSO.
  * **🔔 [Alerts & Gotify](./services/alerts/README.md)**: HTTP and SMTP notification gateway for Gatus, dashboard, Vaultwarden, and Dockhand via [Gotify](./services/gotify/README.md).
  * **🚫 [Pi-hole](./services/pihole/README.md) & [Unbound](./services/unbound/README.md)**: Network-wide ad-blocking and recursive DNS.
  * **🌐 [ddclient](./services/ddclient/README.md)**: Dynamic DNS client to keep your domain pointed to your IP.
  * **🖥️ [RustDesk](./services/rustdesk/README.md)**: Self-hosted remote desktop (ID + relay).
  * **📁 [Samba](./services/samba/README.md) & [Nextcloud](./services/nextcloud/README.md)**: LAN SMB shares and Nextcloud (files, WebDAV, calendar, contacts, Collabora Office) via Authentik.
  * **✉️ [Stalwart](./services/stalwart/README.md)**: Mail server with Authentik LDAP for humans; authenticated SMTP for Vaultwarden.
  * **📷 [Immich](./services/immich/README.md)**: Photos with Authentik OIDC.
  * **🛰️ [Headscale](./services/headscale/README.md)**: Self-hosted Tailscale control plane with Authentik OIDC sign-in and subnet router.
  * **🔐 [Vaultwarden](./services/vaultwarden/README.md)**: Self-hosted password manager.
  * **💾 [Restic](./services/restic/README.md)**: Encrypted offsite cloud backups.

### Infrastructure Diagram

```mermaid
%%{init: {
    "theme": "dark"
}}%%
flowchart LR
    subgraph External["🌍 Internet & Clients"]
        Remote["🌍 Remote Client"]
        Local["💻 LAN Devices"]
    end

    subgraph Host["🖥️ Homelab Server"]
        Headscale["🛰️ Headscale VPN"]
        Firewall["🛡️ firewalld"]

        subgraph Network["🐳 Docker Network"]
            Traefik["🔀 Traefik v3 Proxy"]
            Authentik["🔑 Authentik SSO & LDAP"]
            
            subgraph Apps["Services & Apps"]
                Dashboard["🏠 Homelab Dashboard"]
                Nextcloud["☁️ Nextcloud"]
                Immich["📷 Immich"]
                Vaultwarden["🔐 Vaultwarden"]
                Stalwart["✉️ Stalwart Mail"]
                Samba["📁 Samba SMB"]
                Dockhand["📦 Dockhand"]
                Ollama["🤖 Ollama AI"]
                Rustdesk["🖥️ RustDesk"]
            end

            subgraph Infra["Core Infra & Ops"]
                Pihole["🚫 Pi-hole"]
                Unbound["🔎 Unbound"]
                Gatus["📈 Gatus Status"]
                Alerts["🔔 Alerts Gateway"]
                Gotify["🔔 Gotify Push"]
                DDNS["🌐 ddclient"]
                Restic["💾 Restic Backup"]
            end
        end
    end

    %% Routing Connections
    Remote -->|Tailscale| Headscale --> Firewall
    Local --> Firewall
    Firewall --> Traefik
    Firewall -->|DNS 53| Pihole --> Unbound

    %% Proxy Connections
    Traefik --> Authentik & Dashboard & Nextcloud & Immich & Vaultwarden & Stalwart & Dockhand & Gatus & Gotify

    %% Auth & App Connections
    Dashboard & Nextcloud & Immich & Vaultwarden & Dockhand & Headscale -.->|OIDC| Authentik
    Stalwart & Samba -.->|LDAP| Authentik
    Dashboard --> Ollama

    %% Alert Flows
    Gatus & Vaultwarden & Stalwart & Dashboard --> Alerts --> Gotify
```

## 🚀 Quick Start Guide

Deployment is a multi-stage process. Follow these steps sequentially to prepare your host, configure services, and launch your homelab stack.

### 0\. 📂 Clone & Initialize

First, clone this repository and its submodules.

```shell
git clone https://github.com/satsinush/homelab.git
cd homelab
git submodule init
git submodule update
```

For more info see the [GitHub Docs 🔗](https://docs.github.com/en/get-started/using-git)

### 1\. 📋 Install Host Prerequisites

Before running any configuration scripts, install all base dependencies on your Arch Linux host, including Docker and host tooling.

➡️ **Follow the detailed instructions here:** **[1. Prerequisites](./docs/1-prerequisites.md)**

### 2\. ⚙️ Configure and Harden Host

This is the most critical security phase. You will configure SSH key access, set up firewalld rules, and prepare the host for Headscale / Tailscale remote access.

➡️ **Follow the detailed instructions here:** **[2. Host Machine Configuration](./docs/2-host-config.md)**

> **🅰️ Ansible alternative:** Steps 1 and 2 (packages, firewall, SSH, Docker, VPN host prep, host DNS) can be applied automatically with the playbook in [`ansible/`](./ansible/README.md). App setup below still uses `setup.py`.

### 3\. 🚀 Deploy the Services

The final deployment involves configuring environment variables, setting up custom `systemd` services for automation, and launching the Docker stack.

1.  **Configure Environment:** Defaults live in `setup/env_schema.py`; `setup.py` creates/syncs `.env` from that schema (prompts on first run).
2.  **Enable Systemd Services:** Copy and enable host API, backup, and sync services (see [scheduled jobs](./docs/3-deployment.md#scheduled-jobs-host-local-time)).
3.  **Run Setup Script:** Execute the main script to build containers and generate credentials.

➡️ **Follow the detailed instructions here:** **[3. Project Deployment](./docs/3-deployment.md)**

-----

### Post-Deployment and Maintenance Guides

Once the core stack is running, use these sections for ongoing maintenance and checks.

#### 4\. ✅ Post-Installation Checklist

Complete a final checklist for each service (e.g., installing the root CA certificate, setting up notifications in Gatus / Gotify, and verifying Authentik SSO).

➡️ **View the full checklist here:** **[4. Post Installation Checklist](./docs/4-checklist.md)**

#### 5\. 💾 Backup and Restore

Learn how to manage and protect your data. This section covers Restic cloud backups via `setup.py`, the automated `systemd` timer, and disaster recovery.

➡️ **View the backup and restore guide here:** **[5. Backup and Restore](./docs/5-backup-restore.md)**

#### 6\. 🧑💻 Development

If you plan to modify the Homelab Dashboard or Host API code, this guide explains how to use the `docker-compose.override.yml` file to launch a development environment with hot-reloading enabled.

➡️ **View the development guide here:** **[6. Development](./docs/6-development.md)**

#### 7\. ❓ Troubleshooting

Find quick solutions for common deployment issues, including DNS resolution failures, browser security warnings, and container restarts.

➡️ **View the troubleshooting guide here:** **[7. Troubleshooting](./docs/7-troubleshooting.md)**

## ⚖️ License

This project is licensed under the MIT License. See the [`./LICENSE`](./LICENSE) file for details.

> **ℹ️ Note**: The software for each containerized service falls under its own respective license. The MIT license for this repository applies only to the original configuration files, scripts, and the `dashboard` source code.
