#!/usr/bin/env python3
"""
Download audio + transcribe all 50 @lafechadeportes videos via Whisper (on-device, M1).
Output: ~/Downloads/lafechadeportes_transcripts.txt

Usage: python3 scripts/lafechadeportes-transcripts.py
"""

import json, os, subprocess, sys, tempfile, time
from pathlib import Path
from datetime import datetime

import mlx_whisper

CHANNEL   = "https://www.tiktok.com/@lafechadeportes"
LIMIT     = 50
OUT       = Path.home() / "Downloads" / "lafechadeportes_transcripts.txt"
MODEL     = "mlx-community/whisper-large-v3-mlx"
AUDIO_DIR = Path(tempfile.mkdtemp(prefix="lfd_"))

YTDLP = [sys.executable, "-m", "yt_dlp"]

# ── 1. Fetch video list ───────────────────────────────────────────────────────

print(f"Fetching last {LIMIT} videos from {CHANNEL} …")
result = subprocess.run(
    YTDLP + ["--flat-playlist", "--dump-json", "--no-warnings",
              "--playlist-end", str(LIMIT), CHANNEL],
    capture_output=True, text=True, timeout=120,
)
videos = [json.loads(l) for l in result.stdout.splitlines() if l.strip()]
print(f"Got {len(videos)} videos.\n")

# ── 2. Process each video ─────────────────────────────────────────────────────

lines = [
    f"@lafechadeportes — transcripts of last {len(videos)} TikTok videos",
    f"Generated: {datetime.now().isoformat()}",
    f"Model: {MODEL}",
    "=" * 80,
    "",
]

for i, v in enumerate(videos, 1):
    vid_id  = v.get("id", "")
    url     = v.get("webpage_url") or v.get("url") or f"https://www.tiktok.com/video/{vid_id}"
    d       = v.get("upload_date", "")
    date    = f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else "unknown"
    views   = v.get("view_count", 0) or 0
    likes   = v.get("like_count", 0) or 0
    dur_s   = v.get("duration") or 0
    dur     = f"{dur_s // 60}m{dur_s % 60:02d}s" if dur_s else ""
    title   = (v.get("title") or "").replace("\n", " ").strip()

    print(f"[{i:02d}/{len(videos)}] {date} — {title[:60]}")

    audio_path = AUDIO_DIR / f"{vid_id}.mp4"

    # Download h264 format (always has audio track)
    dl = subprocess.run(
        YTDLP + [
            "--no-warnings", "-q",
            "-f", "best[vcodec=h264]",
            "-o", str(audio_path),
            url,
        ],
        capture_output=True, text=True, timeout=180,
    )

    if not audio_path.exists() or audio_path.stat().st_size < 10_000:
        print(f"  ⚠ Download failed, skipping.")
        lines += [
            f"[{i:02d}] {date}  {views:,} views  {likes:,} likes  {dur}",
            f"URL: {url}",
            f"Title: {title}",
            "TRANSCRIPT: [download failed]",
            "",
        ]
        continue

    # Transcribe
    try:
        result_w = mlx_whisper.transcribe(
            str(audio_path),
            path_or_hf_repo=MODEL,
            verbose=False,
        )
        transcript = result_w["text"].strip()
        print(f"  ✓ {len(transcript)} chars")
    except Exception as e:
        transcript = f"[transcription error: {e}]"
        print(f"  ✗ {e}")

    lines += [
        f"[{i:02d}] {date}  {views:,} views  {likes:,} likes  {dur}",
        f"URL: {url}",
        f"Title: {title}",
        "TRANSCRIPT:",
        transcript,
        "",
    ]

    # Clean up audio to save disk
    audio_path.unlink(missing_ok=True)
    time.sleep(1)

# ── 3. Write output ───────────────────────────────────────────────────────────

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"\nDone → {OUT}")
