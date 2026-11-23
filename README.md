# Flow Session Share & Video Studio – Chrome Extension & Admin Gateway

A modern, enterprise-grade Chrome Extension (Manifest V3) and backend authentication gateway for **YouTube Automation & AI Video Creation**:
- **Admin Control Panel (`/admin`):** The administrator creates user accounts and manages the centralized video creation session/cookies that all users share.
- **Creator Chrome Extension:** A clean, focused login interface where team members sign in using the credentials created in the Admin Panel.
- **Instant Video Studio Access (`/studio`):** Upon login, the extension automatically injects the authorized session and redirects users straight to the **Flow Video Creation Screen** (AI script generation, storyboard breakdown, render preview, and YouTube publishing queue).

---

## 1. Architectural Highlights & Security Philosophy

### The Insecurity of Raw Cookie Dumping
Traditional or naive session-sharing extensions often attempt to scrape cookies (`chrome.cookies.getAll`) and send them in plain or weakly encrypted format to another user. This approach has critical security flaws:
- **Exposes Master Credentials:** Transmits long-lived master session identifiers, account takeover risks, and persistent login tokens.
- **Bypasses Security Boundaries:** Violates browser security boundaries, browser same-site restrictions, and HttpOnly defenses.
- **No Revocation Control:** Once an attacker or untrusted recipient has raw cookies, the original owner cannot revoke their access without invalidating their own entire account login session.
- **Zero Scope Isolation:** A shared raw cookie grants full unconstrained access to everything in the account (billing, passwords, settings).

### Flow Session Share: Controlled Session Delegation Architecture
Instead of cookie dumping, **Flow Session Share** implements a secure, cryptographically verifiable session delegation model:
1. **Client-Side End-to-End Encryption (AES-GCM-256):**
   - The extension uses the browser's native **Web Crypto API** (`crypto.subtle`) to generate a unique 256-bit symmetric encryption key on the client machine.
   - The session parameters are encrypted locally before transmission.
   - The decryption key is embedded solely into the invitation URL **hash fragment** (`#key=...`) or QR code. Because URL fragments are never sent to the server in HTTP requests, the backend operates in a **zero-knowledge capacity** regarding the client decryption key.
2. **Single-Use, Cryptographically Hashed Invitation Tokens:**
   - Invitation tokens are generated using high-entropy random bytes.
   - Only the **SHA-256 hash** of the token is stored in the database. If the database is ever compromised, active tokens cannot be read.
3. **Scoped Ephemeral Session Grants (RFC 8693):**
   - When a recipient claims an invitation, the Flow Authentication Gateway issues a scoped, short-lived Delegated Session Token (signed JWT) bound to the target domain, grantor ID, recipient ID, and expiration timestamp.
4. **Instant Real-Time Revocation:**
   - The session owner can click **"Revoke Access"** at any moment in the Chrome extension popup.
   - Revocation immediately invalidates the database grant and broadcasts a real-time Server-Sent Event (SSE) to terminate the recipient's active session within seconds.
5. **Full Audit Logging:**
   - Every lifecycle event (`CREATED`, `CLAIMED`, `REVOKED`, `ACCESS_GATEWAY`, `EXPIRED`) is immutably recorded with actor identity, IP address, user agent, and timestamp.

---

## 2. Technical Stack

| Layer | Technologies |
|---|---|
| **Chrome Extension** | Manifest V3, React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons, QRCode.js |
| **Cryptography** | Web Crypto API (AES-GCM-256, PBKDF2/SHA-256), Cryptographic Random Nonces |
| **Backend API** | Node.js (v20+), Express.js (ES Modules, TypeScript), JWT Delegation Engine |
| **Database** | PostgreSQL 16 (Production) with Automated SQLite Zero-Config Local Fallback |
| **Real-time Protocol** | Server-Sent Events (SSE) for instant cross-device revocation and claim alerts |
| **DevOps** | Docker, Docker Compose, Multi-stage Dockerfile |

---

## 3. Project Structure

```
├── backend/
│   ├── database/
│   │   ├── schema.sql                 # PostgreSQL DDL schema & indexes
│   │   └── flow_sessions.sqlite       # Local auto-fallback database (if PostgreSQL inactive)
│   ├── src/
│   │   ├── config/
│   │   │   └── db.ts                  # PostgreSQL connection pool & SQLite transparent fallback
│   │   ├── controllers/
│   │   │   ├── session.controller.ts  # Share, Claim, Revoke, Active Shares, Audit
│   │   │   └── gateway.controller.ts  # Token delegation & gateway verification
│   │   ├── routes/
│   │   │   ├── session.routes.ts      # REST API endpoints
│   │   │   ├── gateway.routes.ts      # Gateway verification endpoints
│   │   │   └── demo.routes.ts         # Acme Cloud Analytics demo protected app
│   │   ├── services/
│   │   │   ├── audit.service.ts       # Audit logging service
│   │   │   ├── notification.service.ts# SSE real-time notifications
│   │   │   └── token.service.ts       # Token hashing, PBKDF2, JWT issuance
│   │   ├── test-e2e.ts                # Automated end-to-end integration test suite
│   │   └── index.ts                   # Express server entry point
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── extension/
│   ├── public/
│   │   ├── icons/                     # Extension icons (16px, 48px, 128px)
│   │   └── manifest.json              # Chrome Manifest V3 configuration
│   ├── src/
│   │   ├── background/
│   │   │   └── background.ts          # MV3 Service Worker (session injection & alerts)
│   │   ├── content/
│   │   │   └── content.ts             # Content script for target web pages
│   │   ├── popup/
│   │   │   ├── components/
│   │   │   │   ├── Header.tsx         # Header & gateway live status
│   │   │   │   ├── ShareScreen.tsx    # Domain detect, scope, expiration, QR/link
│   │   │   │   ├── ReceiveScreen.tsx  # Code verification & session connection
│   │   │   │   ├── ActiveSharesScreen.tsx # Active shares & instant revocation
│   │   │   │   ├── AuditLogScreen.tsx # Security audit trail
│   │   │   │   ├── ConfirmationModal.tsx # Explicit permission confirmation modal
│   │   │   │   └── QRCodeModal.tsx    # Interactive QR code display & download
│   │   │   ├── services/
│   │   │   │   ├── api.service.ts     # Backend API integration
│   │   │   │   └── crypto.service.ts  # Web Crypto API AES-GCM engine
│   │   │   ├── App.tsx                # Popup navigation & tab router
│   │   │   ├── index.html             # Popup entry HTML
│   │   │   └── main.tsx               # React DOM entry
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── package.json
│   └── dist/                          # Production build ready to load unpacked into Chrome!
├── demo-portal/
│   └── index.html                     # Web-based recipient portal & claim interface
├── docker-compose.yml                 # PostgreSQL + Backend container orchestration
└── README.md
```

---

## 4. Quick Start & Installation

### Option A: Local Development (Instant Out-of-the-Box)

The backend includes dual PostgreSQL and local SQLite fallback, allowing immediate testing without configuring a local PostgreSQL instance.

#### 1. Start the Backend API & Gateway
```bash
cd backend
npm install
npm run build
npm start
```
The server will start at `http://localhost:4000`:
- **API Base:** `http://localhost:4000/api/sessions`
- **Gateway Auth:** `http://localhost:4000/api/gateway/verify`
- **Recipient Web Portal:** `http://localhost:4000/portal`
- **Demo Target App:** `http://localhost:4000/demo/app`

#### 2. Run Automated Integration Tests
In a separate terminal:
```bash
cd backend
node dist/test-e2e.js
```
*(Runs 9/9 automated checks validating cryptography, tokens, claims, gateway authorization, and instant revocation.)*

#### 3. Build the Chrome Extension
```bash
cd extension
npm install
npm run build
```
This compiles the production extension into `extension/dist/`.

---

### Option B: Docker Compose (Full PostgreSQL Stack)

To run the complete production stack with a dedicated PostgreSQL 16 container:
```bash
docker compose up --build
```
This automatically boots PostgreSQL, runs `backend/database/schema.sql`, and starts the backend connected via `DATABASE_URL`.

---

## 5. Installing the Extension in Chrome / Brave / Edge

1. Open your Chromium browser (Chrome, Brave, Edge).
2. Navigate to `chrome://extensions/` (or `edge://extensions/`).
3. In the top right corner, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top left.
5. Select the folder:
   `c:\Users\samia\OneDrive\Desktop\kodit\youtube automation\extension\dist`
6. The **Flow Session Share** extension icon will now appear in your browser toolbar!

---

## 6. Complete End-to-End Walkthrough

### Step 1: Open the Target App
1. Open a new tab and navigate to `http://localhost:4000/demo/app`.
2. Notice the page shows **"Authentication Required"** because no session is active.

### Step 2: Share the Session as User A
1. Click the **Flow Session Share** extension icon in your toolbar.
2. The extension auto-detects the active tab domain (`localhost:4000/demo/app`).
3. Select your configuration:
   - **Delegated Scope:** `Full Access` or `Read Only`
   - **Expiration Window:** `5 min`, `30 min`, `1 hour`, or `24 hours`
   - *(Optional)* Recipient Email or 4-digit Passcode.
4. Click **"Generate Secure Invitation"**.
5. An **Explicit Confirmation Modal** will appear detailing the target domain and security guarantees. Click **"Confirm & Share"**.
6. The extension generates:
   - A single-use encrypted invitation URL (with the client decryption key in `#key=...`).
   - An interactive **QR Code** (click the QR icon to view or download).
   - Click **"Copy Invitation Link"**.

### Step 3: Receive and Connect as User B
1. Open the copied invitation URL in an Incognito window or different browser profile (e.g. `http://localhost:4000/portal#token=...&key=...`) or open the extension's **Receive** tab.
2. The portal/extension automatically validates the invitation token and shows the target domain, grantor identity, scope, and live expiration countdown.
3. If a passcode was set, enter the passcode.
4. Click **"Connect to Authorized Session"**.
5. The gateway establishes the authorized delegated grant and provides an **"Open Target Website"** button.
6. Click **"Open Target Website"**. The demo app (`/demo/app`) now displays the **Authorized Workspace** with real-time metrics!

### Step 4: Instant Revocation Test
1. In User A's browser, open the extension popup and click the **Active** tab.
2. Find the active share for `localhost:4000/demo/app` and click **"Revoke Access"**.
3. Return to User B's tab or reload `http://localhost:4000/demo/app`.
4. User B is immediately locked out with **"Access Revoked: The owner has revoked this shared session"**!
5. In the extension popup, click the **Audit** tab to inspect the immutable security trail of the creation, claim, and revocation events.

### Step 5: Centralized Admin Session Manager
1. Navigate to **`http://localhost:4000/admin`** to open the **Admin Control Panel**.
2. Under **Centralized Session Credential Manager**:
   - Update the master session token/cookie credential for the domain or click **Auto-Generate Scoped Token**.
   - Select the scope and duration (e.g. 24 Hours).
   - Click **"Deploy Session Update to All Users"**.
3. In any connected user's Chrome Extension popup, navigate to the **Receive** tab and click:
   **"⚡ Connect to Central Admin Session"**.
4. The extension instantly synchronizes with the updated central session without having to manually share individual invitation links!
5. Click **"Emergency Revoke All Users"** in the Admin Panel to terminate all active sessions instantly.

---

## 7. Separate Extension Files Breakdown

The Chrome extension is organized into standalone, modular files:

### Compiled Files (Ready to Load Unpacked into Chrome: `extension/dist/`)
- **[manifest.json](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/dist/manifest.json):** Manifest V3 definition configuring service worker, permissions (`activeTab`, `storage`, `cookies`, `declarativeNetRequest`), host permissions, and popup window.
- **[background.js](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/dist/assets/background.js):** Background Service Worker that stores active grants in `chrome.storage`, injects delegated session credentials, and listens for real-time SSE revocation alerts.
- **[content.js](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/dist/assets/content.js):** Web page content script that registers incoming delegated sessions with target web apps.
- **[index.html](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/dist/src/popup/index.html):** The popup UI HTML shell.
- **[popup.js](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/dist/assets/popup.js):** The bundled React 18 UI containing the Share, Receive, Active Shares, and Audit Log screens.
- **[popup.css](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/dist/assets/popup.css):** Compiled Tailwind CSS styling.
- **[icons/](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/dist/icons):** Standard extension icons (16px, 48px, 128px).

### Source Code Files (`extension/src/`)
- **[background.ts](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/src/background/background.ts):** TypeScript service worker source.
- **[crypto.service.ts](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/src/popup/services/crypto.service.ts):** Browser Web Crypto API (AES-GCM-256) implementation.
- **[api.service.ts](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/src/popup/services/api.service.ts):** API client connecting extension to the backend gateway.
- **[ShareScreen.tsx](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/src/popup/components/ShareScreen.tsx):** Domain detector, scope selector, expiration selector, QR code & invitation link generator.
- **[ReceiveScreen.tsx](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/src/popup/components/ReceiveScreen.tsx):** Code input, verification, and "Connect to Central Admin Session" button.
- **[ActiveSharesScreen.tsx](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/src/popup/components/ActiveSharesScreen.tsx):** Active shares list with instant revocation buttons.
- **[AuditLogScreen.tsx](file:///c:/Users/samia/OneDrive/Desktop/kodit/youtube%20automation/extension/src/popup/components/AuditLogScreen.tsx):** Cryptographic security audit trail.

---

## 8. PostgreSQL Database Schema

```sql
-- 1. Session Invitations Table
CREATE TABLE session_invitations (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL,
    owner_label VARCHAR(128) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    delegated_scope VARCHAR(64) NOT NULL DEFAULT 'read_write',
    recipient_email VARCHAR(255),
    recipient_passcode_hash VARCHAR(128),
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    encrypted_payload TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'claimed', 'revoked', 'expired'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP WITH TIME ZONE,
    claimed_by VARCHAR(128),
    revoked_at TIMESTAMP WITH TIME ZONE,
    max_uses INT NOT NULL DEFAULT 1,
    use_count INT NOT NULL DEFAULT 0
);

-- 2. Audit Log Table
CREATE TABLE audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    invitation_id VARCHAR(64),
    event_type VARCHAR(64) NOT NULL, -- 'CREATED', 'CLAIMED', 'REVOKED', 'ACCESS_GATEWAY', 'EXPIRED'
    actor_id VARCHAR(128) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Delegated Active Grants (Session Gateway Validation Cache)
CREATE TABLE delegated_session_grants (
    grant_id VARCHAR(64) PRIMARY KEY,
    invitation_id VARCHAR(64) REFERENCES session_invitations(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    grantee_id VARCHAR(128) NOT NULL,
    delegated_token VARCHAR(512) NOT NULL,
    scope VARCHAR(64) NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. API Reference

### `POST /api/sessions/share`
Create a new temporary encrypted session delegation invitation.
- **Request Body:**
  ```json
  {
    "domain": "acme.example.com",
    "delegatedScope": "read_write",
    "expirationMinutes": 30,
    "recipientEmail": "user@example.com",
    "recipientPasscode": "4912",
    "encryptedPayload": "{\"iv\":\"...\",\"ciphertext\":\"...\"}"
  }
  ```
- **Response:** `201 Created` with invitation ID, token, tokenHash, expiresAt, and shareUrl.

### `GET /api/sessions/invitation/:token`
Fetch public metadata for an invitation token without exposing secrets.
- **Response:** Domain, scope, owner label, requiresPasscode boolean, status, encryptedPayload.

### `POST /api/sessions/claim`
Claim an invitation and issue a delegated authorization grant.
- **Request Body:** `{ "token": "...", "recipientId": "...", "passcode": "..." }`
- **Response:** `grantId`, `delegatedToken` (JWT), `domain`, `scope`, `expiresAt`.

### `POST /api/sessions/revoke/:id`
Immediately revoke an active share and invalidate all issued grants.

### `GET /api/sessions/active`
List active shares for the current owner with expiration countdowns.

### `GET /api/sessions/audit-log`
Fetch immutable security audit records.

### `GET /api/gateway/verify?token=...`
Gateway endpoint queried by target web applications to verify delegated sessions.

---

## 9. Security Verification Checklist

- [x] **No Raw Cookie Extraction:** Never exposes or dumps browser master cookies.
- [x] **Client-Side AES-256-GCM:** Native Web Crypto API encryption; server never sees the plaintext decryption key.
- [x] **Token Hashing:** Only SHA-256 token digests are indexed in the database.
- [x] **Single-Use Tokens:** Default single-use invitations expire upon first claim.
- [x] **Explicit Confirmation:** Owner modal prompts user before generating any share.
- [x] **Instant Revocation:** Invalidate grants across connected devices within seconds via SSE.
- [x] **Full Audit Trail:** Every lifecycle step is logged with actor, IP, and timestamp.
