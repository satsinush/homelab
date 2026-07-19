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
    CalendarMonth as CalendarIcon,
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

    const davHost = config.hostnames.dav || 'dav.homelab.local';
    const homelabHost = config.homelabHostname || window.location.hostname.replace('dashboard.', '') || 'homelab.local';
    const username = user?.username || 'username';

    const webBrowserUrl = `https://${davHost}/files/web/client`;
    const calendarPortalUrl = `https://${davHost}/calendar/.web`;

    // Protocol schemes and path strings per OS
    const formats = {
        windows: {
            smbPrivate: `\\\\${homelabHost}\\${username}`,
            smbShared: `\\\\${homelabHost}\\shared`,
            webdav: `https://${davHost}/files/`,
            caldav: `https://${davHost}/calendar/`,
            carddav: `https://${davHost}/contacts/`
        },
        macos: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`,
            webdav: `https://${davHost}/files/`,
            caldav: `https://${davHost}/calendar/`,
            carddav: `https://${davHost}/contacts/`
        },
        linux: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`,
            webdav: `https://${davHost}/files/`,
            caldav: `https://${davHost}/calendar/`,
            carddav: `https://${davHost}/contacts/`
        },
        ios: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`,
            webdav: `https://${davHost}/files/`,
            caldav: `https://${davHost}/calendar/`,
            carddav: `https://${davHost}/contacts/`
        },
        android: {
            smbPrivate: `smb://${homelabHost}/${username}`,
            smbShared: `smb://${homelabHost}/shared`,
            webdav: `https://${davHost}/files/`,
            caldav: `https://${davHost}/calendar/`,
            carddav: `https://${davHost}/contacts/`
        }
    };

    const activeOS = (['windows', 'macos', 'linux', 'ios', 'android'] as const)[tabVal];
    const strings = formats[activeOS];

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyFeedback(id);
        setTimeout(() => setCopyFeedback(null), 2000);
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabVal(newValue);
    };

    return (
        <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
            <PageHeader title="Sync & Files" icon={<FilesIcon />} />

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Configure network file shares (Samba), WebDAV file sync, and calendar/contacts sync (CalDAV &amp; CardDAV).
            </Typography>

            {/* Quick Web Access Links */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<WebBrowserIcon />}
                    endIcon={<OpenIcon />}
                    component={Link}
                    href={webBrowserUrl}
                    target="_blank"
                    rel="noopener"
                    sx={{ flex: 1, textDecoration: 'none', py: 1.5 }}
                >
                    Open File Browser
                </Button>
                <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<CalendarIcon />}
                    endIcon={<OpenIcon />}
                    component={Link}
                    href={calendarPortalUrl}
                    target="_blank"
                    rel="noopener"
                    sx={{ flex: 1, textDecoration: 'none', py: 1.5 }}
                >
                    Open Calendar Portal
                </Button>
            </Stack>

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
                        {/* File Sharing Section */}
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                                File Sharing
                            </Typography>
                            
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 1 }}>
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
                                    Connect using an app like <strong>Material Files</strong> by selecting <strong>SMB</strong> from the sidebar's Add Connection menu.
                                </Typography>
                            )}
                            <Stack spacing={2} sx={{ mb: 3 }}>
                                <CopyRow caption="Private storage (maps directly to your /personal folder)" label="Private Folder URL" value={strings.smbPrivate} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_priv" />
                                <CopyRow caption="Shared public storage (maps to /shared folder)" label="Shared Folder URL" value={strings.smbShared} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_shared" />
                            </Stack>

                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 1 }}>
                                WebDAV
                            </Typography>
                            {activeOS === 'ios' || activeOS === 'android' ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Copy this WebDAV address to connect mobile apps, PDF readers, or document sync plugins (like Obsidian Sync).
                                </Typography>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Connect using WebDAV clients like Cyberduck, WinSCP, or your OS file manager.
                                </Typography>
                            )}
                            <CopyRow caption="Provide username and local sync password inside app configuration" label="WebDAV URL" value={strings.webdav} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="webdav" />
                        </Box>

                        <Divider />

                        {/* Calendar / Contacts Section */}
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                                Calendar / Contacts
                            </Typography>
                            {activeOS === 'ios' && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Go to Settings → Calendar (or Contacts) → Accounts → Add Account → Other. Choose Add CalDAV/CardDAV Account, select "Manual", and enter the sync URLs.
                                </Typography>
                            )}
                            {activeOS === 'android' && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Install <strong>DAVx⁵</strong> from Google Play or F-Droid, log in using your sync credentials and one of the URLs.
                                </Typography>
                            )}
                            <Stack spacing={2}>
                                <CopyRow label="CalDAV URL" value={strings.caldav} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="caldav" />
                                <CopyRow label="CardDAV URL" value={strings.carddav} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="carddav" />
                            </Stack>
                        </Box>
                    </Stack>
                </Box>
            </Paper>

            <Alert severity="info" sx={{ border: '1px solid', borderColor: 'info.light' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Note on Sync URLs:</Typography>
                <Typography variant="body2">
                    In most modern calendar or contact apps (such as DAVx⁵ or iOS Native settings), you only need to enter <strong>one</strong> of the CalDAV or CardDAV URLs. The client will automatically detect your other resources (calendars, address books) published under your username.
                </Typography>
            </Alert>
        </Container>
    );
};

export default Files;
