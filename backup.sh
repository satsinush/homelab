#!/bin/bash

# --- Configuration ---
# The directory for your bind mounts.
BIND_MOUNT_DIR="volumes"

# The directory where backup archives will be placed.
BACKUP_ROOT_DIR="./backups"

# The simple names of your named volumes from docker-compose.yml.
NAMED_VOLUMES_TO_BACKUP=(
  "dashboard_api_data"
  "dashboard_word_games_data"
  "ollama_data"
  "pihole_data"
  "pihole_logs"
  "portainer_data"
  "unbound_redis_data"
  "vaultwarden_data"
  "ntfy_data"
  "authelia_data"
  "authelia_redis_data"
  "lldap_data"
)

# --- For Automatic Backups ---
# How many automated backups to keep.
AUTO_BACKUPS_TO_KEEP=7
# --- End Configuration ---


# Function to create a backup
backup_data() {
  AUTO_MODE=$1 # The first argument is the auto mode flag (true/false)

  echo "### Starting Homelab Backup ###"
  
  if [ "$AUTO_MODE" = true ]; then
    echo "--> Running in automatic mode."
  fi

  echo "--> Making sure the 'alpine' image is available..."
  docker pull alpine:latest
  
  PROJECT_NAME=$(docker compose config --format json | jq -r .name)
  echo "--> Detected project name: $PROJECT_NAME"

  TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
  
  # Determine the backup directory based on auto mode
  if [ "$AUTO_MODE" = true ]; then
    BACKUP_SUBDIR="$BACKUP_ROOT_DIR/auto"
  else
    BACKUP_SUBDIR="$BACKUP_ROOT_DIR"
  fi
  
  BACKUP_DIR="$BACKUP_SUBDIR/homelab-backup-$TIMESTAMP"
  
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
    sudo tar -cpzf "$BACKUP_DIR/bind_mounts.tar.gz" --numeric-owner -C "$(pwd)" "$BIND_MOUNT_DIR"
  fi

  echo "--> Backing up named volumes..."
  for volume in "${NAMED_VOLUMES_TO_BACKUP[@]}"; do
    FULL_VOLUME_NAME="${PROJECT_NAME}_${volume}"
    if docker volume inspect "$FULL_VOLUME_NAME" &>/dev/null; then
      echo "      - Backing up volume: $FULL_VOLUME_NAME"
      docker run --rm \
        -v "${FULL_VOLUME_NAME}:/volume-data:ro" \
        -v "${PWD}/${BACKUP_DIR}:/backup" \
        alpine \
        tar -cpzf "/backup/${volume}.tar.gz" --numeric-owner -C /volume-data .
    else
      echo "      - WARNING: Named volume '$FULL_VOLUME_NAME' not found. Skipping."
    fi
  done

  echo "--> Restarting Docker containers..."
  docker compose start

  echo "--> Compressing backup into a single archive..."
  FINAL_ARCHIVE_PATH="${BACKUP_DIR}.tar.gz"
  tar -czf "$FINAL_ARCHIVE_PATH" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
  
  echo "--> Cleaning up temporary backup directory..."
  rm -rf "$BACKUP_DIR"

  # If in auto mode, clean up old backups
  if [ "$AUTO_MODE" = true ]; then
    echo "--> Cleaning up old automatic backups (keeping last $AUTO_BACKUPS_TO_KEEP)..."
    # List files by modification time, skip the newest N, and delete the rest
    ls -1t "$BACKUP_SUBDIR"/*.tar.gz | tail -n "+$((AUTO_BACKUPS_TO_KEEP + 1))" | xargs -r rm
  fi

  echo "✅ Backup complete!"
  echo "Your backup is saved as: $FINAL_ARCHIVE_PATH"
}

# Function to restore from a backup (now handles the single archive)
restore_data() {
  BACKUP_ARCHIVE="$1"
  
  if [ -z "$BACKUP_ARCHIVE" ]; then
    echo "ERROR: You must specify the path to the backup archive to restore."
    usage; exit 1;
  fi
  if [ ! -f "$BACKUP_ARCHIVE" ]; then
    echo "ERROR: Backup archive not found at '$BACKUP_ARCHIVE'"; exit 1;
  fi

  # Create a temporary directory for extraction
  RESTORE_DIR=$(mktemp -d)
  echo "--> Extracting backup archive to temporary directory..."
  tar -xzf "$BACKUP_ARCHIVE" -C "$RESTORE_DIR"
  # The actual backup files are inside a subdirectory, find it
  BACKUP_DIR=$(find "$RESTORE_DIR" -mindepth 1 -maxdepth 1 -type d)

  echo "--> Making sure the 'alpine' image is available..."
  docker pull alpine:latest
  
  PROJECT_NAME=$(docker compose config --format json | jq -r .name)
  echo "--> Detected project name: $PROJECT_NAME"

  echo "### Starting Homelab Restore ###"
  echo "This will stop services and overwrite data with the contents of '$BACKUP_ARCHIVE'."
  
  read -p "⚠️ Are you absolutely sure you want to proceed? [y/N] " response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled by user."; rm -rf "$RESTORE_DIR"; exit 0;
  fi

  echo "--> Stopping and removing old containers..."
  docker compose down

  echo "--> Preparing stack and creating empty volumes..."
  docker compose up -d --no-start

  if [ -f "$BACKUP_DIR/.env" ]; then
    echo "--> Restoring .env file..."
    cp "$BACKUP_DIR/.env" ./.env
  fi

  if [ -f "$BACKUP_DIR/bind_mounts.tar.gz" ]; then
    echo "--> Restoring bind mount directory '$BIND_MOUNT_DIR'..."
    sudo rm -rf "$BIND_MOUNT_DIR"
    sudo tar -xpzf "$BACKUP_DIR/bind_mounts.tar.gz" --numeric-owner -C "$(pwd)"
  fi
  
  echo "--> Restoring named volumes..."
  for volume in "${NAMED_VOLUMES_TO_BACKUP[@]}"; do
    FULL_VOLUME_NAME="${PROJECT_NAME}_${volume}"
    if [ -f "$BACKUP_DIR/${volume}.tar.gz" ]; then
      echo "      - Restoring volume: $FULL_VOLUME_NAME"
      docker run --rm \
        -v "${FULL_VOLUME_NAME}:/volume-data" \
        -v "${BACKUP_DIR}:/backup" \
        alpine \
        sh -c "rm -rf /volume-data/* /volume-data/..?* /volume-data/.[!.]* && tar -xpzf /backup/${volume}.tar.gz --numeric-owner -C /volume-data"
    else
      echo "      - NOTE: Backup for named volume '$volume' not found in directory. Skipping."
    fi
  done
  
  # Clean up temporary extraction directory
  rm -rf "$RESTORE_DIR"

  echo "--> Starting all services..."
  docker compose up -d --build --force-recreate

  echo "✅ Restore complete!"
}

# Function to display usage instructions
usage() {
  echo "Usage: $0 backup [--auto]"
  echo "       $0 restore <path_to_backup_archive.tar.gz>"
}

# --- Main script logic ---
# Check for --auto flag anywhere in the arguments
AUTO_FLAG=false
for arg in "$@"; do
  if [ "$arg" == "--auto" ]; then
    AUTO_FLAG=true
    break
  fi
done

# Execute based on the first argument
case "$1" in
  backup)
    backup_data $AUTO_FLAG
    ;;
  restore)
    # Ensure a path is provided for restore
    if [ -z "$2" ]; then
      echo "ERROR: Restore command requires a path to a backup archive."
      usage
      exit 1
    fi
    restore_data "$2"
    ;;
  *)
    usage
    exit 1
    ;;
esac