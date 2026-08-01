import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Grid,
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
    Collapse,
    MenuItem,
    ToggleButton,
    ToggleButtonGroup,
    Divider,
    CircularProgress,
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
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import type { HomeCard, HomeSection, UserSettings } from '../types/api';
import {
    BUILTIN_SECTION_LABELS,
    HOME_MUI_ICON_OPTIONS,
    defaultHomeLayout,
    resolveBuiltinLinks,
    resolveHomeCard,
    type HomeLinkItem,
} from '../homeLinks';
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

const cardSx = {
    textDecoration: 'none',
    color: 'inherit',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s, box-shadow 0.2s',
} as const;

function LinkAvatar({ link }: { link: HomeLinkItem }) {
    if (link.logoSrc) {
        return (
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    mr: 2,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    boxShadow: 2,
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
        <Avatar sx={{ bgcolor: `${link.color}.main`, mr: 2 }}>
            {link.iconToken
                ? renderIconToken(link.iconToken)
                : NAV_ICONS[link.iconKey] || <LinkIcon />}
        </Avatar>
    );
}

function LinkCard({
    link,
    onOpen,
    dragHandle,
    editActions,
    editing = false,
}: {
    link: HomeLinkItem;
    onOpen: (id: string) => void;
    dragHandle?: React.ReactNode;
    editActions?: React.ReactNode;
    editing?: boolean;
}) {
    const navigate = useNavigate();

    const sx = {
        ...cardSx,
        position: 'relative' as const,
        cursor: editing ? 'default' : 'pointer',
        ...(editing
            ? {}
            : {
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
              }),
    };

    const body = (
        <>
            {editActions && (
                <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    {editActions}
                </Stack>
            )}
            <CardContent sx={{ flexGrow: 1, pr: editActions ? 6 : undefined }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {dragHandle && (
                        <Box
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            {dragHandle}
                        </Box>
                    )}
                    <LinkAvatar link={link} />
                    <Typography variant="h6" component="h3">
                        {link.title}
                    </Typography>
                </Box>
                {link.description && (
                    <Typography variant="body2" color="text.secondary">
                        {link.description}
                    </Typography>
                )}
            </CardContent>
            <CardActions>
                <Button
                    size="small"
                    color={link.color}
                    component="div"
                    sx={{ ml: 'auto' }}
                    disabled={editing}
                >
                    Open
                </Button>
            </CardActions>
        </>
    );

    // Static card in edit mode — not a link, no hover lift
    if (editing) {
        return (
            <Card sx={sx} elevation={1}>
                {body}
            </Card>
        );
    }

    // Native <a> so middle-click / ctrl-click open new tabs reliably.
    // Left-click without modifiers uses client-side navigate for SPAs.
    return (
        <Card
            component="a"
            href={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
                if (e.button !== 0) return;
                onOpen(link.id);
                if (link.external) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate(link.href);
            }}
            onAuxClick={(e) => {
                if (e.button === 1) onOpen(link.id);
            }}
            sx={sx}
        >
            {body}
        </Card>
    );
}

function SortableCard({
    link,
    onOpen,
    onEdit,
    onDelete,
    editing,
}: {
    link: HomeLinkItem;
    onOpen: (id: string) => void;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    editing: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: link.id,
        disabled: !editing,
    });

    return (
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box
                ref={setNodeRef}
                sx={{
                    height: '100%',
                    width: '100%',
                    // Translate only — full Transform can scale/squish during drag
                    transform: CSS.Translate.toString(transform),
                    transition,
                    opacity: isDragging ? 0.7 : 1,
                    zIndex: isDragging ? 1 : 0,
                }}
            >
                <LinkCard
                    link={link}
                    onOpen={onOpen}
                    editing={editing}
                    dragHandle={
                        editing ? (
                            <IconButton
                                size="small"
                                {...attributes}
                                {...listeners}
                                onClick={(e) => e.preventDefault()}
                                sx={{ mr: 0.5, cursor: 'grab', touchAction: 'none' }}
                            >
                                <DragIcon fontSize="small" />
                            </IconButton>
                        ) : undefined
                    }
                    editActions={
                        editing ? (
                            <>
                                {link.editable && onEdit && (
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onEdit(link.id);
                                        }}
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                )}
                                {onDelete && (
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onDelete(link.id);
                                        }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </>
                        ) : undefined
                    }
                />
            </Box>
        </Grid>
    );
}

function SortableSectionShell({
    section,
    editing,
    children,
    onToggleCollapse,
    onRename,
    onToggleHidden,
    onDelete,
    headerActions,
}: {
    section: HomeSection;
    editing: boolean;
    children: React.ReactNode;
    onToggleCollapse: () => void;
    onRename: (title: string) => void;
    onToggleHidden: () => void;
    onDelete?: () => void;
    headerActions?: React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
        disabled: !editing,
    });

    const kindChip =
        section.kind !== 'custom' ? (
            <Chip size="small" label={BUILTIN_SECTION_LABELS[section.kind]} variant="outlined" />
        ) : (
            <Chip size="small" label="Custom" color="secondary" variant="outlined" />
        );

    return (
        <Box
            ref={setNodeRef}
            id={`home-section-${section.id}`}
            sx={{
                mb: 3,
                width: '100%',
                boxSizing: 'border-box',
                // Translate only — full Transform can scale/squish during drag
                transform: CSS.Translate.toString(transform),
                transition,
                opacity: isDragging ? 0.85 : section.hidden && editing ? 0.55 : 1,
                outline: editing ? '1px dashed' : 'none',
                outlineColor: 'divider',
                borderRadius: 2,
                p: editing ? 1.5 : 0,
                bgcolor: isDragging ? 'background.paper' : undefined,
                boxShadow: isDragging ? 4 : undefined,
                scrollMarginTop: 88,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: isDragging ? 0 : 1 }}>
                {editing && (
                    <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: 'grab', flexShrink: 0 }}>
                        <DragIcon fontSize="small" />
                    </IconButton>
                )}
                {editing ? (
                    <TextField
                        size="small"
                        value={section.title}
                        onChange={(e) => onRename(e.target.value)}
                        sx={{ minWidth: 160, maxWidth: 360 }}
                    />
                ) : (
                    <Typography variant="h5" component="h2">
                        {section.title}
                    </Typography>
                )}
                {editing && kindChip}
                {section.hidden && editing && <Chip size="small" label="Hidden" />}
                {headerActions}
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <IconButton size="small" onClick={onToggleCollapse} aria-label="Toggle section">
                        {section.collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                    </IconButton>
                    {editing && (
                        <Tooltip title={section.hidden ? 'Show section' : 'Hide section'}>
                            <IconButton size="small" onClick={onToggleHidden} sx={{ width: 34, height: 34 }}>
                                {section.hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                        </Tooltip>
                    )}
                    {editing && section.kind === 'custom' && onDelete && (
                        <IconButton size="small" color="error" onClick={onDelete}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            </Box>
            {/* Keep drag preview compact so tall sections don't squish in the list */}
            {!isDragging && <Collapse in={!section.collapsed}>{children}</Collapse>}
        </Box>
    );
}

const Home = () => {
    const { user, hasPermission } = useAuth();
    const { config } = useConfig();
    const hostnames = config.hostnames || {};

    const [editing, setEditing] = useState(false);
    const [recentIds, setRecentIds] = useState<string[]>([]);
    const [layout, setLayout] = useState<HomeSection[]>(defaultHomeLayout);
    const [cards, setCards] = useState<HomeCard[]>([]);
    const [loaded, setLoaded] = useState(false);

    const [cardDialog, setCardDialog] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [scrollToSectionId, setScrollToSectionId] = useState<string | null>(null);
    const [cardDialogSectionId, setCardDialogSectionId] = useState<string | null>(null);
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [cardMode, setCardMode] = useState<'catalog' | 'custom'>('custom');
    const [formTitle, setFormTitle] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIconKind, setFormIconKind] = useState<'mui' | 'emoji'>('mui');
    const [formMuiIcon, setFormMuiIcon] = useState<string>('Link');
    const [formEmoji, setFormEmoji] = useState('🔗');
    const [formCatalogId, setFormCatalogId] = useState('');

    const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef({ recentIds, layout, cards });
    latest.current = { recentIds, layout, cards };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const persist = useCallback(
        (patch?: Partial<{ homeRecentIds: string[]; homeLayout: HomeSection[]; homeCards: HomeCard[] }>) => {
            if (persistTimer.current) clearTimeout(persistTimer.current);
            persistTimer.current = setTimeout(async () => {
                const cur = latest.current;
                try {
                    const data: Record<string, unknown> = {
                        homeLayout: patch?.homeLayout ?? cur.layout,
                        homeCards: patch?.homeCards ?? cur.cards,
                    };
                    // Only write recents when explicitly patched — avoid overwriting
                    // route-tracker updates with a stale Home display snapshot.
                    if (patch?.homeRecentIds !== undefined) {
                        data.homeRecentIds = patch.homeRecentIds;
                    }
                    await tryApiCall('/user-settings', {
                        method: 'PUT',
                        data,
                    });
                } catch (err) {
                    console.error('Failed to save home layout', err);
                }
            }, 400);
        },
        []
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Flush any pending click/route writes so the Home snapshot is current
                await flushHomeRecentsNow();
                if (cancelled) return;

                const res = await tryApiCall<{ settings: UserSettings }>('/user-settings');
                if (cancelled) return;
                const s = res.data?.settings;
                if (s) {
                    const recents = Array.isArray(s.homeRecentIds) ? s.homeRecentIds : [];
                    setRecentIds(recents);
                    setHomeRecentsMemory(recents);
                    if (Array.isArray(s.homeLayout) && s.homeLayout.length > 0) {
                        setLayout(s.homeLayout);
                    }
                    if (Array.isArray(s.homeCards)) setCards(s.homeCards);
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

    const updateLayout = (next: HomeSection[]) => {
        setLayout(next);
        persist({ homeLayout: next });
    };

    const updateCards = (next: HomeCard[], nextLayout?: HomeSection[]) => {
        setCards(next);
        if (nextLayout) {
            setLayout(nextLayout);
            persist({ homeCards: next, homeLayout: nextLayout });
        } else {
            persist({ homeCards: next });
        }
    };

    const recordOpen = useCallback(
        (openedId: string) => {
            // Prefer catalog id for shortcuts so recents match builtin cards
            const card = cardsById.get(openedId);
            const trackId = card?.type === 'catalog' ? card.catalogId : openedId;
            // Persist only — keep displayed Recents frozen until Home remounts/refreshes
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

    const onSectionDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = layout.findIndex((s) => s.id === active.id);
        const newIndex = layout.findIndex((s) => s.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        updateLayout(arrayMove(layout, oldIndex, newIndex));
    };

    const onCardDragEnd = (sectionId: string) => (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const section = layout.find((s) => s.id === sectionId);
        if (!section) return;
        const oldIndex = section.cardIds.indexOf(String(active.id));
        const newIndex = section.cardIds.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return;
        const next = layout.map((s) =>
            s.id === sectionId ? { ...s, cardIds: arrayMove(s.cardIds, oldIndex, newIndex) } : s
        );
        updateLayout(next);
    };

    const openAddCard = (sectionId: string) => {
        setCardDialogSectionId(sectionId);
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
        if (!card || card.type !== 'custom') return;
        setEditingCardId(cardId);
        setCardDialogSectionId(null);
        setCardMode('custom');
        setFormTitle(card.title);
        setFormUrl(card.url);
        setFormDescription(card.description || '');
        if (card.icon.startsWith('emoji:')) {
            setFormIconKind('emoji');
            setFormEmoji(card.icon.slice('emoji:'.length));
        } else {
            setFormIconKind('mui');
            setFormMuiIcon(card.icon.replace(/^mui:/, '') || 'Link');
        }
        setCardDialog(true);
    };

    const saveCardDialog = () => {
        if (editingCardId) {
            const icon =
                formIconKind === 'emoji' ? `emoji:${formEmoji || '🔗'}` : `mui:${formMuiIcon}`;
            let url = formUrl.trim();
            if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
            const next = cards.map((c) =>
                c.id === editingCardId && c.type === 'custom'
                    ? {
                          ...c,
                          title: formTitle.trim(),
                          url,
                          description: formDescription.trim(),
                          icon,
                      }
                    : c
            );
            updateCards(next);
            setCardDialog(false);
            return;
        }

        if (!cardDialogSectionId) return;

        if (cardMode === 'catalog') {
            if (!formCatalogId) return;
            const id = `card-${crypto.randomUUID()}`;
            const nextCards: HomeCard[] = [...cards, { id, type: 'catalog', catalogId: formCatalogId }];
            const nextLayout = layout.map((s) =>
                s.id === cardDialogSectionId ? { ...s, cardIds: [...s.cardIds, id] } : s
            );
            updateCards(nextCards, nextLayout);
        } else {
            const title = formTitle.trim();
            let url = formUrl.trim();
            if (!title || !url) return;
            if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
            const icon =
                formIconKind === 'emoji' ? `emoji:${formEmoji || '🔗'}` : `mui:${formMuiIcon}`;
            const id = `card-${crypto.randomUUID()}`;
            const nextCards: HomeCard[] = [
                ...cards,
                {
                    id,
                    type: 'custom',
                    title,
                    url,
                    description: formDescription.trim(),
                    icon,
                },
            ];
            const nextLayout = layout.map((s) =>
                s.id === cardDialogSectionId ? { ...s, cardIds: [...s.cardIds, id] } : s
            );
            updateCards(nextCards, nextLayout);
        }
        setCardDialog(false);
    };

    const deleteCard = (sectionId: string, cardId: string) => {
        const nextCards = cards.filter((c) => c.id !== cardId);
        const nextLayout = layout.map((s) =>
            s.id === sectionId ? { ...s, cardIds: s.cardIds.filter((id) => id !== cardId) } : s
        );
        const filteredRecents = (peekHomeRecents() ?? recentIds).filter((x) => x !== cardId);
        setRecentIds((prev) => prev.filter((x) => x !== cardId));
        setHomeRecentsMemory(filteredRecents);
        persist({ homeRecentIds: filteredRecents, homeCards: nextCards, homeLayout: nextLayout });
        setCards(nextCards);
        setLayout(nextLayout);
    };

    const addSection = () => {
        const id = `custom-${crypto.randomUUID()}`;
        updateLayout([
            ...layout,
            {
                id,
                kind: 'custom',
                title: 'New section',
                hidden: false,
                collapsed: false,
                cardIds: [],
            },
        ]);
        setScrollToSectionId(id);
    };

    useEffect(() => {
        if (!scrollToSectionId) return;
        const el = document.getElementById(`home-section-${scrollToSectionId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setScrollToSectionId(null);
            return;
        }
        // Section may not be painted yet — retry once on next frame
        const raf = requestAnimationFrame(() => {
            document
                .getElementById(`home-section-${scrollToSectionId}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setScrollToSectionId(null);
        });
        return () => cancelAnimationFrame(raf);
    }, [scrollToSectionId, layout]);

    const resetToDefaults = () => {
        const nextLayout = defaultHomeLayout();
        const nextCards: HomeCard[] = [];
        const nextRecents: string[] = [];
        setLayout(nextLayout);
        setCards(nextCards);
        setRecentIds(nextRecents);
        clearHomeRecentsMemory();
        persist({
            homeLayout: nextLayout,
            homeCards: nextCards,
            homeRecentIds: nextRecents,
        });
        setResetConfirmOpen(false);
    };

    const clearRecents = () => {
        setRecentIds([]);
        clearHomeRecentsMemory();
        persist({ homeRecentIds: [] });
    };

    const deleteSection = (sectionId: string) => {
        const section = layout.find((s) => s.id === sectionId);
        if (!section || section.kind !== 'custom') return;
        const removeIds = new Set(section.cardIds);
        const nextCards = cards.filter((c) => !removeIds.has(c.id));
        const nextLayout = layout.filter((s) => s.id !== sectionId);
        updateCards(nextCards, nextLayout);
    };

    const renderLinkGrid = (links: HomeLinkItem[], opts?: {
        sectionId?: string;
        sortable?: boolean;
    }) => {
        if (links.length === 0) {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    {editing ? 'Add links with the buttons below.' : 'Nothing here yet.'}
                </Typography>
            );
        }
        if (opts?.sortable && opts.sectionId && editing) {
            return (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onCardDragEnd(opts.sectionId)}
                >
                    <SortableContext items={links.map((l) => l.id)} strategy={rectSortingStrategy}>
                        <Grid container spacing={2}>
                            {links.map((link) => (
                                <SortableCard
                                    key={link.id}
                                    link={link}
                                    onOpen={recordOpen}
                                    editing={editing}
                                    onEdit={link.editable ? openEditCard : undefined}
                                    onDelete={(id) => deleteCard(opts.sectionId!, id)}
                                />
                            ))}
                        </Grid>
                    </SortableContext>
                </DndContext>
            );
        }
        return (
            <Grid container spacing={2}>
                {links.map((link) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={link.id}>
                        <LinkCard link={link} onOpen={recordOpen} editing={editing} />
                    </Grid>
                ))}
            </Grid>
        );
    };

    const visibleLayout = editing ? layout : layout.filter((s) => !s.hidden);

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
                <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                        Drag sections to reorder. Builtin sections can be hidden or renamed; custom
                        sections can hold shortcuts and your own links.
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
                    <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addSection}>
                        Add section
                    </Button>
                </Stack>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onSectionDragEnd}
            >
                <SortableContext
                    items={visibleLayout.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {visibleLayout.map((section) => {
                        let body: React.ReactNode = null;
                        if (section.kind === 'recents') {
                            body = renderLinkGrid(recentLinks);
                        } else if (section.kind === 'internal') {
                            body = renderLinkGrid(internalLinks);
                        } else if (section.kind === 'external') {
                            body = renderLinkGrid(externalLinks);
                        } else {
                            const links = section.cardIds
                                .map((id) => {
                                    const card = cardsById.get(id);
                                    return card ? resolveHomeCard(card, catalogById) : null;
                                })
                                .filter((x): x is HomeLinkItem => !!x);
                            body = (
                                <>
                                    {renderLinkGrid(links, {
                                        sectionId: section.id,
                                        sortable: true,
                                    })}
                                    {editing && (
                                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => openAddCard(section.id)}
                                            >
                                                Add link
                                            </Button>
                                        </Stack>
                                    )}
                                </>
                            );
                        }

                        return (
                            <SortableSectionShell
                                key={section.id}
                                section={section}
                                editing={editing}
                                headerActions={
                                    section.kind === 'recents' && recentIds.length > 0 ? (
                                        <Button size="small" onClick={clearRecents} sx={{ ml: 0.5 }}>
                                            Clear
                                        </Button>
                                    ) : undefined
                                }
                                onToggleCollapse={() =>
                                    updateLayout(
                                        layout.map((s) =>
                                            s.id === section.id
                                                ? { ...s, collapsed: !s.collapsed }
                                                : s
                                        )
                                    )
                                }
                                onRename={(title) =>
                                    updateLayout(
                                        layout.map((s) =>
                                            s.id === section.id ? { ...s, title } : s
                                        )
                                    )
                                }
                                onToggleHidden={() =>
                                    updateLayout(
                                        layout.map((s) =>
                                            s.id === section.id ? { ...s, hidden: !s.hidden } : s
                                        )
                                    )
                                }
                                onDelete={
                                    section.kind === 'custom'
                                        ? () => deleteSection(section.id)
                                        : undefined
                                }
                            >
                                {body}
                            </SortableSectionShell>
                        );
                    })}
                </SortableContext>
            </DndContext>

            <Dialog open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Reset home layout?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        This restores the default Recents, Internal, and External sections, removes all
                        custom sections and cards, and clears recents. This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={resetToDefaults}>
                        Reset
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={cardDialog} onClose={() => setCardDialog(false)} fullWidth maxWidth="sm">
                <DialogTitle>
                    {editingCardId ? 'Edit link' : 'Add link'}
                </DialogTitle>
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

                        {cardMode === 'catalog' && !editingCardId ? (
                            <TextField
                                select
                                label="Service"
                                value={formCatalogId}
                                onChange={(e) => setFormCatalogId(e.target.value)}
                                fullWidth
                            >
                                {catalog.map((link) => (
                                    <MenuItem key={link.id} value={link.id}>
                                        {link.title} ({link.kind})
                                    </MenuItem>
                                ))}
                            </TextField>
                        ) : (
                            <>
                                <TextField
                                    label="Title"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    fullWidth
                                    autoFocus
                                />
                                <TextField
                                    label="URL"
                                    value={formUrl}
                                    onChange={(e) => setFormUrl(e.target.value)}
                                    fullWidth
                                    placeholder="https://example.com"
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
                    <Button onClick={() => setCardDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={saveCardDialog}
                        disabled={
                            cardMode === 'custom' && !editingCardId
                                ? !formTitle.trim() || !formUrl.trim()
                                : cardMode === 'catalog' && !formCatalogId
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
