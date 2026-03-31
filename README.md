# 💊 MedCare India — Full Stack App

A complete **mobile-first health companion** for Tamil Nadu with:

- ✅ **Real user login/register** with MySQL database
- ✅ **JWT authentication** (token stored in browser)
- ✅ **Email + SMS medicine reminders** (Gmail + Twilio)
- ✅ **AI Medical Assistant** (Anthropic Claude, streamed)
- ✅ **Medicine info, nearby hospitals, doctor finder**
- ✅ **Deployable** to GitHub Pages (frontend) + Railway (backend)

---

## 📁 Project Structure

```
medcare/
├── frontend/          ← Static HTML/CSS/JS — deploy to GitHub Pages
│   ├── login.html     ← Register & Sign In page
│   └── index.html     ← Main app (all features)
│
└── backend/           ← Node.js + Express — deploy to Railway
    ├── server.js      ← Main server (auth, reminders, AI proxy)
    ├── schema.sql     ← MySQL table definitions
    ├── package.json
    ├── .env.example   ← Copy to .env and fill credentials
    └── .gitignore
```

---

## 🚀 Quick Start (Local)

### 1. Set up MySQL

```bash
# Open MySQL shell
mysql -u root -p

# Run the schema (or server.js auto-creates tables)
source /path/to/medcare/backend/schema.sql
```

### 2. Start the Backend

```bash
cd backend
cp .env.example .env       # fill in your credentials
npm install
npm run dev                # starts on http://localhost:3001
```

### 3. Open the Frontend

Open `frontend/login.html` in a browser using Live Server (VS Code extension) or:

```bash
cd frontend
npx serve .                # http://localhost:3000
```

The frontend auto-detects `localhost` and calls `http://localhost:3001`.

---

## 🌐 Deploy to Production

### Frontend → GitHub Pages

1. Push the `frontend/` folder to a GitHub repo
2. Go to **Settings → Pages → Deploy from branch → main / root**
3. Your app will be live at `https://yourusername.github.io/medcare/frontend/login.html`

### Backend → Railway

1. Push the `backend/` folder to a **separate** GitHub repo (or subfolder)
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Add a **MySQL** plugin in Railway (it auto-sets `MYSQLDATABASE`, `MYSQLHOST`, etc.)
4. Add these **environment variables** in Railway dashboard:

| Variable | Value |
|---|---|
| `DB_HOST` | `${{MYSQLHOST}}` |
| `DB_PORT` | `${{MYSQLPORT}}` |
| `DB_USER` | `${{MYSQLUSER}}` |
| `DB_PASS` | `${{MYSQLPASSWORD}}` |
| `DB_NAME` | `${{MYSQLDATABASE}}` |
| `JWT_SECRET` | your long random string |
| `GMAIL_USER` | your Gmail address |
| `GMAIL_PASS` | Gmail App Password (16 chars) |
| `TWILIO_SID` | from Twilio console |
| `TWILIO_AUTH_TOKEN` | from Twilio console |
| `TWILIO_PHONE` | your Twilio number |
| `ANTHROPIC_API_KEY` | from console.anthropic.com |
| `ALLOWED_ORIGINS` | your GitHub Pages URL |

5. Railway gives you a URL like `https://medcare-abc123.up.railway.app`

### Connect Frontend to Deployed Backend

In `frontend/login.html` and `frontend/index.html`, find this line:

```js
const API = (window.location.hostname === 'localhost' ...)
  ? 'http://localhost:3001'
  : (window.BACKEND_URL || 'https://your-railway-app.up.railway.app');
```

Replace `https://your-railway-app.up.railway.app` with your actual Railway URL.

Or add a `config.js` file:

```js
// frontend/config.js
window.BACKEND_URL = 'https://your-actual-railway-url.up.railway.app';
```

And add `<script src="config.js"></script>` before the closing `</body>` in both HTML files.

---

## 🔐 Authentication Flow

```
User → login.html → POST /api/auth/register  →  MySQL users table
User → login.html → POST /api/auth/login     →  Returns JWT token
JWT stored in localStorage → sent as Bearer token with every request
Backend verifies JWT on every protected route
```

---

## 📬 Setting Up Gmail App Password

1. Enable **2-Step Verification** on your Gmail
2. Go to: **Google Account → Security → App Passwords**
3. Select **Mail** → Generate
4. Copy the 16-character code → paste as `GMAIL_PASS` in `.env`

---

## 📱 Setting Up Twilio SMS

1. Sign up at [twilio.com](https://twilio.com) (free trial available)
2. Get your **Account SID** and **Auth Token** from the Console
3. Buy a phone number (or use trial number)
4. Add to `.env`: `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`

> **Note:** Twilio trial accounts can only send SMS to verified numbers.
> Upgrade to a paid account for unrestricted India SMS delivery.

---

## 🤖 AI Medical Assistant

The AI chat uses **Anthropic Claude** (claude-sonnet-4). The API key is stored **only on the backend** — never exposed to the browser. The frontend calls `/api/ai/chat` which proxies to Anthropic with server-side streaming.

---

## 🏥 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Login, get JWT |
| GET | `/api/reminders` | ✅ | List user's reminders |
| POST | `/api/reminder/schedule` | ✅ | Add reminder (with email/SMS) |
| DELETE | `/api/reminder/:id` | ✅ | Cancel reminder |
| POST | `/api/ai/chat` | ✅ | AI chat (streamed) |
| POST | `/api/test/email` | ✅ | Send test email |
| POST | `/api/test/sms` | ✅ | Send test SMS |
| GET | `/api/health` | ❌ | Server health check |

---

## ⚠️ Disclaimer

MedCare India is for **informational purposes only**. Always consult a qualified doctor for medical decisions. Tamil Nadu Emergency: **108**.
