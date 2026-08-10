import React, { useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import {
    Link as LinkIcon,
    Dashboard as DashboardIcon,
    Devices as DevicesIcon,
    Settings as SettingsIcon,
    People as PeopleIcon,
    Chat as ChatIcon,
    Extension as ExtensionIcon,
    Inventory as PackagesIcon,
    FolderCopy as FilesIcon,
    Key as KeyIcon,
    Home as HomeIcon,
    Cloud as CloudIcon,
    Storage as StorageIcon,
    Security as SecurityIcon,
    Language as LanguageIcon,
    Email as EmailIcon,
    Photo as PhotoIcon,
    MonitorHeart as MonitorHeartIcon,
    Terminal as TerminalIcon,
    Public as PublicIcon,
    Bookmark as BookmarkIcon,
    Star as StarIcon,
    Favorite as FavoriteIcon,
    Build as BuildIcon,
    Speed as SpeedIcon,
    Apps as AppsIcon,
    Schedule as ScheduleIcon,
    PowerSettingsNew as PowerIcon,
    Memory as MemoryIcon,
    Thermostat as ThermostatIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { HomeLinkItem } from '../../homeLinks';

export const NAV_ICONS: Record<string, React.ReactNode> = {
    system: <DashboardIcon />,
    devices: <DevicesIcon />,
    chat: <ChatIcon />,
    wordgames: <ExtensionIcon />,
    packages: <PackagesIcon />,
    files: <FilesIcon />,
    secrets: <KeyIcon />,
    users: <PeopleIcon />,
    settings: <SettingsIcon />,
    link: <LinkIcon />,
    custom: <LinkIcon />,
};

export const MUI_ICON_MAP: Record<string, React.ReactNode> = {
    Link: <LinkIcon />,
    Home: <HomeIcon />,
    Dashboard: <DashboardIcon />,
    Devices: <DevicesIcon />,
    Settings: <SettingsIcon />,
    People: <PeopleIcon />,
    Chat: <ChatIcon />,
    Extension: <ExtensionIcon />,
    Inventory: <PackagesIcon />,
    FolderCopy: <FilesIcon />,
    Key: <KeyIcon />,
    Cloud: <CloudIcon />,
    Storage: <StorageIcon />,
    StorageIcon: <StorageIcon />,
    Security: <SecurityIcon />,
    Language: <LanguageIcon />,
    Email: <EmailIcon />,
    Photo: <PhotoIcon />,
    MonitorHeart: <MonitorHeartIcon />,
    Terminal: <TerminalIcon />,
    Public: <PublicIcon />,
    Bookmark: <BookmarkIcon />,
    Star: <StarIcon />,
    Favorite: <FavoriteIcon />,
    Build: <BuildIcon />,
    Speed: <SpeedIcon />,
    Apps: <AppsIcon />,
    Schedule: <ScheduleIcon />,
    PowerSettingsNew: <PowerIcon />,
    Memory: <MemoryIcon />,
    Thermostat: <ThermostatIcon />,
};

export function renderIconToken(token?: string, fallbackKey = 'link'): React.ReactNode {
    if (!token) return NAV_ICONS[fallbackKey] || <LinkIcon />;
    if (token.startsWith('emoji:')) {
        return (
            <Box component="span" sx={{ fontSize: 22, lineHeight: 1 }}>
                {token.slice('emoji:'.length)}
            </Box>
        );
    }
    if (token.startsWith('mui:')) {
        const name = token.slice('mui:'.length);
        return MUI_ICON_MAP[name] || <LinkIcon />;
    }
    return NAV_ICONS[fallbackKey] || <LinkIcon />;
}

export function useLinkOpen() {
    const navigate = useNavigate();
    return useCallback(
        (link: HomeLinkItem, onOpen: (id: string) => void) => ({
            href: link.href,
            target: link.external ? ('_blank' as const) : undefined,
            rel: link.external ? 'noopener noreferrer' : undefined,
            onMouseDown: (e: React.MouseEvent) => {
                if (e.button === 1) e.stopPropagation();
            },
            onClick: (e: React.MouseEvent) => {
                if (e.button !== 0) return;
                onOpen(link.id);
                if (link.external) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate(link.href);
            },
            onAuxClick: (e: React.MouseEvent) => {
                if (e.button !== 1) return;
                e.stopPropagation();
                onOpen(link.id);
            },
        }),
        [navigate]
    );
}

export function useWidgetHref(href: string | null | undefined, interactive: boolean) {
    const navigate = useNavigate();
    return useMemo(() => {
        if (!interactive || !href) return {};
        const external = /^(?:[a-z0-9+.-]+:)/i.test(href);
        return {
            component: 'a' as const,
            href,
            target: external ? ('_blank' as const) : undefined,
            rel: external ? 'noopener noreferrer' : undefined,
            onMouseDown: (e: React.MouseEvent) => {
                if (e.button === 1) e.stopPropagation();
            },
            onClick: (e: React.MouseEvent) => {
                if (e.button !== 0) return;
                if (external) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate(href);
            },
            onAuxClick: (e: React.MouseEvent) => {
                if (e.button !== 1) return;
                e.stopPropagation();
            },
        };
    }, [href, interactive, navigate]);
}
