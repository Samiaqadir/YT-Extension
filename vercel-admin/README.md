# Flow Session Share - Standalone Vercel Admin Panel

This folder is a standalone, ready-to-deploy package designed specifically for **Vercel** with **zero credit card required**.

It includes:
- **Full Admin Control Panel** (`public/index.html`) with user management, master cookie/token updater, presets (Google Flow, VideoFX, FlowGPT), and audit trail.
- **Serverless API Gateway** (`api/index.js`) handling user authentication, session grants, and real-time settings.
- **Vercel Routing** (`vercel.json`) routing `/` and `/admin` to the web console and `/api/*` to the serverless gateway.

---

## 🚀 How to Deploy on Vercel (100% Free, No Credit Card)

### Step 1: Open Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your **GitHub account**.
2. Click **Add New...** → **Project**.

### Step 2: Import Your GitHub Repository
1. Select your repository: `Samiaqadir/YT-Extension`.
2. In the **Configure Project** screen:
   - Find **Root Directory** → click **Edit**.
   - Select or type: **`vercel-admin`**.
   - Click **Continue**.

### Step 3: Deploy
1. Click **Deploy**.
2. Vercel will build and deploy the project in ~30 seconds.
3. You will receive your free public HTTPS URL:
   `https://flow-session-admin.vercel.app` (or similar).

---

## 📱 How to Use With the Chrome Extension

1. Open your new Vercel URL in your browser:
   `https://your-project.vercel.app/admin`
2. Open the Chrome Extension popup:
   - Under the login button, click **Gateway Server: (Change)**.
   - Paste your Vercel URL: `https://your-project.vercel.app`.
3. Log in with your admin credentials (`sami`, `bilal`, `samiaqadir` with password `123456`, or any new user you created).
4. The extension will authenticate against your Vercel cloud gateway and automatically launch `https://flow.google.com` with the session cookies applied!
