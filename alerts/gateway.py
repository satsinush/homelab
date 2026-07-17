import asyncio
import logging
import os
from aiosmtpd.controller import Controller
from email.parser import BytesParser
from email.policy import default

import aiohttp
import apprise
import yaml
from aiohttp import web

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("alerts")

CONFIG_PATH = "/config/urls.yaml"

# Gotify base URL for direct sends (Apprise's Gotify plugin cannot forward the
# `extras` object, so click URLs must bypass it and hit /message directly).
GOTIFY_URL = os.environ.get("GOTIFY_INTERNAL_URL", "http://gotify").rstrip("/")

# Must match tags in alerts/urls.yaml (and alerts/setup.py GOTIFY_APPS).
KNOWN_ALERT_TAGS = frozenset({"gatus", "dashboard", "vaultwarden", "dockhand", "general"})

# Per-tag default URL opened when a Gotify notification is tapped (Android).
# Overridable per request via a `click_url` field in the alert payload.
DEFAULT_CLICK_URLS = {
    "gatus": os.environ.get("GATUS_CLICK_URL", ""),
    "dashboard": os.environ.get("DASHBOARD_CLICK_URL", ""),
    "vaultwarden": os.environ.get("VAULTWARDEN_CLICK_URL", ""),
    "dockhand": os.environ.get("DOCKHAND_CLICK_URL", ""),
    "general": os.environ.get("GENERAL_CLICK_URL", ""),
}

def _alert_tag(service: str) -> str:
    tag = (service or "general").strip().lower()
    return tag if tag in KNOWN_ALERT_TAGS else "general"


def _gotify_tokens() -> dict:
    """Map alert tag → Gotify app token, parsed from the rendered Apprise config.

    setup.py writes urls.yaml with real (substituted) tokens, so each entry
    looks like `gotify://gotify/<token>: [{tag: <tag>}]`.
    """
    tokens: dict[str, str] = {}
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        for entry in cfg.get("urls", []) or []:
            if not isinstance(entry, dict):
                continue
            for url, attrs in entry.items():
                if not isinstance(url, str) or not url.startswith("gotify"):
                    continue
                token = url.rstrip("/").split("/")[-1]
                for attr in attrs or []:
                    if isinstance(attr, dict) and attr.get("tag"):
                        tokens[str(attr["tag"])] = token
    except Exception as e:  # noqa: BLE001 - config is best-effort
        logger.warning(f"Could not parse Gotify tokens from {CONFIG_PATH}: {e}")

    return tokens


def _resolve_click_url(tag: str, data: dict) -> str:
    explicit = data.get("click_url") or data.get("clickUrl") or data.get("url")
    if explicit:
        return str(explicit)
    return DEFAULT_CLICK_URLS.get(tag) or ""


async def _send_gotify_direct(
    tag: str,
    title: str,
    message: str,
    priority: int | None,
    click_url: str,
) -> bool:
    """POST directly to Gotify with a click.url extra. Returns False to fall back."""
    token = _gotify_tokens().get(tag)
    if not token:
        return False

    payload: dict = {"title": title, "message": message}
    if priority is not None:
        payload["priority"] = priority
    if click_url:
        payload["extras"] = {"client::notification": {"click": {"url": click_url}}}

    url = f"{GOTIFY_URL}/message?token={token}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, json=payload, timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status < 400:
                    return True
                body = await resp.text()
                logger.warning(f"Gotify direct send failed (HTTP {resp.status}): {body}")
    except Exception as e:  # noqa: BLE001 - fall back to Apprise on any error
        logger.warning(f"Gotify direct send error: {e}")
    return False


def _apprise_notify(tag: str, title: str, message: str) -> bool:
    apobj = apprise.Apprise()
    try:
        config = apprise.AppriseConfig()
        config.add(CONFIG_PATH)
        apobj.add(config)
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to load Apprise config: {e}")
        return False
    return bool(apobj.notify(body=message, title=title, tag=tag))


async def _deliver(
    tag: str,
    title: str,
    message: str,
    priority: int | None = None,
    click_url: str = "",
) -> bool:
    """Send with a Gotify click URL when available, else via Apprise."""
    if click_url and await _send_gotify_direct(tag, title, message, priority, click_url):
        logger.info(f"Delivered via Gotify direct (tag={tag}, click_url set)")
        return True
    if click_url:
        logger.info("Direct Gotify send unavailable; falling back to Apprise")
    return _apprise_notify(tag, title, message)


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


class AlertsSMTPHandler:
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

        click_url = _resolve_click_url(tag, {})
        success = await _deliver(tag, title, full_body, click_url=click_url)
        logger.info(f"SMTP notification status: {success}")
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

    priority = data.get("priority")
    try:
        priority = int(priority) if priority is not None else None
    except (TypeError, ValueError):
        priority = None

    click_url = _resolve_click_url(tag, data)
    success = await _deliver(tag, title, message, priority, click_url)
    logger.info(f"Notification status: {success}")

    if success:
        return web.Response(text="OK")
    return web.Response(text="Notification completed", status=200)


async def alive_handler(request):
    return web.Response(text="alive")


async def health_handler(request):
    return web.Response(text="OK")


async def main():
    handler = AlertsSMTPHandler()
    controller = Controller(handler, hostname="0.0.0.0", port=8025)
    controller.start()
    logger.info("SMTP alert gateway started on port 8025...")

    app = web.Application()
    # Register static paths before /{service} so they win the match.
    app.router.add_get("/alive", alive_handler)
    app.router.add_get("/health", health_handler)
    # Legacy /alerts/{service} alias; preferred is POST /gatus, /dashboard, …
    app.router.add_post("/alerts/{service}", handle_alert)
    app.router.add_post("/alerts", handle_alert)
    app.router.add_post("/{service}", handle_alert)
    app.router.add_post("/", handle_alert)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 80)
    await site.start()
    logger.info("HTTP alert gateway started on port 80...")

    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        pass
