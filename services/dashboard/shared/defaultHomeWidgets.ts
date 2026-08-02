/**
 * Shared contracts for dashboard api, frontend, and host-api.
 * Import as `@shared/...` (see each package's tsconfig / vite alias).
 */

export type HomeWidgetType =
    | 'recents'
    | 'pages'
    | 'services'
    | 'links'
    | 'system'
    | 'packages'
    | 'gatus'
    | 'devices'
    | 'wake'
    | 'clock';

export interface BaseHomeWidget {
    id: string;
    title?: string;
    /** MUI icon name for the widget header */
    icon?: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export type ClockHomeWidget = BaseHomeWidget & {
    type: 'clock';
    data?: {
        clockStyle?: 'digital' | 'analog';
    };
};

export type LinksHomeWidget = BaseHomeWidget & {
    type: 'links';
    data?: {
        cardIds?: string[];
    };
};

export type GenericHomeWidget = BaseHomeWidget & {
    type: Exclude<HomeWidgetType, 'clock' | 'links'>;
    data?: Record<string, unknown>;
};

export type HomeWidget = ClockHomeWidget | LinksHomeWidget | GenericHomeWidget;

export type HomeCard =
    | { id: string; type: 'catalog'; catalogId: string }
    | {
          id: string;
          type: 'custom';
          title: string;
          url: string;
          description?: string;
          /** `mui:IconName` or `emoji:…` */
          icon: string;
      };

export function defaultHomeCards(): HomeCard[] {
    return [
        {
            id: 'card-homelab-repo',
            type: 'custom',
            title: 'Homelab Repo',
            url: 'https://github.com/satsinush/homelab',
            description: 'GitHub repository for homelab infrastructure and services',
            icon: 'mui:Public',
        },
    ];
}

/** Fresh default Home — no migration from legacy sections. */
export function defaultHomeWidgets(): HomeWidget[] {
    // 12-col grid; every item must satisfy 0 ≤ x and x + w ≤ 12, unique ids, no overlaps.
    return [
        { id: 'recents', type: 'recents', x: 0, y: 0, w: 9, h: 4 },
        { id: 'wake', type: 'wake', x: 9, y: 0, w: 3, h: 7 },
        { id: 'services', type: 'services', x: 0, y: 4, w: 4, h: 12 },
        { id: 'system', type: 'system', x: 4, y: 4, w: 5, h: 3 },
        { id: 'packages', type: 'packages', x: 4, y: 7, w: 3, h: 3 },
        { id: 'gatus', type: 'gatus', x: 7, y: 7, w: 2, h: 3 },
        { id: 'links', type: 'links', x: 4, y: 10, w: 5, h: 6, data: { cardIds: ['card-homelab-repo'] } },
        { id: 'devices', type: 'devices', x: 9, y: 7, w: 3, h: 3 },
        { id: 'clock', type: 'clock', x: 9, y: 10, w: 3, h: 6, data: { clockStyle: 'analog' } },
    ];
}
