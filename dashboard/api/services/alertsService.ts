import config from '../config';

import { getErrorMessage } from '../utils/errors';

interface NotificationPayload {
    title: string;
    message: string;
    priority?: number;
    tags?: string[];
    clickUrl?: string;
}

interface PackageUpdate {
    name: string;
    currentVersion?: string;
    newVersion?: string | null;
    hasUpdate?: boolean;
    status?: string;
}

class AlertsService {
    private alertsUrl: string;

    constructor() {
        this.alertsUrl = config.alerts.url;
    }

    async sendPackageUpdateNotification(updatesCount: number, packages: PackageUpdate[] = []) {
        try {
            const title = `${updatesCount} Package Update${updatesCount > 1 ? 's' : ''} Available`;
            const message = updatesCount <= 5
                ? `Updates available for: ${packages.slice(0, 5).map(pkg => pkg.name).join(', ')}`
                : `${updatesCount} packages have updates available. Check the dashboard for details.`;

            await this.sendNotification({
                title,
                message,
                priority: 3,
                tags: ['package', 'update'],
                clickUrl: `https://${config.dashBoardWebHostname}/packages`
            });

            console.log(`Package update notification sent: ${updatesCount} updates available`);
        } catch (error: unknown) {
            console.error('Failed to send package update notification:', getErrorMessage(error));
        }
    }

    async sendNotification({ title, message, priority = 3, tags = [], clickUrl }: NotificationPayload): Promise<boolean> {
        try {
            const url = `${this.alertsUrl}/dashboard`;
            console.log(`Sending alert notification to: ${url}`);
            console.log(`Notification content:`, { title, message, priority, tags, clickUrl });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    message,
                    priority,
                    tags,
                    ...(clickUrl ? { click_url: clickUrl } : {})
                }),
                signal: AbortSignal.timeout(10000)
            });

            console.log(`Alerts gateway response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const responseText = await response.text().catch(() => 'Unable to read response');
                throw new Error(`Alerts gateway request failed: ${response.status} ${response.statusText} - ${responseText}`);
            }

            return true;
        } catch (error: unknown) {
            console.error('Alert notification failed:', getErrorMessage(error));
            return false;
        }
    }
}

export default AlertsService;
