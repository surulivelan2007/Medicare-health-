/**
 * MedCare India — Backend Server
 * ================================
 * Stack: Express · MySQL2 · JWT · Bcrypt · Nodemailer · Twilio · node-cron
 *
 * Features:
 *   • User registration & login (JWT auth, bcrypt passwords)
 *   • MySQL database (users + reminders tables)
 *   • Daily Email + SMS reminders via cron (IST timezone)
 *   • Anthropic AI proxy (keeps API key server-side)
 *   • CORS-enabled for GitHub Pages / Railway frontend
 *
 * Setup:
 *   1. cp .env.example .env  →  fill in credentials
 *   2. npm install
 *   3. node server.js  (or: npm run dev)
 *
 * Deploy to Railway:
 *   - Push this backend/ folder to GitHub
 *   - New Railway project → Deploy from GitHub
 *   - Add environment variables in Railway dashboard
 */

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const mysql        = require('mysql2/promise');
const cron         = require('node-cron');
const nodemailer   = require('nodemailer');
const twilio       = require('twilio');
const { v4: uuidv4 } = require('uuid');
const Anthropic    = require('@anthropic-ai/sdk');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS — allow frontend (GitHub Pages, localhost, Railway) ──────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ════════════════════════════════════════════════════════════════
// DATABASE
// ════════════════════════════════════════════════════════════════

let db; // MySQL connection pool

async function initDB() {
  db = await mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASS     || '',
    database: process.env.DB_NAME     || 'medcare_india',
    waitForConnections: true,
    connectionLimit: 10,
  });

  // Create tables if they don't exist
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(120)  NOT NULL,
      email       VARCHAR(255)  NOT NULL UNIQUE,
      phone       VARCHAR(15)   NOT NULL UNIQUE,
      password    VARCHAR(255)  NOT NULL,
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reminders (
      id             VARCHAR(36)  PRIMARY KEY,
      user_id        INT          NOT NULL,
      medicine_name  VARCHAR(200) NOT NULL,
      when_to_take   VARCHAR(100) NOT NULL,
      time_hhmm      VARCHAR(5)   NOT NULL,
      time_display   VARCHAR(20)  NOT NULL,
      session        VARCHAR(20)  DEFAULT 'morning',
      notify_email   TINYINT(1)   DEFAULT 0,
      notify_sms     TINYINT(1)   DEFAULT 0,
      email          VARCHAR(255),
      phone          VARCHAR(15),
      active         TINYINT(1)   DEFAULT 1,
      created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4;
  `);

  console.log('✅ Database connected & tables ready.');
}

// ════════════════════════════════════════════════════════════════
// EMAIL & SMS
// ════════════════════════════════════════════════════════════════

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendEmail({ to, medicineName, whenToTake, timeStr, userName }) {
  const html = `
  <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#F0F4F8;padding:24px;border-radius:16px;">
    <div style="background:linear-gradient(135deg,#1565C0,#1976D2);border-radius:12px;padding:24px;text-align:center;color:#fff;margin-bottom:20px;">
      <div style="font-size:40px;margin-bottom:8px;">💊</div>
      <h1 style="margin:0;font-size:22px;">MedCare India</h1>
      <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">Medicine Reminder Alert</p>
    </div>
    <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #E0E7EF;">
      <h2 style="color:#1565C0;margin:0 0 12px;font-size:18px;">⏰ Time to take your medicine, ${userName || 'friend'}!</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="border-bottom:1px solid #F5F5F5;"><td style="padding:9px 0;color:#888;font-weight:600;">Medicine</td><td style="padding:9px 0;font-weight:700;color:#1a1a2e;">${medicineName}</td></tr>
        <tr style="border-bottom:1px solid #F5F5F5;"><td style="padding:9px 0;color:#888;font-weight:600;">When</td><td style="padding:9px 0;font-weight:700;color:#1a1a2e;">${whenToTake}</td></tr>
        <tr><td style="padding:9px 0;color:#888;font-weight:600;">Scheduled Time</td><td style="padding:9px 0;font-weight:700;color:#1565C0;">${timeStr} IST</td></tr>
      </table>
    </div>
    <p style="text-align:center;font-size:11px;color:#888;margin-top:16px;">⚠️ Always follow your doctor's prescription.<br>Tamil Nadu Health Emergency: <b>108</b></p>
  </div>`;
  await mailer.sendMail({
    from: `"MedCare India 💊" <${process.env.GMAIL_USER}>`,
    to, subject: `💊 Reminder: Take ${medicineName} — ${timeStr}`, html,
  });
}

async function sendSMS({ to, medicineName, whenToTake, timeStr }) {
  let phone = to.replace(/\s+/g, '');
  if (phone.startsWith('0')) phone = '+91' + phone.slice(1);
  if (!phone.startsWith('+')) phone = '+91' + phone;
  await twilioClient.messages.create({
    body: `💊 MedCare Reminder\nTake: ${medicineName}\nWhen: ${whenToTake}\nTime: ${timeStr} IST\n\nStay healthy! - MedCare India\nEmergency: 108`,
    from: process.env.TWILIO_PHONE,
    to: phone,
  });
}

// ── Active cron jobs map ──────────────────────────────────────────
const cronJobs = new Map(); // reminderId → cronJob

function scheduleCron(reminder) {
  const [h, m] = reminder.time_hhmm.split(':');
  const cronExpr = `${parseInt(m)} ${parseInt(h)} * * *`;
  const job = cron.schedule(cronExpr, async () => {
    console.log(`[CRON] Firing: ${reminder.medicine_name} for user ${reminder.user_id}`);
    const promises = [];
    if (reminder.notify_email && reminder.email) {
      promises.push(
        sendEmail({ to: reminder.email, medicineName: reminder.medicine_name, whenToTake: reminder.when_to_take, timeStr: reminder.time_display, userName: reminder.user_name })
          .then(() => console.log(`  ✅ Email → ${reminder.email}`))
          .catch(e  => console.error(`  ❌ Email error:`, e.message))
      );
    }
    if (reminder.notify_sms && reminder.phone) {
      promises.push(
        sendSMS({ to: reminder.phone, medicineName: reminder.medicine_name, whenToTake: reminder.when_to_take, timeStr: reminder.time_display })
          .then(() => console.log(`  ✅ SMS → ${reminder.phone}`))
          .catch(e  => console.error(`  ❌ SMS error:`, e.message))
      );
    }
    await Promise.all(promises);
  }, { timezone: 'Asia/Kolkata' });

  cronJobs.set(reminder.id, job);
}

// Load existing active reminders from DB on startup
async function loadActiveReminders() {
  try {
    const [rows] = await db.execute(`
      SELECT r.*, u.name AS user_name FROM reminders r
      JOIN users u ON r.user_id = u.id
      WHERE r.active = 1
    `);
    rows.forEach(r => scheduleCron(r));
    console.log(`✅ Loaded ${rows.length} active reminder(s) from database.`);
  } catch(e) {
    console.error('Failed to load reminders:', e.message);
  }
}

// ════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ════════════════════════════════════════════════════════════════

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised. Please log in.' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'medcare_secret_change_me');
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// ════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 * Body: { name, email, phone, password }
 */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password)
    return res.status(400).json({ error: 'All fields are required.' });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address.' });

  if (!/^[6-9]\d{9}$/.test(phone))
    return res.status(400).json({ error: 'Invalid Indian mobile number.' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), phone.trim(), hashed]
    );
    res.json({ success: true, message: 'Account created successfully. Please sign in.' });
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') {
      const field = e.message.includes('email') ? 'email' : 'mobile number';
      return res.status(409).json({ error: `This ${field} is already registered.` });
    }
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 * Body: { identifier (email or phone), password }
 */
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.status(400).json({ error: 'Please enter your mobile/email and password.' });

  try {
    // Allow login with either email or phone
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [identifier.toLowerCase().trim(), identifier.trim()]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'No account found. Please register first.' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'medcare_secret_change_me',
      { expiresIn: '30d' }
    );

    // Don't send password back
    const { password: _, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch(e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ════════════════════════════════════════════════════════════════
// REMINDER ROUTES  (all require auth)
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/reminder/schedule
 */
app.post('/api/reminder/schedule', requireAuth, async (req, res) => {
  const { medicineName, whenToTake, time, email, phone, notify = [], session = 'morning' } = req.body;

  if (!medicineName || !time)
    return res.status(400).json({ error: 'medicineName and time are required.' });

  const [h, m] = time.split(':');
  const hour = parseInt(h), min = parseInt(m);
  const hr12 = hour % 12 || 12;
  const timeDisplay = `${hr12}:${m.padStart(2,'0')} ${hour >= 12 ? 'PM' : 'AM'}`;

  const id = uuidv4();
  const notifyEmail = notify.includes('email') ? 1 : 0;
  const notifySms   = notify.includes('sms')   ? 1 : 0;

  try {
    await db.execute(
      `INSERT INTO reminders (id, user_id, medicine_name, when_to_take, time_hhmm, time_display, session, notify_email, notify_sms, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, medicineName, whenToTake, time, timeDisplay, session, notifyEmail, notifySms, email||null, phone||null]
    );

    // Schedule cron
    scheduleCron({
      id, user_id: req.user.id, medicine_name: medicineName, when_to_take: whenToTake,
      time_hhmm: time, time_display: timeDisplay, notify_email: notifyEmail,
      notify_sms: notifySms, email: email||null, phone: phone||null, user_name: req.user.name,
    });

    console.log(`[NEW] Reminder scheduled: ${medicineName} @ ${timeDisplay} (user ${req.user.id})`);
    res.json({ success: true, id, message: `Reminder set for ${medicineName} daily at ${timeDisplay} IST.` });
  } catch(e) {
    console.error('Schedule error:', e.message);
    res.status(500).json({ error: 'Could not save reminder.' });
  }
});

/**
 * GET /api/reminders — list user's reminders
 */
app.get('/api/reminders', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, medicine_name, when_to_take, time_display, session, notify_email, notify_sms, created_at FROM reminders WHERE user_id = ? AND active = 1 ORDER BY time_hhmm',
      [req.user.id]
    );
    res.json({ success: true, count: rows.length, reminders: rows });
  } catch(e) {
    res.status(500).json({ error: 'Could not fetch reminders.' });
  }
});

/**
 * DELETE /api/reminder/:id
 */
app.delete('/api/reminder/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM reminders WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Reminder not found.' });

    await db.execute('UPDATE reminders SET active = 0 WHERE id = ?', [id]);

    const job = cronJobs.get(id);
    if (job) { job.stop(); cronJobs.delete(id); }

    res.json({ success: true, message: `Reminder cancelled.` });
  } catch(e) {
    res.status(500).json({ error: 'Could not cancel reminder.' });
  }
});

// ════════════════════════════════════════════════════════════════
// AI PROXY  (Anthropic API — key stays server-side)
// ════════════════════════════════════════════════════════════════

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * POST /api/ai/chat
 * Body: { system, messages: [{role, content}] }
 * Streams SSE back to client
 */
app.post('/api/ai/chat', requireAuth, async (req, res) => {
  const { system, messages } = req.body;
  if (!messages || !Array.isArray(messages))
    return res.status(400).json({ error: 'messages array is required.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: system || 'You are a helpful medical assistant for India.',
      messages,
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { text } })}\n\n`);
    });

    stream.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (e) => {
      console.error('AI stream error:', e.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
      res.end();
    });
  } catch(e) {
    console.error('AI error:', e.message);
    res.status(500).json({ error: 'AI service unavailable.' });
  }
});

// ════════════════════════════════════════════════════════════════
// TEST ROUTES
// ════════════════════════════════════════════════════════════════

app.post('/api/test/email', requireAuth, async (req, res) => {
  const { email, medicineName = 'Metformin 500mg' } = req.body;
  if (!email) return res.status(400).json({ error: 'email required.' });
  try {
    await sendEmail({ to: email, medicineName, whenToTake: 'After breakfast', timeStr: 'Test — Right Now', userName: req.user.name });
    res.json({ success: true, message: `Test email sent to ${email}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/test/sms', requireAuth, async (req, res) => {
  const { phone, medicineName = 'Metformin 500mg' } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required.' });
  try {
    await sendSMS({ to: phone, medicineName, whenToTake: 'After breakfast', timeStr: 'Test — Right Now' });
    res.json({ success: true, message: `Test SMS sent to ${phone}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'MedCare India Backend', time: new Date().toISOString(), activeJobs: cronJobs.size });
});

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// ════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════

(async () => {
  try {
    await initDB();
    await loadActiveReminders();
    app.listen(PORT, () => {
      console.log(`\n🚀 MedCare India Backend running on http://localhost:${PORT}`);
      console.log(`   Health:  http://localhost:${PORT}/api/health\n`);
    });
  } catch(e) {
    console.error('❌ Startup failed:', e.message);
    process.exit(1);
  }
})();
