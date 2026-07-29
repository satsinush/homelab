import { SxProps, Theme } from '@mui/material';

/** Results column on the game layout grid */
export const resultsColumnSx: SxProps<Theme> = {
    height: { xs: 'auto', md: '100%' },
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    maxHeight: { xs: 'min(100dvh, 840px)', md: 'none' },
};

/** Outer results Card — clips to column height */
export const resultsCardSx: SxProps<Theme> = {
    height: { xs: '100%', md: '100%' },
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
};

/**
 * CardContent around result tables. Not the vertical scroll owner —
 * that stays on the table wrap so sticky headers keep working.
 */
export const resultsCardContentSx: SxProps<Theme> = {
    flexGrow: 1,
    overflow: 'hidden',
    p: { xs: 1.5, md: 2 },
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    '&:last-child': { pb: { xs: 1.5, md: 2 } },
};

/** Single vertical (+ horizontal) scroll owner for result tables/lists */
export const resultsScrollBodySx: SxProps<Theme> = {
    flexGrow: 1,
    overflowX: 'auto',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehaviorY: { xs: 'auto', md: 'contain' },
    minHeight: 0,
    minWidth: 0,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1,
};
