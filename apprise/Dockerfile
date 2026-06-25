FROM python:3.11-alpine
RUN pip install --no-cache-dir apprise aiosmtpd aiohttp
COPY apprise_api.py /app/apprise_api.py
WORKDIR /app
CMD ["python", "apprise_api.py"]
