import os
import asyncio
import logging
from aiosmtpd.controller import Controller
from email.parser import BytesParser
from email.policy import default

import apprise
from aiohttp import web

# Setup logging to stdout
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("apprise_gateway")


class AppriseSMTPHandler:
    async def handle_DATA(self, server, session, envelope):
        # Parse email content
        message = BytesParser(policy=default).parsebytes(envelope.content)
        subject = message.get('subject', 'No Subject')
        body = message.get_body(preferencelist=('plain', 'html'))
        body_content = body.get_content() if body else str(message)

        # Format sender, recipient, and subject information
        sender = envelope.mail_from
        recipients = ", ".join(envelope.rcpt_tos)
        full_body = f"From: {sender}\nTo: {recipients}\nSubject: {subject}\n\n{body_content}"

        logger.info(f"Routing SMTP message from {sender} to {recipients}: {subject}")
        
        ap = apprise.Apprise()
        try:
            config = apprise.AppriseConfig()
            config.add('/config/apprise.yaml')
            ap.add(config)
        except Exception as e:
            logger.error(f"Failed to load config for SMTP: {e}")
            return '250 OK'

        success = ap.notify(body=full_body, title="Homelab Email Alert")
        logger.info(f"Apprise SMTP notification status: {success}")
        return '250 OK'


async def handle_alert(request):
    # 1. Parse payload
    data = {}
    body_text = ""
    try:
        if request.content_type == 'application/json':
            data = await request.json()
        else:
            data = await request.post()
            data = dict(data)
    except Exception as e:
        logger.warning(f"Could not parse payload: {e}")
        
    try:
        body_text = await request.text()
    except Exception as e:
        logger.warning(f"Could not read raw body text: {e}")

    # Determine service
    service = data.get('service') or request.query.get('service') or request.match_info.get('service') or 'general'
    logger.info(f"Received alert request for service: {service}")

    # 2. Extract message & title
    title = data.get('title') or data.get('subject') or f"Homelab {service.capitalize()} Alert"
    message = data.get('message') or data.get('msg') or data.get('text') or body_text or "No alert message details provided."

    logger.info(f"Routing HTTP alert for service '{service}'")

    ap = apprise.Apprise()
    try:
        config = apprise.AppriseConfig()
        config.add('/config/apprise.yaml')
        ap.add(config)
    except Exception as e:
        logger.error(f"Failed to load config for HTTP alert: {e}")
        return web.Response(text="Configuration error", status=500)

    success = ap.notify(body=message, title=title)
    logger.info(f"Apprise notification status: {success}")
    
    if success:
        return web.Response(text="OK")
    else:
        return web.Response(text="Notification completed", status=200)


async def alive_handler(request):
    return web.Response(text="alive")


async def health_handler(request):
    return web.Response(text="OK")


async def main():
    # Start SMTP controller
    handler = AppriseSMTPHandler()
    controller = Controller(handler, hostname='0.0.0.0', port=8025)
    controller.start()
    logger.info("SMTP to Apprise Gateway started on port 8025...")
    
    # Start web server
    app = web.Application()
    app.router.add_post('/alerts/{service}', handle_alert)
    app.router.add_post('/alerts', handle_alert)
    app.router.add_get('/alive', alive_handler)
    app.router.add_get('/health', health_handler)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8000)
    await site.start()
    logger.info("HTTP Alert Gateway started on port 8000...")
    
    # Run forever
    while True:
        await asyncio.sleep(3600)


if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        pass
