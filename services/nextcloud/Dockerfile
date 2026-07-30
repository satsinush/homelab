# smbclient is required for files_external SMB/CIFS (not in the stock image).
FROM nextcloud:stable

RUN apt-get update \
    && apt-get install -y --no-install-recommends smbclient \
    && rm -rf /var/lib/apt/lists/*
