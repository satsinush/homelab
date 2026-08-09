import React from 'react';
import { Avatar, Box, IconButton, Stack, Typography } from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Link as LinkIcon,
} from '@mui/icons-material';
import type { HomeLinkItem } from '../../homeLinks';
import {
    NAV_ICONS,
    renderIconToken,
    useLinkOpen,
} from './linkTileUtils';

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
