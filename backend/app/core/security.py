"""Application tokens and Google ID-token verification. Never log credentials."""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import uuid
import jwt
from passlib.context import CryptContext
from app.core.config import get_settings

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def _secret():
    secret = get_settings().secret_key
    if len(secret) < 32 or secret == 'change-me-in-production':
        raise RuntimeError('Account sign-in requires a strong SECRET_KEY')
    return secret


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password or len(plain_password.encode('utf-8')) > 72:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    if len(password.encode('utf-8')) > 72:
        raise ValueError('كلمة المرور طويلة جداً')
    return pwd_context.hash(password)


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


@lru_cache(maxsize=1)
def _google_keys():
    # Fixed Google endpoint; never accept a key URL from a token/header/client.
    return jwt.PyJWKClient('https://www.googleapis.com/oauth2/v3/certs', lifespan=300, timeout=5)


def verify_google_credential(credential: str) -> dict:
    client_id = get_settings().google_client_id
    if not client_id:
        raise RuntimeError('Google sign-in is not configured')
    key = _google_keys().get_signing_key_from_jwt(credential).key
    claims = jwt.decode(credential, key, algorithms=['RS256'], audience=client_id,
        options={'require': ['sub', 'exp', 'iat', 'iss', 'aud']}, leeway=10)
    if claims['iss'] not in ('https://accounts.google.com', 'accounts.google.com'):
        raise ValueError('Invalid Google issuer')
    if not isinstance(claims['sub'], str) or not 1 <= len(claims['sub']) <= 255:
        raise ValueError('Invalid Google subject')
    if claims.get('azp', client_id) != client_id:
        raise ValueError('Invalid authorized party')
    # Stable Google sub is the identity. Never merge accounts by email or name.
    return claims
