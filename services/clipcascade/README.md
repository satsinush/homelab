# ClipCascade

[ClipCascade](https://github.com/Sathvik-Rao/ClipCascade) is a self-hosted cross-platform clipboard synchronization service supporting Windows, macOS, Linux, and Android.

## Access

- **URL**: `https://<CLIPCASCADE_SERVICE_NAME>.<HOMELAB_HOSTNAME>` (default: `https://clip.<HOMELAB_HOSTNAME>`)
- **Default Credentials**: `admin` / `admin123` (prompted to change upon initial setup)

## Features

- **Cross-Platform**: Syncs clipboard content across desktop and mobile devices.
- **Security**: End-to-end encryption support and brute-force protection.
- **Persistence**: User account database persisted under `./services/clipcascade/volumes/database`.
