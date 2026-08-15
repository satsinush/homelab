import SystemController from '../controllers/systemController';
import PackageUpdateNotifications from '../models/PackageUpdateNotifications';
import Settings from '../models/Settings';
import AlertsService from './alertsService';
import { getErrorMessage } from '../utils/errors';

/** Wall-clock slots: after pacman-sync at :15 every 6h. */
const CHECK_HOURS = [0, 6, 12, 18] as const;
const CHECK_MINUTE = 30;

type UpdatablePackage = {
    name: string;
    currentVersion: string;
    newVersion: string | null;
    hasUpdate: boolean;
    status: string;
};

class PackageUpdateChecker {
    private systemController: SystemController;
    private notificationService: AlertsService;
    private store: PackageUpdateNotifications;
    private settingsModel: Settings;
    private timeoutId: NodeJS.Timeout | null;
    private isRunning: boolean;
    private nextCheckAt: number | null;

    constructor() {
        this.systemController = new SystemController();
        this.notificationService = new AlertsService();
        this.store = new PackageUpdateNotifications();
        this.settingsModel = new Settings();
        this.timeoutId = null;
        this.isRunning = false;
        this.nextCheckAt = null;
    }

    /** Next local 00/6/12/18:30 after `from`. */
    static nextCheckDate(from: Date = new Date()): Date {
        for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
            for (const hour of CHECK_HOURS) {
                const candidate = new Date(from);
                candidate.setDate(from.getDate() + dayOffset);
                candidate.setHours(hour, CHECK_MINUTE, 0, 0);
                if (candidate.getTime() > from.getTime()) {
                    return candidate;
                }
            }
        }
        const fallback = new Date(from);
        fallback.setDate(from.getDate() + 1);
        fallback.setHours(0, CHECK_MINUTE, 0, 0);
        return fallback;
    }

    private availableVersion(pkg: UpdatablePackage): string {
        return (pkg.newVersion || pkg.currentVersion || '').trim();
    }

    private scheduleNext(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (!this.isRunning) {
            return;
        }

        const next = PackageUpdateChecker.nextCheckDate();
        this.nextCheckAt = next.getTime();
        const delayMs = Math.max(1000, this.nextCheckAt - Date.now());

        console.log(`Next package update check at ${next.toISOString()} (in ${Math.round(delayMs / 60000)}m)`);

        this.timeoutId = setTimeout(() => {
            void this.runScheduledCheck();
        }, delayMs);
    }

    private async runScheduledCheck(): Promise<void> {
        await this.checkForUpdates();
        this.scheduleNext();
    }

    start() {
        if (this.isRunning) {
            console.log('Package update checker is already running');
            return;
        }

        const rows = this.store.list();
        if (rows.length > 0) {
            console.log(`Loaded package notify state: ${rows.length} tracked package(s)`);
        }
        console.log(
            'Starting package update checker (00/6/12/18:30 local, after pacman-sync :15)'
        );
        this.isRunning = true;
        this.scheduleNext();
    }

    stop() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.isRunning = false;
        this.nextCheckAt = null;
        console.log('Package update checker stopped');
    }

    async checkForUpdates() {
        try {
            console.log('Checking for package updates...');

            const packageInfo = await this.systemController.getPackageInfo();
            const packagesWithUpdates = packageInfo.packages.filter(
                pkg => pkg.hasUpdate
            ) as UpdatablePackage[];
            const updatesAvailable = packagesWithUpdates.length;
            const pendingNames = new Set(packagesWithUpdates.map(p => p.name));
            const now = Date.now();

            if (updatesAvailable === 0) {
                if (this.store.list().length > 0) {
                    console.log('All packages are now up to date - clearing notification tracking');
                    this.store.clear();
                } else {
                    console.log('No package updates available');
                }
                return;
            }

            // Drop rows for packages that were installed / no longer pending.
            this.store.syncPending(pendingNames);
            const known = this.store.getMap();

            const changed: UpdatablePackage[] = [];
            const dueForReminder: UpdatablePackage[] = [];

            const cooldownHours = this.settingsModel.getNotificationCooldownHours();
            const cooldownMs = cooldownHours * 60 * 60 * 1000;

            const reminderDays = this.settingsModel.getNotificationReminderDays();
            const reminderMs = reminderDays * 24 * 60 * 60 * 1000;

            // Check when the last package notification of ANY kind was sent
            let mostRecentNotifiedAt = 0;
            for (const row of known.values()) {
                if (row.lastNotifiedAt > mostRecentNotifiedAt) {
                    mostRecentNotifiedAt = row.lastNotifiedAt;
                }
            }

            const timeSinceLastNotification = now - mostRecentNotifiedAt;
            const inCooldown = mostRecentNotifiedAt > 0 && timeSinceLastNotification < cooldownMs;

            for (const pkg of packagesWithUpdates) {
                const ver = this.availableVersion(pkg);
                const row = known.get(pkg.name);
                if (!row || row.notifiedVersion !== ver) {
                    changed.push(pkg);
                } else if (now - row.lastNotifiedAt >= reminderMs) {
                    dueForReminder.push(pkg);
                }
            }

            if (changed.length > 0) {
                if (inCooldown) {
                    console.log(
                        `Found ${changed.length} new/changed package(s), but notification is suppressed due to cooldown (${Math.round((cooldownMs - timeSinceLastNotification) / (1000 * 60 * 60))}h remaining of ${cooldownHours}h minimum cooldown)`
                    );
                    return;
                }

                await this.notificationService.sendPackageUpdateNotification(
                    updatesAvailable,
                    packagesWithUpdates
                );
                // Bump tracked packages so reminder clocks and last notification times are recorded.
                this.store.upsertMany(
                    packagesWithUpdates.map(pkg => ({
                        name: pkg.name,
                        notifiedVersion: this.availableVersion(pkg),
                        lastNotifiedAt: now,
                    }))
                );
                console.log(
                    `Package update notification sent: ${changed.length} new/changed ` +
                        `(${updatesAvailable} total pending)`
                );
                return;
            }

            if (dueForReminder.length > 0) {
                if (inCooldown) {
                    console.log(
                        `${dueForReminder.length} package(s) due for reminder, but notification is suppressed due to cooldown`
                    );
                    return;
                }

                await this.notificationService.sendPackageUpdateNotification(
                    updatesAvailable,
                    packagesWithUpdates
                );
                this.store.upsertMany(
                    packagesWithUpdates.map(pkg => ({
                        name: pkg.name,
                        notifiedVersion: this.availableVersion(pkg),
                        lastNotifiedAt: now,
                    }))
                );
                console.log(
                    `Package update reminder sent: ${dueForReminder.length} package(s) due ` +
                        `(${updatesAvailable} total pending)`
                );
                return;
            }

            console.log(
                `${updatesAvailable} updates available (none new, none due for ${reminderDays}d reminder)`
            );
        } catch (error: unknown) {
            console.error('Package update check failed:', getErrorMessage(error));
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            schedule: '00/6/12/18:30 local',
            nextCheckAt: this.nextCheckAt,
            tracked: this.store.list(),
        };
    }
}

export default PackageUpdateChecker;
