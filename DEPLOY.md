# TEDMaster — VPS Deployment Guide

Tested on Ubuntu 22.04 / 24.04 LTS. Requires a domain name pointing to your server's IP.

---

## Prerequisites

| Requirement | Minimum |
|-------------|---------|
| VPS RAM | 1 GB (2 GB recommended) |
| Disk | 10 GB |
| OS | Ubuntu 22.04+ / Debian 12+ |
| Domain | An A record pointing to your server IP |

---

## 1. Server Initial Setup

```bash
# Log in as root, then create a deploy user
adduser deploy
usermod -aG sudo docker deploy

# (Optional but recommended) Disable root SSH login
sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

---

## 2. Install Docker & Docker Compose

```bash
# Install Docker (official script — safe for Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group so you don't need sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 3. Install Nginx & Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 4. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # ports 80 + 443
sudo ufw enable
sudo ufw status
# Port 3005 must NOT be exposed publicly — Nginx proxies to it internally
```

---

## 5. Clone the Repository

```bash
# Log in as deploy user
su - deploy

git clone https://github.com/YOUR_USERNAME/tedmaster.git
cd tedmaster
```

---

## 6. Configure Environment Variables

```bash
cp .env.example .env

# Edit .env and fill in every value
nano .env
```

`.env` must contain:

```dotenv
GEMINI_API_KEY=your_gemini_api_key_here

# Generate with: openssl rand -hex 32
JWT_SECRET=replace_with_64_hex_chars

# Used by docker-compose to set the postgres password
POSTGRES_PASSWORD=a_strong_database_password
```

> `DATABASE_URL` is constructed automatically inside `docker-compose.yml` using `POSTGRES_PASSWORD`.
> You do **not** need to set it in `.env` for Docker deployments.

---

## 7. First Deploy

### 7a. Build images

```bash
docker compose build
```

### 7b. Start the database

```bash
docker compose up -d postgres

# Wait for postgres to be healthy (~10 s)
docker compose ps
```

### 7c. Run database migrations

```bash
docker compose run --rm migrate
```

Expected output:
```
Prisma Migrate: Applying migration `20260325071321_init`
Database changes applied.
```

### 7d. Start the application

```bash
docker compose up -d tedmaster
```

### 7e. Verify it's running

```bash
docker compose ps
docker compose logs -f tedmaster   # Ctrl+C to exit
```

The app is now listening on `http://localhost:3005` (not yet publicly accessible).

---

## 8. Configure Nginx + HTTPS

### 8a. Create an Nginx site config

```bash
sudo nano /etc/nginx/sites-available/tedmaster
```

Paste (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect all HTTP to HTTPS (certbot will add this automatically)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (certbot fills these in)
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Increase timeouts for long AI requests (Gemini can take 10-15s)
    proxy_read_timeout  60s;
    proxy_send_timeout  60s;

    # Increase body size limit for audio proxy uploads
    client_max_body_size 50M;

    location / {
        proxy_pass         http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tedmaster /etc/nginx/sites-enabled/
sudo nginx -t    # must print: syntax is ok
sudo systemctl reload nginx
```

### 8b. Get an SSL certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will automatically modify your Nginx config and set up auto-renewal.

Verify auto-renewal works:
```bash
sudo certbot renew --dry-run
```

---

## 9. Verify End-to-End

Open `https://yourdomain.com` in a browser. You should see the TEDMaster home page over HTTPS.

---

## 10. Updating (Re-deploying)

```bash
cd ~/tedmaster

# Pull latest code
git pull

# Rebuild images
docker compose build

# Apply any new database migrations
docker compose run --rm migrate

# Restart the app (zero-downtime if using --no-deps)
docker compose up -d --no-deps tedmaster
```

---

## 11. Database Backup

PostgreSQL data lives in the `postgres_data` Docker volume. Back it up regularly:

```bash
# Dump to a compressed file
docker compose exec postgres pg_dump -U tedmaster tedmaster | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore from backup
gunzip -c backup_YYYYMMDD_HHMMSS.sql.gz | docker compose exec -T postgres psql -U tedmaster tedmaster
```

Automate with cron:
```bash
crontab -e
# Add: daily backup at 2 AM, keep 7 days
0 2 * * * cd ~/tedmaster && docker compose exec postgres pg_dump -U tedmaster tedmaster | gzip > ~/backups/db_$(date +\%Y\%m\%d).sql.gz && find ~/backups -name "db_*.sql.gz" -mtime +7 -delete
```

---

## 12. Log Management

Docker logs are stored on disk and can grow large. Enable log rotation:

```bash
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
```

```bash
sudo systemctl restart docker
```

---

## 13. Monitoring

```bash
# Live resource usage
docker stats

# Container status
docker compose ps

# App logs (last 100 lines)
docker compose logs --tail=100 tedmaster

# Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

---

## 14. Troubleshooting

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| App won't start | `docker compose logs tedmaster` | Check env vars; run `docker compose run --rm migrate` |
| 502 Bad Gateway | App container not running | `docker compose up -d tedmaster` |
| SSL not working | Certbot not run | Run step 8b |
| Migrations fail | Wrong DATABASE_URL | Check `POSTGRES_PASSWORD` in `.env` |
| Gemini errors | Invalid API key | Check `GEMINI_API_KEY` in `.env` |
| 429 Too Many Requests | Rate limit hit | Normal — wait 1 minute |

---

## Remaining Known Limitations

- **In-process rate limiter / caches are per-process** — if you ever scale to multiple app replicas (e.g. Docker Swarm), rate limits and LRU caches won't be shared. Requires Redis to fix (Phase 3).
- **No horizontal scaling** — single Docker container. Sufficient for hundreds of concurrent users; for 1 000+ sustained, consider adding a Redis layer and multiple replicas.
- **Whisper model weights** (`public/models/`) are not bundled — users trigger an in-browser download on first transcription (~150 MB). This is intentional (too large to ship in the Docker image).
