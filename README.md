# Moderation AI Content Moderation Platform

A full-stack content moderation app built for a technical assessment. Users submit images, Moderation AI screens them against a configurable policy, and admins manage verdicts, appeals, and thresholds.

**Live demo:** [your-app.onrender.com](https://your-app.onrender.com) *(update after deploy)*

---

## What it does

- Users upload images → Moderation AI screens each one across 6 content categories
- Each image gets a verdict: **Approved**, **Flagged for Review**, or **Blocked**
- Users can appeal flagged/blocked verdicts with a written justification
- Admins review appeals, configure category thresholds, and view platform analytics
- Images are stored on **Cloudinary**; metadata and verdicts go to **MongoDB Atlas**

### Moderation categories

| Category | What it catches |
|---|---|
| Graphic Violence | Gore, serious injury |
| Hate Symbols | Extremist imagery |
| Self-Harm | Self-inflicted injury depictions |
| Extremist Propaganda | Violent extremist content |
| Weapons & Contraband | Illegal weapons, drug trafficking |
| Harassment & Humiliation | Content targeting an individual |

---

## Tech stack

| Layer | What |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | MongoDB Atlas (free tier) |
| Image storage | Cloudinary (free tier) |
| AI | Google AI Studio model (`gemini-3.1-flash-lite`) |
| AI orchestration | LangChain |
| Auth | JWT  |
| Deployment | Render backend + Vercel frontend |

---

## Local setup

### Prerequisites

- Docker + Docker Compose
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster
- A free [Cloudinary](https://cloudinary.com) account
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key (free tier)

### 1. Clone and configure

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your actual values:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/moderation_platform
JWT_SECRET=a-long-random-string-you-generated
GOOGLE_API_KEY=your-google-ai-studio-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
BOOTSTRAP_ADMIN_EMAIL=you@example.com
CORS_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
```

> **Generate a JWT secret:**
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

### 2. Run

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 3. Create your admin account

Register at `/register` using the email you set in `BOOTSTRAP_ADMIN_EMAIL`. That account automatically gets the admin role. After that, clear `BOOTSTRAP_ADMIN_EMAIL` from your `.env` so nobody else can claim admin.

---

## Deploying to Render

This app runs as two separate Render services (backend + frontend) plus MongoDB Atlas and Cloudinary for persistence.

### Step 1 — MongoDB Atlas

1. Create a free M0 cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user and copy the connection string
3. In **Network Access**, add `0.0.0.0/0` to allow Render's IPs

### Step 2 — Backend (Web Service)

| Setting | Value |
|---|---|
| Runtime | Python 3 |
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Add these environment variables in the Render dashboard:

```
MONGODB_URI         = your Atlas connection string
JWT_SECRET          = your generated secret
GOOGLE_API_KEY      = your Google AI Studio key
CLOUDINARY_CLOUD_NAME = ...
CLOUDINARY_API_KEY    = ...
CLOUDINARY_API_SECRET = ...
CORS_ORIGINS        = https://your-frontend.onrender.com
BOOTSTRAP_ADMIN_EMAIL = you@example.com
```

### Step 3 — Frontend (Vercel Static Site)

Use these settings in Vercel:

- Framework preset: Vite
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Output directory: `dist`

Add this environment variable:

```
VITE_API_URL = https://your-backend.onrender.com
```

### Step 4 — Update CORS

Once you have both Render URLs, go back to the backend service and update `CORS_ORIGINS` to include the real frontend URL.

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs. Keep this private. |
| `JWT_EXPIRE_MINUTES` | No | Session length in minutes (default: 60) |
| `GOOGLE_API_KEY` | Yes | Google AI Studio API key used by the moderation model |
| `GEMINI_MODEL` | No | Model name (default: `gemini-2.0-flash-lite`) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `BOOTSTRAP_ADMIN_EMAIL` | No | Email that gets admin on first registration |
| `MAX_UPLOAD_SIZE_MB` | No | Per-file upload limit (default: 10) |

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── auth/           # JWT creation + validation, route dependencies
│   │   ├── models/         # Pydantic models for users, submissions, verdicts
│   │   ├── routers/        # FastAPI route handlers
│   │   └── services/       # Business logic: AI screening, Cloudinary, MongoDB
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/            # Axios client + per-resource fetch functions
│       ├── components/     # Sidebar, TopBar, badges, spinners
│       ├── context/        # Auth state + JWT expiry logic
│       └── pages/          # One file per route
├── docker-compose.yml
└── README.md
```

---

## Key architecture decisions

**Why Cloudinary instead of storing images in MongoDB?**
MongoDB Atlas free tier has a 512 MB storage cap. Even small images would hit that quickly. Cloudinary's free tier gives 25 GB of storage and handles delivery, so images never touch the database.

**Why sync model calls instead of a background queue?**
For this scale (one user, recruiter demo) it's fine. The tradeoff is that the submit endpoint blocks until the moderation model responds (~2–5 seconds). A real production system would use Celery or FastAPI background tasks and return a job ID immediately.

**Why JWT stored in localStorage instead of httpOnly cookies?**
Simpler to implement for a demo, and the app doesn't handle sensitive PII. For production, httpOnly cookies with CSRF protection would be the right call.

**Admin role bootstrapping**
There's no admin panel to promote users. The first person to register with `BOOTSTRAP_ADMIN_EMAIL` gets `role=admin`. After that, role changes require a direct MongoDB update. Good enough for a single-admin setup.

---

## Known limitations

- No rate limiting on the API — a bad actor could drain your model quota
- No image size validation on the frontend (10 MB cap is only enforced server-side)
- Model calls are synchronous — slow responses block the request thread
- No refresh token — sessions expire after 60 minutes and require re-login
- No email verification on registration

---

## License

MIT
