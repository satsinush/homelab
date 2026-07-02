import config from '../config';

interface NotificationPayload {
    title: string;
    message: string;
    priority?: number;
    tags?: string[];
}

interface PackageUpdate {
    name: string;
    currentVersion?: string;
    newVersion?: string | null;
    hasUpdate?: boolean;
    status?: string;
}

class AppriseService {
    private appriseUrl: string;

    constructor() {
        this.appriseUrl = config.apprise.url;
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
                tags: ['package', 'update']
            });

            console.log(`Package update notification sent: ${updatesCount} updates available`);
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Failed to send package update notification:', err.message);
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
                signal: AbortSignal.timeout(10000)
            });

            console.log(`Apprise Gateway response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const responseText = await response.text().catch(() => 'Unable to read response');
                throw new Error(`Apprise Gateway request failed: ${response.status} ${response.statusText} - ${responseText}`);
            }

            return true;
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Apprise notification failed:', err.message);
            return false;
        }
    }
}

export default AppriseService;
