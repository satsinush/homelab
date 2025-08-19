const { response } = require('express');
const config = require('../config');

class NtfyService {
    constructor() {
        this.ntfyUrl = config.ntfy.url;
        this.adminToken = config.ntfy.adminToken;
    }

    async sendPackageUpdateNotification(updatesCount, packages = []) {
        try {
            const title = `${updatesCount} Package Update${updatesCount > 1 ? 's' : ''} Available`;
            const message = updatesCount <= 5 
                ? `Updates available for: ${packages.slice(0, 5).map(pkg => pkg.name).join(', ')}`
                : `${updatesCount} packages have updates available. Check the dashboard for details.`;

            await this.sendNotification('homelab-dashboard', {
                title,
                message,
                priority: 3,
                tags: ['package', 'update']
            });

            console.log(`Package update notification sent: ${updatesCount} updates available`);
        } catch (error) {
            console.error('Failed to send package update notification:', error.message);
        }
    }

    async sendNotification(topic, { title, message, priority = 3, tags = [] }) {
        try {
            // Extract token from "user:token" format and create auth header
            let authHeader = null;
            if (this.adminToken) {
                if (this.adminToken.includes(':')) {
                    authHeader = `Bearer ${this.adminToken.split(":")[1]}`;
                } else {
                    authHeader = `Bearer ${this.adminToken}`;
                }
            }
            
            const url = `${this.ntfyUrl}/${topic}`;
            console.log(`Sending NTFY notification to: ${url}`);
            console.log(`Using NTFY auth header: ${authHeader}`);
            console.log(`Notification content:`, { title, message, priority, tags });

            // Prepare headers according to ntfy documentation
            const headers = {
                'Content-Type': 'text/plain',
                ...(authHeader && { 'Authorization': authHeader }),
                ...(title && { 'X-Title': title }),
                ...(priority && { 'X-Priority': priority.toString() }),
                ...(tags && tags.length > 0 && { 'X-Tags': tags.join(',') })
            };

            console.log(`Request headers:`, headers);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: message, // Send message as plain text body
                timeout: 10000 // 10 second timeout
            });

            console.log(`NTFY response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const responseText = await response.text().catch(() => 'Unable to read response');
                throw new Error(`NTFY request failed: ${response.status} ${response.statusText} - ${responseText}`);
            }

            const responseText = await response.text();
            console.log(`NTFY response body: ${responseText}`);
            return true;
        } catch (error) {
            console.error('NTFY notification failed:', error.message);
            console.error('Full error:', error);
            
            // Provide more specific error messages
            if (error.code === 'ECONNREFUSED') {
                console.error('Connection refused - NTFY server may not be running or accessible');
            } else if (error.code === 'ENOTFOUND') {
                console.error('Host not found - check NTFY URL configuration');
            } else if (error.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
                console.error('SSL version mismatch - likely trying HTTPS on HTTP port. Check if URL should use http:// instead of https://');
            } else if (error.name === 'FetchError') {
                console.error('Network error - check network connectivity to NTFY server');
            }
            
            return false;
        }
    }
}

module.exports = NtfyService;
