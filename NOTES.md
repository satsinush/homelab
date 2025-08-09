journalctl -u homelab-api.service -f


run generate_ssl_key.sh as sudo before docker compose up


sudo nano /etc/systemd/resolved.conf #for DNS


docker exec -it pihole pihole setpassword