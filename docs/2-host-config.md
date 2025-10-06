## 💻 Host Machine Configuration

Before deploying the Docker stack, we need to secure the host machine by enabling and hardening SSH, configuring the firewall, and setting up a VPN.
Follow these steps to prepare the host server.

### 1\. 🔒 SSH Access

For a secure setup, we will configure SSH to use **key-based authentication only**. This makes it much more difficult for an attacker to gain access.

**Step 1: Set Up SSH Server**

First, make sure the SSH server is installed an running.

1. **On the server**, run this command to install the SSH service if you haven't already:
   ```shell
   sudo pacman -S openssh
   ```

2. Start and enable the service:
   ```shell
   sudo systemctl enable sshd
   ```

**Step 2: Set Up SSH Key Authentication**

Next, ensure you can log in using an SSH key instead of a password.

1.  **On your local machine (not the server)**, generate an SSH key if you don't have one:
    ```shell
    ssh-keygen -t ed25519 -C "your_email@example.com"
    ```
2.  Copy your **public** key to the server (replace `user` and `server_ip`):
    ```shell
    ssh-copy-id user@server_ip
    ```
3.  Log in to your server using the key to confirm it works:
    ```shell
    ssh user@server_ip
    ```

**Step 3: Harden the SSH Server Configuration**

Now, we'll edit the SSH server configuration file on the server.

1.  Open the configuration file `/etc/ssh/sshd_config`

2.  Make the following changes to improve security:
      * **(Optional)** Change the port from `22` to `2222`. This helps avoid automated scans.
        ```ini
        Port 2222
        ```
      * **Disable root login** to prevent direct access to the most privileged account.
        ```ini
        PermitRootLogin no
        ```
      * **Disable password authentication** to force the use of secure SSH keys.
        ```ini
        PasswordAuthentication no
        PubkeyAuthentication yes
        ```

> **⚠️ IMPORTANT: Lockout Warning**
> Before restarting SSH, **open a second terminal session** and attempt to connect using your new configuration. **Do not close your current session** until you have successfully verified the new key and port.

3.  Save the file and restart the SSH service to apply the changes:
    ```shell
    sudo systemctl restart sshd
    ```

> **⚠️ Important**: Ensure your new port (`2222/tcp`) is opened in your firewall rules before restarting SSH, or you may lock yourself out.

* **Docs:** [OpenSSH Wiki 🔗](https://wiki.archlinux.org/title/OpenSSH)

### 2\. Firewall (UFW) Setup 🛡️

These instructions configure the Uncomplicated Firewall (UFW) to secure the server. This assumes your LAN interface is `end0` and WireGuard is set up as `wg0`. These will need to be replaced if they are different on your device.

**Prerequisites:**

  * LAN Subnet: `10.10.10.0/24` (on `end0` interface)
  * VPN Subnet: `10.10.20.0/24` (on `wg0` interface)
  * Docker subnet: `10.10.30.0/24` (on `br-homelab-net` interface)

> **ℹ️ Note**: Adjust these values in the commands below if your network is different.

**Step 1: Set Default Policies**

First, set the firewall's default behavior: block all incoming and forwarded traffic, but allow all outgoing traffic.

```shell
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw default deny routed
```

**Step 2: Configure Before Rules**

For traffic to be routed correctly between the LAN and Docker networks, specific rules must be configured in the firewall. Follow these steps to ensure the UFW `before.rules` are properly configured.

  * Copy the provided `before.rules` file to the UFW directory, and adjust any values as needed.
    ```shell
    sudo cp ./ufw/before.rules /etc/ufw/before.rules
    ```

    Specifically, make sure you have these lines under the `*filter` section:
    ```ini
    # START DOCKER RULES

    # Allow traffic for established connections (essential for return traffic)
    -A ufw-before-forward -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

    # Allow new traffic to be forwarded from any Docker bridge to the main NIC.
    # IMPORTANT: Replace 'end0' with your server's main network interface (e.g., eth0)
    -A ufw-before-forward -i br-homelab-net -o end0 -j ACCEPT

    # END DOCKER RULES
    ```

**Step 3: Add Firewall Rules**

Run the following commands to allow access for your specific applications and enable forwarding between the LAN and VPN.

```shell
# --- CORE ACCESS ---
# Allow WireGuard VPN connections from anywhere
sudo ufw allow 51820/udp

# Allow SSH from LAN and VPN
sudo ufw allow from 10.10.10.0/24 to any port 2222 proto tcp
sudo ufw allow from 10.10.20.0/24 to any port 2222 proto tcp


# --- SERVICE ACCESS ---
# Allow Web (HTTP/S) from LAN and VPN
sudo ufw allow from 10.10.10.0/24 to any port 80,443 proto tcp
sudo ufw allow from 10.10.20.0/24 to any port 80,443 proto tcp

# Allow DNS (Pi-hole) from LAN, VPN, and Docker
sudo ufw allow from 10.10.10.0/24 to any port 53
sudo ufw allow from 10.10.20.0/24 to any port 53
sudo ufw allow from 10.10.30.0/24 to any port 53

# Allow RustDesk from LAN and VPN
sudo ufw allow from 10.10.10.0/24 to any port 21114:21119 proto tcp
sudo ufw allow from 10.10.10.0/24 to any port 21116 proto udp
sudo ufw allow from 10.10.20.0/24 to any port 21114:21119 proto tcp
sudo ufw allow from 10.10.20.0/24 to any port 21116 proto udp

# Allow Homelab Host API from Docker
sudo ufw allow from 10.10.30.0/24 to any port 5001 proto tcp

# --- FORWARDING RULES ---
# Allow traffic from VPN clients to be forwarded to anywhere (ensures VPN devices have internet access)
sudo ufw route allow in on wg0 out on end0 from 10.10.20.0/24 to 0.0.0.0/0

# Allow traffic from LAN devices to be forwarded to VPN clients
sudo ufw route allow in on end0 out on wg0 from 10.10.10.0/24 to 10.10.20.0/24

# Allow traffic from VPN devices to be forwarded to other VPN clients
sudo ufw route allow in on wg0 out on wg0 from 10.10.20.0/24 to 10.10.20.0/24
```

> **ℹ️ Note**: For LAN-to-VPN forwarding to work, you must add a **static route** on your main network router. The route should direct traffic for the `10.10.20.0/24` network to this server's LAN IP address. This is only required if you need LAN devices to initiate connections and connect directly to VPN devices.

**Step 4: Enable Firewall**

Finally, enable UFW and check the status to confirm the rules are active.

```shell
# Enable the firewall (will prompt 'y/n')
sudo ufw enable

# Check the status
sudo ufw status verbose
```

### 3\. 🔒 WireGuard VPN Setup

This guide will set up a WireGuard VPN, allowing secure remote access to your server and local network.

**Step 1: Generate Keys**

WireGuard uses public-key cryptography for security. We need to generate a private and public key for the server and for each client (peer) that will connect.

1.  Navigate to the WireGuard directory and set secure permissions:
    ```shell
    sudo -i
    cd /etc/wireguard
    umask 077
    ```
2.  Generate the server's key pair:
    ```shell
    wg genkey | tee server.private | wg pubkey > server.public
    ```
3.  Generate a key pair for each client (e.g., for "my-phone"). Repeat this for every device you want to connect:
    ```shell
    wg genkey | tee my-phone.private | wg pubkey > my-phone.public
    ```
4.  View the keys when you need them with `cat <filename>` (e.g. `cat server.public`)

**Step 2: Configure the Server**

1.  Copy the example config file:

    ```shell
    sudo cp ./wireguard/wg0.conf /etc/wireguard/wg0.conf
    ```

2.  Edit the server configuration file (`sudo nano /etc/wireguard/wg0.conf`). Use the keys you just generated to fill in the placeholders.

    **Example `wg0.conf`:**

    ```
    [Interface]
    # Server's private key (from server.private)
    PrivateKey = <PASTE_SERVER_PRIVATE_KEY>
    Address = 10.10.20.1/24
    ListenPort = 51820
    PostUp = iptables -t nat -A POSTROUTING -s 10.10.20.0/24 -d 10.10.10.0/24 -o end0 -j RETURN; iptables -t nat -A POSTROUTING -s 10.10.20.0/24 -o end0 -j MASQUERADE
    PostDown = iptables -t nat -D POSTROUTING -s 10.10.20.0/24 -o end0 -j MASQUERADE; iptables -t nat -D POSTROUTING -s 10.10.20.0/24 -d 10.10.10.0/24 -o end0 -j RETURN

    # --- PEER 1: MY-PHONE ---
    [Peer]
    # Client's public key (from my-phone.public)
    PublicKey = <PASTE_MY-PHONE_PUBLIC_KEY>
    # The IP address this client will use on the VPN
    AllowedIPs = 10.10.20.13/32
    ```

    Make sure that you include the PostUp and PostDown rules as they are essential for making sure requests are forwarded using NAT depedning on the destination. If you don't have static routes set up on your router or devices, you can replace the rules with these to translate all packets, but you may lose functionality with programs such as *KDE Connect*.

    ```
    PostUp = iptables -t nat -A POSTROUTING -s 10.10.20.0/24 -o end0 -j MASQUERADE
    PostDown = iptables -t nat -D POSTROUTING -s 10.10.20.0/24 -o end0 -j MASQUERADE
    ```

    > **ℹ️ Tip**: It's good practice to align the client's VPN IP with its LAN IP. For example, a PC at `10.10.10.13` on the LAN could be assigned `10.10.20.13` on the VPN.

**Step 3: Enable IP Forwarding**

To allow VPN clients to access your LAN, the server must be able to forward network packets.

  * Create a sysctl configuration file to make this setting permanent:
    ```shell
    echo "net.ipv4.ip_forward=1" | sudo tee /etc/sysctl.d/40-ipv4-forward.conf
    ```

**Step 4: Configure Your Router**

1.  **Port Forwarding:** In your internet router's settings, forward **UDP port 51820** to the LAN IP address of your server (e.g., `10.10.10.10`).
2.  **Static IP/DHCP Reservation:** Ensure your server always has the same LAN IP address by setting a DHCP reservation or a static IP in your router's settings. Do this for other devices you want to have a static IP as well.
3.  **Static Routing:** Make sure your router is set to forward all routes for your VPN subnet (e.g., `10.10.20.0/24`) to your server as the next hop. If your router doesn't support static routing and you don't set static routes on each of your devices, make sure to see the notes above about the NAT translation rules for WireGuard.

**Step 5: Start and Enable the Service**

Apply the IP forwarding rule and start the WireGuard service.

```shell
# Reloads all kernel parameters from /etc/sysctl.d/
sudo sysctl --system

# Starts the WireGuard interface and enables it to start on boot
sudo systemctl enable --now wg-quick@wg0
```

* **Docs:** [WireGuard Quickstart 🔗](https://www.wireguard.com/quickstart/)

### 4\. DNS Configuration

1.  **`dhcpcd.conf`**: Configure `/etc/dhcpcd.conf` to prevent the DHCP client from overwriting your custom DNS settings. See [`./dns/dhcpcd.conf`](./dns/dhcpcd.conf) as an example.
2.  **`resolv.conf`**: Configure `/etc/resolv.conf` to prioritize the local Pi-hole resolver while providing a backup DNS for when Pi-hole is not running. See [`./dns/resolv.conf`](./dns/resolv.conf) as an example.
3.  **`resolved.conf`**: Configure `/etc/systemd/resolved.conf` to disable the systemd stub listener on port 53. This is necessary to free up port 53 so that Pi-hole can use it to answer DNS queries. See [`./resolved.conf`](./resolved.conf) as an example.

Apply changes with these commands.

```shell
# Restarts the systemd service that handles DNS resolution
sudo systemctl restart systemd-resolved.service

# Restarts the DHCP client daemon to apply its new configuration
sudo systemctl restart dhcpcd.service
```

### 5. Additional Shell Configurations (Optional)

Follow these steps to add additional functionality to your shell.

1.  **.bashrc**: Add the lines inside [`./bashrc/user.bashrc`](./bashrc/user.bashrc) and [`./bashrc/root.bashrc`](./bashrc/root.bashrc) to `~/.bashrc` and `/root/.bashrc` on the server respectively.
    This will add configurations to color code your shell prompt, add helpful aliases, and set up a welcome message when you connect via SSH.