import uuid
from tests.test_auth import auth_env

def test_match_continuation_champion_and_new_series(auth_env):
    client, _, _ = auth_env
    guests = [str(uuid.uuid4()), str(uuid.uuid4())]
    created = client.post('/api/rooms/',json={'display_name':'Host','guest_uuid':guests[0]}).json()
    code=created['room']['code']; p1=created['participant']['id']
    p2=client.post(f'/api/rooms/{code}/join',json={'room_code':code,'display_name':'Opponent','guest_uuid':guests[1]}).json()['participant']['id']
    body={'player1_id':p1,'player2_id':p2,'best_of':3}
    assert client.post(f'/api/rounds/{code}/start?guest_uuid={guests[1]}',json=body).status_code==403
    assert client.post(f'/api/rounds/{code}/start?guest_uuid={guests[0]}',json=body).status_code==200
    assert client.post(f'/api/rounds/{code}/start?guest_uuid={guests[0]}',json=body).status_code==409
    def current(g): return client.get(f'/api/rounds/{code}/current?guest_uuid={g}').json()['round']
    series=current(guests[0])['match']['id']
    assert 'player1_animal' not in current(guests[0])
    def win():
        animal=current(guests[1])['opponent_animal']['id']
        assert client.post(f'/api/guesses/{code}/submit?guest_uuid={guests[0]}',json={'animal_id':animal}).status_code==200
    win()
    assert client.post(f'/api/rounds/{code}/rematch?guest_uuid={guests[0]}').status_code==200
    state=current(guests[0])['match'];assert state['id']==series and state['player1_wins']==1
    # Cancellation awards no win; continuing preserves the series.
    assert client.post(f'/api/rounds/{code}/cancel?guest_uuid={guests[0]}').status_code==200
    assert client.post(f'/api/rounds/{code}/rematch?guest_uuid={guests[0]}').status_code==200
    assert current(guests[0])['match']['player1_wins']==1
    win()
    with client.websocket_connect(f'/ws/{code}/{p1}') as ws:
        ws.send_json({'type':'authenticate','guest_uuid':guests[0]})
        result=ws.receive_json()['data']['round_finished']['match']
        assert result['champion_id']==p1 and result['player1_wins']==2
    assert client.post(f'/api/rounds/{code}/rematch?guest_uuid={guests[0]}').status_code==200
    state=current(guests[0])['match'];assert state['id']!=series and state['player1_wins']==0

def test_match_mode_validation(auth_env):
    client, _, _=auth_env
    assert client.post('/api/rounds/XXXXX/start?guest_uuid='+str(uuid.uuid4()),json={'player1_id':str(uuid.uuid4()),'player2_id':str(uuid.uuid4()),'best_of':2}).status_code==422
