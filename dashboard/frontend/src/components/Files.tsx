// src/components/Files.tsx
import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Container,
    Tabs,
    Tab,
    Button,
    Stack,
    Divider,
    Paper
} from '@mui/material';
import {
    FolderCopy as FilesIcon,
    ContentCopy as CopyIcon,
    Check as CheckIcon,
    LaptopWindows as WindowsIcon,
    Apple as MacIcon,
    Terminal as LinuxIcon,
    PhoneIphone as IosIcon,
    Android as AndroidIcon
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

    const smbPrivateWin = `\\\\${homelabHost}\\${username}`;
    const smbSharedWin = `\\\\${homelabHost}\\shared`;
    const smbPrivateMac = `smb://${homelabHost}/${username}`;
    const smbSharedMac = `smb://${homelabHost}/shared`;
    const webdavUrl = `https://${davHost}/files/`;

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
            <PageHeader title="File Services" icon={<FilesIcon />} />

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Access and sync your private files and shared network storage. You can mount folders directly to your desktop or connect using WebDAV on mobile devices.
            </Typography>

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
                    {/* WINDOWS */}
                    {tabVal === 0 && (
                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Samba (SMB) Network Drives</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Map these paths in File Explorer (This PC → Map network drive) to mount folders directly.
                                </Typography>
                                <Stack spacing={2}>
                                    <CopyRow caption="Private storage (maps directly to your /personal folder)" label="Private Folder" value={smbPrivateWin} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_p_win" />
                                    <CopyRow caption="Shared public storage (maps to /shared folder)" label="Shared Folder" value={smbSharedWin} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_s_win" />
                                </Stack>
                            </Box>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>WebDAV Connection</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Connect using an app like Cyberduck, WinSCP or map it as a network location.
                                </Typography>
                                <CopyRow caption="Enter your local sync credentials when prompted" label="WebDAV Server URL" value={webdavUrl} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="dav_win" />
                            </Box>
                        </Stack>
                    )}

                    {/* MAC */}
                    {tabVal === 1 && (
                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Samba (SMB) Shares</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    In Finder, press <strong>Cmd + K</strong> (or click Go → Connect to Server) and enter these server paths.
                                </Typography>
                                <Stack spacing={2}>
                                    <CopyRow caption="Private storage (maps directly to your /personal folder)" label="Private Folder Server" value={smbPrivateMac} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_p_mac" />
                                    <CopyRow caption="Shared public storage (maps to /shared folder)" label="Shared Folder Server" value={smbSharedMac} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_s_mac" />
                                </Stack>
                            </Box>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>WebDAV Mounting</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Connect in Finder (Cmd + K) using the WebDAV secure protocol.
                                </Typography>
                                <CopyRow caption="Enter your local sync username and password when connecting" label="WebDAV Mount URL" value={webdavUrl} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="dav_mac" />
                            </Box>
                        </Stack>
                    )}

                    {/* LINUX */}
                    {tabVal === 2 && (
                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Mounting via SMB (Samba)</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Use your file manager (e.g. Nautilus, Dolphin) Connect to Server tool with these addresses.
                                </Typography>
                                <Stack spacing={2}>
                                    <CopyRow label="Private Folder Link" value={smbPrivateMac} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_p_lin" />
                                    <CopyRow label="Shared Folder Link" value={smbSharedMac} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_s_lin" />
                                </Stack>
                            </Box>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Mounting via WebDAV</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Map WebDAV in your Linux environment. You can use standard URLs inside file managers:
                                </Typography>
                                <CopyRow caption="Change protocol scheme to davs:// inside Nautilus/Dolphin if needed" label="WebDAV URL" value={webdavUrl} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="dav_lin" />
                            </Box>
                        </Stack>
                    )}

                    {/* IOS */}
                    {tabVal === 3 && (
                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Apple Files App (SMB)</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    1. Open the <strong>Files</strong> app.<br />
                                    2. Tap the three dots (top right) and select <strong>Connect to Server</strong>.<br />
                                    3. Enter either the Private or Shared server address below, select "Registered User", and enter your local sync password.
                                </Typography>
                                <Stack spacing={2}>
                                    <CopyRow label="Private Folder SMB Path" value={smbPrivateMac} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_p_ios" />
                                    <CopyRow label="Shared Folder SMB Path" value={smbSharedMac} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_s_ios" />
                                </Stack>
                            </Box>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Obsidian Sync &amp; Mobile WebDAV Clients</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Copy this WebDAV address to connect mobile apps, PDF readers, or document sync plugins.
                                </Typography>
                                <CopyRow caption="Provide username and local sync password inside app configuration" label="WebDAV URL" value={webdavUrl} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="dav_ios" />
                            </Box>
                        </Stack>
                    )}

                    {/* ANDROID */}
                    {tabVal === 4 && (
                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Material Files Explorer (WebDAV &amp; SMB)</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    1. Open <strong>Material Files</strong>.<br />
                                    2. Tap the side menu and click <strong>Add connection</strong>.<br />
                                    3. Choose <strong>WebDAV</strong> (recommended for mobile) or **SMB** and enter the credentials below.
                                </Typography>
                                <Stack spacing={2}>
                                    <CopyRow caption="Obsidian sync and mobile explorer target URL" label="WebDAV Connection URL" value={webdavUrl} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="dav_and" />
                                    <CopyRow caption="Local file sharing server path" label="Samba Private Path" value={smbPrivateMac} onCopy={handleCopy} copyFeedback={copyFeedback} feedbackId="smb_p_and" />
                                </Stack>
                            </Box>
                        </Stack>
                    )}
                </Box>
            </Paper>
        </Container>
    );
};

export default Files;
