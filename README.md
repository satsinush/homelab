# Homelab Setup Documentation

A comprehensive homelab setup with Docker containers, VPN access, DNS management, and web services. This repository contains configuration files and scripts for setting up a secure, self-hosted environment.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Initial Host Setup](#initial-host-setup)
- [Network Configuration](#network-configuration)
- [Security Setup](#security-setup)
- [Service Configuration](#service-configuration)
- [Docker Services](#docker-services)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

## 🏠 Overview

This homelab setup includes:
- **Web Dashboard**: React-based management interface
- **API Backend**: Node.js API for system management
- **DNS Server**: Pi-hole with Unbound for ad-blocking and DNS resolution
- **VPN Server**: WireGuard for secure remote access
- **Monitoring**: Netdata for system monitoring
- **Reverse Proxy**: Nginx with SSL termination
- **Remote Desktop**: RustDesk server for remote access

## 🔧 Prerequisites

- Linux server (Raspberry Pi or similar)
- Docker and Docker Compose installed
- Root/sudo access
- Basic knowledge of Linux networking

## 🚀 Initial Host Setup

### 1. Clone Repository

```bash
git clone https://github.com/satsinush/homelab.git
cd homelab
git submodule init
git submodule update
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp example.env .env

# Edit with your specific values
nano .env
```

Fill in the required values:
- `HOMELAB_HOSTNAME`: Your server's hostname
- `DASHBOARD_WEB_HOSTNAME`: Dashboard domain
- `PIHOLE_WEB_HOSTNAME`: Pi-hole admin domain
- `NETDATA_WEB_HOSTNAME`: Netdata monitoring domain

### 3. Generate SSL Certificates and SSH Keys

```bash
# Make script executable
chmod +x generate_ssl_key.sh

# Run with sudo (generates SSL certs and SSH keys)
sudo ./generate_ssl_key.sh
```

This script will:
- Generate SSL certificates for Nginx with Subject Alternative Names (SANs)
- Create ed25519 SSH keys for RustDesk in the `rustdesk-keys/` folder
- Set appropriate file permissions

## 🌐 Network Configuration

### UFW Firewall Rules

The following ports and services are configured:

| Service | Ports | Source Networks | Description |
|---------|-------|----------------|-------------|
| SSH | 2222/tcp | LAN, VPN | Secure shell access |
| Web Services | 80,443/tcp | LAN, VPN | HTTP/HTTPS traffic |
| DNS | 53/tcp,udp | LAN, VPN | DNS resolution |
| RustDesk | 21114:21119/tcp, 21116/udp | LAN, VPN | Remote desktop |
| WireGuard | 51820/udp | Anywhere | VPN server |
| API | 5000/tcp | LAN, VPN | Homelab API |
| Netdata | 19999/tcp | LAN, VPN | System monitoring |

**Network Segments:**
- LAN: `10.10.10.0/24`
- VPN: `10.10.20.0/24`

### Configure UFW

```bash
# Copy UFW configuration
sudo cp ./ufw/before.rules /etc/ufw/before.rules

# Apply firewall rules (refer to README.txt for complete rule set)
sudo ufw enable
```

### WireGuard VPN Setup

```bash
# Copy WireGuard configuration
sudo cp ./wireguard/wg0.conf /etc/wireguard/wg0.conf

# Start and enable WireGuard
sudo systemctl start wg-quick@wg0
sudo systemctl enable wg-quick@wg0
```

**Router Configuration:**
- Forward port 51820/UDP to your server

## 🔒 Security Setup

### SSH Configuration

Configure SSH for enhanced security:
- Use key-based authentication
- Change default port to 2222
- Disable password authentication

### DNS Configuration

#### 1. DHCP Client Configuration
```bash
sudo cp ./dns/dhcpcd.conf /etc/dhcpcd.conf
```
Ensures `nohook resolv.conf` is set.

#### 2. DNS Resolution
```bash
sudo cp ./dns/resolv.conf /etc/resolv.conf
```
Configure with localhost first, then fallback to public DNS (1.1.1.1, 8.8.8.8).

#### 3. Systemd Resolved
```bash
sudo cp ./dns/resolved.conf /etc/systemd/resolved.conf
```
Ensure `DNSStubListener=no` is set.

## 🔧 Service Configuration

### Host API Service

Install the homelab host API for system-level commands:

```bash
# Copy service file
sudo cp ./systemd/homelab-host-api.service /etc/systemd/system/

# Update working directory in service file to match your installation path
sudo nano /etc/systemd/system/homelab-host-api.service

# Start and enable service
sudo systemctl daemon-reload
sudo systemctl start homelab-host-api
sudo systemctl enable homelab-host-api
```

### Package Manager Sync (Pacman)

For Arch-based systems, set up automatic package synchronization:

```bash
# Copy service and timer files
sudo cp ./systemd/pacman-sync.service /etc/systemd/system/
sudo cp ./systemd/pacman-sync.timer /etc/systemd/system/

# Start and enable timer
sudo systemctl start pacman-sync.timer
sudo systemctl enable pacman-sync.timer
```

### Update Root Hints

```bash
# Update Unbound root hints for DNS resolution
sudo wget -O ./unbound/root.hints https://www.internic.net/domain/named.root
```

## 🐳 Docker Services

### Start All Services

```bash
# Build and start all containers
docker-compose up --build -d

# View logs
docker-compose logs -f
```

### Individual Service Management

```bash
# Restart specific service
docker-compose restart <service-name>

# View service logs
docker-compose logs <service-name>

# Stop all services
docker-compose down
```

### Services Included

1. **homelab-dashboard**: React frontend (Port 3000)
2. **homelab-api**: Node.js backend API (Port 5000)
3. **nginx**: Reverse proxy with SSL (Ports 80, 443)
4. **pihole**: DNS server with ad-blocking (Port 53)
5. **unbound**: Recursive DNS resolver
6. **netdata**: System monitoring (Port 19999)
7. **rustdesk-server**: Remote desktop server

## 🔍 Monitoring and Access

### Web Interfaces

- **Dashboard**: `https://dashboard.yourdomain.com`
- **Pi-hole Admin**: `https://pihole.yourdomain.com/admin`
- **Netdata**: `https://netdata.yourdomain.com`

### Service Status

```bash
# Check Docker services
docker-compose ps

# Check system services
sudo systemctl status homelab-host-api
sudo systemctl status wg-quick@wg0

# Check firewall status
sudo ufw status verbose
```

## 🛠 Maintenance

### Regular Updates

```bash
# Update Docker images
docker-compose pull
docker-compose up -d

# Update system packages
sudo apt update && sudo apt upgrade  # Debian/Ubuntu
sudo pacman -Syu                     # Arch Linux

# Update root hints (monthly)
sudo wget -O ./unbound/root.hints https://www.internic.net/domain/named.root
docker-compose restart unbound
```

### Backup Important Data

```bash
# Backup configuration
tar -czf homelab-backup-$(date +%Y%m%d).tar.gz \
  .env \
  ssl/ \
  rustdesk-keys/ \
  homelab-api/data/ \
  wireguard/wg0.conf

# Backup database
docker-compose exec homelab-api sqlite3 /app/data/homelab.db ".backup /app/data/backup.db"
```

## 🐛 Troubleshooting

### Common Issues

#### SSL Certificate Problems
```bash
# Regenerate certificates
sudo ./generate_ssl_key.sh
docker-compose restart nginx
```

#### DNS Resolution Issues
```bash
# Check Pi-hole status
docker-compose logs pihole

# Test DNS resolution
nslookup google.com localhost
```

#### VPN Connection Problems
```bash
# Check WireGuard status
sudo wg show

# Restart WireGuard
sudo systemctl restart wg-quick@wg0
```

#### Service Connectivity
```bash
# Check if services are running
docker-compose ps

# Check network connectivity
curl -k https://localhost/api/health
```

### Log Locations

- Docker services: `docker-compose logs <service>`
- System services: `journalctl -u <service-name>`
- UFW logs: `/var/log/ufw.log`
- Nginx logs: `docker-compose logs nginx`

## 📝 Configuration Files

| File | Purpose | Destination |
|------|---------|-------------|
| `ufw/before.rules` | Firewall rules | `/etc/ufw/before.rules` |
| `wireguard/wg0.conf` | VPN configuration | `/etc/wireguard/wg0.conf` |
| `dns/dhcpcd.conf` | DHCP client config | `/etc/dhcpcd.conf` |
| `dns/resolv.conf` | DNS resolution | `/etc/resolv.conf` |
| `dns/resolved.conf` | Systemd resolved | `/etc/systemd/resolved.conf` |
| `ssl/nginx-all-sites.*` | SSL certificates | Used by Nginx container |
| `rustdesk-keys/id_ed25519*` | SSH keys | Used by RustDesk |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source. Please check individual components for their respective licenses.

## ⚠️ Security Notes

- Change default passwords immediately
- Keep all services updated
- Monitor logs regularly
- Use strong SSH keys
- Regularly backup configurations
- Review firewall rules periodically

---

For additional help, check the individual service documentation or create an issue in the repository.