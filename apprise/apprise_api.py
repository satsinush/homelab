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
            if username.lower() in ['vaultwarden', 'authentik', 'bot', 'homelab']:
                continue

            # Build tag list for routing
            tags = ['email', username]
            if username.lower() == 'admin':
                tags.append('admin')
            else:
                tags.append('general')

            logger.info(f"Routing SMTP message for recipient '{rcpt}' with tags {tags}")
            
            ap = apprise.Apprise()
            try:
                config = apprise.AppriseConfig()
                config.add('/config/apprise.yaml')
                ap.add(config)
            except Exception as e:
                logger.error(f"Failed to load config for SMTP: {e}")
                continue

            success = ap.notify(body=body_content, title=subject, tag=tags)
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

    # Determine service (prioritize request body, then query params, then URL match path)
    service = data.get('service') or request.query.get('service') or request.match_info.get('service') or 'general'
    logger.info(f"Received alert request for service: {service}")

    # 2. Extract message & title
    title = data.get('title') or data.get('subject') or f"Homelab {service.capitalize()} Alert"
    message = data.get('message') or data.get('msg') or data.get('text') or body_text or "No alert message details provided."

    # Parse Uptime Kuma specific formats
    if 'heartbeat' in data and 'monitor' in data:
        monitor = data.get('monitor')
        if isinstance(monitor, dict):
            monitor_name = monitor.get('name', 'Unknown')
        else:
            monitor_name = 'Test / Unknown'
        msg = data.get('msg', '')
        title = f"Uptime Kuma: {monitor_name}"
        message = msg

    # Determine if alert is admin-only
    admin_only_val = data.get('admin_only') or request.query.get('admin_only')
    is_admin_only = False
    if admin_only_val is not None:
        if isinstance(admin_only_val, bool):
            is_admin_only = admin_only_val
        elif str(admin_only_val).lower() in ['true', '1', 'yes']:
            is_admin_only = True

    # 3. Determine tags
    tags = [service]
    if is_admin_only:
        tags.append('admin')
    else:
        tags.append('general')

    # Allow custom tag query overrides (e.g. ?tag=custom or ?tags=admin,custom)
    query_tags = request.query.get('tags') or request.query.get('tag')
    if query_tags:
        for t in query_tags.split(','):
            t_clean = t.strip()
            if t_clean:
                tags.append(t_clean)

    logger.info(f"Routing HTTP alert for service '{service}' with tags {tags}")

    ap = apprise.Apprise()
    try:
        config = apprise.AppriseConfig()
        config.add('/config/apprise.yaml')
        ap.add(config)
    except Exception as e:
        logger.error(f"Failed to load config for HTTP alert: {e}")
        return web.Response(text="Configuration error", status=500)

    # Note: tag=tags uses "OR" matching by default in Apprise.
    # It will notify any URL that matches any of the tags in the list.
    success = ap.notify(body=message, title=title, tag=tags)
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
