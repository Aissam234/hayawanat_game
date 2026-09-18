# 🐾 لعبة الحيوانات — Animal Guessing Game

**Online Multiplayer Real-Time Arabic Party Game**

اكتشف حيوانك السري قبل خصمك! 🎯

---

## فكرة اللعبة

يلتقي مجموعة من الأصدقاء في غرفة أونلاين. يختار المدير لاعبَيْن. يعطي كل لاعب حيوانًا سريًا مختلفًا يعرفه خصمه لكنه لا يعرفه. يحاول كل لاعب اكتشاف حيوانه بطرح أسئلة يُجاب عنها بـ "نعم" أو "لا".

### القاعدة الأساسية
- **اللاعب 1** يعرف حيوان اللاعب 2 فقط 🐊
- **اللاعب 2** يعرف حيوان اللاعب 1 فقط 🦒
- **الجمهور** يرى الحيوانَيْن
- من يخمّن حيوانه أولاً يفوز! 🏆

---

## Architecture

```
React (Vite + TypeScript + Tailwind)
        |
        | REST API + WebSockets
        |
    FastAPI (Python)
        |
        ├── PostgreSQL (SQLAlchemy + Alembic)
        └── WebSocket ConnectionManager
```

### Security Core
حيوان اللاعب السري **لا يُرسل أبداً** إلى Client الخاص به. كل المقارنات تتم في Backend فقط عبر Role-aware serialization.

---

## Technologies

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Animations | Framer Motion |
| Icons | Lucide React |
| State | Zustand |
| Backend | FastAPI + Python 3.12 |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Real-Time | WebSockets (FastAPI native) |
| Infrastructure | Docker + Docker Compose |

---

## Setup & Running

### Prerequisites
- Docker Desktop installed and running

### Quick Start
```bash
# 1. Clone and enter project
cd hayawanat-game

# 2. Copy environment file
cp .env.example .env

# 3. Build and run
docker compose up --build
```

App will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | DB username | hayawanat |
| `POSTGRES_PASSWORD` | DB password | hayawanat_secret |
| `POSTGRES_DB` | DB name | hayawanat_db |
| `DATABASE_URL` | Full DB connection URL | auto-set |
| `SECRET_KEY` | App secret key | change-me |
| `ALLOWED_ORIGINS` | CORS origins | localhost:5173 |
| `VITE_API_URL` | Backend URL (frontend) | http://localhost:8000 |
| `VITE_WS_URL` | WebSocket URL (frontend) | ws://localhost:8000 |

---

## Project Structure

```
hayawanat-game/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── game/         # QuestionHistory, AnimalSelector, VictoryScreen
│       │   ├── lobby/        # ParticipantList
│       │   └── shared/       # ConnectionStatus
│       ├── pages/            # HomePage, LobbyPage, GamePage
│       ├── services/         # api.ts, websocket.ts
│       ├── store/            # gameStore.ts (Zustand)
│       ├── types/            # game.ts
│       └── utils/            # session.ts
├── backend/
│   └── app/
│       ├── api/              # rooms, rounds, questions, guesses
│       ├── websocket/        # manager, handlers, serializers
│       ├── models/           # SQLAlchemy models
│       ├── schemas/          # Pydantic schemas
│       ├── services/         # room_service, round_service
│       ├── game/             # animals, permissions, engine
│       ├── db/               # session, base
│       └── core/             # config
├── docker-compose.yml
└── .env.example
```

---

## Game Flow

1. 🏠 **Home** — اكتب اسمك، أنشئ أو انضم لغرفة
2. 🚪 **Lobby** — انتظر الأصدقاء، Host يختار اللاعبين والصعوبة
3. 🎮 **Game** — اطرح أسئلة، خمّن قبل خصمك
4. 🏆 **Victory** — كشف الحيوانات وإحصاءات الجولة
5. 🔄 **New Round** — العودة للغرفة وجولة جديدة

---

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `state_sync` | Server→Client | Full state on connect |
| `participant_joined` | Server→Room | New player joined |
| `round_started` | Server→Room | New round (role-aware) |
| `question_submitted` | Server→Room | Player asked a question |
| `answer_submitted` | Server→Room | Opponent answered |
| `wrong_guess` | Server→Room | Wrong guess, continue |
| `round_finished` | Server→Room | Round over with winner |

---

## API Endpoints

```
POST   /api/rooms/                        Create room
POST   /api/rooms/{code}/join             Join room
GET    /api/rooms/{code}                  Get room info
DELETE /api/rooms/{code}/leave            Leave room
POST   /api/rounds/{code}/start           Start round (host only)
GET    /api/rounds/{code}/current         Get current round (role-aware)
GET    /api/rounds/{code}/questions       Get question history
GET    /api/rounds/animals/list           Get all animals for selector
POST   /api/questions/{code}/submit       Submit a question (turn-based)
POST   /api/questions/{id}/answer         Answer a question (opponent only)
POST   /api/guesses/{code}/submit         Submit a guess (backend validates)

WS     /ws/{room_code}/{participant_id}   Real-time connection
```

---

## Animal Dataset

60+ حيوان على 3 مستويات:
- 🐣 **سهل** (15): قطة، كلب، أسد، فيل، دب...
- 🦊 **متوسط** (25): زرافة، دلفين، نمر، طاووس...
- 🦎 **صعب** (20): تمساح، ثعبان، جمل، بطريق...

---

## Development Notes

- **Guest Sessions**: UUID مخزن في localStorage، لا حسابات مطلوبة
- **Reconnect**: عند العودة بعد Refresh يُرسَل state_sync كامل
- **Security**: Backend يتحقق من Role + Turn قبل كل Action
- **Future**: Architecture جاهزة لإضافة Redis لاحقاً لـ scaling

---

## Production Deployment

This application can be deployed using the following services:
- **Database**: Neon PostgreSQL
- **Backend**: Render Web Service
- **Frontend**: Vercel

### Deployment Order

**1. Database (Neon) -> 2. Backend (Render) -> 3. Frontend (Vercel) -> 4. Backend CORS Update**

### 1. Database Setup (Neon)
1. Create a new PostgreSQL project on [Neon](https://neon.tech).
2. Copy the connection string. It will look something like this:
   `postgresql://user:password@ep-cool-butterfly-1234.region.aws.neon.tech/dbname?sslmode=require`
   *(Keep this secure. Do not commit it to your repository).*

### 2. Backend Setup (Render)
1. Push your repository to GitHub.
2. In [Render](https://render.com), create a new **Web Service**.
3. Connect your repository.
4. Render will automatically detect the Dockerfile in `./backend/Dockerfile` (or set the root directory to `backend`).
5. **Environment Variables Required**:
   - `ENVIRONMENT` = `production`
   - `DATABASE_URL` = `(Paste the Neon URL from Step 1)`
   - `SECRET_KEY` = `(Generate a random long string, e.g. using openssl rand -hex 32)`
   - `ALLOWED_ORIGINS` = `https://your-frontend-domain.vercel.app` *(Leave temporary if not deployed yet, but remember to update it)*
6. **Database Migrations on Render**:
   - The safest way is to use Render's **Release Command**: `alembic upgrade head`.
   - Or, connect to the Render web shell after deployment and run: `alembic upgrade head`.

### 3. Frontend Setup (Vercel)
1. In [Vercel](https://vercel.com), create a new Project and import your GitHub repository.
2. Set the **Framework Preset** to `Vite`.
3. Set the **Root Directory** to `frontend`.
4. **Environment Variables Required**:
   - `VITE_API_URL` = `https://your-backend-app.onrender.com` *(Replace with your real Render URL)*
   - `VITE_WS_URL` = `wss://your-backend-app.onrender.com` *(Replace with your real Render URL)*
5. Deploy. 
*(Vercel handles React Router SPAs gracefully because of the included `vercel.json` file).*

### 4. Final CORS Setup
After Vercel gives you your final production domain (e.g. `https://hayawanat-game.vercel.app`), go back to Render:
1. Update the `ALLOWED_ORIGINS` environment variable to include your final Vercel domain.
2. Deploy/Restart the Render service.

---

## License

MIT
