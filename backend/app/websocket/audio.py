"""Bounded, transient audio validation. Never log or persist the supplied payload."""
import base64
import binascii
import uuid

MAX_AUDIO_BYTES = 256 * 1024
MAX_MESSAGE_BYTES = 384 * 1024
MAX_BASE64_CHARS = 4 * ((MAX_AUDIO_BYTES + 2) // 3)
ALLOWED_MIME_TYPES = {
    "audio/webm;codecs=opus", "audio/webm",
    "audio/ogg;codecs=opus", "audio/ogg",
    "audio/mp4", "audio/mp4;codecs=mp4a.40.2",
}


def validate_audio(data: dict) -> dict:
    if not isinstance(data, dict):
        raise ValueError("بيانات التسجيل غير صالحة")
    try:
        request_id = str(uuid.UUID(data.get("request_id", "")))
        round_id = uuid.UUID(data.get("round_id", ""))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("معرّف السؤال أو الجولة غير صالح") from None
    mime = data.get("mime_type")
    if not isinstance(mime, str) or mime.lower() not in ALLOWED_MIME_TYPES:
        raise ValueError("صيغة التسجيل غير مدعومة؛ استخدم سؤالاً كتابياً")
    mime = mime.lower()
    duration = data.get("duration_ms")
    if type(duration) is not int or not 1 <= duration <= 12000:
        raise ValueError("يجب ألا يتجاوز التسجيل 12 ثانية")
    encoded = data.get("audio_base64")
    if not isinstance(encoded, str) or not encoded or len(encoded) > MAX_BASE64_CHARS:
        raise ValueError("التسجيل فارغ أو أكبر من الحد المسموح (256 كيلوبايت)")
    try:
        audio = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("بيانات التسجيل غير صالحة") from None
    if not 32 <= len(audio) <= MAX_AUDIO_BYTES:
        raise ValueError("التسجيل فارغ أو أكبر من الحد المسموح (256 كيلوبايت)")
    # Lightweight container checks, NOT a decoder/duration verification. The
    # independent byte limit bounds resource use even when duration is forged.
    head = audio[:65536]
    valid = (
        (mime.startswith("audio/webm") and head.startswith(b"\x1a\x45\xdf\xa3") and b"OpusHead" in head)
        or (mime.startswith("audio/ogg") and head.startswith(b"OggS") and b"OpusHead" in head)
        or (mime.startswith("audio/mp4") and head[4:8] == b"ftyp" and b"mp4a" in audio)
    )
    if not valid:
        raise ValueError("ملف التسجيل لا يطابق الصيغة المدعومة")
    return {
        "request_id": request_id, "round_id": round_id,
        "mime_type": mime, "duration_ms": duration, "audio_base64": encoded,
    }
