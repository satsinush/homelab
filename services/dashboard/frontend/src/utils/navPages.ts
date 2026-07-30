/** Dashboard pages that can be chosen as the default landing page. */

export interface NavPageOption {
    id: string;
    label: string;
    path: string;
    /** If set, user needs this role (or homelab-admin). */
    role?: string;
}

export const NAV_PAGE_OPTIONS: NavPageOption[] = [
    { id: 'home', label: 'Home', path: '/home' },
    { id: 'system', label: 'System', path: '/system', role: 'dashboard-system-user' },
    { id: 'devices', label: 'Devices', path: '/devices', role: 'dashboard-devices-user' },
    { id: 'chat', label: 'AI Chat', path: '/chat', role: 'dashboard-chat-user' },
    { id: 'wordgames', label: 'Puzzle++', path: '/wordgames', role: 'dashboard-wordgames-user' },
    { id: 'packages', label: 'Packages', path: '/packages', role: 'dashboard-packages-user' },
    { id: 'files', label: 'Sync & Files', path: '/files' },
    { id: 'users', label: 'Users', path: '/users', role: 'dashboard-users-user' },
    { id: 'secrets', label: 'Secrets', path: '/secrets', role: 'dashboard-secrets-user' },
    { id: 'settings', label: 'Settings', path: '/settings' },
    { id: 'profile', label: 'Profile', path: '/profile' },
];

export function getNavPage(id: string | null | undefined): NavPageOption | undefined {
    if (!id) return undefined;
    return NAV_PAGE_OPTIONS.find((p) => p.id === id);
}

export function canAccessNavPage(
    page: NavPageOption,
    hasPermission: (role: string) => boolean
): boolean {
    if (!page.role) return true;
    return hasPermission(page.role);
}

/** Pages the current user may set as their default home. */
export function allowedDefaultHomePages(
    hasPermission: (role: string) => boolean
): NavPageOption[] {
    return NAV_PAGE_OPTIONS.filter((p) => canAccessNavPage(p, hasPermission));
}

/**
 * Resolve a stored defaultHomePage id to a path the user can open.
 * Returns `{ pageId, path, reset }` — `reset` is true if the stored value was invalid.
 */
export function resolveDefaultHome(
    storedId: string | null | undefined,
    hasPermission: (role: string) => boolean
): { pageId: string; path: string; reset: boolean } {
    const home = getNavPage('home')!;
    const page = getNavPage(storedId);
    if (page && canAccessNavPage(page, hasPermission)) {
        return { pageId: page.id, path: page.path, reset: false };
    }
    return { pageId: home.id, path: home.path, reset: Boolean(storedId && storedId !== 'home') };
}
