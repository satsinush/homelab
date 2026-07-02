import SystemController from '../controllers/systemController';
import AppriseService from './appriseService';

class PackageUpdateChecker {
    private systemController: SystemController;
    private notificationService: AppriseService;
    private intervalId: NodeJS.Timeout | null;
    private isRunning: boolean;
    private lastNotificationTime: number | null;
    private lastNotifiedPackages: Set<string>;
    private checkIntervalMs: number;
    private minNotificationIntervalMs: number;

    constructor() {
        this.systemController = new SystemController();
        this.notificationService = new AppriseService();
        this.intervalId = null;
        this.isRunning = false;
        this.lastNotificationTime = null;
        this.lastNotifiedPackages = new Set<string>(); // Track which packages we've already notified about
        this.checkIntervalMs = 60 * 60 * 1000; // 1 hour
        this.minNotificationIntervalMs = 24 * 60 * 60 * 1000; // 24 hours minimum between notifications
    }

    start() {
        if (this.isRunning) {
            console.log('Package update checker is already running');
            return;
        }

        console.log('Starting package update checker (checking every hour)');
        this.isRunning = true;

        // Run initial check after 5 minutes
        setTimeout(() => this.checkForUpdates(), 5 * 60 * 1000);

        // Set up hourly interval
        this.intervalId = setInterval(() => {
            this.checkForUpdates();
        }, this.checkIntervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('Package update checker stopped');
    }

    async checkForUpdates() {
        try {
            console.log('Checking for package updates...');
            
            const packageInfo = await this.systemController.getPackageInfo();
            const packagesWithUpdates = packageInfo.packages.filter((pkg: any) => pkg.hasUpdate);
            const updatesAvailable = packagesWithUpdates.length;
            
            if (updatesAvailable > 0) {
                // Create a set of current packages that need updates
                const currentPackageNames = new Set(packagesWithUpdates.map((pkg: any) => pkg.name));
                
                // Check if there are any new packages that need updates
                const newPackages = packagesWithUpdates.filter((pkg: any) => !this.lastNotifiedPackages.has(pkg.name));
                const hasNewUpdates = newPackages.length > 0;
                
                // Check if enough time has passed since last notification
                const now = Date.now();
                const timeSinceLastNotification = this.lastNotificationTime ? (now - this.lastNotificationTime) : Infinity;
                const enoughTimePassed = timeSinceLastNotification >= this.minNotificationIntervalMs;
                
                if (hasNewUpdates || (!this.lastNotificationTime && updatesAvailable > 0)) {
                    // Send notification for new updates or first-time discovery
                    await this.notificationService.sendPackageUpdateNotification(
                        updatesAvailable, 
                        packagesWithUpdates
                    );
                    
                    this.lastNotificationTime = now;
                    this.lastNotifiedPackages = currentPackageNames as Set<string>;
                    
                    if (hasNewUpdates) {
                        console.log(`Package update notification sent: ${newPackages.length} new updates (${updatesAvailable} total)`);
                    } else {
                        console.log(`Package update notification sent: ${updatesAvailable} updates available (first check)`);
                    }
                } else if (enoughTimePassed && updatesAvailable > 0) {
                    // Send reminder notification after 6+ hours even for same packages
                    await this.notificationService.sendPackageUpdateNotification(
                        updatesAvailable, 
                        packagesWithUpdates
                    );
                    
                    this.lastNotificationTime = now;
                    this.lastNotifiedPackages = currentPackageNames as Set<string>;
                    
                    const hoursSinceLastNotification = Math.round(timeSinceLastNotification / (60 * 60 * 1000));
                    console.log(`Package update reminder sent: ${updatesAvailable} updates still pending (${hoursSinceLastNotification}h since last notification)`);
                } else {
                    const hoursSinceLastNotification = Math.round(timeSinceLastNotification / (60 * 60 * 1000));
                    console.log(`${updatesAvailable} updates available (same packages), but notification was sent ${hoursSinceLastNotification}h ago`);
                }
            } else {
                // No updates available - clear the tracking
                if (this.lastNotifiedPackages.size > 0) {
                    console.log('All packages are now up to date - clearing notification tracking');
                    this.lastNotifiedPackages.clear();
                } else {
                    console.log('No package updates available');
                }
            }
        } catch (error: any) {
            console.error('Package update check failed:', error.message);
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkIntervalMs,
            lastNotificationTime: this.lastNotificationTime,
            lastNotifiedPackages: Array.from(this.lastNotifiedPackages),
            nextCheckIn: this.intervalId ? this.checkIntervalMs : null
        };
    }
}

export default PackageUpdateChecker;
