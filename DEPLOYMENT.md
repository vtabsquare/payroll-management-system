# Production Deployment Guide - Payroll Management System

## Overview
This guide will help you deploy the Payroll Management System to your DigitalOcean droplet with the domain `payroll.vtabsquare.com`.

---

## Prerequisites

- DigitalOcean droplet with Ubuntu (already running 3 web apps)
- Domain: `vtabsquare.com` with DNS access
- Node.js 18+ installed on droplet
- Nginx installed on droplet
- PM2 installed globally on droplet
- Git installed on droplet
- SSL certificate capability (Let's Encrypt)

---

## Part 1: Prepare Local Repository

### Step 1: Create GitHub Repository

1. Go to https://github.com and create a new repository
   - Repository name: `payroll-management-system`
   - Visibility: Private (recommended for production)
   - Don't initialize with README (we already have code)

### Step 2: Initialize Git and Push to GitHub

Open terminal in your project directory and run:

```bash
cd "f:\payflow vtab\payflow-dynamics"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Production ready payroll system"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/payroll-management-system.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Verify .gitignore

Ensure `.env` files are NOT pushed to GitHub. Check that `.gitignore` includes:
```
.env
.env.local
.env.production
```

---

## Part 2: Prepare Production Environment Variables

### Step 1: Copy Your Current .env

Before pushing, save your current `.env` file contents somewhere safe. You'll need:
- Google Sheets API credentials
- Brevo API key
- JWT secret

### Step 2: Generate JWT Secret

Run this command to generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Save this output for your production `.env` file.

---

## Part 3: Deploy to DigitalOcean Droplet

### Step 1: SSH into Your Droplet

```bash
ssh root@your-droplet-ip
# OR
ssh your-username@your-droplet-ip
```

### Step 2: Navigate to Your Apps Directory

Assuming your other 3 apps are in `/var/www/` or similar:

```bash
cd /var/www
```

### Step 3: Clone Repository

```bash
# Clone from GitHub (replace YOUR_USERNAME)
git clone https://github.com/YOUR_USERNAME/payroll-management-system.git payroll

# Navigate into directory
cd payroll
```

### Step 4: Create Production .env File

```bash
nano .env
```

Paste the following and replace with your actual values:

```env
# Backend Configuration
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://payroll.vtabsquare.com

# Google Sheets API Configuration
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-actual-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SHEET_ID=your_actual_google_sheet_id

# Brevo Email Configuration
BREVO_API_KEY=your_actual_brevo_api_key
BREVO_SENDER_EMAIL=noreply@vtabsquare.com
BREVO_SENDER_NAME=Payroll System

# JWT Secret (use the one you generated)
JWT_SECRET=your_generated_jwt_secret_here

# Frontend Configuration
VITE_API_BASE_URL=https://payroll.vtabsquare.com/api
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

### Step 5: Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 6: Build Frontend

```bash
npm run build
```

This creates optimized production files in the `dist` folder.

### Step 7: Create Logs Directory

```bash
mkdir -p logs
```

---

## Part 4: Configure PM2 Process Manager

### Step 1: Start Backend with PM2

```bash
pm2 start ecosystem.config.js
```

### Step 2: Save PM2 Configuration

```bash
pm2 save
```

### Step 3: Enable PM2 Startup (if not already done)

```bash
pm2 startup
# Follow the command it outputs
```

### Step 4: Verify Backend is Running

```bash
pm2 status
pm2 logs payroll-backend
```

You should see the backend running on port 4000.

---

## Part 5: Configure Nginx

### Step 1: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/payroll.vtabsquare.com
```

Paste the following configuration:

```nginx
server {
    listen 80;
    server_name payroll.vtabsquare.com;

    # Redirect HTTP to HTTPS (will be configured after SSL)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name payroll.vtabsquare.com;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/payroll.vtabsquare.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/payroll.vtabsquare.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Root directory for frontend static files
    root /var/www/payroll/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Frontend - serve static files
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # API - proxy to backend
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

### Step 2: Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/payroll.vtabsquare.com /etc/nginx/sites-enabled/
```

### Step 3: Test Nginx Configuration

```bash
sudo nginx -t
```

If successful, you'll see "syntax is ok" and "test is successful".

---

## Part 6: Configure DNS

### Step 1: Add DNS A Record

Go to your domain registrar or DNS provider (where vtabsquare.com is managed):

1. Add a new **A Record**:
   - **Name/Host:** `payroll`
   - **Type:** `A`
   - **Value/Points to:** Your DigitalOcean droplet IP address
   - **TTL:** 3600 (or default)

2. Save the DNS record

3. Wait 5-10 minutes for DNS propagation

### Step 2: Verify DNS

```bash
# On your local machine or droplet
nslookup payroll.vtabsquare.com
# Should return your droplet IP
```

---

## Part 7: Install SSL Certificate (Let's Encrypt)

### Step 1: Install Certbot (if not already installed)

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### Step 2: Temporarily Remove SSL Lines from Nginx Config

Since we don't have the certificate yet, comment out SSL lines:

```bash
sudo nano /etc/nginx/sites-available/payroll.vtabsquare.com
```

Comment out (add `#` before) these lines:
```nginx
# ssl_certificate /etc/letsencrypt/live/payroll.vtabsquare.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/payroll.vtabsquare.com/privkey.pem;
```

Also temporarily change the HTTPS server block to listen on port 80:
```nginx
server {
    listen 80;
    server_name payroll.vtabsquare.com;
    # ... rest of config
}
```

Reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Obtain SSL Certificate

```bash
sudo certbot --nginx -d payroll.vtabsquare.com
```

Follow the prompts:
- Enter your email address
- Agree to terms of service
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### Step 4: Restore Full Nginx Configuration

After Certbot succeeds, restore the full configuration:

```bash
sudo nano /etc/nginx/sites-available/payroll.vtabsquare.com
```

Uncomment the SSL lines and restore the configuration as shown in Part 5.

### Step 5: Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

---

## Part 8: Verify Deployment

### Step 1: Check Backend

```bash
curl http://localhost:4000/api/health
# Should return: {"status":"ok","service":"payflow-backend"}
```

### Step 2: Check Frontend

Open browser and visit:
```
https://payroll.vtabsquare.com
```

You should see the login page.

### Step 3: Check PM2 Status

```bash
pm2 status
pm2 logs payroll-backend --lines 50
```

### Step 4: Test Login

Try logging in with your admin credentials.

---

## Part 9: Post-Deployment Tasks

### Step 1: Set Up Firewall (if not already configured)

```bash
sudo ufw status
# Ensure ports 80, 443, and SSH are allowed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow OpenSSH
sudo ufw enable
```

### Step 2: Configure Log Rotation

Create log rotation config:

```bash
sudo nano /etc/logrotate.d/payroll
```

Add:
```
/var/www/payroll/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Step 3: Set Up Monitoring

```bash
# Monitor PM2 processes
pm2 monit

# Or use PM2 Plus (optional, requires signup)
pm2 plus
```

---

## Part 10: Maintenance Commands

### Update Application

```bash
cd /var/www/payroll

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install
cd frontend && npm install && cd ..

# Rebuild frontend
npm run build

# Restart backend
pm2 restart payroll-backend

# Check status
pm2 status
pm2 logs payroll-backend
```

### View Logs

```bash
# PM2 logs
pm2 logs payroll-backend

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Application logs
tail -f /var/www/payroll/logs/backend-out.log
tail -f /var/www/payroll/logs/backend-error.log
```

### Restart Services

```bash
# Restart backend
pm2 restart payroll-backend

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx
```

### Check Service Status

```bash
# PM2 status
pm2 status

# Nginx status
sudo systemctl status nginx

# Check if port 4000 is listening
sudo netstat -tulpn | grep 4000
```

---

## Troubleshooting

### Issue: Cannot access website

**Check DNS:**
```bash
nslookup payroll.vtabsquare.com
```

**Check Nginx:**
```bash
sudo nginx -t
sudo systemctl status nginx
```

**Check firewall:**
```bash
sudo ufw status
```

### Issue: Backend not responding

**Check PM2:**
```bash
pm2 status
pm2 logs payroll-backend --lines 100
```

**Check if port is in use:**
```bash
sudo netstat -tulpn | grep 4000
```

**Restart backend:**
```bash
pm2 restart payroll-backend
```

### Issue: 502 Bad Gateway

This usually means the backend is not running or not accessible.

**Check backend:**
```bash
pm2 status
curl http://localhost:4000/api/health
```

**Check Nginx proxy configuration:**
```bash
sudo nano /etc/nginx/sites-available/payroll.vtabsquare.com
# Verify proxy_pass is http://localhost:4000
```

### Issue: SSL certificate errors

**Renew certificate:**
```bash
sudo certbot renew
sudo systemctl reload nginx
```

**Check certificate:**
```bash
sudo certbot certificates
```

---

## Security Checklist

- [ ] `.env` file is NOT in Git repository
- [ ] Strong JWT secret is set
- [ ] Firewall is enabled (UFW)
- [ ] SSL certificate is installed and auto-renewing
- [ ] Google Sheets API credentials are secure
- [ ] Brevo API key is secure
- [ ] Only necessary ports are open (80, 443, SSH)
- [ ] SSH is secured (key-based auth recommended)
- [ ] Regular backups of Google Sheets data
- [ ] PM2 is set to auto-restart on server reboot

---

## Support

For issues or questions:
1. Check PM2 logs: `pm2 logs payroll-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify all environment variables in `.env`
4. Ensure Google Sheets API is accessible from droplet IP

---

## Quick Reference

**Application URL:** https://payroll.vtabsquare.com  
**Backend Port:** 4000  
**PM2 App Name:** payroll-backend  
**Application Directory:** /var/www/payroll  
**Nginx Config:** /etc/nginx/sites-available/payroll.vtabsquare.com  
**Logs Directory:** /var/www/payroll/logs  

---

**Deployment Date:** March 6, 2026  
**Version:** 1.0.0  
**Status:** Production Ready
