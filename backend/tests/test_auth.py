"""Password authentication regressions; disposable database opt-in required."""
import os
import uuid
import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
@pytest.fixture
def auth_env(monkeypatch):
    if os.environ.get('HAYAWANAT_TEST_DATABASE') != '1':
        pytest.skip('Requires an explicitly opted-in disposable PostgreSQL database')
    from app.main import app
    from app.core import security
    from app.api.auth import _attempts
    from app.core.config import get_settings
    from app.db.session import SessionLocal
    from app.models.models import User, Room
    settings = get_settings()
    monkeypatch.setattr(settings, 'secret_key', 'test-only-key-with-more-than-thirty-two-characters')
    _attempts.clear()
    with SessionLocal() as db:
        initial_users = {u.id for u in db.query(User).all()}
        initial_rooms = {r.id for r in db.query(Room).all()}
    def credential(**changes):
        return {'username': 'player_' + changes.get('sub', uuid.uuid4().hex), 'password': 'test-password-123', 'avatar_id': 'fox'}
    with TestClient(app) as client:
        yield client, credential, settings
    with SessionLocal() as db:
        for room in db.query(Room).all():
            if room.id not in initial_rooms: db.delete(room)
        db.commit()
        for user in db.query(User).all():
            if user.id not in initial_users: db.delete(user)
        db.commit()


def login(client, credential):
    response = client.post('/api/auth/register', json=credential)
    if response.status_code == 409:
        response = client.post('/api/auth/login', json=credential)
    assert response.status_code == 200, response.text
    return response.json()

def test_password_registration_login_and_hash(auth_env):
    client, credential, _ = auth_env
    data = credential()
    account = login(client, data)
    assert client.post('/api/auth/register', json=data).status_code == 409
    result = client.post('/api/auth/login', json=data)
    assert result.status_code == 200
    assert result.json()['user']['id'] == account['user']['id']
    assert 'password_hash' not in result.json()['user']
    assert account['user']['avatar_id'] == 'fox'
    assert result.json()['user']['avatar_id'] == 'fox'
    assert client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + account['access_token']}).json()['avatar_id'] == 'fox'
    assert client.post('/api/auth/login', json={**data, 'password':'wrong'}).status_code == 401
    assert client.post('/api/auth/google', json={}).status_code == 404
    from app.db.session import SessionLocal
    from app.models.models import User
    from app.core.security import verify_password
    with SessionLocal() as db:
        user = db.get(User, uuid.UUID(account['user']['id']))
        assert user.password_hash != data['password']
        assert verify_password(data['password'], user.password_hash)

@pytest.mark.parametrize('data', [
    {'username':'   ', 'password':'longpassword'},
    {'username':' ab ', 'password':'longpassword'},
    {'username':'normal', 'password':'short'},
    {'username':'normal', 'password':'ع'*40},
])
def test_invalid_registration(auth_env, data):
    assert auth_env[0].post('/api/auth/register', json={**data, 'avatar_id': 'lion'}).status_code in (400,422)

def test_token_and_missing_secret(auth_env):
    client, credential, settings = auth_env
    from app.core.security import decode_access_token, create_access_token
    account = login(client, credential())
    claims = decode_access_token(account['access_token'])
    assert claims['exp'] - claims['iat'] == 7*24*3600
    expired = create_access_token({'sub':account['user']['id']}, timedelta(seconds=-1))
    for token in ['invalid', expired]:
        assert client.get('/api/auth/me', headers={'Authorization':'Bearer '+token}).status_code == 401
    assert client.get('/api/auth/me').status_code == 401
    settings.secret_key = 'short'
    assert client.post('/api/auth/register', json=credential()).status_code == 503

def test_permanent_win_score_and_account_room_protection(auth_env):
    client, credential, _ = auth_env
    sub = uuid.uuid4().hex
    account = login(client, credential(sub=sub))
    headers = {'Authorization': 'Bearer ' + account['access_token']}
    guest = str(uuid.uuid4())
    created = client.post('/api/rooms/', headers=headers, json={'display_name': 'Account player', 'guest_uuid': guest}).json()
    code, p1 = created['room']['code'], created['participant']['id']
    guest2 = str(uuid.uuid4())
    joined = client.post(f'/api/rooms/{code}/join', json={'room_code': code, 'display_name': 'Guest opponent', 'guest_uuid': guest2}).json()
    p2 = joined['participant']['id']
    assert client.post(f'/api/rounds/{code}/start?guest_uuid={guest}', headers=headers, json={'player1_id': p1, 'player2_id': p2}).status_code == 200
    # Knowledge of the room secret alone no longer grants account actions.
    assert client.get(f'/api/rounds/{code}/current?guest_uuid={guest}').status_code == 401
    with client.websocket_connect(f'/ws/{code}/{p1}') as ws:
        ws.send_json({'type': 'authenticate', 'guest_uuid': guest})
        with pytest.raises(WebSocketDisconnect) as error: ws.receive_json()
        assert error.value.code == 4003
    with client.websocket_connect(f'/ws/{code}/{p1}') as ws:
        ws.send_json({'type': 'authenticate', 'guest_uuid': guest, 'access_token': account['access_token']})
        state = ws.receive_json()
        assert state['type'] == 'state_sync' and 'opponent_animal' in state['data']['round']
        assert 'player1_animal' not in state['data']['round']
    opponent_view = client.get(f'/api/rounds/{code}/current?guest_uuid={guest2}').json()
    animal = opponent_view['round']['opponent_animal']['id']
    win = client.post(f'/api/guesses/{code}/submit?guest_uuid={guest}', headers=headers, json={'animal_id': animal})
    assert win.status_code == 200 and win.json()['is_correct']
    # A repeated final action cannot award a second point.
    assert client.post(f'/api/guesses/{code}/submit?guest_uuid={guest}', headers=headers, json={'animal_id': animal}).status_code != 200
    assert client.get('/api/auth/me', headers=headers).json()['total_score'] == 1
    assert login(client, credential(sub=sub))['user']['total_score'] == 1
    another = client.post('/api/rooms/', headers=headers, json={'display_name': 'Another room', 'guest_uuid': str(uuid.uuid4())})
    assert another.status_code == 200
    assert client.get('/api/auth/me', headers=headers).json()['total_score'] == 1


def test_account_cannot_be_reassigned_and_can_rejoin_another_device(auth_env):
    client, credential, _ = auth_env
    first = login(client, credential())
    second = login(client, credential())
    h1 = {'Authorization': 'Bearer ' + first['access_token']}
    h2 = {'Authorization': 'Bearer ' + second['access_token']}
    guest = str(uuid.uuid4())
    created = client.post('/api/rooms/', headers=h1, json={'display_name': 'Player', 'guest_uuid': guest}).json()
    code = created['room']['code']
    body = {'room_code': code, 'display_name': 'Player', 'guest_uuid': guest}
    assert client.post(f'/api/rooms/{code}/join', headers=h2, json=body).status_code == 400
    body['guest_uuid'] = str(uuid.uuid4())
    rejoin = client.post(f'/api/rooms/{code}/join', headers=h1, json=body)
    assert rejoin.status_code == 200
    assert rejoin.json()['participant']['id'] == created['participant']['id']


def test_login_attempts_are_limited(auth_env):
    client, _, _ = auth_env
    from app.api.auth import _attempts
    _attempts.clear()
    for _ in range(20):
        client.post('/api/auth/login', json={'username':'missing', 'password':'wrong'})
    assert client.post('/api/auth/login', json={'username':'missing', 'password':'wrong'}).status_code == 429


def test_guest_animal_catalog_remains_public(auth_env):
    client, _, _ = auth_env
    response = client.get("/api/animals/list")
    assert response.status_code == 200
    assert response.json()["animals"]


@pytest.mark.parametrize('avatar', [None, '', 'unknown', 'https://example.com/avatar.png'])
def test_registration_requires_valid_avatar(auth_env, avatar):
    client, credential, _ = auth_env
    data = credential()
    data.pop('avatar_id')
    if avatar is not None:
        data['avatar_id'] = avatar
    assert client.post('/api/auth/register', json=data).status_code == 422
