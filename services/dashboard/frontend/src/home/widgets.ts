import type { HomeCard } from '../types/api';

/** Widget kinds available on the Home dashboard. */
export type HomeWidgetType =
    | 'recents'
    | 'pages'
    | 'services'
    | 'links'
    | 'system'
    | 'packages'
    | 'gatus'
    | 'wake'
    | 'clock';

export interface HomeWidget {
    id: string;
    type: HomeWidgetType;
    /** Optional display title override */
    title?: string;
    /** MUI icon name (from HOME_MUI_ICON_OPTIONS / widget defaults) */
    icon?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Custom link widget only — references homeCards ids */
    cardIds?: string[];
    /** Clock widget only */
    clockStyle?: 'digital' | 'analog';
}

export const HOME_GRID_COLS = 12;
export const HOME_GRID_ROW_HEIGHT = 36;

export const HOME_WIDGET_META: Record<
    HomeWidgetType,
    {
        label: string;
        description: string;
        defaultIcon: string;
        defaultW: number;
        defaultH: number;
        minW: number;
        minH: number;
        maxW?: number;
        maxH?: number;
    }
> = {
    recents: {
        label: 'Recents',
        description: 'Recently opened pages and services',
        defaultIcon: 'Bookmark',
        defaultW: 12,
        defaultH: 3,
        minW: 4,
        minH: 3,
        maxH: 16,
    },
    pages: {
        label: 'Pages',
        description: 'Dashboard pages (also in the nav)',
        defaultIcon: 'Dashboard',
        defaultW: 6,
        defaultH: 5,
        minW: 3,
        minH: 3,
        maxH: 16,
    },
    services: {
        label: 'Services',
        description: 'External service shortcuts',
        defaultIcon: 'Apps',
        defaultW: 12,
        defaultH: 6,
        minW: 4,
        minH: 3,
        maxH: 16,
    },
    links: {
        label: 'Custom links',
        description: 'Your own link collection',
        defaultIcon: 'Link',
        defaultW: 6,
        defaultH: 5,
        minW: 3,
        minH: 3,
        maxH: 16,
    },
    system: {
        label: 'System',
        description: 'CPU, memory, disk, and temperature',
        defaultIcon: 'Speed',
        defaultW: 6,
        defaultH: 4,
        minW: 3,
        minH: 4,
        maxH: 16,
    },
    packages: {
        label: 'Package updates',
        description: 'Pending host package updates',
        defaultIcon: 'Inventory',
        defaultW: 3,
        defaultH: 3,
        minW: 2,
        minH: 3,
        maxH: 16,
    },
    gatus: {
        label: 'Monitored services',
        description: 'Gatus up/down summary',
        defaultIcon: 'MonitorHeart',
        defaultW: 3,
        defaultH: 3,
        minW: 2,
        minH: 3,
        maxH: 16,
    },
    wake: {
        label: 'Wake devices',
        description: 'Wake-on-LAN for favorite devices',
        defaultIcon: 'PowerSettingsNew',
        defaultW: 12,
        defaultH: 3,
        minW: 2,
        minH: 3,
        maxH: 16,
    },
    clock: {
        label: 'Clock',
        description: 'Local date and time',
        defaultIcon: 'Schedule',
        defaultW: 3,
        defaultH: 3,
        minW: 2,
        minH: 3,
        maxH: 16,
    },
};

/** Fresh default Home — no migration from legacy sections. */
export function defaultHomeWidgets(): HomeWidget[] {
    return [
        { id: 'system', type: 'system', x: 0, y: 0, w: 6, h: 4 },
        { id: 'packages', type: 'packages', x: 6, y: 0, w: 3, h: 3 },
        { id: 'gatus', type: 'gatus', x: 9, y: 0, w: 3, h: 3 },
        { id: 'recents', type: 'recents', x: 0, y: 4, w: 9, h: 3 },
        { id: 'clock', type: 'clock', x: 9, y: 4, w: 3, h: 3 },
        { id: 'services', type: 'services', x: 0, y: 7, w: 12, h: 6 },
        { id: 'wake', type: 'wake', x: 0, y: 13, w: 12, h: 3 },
    ];
}

export function widgetTitle(widget: HomeWidget): string {
    return widget.title?.trim() || HOME_WIDGET_META[widget.type].label;
}

export function widgetIconName(widget: HomeWidget): string {
    return widget.icon?.trim() || HOME_WIDGET_META[widget.type].defaultIcon;
}

export function layoutFromWidgets(widgets: HomeWidget[]) {
    return widgets.map((w) => {
        const meta = HOME_WIDGET_META[w.type];
        let h = w.h;
        if (meta.minH != null) h = Math.max(h, meta.minH);
        if (meta.maxH != null) h = Math.min(h, meta.maxH);
        return {
            i: w.id,
            x: w.x,
            y: w.y,
            w: w.w,
            h,
            minW: meta.minW,
            minH: meta.minH,
            maxW: meta.maxW,
            maxH: meta.maxH,
        };
    });
}

/** Single-column stack for narrow viewports (does not mutate stored desktop positions). */
export function stackedMobileLayout(widgets: HomeWidget[]) {
    const sorted = [...widgets].sort(
        (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
    );
    let y = 0;
    return sorted.map((w) => {
        const meta = HOME_WIDGET_META[w.type];
        const h = meta.defaultH;
        const item = {
            i: w.id,
            x: 0,
            y,
            w: 1,
            h,
            minW: 1,
            maxW: 1,
            minH: meta.minH,
            maxH: meta.maxH,
        };
        y += h;
        return item;
    });
}

export function applyLayoutToWidgets(
    widgets: HomeWidget[],
    layout: ReadonlyArray<{ readonly i: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }>
): HomeWidget[] {
    const byId = new Map(layout.map((l) => [l.i, l]));
    return widgets.map((w) => {
        const l = byId.get(w.id);
        if (!l) return w;
        const meta = HOME_WIDGET_META[w.type];
        let h = l.h;
        if (meta.minH != null) h = Math.max(h, meta.minH);
        if (meta.maxH != null) h = Math.min(h, meta.maxH);
        return { ...w, x: l.x, y: l.y, w: l.w, h };
    });
}

export type { HomeCard };
