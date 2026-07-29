import React, { ReactNode } from 'react';
import { Box, BoxProps } from '@mui/material';

export interface ScrollContainerProps extends Omit<BoxProps, 'children'> {
    children: ReactNode;
    /** Minimum content width before horizontal scrolling kicks in */
    contentMinWidth?: number | string;
    /** Enable vertical scrolling when maxHeight is set (default true) */
    vertical?: boolean;
}

/**
 * Local scroll owner for dense tables / result panes.
 * Prefer this over page-level overflow clipping.
 */
const ScrollContainer = ({
    children,
    contentMinWidth,
    maxHeight,
    vertical = true,
    sx,
    className,
    ...rest
}: ScrollContainerProps) => {
    return (
        <Box
            className={['scroll-container', className].filter(Boolean).join(' ')}
            sx={{
                minWidth: 0,
                maxWidth: '100%',
                overflowX: 'auto',
                overflowY: vertical && maxHeight != null ? 'auto' : 'visible',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                ...(maxHeight != null ? { maxHeight } : {}),
                ...((sx as object) || {}),
            }}
            {...rest}
        >
            {contentMinWidth ? (
                <Box sx={{ minWidth: contentMinWidth, width: '100%' }}>{children}</Box>
            ) : (
                children
            )}
        </Box>
    );
};

export default ScrollContainer;
