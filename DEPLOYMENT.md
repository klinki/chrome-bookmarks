# Deployment Strategy for PR Previews

This document outlines the strategy for deploying Pull Request previews to a subdomain on a Linux server (e.g., Ubuntu) using Caddy web server.

## Subdomain Feasibility

The proposed structure `pr-23.project.main-domain.com` is **completely feasible**.

*   **DNS:** You will need an `A` record for `*.project.main-domain.com` pointing to your server's IP address.
*   **SSL/TLS:** Standard wildcard certificates (e.g., for `*.main-domain.com`) do **not** cover multi-level subdomains like `pr-23.project.main-domain.com`. You have two options:
    1.  **Wildcard Certificate for the Subdomain:** Obtain a wildcard certificate specifically for `*.project.main-domain.com`.
    2.  **On-Demand TLS (Caddy):** Configure Caddy to automatically issue certificates for each new subdomain as it's accessed. This is the easiest method but requires careful configuration to avoid hitting Let's Encrypt rate limits.

## Server Setup

### 1. Prerequisites
*   A server (VM) running Ubuntu (or any Linux distro).
*   **Caddy** installed. [Official Install Guide](https://caddyserver.com/docs/install#debian-ubuntu-raspbian).
*   Domain DNS configured as mentioned above.

### 2. Caddy Configuration (`/etc/caddy/Caddyfile`)

This configuration dynamically maps subdomains to directories in `/var/www/`.

```caddy
{
    # Optional: On-Demand TLS configuration
    # If you don't have a wildcard cert for *.project.main-domain.com, uncomment this.
    # on_demand_tls {
    #     ask http://localhost:5555/check # strictly recommended to prevent abuse
    #     interval 2m
    #     burst 5
    # }
}

# Replace 'project.main-domain.com' with your actual domain base
*.project.main-domain.com {
    # If using On-Demand TLS
    # tls {
    #     on_demand
    # }

    # Map the subdomain to a directory
    # For domain 'pr-23.project.main-domain.com':
    # labels.0 = com
    # labels.1 = main-domain
    # labels.2 = project
    # labels.3 = pr-23
    root * /var/www/{labels.3}

    # Enable file server
    file_server

    # SPA Fallback (for Angular)
    try_files {path} /index.html
}
```

## GitHub Actions Integration

A workflow file `.github/workflows/preview.yaml` has been created to automate deployment.

### Required Secrets

To enable the deployment, you must add the following **Repository Secrets** in GitHub (`Settings` -> `Secrets and variables` -> `Actions`):

| Secret Name | Description |
| :--- | :--- |
| `SSH_HOST` | The public IP address or hostname of your server. |
| `SSH_USER` | The SSH username (e.g., `root`, `ubuntu`, `caddy`). |
| `SSH_PRIVATE_KEY` | The private SSH key to authenticate with the server. |

**Important:**
*   The `SSH_USER` must have write permissions to `/var/www/`.
*   The public key corresponding to `SSH_PRIVATE_KEY` must be added to `~/.ssh/authorized_keys` on the server for `SSH_USER`.
*   The server's host key should be known or verification disabled (the workflow uses `StrictHostKeyChecking=no` for simplicity, but for higher security, add `SSH_KNOWN_HOSTS`).

### Workflow Behavior

1.  **On PR Open/Update:**
    *   Builds the Angular application (`production` configuration).
    *   Creates a directory `/var/www/pr-<number>` on the server.
    *   Copies the build artifacts to that directory.
2.  **On PR Close:**
    *   Deletes the directory `/var/www/pr-<number>` from the server.
