"""Standalone migration smoke check. ONLY run with a fresh disposable database.

Set DATABASE_URL to that database and HAYAWANAT_MIGRATION_TEST=1, then:
    python tests/check_voice_migration.py
Never run this against development/production data: it exercises a downgrade.
"""
import os
import subprocess
import uuid
from sqlalchemy import create_engine, text, inspect

assert os.environ.get('HAYAWANAT_MIGRATION_TEST') == '1', 'Explicit disposable database opt-in required'
engine = create_engine(os.environ['DATABASE_URL'])
assert not inspect(engine).get_table_names(), 'Refusing to run unless the database is empty'
def migrate(direction, revision):
    subprocess.run(['alembic', direction, revision], check=True)

migrate('upgrade', '0003_features_v2')
room, p1, p2, rnd, q1, q2 = [uuid.uuid4() for _ in range(6)]
params = dict(room=room, p1=p1, p2=p2, rnd=rnd, q1=q1, q2=q2)
with engine.begin() as db:
    db.execute(text("INSERT INTO rooms(id,code) VALUES (:room,'MIGRT')"), params)
    db.execute(text("INSERT INTO participants(id,room_id,guest_uuid,display_name) VALUES (:p1,:room,:p1,'P1'),(:p2,:room,:p2,'P2')"), params)
    db.execute(text("INSERT INTO rounds(id,room_id,player1_id,player2_id,player1_animal_id,player2_animal_id) VALUES (:rnd,:room,:p1,:p2,1,2)"), params)
    db.execute(text("INSERT INTO questions(id,round_id,asker_id,question_text) VALUES (:q1,:rnd,:p1,'هل يطير؟')"), params)
migrate('upgrade', 'head')
with engine.begin() as db:
    old = db.execute(text('SELECT question_text,question_type,audio_duration_ms FROM questions WHERE id=:q1'), params).one()
    assert old == ('هل يطير؟', 'text', None)
    db.execute(text("INSERT INTO questions(id,round_id,asker_id,question_type,audio_duration_ms) VALUES (:q2,:rnd,:p2,'audio',5000)"), params)
    assert not any('base64' in c['name'] or 'blob' in c['name'] for c in inspect(db).get_columns('questions'))
migrate('downgrade', '0003_features_v2')
with engine.connect() as db:
    assert db.execute(text('SELECT question_text FROM questions WHERE id=:q2'), params).scalar_one() == 'سؤال صوتي (التسجيل غير محفوظ)'
migrate('upgrade', 'head')
with engine.connect() as db:
    assert db.execute(text('SELECT count(*) FROM questions')).scalar_one() == 2
print('PASS: existing text preserved; audio metadata accepted; downgrade/upgrade retains question history')
