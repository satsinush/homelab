import config from '../config';

interface NotificationPayload {
    title: string;
    message: string;
    priority?: number;
    tags?: string[];
}

class AppriseService {
    private appriseUrl: string;

    constructor() {
        this.appriseUrl = config.apprise.url;
    }

    async sendPackageUpdateNotification(updatesCount: number, packages: any[] = []) {
        try {
            const title = `${updatesCount} Package Update${updatesCount > 1 ? 's' : ''} Available`;
            const message = updatesCount <= 5 
                ? `Updates available for: ${packages.slice(0, 5).map(pkg => pkg.name).join(', ')}`
                : `${updatesCount} packages have updates available. Check the dashboard for details.`;

            await this.sendNotification({
                title,
                message,
                priority: 3,
                tags: ['package', 'update']
            });

            console.log(`Package update notification sent: ${updatesCount} updates available`);
        } catch (error: any) {
            console.error('Failed to send package update notification:', error.message);
        }
    }

    async sendNotification({ title, message, priority = 3, tags = [] }: NotificationPayload): Promise<boolean> {
        try {
            const url = `${this.appriseUrl}/alerts/dashboard`;
            console.log(`Sending alert notification to: ${url}`);
            console.log(`Notification content:`, { title, message, priority, tags });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    message,
                    priority,
                    tags
                }),
                // @ts-ignore
                timeout: 10000 // 10 second timeout
            });

            console.log(`Apprise Gateway response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const responseText = await response.text().catch(() => 'Unable to read response');
                throw new Error(`Apprise Gateway request failed: ${response.status} ${response.statusText} - ${responseText}`);
            }

            return true;
        } catch (error: any) {
            console.error('Apprise notification failed:', error.message);
            return false;
        }
    }
}

export default AppriseService;
