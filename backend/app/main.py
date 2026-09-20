"""
FastAPI main application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api import rooms, rounds, questions, guesses, settings as settings_api
from app.api.rounds import animals_router
from app.websocket import handlers
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="لعبة الحيوانات API",
    description="Online Multiplayer Animal Guessing Game - Backend API",
    version="1.0.0",
)

# CORS
# NOTE: allow_credentials=True is incompatible with wildcard "*".
# We always use an explicit origins list from ALLOWED_ORIGINS env var.
origins = settings.allowed_origins_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
app.include_router(rooms.router)
app.include_router(rounds.router)
app.include_router(questions.router)
app.include_router(guesses.router)
app.include_router(animals_router)
app.include_router(settings_api.router)

# WebSocket
app.include_router(handlers.router)


@app.get("/")
async def root():
    return {"message": "🐾 لعبة الحيوانات API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
