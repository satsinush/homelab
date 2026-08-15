// Main entry point for Homelab API Server
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'fs';

// Import configuration and routes
import config from './config';
import userRoutes from './routes/userRoutes';
import deviceRoutes from './routes/deviceRoutes';
import systemRoutes from './routes/systemRoutes';
import chatRoutes from './routes/chatRoutes';
import wordGamesRoutes from './routes/wordGamesRoutes';
import { errorHandler, notFound } from './middleware/errorMiddleware';

// Import services for initialization
import User from './models/User';
import DeviceController from './controllers/deviceController';
import PackageUpdateChecker from './services/packageUpdateChecker';
import Database from './models/Database';
import { getErrorMessage } from './utils/errors';

import SQLiteStoreFactory from 'better-sqlite3-session-store';
const SQLiteStore = SQLiteStoreFactory(session);

// Initialize Express app
const app = express();

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Homelab Dashboard API',
            version: '1.0.0',
            description: 'Core API for the Homelab Dashboard',
        },
        servers: [
            {
                url: '',
                description: 'Relative API Base URL'
            }
        ]
    },
    apis: [
        path.join(__dirname, 'routes', '*.ts'),
        path.join(__dirname, 'server.ts')
    ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Trust proxy for accurate client IP detection (needed for rate limiting behind nginx)
app.set('trust proxy', 1);

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
        client: Database.getDatabase(),
        expired: {
            clear: true,
            intervalMs: 900000 // 15 minutes
        }
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: config.session
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public Configuration Endpoint
/**
 * @openapi
 * /api/config:
 *   get:
 *     summary: Retrieve public application configuration
 *     description: Returns public hostnames and authentication feature flags.
 *     responses:
 *       200:
 *         description: Success
 */
app.get('/api/config', (req: Request, res: Response) => {
    res.json({
        dashboardWebHostname: config.dashBoardWebHostname,
        piholeWebHostname: config.piholeWebHostname,
        dockhandWebHostname: config.dockhandWebHostname,
        vaultwardenWebHostname: config.vaultwardenWebHostname,
        gatusWebHostname: config.gatusWebHostname,
        gotifyWebHostname: config.gotifyWebHostname,
        authentikWebHostname: config.authentikWebHostname,
        davWebHostname: config.davWebHostname,
        calWebHostname: config.calWebHostname,
        immichWebHostname: config.immichWebHostname,
        mailWebHostname: config.mailWebHostname,
        clipcascadeWebHostname: config.clipcascadeWebHostname,
        homelabHostname: config.homelabHostname,
        disableLocalAuth: config.disableLocalAuth,
        ssoEnabled: config.ssoEnabled
    });
});

// Swagger Documentation Route
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api', deviceRoutes);
app.use('/api', systemRoutes);
app.use('/api', chatRoutes);
app.use('/api', wordGamesRoutes);

// Serve static React build for non-API routes, or proxy to Vite dev server in development.
// Resolve from cwd (/app/api) so this works under both tsx and compiled dist/.
const frontendDistPath = path.join(process.cwd(), '..', 'frontend', 'dist');

if (process.env.ENVIRONMENT === 'development') {
    const viteProxy = createProxyMiddleware({
        target: 'http://dashboard-dev:5173',
        changeOrigin: true,
        ws: true,
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        viteProxy(req, res, next);
    });
} else {
    app.use(express.static(frontendDistPath));
    app.get(/^(?!\/api).*/, (req: Request, res: Response) => {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const initializeServer = async () => {
    try {
        console.log('Initializing Homelab API Server...');
        
        // Initialize services
        const userModel = new User();
        const deviceController = new DeviceController();
        const packageUpdateChecker = new PackageUpdateChecker();
        
        // Bootstrap admin user if no users exist
        try {
            if (await userModel.isFirstUser()) {
                const bootstrapUsername = process.env.HOMELAB_USERNAME;
                let bootstrapPassword = process.env.HOMELAB_PASSWORD;
                
                // Try reading password from secrets if not in environment
                if (!bootstrapPassword && process.env.HOMELAB_PASSWORD_FILE) {
                    try {
                        const secretsPath = process.env.HOMELAB_PASSWORD_FILE;
                        if (fs.existsSync(secretsPath)) {
                            bootstrapPassword = fs.readFileSync(secretsPath, 'utf8').trim();
                        }
                    } catch (err: unknown) {
                        console.log(`Could not read password from file ${process.env.HOMELAB_PASSWORD_FILE}:`, getErrorMessage(err));
                    }
                }
                
                if (bootstrapUsername && bootstrapPassword) {
                    const bootstrapEmail = process.env.HOMELAB_EMAIL || `${bootstrapUsername}@${process.env.HOMELAB_HOSTNAME || 'homelab.home.arpa'}`;
                    console.log(`Bootstrapping admin user: ${bootstrapUsername} (${bootstrapEmail})`);
                    await userModel.createFirstUser(bootstrapUsername, bootstrapPassword, bootstrapEmail);
                } else {
                    console.log('Admin user bootstrap skipped: credentials not provided in env or secrets');
                }
            }
        } catch (bootstrapError) {
            console.error('Failed to bootstrap admin user:', bootstrapError);
        }
                
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
                await deviceController.runScan();
                const onlineCount = deviceController.getOnlineCount();
                console.log(`Initial scan completed: ${onlineCount} devices online`);
            } catch (error: unknown) {
                console.error('Initial scan failed:', getErrorMessage(error));
            }

            // Start package update checker
            try {
                packageUpdateChecker.start();
                console.log('Package update checker started (6h at :30 local, weekly reminders) ✓');
            } catch (error: unknown) {
                console.error('Failed to start package update checker:', getErrorMessage(error));
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
