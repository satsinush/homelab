## ✅ Post-Installation Checklist

Final configuration steps for individual services.

  * **📜 CA Certificate**
    * Install the generated `homelab-ca.crt` (found in [`./volumes/certificates`](./volumes/certificates/)) on all your client devices to avoid browser security warnings.
  * **🔐 Vaultwarden**
    * Create your primary account. You **must** use the email provided to you by the set up script, otherwise ntfy will not create notifcations for password reset emails and you may lose access to your account. Afterwards, you can optionally set `VAULTWARDEN_SIGNUPS_ALLOWED=false` in your `.env` and restart the container to disable public registration.
    * [Vaultwarden Docs 🔗](https://github.com/dani-garcia/vaultwarden/blob/main/README.md)
  * **📈 Uptime Kuma**
    * Configure notifications to point to your `ntfy` service using the token from `NTFY_ADMIN_TOKENS` in the `.env` file.
    * [Uptime Kuma Docs 🔗](https://github.com/louislam/uptime-kuma/wiki)
  * **🔔 Ntfy**
    * Set the URL to your ntfy domain and log into ntfy with your homelab username and password.
    * Subscribe to the following topics:
      * `homelab-dashboard` topic for package updates.
      * `uptime-kuma` topic for service alerts.
      * `YOUR USERNAME` topic for password reset emails.
    * [Ntfy Docs 🔗](https://docs.ntfy.sh/)
  * **🖥️ RustDesk**
    * Configure your clients by setting the **ID/Relay Server** to your host's IP/domain. The required public key is printed after running [`./setup.sh`](./setup.sh) or can be obtained by running this command: `docker cp rustdesk-id-server:/root/id_ed25519.pub - | tar -xO`
    * [RustDesk Docs 🔗](https://rustdesk.com/docs/)
  * **🚫 Pi-hole**
    * For best results, consider replacing the default adlists with a more lest strict list, such as the [Hagezi Pro list](https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt). Or if you want to block as much as possible use both.
    * You can test if the ad-blocking service is working by going here [AdBlock Tester](https://adblock-tester.com).
    * [Pi-hole Docs 🔗](https://docs.pi-hole.net/)
  * **🔑 Authelia**
    * If you need to recover an account, you can retrieve email verification codes by running subcribing to your `YOUR USERNAME` topic in ntfy.
      * [Authelia Docs 🔗](https://www.authelia.com/integration/prologue/get-started/)
  * **🏠 Homelab Dashboard**
    * You can sign into the homelab dashbooard using either SSO or your local homelab username and password.
  * **📦 Portainer**
    * You can sign into Portainer using either SSO or your local homelab username and password.

### 🎉 Congratulations!

You've officially set up your homelab system! Check out the information below for more details on backing up your data, working on development, and troubleshooting issues.