"""
Transcribe audio to timestamped JSON.

Primary:  Groq Whisper API  (if GROQ_API_KEY is set)
Fallback: local openai-whisper base model
"""

import json
import os
from pathlib import Path


def _transcribe_groq(mp3_path: Path) -> dict:
    from groq import Groq
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    with open(mp3_path, "rb") as f:
        response = client.audio.transcriptions.create(
            file=(mp3_path.name, f, "audio/mpeg"),
            model="whisper-large-v3-turbo",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
    def _seg(s):
        if isinstance(s, dict):
            return {"start": s.get("start", 0), "end": s.get("end", 0), "text": s.get("text", "")}
        return {"start": s.start, "end": s.end, "text": s.text}

    return {
        "text": response.text,
        "segments": [_seg(s) for s in (response.segments or [])],
        "source": "groq",
    }


def _transcribe_local(mp3_path: Path) -> dict:
    try:
        import whisper
    except ImportError as e:
        raise ImportError(
            "openai-whisper not installed. "
            "Run: pip install openai-whisper"
        ) from e
    model = whisper.load_model("base")
    result = model.transcribe(str(mp3_path), verbose=False)
    return {
        "text": result["text"],
        "segments": [
            {"start": s["start"], "end": s["end"], "text": s["text"]}
            for s in result.get("segments", [])
        ],
        "source": "local-whisper-base",
    }


def transcribe(mp3_path: Path, out_dir: Path) -> dict:
    """Transcribe and save transcript.json. Returns transcript dict."""
    out = out_dir / "transcript.json"
    if out.exists():
        return json.loads(out.read_text())

    if not mp3_path.exists():
        raise FileNotFoundError(f"Audio not found: {mp3_path}")

    if os.environ.get("GROQ_API_KEY"):
        data = _transcribe_groq(mp3_path)
    else:
        print("  [transcriber] No GROQ_API_KEY — falling back to local Whisper")
        data = _transcribe_local(mp3_path)

    out.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return data
