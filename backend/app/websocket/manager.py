"""
WebSocket Connection Manager.
Manages per-room connections and role-aware broadcasting.
"""
import json
import uuid
import asyncio
import logging
from fastapi import WebSocket
from app.websocket.serializers import serialize_round_for_participant, serialize_round_finished

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # room_code -> {participant_id: WebSocket}
        self._rooms: dict[str, dict[str, WebSocket]] = {}
        # participant_id -> room_code (for cleanup on disconnect)
        self._participant_room: dict[str, str] = {}

    async def connect(self, websocket: WebSocket, room_code: str, participant_id: str):
        # The endpoint has already accepted and authenticated this socket.
        old_ws = self._rooms.setdefault(room_code, {}).get(participant_id)
        self._rooms[room_code][participant_id] = websocket
        self._participant_room[participant_id] = room_code
        if old_ws and old_ws is not websocket:
            try:
                await old_ws.close(code=4001)
            except Exception:
                pass

    def disconnect(self, room_code: str, participant_id: str, websocket=None):
        current = self._rooms.get(room_code, {}).get(participant_id)
        if websocket is not None and current is not websocket:
            return False
        if room_code in self._rooms:
            self._rooms[room_code].pop(participant_id, None)
            if not self._rooms[room_code]:
                del self._rooms[room_code]
        self._participant_room.pop(participant_id, None)
        return True

    def is_current(self, room_code: str, participant_id: str, websocket):
        return self._rooms.get(room_code, {}).get(participant_id) is websocket

    def is_connected(self, room_code: str, participant_id: str) -> bool:
        return participant_id in self._rooms.get(room_code, {})

    async def send_to_participant(self, room_code: str, participant_id: str, data: dict):
        ws = self._rooms.get(room_code, {}).get(participant_id)
        if ws:
            try:
                await asyncio.wait_for(ws.send_text(json.dumps(data, ensure_ascii=False, default=str)), timeout=5)
            except Exception as e:
                logger.warning(f"[WS] Send failed to {participant_id}: {e}")
                self.disconnect(room_code, participant_id, ws)

    async def broadcast_to_room(self, room_code: str, data: dict, exclude: str | None = None):
        """Send same payload to all connections in a room."""
        connections = dict(self._rooms.get(room_code, {}))
        tasks = []
        for pid, ws in connections.items():
            if exclude and pid == exclude:
                continue
            tasks.append(self._safe_send(ws, pid, room_code, data))
        if tasks:
            await asyncio.gather(*tasks)

    async def broadcast_round_started(self, room_code: str, round_obj, participants: list):
        """
        Broadcast round_started with role-aware payloads.
        Each participant gets a different view of the round.
        """
        from app.websocket.serializers import serialize_round_for_participant
        connections = dict(self._rooms.get(room_code, {}))
        tasks = []
        participants_by_id = {str(p.id): p for p in participants}

        for pid, ws in connections.items():
            participant = participants_by_id.get(pid)
            if not participant:
                continue
            round_data = serialize_round_for_participant(round_obj, participant)
            payload = {"type": "round_started", "data": round_data}
            tasks.append(self._safe_send(ws, pid, room_code, payload))

        if tasks:
            await asyncio.gather(*tasks)

    async def _safe_send(self, ws: WebSocket, pid: str, room_code: str, data: dict):
        try:
            await asyncio.wait_for(ws.send_text(json.dumps(data, ensure_ascii=False, default=str)), timeout=5)
        except Exception as e:
            logger.warning(f"[WS] Broadcast failed to {pid}: {e}")
            self.disconnect(room_code, pid, ws)

    def get_connected_participant_ids(self, room_code: str) -> list[str]:
        return list(self._rooms.get(room_code, {}).keys())


# Global singleton
manager = ConnectionManager()
