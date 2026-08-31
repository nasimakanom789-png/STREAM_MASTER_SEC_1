# 🚀 STREAM CORPORATION OPS DECK — COMPLETE WEB HOSTING GUIDE

This project is now 100% configured and ready to be hosted on any cloud provider for **free 24/7 online access**.

---

## 🌟 Option 1: Deploy to Render.com (Recommended — 100% Free & Automatic)

Render is the easiest way to host Node.js web apps with free automatic SSL and custom domain support.

### Steps:
1. Go to **[Render.com](https://render.com)** and create a free account (sign in with GitHub, Google, or Email).
2. Click **New +** (top right) ➔ **Web Service**.
3. Choose **Build and deploy from a Git repository** (upload this project to GitHub first) or connect your repository.
4. Fill in the deployment details:
   - **Name:** `stream-corp-ops-deck` (or your preferred name)
   - **Region:** Closest to your users (e.g., Singapore / Frankfurt / Oregon)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan Type:** `Free`
5. In **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `MASTER_ADMIN_KEY` = `STREAM_MASTER_SEC_2026` (or your custom master key)
6. Click **Create Web Service**.
7. Render will build and launch your site. You will get a permanent URL like:
   `https://stream-corp-ops-deck.onrender.com`

---

## 🌐 Adding Your Custom Domain on Render.com:
1. Inside your Render Web Service dashboard, go to **Settings** (left sidebar).
2. Scroll to **Custom Domains** and click **Add Custom Domain**.
3. Enter your domain (e.g. `streamcorp.com` or `panel.streamcorp.com`).
4. Go to your Domain Registrar (Namecheap, GoDaddy, Cloudflare, etc.) and add the DNS record shown by Render:
   - **Type:** `CNAME`
   - **Name / Host:** `panel` (or `@` for root domain)
   - **Value / Target:** `stream-corp-ops-deck.onrender.com`
5. Render will automatically issue a free SSL certificate (`https://`) within a few minutes!

---

## ⚡ Option 2: Deploy to Railway.app

1. Go to **[Railway.app](https://railway.app)** and login with GitHub.
2. Click **New Project** ➔ **Deploy from GitHub repo**.
3. Select your repository.
4. Railway will automatically detect the `Procfile` / `package.json` and deploy.
5. In Settings ➔ **Networking**, click **Generate Domain** or **Custom Domain**.

---

## ☁️ Option 3: Deploy to Vercel

1. Go to **[Vercel.com](https://vercel.com)** and sign in.
2. Click **Add New...** ➔ **Project**.
3. Import your GitHub repository.
4. Vercel will automatically read `vercel.json` and deploy.

---

## 🐳 Option 4: Deploy on any VPS / Docker (DigitalOcean, AWS, Linode, Hetzner)

Run with Docker:
```bash
docker build -t stream-corp-ops .
docker run -d -p 80:3000 --restart always --name stream-corp stream-corp-ops
```

---

## 🔑 Default Login Credentials:
- **Master Admin:** `STREAM_MASTER_SEC_2026`
- **Reseller:** `reseller_demo` / `reseller123`
- **Fetcher:** `fetcher_demo` / `fetcher123`
