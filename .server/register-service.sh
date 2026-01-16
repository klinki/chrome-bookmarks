#!/bin/bash

# This script registers the Caddy Ask Script as a systemd service.
# Run this script with sudo.

SCRIPT_NAME="caddy-ask"
SERVICE_FILE="/etc/systemd/system/${SCRIPT_NAME}.service"

# Detect current user and path
USER_NAME=${SUDO_USER:-$USER}
# Assumes the script is in the same directory as this installer
SCRIPT_DIR=$(pwd)
ASK_SCRIPT_PATH="${SCRIPT_DIR}/ask-script.js"
NODE_BIN=$(which node)

if [ -z "$NODE_BIN" ]; then
    echo "Error: Node.js not found. Please install Node.js first."
    exit 1
fi

if [ ! -f "$ASK_SCRIPT_PATH" ]; then
    echo "Error: ask-script.js not found at $ASK_SCRIPT_PATH"
    exit 1
fi

echo "Creating systemd service file at ${SERVICE_FILE}..."

cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Caddy Ask Script for Dynamic Subdomains
After=network.target

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${NODE_BIN} ${ASK_SCRIPT_PATH}
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling service to start on boot..."
systemctl enable "$SCRIPT_NAME"

echo "Starting service..."
systemctl start "$SCRIPT_NAME"

echo "Done! Service status:"
systemctl status "$SCRIPT_NAME" --no-pager
