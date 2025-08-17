#!/bin/bash

# Load environment variables from the .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | sed 's/\r$//' | xargs)
fi

# --- 1. Validate Required Environment Variables ---
: "${PORTAINER_ADMIN_USERNAME:?Please set PORTAINER_ADMIN_USERNAME in your .env file}"
: "${PORTAINER_ADMIN_PASSWORD:?Please set PORTAINER_ADMIN_PASSWORD in your .env file}"
: "${AUTHELIA_WEB_HOSTNAME:?Please set AUTHELIA_WEB_HOSTNAME in your .env file}"
: "${PORTAINER_OIDC_SECRET:?Please set PORTAINER_OIDC_SECRET in your .env file}"
: "${PORTAINER_WEB_HOSTNAME:?Please set PORTAINER_WEB_HOSTNAME for the redirect URI (e.g., portainer.yourdomain.com)}"
: "${PORTAINER_CLIENT_ID:=portainer}"

# --- 2. Initialize Admin User ---
echo "🐣 Attempting to initialize admin user..."
docker exec portainer curl -s -k -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${PORTAINER_ADMIN_USERNAME}\", \"password\": \"${PORTAINER_ADMIN_PASSWORD}\"}" \
  "http://localhost:9000/api/users/admin/init"

# --- 3. Authenticate and Get API Token ---
echo "🔐 Authenticating with Portainer to get API token..."
TOKEN=$(docker exec portainer curl -s -k -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${PORTAINER_ADMIN_USERNAME}\", \"password\": \"${PORTAINER_ADMIN_PASSWORD}\"}" \
  "http://localhost:9000/api/auth" | jq -r .jwt)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Failed to get API token. Check container name and credentials."
  exit 1
fi
echo "✅ Successfully retrieved API token."

# --- 4. Construct and PUT the Final Payload ---
echo "🚀 Sending updated settings to Portainer..."
RESPONSE=$(docker exec -i portainer curl -s -k -w "\n%{http_code}" -X PUT \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @- \
  "http://localhost:9000/api/settings" << EOF
{
  "authenticationMethod": 3,
  "oauthSettings": {
    "SSO": true,
    "OAuthAutoCreateUsers": true,
    "ClientID": "${PORTAINER_CLIENT_ID}",
    "ClientSecret": "${PORTAINER_OIDC_SECRET}",
    "AccessTokenURI": "https://${AUTHELIA_WEB_HOSTNAME}/api/oidc/token",
    "AuthorizationURI": "https://${AUTHELIA_WEB_HOSTNAME}/api/oidc/authorization",
    "ResourceURI": "https://${AUTHELIA_WEB_HOSTNAME}/api/oidc/userinfo",
    "RedirectURI": "https://${PORTAINER_WEB_HOSTNAME}",
    "LogoutURI": "https://${AUTHELIA_WEB_HOSTNAME}/logout",
    "UserIdentifier": "preferred_username",
    "Scopes": "openid profile email groups"
  }
}
EOF
)

# --- 5. Check Result and Verify Changes ---
STATUS_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  echo "✅ Settings update successful! (HTTP 200)"
  
  # --- VERIFICATION STEP ---
  # echo "🔎 Fetching final settings for verification..."
  # FINAL_SETTINGS=$(docker exec portainer curl -s -k -H "Authorization: Bearer ${TOKEN}" "http://localhost:9000/api/settings")

  # echo "--- Current Settings After Update ---"
  # echo "${FINAL_SETTINGS}" | jq
  # echo "-------------------------------------"
  echo "✅ Configuration complete."

  # --- Print RustDesk public key if available ---
  RUSTDESK_PUB="./rustdesk/data/id_ed25519.pub"
  if [ -f "${RUSTDESK_PUB}" ]; then
    echo ""
    echo "📣 RustDesk public key (from ${RUSTDESK_PUB}):"
    echo "-------------------------------------------"
    cat "${RUSTDESK_PUB}"
    echo ""
    echo "-------------------------------------------"
  else
    echo ""
    echo "⚠️  RustDesk public key not found at ${RUSTDESK_PUB}. Skipping."
  fi

else
  echo "❌ Failed to update Portainer settings. HTTP Status Code: ${STATUS_CODE}"
  echo "Response Body: ${BODY}"
  exit 1
fi