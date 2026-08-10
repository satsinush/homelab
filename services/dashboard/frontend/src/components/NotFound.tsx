import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { 
    Home as HomeIcon, 
    SearchOff as SearchOffIcon
} from '@mui/icons-material';
import { useConfig } from '../contexts/useConfig';

const NotFound = () => {
    const navigate = useNavigate();
    const { config } = useConfig();
    const dashboardHost = config.hostnames.dashboard;
    const onWrongHost = Boolean(dashboardHost && window.location.hostname !== dashboardHost);

    const goHome = () => {
        if (onWrongHost && dashboardHost) {
            window.location.href = `https://${dashboardHost}/`;
            return;
        }
        navigate('/');
    };

    return (
        <Container maxWidth="md" sx={{ mt: 8, mb: 4 }}>
            <Paper elevation={3} sx={{ p: 6, textAlign: 'center', borderRadius: 4, bgcolor: 'background.paper' }}>
                <Box sx={{ mb: 4 }}>
                    <SearchOffIcon sx={{ fontSize: 100, color: 'primary.main', opacity: 0.8 }} />
                </Box>
                
                <Typography variant="h1" component="div" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 2 }}>
                    404
                </Typography>
                
                <Typography variant="h4" gutterBottom sx={{ color: 'text.secondary', mb: 3 }}>
                    Oops! Page Not Found
                </Typography>
                
                <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, maxWidth: '500px', mx: 'auto' }}>
                    {onWrongHost
                        ? 'This hostname is not configured.'
                        : "The page you are looking for doesn't exist or has been moved."}
                </Typography>
                
                <Button 
                    variant="contained" 
                    size="large" 
                    startIcon={<HomeIcon />}
                    onClick={goHome}
                    sx={{ borderRadius: 2, px: 4, py: 1.5, textTransform: 'none', fontSize: '1.1rem' }}
                >
                    Back to Dashboard
                </Button>
            </Paper>
        </Container>
    );
};

export default NotFound;
