"""Application tokens and password hashing. Never log credentials."""
from datetime import datetime, timedelta, timezone
import uuid
import jwt
import bcrypt
from app.core.config import get_settings

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7


def _secret():
    secret = get_settings().secret_key
    if len(secret) < 32 or secret == 'change-me-in-production':
        raise RuntimeError('Account sign-in requires a strong SECRET_KEY')
    return secret


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password or len(plain_password.encode('utf-8')) > 72:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    if len(password.encode('utf-8')) > 72:
        raise ValueError('كلمة المرور طويلة جداً')
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({**data, 'iat': now,
        'exp': now + (expires_delta if expires_delta is not None else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)),
        'iss': 'hayawanat', 'aud': 'hayawanat-game', 'jti': str(uuid.uuid4())}, _secret(), algorithm='HS256')


def decode_access_token(token: str | None) -> dict | None:
    if not isinstance(token, str) or len(token) > 4096:
        return None
    try:
        payload = jwt.decode(token, _secret(), algorithms=['HS256'], issuer='hayawanat', audience='hayawanat-game',
            options={'require': ['sub', 'exp', 'iat', 'iss', 'aud']})
        uuid.UUID(payload['sub'])
        return payload
    except (jwt.PyJWTError, ValueError, TypeError, RuntimeError):
        return None
