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
    GlobalStyles,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Person as PersonIcon,
    Home as HomeIcon,
    Add as AddIcon,
    RestartAlt as ResetIcon,
    Clear as ClearIcon,
} from '@mui/icons-material';
import GridLayout, { verticalCompactor, type Layout } from 'react-grid-layout';
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
import type { HomeCard, HomeWidget, UserSettings } from '../types/api';
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
import PiHoleLogo from '../assets/pi_hole_logo.png';
import VaultwardenLogo from '../assets/vaultwarden_logo.png';
import GatusLogo from '../assets/gatus_logo.png';
import GotifyLogo from '../assets/gotify_logo.png';
import AuthIcon from '../assets/authentik_logo.png';
import DockhandLogo from '../assets/dockhand_logo.png';
import NextcloudLogo from '../assets/nextcloud_logo.png';
import ImmichLogo from '../assets/immich_logo.png';
import StalwartLogo from '../assets/stalwart_logo.png';
import ClipCascadeLogo from '../assets/clipcascade_logo.png';

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
    'external-clipcascade': ClipCascadeLogo,
};

import {
    ClockWidgetBody,
    DevicesWidgetBody,
    GatusWidgetBody,
    LinkIconMark,
    LinksWidgetBody,
    MUI_ICON_MAP,
    PackagesWidgetBody,
    SystemWidgetBody,
    WakeWidgetBody,
    WidgetShell,
} from './widgets';

const Home = () => {
    const { user, hasPermission } = useAuth();
    const { config } = useConfig();
    const hostnames = useMemo(() => config.hostnames || {}, [config.hostnames]);
    const theme = useTheme();
    // Match Navigation: treat md-and-down as mobile (not RGL container width).
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const [loaded, setLoaded] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [measuredWidth, setMeasuredWidth] = useState<number>(0);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const target = el.parentElement || el;
        const updateWidth = () => {
            const rect = target.getBoundingClientRect();
            // Subtract horizontal padding of parent container (24px padding on lg container = 48px)
            const style = getComputedStyle(target);
            const padLeft = parseFloat(style.paddingLeft) || 0;
            const padRight = parseFloat(style.paddingRight) || 0;
            const availableWidth = Math.floor(rect.width - padLeft - padRight);
            if (availableWidth > 0) setMeasuredWidth(availableWidth);
        };
        updateWidth();
        const ro = new ResizeObserver(updateWidth);
        ro.observe(target);
        window.addEventListener('resize', updateWidth);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', updateWidth);
        };
    }, [loaded]);

    const [editing, setEditing] = useState(false);
    const layoutEditing = editing && !isMobile;
    const [recentIds, setRecentIds] = useState<string[]>([]);
    const [widgets, setWidgets] = useState<HomeWidget[]>(defaultHomeWidgets);
    const [cards, setCards] = useState<HomeCard[]>([]);

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
                    maxWidth: '100%',
                    minWidth: 0,
                    overflow: 'hidden',
                    minHeight: 200,
                    // Extra room below so resizing a bottom widget can scroll into view.
                    pb: editing ? 12 : 0,
                    '& .react-grid-layout': {
                        maxWidth: '100%',
                    },
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
                            '.react-grid-item.react-grid-placeholder': {
                                background: `${theme.palette.primary.main}25 !important`,
                                border: `2px dashed ${theme.palette.primary.main} !important`,
                                borderRadius: '12px !important',
                                opacity: '0.85 !important',
                                transitionDuration: '100ms',
                                zIndex: 2,
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
                {isMobile ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                        {widgets.map((widget) => {
                            return (
                                <Box key={widget.id} sx={{ width: '100%' }}>
                                    <WidgetShell
                                        title={editing ? (widget.title ?? '') : widgetTitle(widget)}
                                        titlePlaceholder={HOME_WIDGET_META[widget.type].label}
                                        iconName={widgetIconName(widget)}
                                        editing={editing}
                                        layoutEditing={false}
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
                                </Box>
                            );
                        })}
                    </Box>
                ) : (
                    measuredWidth > 0 && (
                        <GridLayout
                            key="desktop"
                            width={measuredWidth}
                            layout={gridLayout}
                            gridConfig={{
                                cols: HOME_GRID_COLS,
                                rowHeight: HOME_GRID_ROW_HEIGHT,
                                margin: [12, 12],
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
                    )
                )}
            </Box>

            {editing && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        size="medium"
                        onClick={() => setEditing(false)}
                    >
                        Exit customize mode
                    </Button>
                </Box>
            )}

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
