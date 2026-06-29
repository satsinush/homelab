FROM python:3.11-alpine
RUN pip install --no-cache-dir apprise aiosmtpd aiohttp
COPY apprise_webhook.py /app/apprise_webhook.py
WORKDIR /app
CMD ["python", "apprise_webhook.py"]
