"""
Async background timer task.
Registered when a round starts with a timer.
If the round is still active when it fires, it expires the round safely.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Registry: round_id (str) -> asyncio.Task
# Allows cancellation when a round ends early.
_timer_tasks: dict[str, asyncio.Task] = {}


def register_timer(round_id: uuid.UUID, delay_seconds: int, room_code: str):
    """Schedule a timer for the given round. Any previous timer for that round is cancelled."""
    rid = str(round_id)
    cancel_timer(round_id)  # cancel stale task if any

    async def _run():
        try:
            await asyncio.sleep(delay_seconds)
            await _fire(rid, room_code)
        except asyncio.CancelledError:
            logger.info(f"[Timer] Cancelled for round {rid}")
        finally:
            if _timer_tasks.get(rid) is asyncio.current_task():
                _timer_tasks.pop(rid, None)

    task = asyncio.create_task(_run())
    _timer_tasks[rid] = task
    logger.info(f"[Timer] Registered {delay_seconds}s for round {rid} in room {room_code}")


def cancel_timer(round_id: uuid.UUID):
    rid = str(round_id)
    task = _timer_tasks.pop(rid, None)
    if task and not task.done():
        task.cancel()
        logger.info(f"[Timer] Explicitly cancelled for round {rid}")


async def _fire(round_id_str: str, room_code: str):
    """Called when timer elapses. Expires the round if still active."""
    from app.db.session import SessionLocal
    from app.services.round_service import get_active_round, expire_round
    from app.websocket.manager import manager
    from app.websocket.serializers import serialize_round_finished

    db = SessionLocal()
    try:
        import uuid as _uuid
        rid = _uuid.UUID(round_id_str)

        # Re-fetch round inside a fresh session — check it's still active
        from app.models.models import Round, RoundStatus
        round_ = db.query(Round).filter(Round.id == rid).first()
        if not round_ or round_.status != RoundStatus.active:
            logger.info(f"[Timer] Round {round_id_str} already ended — skipping expiry")
            return

        expire_round(db, round_)

        # Refresh relationships for serialization
        db.refresh(round_)
        _ = round_.player1
        _ = round_.player2

        finished_data = serialize_round_finished(round_)
        finished_data["end_reason"] = "timer_expired"

        # Build scoreboard
        from app.models.models import Participant
        participants = db.query(Participant).filter(
            Participant.room_id == round_.room_id,
            Participant.is_active == True
        ).order_by(Participant.score.desc()).all()
        finished_data["scoreboard"] = [
            {"participant_id": str(p.id), "display_name": p.display_name, "score": p.score}
            for p in participants
        ]

        await manager.broadcast_to_room(room_code.upper(), {
            "type": "round_finished",
            "data": finished_data,
        })
        logger.info(f"[Timer] Round {round_id_str} expired — broadcast sent")
    except Exception as e:
        logger.error(f"[Timer] Error expiring round {round_id_str}: {e}", exc_info=True)
    finally:
        db.close()
