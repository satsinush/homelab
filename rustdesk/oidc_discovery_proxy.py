#!/usr/bin/env python3
"""OIDC reverse proxy for rustdesk-console ↔ Authentik.

rustdesk-console uses reqwest+rustls with webpki-roots only, so it cannot
trust the homelab self-signed CA when calling Authentik over HTTPS.

It also validates ID token `iss` with jsonwebtoken after stripping a trailing
slash from the discovery issuer, while Authentik always emits `iss` *with* a
trailing slash — that mismatch yields OidcIdTokenInvalid.

This proxy:
  - Serves discovery with proxy HTTP issuer + token/jwks/userinfo
  - Keeps authorization_endpoint on public HTTPS for the browser
  - Forwards token/userinfo to Authentik with Host=proxy so Authentik's
    base issuer matches the configured rustdesk issuer
  - Re-signs id_tokens with a local RSA key after normalizing `iss`
    (strip trailing slash) and serves matching JWKS
  - Promotes rustdesk users to is_admin when Authentik roles/groups
    include rustdesk-admin / homelab-admins
"""

from __future__ import annotations

import base64
import json
import os
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from jwt import decode as jwt_decode
from jwt import encode as jwt_encode
from jwt.exceptions import PyJWTError
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

AUTHENTIK_INTERNAL = os.environ.get("AUTHENTIK_INTERNAL", "http://authentik-server:9000").rstrip("/")
AUTHENTIK_PUBLIC_HOST = os.environ.get("AUTHENTIK_PUBLIC_HOST", "authentik.homelab.home.arpa")
OIDC_APP_SLUG = os.environ.get("OIDC_APP_SLUG", "rustdesk")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "8080"))
PROXY_BASE = os.environ.get("PROXY_BASE", f"http://rustdesk-oidc-proxy:{LISTEN_PORT}").rstrip("/")
KEY_PATH = Path(os.environ.get("OIDC_PROXY_KEY_PATH", "/tmp/oidc_proxy_rsa.pem"))
RUSTDESK_DB = Path(os.environ.get("RUSTDESK_DB_PATH", "/data/rustdeskapi.db"))
ADMIN_ROLES = {
    r.strip()
    for r in os.environ.get("RUSTDESK_ADMIN_ROLES", "rustdesk-admin,homelab-admin").split(",")
    if r.strip()
}
ADMIN_GROUPS = {
    g.strip()
    for g in os.environ.get("RUSTDESK_ADMIN_GROUPS", "homelab-admins").split(",")
    if g.strip()
}

PUBLIC_HTTPS = f"https://{AUTHENTIK_PUBLIC_HOST}"
PROXY_HOST = urllib.parse.urlparse(PROXY_BASE).netloc or f"rustdesk-oidc-proxy:{LISTEN_PORT}"
# rustdesk-console strips trailing slash before jsonwebtoken issuer check
NORMALIZED_ISSUER = f"{PROXY_BASE}/application/o/{OIDC_APP_SLUG}"

FORWARD_PREFIXES = (
    "/application/o/token",
    "/application/o/userinfo",
    "/application/o/introspect",
    "/application/o/revoke",
)


def proxy_issuer_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "Host": PROXY_HOST,
        "X-Forwarded-Host": PROXY_HOST,
        "X-Forwarded-Proto": "http",
        "X-Forwarded-For": "127.0.0.1",
    }
    if extra:
        headers.update(extra)
    return headers


def b64url_uint(data: int) -> str:
    length = (data.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(data.to_bytes(length, "big")).rstrip(b"=").decode("ascii")


def load_or_create_key() -> rsa.RSAPrivateKey:
    if KEY_PATH.exists():
        return serialization.load_pem_private_key(KEY_PATH.read_bytes(), password=None)  # type: ignore[return-value]
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    KEY_PATH.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    return key


PRIVATE_KEY = load_or_create_key()
PUBLIC_KEY = PRIVATE_KEY.public_key()
KID = secrets.token_hex(16)
PUBLIC_NUMBERS = PUBLIC_KEY.public_numbers()
JWKS_BODY = json.dumps(
    {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": KID,
                "n": b64url_uint(PUBLIC_NUMBERS.n),
                "e": b64url_uint(PUBLIC_NUMBERS.e),
            }
        ]
    }
).encode("utf-8")


def fetch_discovery() -> dict:
    url = f"{AUTHENTIK_INTERNAL}/application/o/{OIDC_APP_SLUG}/.well-known/openid-configuration"
    req = urllib.request.Request(url, headers=proxy_issuer_headers({"Accept": "application/json"}))
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def rewrite_discovery(doc: dict) -> dict:
    # Keep trailing slash in discovery document (Authentik style); rustdesk strips
    # it before comparing to the ID token iss we normalize below.
    doc["issuer"] = f"{NORMALIZED_ISSUER}/"
    doc["authorization_endpoint"] = f"{PUBLIC_HTTPS}/application/o/authorize/"
    doc["token_endpoint"] = f"{PROXY_BASE}/application/o/token/"
    doc["userinfo_endpoint"] = f"{PROXY_BASE}/application/o/userinfo/"
    doc["jwks_uri"] = f"{PROXY_BASE}/application/o/{OIDC_APP_SLUG}/jwks/"
    if "introspection_endpoint" in doc:
        doc["introspection_endpoint"] = f"{PROXY_BASE}/application/o/introspect/"
    if "revocation_endpoint" in doc:
        doc["revocation_endpoint"] = f"{PROXY_BASE}/application/o/revoke/"
    if "end_session_endpoint" in doc:
        doc["end_session_endpoint"] = (
            f"{PUBLIC_HTTPS}/application/o/{OIDC_APP_SLUG}/end-session/"
        )
    return doc


def should_forward(path: str) -> bool:
    path = path.split("?", 1)[0].rstrip("/") or "/"
    for prefix in FORWARD_PREFIXES:
        if path == prefix or path.startswith(prefix + "/"):
            return True
    return False


def is_jwks(path: str) -> bool:
    base = path.split("?", 1)[0].rstrip("/")
    return base == f"/application/o/{OIDC_APP_SLUG}/jwks"


def _as_str_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if v is not None]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def claims_grant_admin(claims: dict) -> bool:
    roles = set(_as_str_list(claims.get("roles")))
    groups = set(_as_str_list(claims.get("groups")))
    return bool(roles & ADMIN_ROLES) or bool(groups & ADMIN_GROUPS)


def sync_rustdesk_admin(claims: dict, *, attempts: int = 6, delay_sec: float = 1.0) -> None:
    """Map Authentik rustdesk-admin / homelab-admins onto rustdesk users.is_admin.

    rustdesk-console always creates OAuth users as non-admin; sync after login.
    Retries briefly so the first SSO login (create-then-promote) still works.
    """
    if not claims_grant_admin(claims):
        return
    username = str(claims.get("preferred_username") or "").strip().lower()
    email = str(claims.get("email") or "").strip().lower()
    if not username and not email:
        return
    if not RUSTDESK_DB.exists():
        print(f"oidc-proxy: admin sync skipped; db missing at {RUSTDESK_DB}", flush=True)
        return

    def _run() -> None:
        for _attempt in range(1, attempts + 1):
            try:
                conn = sqlite3.connect(str(RUSTDESK_DB), timeout=5)
                try:
                    cur = conn.cursor()
                    if username and email:
                        cur.execute(
                            "UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP "
                            "WHERE lower(username) = ? OR lower(email) = ?",
                            (username, email),
                        )
                    elif username:
                        cur.execute(
                            "UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP "
                            "WHERE lower(username) = ?",
                            (username,),
                        )
                    else:
                        cur.execute(
                            "UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP "
                            "WHERE lower(email) = ?",
                            (email,),
                        )
                    conn.commit()
                    if cur.rowcount > 0:
                        print(
                            f"oidc-proxy: promoted rustdesk admin "
                            f"username={username!r} email={email!r}",
                            flush=True,
                        )
                        return
                finally:
                    conn.close()
            except sqlite3.Error as e:
                print(f"oidc-proxy: admin sync error: {e}", flush=True)
            time.sleep(delay_sec)
        print(
            f"oidc-proxy: admin sync pending "
            f"(user not found yet) username={username!r} email={email!r}",
            flush=True,
        )

    threading.Thread(target=_run, name="rustdesk-admin-sync", daemon=True).start()


def normalize_id_token(resp_body: bytes) -> bytes:
    """Re-sign id_token with iss matching rustdesk's slash-stripped expectation."""
    try:
        payload = json.loads(resp_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return resp_body
    if not isinstance(payload, dict):
        return resp_body
    id_token = payload.get("id_token")
    if not isinstance(id_token, str) or id_token.count(".") < 2:
        return resp_body

    try:
        claims = jwt_decode(
            id_token,
            options={
                "verify_signature": False,
                "verify_aud": False,
                "verify_exp": False,
                "verify_iss": False,
            },
        )
    except PyJWTError as e:
        print(f"oidc-proxy: id_token decode failed: {e}", flush=True)
        return resp_body

    claims["iss"] = NORMALIZED_ISSUER
    # Drop Authentik-only headers; re-sign with our key/kid.
    new_token = jwt_encode(claims, PRIVATE_KEY, algorithm="RS256", headers={"kid": KID})
    if isinstance(new_token, bytes):
        new_token = new_token.decode("ascii")
    payload["id_token"] = new_token

    interesting = {
        "iss": claims.get("iss"),
        "aud": claims.get("aud"),
        "sub": claims.get("sub"),
        "nonce": claims.get("nonce"),
        "preferred_username": claims.get("preferred_username"),
        "email": claims.get("email"),
        "groups": claims.get("groups"),
        "roles": claims.get("roles"),
        "kid": KID,
        "rewritten_at": int(time.time()),
    }
    print(f"oidc-proxy: id_token_normalized={json.dumps(interesting)}", flush=True)
    sync_rustdesk_admin(claims)
    return json.dumps(payload).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return b""
        return self.rfile.read(length)

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _proxy(self, method: str) -> None:
        path = self.path
        body = self._read_body() if method in ("POST", "PUT", "PATCH") else b""
        upstream = f"{AUTHENTIK_INTERNAL}{path}"
        headers = proxy_issuer_headers()
        for name in ("Content-Type", "Accept", "Authorization"):
            value = self.headers.get(name)
            if value:
                headers[name] = value
        req = urllib.request.Request(upstream, data=body or None, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                resp_body = resp.read()
                content_type = resp.headers.get("Content-Type", "application/json")
                if path.split("?", 1)[0].rstrip("/").endswith("/token") and resp.status == 200:
                    resp_body = normalize_id_token(resp_body)
                self._send(resp.status, resp_body, content_type)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self._send(e.code, resp_body, e.headers.get("Content-Type", "application/json"))
        except (urllib.error.URLError, TimeoutError) as e:
            msg = f"upstream failed: {e}".encode("utf-8")
            self._send(502, msg, "text/plain")

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        expected = f"/application/o/{OIDC_APP_SLUG}/.well-known/openid-configuration"
        if path == expected:
            try:
                body = json.dumps(rewrite_discovery(fetch_discovery())).encode("utf-8")
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
                self._send(502, f"upstream discovery failed: {e}".encode("utf-8"), "text/plain")
                return
            self._send(200, body, "application/json")
            return

        if is_jwks(path):
            self._send(200, JWKS_BODY, "application/json")
            return

        if should_forward(self.path):
            self._proxy("GET")
            return

        self.send_error(404, "Not Found")

    def do_POST(self) -> None:  # noqa: N802
        if should_forward(self.path):
            self._proxy("POST")
            return
        self.send_error(404, "Not Found")

    def log_message(self, format: str, *args) -> None:
        print(f"oidc-proxy: {args[0]} {args[1]} {args[2]}", flush=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", LISTEN_PORT), Handler)
    print(
        f"oidc-proxy listening on :{LISTEN_PORT} "
        f"(internal={AUTHENTIK_INTERNAL}, public_host={AUTHENTIK_PUBLIC_HOST}, "
        f"proxy_base={PROXY_BASE}, normalized_issuer={NORMALIZED_ISSUER}, kid={KID})",
        flush=True,
    )
    server.serve_forever()
