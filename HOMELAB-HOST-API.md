# Homelab Host API Update

This update creates a new privileged container (`homelab-host-api`) to handle system commands that require host access, while keeping the main `homelab-api` container unprivileged.

## Architecture Changes

### Before
- Single `homelab-api` container running all operations including system commands

### After
- `homelab-api`: Main API container (unprivileged) for business logic, authentication, database operations, and word games
- `homelab-host-api`: Privileged container for system commands requiring host access

## New Components

### 1. homelab-host-api Container
- **Port**: 5001
- **Privileges**: `privileged: true` with host volume mounts
- **Capabilities**: `SYS_ADMIN`, `NET_ADMIN`, `SYS_PTRACE`
- **Purpose**: Execute system commands (`arp-scan`, `systemctl`, `pacman`, etc.)
- **Cross-Platform**: Supports Linux, Windows, macOS with fallback dummy data

### 2. HostApiService
- **Location**: `homelab-api/services/hostApiService.js`
- **Purpose**: HTTP client to communicate with homelab-host-api
- **Methods**: All system command operations

## Updated Controllers

### SystemController
- ✅ `getResourceUsage()` - Disk usage via host API
- ✅ `getTemperature()` - Temperature monitoring via host API  
- ✅ `getServices()` - Service status via host API
- ✅ `getInstalledPackages()` - Package management via host API
- ✅ `getAvailableUpdates()` - Package updates via host API
- ✅ `getPackageSyncTime()` - Package sync time via host API

### DeviceController
- ✅ `discoverNetworkInterfaces()` - Network interfaces via host API
- ✅ `scanAndUpdateDevices()` - Network scanning via host API

### WordGamesController
- ❌ **Unchanged** - Word games run directly in homelab-api container (no privileged access needed)

## Cross-Platform Support

The host API now supports multiple platforms:

### Linux (Primary)
- `arp-scan --localnet --numeric --quiet` for network scanning
- `ip a` for network interfaces
- `df /` for disk usage
- `vcgencmd measure_temp` for temperature
- `systemctl` for services
- `pacman` for package management

### Windows
- `arp -a` for network scanning
- `ipconfig /all` for network interfaces
- `wmic logicaldisk get size,freespace,caption` for disk usage
- Simulated temperature readings
- `sc query` for services
- `wmic product` for package management

### macOS
- `arp -a` for network scanning
- `ifconfig` for network interfaces
- `df /` for disk usage
- Simulated temperature readings
- `launchctl` for services
- `brew` for package management

### Fallback
- Provides dummy data when platform-specific commands aren't available

## Configuration

### docker-compose.yml
```yaml
homelab-host-api:
  privileged: true
  volumes:
    - /proc:/host/proc:ro
    - /sys:/host/sys:ro
    - /var/run:/var/run:ro
    - /etc:/host/etc:ro
  cap_add:
    - SYS_ADMIN
    - NET_ADMIN
    - SYS_PTRACE
```

### config/index.js
```javascript
hostApi: {
    url: `http://homelab-host-api:5001`
}
```

## Security Benefits

1. **Principle of Least Privilege**: Main API container runs without privileged access
2. **Attack Surface Reduction**: Only the host API container has elevated privileges
3. **Isolation**: System commands are isolated in a separate container
4. **Network Segmentation**: Internal communication between containers

## API Endpoints (homelab-host-api)

### System Commands
- `POST /system/exec` - Execute arbitrary system commands
- `GET /system/disk` - Get disk usage
- `GET /system/temperature` - Get temperature readings
- `GET /system/services` - List system services
- `POST /system/service/status` - Check service status

### Network Operations
- `POST /network/scan` - Perform network scan
- `GET /network/interfaces` - Get network interfaces

### Package Management
- `GET /packages/installed` - List installed packages
- `GET /packages/updates` - Check for updates
- `GET /packages/sync-time` - Get package sync time

### Health Check
- `GET /health` - Health status

## Usage

The changes are transparent to the frontend - all existing API endpoints continue to work exactly the same way. The main `homelab-api` now delegates system operations to `homelab-host-api` internally.

## Deployment

1. Build and start the containers:
   ```bash
   docker-compose up --build
   ```

2. Verify both services are running:
   ```bash
   docker ps | grep homelab
   ```

3. Check logs if needed:
   ```bash
   docker-compose logs homelab-api
   docker-compose logs homelab-host-api
   ```

## Error Handling

The system gracefully handles host API failures:
- Network timeouts return appropriate error responses
- Service unavailability is logged and handled
- Fallback values are provided where possible
