# TaskOrbit - Enterprise Distributed Asynchronous Task Queue & Webhook Engine

A production-grade, fault-tolerant asynchronous execution engine built with the **MERN Stack** (MongoDB, Express, React, Node.js), **BullMQ**, and **Redis**, featuring live client streaming via **Server-Sent Events (SSE)**.

---

## 🏗️ Architecture Overview

Synchronous HTTP request-response cycles freeze the main event loop and exhaust web server threads when executing heavy tasks (e.g. 50-page PDF generation, 5,000 bulk email batches, high-throughput webhook dispatches).

This platform decouples execution through a 3-tier distributed model:

```
[React Client (Vite + Tailwind)]
         │
         │ 1. POST /api/jobs/create
         ▼
[Express API Gateway (server.js)] ───► Immediately responds: HTTP 202 Accepted { success: true, jobId }
         │
         │ 2. Enqueues job with 3 retries & exponential backoff
         ▼
[Redis & BullMQ Engine] ◄────────────┐
         │                           │
         │ 3. Pops jobs (Concurrency: 5)
         ▼                           │ (If Attempt < 3, retries after 2s, 4s, 8s)
[Dedicated Worker Process (worker.js)]
         │
         ├─► Emits progress (20%, 50%, 80%, 100%) via BullMQ QueueEvents
         │         │
         │         ▼
         │   [SSE Endpoint: GET /api/jobs/progress/:jobId]
         │         │
         │         ▼ (Real-time live updates pushed directly to React EventSource)
         │   [React Dynamic Progress Bar & Telemetry]
         │
         └─► (If 3 Retries Exhausted)
                   │
                   ▼
         [Dead-Letter Queue (dlqQueue) + MongoDB DLQ Audit Trail]
                   │
                   ▼ (1-Click Re-queue)
         [Admin DLQ Panel & Concurrency Dashboard]
```

---

## 📦 Project Structure

```
taskorbit/
├── docker-compose.yml             # Single-command Redis 7 + MongoDB 7 services
├── README.md                      # Comprehensive documentation
├── backend/
│   ├── .env.example               # Backend environment templates
│   ├── .env                       # Pre-configured environment file
│   ├── package.json               # Backend dependencies & npm scripts
│   ├── scripts/
│   │   └── test-queue-system.js   # Automated integration test suite
│   └── src/
│       ├── app.js                 # Express app configuration & middlewares
│       ├── server.js              # Dedicated API Server entry point
│       ├── config/
│       │   ├── db.js              # MongoDB Mongoose connection
│       │   └── redis.js           # IORedis configuration (maxRetriesPerRequest: null)
│       ├── models/
│       │   ├── User.js            # User model with bcrypt & RBAC roles
│       │   └── JobLog.js          # Audit trail, status, progress & DLQ flags
│       ├── middlewares/
│       │   ├── auth.js            # JWT verification & RBAC middleware
│       │   └── errorHandler.js    # Global error response handler
│       ├── queues/
│       │   └── taskQueue.js       # BullMQ taskQueue, dlqQueue & QueueEvents
│       ├── workers/
│       │   ├── taskWorker.js      # Multi-stage task processor & DLQ movement logic
│       │   └── worker.js          # Dedicated Worker Process entry point
│       ├── controllers/
│       │   ├── authController.js  # HttpOnly cookie JWT authentication
│       │   ├── jobController.js   # 202 Accepted creation & SSE streaming
│       │   └── adminController.js # DLQ inspection, re-queueing & queue metrics
│       └── routes/
│           ├── authRoutes.js      # /api/auth routes
│           ├── jobRoutes.js       # /api/jobs routes
│           └── adminRoutes.js     # /api/admin RBAC protected routes
└── frontend/
    ├── package.json               # Frontend dependencies (React, Vite, Lucide, Tailwind)
    ├── vite.config.js             # Vite configuration with /api proxy to port 5000
    ├── tailwind.config.js         # Tailwind CSS styling setup
    ├── index.html                 # Single page application entry
    └── src/
        ├── api.js                 # Unified fetch API client with credentials: include
        ├── context/
        │   └── AuthContext.jsx    # Authentication & 1-click sandbox logins
        ├── hooks/
        │   └── useJobSSE.js       # Custom native EventSource SSE hook
        ├── components/
        │   ├── Navbar.jsx         # Live Redis/Mongo health telemetry & role indicator
        │   ├── JobTriggerModal.jsx# Task launcher with failure simulation toggle
        │   ├── ActiveJobsList.jsx # Live SSE progress bars & event logs
        │   ├── JobHistoryTable.jsx# Paginated historical task audit table
        │   ├── ErrorDrawer.jsx    # Slide-over error diagnostics & stacktrace viewer
        │   ├── AdminDlqPanel.jsx  # DLQ inspection & 1-click re-queue action
        │   └── AuthForms.jsx      # Login / registration view
        ├── App.jsx                # Main application view & state synchronization
        └── main.jsx               # React DOM mounting
```

---

## 🚀 Step-by-Step Setup & Execution

### Step 1: Start Redis & MongoDB

#### Option A: Using Docker (Recommended)
From the `task-queue-platform/` root directory:
```bash
cd "C:\Users\rishi\OneDrive\Desktop\TaskOrbit"
docker compose up -d
```
This spins up:
- **Redis 7** on port `6379`
- **MongoDB 7** on port `27017`

#### Option B: Using Local Native Services
- Start Redis: `redis-server` (or Memurai on Windows)
- Start MongoDB: `mongod`

---

### Step 2: Install Backend Dependencies & Start

1. Navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```

2. Choose how you want to launch the backend:

   **Method 1: Run Both API Server and Worker Node Simultaneously**
   ```bash
   npm run dev
   ```
   *(Uses `concurrently` to run both nodemon watchers in a single terminal)*

   **Method 2: Run in Separate Isolated Terminals (Production Setup)**
   - Terminal 1 (API Server):
     ```bash
     npm run dev:server
     ```
   - Terminal 2 (Worker Node):
     ```bash
     npm run dev:worker
     ```

---

### Step 3: Install Frontend Dependencies & Start

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. Open your browser at **`http://localhost:5173`**.

---

## 🧪 Testing the Platform Features

### 1. Instant 1-Click Sandbox Login
On the login screen, click:
- **"Admin Role"** $\rightarrow$ Logs in as `admin@enterprise.local` with full DLQ privileges.
- **"Standard User"** $\rightarrow$ Logs in as `developer@enterprise.local` for task creation.

### 2. Happy-Path Asynchronous Execution
1. Click **"Dispatch Task"** in the top navigation.
2. Select **"PDF Generator"** (50 Pages).
3. Leave "Simulate Gateway Failure" unchecked.
4. Click **"Dispatch to Queue (HTTP 202)"**.
5. Observe:
   - The API immediately responds with **HTTP 202 Accepted**.
   - An active task card appears with an animated progress bar.
   - The SSE stream delivers updates at **20%**, **50%**, **80%**, and **100%**.
   - Upon completion, a direct asset download link is provided.

### 3. Testing Exponential Backoff & Dead-Letter Queue (DLQ)
1. Click **"Dispatch Task"**.
2. Select **"Webhook Dispatch"**.
3. **Check the box: "Simulate Gateway Failure (Test Exponential Backoff & DLQ)"**.
4. Click **"Dispatch to Queue"**.
5. Observe:
   - **Attempt 1**: Fails immediately.
   - **Exponential Backoff 1**: BullMQ waits **2 seconds** before Attempt 2.
   - **Attempt 2**: Fails.
   - **Exponential Backoff 2**: BullMQ waits **4 seconds** before Attempt 3.
   - **Attempt 3**: Fails.
   - **DLQ Quarantine**: All 3 retries are exhausted. The worker moves the job to `dlqQueue` and marks it in MongoDB as `isDlq: true`.
6. Open the **"DLQ Panel"** tab:
   - View the quarantined task with its failure reason.
   - Click **"Diagnostics"** to view the full stack trace in the error drawer.
   - Click **"Re-queue"**: The job is re-submitted with fresh attempts and successfully processed!

---

## ⚡ Automated CLI Integration Test Suite

You can also verify the entire pipeline (Queue $\rightarrow$ Worker $\rightarrow$ SSE events $\rightarrow$ Backoff $\rightarrow$ DLQ) directly from the terminal without opening a browser:

```bash
cd backend
node scripts/test-queue-system.js
```

---

## 🔒 Security & Concurrency Design Highlights

1. **BullMQ `maxRetriesPerRequest: null`**:
   IORedis is configured with `maxRetriesPerRequest: null` as strictly mandated by BullMQ to allow non-blocking Redis commands (`BRPOPLPUSH`) without connection resets.
2. **HttpOnly Cookie Authentication**:
   JWT tokens are stored in `HttpOnly`, `SameSite: Lax` secure cookies, mitigating XSS token theft.
3. **Resilient SSE Streaming**:
   `GET /api/jobs/progress/:jobId` sets `X-Accel-Buffering: no`, sends an immediate database snapshot upon initial connection, streams BullMQ `QueueEvents`, and dispatches a `: ping\n\n` heartbeat every 15 seconds to prevent proxy timeouts.

