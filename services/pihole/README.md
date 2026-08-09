# 🚫 Pi-hole DNS Ad-Blocking

Pi-hole provides network-wide ad-blocking, local DNS resolution, and query logging.

* **Official Documentation:** [docs.pi-hole.net](https://docs.pi-hole.net/)

---

## Overview

Pi-hole sits in front of **Unbound** (`unbound:5335`). It inspects incoming DNS queries, filters requests against configured blocklists, and forwards allowed queries recursively to Unbound.

## Architecture & DNS Chain

* **Container Name:** `pihole` (`dns.<your-hostname>`)
* **Upstream Resolver:** `10.10.0.3#5335` (Unbound container IP on `homelab-net`)
* **Configuration Persistence:** Stored under `services/pihole/volumes/etc-pihole/` and `services/pihole/volumes/etc-dnsmasq.d/`.

## Key Details

* **Admin Web Interface:** `https://dns.<your-hostname>/admin`
* **Admin Password:** Stored in `volumes/secrets/pihole_admin_password`
* **Local DNS Records:** Managed automatically for homelab domain names via custom dnsmasq configuration.

## Verification

```bash
# Check Pi-hole container status
docker compose ps pihole

# Test DNS resolution through Pi-hole
dig @localhost -p 53 example.com

# Test local homelab domain resolution
dig @localhost -p 53 dashboard.<your-hostname>
```
