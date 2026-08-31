# STREAM CORPORATION — Ops Deck
> **// Unified UID Access Engine (v7.0 Ops Deck)**

A high-fidelity, production-grade recreation of the **Stream Corporation Ops Deck** license and access control panel.

---

## ⚡ Overview & Feature Highlights

- **Unified Auto-Detect Access Terminal**: Single login input that intelligently authenticates Master Administrators, Resellers (Sub-Admins), and Fetchers without manual role toggling.
- **Hardware-Inspired Dark Interface**: Custom styling, ambient particle background engine, glowing radial auras, IBM Plex and Space Grotesk typography, and tier-coded signal colors:
  - 🟧 **Master Admin**: Amber (`#ff8b3d`)
  - 🟩 **Reseller**: Teal (`#2dd4bf`)
  - 🟪 **Fetcher**: Violet (`#a78bfa`)
- **Master Admin Operations**:
  - **UID Vault**: Create, 24-hour instant activate, renew, filter, search, copy, and revoke stream licenses with real-time expiration badges.
  - **Reseller Management**: Create sub-admins, allocate circulating credits, manage credit audit history.
  - **Fetcher Management**: Provision automated workers with fixed validity durations per UID.
  - **Credit Management**: Circulating credit counters, global audit ledger.
  - **System Settings & Diagnostics**: Master key rotation and MongoDB/server live diagnostics.
- **Reseller Vault**: Dedicated credit-based dashboard for sub-admins with automatic balance deduction, insufficient credit warnings, and owned customer UID management.
- **Fetcher Vault**: Automated fixed-permission workspace for fast UID provisioning and renewal.
- **Dual Persistence Architecture**: Seamless out-of-the-box local JSON storage with optional MongoDB integration via `MONGODB_URI`.

---

## 🚀 Quick Start

### 1. Installation
```bash
# Clone or navigate to the project directory
cd "HTML @"

# Install dependencies
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` (or customize variables):
```env
PORT=3000
MASTER_ADMIN_KEY=STREAM_MASTER_SEC_2026
# MONGODB_URI=mongodb+srv://... (Optional)
```

### 3. Launch Server
```bash
npm start
```
The application will be accessible at `http://localhost:3000`.

### 4. Run Test Suite
```bash
npm test
```

---

## 🔑 Default Credentials (Pre-seeded Demo Accounts)

| Role | Identifier / Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Master Admin** | `STREAM_MASTER_SEC_2026` | *(Leave blank or same key)* | Full system control |
| **Reseller** | `reseller_demo` | `reseller123` | Has 50 initial credits |
| **Fetcher** | `fetcher_demo` | `fetcher123` | Has 30-day fixed validity |

---

## 📡 API Endpoints

### Authentication
- `POST /unified/login` — Auto-detects credentials and returns role session.
- `POST /admin/verify` — Validates Master Admin key.
- `POST /subadmin/login` — Validates Reseller credentials.
- `POST /fetcher/login` — Validates Fetcher credentials.

### Master Admin (`/admin`)
- `GET /admin/list?admin_key=...` — Retrieve all UID licenses.
- `POST /admin/create` — Create & activate UID (supports custom days or 24h instant).
- `POST /admin/update` — Extend UID license expiry.
- `POST /admin/revoke` — Revoke & delete UID.
- `GET /admin/list-subadmins` — List active resellers.
- `POST /admin/create-subadmin` — Create reseller account.
- `POST /admin/give-credits` — Transfer credits to reseller.
- `POST /admin/delete-subadmin` — Remove reseller.
- `GET /admin/list-fetchers` — List active fetchers.
- `POST /admin/create-fetcher` — Create fetcher account.
- `POST /admin/update-fetcher-permission` — Update fetcher validity duration.
- `POST /admin/delete-fetcher` — Remove fetcher.
- `POST /admin/change-key` — Rotate master access key.
- `GET /admin/db-status` — System & database health diagnostic.

### Reseller (`/subadmin`)
- `GET /subadmin/credits` — Query available credit balance.
- `GET /subadmin/list` — List UIDs owned by reseller.
- `POST /subadmin/create` — Provision UID (-1 credit deduction).
- `POST /subadmin/update` — Extend owned UID.
- `POST /subadmin/revoke` — Revoke owned UID.

### Fetcher (`/fetcher`)
- `GET /fetcher/permission` — Query assigned fixed permission days.
- `GET /fetcher/list` — List UIDs created by fetcher.
- `POST /fetcher/create` — Provision UID with fixed validity.
- `POST /fetcher/update` — Extend owned UID with fixed validity.
- `POST /fetcher/revoke` — Revoke owned UID.

---

## 🌐 Cloud Deployment (Render / Railway / Docker)

### Render.com
1. Create a **New Web Service** pointing to this repository.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Add environment variables:
   - `MASTER_ADMIN_KEY`: Your custom secret key.
   - `NODE_ENV`: `production`

---

## 🔒 Security
- All sensitive credentials and secret keys are managed via environment variables.
- Passwords are encrypted using salted bcrypt hashing.
- Role-based server-side authorization protects every endpoint.
- Client session data is decoupled from backend secrets.
