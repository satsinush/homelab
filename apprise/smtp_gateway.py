import os
import asyncio
import logging
from aiosmtpd.controller import Controller
from email.parser import BytesParser
from email.policy import default
import apprise

# Setup logging to stdout
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("smtp_gateway")

HOMELAB_HOSTNAME = os.environ.get("HOMELAB_HOSTNAME")

class MatrixSMTPHandler:
    async def handle_DATA(self, server, session, envelope):
        # Read the bot token dynamically from the secrets volume
        try:
            with open("/secrets/matrix_bot_token", "r") as f:
                bot_token = f.read().strip()
        except Exception as e:
            logger.error(f"Error reading bot token: {e}")
            return '451 Error reading bot token'

        rcpt_tos = envelope.rcpt_tos
        data = envelope.content

        # Parse email content
        message = BytesParser(policy=default).parsebytes(data)
        subject = message.get('subject', 'No Subject')
        body = message.get_body(preferencelist=('plain', 'html'))
        body_content = body.get_content() if body else str(message)

        # Route to each recipient
        for rcpt in rcpt_tos:
            if '@' in rcpt:
                username = rcpt.split('@')[0]
            else:
                username = rcpt
            
            # Skip system users or service names
            if username.lower() in ['vaultwarden', 'authentik', 'bot']:
                continue

            matrix_user = f"@{username}:matrix.{HOMELAB_HOSTNAME}"
            apprise_url = f"matrixs://{bot_token}@matrix.{HOMELAB_HOSTNAME}/{matrix_user}"

            logger.info(f"Routing SMTP message for recipient '{rcpt}' to Matrix user '{matrix_user}'")
            ap = apprise.Apprise()
            ap.add(apprise_url)
            success = ap.notify(body=body_content, title=subject)
            logger.info(f"Apprise notification status: {success}")

        return '250 OK'

if __name__ == '__main__':
    handler = MatrixSMTPHandler()
    controller = Controller(handler, hostname='0.0.0.0', port=8025)
    controller.start()
    logger.info("SMTP to Matrix Gateway started on port 8025...")
    
    loop = asyncio.get_event_loop()
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass
