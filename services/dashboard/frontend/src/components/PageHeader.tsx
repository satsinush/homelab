// src/components/PageHeader.tsx
import React from 'react';
import { Box, Typography } from '@mui/material';

interface PageHeaderProps {
    /** Page title shown next to the icon */
    title: string;
    /** Page icon (typically the same icon used in the sidebar navigation) */
    icon: React.ReactNode;
    /** Optional controls rendered on the right side of the header row (chips, buttons, etc.) */
    actions?: React.ReactNode;
}

/**
 * Standard page header: icon + title in the top left, optional actions on the
 * right. Keeps every page's header consistent in size and spacing.
 */
const PageHeader = ({ title, icon, actions }: PageHeaderProps) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: { xs: 2, md: 3 }
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    color: 'primary.main',
                    '& svg': { fontSize: { xs: '1.75rem', md: '2.125rem' } },
                    '& img': { width: { xs: 28, md: 34 }, height: { xs: 28, md: 34 } }
                }}
            >
                {icon}
            </Box>
            <Typography
                component="h1"
                sx={{
                    typography: { xs: 'h5', md: 'h4' },
                    fontWeight: 600,
                    color: 'text.primary',
                    lineHeight: 1.2
                }}
            >
                {title}
            </Typography>
        </Box>
        {actions && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
                {actions}
            </Box>
        )}
    </Box>
);

export default PageHeader;
