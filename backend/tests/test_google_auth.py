"""Account integration tests. Run only against an opted-in disposable database."""
import os
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import jwt
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from cryptography.hazmat.primitives.asymmetric import rsa


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
    monkeypatch.setattr(settings, 'google_client_id', 'test-client.apps.googleusercontent.com')
    monkeypatch.setattr(settings, 'secret_key', 'test-only-key-with-more-than-thirty-two-characters')
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(security, '_google_keys', lambda: SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=private.public_key())))
    _attempts.clear()
    with SessionLocal() as db:
        initial_users = {u.id for u in db.query(User).all()}
        initial_rooms = {r.id for r in db.query(Room).all()}
    def credential(**changes):
        now = datetime.now(timezone.utc)
        return jwt.encode({'sub': 'subject-' + uuid.uuid4().hex, 'name': 'اختبار Google',
            'iss': 'https://accounts.google.com', 'aud': settings.google_client_id,
            'iat': now, 'exp': now + timedelta(minutes=5), **changes}, private, algorithm='RS256', headers={'kid': 'test'})
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
    response = client.post('/api/auth/google', json={'credential': credential})
    assert response.status_code == 200, response.text
    return response.json()


def test_google_signature_and_stable_identity(auth_env):
    client, credential, _ = auth_env
    sub = uuid.uuid4().hex
    first = login(client, credential(sub=sub))
    second = login(client, credential(sub=sub, name='Changed name'))
    assert first['user']['id'] == second['user']['id']
    assert first['user']['total_score'] == 0
    assert first['user']['display_name'] == 'اختبار Google'
    assert 'password_hash' not in first['user'] and 'google_subject' not in first['user']
    headers = {'Authorization': 'Bearer ' + first['access_token']}
    assert client.get('/api/auth/me', headers=headers).json()['id'] == first['user']['id']


@pytest.mark.parametrize('changes', [
    {'aud': 'wrong-client'}, {'iss': 'https://evil.invalid'},
    {'exp': datetime.now(timezone.utc) - timedelta(hours=1)}, {'sub': ''},
    {'azp': 'another-client'},
])
def test_invalid_google_claims_rejected(auth_env, changes):
    client, credential, _ = auth_env
    assert client.post('/api/auth/google', json={'credential': credential(**changes)}).status_code == 401


def test_forged_signature_and_bad_application_tokens(auth_env):
    client, credential, _ = auth_env
    valid = credential()
    header, payload, signature = valid.split('.')
    forged = header + '.' + payload + '.' + ('a' if signature[0] != 'a' else 'b') + signature[1:]
    assert client.post('/api/auth/google', json={'credential': forged}).status_code == 401
    assert client.get('/api/auth/me', headers={'Authorization': 'Bearer invalid'}).status_code == 401
    assert client.get('/api/auth/me').status_code == 401


def test_token_lifetime_and_missing_configuration(auth_env):
    client, credential, settings = auth_env
    from app.core.security import decode_access_token
    data = login(client, credential())
    claims = decode_access_token(data['access_token'])
    assert claims['exp'] - claims['iat'] == 7 * 24 * 3600
    settings.google_client_id = ''
    assert client.post('/api/auth/google', json={'credential': credential()}).status_code == 503


def test_google_failure_does_not_disable_guest_play(auth_env):
    client, _, settings = auth_env
    settings.google_client_id = ''
    response = client.post('/api/rooms/', json={'display_name': 'Guest', 'guest_uuid': str(uuid.uuid4())})
    assert response.status_code == 200


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
        client.post('/api/auth/google', json={'credential': 'x' * 20})
    assert client.post('/api/auth/google', json={'credential': 'x' * 20}).status_code == 429


def test_guest_animal_catalog_remains_public(auth_env):
    client, _, _ = auth_env
    response = client.get("/api/animals/list")
    assert response.status_code == 200
    assert response.json()["animals"]
