#!/usr/bin/env python3
"""
Phase 1 — Full corpus build: 10 channels × top 10 videos = 100 videos.
Fully resumable — skips already-processed videos on rerun.

Usage:
  cd content-plan/
  python build_corpus.py
"""

import json
import sys
import traceback
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent))

from lib.channels import load_channels, handle_from_url
from lib.scraper import get_top_videos
from lib.downloader import video_dir, download_audio, extract_frames, save_metadata
from lib.transcriber import transcribe
from config import PRIORITY_CHANNELS, DEFAULT_TOP_N, PRIORITY_TOP_N

CORPUS = Path("corpus")
LOGS = Path("logs")
LOGS.mkdir(exist_ok=True)


def run_full():
    channels = load_channels("channels.txt")
    if not channels:
        print("❌  channels.txt is empty. Add channel URLs and re-run.")
        sys.exit(1)

    print(f"Building corpus: {len(channels)} channels, up to 10 videos each")

    failures = []
    total_ok = 0

    for ch_idx, channel_url in enumerate(channels, 1):
        handle = handle_from_url(channel_url)
        print(f"\n{'='*60}")
        print(f"Channel {ch_idx}/{len(channels)}: @{handle}")
        print("="*60)

        top_n = PRIORITY_TOP_N if handle in PRIORITY_CHANNELS else DEFAULT_TOP_N
        priority_tag = " [PRIORITY]" if handle in PRIORITY_CHANNELS else ""
        print(f"  Fetching top {top_n} videos{priority_tag}")
        try:
            videos = get_top_videos(channel_url, top_n=top_n)
        except Exception as e:
            msg = f"@{handle}: failed to fetch video list — {e}"
            print(f"  ❌  {msg}")
            failures.append(msg)
            continue

        print(f"  {len(videos)} videos selected")

        for v_idx, video in enumerate(videos, 1):
            vid_id = video["video_id"]
            label = f"  [{ch_idx}/{len(channels)}] [{v_idx}/{len(videos)}] {vid_id}"
            out_dir = video_dir(CORPUS, handle, vid_id)

            # Skip if fully processed
            if (out_dir / "transcript.json").exists():
                print(f"{label} — ✓ already done")
                total_ok += 1
                continue

            print(f"{label} — processing…")

            try:
                save_metadata(video, out_dir)
                mp3 = download_audio(video["url"], out_dir)
                extract_frames(mp3, video["url"], out_dir)
                transcribe(mp3, out_dir)
                total_ok += 1
                print(f"{label} — ✓")
            except Exception as e:
                msg = f"@{handle}/{vid_id}: {e}"
                print(f"{label} — ⚠  {msg}")
                failures.append(msg)
                # Write partial failure log
                (out_dir / "error.txt").write_text(traceback.format_exc())

    # Write failure log
    log = LOGS / "corpus_failures.json"
    log.write_text(json.dumps(failures, indent=2))

    print(f"\n{'='*60}")
    print(f"CORPUS BUILD COMPLETE")
    print(f"  ✓ succeeded: {total_ok}")
    print(f"  ⚠  failed:   {len(failures)}")
    if failures:
        print(f"  See {log} for details")
    print(f"\nNext: python extract_skills.py")


if __name__ == "__main__":
    run_full()
