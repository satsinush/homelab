import { tryApiCall } from './api';
import { HOME_RECENTS_CAP } from '../homeLinks';
import type { UserSettings } from '../types/api';

/** In-memory recents — updated on every visit/click; Home UI snapshots on mount only. */
let memory: string[] | null = null;

/** Serialize recent writes so rapid middle-clicks don't drop ids in this tab. */
let writeChain: Promise<void> = Promise.resolve();

const PATH_TO_CATALOG_ID: Array<{ prefix: string; id: string; exact?: boolean }> = [
    { prefix: '/system', id: 'internal-system', exact: true },
    { prefix: '/devices', id: 'internal-devices', exact: true },
    { prefix: '/chat', id: 'internal-chat', exact: true },
    { prefix: '/wordgames', id: 'internal-wordgames' },
    { prefix: '/packages', id: 'internal-packages', exact: true },
    { prefix: '/files', id: 'internal-files', exact: true },
    { prefix: '/users', id: 'internal-users', exact: true },
    { prefix: '/secrets', id: 'internal-secrets', exact: true },
    { prefix: '/settings', id: 'internal-settings', exact: true },
];

/** Map a dashboard pathname to a builtin home catalog id, if any. */
export function pathToHomeCatalogId(pathname: string): string | null {
    const path = pathname.replace(/\/+$/, '') || '/';
    for (const entry of PATH_TO_CATALOG_ID) {
        if (entry.exact) {
            if (path === entry.prefix) return entry.id;
        } else if (path === entry.prefix || path.startsWith(`${entry.prefix}/`)) {
            return entry.id;
        }
    }
    return null;
}

export function peekHomeRecents(): string[] | null {
    return memory;
}

export function setHomeRecentsMemory(ids: string[]): void {
    memory = ids.slice(0, HOME_RECENTS_CAP);
}

export function clearHomeRecentsMemory(): void {
    memory = [];
}

/** Load recents from API into memory (once per session unless cleared). */
export async function loadHomeRecents(options?: { force?: boolean }): Promise<string[]> {
    if (memory && !options?.force) return memory;
    try {
        const res = await tryApiCall<{ settings: UserSettings }>('/user-settings');
        const ids = Array.isArray(res.data?.settings?.homeRecentIds)
            ? res.data.settings.homeRecentIds
            : [];
        memory = ids.slice(0, HOME_RECENTS_CAP);
    } catch {
        memory = memory ?? [];
    }
    return memory;
}

/**
 * Record a recent link id (catalog id or custom card id).
 * Uses atomic server prepend so multi-tab / rapid middle-clicks don't clobber each other.
 * Does not drive Home UI until remount/refresh.
 */
export function recordHomeRecent(id: string): void {
    if (!id) return;
    memory = [id, ...(memory ?? []).filter((x) => x !== id)].slice(0, HOME_RECENTS_CAP);

    writeChain = writeChain
        .then(async () => {
            const res = await tryApiCall<{ homeRecentIds: string[] }>('/user-settings/recent', {
                method: 'POST',
                data: { id },
            });
            const serverIds = res.data?.homeRecentIds;
            if (Array.isArray(serverIds)) {
                // Keep any optimistic local ids that haven't been ack'd yet at the front,
                // then take server order for the rest.
                const local = memory ?? [];
                const merged = [
                    ...local.filter((x) => !serverIds.includes(x)),
                    ...serverIds,
                ].filter((x, i, arr) => arr.indexOf(x) === i).slice(0, HOME_RECENTS_CAP);
                memory = merged;
            }
        })
        .catch((err) => {
            console.error('Failed to save home recent', err);
        });
}

/** Await pending recent writes (e.g. before Home snapshot / reset). */
export async function flushHomeRecentsNow(): Promise<void> {
    await writeChain;
}
