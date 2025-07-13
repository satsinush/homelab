# Homelab Management System

A full-stack web application for managing and monitoring homelab infrastructure. Built with React.js frontend and Node.js/Express backend, featuring device management, system monitoring, and package management.

## Features

### System Monitoring
- Real-time system metrics (CPU, memory, disk, network)
- System information and health monitoring
- Performance tracking and alerts

### Device Management
- Wake-on-LAN support for remote device control
- Network discovery and device registry
- Connection monitoring and status tracking

### Package Management
- System package control and updates
- Dependency tracking and version management

### Security & User Management
- JWT authentication with Argon2 password hashing
- Session management and user profiles
- Rate limiting and input validation

### Configuration
- System settings and theme support (light/dark)
- Real-time notifications
- Responsive mobile-friendly interface

## Architecture

- **Backend**: Node.js + Express + SQLite
- **Frontend**: React 19 + Vite + Material-UI
- **Deployment**: Development on PC, deployed to Raspberry Pi

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm package manager

### Local Development

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/satsinush/homelab.git
   cd homelab
   
   # Install API dependencies
   cd homelab-api
   npm install
   
   # Install Dashboard dependencies
   cd ../homelab-dashboard
   npm install
   ```

2. **Start development servers**
   ```bash
   # Start Frontend (in homelab-dashboard directory)
   npm run dev  # Available at http://localhost:5173
   ```

   **Note**: Since the API monitors system resources and controls devices on the Raspberry Pi, it's recommended to deploy the backend to the Pi for testing rather than running it locally:
   ```bash
   # Deploy API to Pi for development testing
   deploy.bat --api
   ```

### VS Code Tasks
Use the built-in VS Code tasks for development:
- **Start Dev Server**: Launches frontend development server
- **Deploy Frontend**: Builds and deploys frontend to Pi
- **Deploy API**: Deploys backend to Pi
- **Deploy All**: Deploys both frontend and backend

Access via Command Palette (`Ctrl+Shift+P`) → "Tasks: Run Task"

## Deployment to Raspberry Pi

The project is designed for development on PC with deployment to a Raspberry Pi. The deployment script handles building, uploading, and starting services.

### Deployment Script Usage

```bash
# Deploy everything (default)
deploy.bat

# Deploy specific components
deploy.bat --frontend
deploy.bat --api
deploy.bat --all

# Specify custom target
deploy.bat --user pi --ip 192.168.1.100 --port 22
deploy.bat --all --user myuser --ip homelab.local
```

### Default Configuration
- **User**: `aneedham`
- **IP**: `10.10.10.10`
- **Port**: `2222`

### Raspberry Pi Setup Requirements

#### Frontend Setup
The frontend is served by nginx:
```bash
# On Raspberry Pi
sudo mkdir -p /srv/www/homelab-dashboard
sudo chown [user]:[user] /srv/www/homelab-dashboard
```

Configure nginx to serve from `/srv/www/homelab-dashboard/dist/`

#### Backend Setup
The API runs as a systemd service:
```bash
# On Raspberry Pi
mkdir -p /home/[user]/homelab-api

# Create systemd service file
sudo nano /etc/systemd/system/homelab-api.service
```

Example service file:
```ini
[Unit]
Description=Homelab API Server
After=network.target

[Service]
Type=simple
User=[user]
WorkingDirectory=/home/[user]/homelab-api
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable homelab-api.service
sudo systemctl start homelab-api.service
```

### Environment Configuration

Create `.env` file in the homelab-api directory on the Raspberry Pi:
```env
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret
SESSION_SECRET=your-secure-session-secret
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info

### System Monitoring
- `GET /api/health` - Health check
- `GET /api/system/info` - System information
- `GET /api/system/stats` - System statistics

### Device Management
- `GET /api/devices` - List devices
- `POST /api/devices` - Add device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Remove device
- `POST /api/devices/:id/wake` - Wake device (WoL)
- `GET /api/devices/scan` - Network scan

## Troubleshooting

### Common Deployment Issues
1. **SSH Connection**: Verify SSH key setup and network connectivity
2. **Port Conflicts**: Check that ports 5000 (API) and 80/443 (nginx) are available
3. **Permissions**: Ensure proper file permissions on Raspberry Pi
4. **Service Status**: Check systemd service logs with `journalctl -u homelab-api.service`

### Development Issues
1. **CORS Errors**: Verify API URL configuration in frontend
2. **Build Failures**: Check Node.js version compatibility
3. **Database Issues**: Ensure SQLite database path and permissions
