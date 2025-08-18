# Host device actions

## Set up ssh

## Set up UFW

Default: deny (incoming), allow (outgoing), deny (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
Anywhere on wg0            ALLOW IN    10.10.20.0/24              # Allow VPN traffic on WireGuard interface
2222/tcp                   ALLOW IN    10.10.10.0/24              # SSH from LAN
80,443/tcp                 ALLOW IN    10.10.10.0/24              # Web from LAN
53                         ALLOW IN    10.10.10.0/24              # DNS from LAN
21114:21119/tcp            ALLOW IN    10.10.10.0/24              # RustDesk from LAN
21116/udp                  ALLOW IN    10.10.10.0/24              # RustDesk from LAN
2222/tcp                   ALLOW IN    10.10.20.0/24              # SSH from VPN
80,443/tcp                 ALLOW IN    10.10.20.0/24              # Web from VPN
53                         ALLOW IN    10.10.20.0/24              # DNS from VPN
21114:21119/tcp            ALLOW IN    10.10.20.0/24              # RustDesk from VPN
21116/udp                  ALLOW IN    10.10.20.0/24              # RustDesk from VPN
51820/udp                  ALLOW IN    Anywhere                   # WireGuard VPN
51820/udp (v6)             ALLOW IN    Anywhere (v6)              # WireGuard VPN

10.10.20.0/24 on wg0       ALLOW FWD   10.10.10.0/24 on end0
10.10.20.0/24 on wg0       ALLOW FWD   10.10.20.0/24 on wg0
Anywhere on end0           ALLOW FWD   10.10.20.0/24 on wg0


/etc/ufw/before.rules -> ./ufw/before.rules

## Set up Wireguard

/etc/wireguard/wg0.conf -> ./wireguard/wg0.conf

enable ipv4 forwarding

Router port forward port 51820 to host

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

set up ./ddclient/config/ddclient.conf
use ./ddclient/example.ddclient.conf as an example

install lm_sensors for netdata temperature scanning

install arp-scan for device scanning

install jq on the host

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

make sure to change HOMELAB_IP_ADDRESS and update any urls you want to change in .env.template
Make sure that VITE_ variables match the regular ones, everything else will be filled in automatically

run setup.sh, this will set up usernames, passwords, and other configurations for needed services

install homelab-ca.crt on any devices accessing homelab services

check output for RustDesk public key or run this
check here ./rustdesk/data/id_ed25519.pub

If needed ever, run docker exec authelia cat /var/lib/authelia/notification.txt to get email verification codes from authelia

set up account for Vaultwarden, then set VAULTWARDEN_SIGNUPS_ALLOWED to false in .env if you want to turn off new account creation
enter VAULTWARDEN_WEB_HOSTNAME as the self-hosted url for clients

set up Uptime Kuma
copy files in ./uptime-kuma/example-data to ./uptime-kuma/data
Go to settings -> security to set username/password
update notification to use correct ntfy token

Set up ntfy
Use NTFY_WEB_HOSTNAME for devices

subscribe to homelab-dashboard topic on ntfy for package alerts
subscribe to uptime-kuma topic on ntfy for service status alerts

recommend updating pi-hole to only use this list

(won't block google shopping links)