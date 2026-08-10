# 🔎 Unbound Recursive DNS Resolver

Unbound is a validating, recursive, caching DNS resolver.

* **Official Documentation:** [unbound.docs.nlnetlabs.nl](https://unbound.docs.nlnetlabs.nl/)

---

## Overview

Unbound resolves root DNS zone queries directly without relying on third-party upstream resolvers (such as Google or Cloudflare).

## Architecture & Port Binding

* **Container Name:** `unbound`
* **Listen Address:** `0.0.0.0:5335` (internal Docker network `homelab-net` only)
* **Client Restriction:** Restricted to Pi-hole (`pihole`) queries on `homelab-net`
* **Features:** DNSSEC validation enabled; root hints updated via configuration.

## Verification

```bash
# Check Unbound container status
docker compose ps unbound

# Query Unbound directly from host via Docker
docker exec -it pihole dig @unbound -p 5335 example.com
```
