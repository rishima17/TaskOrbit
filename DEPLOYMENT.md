# 🚀 TaskOrbit Production Deployment Guide

This guide details the **3 best production deployment paths** for TaskOrbit, depending on whether you want a **100% Free Cloud setup**, a **1-click Cloud PaaS (Railway)**, or a **Self-Hosted VPS (Docker Compose)**.

---

## Architecture Summary

TaskOrbit consists of 4 main components:
1. **Frontend**: Vite + React 18 Single Page Application.
2. **API Server**: Express Ingestion Server (`src/server.js` or `src/combined.js`).
3. **Worker Node**: BullMQ Asynchronous Processor (`src/workers/worker.js` or `src/combined.js`).
4. **Data Layer**: MongoDB (State & Audits) + Redis (Task Queue & PubSub).

---

## 🌟 PATH 1: 100% Free Cloud Deployment ($0/month)
> **Best for**: Live portfolios, demos, and free production hosting.

### Step 1: Create Free MongoDB Database (MongoDB Atlas)
1. Sign up for free at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Shared Cluster**.
3. Under **Database Access**, create a user (e.g. `taskorbit_admin` with a secure password).
4. Under **Network Access**, click **Add IP Address** -> select **Allow Access from Anywhere** (`0.0.0.0/0`).
5. Click **Connect** -> **Drivers** -> Copy your connection string:
   ```text
   mongodb+srv://taskorbit_admin:<password>@cluster0.abcde.mongodb.net/task_queue_db?retryWrites=true&w=majority
   ```

### Step 2: Create Free Redis Queue (Redis Cloud or Upstash)
1. Sign up for free at [redis.io/try-free](https://redis.io/try-free) (Redis Cloud 30MB Free Tier) or [upstash.com](https://upstash.com).
2. Create a free database in region closest to your backend.
3. Copy your connection URL (or host, port, and password):
   ```text
   redis://default:<password>@<host>:<port>
   ```

### Step 3: Deploy Backend on Render.com (Free Web Service)
Render's free tier allows 1 Web Service. TaskOrbit includes `src/combined.js` which runs both the Express API and the BullMQ Worker in a single process, keeping it 100% within the free tier!

1. Push your repository to GitHub.
2. Go to [render.com](https://render.com) and click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure service settings:
   - **Name**: `taskorbit-api`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:cluster`
   - **Plan**: `Free`
5. In the **Environment Variables** tab, add:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (or leave default) |
   | `MONGODB_URI` | *Your MongoDB Atlas connection string from Step 1* |
   | `REDIS_URL` | *Your Redis connection string from Step 2* |
   | `JWT_SECRET` | *A random 32+ character secret string* |
   | `CLIENT_URL` | `https://your-frontend.vercel.app` (update after Step 4) |
   | `CROSS_DOMAIN` | `true` |
6. Click **Deploy Web Service**.
7. Once deployed, test your API health by visiting: `https://your-api.onrender.com/health`

### Step 4: Deploy Frontend on Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Select your GitHub repository.
3. Configure settings:
   - **Root Directory**: Click edit and select `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-api.onrender.com` *(your Render backend URL)* |
5. Click **Deploy**.
6. Copy your Vercel URL and paste it back into your Render backend `CLIENT_URL` environment variable.

---

## 🚀 PATH 2: All-in-One Cloud PaaS (Railway.app)
> **Best for**: 1-click cloud orchestration with managed private databases.

1. Sign up on [railway.app](https://railway.app).
2. Click **New Project** -> **Provision MongoDB**.
3. Click **Add Service** -> **Database** -> **Add Redis**.
4. Click **Add Service** -> **GitHub Repo** -> Select your TaskOrbit repository.
5. In the backend service settings:
   - **Root Directory**: `/backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:cluster`
6. Connect environment variables using Railway's reference syntax:
   - `MONGODB_URI` = `${{MongoDB.MONGO_URL}}`
   - `REDIS_URL` = `${{Redis.REDIS_URL}}`
   - `JWT_SECRET` = `generate-a-secure-random-secret-key`
   - `NODE_ENV` = `production`
7. Click **Generate Domain** under Networking to get your public API URL.
8. Deploy the frontend on Vercel or as a static service on Railway with `VITE_API_URL`.

---

## 🐳 PATH 3: Self-Hosted Production VPS (Docker Compose)
> **Best for**: Full control, AWS EC2, DigitalOcean Droplet, Hetzner, or private servers.

TaskOrbit includes a production-ready `docker-compose.prod.yml` that boots:
- Nginx Web Gateway (serves React frontend, reverse-proxies `/api` with SSE headers)
- Node.js API Server
- Node.js BullMQ Worker (can scale horizontally)
- Redis 7 (AOF enabled)
- MongoDB 7.0 (persistent data volume)

### Deployment Steps on VPS:
1. SSH into your Ubuntu VPS:
   ```bash
   ssh user@your-server-ip
   ```
2. Clone your repository:
   ```bash
   git clone https://github.com/your-username/TaskOrbit.git
   cd TaskOrbit
   ```
3. Edit `docker-compose.prod.yml` if you need custom passwords or secrets:
   ```bash
   nano docker-compose.prod.yml
   ```
4. Launch the entire production stack in one command:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
5. Check running services:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
6. Open your browser and navigate to `http://your-server-ip`.

### Scaling Workers Horizontally:
To scale from 1 worker to 3 parallel background worker nodes:
```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=3
```
BullMQ will immediately distribute jobs across all 3 workers!

---

## Production Checklist & Security
- [x] **SSE Streaming**: Nginx reverse proxy configured with `proxy_buffering off` and `proxy_read_timeout 24h` for uninterrupted real-time telemetry.
- [x] **CORS & Authentication**: Dual support for HttpOnly cookies and `Authorization: Bearer <token>` + URL token fallback for SSE.
- [x] **Redis Port Flexibility**: Supports both standard host/port and `REDIS_URL` with TLS (`rediss://`).
- [x] **Database Persistence**: Docker volumes configured for both Redis AOF logs and MongoDB collections.
- [x] **Graceful Shutdown**: SIGINT / SIGTERM handlers ensure running BullMQ jobs finish processing before worker stops.

