FROM python:3.11-alpine
RUN pip install --no-cache-dir apprise aiosmtpd
COPY smtp_gateway.py /app/smtp_gateway.py
WORKDIR /app
CMD ["python", "smtp_gateway.py"]
