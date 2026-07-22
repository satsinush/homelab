FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    gnupg2 \
    curl \
    ca-certificates \
    && curl -fsSL https://packages.inverse.ca/sogo/gpg/sogo.key | gpg --dearmor -o /etc/apt/trusted.gpg.d/sogo.gpg \
    && echo "deb https://packages.inverse.ca/sogo/nightly/5/debian/ bookworm bookworm" > /etc/apt/sources.list.d/sogo.list \
    && apt-get update && apt-get install -y sogo \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

EXPOSE 20000

CMD ["sogod", "-WOWorkersCount", "3", "-WOPort", "0.0.0.0:20000", "-WOLogFile", "-", "-WONoKeepAlive", "NO"]
