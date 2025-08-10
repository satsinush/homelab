# Host device actions

## Set up ssh

## Set up UFW

To                         Action      From
--                         ------      ----
Anywhere on wg0            ALLOW       10.10.20.0/24              # Allow VPN traffic on WireGuard interface
2222/tcp                   ALLOW       10.10.10.0/24              # SSH from LAN
80,443/tcp                 ALLOW       10.10.10.0/24              # Web from LAN
53                         ALLOW       10.10.10.0/24              # DNS from LAN
21114:21119/tcp            ALLOW       10.10.10.0/24              # RustDesk from LAN
21116/udp                  ALLOW       10.10.10.0/24              # RustDesk from LAN
2222/tcp                   ALLOW       10.10.20.0/24              # SSH from VPN
80,443/tcp                 ALLOW       10.10.20.0/24              # Web from VPN
53                         ALLOW       10.10.20.0/24              # DNS from VPN
21114:21119/tcp            ALLOW       10.10.20.0/24              # RustDesk from VPN
21116/udp                  ALLOW       10.10.20.0/24              # RustDesk from VPN
51820/udp                  ALLOW       Anywhere                   # WireGuard VPN
5000/tcp                   ALLOW       10.10.20.0/24              # Allow Node.js API from VPN
5000/tcp                   ALLOW       10.10.10.0/24              # Allow Node.js API from LAN
19999/tcp                  ALLOW       10.10.10.0/24              # Netdata from LAN
19999/tcp                  ALLOW       10.10.20.0/24              # Netdata from VPN
51820/udp (v6)             ALLOW       Anywhere (v6)              # WireGuard VPN

10.10.20.0/24 on wg0       ALLOW FWD   10.10.10.0/24 on end0
10.10.20.0/24 on wg0       ALLOW FWD   10.10.20.0/24 on wg0
Anywhere on end0           ALLOW FWD   10.10.20.0/24 on wg0


/etc/ufw/before.rules -> ./ufw/before.rules

## Set up Wireguard

/etc/wireguard/wg0.conf -> ./wireguard/wg0.conf

Router port forward port 51820

## Set up DNS

/etc/dhcpcd.conf -> ./dns/dhcpcd.conf
make sure nohook resolv.conf, disables dhcp service from setting dns resolvers

/etc/resolv.conf -> ./dns/resolv.conf
make sure first first is lo (127.0.0.1) and others are public like 1.1.1.1, 8.8.8.8

/etc/systemd/resolved.conf -> ./resolved.conf
make sure DNSStubListener=no, disables host from listening on port 53 for DNS requests

## Set up .env
copy example.env and save as .env
fill in values as needed

# Set up homelab
Clone repo
init and clone submodules

run generate_keys.sh

update ./unbound/root.hints from curl -o unbound/root.hints https://www.internic.net/domain/named.root

set up ./ddclient/ddclient.conf

install lm_sensors for netdata

run host actions api for host level commands
/etc/systemd/system/homelab-host-api.service -> ./systemd/homelab-host-api.service
update working directory
sudo systemctl start homelab-host-api
sudo systemctl enable homelab-host-api

set up pacman sync job (if using pacman on host)
/etc/systemd/system/pacman-sync.service -> ./systemd/pacman-sync.service
/etc/systemd/system/pacman-sync.timer -> ./systemd/pacman-sync.timer

sudo systemctl start pacman-sync.timer
sudo systemctl enable pacman-sync.timer

Start docker services
docker-compose up --build

Get RustDesk public key for clients from ./rustdesk/data/id_ed25519.pub