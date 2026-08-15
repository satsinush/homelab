import type { Hostnames } from './contexts/ConfigContextCore';
import type { HomeCard } from './types/api';

export type HomeLinkKind = 'internal' | 'external';

export interface BuiltinHomeLink {
    id: string;
    title: string;
    description: string;
    kind: HomeLinkKind;
    path?: string;
    url?: (hostnames: Hostnames) => string;
    role?: string;
    color?: 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'error' | 'inherit';
    iconKey: string;
    iconToken?: string;
    logoAlt?: string;
}

export interface HomeLinkItem {
    id: string;
    title: string;
    description: string;
    kind: HomeLinkKind | 'custom' | 'catalog';
    href: string;
    external: boolean;
    color: 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'error' | 'inherit';
    iconKey: string;
    /** Custom card icon token: mui:Name | emoji:… */
    iconToken?: string;
    logoSrc?: string;
    logoAlt?: string;
    editable?: boolean;
}

export const HOME_RECENTS_CAP = 8;

/** Curated MUI icon names for custom cards */
export const HOME_MUI_ICON_OPTIONS = [
    'Link',
    'Home',
    'Dashboard',
    'Devices',
    'Settings',
    'People',
    'Chat',
    'Extension',
    'Inventory',
    'FolderCopy',
    'Key',
    'Cloud',
    'Storage',
    'Security',
    'Language',
    'Email',
    'Photo',
    'MonitorHeart',
    'Terminal',
    'Public',
    'Bookmark',
    'Star',
    'Favorite',
    'Build',
    'Speed',
    'Apps',
    'Schedule',
    'PowerSettingsNew',
    'Memory',
    'Thermostat',
] as const;

export const BUILTIN_HOME_LINKS: BuiltinHomeLink[] = [
    {
        id: 'internal-system',
        title: 'System',
        description: 'View real-time system resources, uptime, and performance metrics',
        kind: 'internal',
        path: '/system',
        color: 'primary',
        role: 'dashboard-system-user',
        iconKey: 'system',
    },
    {
        id: 'internal-devices',
        title: 'Devices',
        description: 'Manage Wake-on-LAN devices and network equipment',
        kind: 'internal',
        path: '/devices',
        color: 'secondary',
        role: 'dashboard-devices-user',
        iconKey: 'devices',
    },
    {
        id: 'internal-chat',
        title: 'AI Chat',
        description: 'Ask questions and run actions with an AI chat bot',
        kind: 'internal',
        path: '/chat',
        color: 'info',
        role: 'dashboard-chat-user',
        iconKey: 'chat',
    },
    {
        id: 'internal-wordgames',
        title: 'Puzzle++',
        description: 'Use solvers for word games like Letterboxed',
        kind: 'internal',
        path: '/wordgames',
        color: 'warning',
        role: 'dashboard-wordgames-user',
        iconKey: 'wordgames',
    },
    {
        id: 'internal-packages',
        title: 'Packages',
        description: 'Install, update, and manage system packages',
        kind: 'internal',
        path: '/packages',
        color: 'success',
        role: 'dashboard-packages-user',
        iconKey: 'packages',
    },
    {
        id: 'internal-files',
        title: 'Sync & Files',
        description: 'Nextcloud and Samba file access',
        kind: 'internal',
        path: '/files',
        color: 'info',
        iconKey: 'files',
    },
    {
        id: 'internal-secrets',
        title: 'Secrets',
        description: 'Manage encrypted secret values',
        kind: 'internal',
        path: '/secrets',
        color: 'warning',
        role: 'dashboard-secrets-user',
        iconKey: 'secrets',
    },
    {
        id: 'internal-users',
        title: 'Users',
        description: 'Manage user accounts, groups, and dashboard permissions',
        kind: 'internal',
        path: '/users',
        color: 'warning',
        role: 'dashboard-users-user',
        iconKey: 'users',
    },
    {
        id: 'internal-settings',
        title: 'Settings',
        description: 'Configure dashboard preferences and system settings',
        kind: 'internal',
        path: '/settings',
        color: 'info',
        iconKey: 'settings',
    },
    {
        id: 'external-pihole',
        title: 'Pi-hole',
        description: 'Network-wide ad blocking and DNS management',
        kind: 'external',
        url: (h) => `https://${h.pihole || ''}/admin`,
        role: 'pihole-user',
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Pi-hole',
    },
    {
        id: 'external-dockhand',
        title: 'Dockhand',
        description: 'Modern Docker management and compose workflows',
        kind: 'external',
        url: (h) => `https://${h.dockhand || ''}`,
        role: 'dockhand-user',
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Dockhand',
    },
    {
        id: 'external-vaultwarden',
        title: 'Vaultwarden',
        description: 'Self-hosted password management solution',
        kind: 'external',
        url: (h) => `https://${h.vaultwarden || ''}`,
        role: 'vaultwarden-user',
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Vaultwarden',
    },
    {
        id: 'external-gatus',
        title: 'Gatus',
        description: 'Self-hosted service health status monitoring',
        kind: 'external',
        url: (h) => `https://${h.gatus || ''}`,
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Gatus',
    },
    {
        id: 'external-gotify',
        title: 'Gotify',
        description: 'Self-hosted push notification server',
        kind: 'external',
        url: (h) => `https://${h.gotify || ''}`,
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Gotify',
    },
    {
        id: 'external-authentik',
        title: 'Authentik',
        description: 'Self-hosted authentication and identity provider',
        kind: 'external',
        url: (h) => `https://${h.authentik || ''}`,
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Authentik',
    },
    {
        id: 'external-nextcloud',
        title: 'Nextcloud',
        description: 'Files, WebDAV, calendar, contacts, and office docs',
        kind: 'external',
        url: (h) => `https://${h.dav || ''}`,
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Nextcloud',
    },
    {
        id: 'external-immich',
        title: 'Immich',
        description: 'Self-hosted photo and video library',
        kind: 'external',
        url: (h) => `https://${h.immich || ''}`,
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Immich',
    },
    {
        id: 'external-stalwart',
        title: 'Stalwart',
        description: 'IMAP/SMTP mail server admin',
        kind: 'external',
        url: (h) => `https://${h.mail || ''}`,
        color: 'primary',
        iconKey: 'logo',
        logoAlt: 'Stalwart',
    },
    {
        id: 'external-clipcascade',
        title: 'ClipCascade',
        description: 'Cross-platform clipboard synchronization',
        kind: 'external',
        url: (h) => `https://${h.clipcascade || ''}`,
        color: 'primary',
        iconKey: 'custom',
        iconToken: 'mui:Assignment',
    },
];

export function resolveBuiltinLinks(
    hostnames: Hostnames,
    hasPermission: (role: string) => boolean,
    logoById: Record<string, string>
): HomeLinkItem[] {
    return BUILTIN_HOME_LINKS.filter((link) => !link.role || hasPermission(link.role)).map((link) => {
        const external = link.kind === 'external';
        return {
            id: link.id,
            title: link.title,
            description: link.description,
            kind: link.kind,
            href: external && link.url ? link.url(hostnames) : link.path || '/',
            external,
            color: link.color || 'primary',
            iconKey: link.iconKey,
            iconToken: link.iconToken,
            logoSrc: logoById[link.id],
            logoAlt: link.logoAlt,
            editable: false,
        };
    });
}

export function resolveHomeCard(
    card: HomeCard,
    catalogById: Map<string, HomeLinkItem>
): HomeLinkItem | null {
    if (card.type === 'catalog') {
        const base = catalogById.get(card.catalogId);
        if (!base) return null;
        return {
            ...base,
            id: card.id,
            kind: 'catalog',
            editable: false,
        };
    }
    return {
        id: card.id,
        title: card.title,
        description: card.description || card.url,
        kind: 'custom',
        href: card.url,
        external: true,
        color: 'primary',
        iconKey: 'custom',
        iconToken: card.icon || 'mui:Link',
        editable: true,
    };
}
