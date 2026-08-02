import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { HomeLinkItem } from '../../homeLinks';
import { RecentTile, ServiceTile } from './LinkTiles';

export function LinksWidgetBody({
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
