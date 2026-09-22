import base64
import importlib.util
import unittest
import uuid
from pathlib import Path

path=Path(__file__).resolve().parents[1]/'app/websocket/audio.py'
spec=importlib.util.spec_from_file_location('audio_validation',path)
audio=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)

class MobileAudioTests(unittest.TestCase):
    def test_browser_formatting(self):
        for mime, canonical in [('audio/mp4; codecs="mp4a.40.2"','audio/mp4;codecs=mp4a.40.2'), (' Audio/WebM ; codecs="OPUS" ', 'audio/webm;codecs=opus'), ('audio/ogg; codecs=opus','audio/ogg;codecs=opus'), ('audio/mp4','audio/mp4')]:
            with self.subTest(mime=mime):
                self.assertEqual(audio.normalize_audio_mime(mime),canonical)

    def test_unsupported_formats_remain_rejected(self):
        for mime in ['video/mp4', 'audio/mp4;codecs=opus','audio/webm;codecs=vorbis','audio/mp4;codecs="mp4a.40.2,avc1"','audio/mp4;codecs=mp4a.40.2;extra=1',None]:
            self.assertIsNone(audio.normalize_audio_mime(mime))

    def test_safari_style_payload_and_container_checks(self):
        data={'request_id':str(uuid.uuid4()), 'round_id':str(uuid.uuid4()),'mime_type':'audio/mp4; codecs="mp4a.40.2"','duration_ms':5000,'audio_base64':base64.b64encode(b'\x00\x00\x00\x20ftyp'+b'\x00'*24+b'mp4a').decode()}
        self.assertEqual(audio.validate_audio(data)['mime_type'],'audio/mp4;codecs=mp4a.40.2')
        data['audio_base64']=base64.b64encode(b'x'*64).decode()
        with self.assertRaises(ValueError): audio.validate_audio(data)

if __name__=='__main__': unittest.main()
