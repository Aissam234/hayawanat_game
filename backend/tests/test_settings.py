
from app.schemas.schemas import GameSettingsRequest

def test_settings_request_exclude_unset():
    # If a field is omitted, it should not be in the dump
    req1 = GameSettingsRequest(timer_duration=60)
    dump1 = req1.model_dump(exclude_unset=True)
    assert "timer_duration" in dump1
    assert dump1["timer_duration"] == 60
    assert "max_questions" not in dump1

    # If a field is explicitly None, it SHOULD be in the dump
    req2 = GameSettingsRequest(timer_duration=None, max_questions=None)
    dump2 = req2.model_dump(exclude_unset=True)
    assert "timer_duration" in dump2
    assert dump2["timer_duration"] is None
    assert "max_questions" in dump2
    assert dump2["max_questions"] is None

    # Toggling reactions
    req3 = GameSettingsRequest(reactions_enabled=False)
    dump3 = req3.model_dump(exclude_unset=True)
    assert "reactions_enabled" in dump3
    assert dump3["reactions_enabled"] is False

