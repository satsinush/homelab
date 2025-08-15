#!/bin/sh
set -e

# --- 1. Define Variables and Create Dummy Files ---
echo "--- Step 1: Creating dummy files for the test ---"

# Define filenames and the placeholder
TEMPLATE_FILE="dummy_template.yml"
KEY_FILE="dummy_private.key"
FINAL_CONFIG_FILE="final_config.yml"
PLACEHOLDER="KEY_WILL_BE_INSERTED_HERE"
INDENTED_KEY_FILE="indented_key.tmp"

# Create a dummy template file
cat << 'EOF' > "$TEMPLATE_FILE"
identity_providers:
  oidc:
    jwks:
      - algorithm: 'RS256'
        use: 'sig'
        key: |
          KEY_WILL_BE_INSERTED_HERE
EOF
echo "Created '$TEMPLATE_FILE'"

# Create a dummy private key file
cat << 'EOF' > "$KEY_FILE"
-----BEGIN DUMMY PRIVATE KEY-----
LINE 1: This is the first line of the key.
LINE 2: This is the second.
LINE 3: It has multiple lines.
-----END DUMMY PRIVATE KEY-----
EOF
echo "Created '$KEY_FILE'"
echo "-------------------------------------------------"
echo ""


# --- 2. Run the Substitution Logic ---
echo "--- Step 2: Running the indentation and substitution logic ---"

# Indent the key file and save to a temporary file
# The 's/^/            /' command adds 12 spaces to the start of each line
sed 's/^/            /' "$KEY_FILE" > "$INDENTED_KEY_FILE"
echo "Indented key has been created."

# Use sed to replace the placeholder with the content of the indented key file
sed -e "/$PLACEHOLDER/r $INDENTED_KEY_FILE" -e "/$PLACEHOLDER/d" "$TEMPLATE_FILE" > "$FINAL_CONFIG_FILE"
echo "Substitution complete. Final file created: '$FINAL_CONFIG_FILE'"
echo "-------------------------------------------------"
echo ""


# --- 3. Display the Result ---
echo "--- Step 3: Displaying the final generated file ---"
cat "$FINAL_CONFIG_FILE"
echo "-------------------------------------------------"
echo ""


# --- 4. Clean Up ---
echo "--- Step 4: Cleaning up temporary files ---"
rm "$TEMPLATE_FILE" "$KEY_FILE" "$FINAL_CONFIG_FILE" "$INDENTED_KEY_FILE"
echo "Done."