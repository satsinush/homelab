#!/bin/bash

# --- Configuration ---
# The directory for your bind mounts.
BIND_MOUNT_DIR="volumes"

# The directory where backup archives will be placed.
BACKUP_ROOT_DIR="./backups"

# The simple names of your named volumes from docker-compose.yml.
NAMED_VOLUMES_TO_BACKUP=(
  "homelab-dashboard-api-data"
  "homelab-dashboard-word-games-data"
  "ollama-data"
  "pihole_data"
  "pihole_logs"
  "portainer-data"
  "unbound-redis-data"
  "vaultwarden-data"
  "ntfy_data"
  "authelia-data"
  "authelia-redis-data"
  "lldap-data"
)
# --- End Configuration ---


# Function to create a backup
backup_data() {
  echo "### Starting Homelab Backup ###"
  
  echo "--> Making sure the 'alpine' image is available..."
  docker pull alpine:latest
  
  PROJECT_NAME=$(docker compose config --format json | jq -r .name)
  echo "--> Detected project name: $PROJECT_NAME"

  TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
  BACKUP_DIR="$BACKUP_ROOT_DIR/homelab-backup-$TIMESTAMP"

  echo "--> Creating backup directory: $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"

  if [ -f ".env" ]; then
    echo "--> Backing up .env file..."
    cp ./.env "$BACKUP_DIR/.env"
  fi

  echo "--> Stopping Docker containers to ensure data consistency..."
  docker compose stop

  if [ -d "$BIND_MOUNT_DIR" ]; then
    echo "--> Backing up bind mount directory '$BIND_MOUNT_DIR'..."
    # CHANGED: Added -p and --numeric-owner to preserve permissions
    sudo tar -cpzf "$BACKUP_DIR/bind_mounts.tar.gz" --numeric-owner -C "$(pwd)" "$BIND_MOUNT_DIR"
  fi

  echo "--> Backing up named volumes..."
  for volume in "${NAMED_VOLUMES_TO_BACKUP[@]}"; do
    FULL_VOLUME_NAME="${PROJECT_NAME}_${volume}"
    if docker volume inspect "$FULL_VOLUME_NAME" &>/dev/null; then
      echo "    - Backing up volume: $FULL_VOLUME_NAME"
      docker run --rm \
        -v "${FULL_VOLUME_NAME}:/volume-data:ro" \
        -v "${PWD}/${BACKUP_DIR}:/backup" \
        alpine \
        tar -cpzf "/backup/${volume}.tar.gz" --numeric-owner -C /volume-data .
    else
      echo "    - WARNING: Named volume '$FULL_VOLUME_NAME' not found. Skipping."
    fi
  done

  echo "--> Restarting Docker containers..."
  docker compose start

  echo "✅ Backup complete!"
  echo "Your backup is saved in the directory: $BACKUP_DIR"
}

# Function to restore from a backup
restore_data() {
  BACKUP_DIR="$1"

  echo "--> Making sure the 'alpine' image is available..."
  docker pull alpine:latest
  
  PROJECT_NAME=$(docker compose config --format json | jq -r .name)
  echo "--> Detected project name: $PROJECT_NAME"

  if [ -z "$BACKUP_DIR" ]; then
    echo "ERROR: You must specify the path to the backup directory to restore."
    usage; exit 1;
  fi
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: Backup directory not found at '$BACKUP_DIR'"; exit 1;
  fi

  echo "### Starting Homelab Restore ###"
  echo "This will stop services and overwrite data with the contents of '$BACKUP_DIR'."
  
  read -p "⚠️ Are you absolutely sure you want to proceed? [y/N] " response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled by user."; exit 0;
  fi

  echo "--> Stopping and removing old containers..."
  docker compose down

  echo "--> Preparing stack and creating empty volumes..."
  # CHANGED: Using up --no-start for a cleaner restore prep
  docker compose up -d --no-start

  if [ -f "$BACKUP_DIR/.env" ]; then
    echo "--> Restoring .env file..."
    cp "$BACKUP_DIR/.env" ./.env
  fi

  if [ -f "$BACKUP_DIR/bind_mounts.tar.gz" ]; then
    echo "--> Restoring bind mount directory '$BIND_MOUNT_DIR'..."
    sudo rm -rf "$BIND_MOUNT_DIR"
    # CHANGED: Added -p and --numeric-owner to restore permissions
    sudo tar -xpzf "$BACKUP_DIR/bind_mounts.tar.gz" --numeric-owner -C "$(pwd)"
  fi
  
  echo "--> Restoring named volumes..."
  for volume in "${NAMED_VOLUMES_TO_BACKUP[@]}"; do
    FULL_VOLUME_NAME="${PROJECT_NAME}_${volume}"
    if [ -f "$BACKUP_DIR/${volume}.tar.gz" ]; then
      echo "    - Restoring volume: $FULL_VOLUME_NAME"
      docker run --rm \
        -v "${FULL_VOLUME_NAME}:/volume-data" \
        -v "${PWD}/${BACKUP_DIR}:/backup" \
        alpine \
        sh -c "rm -rf /volume-data/* /volume-data/..?* /volume-data/.[!.]* && tar -xpzf /backup/${volume}.tar.gz --numeric-owner -C /volume-data"
    else
      echo "    - NOTE: Backup for named volume '$volume' not found in directory. Skipping."
    fi
  done

  echo "--> Starting all services..."
  docker compose up -d --build --force-recreate

  echo "✅ Restore complete!"
}

# Function to display usage instructions
usage() {
  echo "Usage: $0 {backup|restore <path_to_backup_directory>}"
}

# Main script logic
case "$1" in
  backup) backup_data ;;
  restore) restore_data "$2" ;;
  *) usage; exit 1 ;;
esac