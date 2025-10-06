## ❓ Troubleshooting

This section covers common issues you might encounter and how to resolve them.

### A service is unreachable or a domain won't resolve

This usually indicates a problem with DNS or the firewall.

  * **1. Check Client DNS:** Ensure the device you are using has its DNS server set to the IP address of your Pi-hole. You can test if the domain is resolving correctly by running `ping vaultwarden.your.domain`. It should return the IP of your homelab server.
  * **2. Check Firewall Rules:** Verify that your firewall is not blocking the connection. Run `sudo ufw status` on the server and make sure the necessary ports (like `80`, `443`, `53`) are allowed from your IP address or subnet.

-----

### My browser shows a security warning (e.g., "Your connection is not private")

This happens because your browser doesn't trust your self-generated Certificate Authority (CA).

  * **Solution:** You must install the root CA certificate on all devices that will access the homelab services. The certificate is located at `./volumes/certificates/homelab-ca.crt`. Import this file into your browser's or operating system's trust store.

-----

### A webpage is behaving strangely, not updating, or I'm in a login loop

This is almost always caused by your browser's cache or old cookies, especially with an SSO system like Authelia.

  * **1. Force Refresh:** The quickest fix is to bypass the cache with a hard refresh. Press **`Ctrl+F5`** (or **`Cmd+Shift+R`** on Mac).
  * **2. Clear Site Data:** If a hard refresh doesn't work, clear the cookies and site data for the specific domain in your browser's settings and try again.

-----

### A container is failing to start or is in a restart loop

This typically points to a misconfiguration in your `.env` file, a port conflict, or a file permission issue.

  * **Solution:** The definitive way to diagnose this is to check the container's logs. Run the following command, replacing `<container-name>` with the name of the failing service (e.g., `vaultwarden`).
    ```shell
    docker compose logs <container-name>
    ```
    Look for any lines that start with `Error`, `Fatal`, or mention `Permission Denied`.

-----

### I'm seeing an HTTP error like '404 Not Found' or '502 Bad Gateway'

These errors mean the request reached nginx, but it couldn't be completed.

  * **Cause (404 Not Found):** The reverse proxy received the request but has no configuration for that specific domain. Check your NGINX configuration file for typos in the hostname.
  * **Cause (502 Bad Gateway):** The reverse proxy has a rule, but it cannot communicate with the backend service container. This usually means the service container is stopped, unhealthy, or not on the same Docker network.

  * **Solution:** Check the logs of nginx container for specific error messages.

    ```shell
    docker compose logs nginx
    ```

-----

### Ads are not being blocked on a specific device

This happens when a device's DNS requests are bypassing your Pi-hole.

1.  **Verify Client DNS Settings:** Ensure the device is configured to use your Pi-hole's IP as its **only** DNS server. Remove any secondary servers like `8.8.8.8` or `1.1.1.1`.

2.  **Disable "Secure DNS" in Your Browser:** Most modern browsers have a **DNS-over-HTTPS (DoH)** feature that bypasses Pi-hole entirely. You must disable it in your browser's security settings.