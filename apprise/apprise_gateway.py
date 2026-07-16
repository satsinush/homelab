import asyncio
import logging
from aiosmtpd.controller import Controller
from email.parser import BytesParser
from email.policy import default

import apprise
from aiohttp import web

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("apprise_gateway")

# Must match tags in apprise/apprise.yaml (and apprise/setup.py GOTIFY_APPS).
KNOWN_ALERT_TAGS = frozenset({"gatus", "dashboard", "vaultwarden", "dockhand", "general"})


def _alert_tag(service: str) -> str:
    tag = (service or "general").strip().lower()
    return tag if tag in KNOWN_ALERT_TAGS else "general"


def _decorate_gatus_title(title: str) -> str:
    """Prefix Gatus alert titles with a status emoji from TRIGGERED/RESOLVED."""
    lower = title.lower()
    if "triggered" in lower:
        prefix = "🔴 "
    elif "resolved" in lower:
        prefix = "🟢 "
    else:
        return title
    if title.startswith(prefix):
        return title
    return f"{prefix}{title}"


class AppriseSMTPHandler:
    async def handle_DATA(self, server, session, envelope):
        message = BytesParser(policy=default).parsebytes(envelope.content)
        subject = message.get("subject", "No Subject")
        body = message.get_body(preferencelist=("plain", "html"))
        body_content = body.get_content() if body else str(message)

        sender = envelope.mail_from or ""
        recipients = ", ".join(envelope.rcpt_tos)
        full_body = f"From: {sender}\nTo: {recipients}\nSubject: {subject}\n\n{body_content}"

        # Vaultwarden SMTP → vaultwarden app; everything else → general.
        tag = "vaultwarden" if "vaultwarden" in sender.lower() else "general"
        title = (
            "Vaultwarden Alert"
            if tag == "vaultwarden"
            else "Homelab Email Alert"
        )

        logger.info(
            f"Routing SMTP message from {sender} to {recipients}: {subject} (tag={tag})"
        )

        ap = apprise.Apprise()
        try:
            config = apprise.AppriseConfig()
            config.add("/config/apprise.yaml")
            ap.add(config)
        except Exception as e:
            logger.error(f"Failed to load config for SMTP: {e}")
            return "250 OK"

        success = ap.notify(body=full_body, title=title, tag=tag)
        logger.info(f"Apprise SMTP notification status: {success}")
        return "250 OK"


async def handle_alert(request):
    data = {}
    body_text = ""
    try:
        if request.content_type == "application/json":
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

    service = (
        data.get("service")
        or request.query.get("service")
        or request.match_info.get("service")
        or "general"
    )
    tag = _alert_tag(str(service))
    logger.info(f"Received alert request for service: {service} (tag={tag})")

    title = data.get("title") or data.get("subject") or f"Homelab {tag.capitalize()} Alert"
    if tag == "gatus":
        title = _decorate_gatus_title(str(title))
    message = (
        data.get("message")
        or data.get("msg")
        or data.get("text")
        or body_text
        or "No alert message details provided."
    )

    ap = apprise.Apprise()
    try:
        config = apprise.AppriseConfig()
        config.add("/config/apprise.yaml")
        ap.add(config)
    except Exception as e:
        logger.error(f"Failed to load config for HTTP alert: {e}")
        return web.Response(text="Configuration error", status=500)

    success = ap.notify(body=message, title=title, tag=tag)
    logger.info(f"Apprise notification status: {success}")

    if success:
        return web.Response(text="OK")
    return web.Response(text="Notification completed", status=200)


async def alive_handler(request):
    return web.Response(text="alive")


async def health_handler(request):
    return web.Response(text="OK")


async def main():
    handler = AppriseSMTPHandler()
    controller = Controller(handler, hostname="0.0.0.0", port=8025)
    controller.start()
    logger.info("SMTP to Apprise Gateway started on port 8025...")

    app = web.Application()
    app.router.add_post("/alerts/{service}", handle_alert)
    app.router.add_post("/alerts", handle_alert)
    app.router.add_get("/alive", alive_handler)
    app.router.add_get("/health", health_handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 80)
    await site.start()
    logger.info("HTTP Alert Gateway started on port 80...")

    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        pass
