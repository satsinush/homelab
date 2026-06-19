## 💻 Host Machine Configuration

Before deploying the Docker stack, we need to secure the host machine by enabling and hardening SSH, configuring the firewall, and setting up a VPN.
Follow these steps to prepare the host server.

### 1\. 🔒 SSH Access

For a secure setup, we will configure SSH to use **key-based authentication only**. This makes it much more difficult for an attacker to gain access.

**Step 1: Set Up SSH Server**

First, make sure the SSH server is installed and running.

1. **On the server**, run this command to install the SSH service if you haven't already:
   ```shell
   sudo pacman -S openssh
   ```

2. Start and enable the service:
   ```shell
   sudo systemctl enable --now sshd
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

    ```shell
    sudo nano /etc/ssh/sshd_config
    ```

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

### 2. Firewall (firewalld) Setup 🛡️

These instructions configure **firewalld** to secure the server. This assumes your primary physical LAN interface is `end0`, your WireGuard interface is `wg0`, and your custom Docker bridge network interface is `br-homelab-net`.

**Prerequisites:**

* LAN Subnet: `10.10.10.0/24` (associated with the `end0` interface)
* VPN Subnet: `10.10.20.0/24` (associated with the `wg0` interface)
* Docker Subnet: `10.10.30.0/24` (associated with the `br-homelab-net` interface)

**Step 1: Install and Initialize firewalld**

First, ensure the tool is installed, active, and configured to start automatically at boot.

```shell
# Install firewalld natively from core repositories
sudo pacman -S firewalld --needed --noconfirm

# Start and enable the daemon immediately
sudo systemctl enable --now firewalld
```

**Step 2: Assign Interfaces to Zones**

We will isolate our network segments by dropping them into distinct, explicit firewalld zones to avoid weak default configurations:

* `local`: For our trusted home physical LAN network.
* `public`: For the public-facing internet gateway and WireGuard endpoint tracking.
* `docker`: For our isolated container communication loop.

```shell
# Create the custom zones first
sudo firewall-cmd --permanent --new-zone=local
sudo firewall-cmd --permanent --new-zone=docker
sudo firewall-cmd --reload

# Assign the physical LAN interface and subnet to the local zone
sudo firewall-cmd --permanent --zone=local --add-interface=end0
sudo firewall-cmd --permanent --zone=local --add-source=10.10.10.0/24

# Set up the isolated docker zone for our container bridge
sudo firewall-cmd --permanent --zone=docker --add-source=10.10.30.0/24
```

**Step 3: Define Custom System Definitions**

Since we changed our default SSH port to `2222`, let's create custom definitions for our services so the firewall rules remain clean and scannable.

```shell
# Create a modified SSH entry tracking port 2222
sudo firewall-cmd --permanent --new-service=ssh-custom
sudo firewall-cmd --permanent --service=ssh-custom --set-description="Custom SSH Port for Homelab Access"
sudo firewall-cmd --permanent --service=ssh-custom --add-port=2222/tcp

# Create a service entry tracking RustDesk relay loops
sudo firewall-cmd --permanent --new-service=rustdesk
sudo firewall-cmd --permanent --service=rustdesk --set-description="RustDesk Self-Hosted Remote Desktop"
sudo firewall-cmd --permanent --service=rustdesk --add-port=21114-21119/tcp
sudo firewall-cmd --permanent --service=rustdesk --add-port=21116/udp
```

**Step 4: Configure Rules for the Local, Public, and Docker Zones**

Now, open access paths specifically for your defined subnets using strict zero-trust isolation boundaries.

```shell
# --- PUBLIC ZONE (The Internet Endpoint) ---
# Allow incoming WireGuard handshakes from anywhere on the internet
sudo firewall-cmd --permanent --zone=public --add-port=51820/udp

# --- LOCAL ZONE RULES (Physical LAN Clients) ---
# Allow full SSH, Web traffic, DNS queries, and RustDesk from native home devices
sudo firewall-cmd --permanent --zone=local --add-service=ssh-custom
sudo firewall-cmd --permanent --zone=local --add-service=http
sudo firewall-cmd --permanent --zone=local --add-service=https
sudo firewall-cmd --permanent --zone=local --add-service=dns
sudo firewall-cmd --permanent --zone=local --add-service=rustdesk
sudo firewall-cmd --permanent --zone=local --add-port=51820/udp

# --- INTER-ZONE RICH RULES (VPN Client Access to Local Host Space) ---
# Allow WireGuard clients (10.10.20.0/24) landing on 'public' to securely cross into local services
sudo firewall-cmd --permanent --zone=local --add-rich-rule='rule family="ipv4" source address="10.10.20.0/24" service name="ssh-custom" accept'
sudo firewall-cmd --permanent --zone=local --add-rich-rule='rule family="ipv4" source address="10.10.20.0/24" service name="http" accept'
sudo firewall-cmd --permanent --zone=local --add-rich-rule='rule family="ipv4" source address="10.10.20.0/24" service name="https" accept'
sudo firewall-cmd --permanent --zone=local --add-rich-rule='rule family="ipv4" source address="10.10.20.0/24" service name="dns" accept'
sudo firewall-cmd --permanent --zone=local --add-rich-rule='rule family="ipv4" source address="10.10.20.0/24" service name="rustdesk" accept'

# --- DOCKER ZONE RULES (Container Leashes) ---
# Allow containers to resolve queries via host DNS (Pi-hole) and hit the custom host instrumentation API
sudo firewall-cmd --permanent --zone=docker --add-service=dns
sudo firewall-cmd --permanent --zone=docker --add-rich-rule='rule family="ipv4" source address="10.10.30.0/24" port port="5001" protocol="tcp" accept'

# Force firewalld to allow containers to pass out to public DNS mirrors (UDP 53).
# This prevents BuildKit from throwing a 'DNS: transient error (exit code 4)' during 'apk update' tasks.
sudo firewall-cmd --permanent --zone=docker --add-rich-rule='rule family="ipv4" source address="10.10.30.0/24" destination address="0.0.0.0/0" port port="53" protocol="udp" accept'
```

**Step 5: Establish Forwarding and Routing Policies**

To manage isolated routing paths between our custom interface zones, we use explicit firewalld **Policies**.

```shell
# 1. Enable Masquerading (NAT) on BOTH the public and local interfaces so traffic can masquerade out cleanly
sudo firewall-cmd --permanent --zone=public --add-masquerade
sudo firewall-cmd --permanent --zone=local --add-masquerade

# 2. Explicitly grant VPN clients landing on 'public' permission to forward packets 
# out through your physical home gateway interface sitting in the 'local' zone
sudo firewall-cmd --permanent --new-policy=vpn-to-lan
sudo firewall-cmd --permanent --policy=vpn-to-lan --add-ingress-zone=public
sudo firewall-cmd --permanent --policy=vpn-to-lan --add-egress-zone=local
sudo firewall-cmd --permanent --policy=vpn-to-lan --set-target=ACCEPT

# 3. Create a policy allowing physical LAN devices to explicitly initialize connections back to VPN peers
sudo firewall-cmd --permanent --new-policy=lan-to-vpn
sudo firewall-cmd --permanent --policy=lan-to-vpn --add-ingress-zone=local
sudo firewall-cmd --permanent --policy=lan-to-vpn --add-egress-zone=public
sudo firewall-cmd --permanent --policy=lan-to-vpn --set-target=ACCEPT

# 4. Create an inter-zone policy explicitly allowing your isolated Docker subnets 
# to forward tracking packets out through your public WAN/VPN physical interfaces.
sudo firewall-cmd --permanent --new-policy=docker-to-any
sudo firewall-cmd --permanent --policy=docker-to-any --add-ingress-zone=docker
sudo firewall-cmd --permanent --policy=docker-to-any --add-egress-zone=local
sudo firewall-cmd --permanent --policy=docker-to-any --add-egress-zone=public
sudo firewall-cmd --permanent --policy=docker-to-any --set-target=ACCEPT
```

**Step 6: Apply and Validate Settings**

Reload the running configurations into the kernel memory and inspect your work:

```shell
# Force firewalld to parse all changes into production tables
sudo firewall-cmd --reload

# Output active run-time configurations for verification
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --zone=local --list-all
sudo firewall-cmd --zone=docker --list-all
```

---

### 3. 🔒 WireGuard VPN Setup

This guide sets up a WireGuard VPN, allowing secure remote access to your server and local network assets.

**Step 1: Generate Keys**

WireGuard uses public-key cryptography for security. We need to generate a private and public key for the server and for each client (peer) that connects.

1. Navigate to the WireGuard directory and set secure file permissions:

```shell
sudo -i
cd /etc/wireguard
umask 077
```

2. Generate the server's cryptographic key pair:

```shell
wg genkey | tee server.private | wg pubkey > server.public
```

3. Generate a key pair for each client (e.g., for `my-phone`). Repeat this step for every external device you intend to provision:

```shell
wg genkey | tee my-phone.private | wg pubkey > my-phone.public
```

4. View your keys whenever needed using `cat`:

```shell
cat server.public
```

**Step 2: Configure the Server**

Because **firewalld** gracefully manages NAT masquerading and forward topologies dynamically at the kernel layer via the policies we built in Section 2, **you no longer need to clog your WireGuard configs with volatile, manual `iptables` rules.**

1. Initialize your configuration file layout:

```shell
sudo nano /etc/wireguard/wg0.conf
```

2. Populate the parameters using the keys you generated:

**Example `wg0.conf`:**

```ini
[Interface]
# Server's private cryptographic key (from server.private)
PrivateKey = <PASTE_SERVER_PRIVATE_KEY>
Address = 10.10.20.1/24
ListenPort = 51820

# --- PEER 1: MY-PHONE ---
[Peer]
# Client's public cryptographic verification key (from my-phone.public)
PublicKey = <PASTE_MY-PHONE_PUBLIC_KEY>
# The permanent internal IP allocated to this specific client
AllowedIPs = 10.10.20.13/32
```

> **ℹ️ Tip**: It is excellent administration practice to align your client's VPN IP configuration with its physical LAN reservation profile. For example, a laptop that sits at `10.10.10.13` while on the home Wi-Fi should be assigned `10.10.20.13` when hitting the encrypted tunnel matrix.

**Step 3: Enable Kernel IP Forwarding**

For network traffic to transition smoothly between your VPN clients, local interfaces, and outside internet nodes, the underlying Linux system must have packet routing authorized.

* Commit a permanent kernel parameter configuration baseline:

```shell
echo "net.ipv4.ip_forward=1" | sudo tee /etc/sysctl.d/40-ipv4-forward.conf
```

**Step 4: Configure Your Network Router**

1. **Port Forwarding:** Inside your master edge router's interface configuration panel, forward **UDP port 51820** straight to the fixed local static IP address of this server (e.g., `10.10.10.10`).
2. **DHCP Reservation:** Lock down your server's MAC address to a permanent lease layout inside your home router so its primary routing pathing coordinates can never shift on a reboot cycle.
3. **Static Routing:** Add a static network route entry to your primary router instructing it to point all traffic bound for the VPN client subnet (`10.10.20.0/24`) straight to this server's LAN IP address (`10.10.10.10`) as the definitive next-hop node.

**Step 5: Associate the Dynamic WireGuard Interface to Firewalld**

We want firewalld to automatically catch the `wg0` interface when it initializes and map it to our secure policies.

```shell
# Instruct firewalld to permanently treat wg0 and its subnet as part of the public gateway zone
sudo firewall-cmd --permanent --zone=public --add-interface=wg0
sudo firewall-cmd --permanent --zone=public --add-source=10.10.20.0/24
sudo firewall-cmd --reload
```

**Step 6: Start and Enable the Service Engine**

Apply the core kernel settings and initialize your runtime interface:

```shell
# Force the system to reload network parameter hooks from sysctl configuration files
sudo sysctl --system

# Start your newly optimized interface and set it to execute on system boot
sudo systemctl enable --now wg-quick@wg0
```

* **Docs:** [WireGuard Quickstart 🔗](https://www.wireguard.com/quickstart/)

---

### 4\. DNS Configuration

1.  **`dhcpcd.conf`**: Configure `/etc/dhcpcd.conf` to prevent the DHCP client from overwriting your custom DNS settings. See [`./dns/dhcpcd.conf`](../dns/dhcpcd.conf) as an example.
2.  **`resolv.conf`**: Configure `/etc/resolv.conf` to prioritize the local Pi-hole resolver while providing a backup DNS for when Pi-hole is not running. See [`./dns/resolv.conf`](../dns/resolv.conf) as an example.
3.  **`resolved.conf`**: Configure `/etc/systemd/resolved.conf` to disable the systemd stub listener on port 53. This is necessary to free up port 53 so that Pi-hole can use it to answer DNS queries. See [`./dns/resolved.conf`](../dns/resolved.conf) as an example.

Apply changes with these commands.

```shell
# Restarts the systemd service that handles DNS resolution
sudo systemctl restart systemd-resolved.service

# Restarts the DHCP client daemon to apply its new configuration
sudo systemctl restart dhcpcd.service
```

### 5. Additional Shell Configurations (Optional)

Follow these steps to add additional functionality to your shell.

1.  **.bashrc**: Add the lines inside [`./bashrc/user.bashrc`](../bashrc/user.bashrc) and [`./bashrc/root.bashrc`](../bashrc/root.bashrc) to `~/.bashrc` and `/root/.bashrc` on the server respectively.
    This will add configurations to color code your shell prompt, add helpful aliases, and set up a welcome message when you connect via SSH.

2. **.bash_profile**: Add this to `~/.bash_profile` (or `/root/.bash_profile` for root):

```bash
#
# ~/.bash_profile
#

[[ -f ~/.bashrc ]] && . ~/.bashrc
```

## Next: 3\. 🚀 Deploy the Services
[Continue to the next section of the guide for detailed instructions on deploying the homelab services.](./3-deployment.md)