#!/usr/bin/env python3
"""
Step 2 of 3 — download + transcribe @DavidKingStories' top 30 Shorts with Whisper
(on-device, M1), like the other creators.

Reads:  ~/Downloads/davidking_urls.json   (from scripts/davidking-fetch.mjs)
Writes: ~/Downloads/davidking_transcripts.txt

Prereqs: pip3 install mlx-whisper yt-dlp   (and: brew install ffmpeg)
Usage:   python3 scripts/davidking-transcripts.py
"""

import json, subprocess, sys, tempfile, time
from pathlib import Path
from datetime import datetime

import mlx_whisper

URLS_JSON = Path.home() / "Downloads" / "davidking_urls.json"
OUT       = Path.home() / "Downloads" / "davidking_transcripts.txt"
MODEL     = "mlx-community/whisper-large-v3-mlx"
AUDIO_DIR = Path(tempfile.mkdtemp(prefix="dvk_"))
YTDLP     = [sys.executable, "-m", "yt_dlp"]

if not URLS_JSON.exists():
    sys.exit(f"Missing {URLS_JSON}. Run: node scripts/davidking-fetch.mjs first.")

videos = json.loads(URLS_JSON.read_text())
print(f"Transcribing {len(videos)} videos from {URLS_JSON.name}\n")

lines = [
    f"@DavidKingStories — transcripts of top {len(videos)} Shorts (by views, last year)",
    f"Generated: {datetime.now().isoformat()}",
    f"Model: {MODEL}",
    "=" * 80,
    "",
]

for i, v in enumerate(videos, 1):
    src   = v.get("source", "?")
    rank  = v.get("rank", 0)
    url   = v.get("url", "")
    vid   = f"{src}_{v.get('id', rank)}"
    date  = v.get("date", "unknown")
    views = v.get("views", 0) or 0
    dur_s = v.get("duration", 0) or 0
    dur   = f"{dur_s // 60}m{dur_s % 60:02d}s" if dur_s else ""
    title = (v.get("title") or "").replace("\n", " ").strip()

    print(f"[{i:02d}/{len(videos)}] {src} #{rank} {date} — {title[:55]}")
    audio_path = AUDIO_DIR / f"{vid}.m4a"

    # TikTok needs an h264 rendition; YouTube gives clean bestaudio
    fmt = "best[vcodec=h264]/best" if src == "TikTok" else "bestaudio/best"
    subprocess.run(
        YTDLP + ["--no-warnings", "-q", "-f", fmt, "-o", str(audio_path), url],
        capture_output=True, text=True, timeout=240,
    )

    if not audio_path.exists() or audio_path.stat().st_size < 10_000:
        # yt-dlp may append a different extension; find the actual file
        cand = list(AUDIO_DIR.glob(f"{vid}.*"))
        audio_path = cand[0] if cand else audio_path

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
        try: audio_path.unlink(missing_ok=True)
        except Exception: pass

    lines += [
        f"[{src} #{rank}] {date}  {views:,} views  {dur}",
        f"URL: {url}",
        f"Title: {title}",
        "TRANSCRIPT:",
        transcript,
        "",
    ]
    time.sleep(1)

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"\nDone → {OUT}")
print("Next: node --env-file=.env.local scripts/analyze-davidking.mjs")
