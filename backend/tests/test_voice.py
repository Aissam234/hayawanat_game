"""Integration tests use ONLY an explicitly opted-in disposable PostgreSQL DB.

Run migrations first, then HAYAWANAT_TEST_DATABASE=1 pytest tests.
Audio here is a small container-shaped validation fixture; real MediaRecorder
encode/decode/playback is covered separately by the browser test.
"""
import base64
import os
import uuid
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from app.websocket.audio import validate_audio, MAX_AUDIO_BYTES


def payload(round_id=None, **overrides):
    data = {
        "round_id": str(round_id or uuid.uuid4()), "request_id": str(uuid.uuid4()),
        "mime_type": "audio/webm;codecs=opus", "duration_ms": 5000,
        "audio_base64": base64.b64encode(b"\x1a\x45\xdf\xa3" + b"OpusHead" + b"a" * 32).decode(),
    }
    return {**data, **overrides}


@pytest.mark.parametrize("changes", [
    {"duration_ms": 12001}, {"duration_ms": 0}, {"duration_ms": True},
    {"duration_ms": 1.5}, {"mime_type": "text/html"}, {"mime_type": []},
    {"audio_base64": ""}, {"audio_base64": "@@@"}, {"audio_base64": "A" * 349532},
    {"audio_base64": base64.b64encode(b"x" * 50).decode()},
    {"request_id": []}, {"round_id": None},
    {"audio_base64": base64.b64encode(b"\x1a\x45\xdf\xa3OpusHead" + b"a" * (MAX_AUDIO_BYTES - 11)).decode()},
])
def test_invalid_audio(changes):
    with pytest.raises(ValueError):
        validate_audio({**payload(), **changes})


def test_audio_validation_is_bounded_independently_of_duration():
    data = payload(duration_ms=12000)
    assert validate_audio(data)["audio_base64"] == data["audio_base64"]
    with pytest.raises(ValueError):
        validate_audio([])


@pytest.fixture
def game():
    if os.environ.get("HAYAWANAT_TEST_DATABASE") != "1":
        pytest.skip("Requires an explicitly opted-in disposable database")
    from app.main import app
    from app.db.session import SessionLocal
    from app.models.models import Room
    from app.websocket.manager import manager
    from app.game.timer import _timer_tasks
    with TestClient(app) as client:
        guests = [str(uuid.uuid4()) for _ in range(3)]
        first = client.post('/api/rooms/', json={"display_name": "Host", "guest_uuid": guests[0]}).json()
        code = first['room']['code']
        ids = [first['participant']['id']]
        for i in (1, 2):
            joined = client.post(f'/api/rooms/{code}/join', json={"display_name": f"Player {i}", "guest_uuid": guests[i], "room_code": code}).json()
            ids.append(joined['participant']['id'])
        result = client.post(f'/api/rounds/{code}/start', params={"guest_uuid": guests[0]}, json={"player1_id": ids[1], "player2_id": ids[2]})
        assert result.status_code == 200, result.text
        yield client, code, ids, guests, result.json()['round_id']
    assert not manager._rooms
    assert not _timer_tasks
    with SessionLocal() as db:
        room = db.query(Room).filter(Room.code == code).one()
        db.delete(room)
        db.commit()


def event(ws, kind):
    for _ in range(30):
        value = ws.receive_json()
        if value['type'] == kind:
            return value['data']
    raise AssertionError(f"No {kind} event")


def connect(stack, game, player):
    client, code, ids, guests, _ = game
    ws = stack.enter_context(client.websocket_connect(f'/ws/{code}/{ids[player]}'))
    ws.send_json({"type": "authenticate", "guest_uuid": guests[player]})
    state = event(ws, 'state_sync')
    return ws, state


def test_audio_relay_answer_reconnect_and_secrets(game):
    client, code, ids, guests, rid = game
    with ExitStack() as stack:
        host, host_state = connect(stack, game, 0)
        p1, state1 = connect(stack, game, 1)
        p2, state2 = connect(stack, game, 2)
        for state in (state1, state2):
            assert 'opponent_animal' in state['round']
            assert 'player1_animal' not in state['round'] and 'player2_animal' not in state['round']
        assert state1['round']['opponent_animal'] == host_state['round']['player2_animal']
        assert state2['round']['opponent_animal'] == host_state['round']['player1_animal']
        data = payload(rid)
        p1.send_json({"type": "voice_question", "data": data})
        submitted = [event(ws, 'question_submitted') for ws in (host, p1, p2)]
        assert submitted[0] == submitted[1] == submitted[2]
        q = submitted[0]['question']
        assert q['question_type'] == 'audio' and q['question_text'] is None and q['audio_duration_ms'] == 5000
        assert submitted[0]['audio']['audio_base64'] == data['audio_base64']
        assert event(p1, 'voice_question_accepted')['question_id'] == q['id']
        assert client.post(f'/api/questions/{q["id"]}/answer', params={"room_code": code, "guest_uuid": guests[0]}, json={"answer": "yes"}).status_code == 403
        answered = client.post(f'/api/questions/{q["id"]}/answer', params={"room_code": code, "guest_uuid": guests[2]}, json={"answer": "yes"})
        assert answered.status_code == 200
        assert event(p1, 'answer_submitted')['question_count'] == 1
        assert answered.json()['current_turn_player_id'] == ids[2]
    with ExitStack() as stack:
        _, restored = connect(stack, game, 1)
        assert restored['questions'][0]['answer'] == 'yes'
        assert 'audio' not in restored['questions'][0] and 'audio_base64' not in str(restored)


@pytest.mark.parametrize('player', [0, 2])
def test_audience_and_out_of_turn_rejected(game, player):
    with ExitStack() as stack:
        ws, _ = connect(stack, game, player)
        ws.send_json({"type": "voice_question", "data": payload(game[4])})
        assert event(ws, 'voice_question_error')['message']


def test_ws_auth_and_room_binding(game):
    client, code, ids, guests, rid = game
    for path, guest in [(f'/ws/{code}/{ids[1]}', guests[0]), (f'/ws/XXXXX/{ids[1]}', guests[1])]:
        with client.websocket_connect(path) as ws:
            ws.send_json({"type": "authenticate", "guest_uuid": guest})
            with pytest.raises(WebSocketDisconnect) as error:
                ws.receive_json()
            assert error.value.code == 4003


def test_inactive_member_rejected(game):
    from app.db.session import SessionLocal
    from app.models.models import Participant
    with SessionLocal() as db:
        player = db.get(Participant, uuid.UUID(game[2][1])); player.is_active = False; db.commit()
    client, code, ids, guests, _ = game
    with client.websocket_connect(f'/ws/{code}/{ids[1]}') as ws:
        ws.send_json({"type": "authenticate", "guest_uuid": guests[1]})
        with pytest.raises(WebSocketDisconnect): ws.receive_json()


def test_stale_round_rejected(game):
    with ExitStack() as stack:
        ws, _ = connect(stack, game, 1)
        ws.send_json({"type": "voice_question", "data": payload()})
        assert event(ws, 'voice_question_error')['message']


def test_retry_after_lost_ack_is_idempotent_and_replacement_socket_survives(game):
    from app.db.session import SessionLocal
    from app.models.models import Question
    data = payload(game[4])
    with ExitStack() as stack:
        first, _ = connect(stack, game, 1)
        first.send_json({"type": "voice_question", "data": data})
        q = event(first, 'question_submitted')['question']
        event(first, 'voice_question_accepted')
        replacement, state = connect(stack, game, 1)
        assert state['questions'][0]['id'] == q['id']
        replacement.send_json({"type": "voice_question", "data": data})
        assert event(replacement, 'voice_question_accepted')['question_id'] == q['id']
        replacement.send_json({"type": "ping"})
        assert replacement.receive_json()['type'] == 'pong'
    with SessionLocal() as db:
        assert db.query(Question).filter(Question.round_id == uuid.UUID(game[4])).count() == 1


@pytest.mark.asyncio
async def test_replaced_timer_stays_registered():
    import asyncio
    from app.game.timer import register_timer, cancel_timer, _timer_tasks
    rid = uuid.uuid4()
    register_timer(rid, 60, 'TEST')
    await asyncio.sleep(0)
    register_timer(rid, 60, 'TEST')
    replacement = _timer_tasks[str(rid)]
    await asyncio.sleep(0)
    assert _timer_tasks[str(rid)] is replacement
    cancel_timer(rid)
    await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_uvicorn_rejects_oversize_transport_message():
    target = os.environ.get('HAYAWANAT_WS_TEST_URL')
    if not target or os.environ.get('HAYAWANAT_TEST_DATABASE') != '1':
        pytest.skip('Requires the isolated running Uvicorn server')
    import httpx
    from websockets.asyncio.client import connect as ws_connect
    from websockets.exceptions import ConnectionClosed
    import json
    from app.db.session import SessionLocal
    from app.models.models import Room
    guest = str(uuid.uuid4())
    async with httpx.AsyncClient() as client:
        response = await client.post(target.replace('ws://', 'http://') + '/api/rooms/', json={'display_name': 'Transport check', 'guest_uuid': guest})
        assert response.status_code == 200
        data = response.json()
    try:
        async with ws_connect(f"{target}/ws/{data['room']['code']}/{data['participant']['id']}") as ws:
            await ws.send(json.dumps({'type': 'authenticate', 'guest_uuid': guest}))
            assert json.loads(await ws.recv())['type'] == 'state_sync'
            await ws.send('x' * (384 * 1024 + 1))
            with pytest.raises(ConnectionClosed) as error:
                await ws.recv()
            assert error.value.rcvd.code == 1009
    finally:
        with SessionLocal() as db:
            room = db.query(Room).filter(Room.code == data['room']['code']).one()
            db.delete(room); db.commit()
def test_oversize_frame_rejected(game):
    with ExitStack() as stack:
        ws, _ = connect(stack, game, 1)
        ws.send_text('x' * (384 * 1024 + 1))
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 1009


def test_mixed_questions_invalid_and_maximum(game):
    from app.db.session import SessionLocal
    from app.models.models import Round, Participant, Question
    from app.services.round_service import submit_question, answer_question
    with SessionLocal() as db:
        rnd = db.get(Round, uuid.UUID(game[4])); rnd.max_questions = 5; db.commit()
        players = [db.get(Participant, uuid.UUID(p)) for p in game[2][1:]]
        bad = submit_question(db, rnd, players[0], None, question_type='audio', audio_duration_ms=5000)
        answer_question(db, rnd, players[1], bad, 'invalid')
        assert rnd.question_count == 0 and rnd.current_turn_player_id == players[0].id and not bad.is_valid
        for i, kind in enumerate(['text', 'audio', 'text', 'audio', 'text']):
            asker, answerer = players[i % 2], players[(i + 1) % 2]
            q = submit_question(db, rnd, asker, 'هل يطير؟' if kind == 'text' else None,
                question_type=kind, audio_duration_ms=5000 if kind == 'audio' else None)
            with pytest.raises(PermissionError):
                submit_question(db, rnd, asker, 'سؤال آخر؟')
            db.rollback()
            answer_question(db, rnd, answerer, q, 'yes' if i % 2 else 'no')
            assert rnd.question_count == i + 1
            with pytest.raises(ValueError): answer_question(db, rnd, answerer, q, 'yes')
            db.rollback()
        with pytest.raises(PermissionError): submit_question(db, rnd, players[1], None, question_type='audio', audio_duration_ms=5000)
        db.rollback()
        with pytest.raises(PermissionError): submit_question(db, rnd, players[1], 'هل يطير؟')
        db.rollback()
        assert db.query(Question).filter(Question.round_id == rnd.id).count() == 6


def test_concurrent_text_and_audio_only_one_pending(game):
    from app.db.session import SessionLocal
    from app.models.models import Round, Participant
    from app.services.round_service import submit_question
    def ask(kind):
        with SessionLocal() as db:
            rnd = db.get(Round, uuid.UUID(game[4])); player = db.get(Participant, uuid.UUID(game[2][1]))
            try:
                submit_question(db, rnd, player, 'هل يطير؟' if kind == 'text' else None,
                    question_type=kind, audio_duration_ms=5000 if kind == 'audio' else None)
                return True
            except PermissionError:
                return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(ask, ['text', 'audio'])) == [False, True]


def test_expired_deadline_rejects_audio(game):
    from app.db.session import SessionLocal
    from app.models.models import Round
    # Connect first, then simulate an elapsed deadline before the timer callback.
    with ExitStack() as stack:
        ws, _ = connect(stack, game, 1)
        with SessionLocal() as db:
            rnd = db.get(Round, uuid.UUID(game[4])); rnd.timer_duration = 1
            rnd.timer_started_at = datetime.now(timezone.utc) - timedelta(seconds=5); db.commit()
        ws.send_json({"type": "voice_question", "data": payload(game[4])})
        assert event(ws, 'voice_question_error')['message'] == 'انتهى وقت الجولة'


def test_reaction_score_rematch_timer_and_finished_reconnect(game):
    client, code, ids, guests, rid = game
    with ExitStack() as stack:
        host, state = connect(stack, game, 0)
        p1, _ = connect(stack, game, 1)
        host.send_json({"type": "reaction", "data": {"emoji": "🔥"}})
        assert event(p1, 'reaction')['emoji'] == '🔥'
        result = client.post(f'/api/guesses/{code}/submit', params={"guest_uuid": guests[1]}, json={"animal_id": state['round']['player1_animal']['id']})
        assert result.json()['is_correct']
        finished = event(host, 'round_finished')
        assert next(p['score'] for p in finished['scoreboard'] if p['participant_id'] == ids[1]) == 1
    with ExitStack() as stack:
        host, state = connect(stack, game, 0)
        assert state['round_finished']['winner_id'] == ids[1]
        assert client.post(f'/api/rooms/{code}/settings', params={"guest_uuid": guests[0]}, json={"timer_duration": 60}).status_code == 200
        response = client.post(f'/api/rounds/{code}/rematch', params={"guest_uuid": guests[0]})
        assert response.status_code == 200, response.text
        next_round = event(host, 'round_started')
        assert next_round['id'] != rid and next_round['timer_ends_at']
        assert event(host, 'timer_started')['duration_seconds'] == 60
        assert client.post(f'/api/rounds/{code}/cancel', params={"guest_uuid": guests[0]}).status_code == 200
