from collections import OrderedDict
from threading import Lock
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.session import get_db
from app.models.models import User, Participant
from app.schemas.schemas import UserRegisterRequest, UserLoginRequest, UserOut, TokenOut
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token

router = APIRouter(prefix='/api/auth', tags=['auth'])
bearer_scheme = HTTPBearer(auto_error=False)
_attempts = OrderedDict()
_attempts_lock = Lock()


def throttle(request: Request):
    # Small, bounded per-process limiter; no Redis or paid service required.
    key = request.client.host if request.client else 'unknown'
    now = time.monotonic()
    with _attempts_lock:
        started, count = _attempts.pop(key, (now, 0))
        if now - started >= 60:
            started, count = now, 0
        _attempts[key] = (started, count + 1)
        while len(_attempts) > 2048:
            _attempts.popitem(last=False)
        if count >= 20:
            raise HTTPException(429, 'محاولات كثيرة؛ انتظر دقيقة ثم حاول مجدداً', headers={'Retry-After': '60'})


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), db: Session = Depends(get_db)) -> User | None:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    user = db.get(User, uuid.UUID(payload['sub'])) if payload else None
    if not user:
        raise HTTPException(401, 'انتهت جلسة الحساب؛ سجّل الدخول مجدداً')
    return user


def require_current_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(401, 'يرجى تسجيل الدخول')
    return user


def authorize_account_guest(request: Request, user: User | None = Depends(get_current_user), db: Session = Depends(get_db)):
    """An account-bound participant needs both its room secret and account token."""
    guest = request.query_params.get('guest_uuid')
    if not guest:
        return
    try:
        guest_id = uuid.UUID(guest)
    except ValueError:
        raise HTTPException(400, 'معرّف الجلسة غير صالح') from None
    linked = db.query(Participant.user_id).filter(Participant.guest_uuid == guest_id, Participant.user_id.isnot(None)).all()
    if any(not user or owner != user.id for (owner,) in linked):
        raise HTTPException(401, 'سجّل الدخول إلى الحساب المرتبط بهذه الجلسة')


def token_response(user):
    try:
        token = create_access_token({'sub': str(user.id)})
    except RuntimeError:
        raise HTTPException(503, 'تسجيل الدخول غير جاهز حالياً؛ يمكنك اللعب كضيف') from None
    return {'access_token': token, 'token_type': 'bearer', 'user': user}


@router.post('/register', response_model=TokenOut, dependencies=[Depends(throttle)])
def register(body: UserRegisterRequest, db: Session = Depends(get_db)):
    try:
        create_access_token({'sub': str(uuid.uuid4())})
        hashed = get_password_hash(body.password)
    except RuntimeError:
        raise HTTPException(503, 'تسجيل الدخول غير جاهز حالياً') from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    user = User(username=body.username.strip(), password_hash=hashed, avatar_id=body.avatar_id)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'اسم المستخدم موجود بالفعل') from None
    db.refresh(user)
    return token_response(user)


@router.post('/login', response_model=TokenOut, dependencies=[Depends(throttle)])
def login(body: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username.strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, 'اسم المستخدم أو كلمة المرور غير صحيحة')
    return token_response(user)


@router.get('/me', response_model=UserOut)
def get_me(current_user: User = Depends(require_current_user)):
    return current_user
