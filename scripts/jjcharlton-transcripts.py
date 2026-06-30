#!/usr/bin/env python3
"""
Step 2 of 3 — download + transcribe @jjcharlton's 50 best videos with Whisper
(on-device, M1), exactly like the other creators were done.

Reads:  ~/Downloads/jjcharlton_urls.json   (from scripts/jjcharlton-fetch.mjs)
Writes: ~/Downloads/jjcharlton_transcripts.txt

Prereqs: pip install mlx-whisper yt-dlp   (and: brew install ffmpeg)
Usage:   python3 scripts/jjcharlton-transcripts.py
"""

import json, subprocess, sys, tempfile, time
from pathlib import Path
from datetime import datetime

import mlx_whisper

URLS_JSON = Path.home() / "Downloads" / "jjcharlton_urls.json"
OUT       = Path.home() / "Downloads" / "jjcharlton_transcripts.txt"
MODEL     = "mlx-community/whisper-large-v3-mlx"
AUDIO_DIR = Path(tempfile.mkdtemp(prefix="jjc_"))
YTDLP     = [sys.executable, "-m", "yt_dlp"]

if not URLS_JSON.exists():
    sys.exit(f"Missing {URLS_JSON}. Run: node scripts/jjcharlton-fetch.mjs first.")

videos = json.loads(URLS_JSON.read_text())
print(f"Transcribing {len(videos)} videos from {URLS_JSON.name}\n")

lines = [
    f"@jjcharlton — transcripts of top {len(videos)} videos (by views, last year)",
    f"Generated: {datetime.now().isoformat()}",
    f"Model: {MODEL}",
    "=" * 80,
    "",
]

for v in videos:
    rank  = v.get("rank", 0)
    url   = v.get("url", "")
    vid   = v.get("id", str(rank))
    date  = v.get("date", "unknown")
    views = v.get("views", 0) or 0
    likes = v.get("likes", 0) or 0
    dur_s = v.get("duration", 0) or 0
    dur   = f"{dur_s // 60}m{dur_s % 60:02d}s" if dur_s else ""
    cap   = (v.get("caption") or "").replace("\n", " ").strip()

    print(f"[{rank:02d}/{len(videos)}] {date} — {cap[:60]}")

    audio_path = AUDIO_DIR / f"{vid}.mp4"

    # Download an h264 rendition (always carries an audio track)
    subprocess.run(
        YTDLP + ["--no-warnings", "-q", "-f", "best[vcodec=h264]/best",
                 "-o", str(audio_path), url],
        capture_output=True, text=True, timeout=240,
    )

    if not audio_path.exists() or audio_path.stat().st_size < 10_000:
        print("  ⚠ download failed, skipping")
        transcript = "[download failed]"
    else:
        try:
            res = mlx_whisper.transcribe(str(audio_path), path_or_hf_repo=MODEL, verbose=False)
            transcript = res["text"].strip()
            print(f"  ✓ {len(transcript)} chars")
        except Exception as e:
            transcript = f"[transcription error: {e}]"
            print(f"  ✗ {e}")
        audio_path.unlink(missing_ok=True)

    lines += [
        f"[{rank:02d}] {date}  {views:,} views  {likes:,} likes  {dur}",
        f"URL: {url}",
        f"Caption: {cap}",
        "TRANSCRIPT:",
        transcript,
        "",
    ]
    time.sleep(1)

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"\nDone → {OUT}")
print("Next: node --env-file=.env.local scripts/analyze-jjcharlton.mjs")
