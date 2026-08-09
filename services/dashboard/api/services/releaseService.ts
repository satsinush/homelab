import databaseInstance from '../models/Database';
import pkg from '../package.json';

export interface ReleaseInfo {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    htmlUrl: string;
    lastChecked: string;
    cached: boolean;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class ReleaseService {
    public getCurrentVersion(): string {
        return pkg.version || '3.0.0';
    }

    public async getReleaseInfo(forceRefresh = false): Promise<ReleaseInfo> {
        const currentVersion = this.getCurrentVersion();
        const db = databaseInstance.getDatabase();

        if (!forceRefresh) {
            const row = db.prepare('SELECT tag_name, html_url, fetched_at FROM release_cache WHERE id = ?').get('latest') as
                | { tag_name: string; html_url: string; fetched_at: number }
                | undefined;

            if (row && Date.now() - row.fetched_at < CACHE_TTL_MS) {
                const latestVersion = row.tag_name || `v${currentVersion}`;
                const cleanTag = latestVersion.replace(/^v/, '');
                return {
                    currentVersion: `v${currentVersion}`,
                    latestVersion,
                    hasUpdate: Boolean(cleanTag && cleanTag !== currentVersion),
                    htmlUrl: row.html_url || 'https://github.com/satsinush/homelab/releases',
                    lastChecked: new Date(row.fetched_at).toISOString(),
                    cached: true,
                };
            }
        }

        // Live fetch from GitHub
        let fetchedTag = `v${currentVersion}`;
        let htmlUrl = 'https://github.com/satsinush/homelab/releases';
        let isSuccess = false;

        try {
            const res = await fetch('https://api.github.com/repos/satsinush/homelab/releases/latest', {
                headers: {
                    'User-Agent': 'Homelab-Dashboard-Service',
                    Accept: 'application/vnd.github+json',
                },
            });

            if (res.ok) {
                const data = (await res.json()) as { tag_name?: string; name?: string; html_url?: string };
                fetchedTag = data.tag_name || data.name || `v${currentVersion}`;
                if (data.html_url) htmlUrl = data.html_url;
                isSuccess = true;
            }
        } catch {
            // Keep current version fallback
        }

        const now = Date.now();

        if (isSuccess) {
            db.prepare(
                `INSERT INTO release_cache (id, tag_name, html_url, fetched_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   tag_name = excluded.tag_name,
                   html_url = excluded.html_url,
                   fetched_at = excluded.fetched_at`
            ).run('latest', fetchedTag, htmlUrl, now);
        }

        const cleanTag = fetchedTag.replace(/^v/, '');
        return {
            currentVersion: `v${currentVersion}`,
            latestVersion: fetchedTag,
            hasUpdate: Boolean(cleanTag && cleanTag !== currentVersion),
            htmlUrl,
            lastChecked: new Date(now).toISOString(),
            cached: false,
        };
    }
}

export default new ReleaseService();
