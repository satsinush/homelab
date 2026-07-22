FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    gnupg2 \
    curl \
    ca-certificates \
    && curl -fsSL "https://keys.openpgp.org/vks/v1/by-fingerprint/74FFC6D72B925A34B5D356BDF8A27B36A6E2EAE9" | gpg --dearmor -o /etc/apt/trusted.gpg.d/sogo.gpg \
    && echo "deb http://packages.inverse.ca/SOGo/nightly/5/debian/ bookworm bookworm" > /etc/apt/sources.list.d/sogo.list \
    && apt-get update && apt-get install -y sogo \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

EXPOSE 20000

CMD ["sogod", "-WOWorkersCount", "3", "-WOPort", "0.0.0.0:20000", "-WOLogFile", "-", "-WONoKeepAlive", "NO"]
