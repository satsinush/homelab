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
    Divider,
    Paper,
    Link,
    Alert
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
    FolderShared as WebBrowserIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { useConfig } from '../contexts/useConfig';
import { useAuth } from '../contexts/useAuth';

interface CopyRowProps {
    label: string;
    value: string;
    caption?: string;
    onCopy: (text: string, id: string) => void;
    copyFeedback: string | null;
    feedbackId: string;
}

const CopyRow = ({ label, value, caption, onCopy, copyFeedback, feedbackId }: CopyRowProps) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
            {caption && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>{caption}</Typography>}
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.25 }}>{label}</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', userSelect: 'all' }}>{value}</Typography>
        </Box>
        <Button size="small" startIcon={copyFeedback === feedbackId ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => onCopy(value, feedbackId)}>
            {copyFeedback === feedbackId ? 'Copied' : 'Copy'}
        </Button>
    </Box>
);

const Files = () => {
    const { user } = useAuth();
    const { config } = useConfig();
    const [tabVal, setTabVal] = useState(0);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    const filesHost = config.hostnames.dav || 'cloud.homelab.local';
    const homelabHost = config.homelabHostname || window.location.hostname.replace('dashboard.', '') || 'homelab.local';
    const username = user?.username || 'username';
    const webBrowserUrl = `https://${filesHost}/`;

    const formats = {
        windows: {
            smbPrivate: `\\\\${homelabHost}\\${username}`,
            smbShared: `\\\\${homelabHost}\\shared`
        },
        macos: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`
        },
        linux: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`
        },
        ios: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`
        },
        android: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`
        }
    };

    const activeOS = (['windows', 'macos', 'linux', 'ios', 'android'] as const)[tabVal];
    const strings = formats[activeOS];

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyFeedback(id);
        setTimeout(() => setCopyFeedback(null), 2000);
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabVal(newValue);
    };

    return (
        <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
            <PageHeader title="Sync & Files" icon={<FilesIcon />} />

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                SMB for bulk LAN transfers; Nextcloud for everyday files, WebDAV, calendar, and contacts.
                Sign in with Authentik (same password for mail/IMAP and Samba).
            </Typography>

            <Button
                variant="contained"
                color="primary"
                startIcon={<WebBrowserIcon />}
                endIcon={<OpenIcon />}
                component={Link}
                href={webBrowserUrl}
                target="_blank"
                rel="noopener"
                sx={{ mb: 4, textDecoration: 'none', py: 1.5, px: 3 }}
            >
                Open Nextcloud
            </Button>

            <Paper sx={{ mb: 4, border: '1px solid', borderColor: 'divider' }}>
                <Tabs
                    value={tabVal}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
                >
                    <Tab icon={<WindowsIcon />} iconPosition="start" label="Windows" />
                    <Tab icon={<MacIcon />} iconPosition="start" label="macOS" />
                    <Tab icon={<LinuxIcon />} iconPosition="start" label="Linux" />
                    <Tab icon={<IosIcon />} iconPosition="start" label="iOS" />
                    <Tab icon={<AndroidIcon />} iconPosition="start" label="Android" />
                </Tabs>

                <Box sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                                SMB (Samba Network Shares)
                            </Typography>
                            {activeOS === 'windows' && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Map these in File Explorer (This PC → Map network drive) to mount folders directly.
                                </Typography>
                            )}
                            {activeOS === 'macos' && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    In Finder, press <strong>Cmd + K</strong> (or click Go → Connect to Server) to mount these.
                                </Typography>
                            )}
                            {activeOS === 'ios' && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    In the native <strong>Files</strong> app, tap the three dots (top right), choose <strong>Connect to Server</strong>, and enter either path.
                                </Typography>
                            )}
                            {activeOS === 'android' && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Connect using an app like <strong>Material Files</strong> by selecting <strong>SMB</strong> from the sidebar&apos;s Add Connection menu.
                                </Typography>
                            )}
                            {activeOS === 'linux' && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Open these in your file manager (Connect to Server / smb://) or mount with <Box component="span" sx={{ fontFamily: 'monospace' }}>smbclient</Box>.
                                </Typography>
                            )}
                            <Stack spacing={2}>
                                <CopyRow caption="Private storage — Authentik username + password" label="Private Folder URL" value={strings.smbPrivate} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_priv" />
                                <CopyRow caption="Shared public storage — Authentik username + password" label="Shared Folder URL" value={strings.smbShared} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_shared" />
                            </Stack>
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                                WebDAV, Calendar &amp; Contacts
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                Client URLs come from Nextcloud (they include your account path). Open Nextcloud with the button above, then:
                            </Typography>
                            <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
                                <Typography component="li" variant="body2">
                                    <strong>WebDAV</strong> — Settings (avatar menu) → scroll to <strong>WebDAV</strong> and copy the URL.
                                    Use an app password from Settings → Security if the client cannot do SSO.
                                </Typography>
                                <Typography component="li" variant="body2">
                                    <strong>CalDAV</strong> — Calendar app → settings (⋯) → <strong>Copy CalDAV address</strong> (or Calendar settings).
                                </Typography>
                                <Typography component="li" variant="body2">
                                    <strong>CardDAV</strong> — Contacts app → settings (⋯) → <strong>Copy CardDAV address</strong>.
                                </Typography>
                                {activeOS === 'android' && (
                                    <Typography component="li" variant="body2">
                                        On Android, <strong>DAVx⁵</strong> can log into Nextcloud with Authentik/SSO and discover calendars and contacts automatically.
                                    </Typography>
                                )}
                                {activeOS === 'ios' && (
                                    <Typography component="li" variant="body2">
                                        On iOS, Settings → Calendar/Contacts → Accounts → Add Account → Other → CalDAV/CardDAV, then paste the URL from Nextcloud.
                                    </Typography>
                                )}
                            </Stack>
                        </Box>
                    </Stack>
                </Box>
            </Paper>

            <Alert severity="info" sx={{ border: '1px solid', borderColor: 'info.light' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Tip</Typography>
                <Typography variant="body2">
                    Most calendar/contact apps only need one of the CalDAV or CardDAV URLs from Nextcloud; they discover the rest under your account.
                </Typography>
            </Alert>
        </Container>
    );
};

export default Files;
