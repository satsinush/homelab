// Main entry point for Homelab API Server
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

// Import configuration and routes
const config = require('./config');
const userRoutes = require('./routes/userRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const systemRoutes = require('./routes/systemRoutes');
const chatRoutes = require('./routes/chatRoutes');
const wordGamesRoutes = require('./routes/wordGamesRoutes');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Import services for initialization
const User = require('./models/User');
const DeviceController = require('./controllers/deviceController');
const PackageUpdateChecker = require('./services/packageUpdateChecker');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Initialize Express app
const app = express();

// Trust proxy for accurate client IP detection (needed for rate limiting behind nginx)
// Only trust the first proxy (nginx) rather than all proxies for security
app.set('trust proxy', 1);

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

// CORS configuration
app.use(cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Session configuration with SQLite store
app.use(session({
    store: new SQLiteStore({
        db: config.database.filename,
        dir: config.database.path,
        table: 'sessions',
        concurrentDB: true
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: config.session
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// ROUTES
// =============================================================================

// API Routes
app.use('/api/users', userRoutes);
app.use('/api', deviceRoutes);
app.use('/api', systemRoutes);
app.use('/api', chatRoutes);
app.use('/api', wordGamesRoutes);

// Serve static React build for non-API routes, or proxy to Vite dev server in development
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');

if (process.env.ENVIRONMENT === 'development') {
    // ✅ Create the proxy middleware ONCE and store it in a variable.
    const viteProxy = createProxyMiddleware({
        target: 'http://dashboard-dev:5173',
        changeOrigin: true,
        ws: true, // For Hot Module Replacement (HMR) WebSockets
    });

    // Use the middleware for all requests that don't go to the API.
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        // ...and REUSE the same instance here for every request.
        viteProxy(req, res, next);
    });
} else {
    // Your production code is perfectly fine!
    app.use(express.static(frontendDistPath));
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

const initializeServer = async () => {
    try {
        console.log('Initializing Homelab API Server...');
        
        // Initialize services
        const userModel = new User();
        const deviceController = new DeviceController();
        const packageUpdateChecker = new PackageUpdateChecker();
        
        // No default user creation - first login will create the initial user
                
        // Start server
        app.listen(config.port, async () => {
            console.log(`Homelab API Server running on http://0.0.0.0:${config.port}`);
            console.log(`Database path: ${path.join(config.database.path, config.database.filename)}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Authentication: Enabled (admin/password)`);
            console.log(`Security: Environment variables loaded ✓`);
            
            // Perform initial device scan
            console.log('Performing initial device scan...');
            try {
                const devices = await deviceController.scanAndUpdateDevices();
                const favoriteDevices = devices.filter(d => d.isFavorite);
                const onlineDevices = devices.filter(d => d.status === 'online');
                
                console.log(`Initial scan completed: ${devices.length} devices found (${favoriteDevices.length} favorites, ${onlineDevices.length} online)`);
                
                // Log configured favorite devices
                if (favoriteDevices.length > 0) {
                    console.log(`Favorite devices: ${favoriteDevices.map(d => d.name || d.mac).join(', ')}`);
                } else {
                    console.log('No favorite devices configured');
                }
            } catch (error) {
                console.error('Initial scan failed:', error.message);
            }

            // Start package update checker
            try {
                packageUpdateChecker.start();
                console.log('Package update checker started (hourly notifications) ✓');
            } catch (error) {
                console.error('Failed to start package update checker:', error.message);
            }
        });
        
        // Handle graceful shutdown
        const gracefulShutdown = () => {
            console.log('Shutting down gracefully...');
            packageUpdateChecker.stop();
            process.exit(0);
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Start the server
initializeServer();
