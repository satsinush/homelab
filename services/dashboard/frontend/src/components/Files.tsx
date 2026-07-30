// src/components/Files.tsx
import React, { useState } from 'react';
import {
    Box,
    Typography,
    Container,
    Tabs,
    Tab,
    Button,
    Stack,
    Paper,
    Link,
} from '@mui/material';
import {
    FolderCopy as FilesIcon,
    ContentCopy as CopyIcon,
    Check as CheckIcon,
    LaptopWindows as WindowsIcon,
    Apple as MacIcon,
    Terminal as LinuxIcon,
    PhoneIphone as IosIcon,
    Android as AndroidIcon,
    Launch as OpenIcon,
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { useConfig } from '../contexts/useConfig';
import { useAuth } from '../contexts/useAuth';

const SMB_ADMIN_ROLE = 'homelab-admin';

interface CopyRowProps {
    label: string;
    value: string;
    onCopy: (text: string, id: string) => void;
    copyFeedback: string | null;
    feedbackId: string;
}

const CopyRow = ({ label, value, onCopy, copyFeedback, feedbackId }: CopyRowProps) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
        }}
    >
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" display="block">
                {label}
            </Typography>
            <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', userSelect: 'all' }}
            >
                {value}
            </Typography>
        </Box>
        <Button
            size="small"
            startIcon={copyFeedback === feedbackId ? <CheckIcon color="success" /> : <CopyIcon />}
            onClick={() => onCopy(value, feedbackId)}
        >
            {copyFeedback === feedbackId ? 'Copied' : 'Copy'}
        </Button>
    </Box>
);

const HOW_TO_CONNECT: Record<string, string> = {
    windows: 'File Explorer → This PC → Map network drive',
    macos: 'Finder → Go → Connect to Server (⌘K)',
    linux: 'Files → Connect to Server, or smbclient',
    ios: 'Files → ⋯ → Connect to Server',
    android: 'Material Files (or similar) → Add → SMB',
};

const Files = () => {
    const { user } = useAuth();
    const { config } = useConfig();
    const [tabVal, setTabVal] = useState(0);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
    const isSmbAdmin = Boolean(user?.roles?.includes(SMB_ADMIN_ROLE));

    const filesHost = config.hostnames.dav || 'cloud.homelab.local';
    const homelabHost =
        config.homelabHostname ||
        window.location.hostname.replace('dashboard.', '') ||
        'homelab.local';
    const username = user?.username || 'username';
    const webBrowserUrl = `https://${filesHost}/`;

    const formats = {
        windows: {
            smbPrivate: `\\\\${homelabHost}\\${username}`,
            smbShared: `\\\\${homelabHost}\\shared`,
        },
        macos: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`,
        },
        linux: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`,
        },
        ios: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`,
        },
        android: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`,
        },
    };

    const activeOS = (['windows', 'macos', 'linux', 'ios', 'android'] as const)[tabVal];
    const strings = formats[activeOS];

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyFeedback(id);
        setTimeout(() => setCopyFeedback(null), 2000);
    };

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 2, md: 4 } }}>
            <PageHeader title="Sync & Files" icon={<FilesIcon />} />

            <Stack spacing={3}>
                <Box>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        Everyday files, calendar, and contacts live in Nextcloud.
                    </Typography>
                    <Button
                        variant="contained"
                        endIcon={<OpenIcon />}
                        component={Link}
                        href={webBrowserUrl}
                        target="_blank"
                        rel="noopener"
                        sx={{ textDecoration: 'none' }}
                    >
                        Open Nextcloud
                    </Button>
                </Box>

                {isSmbAdmin && (
                    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Network shares (SMB)
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Same Authentik password · {HOW_TO_CONNECT[activeOS]}
                            </Typography>
                        </Box>
                        <Tabs
                            value={tabVal}
                            onChange={(_e, v: number) => setTabVal(v)}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
                        >
                            <Tab icon={<WindowsIcon />} iconPosition="start" label="Windows" />
                            <Tab icon={<MacIcon />} iconPosition="start" label="macOS" />
                            <Tab icon={<LinuxIcon />} iconPosition="start" label="Linux" />
                            <Tab icon={<IosIcon />} iconPosition="start" label="iOS" />
                            <Tab icon={<AndroidIcon />} iconPosition="start" label="Android" />
                        </Tabs>
                        <Stack spacing={1.5} sx={{ p: 2 }}>
                            <CopyRow
                                label="Your folder"
                                value={strings.smbPrivate}
                                onCopy={handleCopy}
                                copyFeedback={copyFeedback}
                                feedbackId="smb_priv"
                            />
                            <CopyRow
                                label="Shared"
                                value={strings.smbShared}
                                onCopy={handleCopy}
                                copyFeedback={copyFeedback}
                                feedbackId="smb_shared"
                            />
                        </Stack>
                    </Paper>
                )}

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Apps &amp; sync
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Copy WebDAV from Nextcloud Settings, and CalDAV / CardDAV from the Calendar
                        and Contacts apps. On Android, DAVx⁵ is the usual choice.
                    </Typography>
                </Paper>
            </Stack>
        </Container>
    );
};

export default Files;
