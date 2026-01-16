# Deployment Strategy for PR Previews

This document outlines the strategy for deploying Pull Request previews to a subdomain on a Linux server (e.g., Ubuntu) using Caddy web server with On-Demand TLS.

## Domain Structure

Previews will be available at: `{pr-number}.{project}.github.klinki.cz`

Example: `pr-23.bookmarks.github.klinki.cz`

## Server Setup

### 1. Prerequisites
*   A server (VM) running Ubuntu (or any Linux distro).
*   **Node.js** installed (required for the validation script).
*   **Caddy** installed. [Official Install Guide](https://caddyserver.com/docs/install#debian-ubuntu-raspbian).
*   **PM2** (optional but recommended) to keep the ask script running. `npm install -g pm2`.

### 2. File Setup
Upload the contents of the `.server/` directory to your server (e.g., to `/home/user/server-config/` or directly to `/etc/caddy/` if preferred).

*   `ask-script.js`: Validates if a subdomain corresponds to an existing deployment folder.
*   `Caddyfile`: The Caddy configuration.

### 3. Ask Script (Validation Service)
This script prevents Caddy from issuing certificates for non-existent PRs (preventing abuse).

1.  Move `ask-script.js` to a permanent location.
2.  Install dependencies (if any - currently uses standard library).
3.  Run it:
    ```bash
    node ask-script.js
    ```
    *Recommended: Use PM2 to keep it running in background:*
    ```bash
    pm2 start ask-script.js --name "caddy-ask"
    ```
    The script runs on port **5555**.

### 4. Caddy Configuration
Replace the default Caddyfile content (usually at `/etc/caddy/Caddyfile`) with the content of `.server/Caddyfile`.

```caddy
{
    on_demand_tls {
        ask http://localhost:5555/check
        interval 2m
        burst 5
    }
}

*.*.github.klinki.cz {
    tls {
        on_demand
    }
    root * /var/www/{labels.3}/{labels.4}
    file_server
    try_files {path} /index.html
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

## GitHub Actions Integration

The workflow `.github/workflows/preview.yaml` handles deployment.

### Required Secrets

Add these to GitHub Repository Secrets:

| Secret Name | Description |
| :--- | :--- |
| `SSH_HOST` | Server IP or hostname. |
| `SSH_USER` | SSH username. **Must have write access to `/var/www/`**. |
| `SSH_PRIVATE_KEY` | Private SSH key. |

### Folder Structure
The workflow deploys to: `/var/www/<project-name>/pr-<number>/`
Example: `/var/www/bookmarks/pr-23/`

Ensure the `SSH_USER` has permissions to create directories in `/var/www/`.
```bash
sudo chown -R $USER:www-data /var/www
sudo chmod -R 775 /var/www
```

### Notifications
The workflow will automatically post a comment on the Pull Request with the link to the deployed preview.
