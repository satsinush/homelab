journalctl -u homelab-api.service -f


run generate_ssl_key.sh as sudo before docker compose up


sudo nano /etc/systemd/resolved.conf #for DNS

cat /etc/resolv.conf


docker exec -it pihole pihole setpassword