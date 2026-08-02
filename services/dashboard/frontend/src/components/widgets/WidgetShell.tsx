import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    Box,
    IconButton,
    Menu,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {
    Delete as DeleteIcon,
    DragIndicator as DragIcon,
    Link as LinkIcon,
} from '@mui/icons-material';
import { HOME_MUI_ICON_OPTIONS } from '../../homeLinks';
import { MUI_ICON_MAP } from './LinkTiles';

export function WidgetShell({
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
