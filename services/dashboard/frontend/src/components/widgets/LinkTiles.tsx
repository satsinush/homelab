import React, { useCallback, useMemo } from 'react';
import { Avatar, Box, IconButton, Stack, Typography } from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
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

export function LinkIconMark({ link, size = 40 }: { link: HomeLinkItem; size?: number }) {
    if (link.logoSrc) {
        return (
            <Box
                sx={{
                    width: size,
                    height: size,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    p: 0.5,
                }}
            >
                <Box
                    component="img"
                    src={link.logoSrc}
                    alt={link.logoAlt || link.title}
                    sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
            </Box>
        );
    }
    return (
        <Avatar sx={{ width: size, height: size, bgcolor: `${link.color}.main`, flexShrink: 0 }}>
            {link.iconToken ? renderIconToken(link.iconToken) : NAV_ICONS[link.iconKey] || <LinkIcon />}
        </Avatar>
    );
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
                if (e.button === 1) e.stopPropagation();
            },
        };
    }, [href, interactive, navigate]);
}

export function RecentTile({
    link,
    onOpen,
    disabled,
}: {
    link: HomeLinkItem;
    onOpen: (id: string) => void;
    disabled?: boolean;
}) {
    const bind = useLinkOpen()(link, onOpen);
    const sx = {
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        py: 0.85,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        textDecoration: 'none',
        color: 'inherit',
        width: { xs: 'calc(50% - 4px)', md: 168 },
        flex: { xs: '0 0 calc(50% - 4px)', md: '0 0 168px' },
        minWidth: 0,
        maxWidth: '100%',
        height: 48,
        boxSizing: 'border-box' as const,
        overflow: 'hidden',
        transition: 'all 0.18s ease-in-out',
        ...(disabled
            ? { pointerEvents: 'none' as const, opacity: 0.85 }
            : {
                  '&:hover': {
                      bgcolor: 'action.hover',
                      borderColor: 'primary.main',
                      transform: 'translateY(-1.5px)',
                      boxShadow: 2,
                  },
              }),
    };
    const inner = (
        <>
            <LinkIconMark link={link} size={30} />
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, minWidth: 0, flex: 1 }}>
                {link.title}
            </Typography>
        </>
    );
    if (disabled) return <Box sx={sx}>{inner}</Box>;
    return (
        <Box component="a" {...bind} draggable={false} sx={sx}>
            {inner}
        </Box>
    );
}

export function ServiceTile({
    link,
    onOpen,
    editing,
    onEdit,
    onDelete,
}: {
    link: HomeLinkItem;
    onOpen: (id: string) => void;
    editing?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
}) {
    const bind = useLinkOpen()(link, onOpen);
    const inner = (
        <>
            {editing && (onEdit || onDelete) && (
                <Stack
                    direction="row"
                    spacing={0}
                    sx={{ position: 'absolute', top: 2, right: 2, zIndex: 2 }}
                >
                    {onEdit && (
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEdit();
                            }}
                        >
                            <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    )}
                    {onDelete && (
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete();
                            }}
                        >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    )}
                </Stack>
            )}
            <LinkIconMark link={link} size={42} />
            <Typography
                variant="body2"
                sx={{
                    fontWeight: 600,
                    lineHeight: 1.25,
                    textAlign: 'center',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    width: '100%',
                    height: '2.5em',
                }}
            >
                {link.title}
            </Typography>
        </>
    );

    const sx = {
        position: 'relative' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        px: 1,
        py: 1.25,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        width: 104,
        height: 104,
        minWidth: 0,
        minHeight: 104,
        maxWidth: '100%',
        maxHeight: 104,
        boxSizing: 'border-box' as const,
        flexShrink: 0,
        textDecoration: 'none',
        color: 'inherit',
        overflow: 'hidden',
        transition: 'all 0.18s ease-in-out',
        ...(editing
            ? {}
            : {
                  cursor: 'pointer',
                  '&:hover': {
                      bgcolor: 'action.hover',
                      borderColor: 'primary.main',
                      transform: 'translateY(-2px)',
                      boxShadow: 2,
                  },
              }),
    };

    if (editing) return <Box sx={sx}>{inner}</Box>;
    return (
        <Box component="a" {...bind} draggable={false} sx={sx}>
            {inner}
        </Box>
    );
}
