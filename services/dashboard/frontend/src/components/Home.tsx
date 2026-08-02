import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Container,
    Chip,
    Avatar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    IconButton,
    Stack,
    Tooltip,
    MenuItem,
    ToggleButton,
    ToggleButtonGroup,
    Divider,
    CircularProgress,
    Paper,
    LinearProgress,
    GlobalStyles,
    Menu,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Devices as DevicesIcon,
    Inventory as PackagesIcon,
    Settings as SettingsIcon,
    Person as PersonIcon,
    Extension as ExtensionIcon,
    Chat as ChatIcon,
    People as PeopleIcon,
    Home as HomeIcon,
    Key as KeyIcon,
    FolderCopy as FilesIcon,
    Link as LinkIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    DragIndicator as DragIcon,
    RestartAlt as ResetIcon,
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
    Memory as MemoryIcon,
    Thermostat as ThermostatIcon,
    PowerSettingsNew as PowerIcon,
    Clear as ClearIcon,
    Schedule as ScheduleIcon,
    Apps as AppsIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import GridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import PageHeader from './PageHeader';
import { useAuth } from '../contexts/useAuth';
import { useConfig } from '../contexts/useConfig';
import { tryApiCall } from '../utils/api';
import {
    clearHomeRecentsMemory,
    flushHomeRecentsNow,
    peekHomeRecents,
    recordHomeRecent,
    setHomeRecentsMemory,
} from '../utils/homeRecents';
import type { Device, HomeCard, HomeWidget, SystemDataResponse, UserSettings } from '../types/api';
import {
    HOME_MUI_ICON_OPTIONS,
    resolveBuiltinLinks,
    resolveHomeCard,
    type HomeLinkItem,
} from '../homeLinks';
import {
    HOME_GRID_COLS,
    HOME_GRID_ROW_HEIGHT,
    HOME_WIDGET_META,
    applyLayoutToWidgets,
    defaultHomeCards,
    defaultHomeWidgets,
    layoutFromWidgets,
    stackedMobileLayout,
    widgetIconName,
    widgetTitle,
    type HomeWidgetType,
} from '../home/widgets';
import { WidgetTypePreview } from '../home/WidgetTypePreview';
import { fetchSystemMetrics } from '../utils/systemMetrics';
import { useNotification } from '../contexts/useNotification';
import { getErrorMessage } from '../utils/errors';
import { formatDevicesForDisplay } from '../utils/formatters';
import PiHoleLogo from '../assets/pi_hole_logo.png';
import VaultwardenLogo from '../assets/vaultwarden_logo.png';
import GatusLogo from '../assets/gatus_logo.png';
import GotifyLogo from '../assets/gotify_logo.png';
import AuthIcon from '../assets/authentik_logo.png';
import DockhandLogo from '../assets/dockhand_logo.png';
import NextcloudLogo from '../assets/nextcloud_logo.png';
import ImmichLogo from '../assets/immich_logo.png';
import StalwartLogo from '../assets/stalwart_logo.png';

const LOGO_BY_ID: Record<string, string> = {
    'external-pihole': PiHoleLogo,
    'external-dockhand': DockhandLogo,
    'external-vaultwarden': VaultwardenLogo,
    'external-gatus': GatusLogo,
    'external-gotify': GotifyLogo,
    'external-authentik': AuthIcon,
    'external-nextcloud': NextcloudLogo,
    'external-immich': ImmichLogo,
    'external-stalwart': StalwartLogo,
};

const NAV_ICONS: Record<string, React.ReactNode> = {
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

const MUI_ICON_MAP: Record<string, React.ReactNode> = {
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

function renderIconToken(token?: string, fallbackKey = 'link'): React.ReactNode {
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

function LinkIconMark({ link, size = 40 }: { link: HomeLinkItem; size?: number }) {
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

function useLinkOpen() {
    const navigate = useNavigate();
    return useCallback(
        (link: HomeLinkItem, onOpen: (id: string) => void) => ({
            href: link.href,
            target: link.external ? ('_blank' as const) : undefined,
            rel: link.external ? 'noopener noreferrer' : undefined,
            onMouseDown: (e: React.MouseEvent) => {
                // Keep middle-click from being treated as a drag / suppressed by parents.
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

/** SPA-friendly anchor props so middle-click / ctrl-click still work. */
function useWidgetHref(href: string | null | undefined, interactive: boolean) {
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

function RecentTile({
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
        gap: 1,
        px: 1.25,
        py: 0.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        textDecoration: 'none',
        color: 'inherit',
        width: 168,
        minWidth: 168,
        maxWidth: 168,
        height: 44,
        boxSizing: 'border-box' as const,
        flexShrink: 0,
        overflow: 'hidden',
        ...(disabled
            ? { pointerEvents: 'none' as const, opacity: 0.85 }
            : { '&:hover': { bgcolor: 'action.hover' } }),
    };
    const inner = (
        <>
            <LinkIconMark link={link} size={28} />
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

function ServiceTile({
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
            <LinkIconMark link={link} size={40} />
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
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        width: 104,
        height: 104,
        minWidth: 104,
        minHeight: 104,
        maxWidth: 104,
        maxHeight: 104,
        boxSizing: 'border-box' as const,
        flexShrink: 0,
        textDecoration: 'none',
        color: 'inherit',
        overflow: 'hidden',
        ...(editing
            ? {}
            : {
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
              }),
    };

    if (editing) return <Box sx={sx}>{inner}</Box>;
    return (
        <Box component="a" {...bind} draggable={false} sx={sx}>
            {inner}
        </Box>
    );
}

function WidgetShell({
    title,
    titlePlaceholder,
    iconName,
    editing,
    layoutEditing = editing,
    onRemove,
    onIconChange,
    onTitleChange,
    headerActions,
    children,
}: {
    title: string;
    titlePlaceholder?: string;
    iconName: string;
    editing: boolean;
    /** Drag handle / layout chrome — off on mobile stacked view. */
    layoutEditing?: boolean;
    onRemove?: () => void;
    onIconChange?: (icon: string) => void;
    onTitleChange?: (title: string) => void;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
}) {
    const [iconMenuAnchor, setIconMenuAnchor] = useState<null | HTMLElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [bodyScrollable, setBodyScrollable] = useState(false);
    const headerIcon = MUI_ICON_MAP[iconName] || <LinkIcon />;

    // overflow:auto traps the wheel even when nothing scrolls — only enable it when needed.
    useLayoutEffect(() => {
        const el = bodyRef.current;
        if (!el) return;
        const measure = () => {
            setBodyScrollable(el.scrollHeight > el.clientHeight + 2);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        Array.from(el.children).forEach((child) => ro.observe(child));
        return () => ro.disconnect();
    }, [children]);

    return (
        <Paper
            variant="outlined"
            sx={{
                height: '100%',
                maxHeight: '100%',
                minHeight: 0,
                // Grid keeps the header out of the scrollport more reliably than flex.
                display: 'grid',
                gridTemplateRows: 'auto minmax(0, 1fr)',
                overflow: 'hidden',
                bgcolor: 'background.paper',
                borderRadius: 3,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 40,
                    pt: 1,
                    pb: 0.5,
                    pl: 1.25,
                    pr: 0,
                    bgcolor: 'background.paper',
                    minWidth: 0,
                }}
            >
                {layoutEditing && (
                    <DragIcon
                        className="home-widget-drag"
                        sx={{
                            cursor: 'grab',
                            color: 'text.secondary',
                            fontSize: 18,
                            touchAction: 'none',
                            flexShrink: 0,
                            mr: 0.5,
                        }}
                    />
                )}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        flex: 1,
                        minWidth: 0,
                        pr: 1.25,
                        flexWrap: 'nowrap',
                        ...(editing
                            ? {
                                  overflowX: 'auto',
                                  overflowY: 'hidden',
                                  WebkitOverflowScrolling: 'touch',
                              }
                            : {
                                  overflow: 'hidden',
                              }),
                    }}
                >
                {editing && onIconChange ? (
                    <>
                        <IconButton
                            size="small"
                            onClick={(e) => setIconMenuAnchor(e.currentTarget)}
                            aria-label="Change widget icon"
                            sx={{ color: 'text.secondary', flexShrink: 0 }}
                        >
                            {headerIcon}
                        </IconButton>
                        <Menu
                            anchorEl={iconMenuAnchor}
                            open={Boolean(iconMenuAnchor)}
                            onClose={() => setIconMenuAnchor(null)}
                            slotProps={{ paper: { sx: { maxHeight: 320 } } }}
                        >
                            {HOME_MUI_ICON_OPTIONS.map((name) => (
                                <MenuItem
                                    key={name}
                                    selected={name === iconName}
                                    onClick={() => {
                                        onIconChange(name);
                                        setIconMenuAnchor(null);
                                    }}
                                >
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <Box sx={{ display: 'flex', color: 'text.secondary' }}>
                                            {MUI_ICON_MAP[name] || <LinkIcon />}
                                        </Box>
                                        <span>{name}</span>
                                    </Stack>
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                ) : (
                    <Box sx={{ display: 'flex', color: 'text.secondary', mr: 0.25, flexShrink: 0 }}>
                        {headerIcon}
                    </Box>
                )}
                {editing && onTitleChange ? (
                    <TextField
                        size="small"
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        variant="standard"
                        placeholder={titlePlaceholder}
                        inputProps={{ 'aria-label': 'Widget title' }}
                        sx={{
                            flex: '1 0 auto',
                            minWidth: 140,
                            '& .MuiInputBase-input': { fontWeight: 700, fontSize: '0.875rem', py: 0.25 },
                        }}
                    />
                ) : (
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0 }} noWrap>
                        {title || titlePlaceholder}
                    </Typography>
                )}
                {headerActions ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        {headerActions}
                    </Box>
                ) : null}
                {editing && onRemove && (
                    <IconButton size="small" onClick={onRemove} aria-label="Remove widget" sx={{ flexShrink: 0 }}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                )}
                </Box>
            </Box>
            <Box
                className="home-widget-body"
                ref={bodyRef}
                sx={{
                    minHeight: 0,
                    overflowX: 'hidden',
                    // visible when short so the page can scroll; auto only when needed
                    overflowY: bodyScrollable ? 'auto' : 'visible',
                    px: 1.25,
                    pb: 1.25,
                    pt: 0.5,
                    display: 'grid',
                    alignContent: 'start',
                    justifyItems: 'stretch',
                    '@supports (align-content: safe center)': {
                        alignContent: 'safe center',
                    },
                }}
            >
                {children}
            </Box>
        </Paper>
    );
}

function SystemWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { hasPermission } = useAuth();
    const canSystem = hasPermission('dashboard-system-user');
    const [data, setData] = useState<SystemDataResponse | null>(null);
    const [loading, setLoading] = useState(canSystem);
    const [failed, setFailed] = useState(false);
    const linkProps = useWidgetHref('/system', interactive);

    useEffect(() => {
        if (!canSystem) return;
        let cancelled = false;
        const load = async (force: boolean, initial: boolean) => {
            if (initial) {
                setLoading(true);
                setFailed(false);
            }
            try {
                const next = await fetchSystemMetrics({ force });
                if (!cancelled) {
                    setData(next);
                    setFailed(false);
                }
            } catch {
                if (!cancelled && initial) setFailed(true);
            } finally {
                if (!cancelled && initial) setLoading(false);
            }
        };
        void load(false, true);
        const interval = setInterval(() => void load(true, false), 10_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [canSystem]);

    if (!canSystem) {
        return (
            <Typography variant="body2" color="text.secondary">
                No access to system metrics.
            </Typography>
        );
    }
    if (failed) {
        return (
            <Typography variant="body2" color="text.secondary">
                Unable to load system metrics.
            </Typography>
        );
    }
    if (loading || !data?.resources) {
        return (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                    Loading…
                </Typography>
            </Stack>
        );
    }

    const barColor = (pct?: number) => {
        if (pct == null) return 'primary' as const;
        if (pct >= 80) return 'error' as const;
        if (pct >= 50) return 'warning' as const;
        return 'success' as const;
    };

    const items: { label: string; value: string; pct?: number; icon: React.ReactNode }[] = [];
    const cpu = data.resources.cpu?.usage;
    const mem = data.resources.memory?.percentage;
    const disk = data.resources.disk?.percentage;
    const temp = data.temperature?.cpu;
    if (cpu != null && Number.isFinite(cpu)) {
        items.push({ label: 'CPU', value: `${Math.round(cpu)}%`, pct: cpu, icon: <SpeedIcon sx={{ fontSize: 16 }} /> });
    }
    if (mem != null && Number.isFinite(mem)) {
        items.push({
            label: 'Mem',
            value: `${Math.round(mem)}%`,
            pct: mem,
            icon: <MemoryIcon sx={{ fontSize: 16 }} />,
        });
    }
    if (disk != null && Number.isFinite(disk)) {
        items.push({
            label: 'Disk',
            value: `${Math.round(disk)}%`,
            pct: disk,
            icon: <StorageIcon sx={{ fontSize: 16 }} />,
        });
    }
    if (temp != null && Number.isFinite(temp)) {
        items.push({
            label: 'Temp',
            value: `${Math.round(temp)}°C`,
            icon: <ThermostatIcon sx={{ fontSize: 16 }} />,
        });
    }

    return (
        <Box
            {...linkProps}
            sx={{
                cursor: interactive ? 'pointer' : 'default',
                width: '100%',
                height: '100%',
                minHeight: 0,
                boxSizing: 'border-box',
                textDecoration: 'none',
                color: 'inherit',
                '&:hover, &:focus, &:visited, &:active': {
                    color: 'inherit',
                    textDecoration: 'none',
                    opacity: 1,
                },
            }}
        >
            <Box
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    // Stretch rows so metrics fill the widget instead of leaving a hole.
                    alignContent: 'stretch',
                    alignItems: 'stretch',
                }}
            >
                {items.map((item) => (
                    <Box
                        key={item.label}
                        sx={{
                            // Grow to fill the row; a lone wrapped item expands full-width (no empty gap).
                            flex: '1 1 140px',
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: 0.75,
                        }}
                    >
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ color: 'text.secondary', display: 'flex' }}>{item.icon}</Box>
                            <Typography variant="caption" color="text.secondary">
                                {item.label}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.primary"
                                sx={{ fontWeight: 700, ml: 'auto', fontVariantNumeric: 'tabular-nums' }}
                            >
                                {item.value}
                            </Typography>
                        </Stack>
                        {item.pct != null && (
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(100, Math.max(0, item.pct))}
                                color={barColor(item.pct)}
                                sx={{ height: 6, borderRadius: 1, flexShrink: 0, width: '100%' }}
                            />
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

function PackagesWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { hasPermission } = useAuth();
    const can = hasPermission('dashboard-packages-user');
    const [loading, setLoading] = useState(can);
    const [count, setCount] = useState<number | null>(null);
    const linkProps = useWidgetHref('/packages', interactive);

    useEffect(() => {
        if (!can) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await tryApiCall<{ updatesAvailable: number }>('/packages/summary');
                if (!cancelled) setCount(res.data?.updatesAvailable ?? 0);
            } catch {
                if (!cancelled) setCount(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [can]);

    if (!can) {
        return (
            <Typography variant="body2" color="text.secondary">
                No access to packages.
            </Typography>
        );
    }

    return (
        <Box
            {...linkProps}
            sx={{
                cursor: interactive ? 'pointer' : 'default',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textDecoration: 'none',
                color: 'inherit',
                '&:hover, &:focus, &:visited, &:active': {
                    color: 'inherit',
                    textDecoration: 'none',
                    opacity: 1,
                },
            }}
        >
            {loading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} />
                    <Typography variant="body2" color="text.secondary">
                        Loading…
                    </Typography>
                </Stack>
            ) : (
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 700,
                        color: count == null ? 'text.secondary' : count > 0 ? 'warning.main' : 'success.main',
                    }}
                >
                    {count == null ? 'Unavailable' : count > 0 ? `${count} available` : 'Up to date'}
                </Typography>
            )}
        </Box>
    );
}

function DevicesWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { hasPermission } = useAuth();
    const can = hasPermission('dashboard-devices-user');
    const [loading, setLoading] = useState(can);
    const [counts, setCounts] = useState<{ online: number; total: number } | null>(null);
    const linkProps = useWidgetHref('/devices', interactive);

    useEffect(() => {
        if (!can) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await tryApiCall<{ onlineDevices: number; totalDevices: number }>('/devices');
                if (!cancelled) {
                    setCounts({
                        online: res.data?.onlineDevices ?? 0,
                        total: res.data?.totalDevices ?? 0,
                    });
                }
            } catch {
                if (!cancelled) setCounts({ online: 0, total: 0 });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [can]);

    if (!can) {
        return (
            <Typography variant="body2" color="text.secondary">
                No access to devices.
            </Typography>
        );
    }

    const online = counts?.online ?? 0;
    const total = counts?.total ?? 0;
    const allOnline = total > 0 && online === total;
    const noneOnline = online === 0;

    return (
        <Box
            {...linkProps}
            sx={{
                cursor: interactive ? 'pointer' : 'default',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textDecoration: 'none',
                color: 'inherit',
                '&:hover, &:focus, &:visited, &:active': {
                    color: 'inherit',
                    textDecoration: 'none',
                    opacity: 1,
                },
            }}
        >
            {loading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} />
                    <Typography variant="body2" color="text.secondary">
                        Loading…
                    </Typography>
                </Stack>
            ) : (
                <>
                    <Typography
                        variant="h5"
                        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}
                    >
                        <Box
                            component="span"
                            sx={{
                                color: noneOnline ? 'text.secondary' : allOnline ? 'success.main' : 'text.primary',
                            }}
                        >
                            {online}
                        </Box>
                        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            {' '}
                            / {total}
                        </Box>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        online
                    </Typography>
                </>
            )}
        </Box>
    );
}

function GatusWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { config } = useConfig();
    const [loading, setLoading] = useState(true);
    const [gatus, setGatus] = useState<{ up: number; down: number; total: number } | null>(null);
    const url = config.hostnames?.gatus ? `https://${config.hostnames.gatus}` : null;
    const linkProps = useWidgetHref(url, interactive);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await tryApiCall<{ up: number; down: number; total: number }>('/gatus/summary');
                if (!cancelled && res.data) {
                    setGatus({
                        up: res.data.up ?? 0,
                        down: res.data.down ?? 0,
                        total: res.data.total ?? 0,
                    });
                }
            } catch {
                if (!cancelled) setGatus(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <Box
            {...linkProps}
            sx={{
                cursor: interactive && url ? 'pointer' : 'default',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textDecoration: 'none',
                color: 'inherit',
                '&:hover, &:focus, &:visited, &:active': {
                    color: 'inherit',
                    textDecoration: 'none',
                    opacity: 1,
                },
            }}
        >
            {loading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} />
                    <Typography variant="body2" color="text.secondary">
                        Loading…
                    </Typography>
                </Stack>
            ) : !gatus ? (
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Unavailable
                </Typography>
            ) : gatus.up === 0 && gatus.down === 0 ? (
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    None
                </Typography>
            ) : (
                <Stack direction="row" spacing={2.5} alignItems="center">
                    {gatus.up > 0 && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'success.main' }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {gatus.up}
                            </Typography>
                            <ArrowUpIcon fontSize="small" />
                        </Stack>
                    )}
                    {gatus.down > 0 && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'error.main' }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {gatus.down}
                            </Typography>
                            <ArrowDownIcon fontSize="small" />
                        </Stack>
                    )}
                </Stack>
            )}
        </Box>
    );
}

function AnalogClockFace({ date, size }: { date: Date; size: number }) {
    const hours = date.getHours() % 12;
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const hourAngle = (hours + minutes / 60) * 30;
    const minuteAngle = (minutes + seconds / 60) * 6;
    const secondAngle = seconds * 6;
    const cx = 50;
    const cy = 50;

    return (
        <Box
            component="svg"
            viewBox="0 0 100 100"
            sx={{ width: size, height: size, display: 'block', flexShrink: 0 }}
            aria-hidden
        >
            <circle
                cx={cx}
                cy={cy}
                r={46}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeWidth={2}
            />
            {Array.from({ length: 12 }, (_, i) => {
                const a = ((i * 30 - 90) * Math.PI) / 180;
                const outer = 42;
                const inner = i % 3 === 0 ? 34 : 37;
                return (
                    <line
                        key={i}
                        x1={cx + Math.cos(a) * inner}
                        y1={cy + Math.sin(a) * inner}
                        x2={cx + Math.cos(a) * outer}
                        y2={cy + Math.sin(a) * outer}
                        stroke="currentColor"
                        strokeOpacity={0.45}
                        strokeWidth={i % 3 === 0 ? 2 : 1}
                        strokeLinecap="round"
                    />
                );
            })}
            <line
                x1={cx}
                y1={cy}
                x2={cx + Math.sin((hourAngle * Math.PI) / 180) * 22}
                y2={cy - Math.cos((hourAngle * Math.PI) / 180) * 22}
                stroke="currentColor"
                strokeWidth={3.5}
                strokeLinecap="round"
            />
            <line
                x1={cx}
                y1={cy}
                x2={cx + Math.sin((minuteAngle * Math.PI) / 180) * 32}
                y2={cy - Math.cos((minuteAngle * Math.PI) / 180) * 32}
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
            />
            <line
                x1={cx}
                y1={cy}
                x2={cx + Math.sin((secondAngle * Math.PI) / 180) * 36}
                y2={cy - Math.cos((secondAngle * Math.PI) / 180) * 36}
                stroke="currentColor"
                strokeOpacity={0.7}
                strokeWidth={1.25}
                strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={2.5} fill="currentColor" />
        </Box>
    );
}

function ClockWidgetBody({ style = 'digital' }: { style?: 'digital' | 'analog' }) {
    const [now, setNow] = useState(() => new Date());
    const bodyRef = useRef<HTMLDivElement>(null);
    const [faceSize, setFaceSize] = useState(96);

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const el = bodyRef.current;
        if (!el || style !== 'analog') return;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            setFaceSize(Math.max(56, Math.min(width, height) - 8));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [style]);

    if (style === 'analog') {
        return (
            <Box
                ref={bodyRef}
                sx={{
                    width: '100%',
                    minHeight: 120,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.75,
                    color: 'text.primary',
                }}
            >
                <AnalogClockFace date={now} size={faceSize} />
                <Typography variant="caption" color="text.secondary">
                    {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Typography>
        </Box>
    );
}

function WakeWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { hasPermission } = useAuth();
    const { showSuccess, showError } = useNotification();
    const can = hasPermission('dashboard-devices-user');
    const [loading, setLoading] = useState(can);
    const [favorites, setFavorites] = useState<Device[]>([]);
    const [wakingMac, setWakingMac] = useState<string | null>(null);

    useEffect(() => {
        if (!can) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await tryApiCall<{ devices: Device[] }>('/devices/favorites');
                if (!cancelled) setFavorites(formatDevicesForDisplay(res.data?.devices || []));
            } catch {
                if (!cancelled) setFavorites([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [can]);

    if (!can) {
        return (
            <Typography variant="body2" color="text.secondary" textAlign="center">
                No access to devices.
            </Typography>
        );
    }
    if (loading) {
        return (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                <CircularProgress size={14} />
                <Typography variant="body2" color="text.secondary">
                    Loading favorites…
                </Typography>
            </Stack>
        );
    }
    if (favorites.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" textAlign="center">
                No favorite devices yet. Star devices on the Devices page.
            </Typography>
        );
    }

    return (
        <Box
            sx={{
                width: '100%',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignContent: 'center',
                gap: 1.5,
            }}
        >
            <Stack
                direction="row"
                spacing={1.5}
                useFlexGap
                flexWrap="wrap"
                justifyContent="center"
                alignItems="center"
            >
                {favorites.map((device) => {
                    const key = device.macNormalized || device.mac || device.name || '';
                    const waking = wakingMac === key;
                    return (
                        <Button
                            key={key}
                            size="medium"
                            variant="outlined"
                            startIcon={
                                waking ? <CircularProgress size={18} color="inherit" /> : <PowerIcon />
                            }
                            disabled={!interactive || waking}
                            sx={{ px: 2.5, py: 1.25, minHeight: 48, fontWeight: 600 }}
                            onClick={async () => {
                                if (!interactive) return;
                                setWakingMac(key);
                                try {
                                    await tryApiCall('/wol', {
                                        method: 'POST',
                                        data: { device },
                                        timeout: 10000,
                                    });
                                    showSuccess(`Wake-on-LAN sent to ${device.name || device.mac}`);
                                } catch (err) {
                                    showError(getErrorMessage(err) || 'Failed to send Wake-on-LAN');
                                } finally {
                                    setWakingMac(null);
                                }
                            }}
                        >
                            {device.name || device.mac}
                        </Button>
                    );
                })}
            </Stack>
        </Box>
    );
}

function LinksWidgetBody({
    links,
    density,
    editing,
    emptyHint,
    onOpen,
    onEditLink,
    onDeleteLink,
}: {
    links: HomeLinkItem[];
    density: 'recents' | 'grid';
    editing: boolean;
    emptyHint: string;
    onOpen: (id: string) => void;
    onEditLink?: (id: string) => void;
    onDeleteLink?: (id: string) => void;
}) {
    return (
        <Box
            sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
            }}
        >
            {links.length === 0 ? (
                <Typography variant="body2" color="text.secondary" textAlign="center">
                    {emptyHint}
                </Typography>
            ) : density === 'recents' ? (
                <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    justifyContent="center"
                    sx={{ width: '100%' }}
                >
                    {links.map((link) => (
                        <RecentTile key={link.id} link={link} onOpen={onOpen} disabled={editing} />
                    ))}
                </Stack>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        alignContent: 'center',
                        gap: 1,
                        width: '100%',
                    }}
                >
                    {links.map((link) => (
                        <ServiceTile
                            key={link.id}
                            link={link}
                            onOpen={onOpen}
                            editing={editing}
                            onEdit={
                                editing && onEditLink && (link.kind === 'custom' || link.kind === 'catalog')
                                    ? () => onEditLink(link.id)
                                    : undefined
                            }
                            onDelete={onDeleteLink ? () => onDeleteLink(link.id) : undefined}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
}

const Home = () => {
    const { user, hasPermission } = useAuth();
    const { config } = useConfig();
    const hostnames = useMemo(() => config.hostnames || {}, [config.hostnames]);
    const theme = useTheme();
    // Match Navigation: treat md-and-down as mobile (not RGL container width).
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const { width, containerRef, mounted } = useContainerWidth({
        initialWidth: typeof window !== 'undefined' ? Math.min(window.innerWidth, 1200) : 1200,
    });

    const [editing, setEditing] = useState(false);
    const layoutEditing = editing && !isMobile;
    const [recentIds, setRecentIds] = useState<string[]>([]);
    const [widgets, setWidgets] = useState<HomeWidget[]>(defaultHomeWidgets);
    const [cards, setCards] = useState<HomeCard[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Auto-scroll the page when resizing/dragging near the viewport edge.
    useEffect(() => {
        if (!editing || isMobile) return;
        let active = false;
        let raf = 0;
        let lastY = 0;

        const edge = 72;
        const maxStep = 28;

        const tick = () => {
            raf = 0;
            if (!active) return;
            const topLimit = edge;
            const bottomLimit = window.innerHeight - edge;
            if (lastY > bottomLimit) {
                const intensity = Math.min(1, (lastY - bottomLimit) / edge);
                window.scrollBy(0, Math.ceil(maxStep * intensity));
            } else if (lastY < topLimit) {
                const intensity = Math.min(1, (topLimit - lastY) / edge);
                window.scrollBy(0, -Math.ceil(maxStep * intensity));
            }
            raf = window.requestAnimationFrame(tick);
        };

        const onPointerDown = (e: PointerEvent) => {
            const t = e.target as Element | null;
            if (!t?.closest) return;
            if (t.closest('.react-resizable-handle') || t.closest('.home-widget-drag')) {
                active = true;
                lastY = e.clientY;
                window.getSelection()?.removeAllRanges();
                if (!raf) raf = window.requestAnimationFrame(tick);
            }
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!active) return;
            lastY = e.clientY;
        };
        const onPointerUp = () => {
            active = false;
            if (raf) {
                window.cancelAnimationFrame(raf);
                raf = 0;
            }
        };
        const onSelectStart = (e: Event) => {
            if (active) e.preventDefault();
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerUp, true);
        document.addEventListener('selectstart', onSelectStart, true);
        return () => {
            onPointerUp();
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);
            window.removeEventListener('pointercancel', onPointerUp, true);
            document.removeEventListener('selectstart', onSelectStart, true);
        };
    }, [editing, isMobile]);

    const [addWidgetOpen, setAddWidgetOpen] = useState(false);
    const [addWidgetType, setAddWidgetType] = useState<HomeWidgetType>('clock');
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

    const [cardDialog, setCardDialog] = useState(false);
    const [cardDialogWidgetId, setCardDialogWidgetId] = useState<string | null>(null);
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [cardMode, setCardMode] = useState<'catalog' | 'custom'>('custom');
    const [formTitle, setFormTitle] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIconKind, setFormIconKind] = useState<'mui' | 'emoji'>('mui');
    const [formMuiIcon, setFormMuiIcon] = useState('Link');
    const [formEmoji, setFormEmoji] = useState('🔗');
    const [formCatalogId, setFormCatalogId] = useState('');

    const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef({ recentIds, widgets, cards });
    latest.current = { recentIds, widgets, cards };

    const persist = useCallback(
        (patch?: Partial<{ homeRecentIds: string[]; homeWidgets: HomeWidget[]; homeCards: HomeCard[] }>) => {
            if (persistTimer.current) clearTimeout(persistTimer.current);
            persistTimer.current = setTimeout(async () => {
                const cur = latest.current;
                try {
                    const data: Record<string, unknown> = {
                        homeWidgets: patch?.homeWidgets ?? cur.widgets,
                        homeCards: patch?.homeCards ?? cur.cards,
                    };
                    if (patch?.homeRecentIds !== undefined) {
                        data.homeRecentIds = patch.homeRecentIds;
                    }
                    await tryApiCall('/user-settings', { method: 'PUT', data });
                } catch (err) {
                    console.error('Failed to save home dashboard', err);
                }
            }, 400);
        },
        []
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await flushHomeRecentsNow();
                if (cancelled) return;
                const res = await tryApiCall<{ settings: UserSettings }>('/user-settings');
                if (cancelled) return;
                const s = res.data?.settings;
                if (s) {
                    const recents = Array.isArray(s.homeRecentIds) ? s.homeRecentIds : [];
                    setRecentIds(recents);
                    setHomeRecentsMemory(recents);
                    if (Array.isArray(s.homeWidgets) && s.homeWidgets.length > 0) {
                        setWidgets(s.homeWidgets);
                    } else {
                        setWidgets(defaultHomeWidgets());
                    }
                    if (Array.isArray(s.homeCards) && s.homeCards.length > 0) {
                        setCards(s.homeCards);
                    } else {
                        setCards(defaultHomeCards());
                    }
                }
            } catch (err) {
                console.error('Failed to load home settings', err);
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
            if (persistTimer.current) clearTimeout(persistTimer.current);
        };
    }, []);

    const catalog = useMemo(
        () => resolveBuiltinLinks(hostnames, hasPermission, LOGO_BY_ID),
        [hostnames, hasPermission]
    );
    const catalogById = useMemo(() => {
        const map = new Map<string, HomeLinkItem>();
        for (const link of catalog) map.set(link.id, link);
        return map;
    }, [catalog]);
    const cardsById = useMemo(() => {
        const map = new Map<string, HomeCard>();
        for (const c of cards) map.set(c.id, c);
        return map;
    }, [cards]);

    const updateWidgets = (next: HomeWidget[]) => {
        setWidgets(next);
        persist({ homeWidgets: next });
    };

    const recordOpen = useCallback(
        (openedId: string) => {
            const card = cardsById.get(openedId);
            const trackId = card?.type === 'catalog' ? card.catalogId : openedId;
            recordHomeRecent(trackId);
        },
        [cardsById]
    );

    const recentLinks = useMemo(() => {
        const items: HomeLinkItem[] = [];
        for (const id of recentIds) {
            const fromCatalog = catalogById.get(id);
            if (fromCatalog) {
                items.push(fromCatalog);
                continue;
            }
            const card = cardsById.get(id);
            if (card) {
                const resolved = resolveHomeCard(card, catalogById);
                if (resolved) items.push(resolved);
            }
        }
        return items;
    }, [recentIds, catalogById, cardsById]);

    const internalLinks = useMemo(() => catalog.filter((l) => l.kind === 'internal'), [catalog]);
    const externalLinks = useMemo(() => catalog.filter((l) => l.kind === 'external'), [catalog]);

    const onLayoutChange = (layout: Layout) => {
        // Mobile uses a derived 1-col stack — don't write that back over the desktop layout.
        if (!editing || isMobile) return;
        updateWidgets(applyLayoutToWidgets(widgets, layout));
    };

    const removeWidget = (id: string) => {
        const widget = widgets.find((w) => w.id === id);
        const nextWidgets = widgets.filter((w) => w.id !== id);
        if (widget?.type === 'links' && widget.data?.cardIds?.length) {
            const removeIds = new Set(widget.data.cardIds);
            const nextCards = cards.filter((c) => !removeIds.has(c.id));
            setCards(nextCards);
            setWidgets(nextWidgets);
            persist({ homeWidgets: nextWidgets, homeCards: nextCards });
            return;
        }
        updateWidgets(nextWidgets);
    };

    const addWidget = () => {
        const meta = HOME_WIDGET_META[addWidgetType];
        const id = `${addWidgetType}-${crypto.randomUUID().slice(0, 8)}`;
        const maxY = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
        const next = {
            id,
            type: addWidgetType,
            x: 0,
            y: maxY,
            w: meta.defaultW,
            h: meta.defaultH,
            ...(addWidgetType === 'links' ? { data: { cardIds: [] } } : {}),
        } as HomeWidget;
        updateWidgets([...widgets, next]);
        setAddWidgetOpen(false);
    };

    const openAddCard = (widgetId: string) => {
        setCardDialogWidgetId(widgetId);
        setEditingCardId(null);
        setCardMode('custom');
        setFormTitle('');
        setFormUrl('');
        setFormDescription('');
        setFormIconKind('mui');
        setFormMuiIcon('Link');
        setFormEmoji('🔗');
        setFormCatalogId(catalog[0]?.id || '');
        setCardDialog(true);
    };

    const openEditCard = (cardId: string) => {
        const card = cardsById.get(cardId);
        if (!card) return;
        setEditingCardId(cardId);
        setCardDialogWidgetId(null);
        if (card.type === 'catalog') {
            setCardMode('catalog');
            setFormCatalogId(card.catalogId);
            setFormTitle('');
            setFormUrl('');
            setFormDescription('');
            setFormIconKind('mui');
            setFormMuiIcon('Link');
            setFormEmoji('🔗');
        } else {
            setCardMode('custom');
            setFormTitle(card.title);
            setFormUrl(card.url);
            setFormDescription(card.description || '');
            if (card.icon.startsWith('emoji:')) {
                setFormIconKind('emoji');
                setFormEmoji(card.icon.slice('emoji:'.length) || '🔗');
            } else {
                setFormIconKind('mui');
                setFormMuiIcon(card.icon.replace(/^mui:/, '') || 'Link');
            }
            setFormCatalogId(catalog[0]?.id || '');
        }
        setCardDialog(true);
    };

    const saveCardDialog = () => {
        if (editingCardId) {
            const existing = cardsById.get(editingCardId);
            if (!existing) return;
            if (existing.type === 'catalog') {
                if (!formCatalogId) return;
                const nextCards = cards.map((c) =>
                    c.id === editingCardId && c.type === 'catalog'
                        ? { ...c, catalogId: formCatalogId }
                        : c
                );
                setCards(nextCards);
                persist({ homeCards: nextCards });
            } else {
                const title = formTitle.trim();
                let url = formUrl.trim();
                if (!title || !url) return;
                if (!/^(?:[a-z0-9+.-]+:|\/)/i.test(url)) url = `https://${url}`;
                const icon =
                    formIconKind === 'emoji' ? `emoji:${formEmoji || '🔗'}` : `mui:${formMuiIcon}`;
                const nextCards = cards.map((c) =>
                    c.id === editingCardId && c.type === 'custom'
                        ? {
                              ...c,
                              title,
                              url,
                              description: formDescription.trim(),
                              icon,
                          }
                        : c
                );
                setCards(nextCards);
                persist({ homeCards: nextCards });
            }
            setCardDialog(false);
            setEditingCardId(null);
            return;
        }

        if (!cardDialogWidgetId) return;
        if (cardMode === 'catalog') {
            if (!formCatalogId) return;
            const id = `card-${crypto.randomUUID()}`;
            const nextCards: HomeCard[] = [...cards, { id, type: 'catalog', catalogId: formCatalogId }];
            const nextWidgets = widgets.map((w) =>
                w.id === cardDialogWidgetId && w.type === 'links'
                    ? { ...w, data: { ...w.data, cardIds: [...(w.data?.cardIds || []), id] } }
                    : w
            );
            setCards(nextCards);
            setWidgets(nextWidgets);
            persist({ homeCards: nextCards, homeWidgets: nextWidgets });
        } else {
            const title = formTitle.trim();
            let url = formUrl.trim();
            if (!title || !url) return;
            if (!/^(?:[a-z0-9+.-]+:|\/)/i.test(url)) url = `https://${url}`;
            const icon = formIconKind === 'emoji' ? `emoji:${formEmoji || '🔗'}` : `mui:${formMuiIcon}`;
            const id = `card-${crypto.randomUUID()}`;
            const nextCards: HomeCard[] = [
                ...cards,
                { id, type: 'custom', title, url, description: formDescription.trim(), icon },
            ];
            const nextWidgets = widgets.map((w) =>
                w.id === cardDialogWidgetId && w.type === 'links'
                    ? { ...w, data: { ...w.data, cardIds: [...(w.data?.cardIds || []), id] } }
                    : w
            );
            setCards(nextCards);
            setWidgets(nextWidgets);
            persist({ homeCards: nextCards, homeWidgets: nextWidgets });
        }
        setCardDialog(false);
    };

    const deleteCardFromWidget = (widgetId: string, cardId: string) => {
        const nextCards = cards.filter((c) => c.id !== cardId);
        const nextWidgets = widgets.map((w) =>
            w.id === widgetId && w.type === 'links'
                ? { ...w, data: { ...w.data, cardIds: (w.data?.cardIds || []).filter((id) => id !== cardId) } }
                : w
        );
        const filteredRecents = (peekHomeRecents() ?? recentIds).filter((x) => x !== cardId);
        setRecentIds((prev) => prev.filter((x) => x !== cardId));
        setHomeRecentsMemory(filteredRecents);
        setCards(nextCards);
        setWidgets(nextWidgets);
        persist({ homeRecentIds: filteredRecents, homeCards: nextCards, homeWidgets: nextWidgets });
    };

    const clearRecents = () => {
        setRecentIds([]);
        clearHomeRecentsMemory();
        persist({ homeRecentIds: [] });
    };

    const resetToDefaults = () => {
        const nextWidgets = defaultHomeWidgets();
        const nextCards: HomeCard[] = defaultHomeCards();
        setWidgets(nextWidgets);
        setCards(nextCards);
        persist({ homeWidgets: nextWidgets, homeCards: nextCards });
        setResetConfirmOpen(false);
    };

    const gridLayout = useMemo(
        () => (isMobile ? stackedMobileLayout(widgets) : layoutFromWidgets(widgets)),
        [widgets, isMobile]
    );

    const renderWidgetBody = (widget: HomeWidget) => {
        const interactive = !editing;
        switch (widget.type) {
            case 'system':
                return <SystemWidgetBody interactive={interactive} />;
            case 'packages':
                return <PackagesWidgetBody interactive={interactive} />;
            case 'gatus':
                return <GatusWidgetBody interactive={interactive} />;
            case 'devices':
                return <DevicesWidgetBody interactive={interactive} />;
            case 'clock':
                return <ClockWidgetBody style={widget.data?.clockStyle === 'analog' ? 'analog' : 'digital'} />;
            case 'wake':
                return <WakeWidgetBody interactive={interactive} />;
            case 'recents':
                return (
                    <LinksWidgetBody
                        links={recentLinks}
                        density="recents"
                        editing={editing}
                        emptyHint="Open a page or service to populate Recents."
                        onOpen={recordOpen}
                    />
                );
            case 'pages':
                return (
                    <LinksWidgetBody
                        links={internalLinks}
                        density="grid"
                        editing={editing}
                        emptyHint="No pages available for your roles."
                        onOpen={recordOpen}
                    />
                );
            case 'services':
                return (
                    <LinksWidgetBody
                        links={externalLinks}
                        density="grid"
                        editing={editing}
                        emptyHint="No services available."
                        onOpen={recordOpen}
                    />
                );
            case 'links': {
                const links = (widget.data?.cardIds || [])
                    .map((id: string) => {
                        const card = cardsById.get(id);
                        return card ? resolveHomeCard(card, catalogById) : null;
                    })
                    .filter((x): x is HomeLinkItem => !!x);
                return (
                    <LinksWidgetBody
                        links={links}
                        density="grid"
                        editing={editing}
                        emptyHint={editing ? 'Use Add link in the header.' : 'Nothing here yet.'}
                        onOpen={recordOpen}
                        onEditLink={editing ? (id) => openEditCard(id) : undefined}
                        onDeleteLink={editing ? (id) => deleteCardFromWidget(widget.id, id) : undefined}
                    />
                );
            }
            default:
                return null;
        }
    };

    if (!loaded) {
        return (
            <Container maxWidth="lg" sx={{ py: 3 }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'calc(100vh - 200px)',
                    }}
                >
                    <CircularProgress size={48} sx={{ mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                        Loading home...
                    </Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <PageHeader
                title="Home"
                icon={<HomeIcon />}
                actions={
                    <Stack direction="row" spacing={1} alignItems="center">
                        {user && (
                            <Chip
                                avatar={
                                    <Avatar>
                                        <PersonIcon />
                                    </Avatar>
                                }
                                label={`Welcome back, ${user.username}`}
                                color="primary"
                                variant="outlined"
                            />
                        )}
                        <Tooltip title={editing ? 'Done customizing' : 'Customize layout'}>
                            <IconButton
                                color={editing ? 'primary' : 'default'}
                                onClick={() => setEditing((v) => !v)}
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                }
            />

            {editing && (
                <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                        {isMobile
                            ? 'Narrow view stacks widgets in one column. Resize the window or use a larger screen to drag and rearrange.'
                            : 'Drag widgets by the handle, resize from edges, rename titles, and click a header icon to change it. Clock widgets can switch between digital and analog.'}
                    </Typography>
                    <Button
                        startIcon={<ResetIcon />}
                        variant="outlined"
                        color="warning"
                        size="small"
                        onClick={() => setResetConfirmOpen(true)}
                    >
                        Reset
                    </Button>
                    <Button
                        startIcon={<AddIcon />}
                        variant="outlined"
                        size="small"
                        onClick={() => setAddWidgetOpen(true)}
                    >
                        Add widget
                    </Button>
                </Stack>
            )}

            <Box
                ref={containerRef}
                className={`home-widget-grid${editing ? ' home-widget-grid--editing' : ''}`}
                sx={{
                    width: '100%',
                    minHeight: 200,
                    // Extra room below so resizing a bottom widget can scroll into view.
                    pb: editing ? 12 : 0,
                    '& .react-grid-item': {
                        overflow: 'hidden',
                    },
                    '& .react-grid-item > .home-widget-item': {
                        height: '100%',
                        minHeight: 0,
                        overflow: 'hidden',
                    },
                }}
            >
                {editing && (
                    <GlobalStyles
                        styles={(theme) => ({
                            '.home-widget-grid--editing .react-grid-item > .react-resizable-handle': {
                                width: 28,
                                height: 28,
                                opacity: 1,
                                zIndex: 3,
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                            },
                            '.home-widget-grid--editing .react-grid-item.resizing, .home-widget-grid--editing .react-grid-item.react-draggable-dragging, .home-widget-grid--editing .react-grid-item.resizing *, .home-widget-grid--editing .react-grid-item.react-draggable-dragging *':
                                {
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    caretColor: 'transparent',
                                },
                            '.home-widget-grid--editing .react-grid-item > .react-resizable-handle::after': {
                                width: 10,
                                height: 10,
                                right: 4,
                                bottom: 4,
                                borderRightWidth: 3,
                                borderBottomWidth: 3,
                                borderRightColor: theme.palette.primary.main,
                                borderBottomColor: theme.palette.primary.main,
                                opacity: 0.9,
                            },
                            '.home-widget-grid--editing .react-grid-item:hover > .react-resizable-handle::after, .home-widget-grid--editing .react-grid-item.resizing > .react-resizable-handle::after':
                                {
                                    opacity: 1,
                                    width: 12,
                                    height: 12,
                                },
                        })}
                    />
                )}
                {(mounted || width > 0) && (
                    <GridLayout
                        key={isMobile ? 'mobile' : 'desktop'}
                        width={Math.max(width, 1)}
                        layout={gridLayout}
                        gridConfig={{
                            cols: isMobile ? 1 : HOME_GRID_COLS,
                            rowHeight: HOME_GRID_ROW_HEIGHT,
                            margin: isMobile ? [10, 10] : [12, 12],
                        }}
                        dragConfig={{
                            enabled: layoutEditing,
                            handle: '.home-widget-drag',
                        }}
                        resizeConfig={{ enabled: layoutEditing }}
                        compactor={verticalCompactor}
                        onLayoutChange={onLayoutChange}
                    >
                        {widgets.map((widget) => (
                            <div key={widget.id} className="home-widget-item">
                                <WidgetShell
                                    title={editing ? (widget.title ?? '') : widgetTitle(widget)}
                                    titlePlaceholder={HOME_WIDGET_META[widget.type].label}
                                    iconName={widgetIconName(widget)}
                                    editing={editing}
                                    layoutEditing={layoutEditing}
                                    onRemove={() => removeWidget(widget.id)}
                                    onIconChange={(icon) =>
                                        updateWidgets(
                                            widgets.map((w) => (w.id === widget.id ? { ...w, icon } : w))
                                        )
                                    }
                                    onTitleChange={(raw) => {
                                        updateWidgets(
                                            widgets.map((w) =>
                                                w.id === widget.id
                                                    ? { ...w, title: raw.trim() || undefined }
                                                    : w
                                            )
                                        );
                                    }}
                                    headerActions={
                                        <>
                                            {widget.type === 'clock' && editing && (
                                                <ToggleButtonGroup
                                                    size="small"
                                                    exclusive
                                                    value={widget.data?.clockStyle === 'analog' ? 'analog' : 'digital'}
                                                    onChange={(_, value: 'digital' | 'analog' | null) => {
                                                        if (!value) return;
                                                        updateWidgets(
                                                            widgets.map((w) =>
                                                                w.id === widget.id && w.type === 'clock'
                                                                    ? { ...w, data: { ...w.data, clockStyle: value } }
                                                                    : w
                                                            )
                                                        );
                                                    }}
                                                    sx={{ flexShrink: 0, mr: 0.5 }}
                                                >
                                                    <ToggleButton value="digital" sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>
                                                        Digital
                                                    </ToggleButton>
                                                    <ToggleButton value="analog" sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>
                                                        Analog
                                                    </ToggleButton>
                                                </ToggleButtonGroup>
                                            )}
                                            {widget.type === 'links' && editing && (
                                                <Button
                                                    size="small"
                                                    startIcon={<AddIcon />}
                                                    onClick={() => openAddCard(widget.id)}
                                                    sx={{ flexShrink: 0, minWidth: 108, px: 1.5, whiteSpace: 'nowrap' }}
                                                >
                                                    Add link
                                                </Button>
                                            )}
                                            {widget.type === 'recents' && !editing && recentIds.length > 0 && (
                                                <Button
                                                    size="small"
                                                    startIcon={<ClearIcon />}
                                                    onClick={clearRecents}
                                                >
                                                    Clear
                                                </Button>
                                            )}
                                        </>
                                    }
                                >
                                    {renderWidgetBody(widget)}
                                </WidgetShell>
                            </div>
                        ))}
                    </GridLayout>
                )}
            </Box>

            <Dialog open={addWidgetOpen} onClose={() => setAddWidgetOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add widget</DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            mt: 1,
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                            gap: 1.25,
                        }}
                    >
                        {(Object.keys(HOME_WIDGET_META) as HomeWidgetType[]).map((type) => {
                            const meta = HOME_WIDGET_META[type];
                            const selected = addWidgetType === type;
                            return (
                                <Box
                                    key={type}
                                    component="button"
                                    type="button"
                                    onClick={() => setAddWidgetType(type)}
                                    sx={{
                                        m: 0,
                                        p: 1.25,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        borderRadius: 2,
                                        border: '2px solid',
                                        borderColor: selected ? 'primary.main' : 'divider',
                                        bgcolor: selected ? 'action.selected' : 'background.paper',
                                        color: 'inherit',
                                        font: 'inherit',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1,
                                        transition: (t) =>
                                            t.transitions.create(['border-color', 'background-color'], {
                                                duration: t.transitions.duration.shorter,
                                            }),
                                        '&:hover': {
                                            borderColor: selected ? 'primary.main' : 'action.active',
                                            bgcolor: selected ? 'action.selected' : 'action.hover',
                                        },
                                    }}
                                >
                                    <WidgetTypePreview type={type} />
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                                            {meta.label}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                            {meta.description}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddWidgetOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={addWidget}>
                        Add {HOME_WIDGET_META[addWidgetType].label}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Reset home dashboard?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Restores the default widget layout and removes custom link widgets and cards. Recents
                        are kept. This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={resetToDefaults}>
                        Reset
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={cardDialog}
                onClose={() => {
                    setCardDialog(false);
                    setEditingCardId(null);
                }}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{editingCardId ? 'Edit link' : 'Add link'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {!editingCardId && (
                            <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={cardMode}
                                onChange={(_, v) => v && setCardMode(v)}
                            >
                                <ToggleButton value="catalog">From catalog</ToggleButton>
                                <ToggleButton value="custom">Custom link</ToggleButton>
                            </ToggleButtonGroup>
                        )}
                        {cardMode === 'catalog' ? (
                            <TextField
                                select
                                label="Service"
                                value={formCatalogId}
                                onChange={(e) => setFormCatalogId(e.target.value)}
                                fullWidth
                                SelectProps={{
                                    renderValue: (value) => {
                                        const link = catalogById.get(String(value));
                                        if (!link) return String(value);
                                        return (
                                            <Stack direction="row" spacing={1.25} alignItems="center">
                                                <LinkIconMark link={link} size={28} />
                                                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                                                    {link.title}
                                                </Typography>
                                            </Stack>
                                        );
                                    },
                                    MenuProps: {
                                        PaperProps: { sx: { maxHeight: 360 } },
                                    },
                                }}
                            >
                                {catalog.map((link) => (
                                    <MenuItem key={link.id} value={link.id}>
                                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5 }}>
                                            <LinkIconMark link={link} size={32} />
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                                    {link.title}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {link.kind === 'external' ? 'Service' : 'Page'}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </MenuItem>
                                ))}
                            </TextField>
                        ) : (
                            <>
                                <TextField
                                    label="Title"
                                    required
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    fullWidth
                                    autoFocus
                                />
                                <TextField
                                    label="URL"
                                    required
                                    value={formUrl}
                                    onChange={(e) => setFormUrl(e.target.value)}
                                    fullWidth
                                    placeholder="https://example.com or mailto:user@domain.com"
                                />
                                <TextField
                                    label="Description"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={2}
                                />
                                <Divider />
                                <Typography variant="subtitle2">Icon</Typography>
                                <ToggleButtonGroup
                                    exclusive
                                    size="small"
                                    value={formIconKind}
                                    onChange={(_, v) => v && setFormIconKind(v)}
                                >
                                    <ToggleButton value="mui">MUI icon</ToggleButton>
                                    <ToggleButton value="emoji">Emoji</ToggleButton>
                                </ToggleButtonGroup>
                                {formIconKind === 'mui' ? (
                                    <TextField
                                        select
                                        label="Icon"
                                        value={formMuiIcon}
                                        onChange={(e) => setFormMuiIcon(e.target.value)}
                                        fullWidth
                                    >
                                        {HOME_MUI_ICON_OPTIONS.map((name) => (
                                            <MenuItem key={name} value={name}>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    {MUI_ICON_MAP[name]}
                                                    <span>{name}</span>
                                                </Stack>
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                ) : (
                                    <TextField
                                        label="Emoji"
                                        value={formEmoji}
                                        onChange={(e) => setFormEmoji(e.target.value)}
                                        fullWidth
                                        inputProps={{ maxLength: 8 }}
                                    />
                                )}
                            </>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setCardDialog(false);
                            setEditingCardId(null);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={saveCardDialog}
                        disabled={
                            cardMode === 'custom'
                                ? !formTitle.trim() || !formUrl.trim()
                                : !formCatalogId
                        }
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Home;
