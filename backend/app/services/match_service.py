from sqlalchemy.orm import object_session
from app.models.models import Round, RoundStatus

def match_summary(round_):
    if not round_.series_id or round_.best_of == 1:
        return None
    db = object_session(round_)
    rounds = db.query(Round).filter(Round.room_id == round_.room_id, Round.series_id == round_.series_id).all()
    players = [round_.player1_id, round_.player2_id]
    wins = [sum(r.status == RoundStatus.finished and r.winner_id == player for r in rounds) for player in players]
    target = round_.best_of // 2 + 1
    champion = next((str(player) for player, score in zip(players, wins) if score >= target), None)
    return {'id': str(round_.series_id), 'best_of': round_.best_of, 'target': target,
            'player1_wins': wins[0], 'player2_wins': wins[1], 'champion_id': champion,
            'rounds_played': len(rounds)}
