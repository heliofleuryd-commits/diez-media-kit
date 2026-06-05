#!/usr/bin/env python3
"""
DRY RUN — processes first channel's top 2 videos only.
Run this to validate the pipeline before the full 100-video run.

Usage:
  cd content-plan/
  python dry_run.py
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Ensure lib is importable
sys.path.insert(0, str(Path(__file__).parent))

from lib.channels import load_channels, handle_from_url
from lib.scraper import get_top_videos
from lib.downloader import video_dir, download_audio, extract_frames, save_metadata
from lib.transcriber import transcribe

CORPUS = Path("corpus")


def run_dry():
    print("=" * 60)
    print("DRY RUN — first channel, top 2 videos")
    print("=" * 60)

    # ── 1. Load channels ──────────────────────────────────────────
    channels = load_channels("channels.txt")
    if not channels:
        print("\n❌  channels.txt is empty.")
        print("   Add your 10 TikTok channel URLs (one per line) and re-run.")
        sys.exit(1)

    print(f"\nFound {len(channels)} channel(s) in channels.txt:")
    for i, url in enumerate(channels, 1):
        print(f"  {i}. {url}")

    first_url = channels[0]
    handle = handle_from_url(first_url)
    print(f"\nProcessing: @{handle}")

    # ── 2. Fetch top 2 videos ─────────────────────────────────────
    print("\n[1/4] Fetching video list via yt-dlp…")
    try:
        videos = get_top_videos(first_url, top_n=2)
    except RuntimeError as e:
        print(f"\n❌  {e}")
        sys.exit(1)

    if not videos:
        print("❌  No videos found. TikTok may be blocking yt-dlp for this channel.")
        sys.exit(1)

    print(f"  Got {len(videos)} video(s):")
    for v in videos:
        print(f"    • {v['video_id']} | views:{v['views']:,} | {v['title'][:60]}")

    # ── 3. Download + transcribe each ─────────────────────────────
    results = []
    for i, video in enumerate(videos, 1):
        vid_id = video["video_id"]
        print(f"\n[{i}/{len(videos)}] {vid_id}")

        out_dir = video_dir(CORPUS, handle, vid_id)

        # metadata
        print("  saving metadata…")
        save_metadata(video, out_dir)

        # audio
        print("  downloading audio…")
        try:
            mp3 = download_audio(video["url"], out_dir)
            print(f"  ✓ audio: {mp3}")
        except Exception as e:
            print(f"  ⚠  audio failed: {e}")
            mp3 = None

        # frames
        print("  extracting frames…")
        try:
            frames = extract_frames(mp3 or Path(""), video["url"], out_dir)
            print(f"  ✓ frames: {len(frames)} extracted")
        except Exception as e:
            print(f"  ⚠  frames failed: {e}")
            frames = []

        # transcription
        if mp3 and mp3.exists():
            print("  transcribing…", end=" ", flush=True)
            try:
                transcript = transcribe(mp3, out_dir)
                preview = transcript["text"][:120].replace("\n", " ")
                print(f"✓ [{transcript['source']}]")
                print(f"  preview: \"{preview}…\"")
            except Exception as e:
                print(f"⚠  {e}")
                transcript = None
        else:
            print("  skipping transcription (no audio)")
            transcript = None

        results.append({
            "video_id": vid_id,
            "out_dir": str(out_dir),
            "audio": str(mp3) if mp3 else None,
            "frames": len(frames),
            "transcript": bool(transcript),
        })

    # ── 4. Print output structure ─────────────────────────────────
    print("\n" + "=" * 60)
    print("OUTPUT STRUCTURE")
    print("=" * 60)
    for entry in results:
        d = Path(entry["out_dir"])
        print(f"\n{d}/")
        for f in sorted(d.rglob("*")):
            if f.is_file():
                size = f.stat().st_size
                print(f"  {f.relative_to(d)}  ({size:,} bytes)")

    print("\n✅  Dry run complete.")
    print("\nIf the output looks right, run the full pipeline:")
    print("  python build_corpus.py")


if __name__ == "__main__":
    run_dry()
