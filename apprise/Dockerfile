FROM python:3.11-alpine
RUN pip install --no-cache-dir apprise aiosmtpd aiohttp
WORKDIR /app
CMD ["python", "apprise_gateway.py"]
