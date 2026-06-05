#!/usr/bin/env python3
"""
Phase 2 — Skill extraction via Claude Opus 4.8.
Reads the corpus and generates skill files into /skills/.
All API calls are disk-cached — safe to rerun.

Usage:
  cd content-plan/
  python extract_skills.py
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent))

from lib.skill_extractor import (
    build_channel_profile,
    cluster_and_build_format_skills,
    build_hook_library,
    build_viral_patterns,
)

CORPUS = Path("corpus")
SKILLS = Path("skills")
SKILLS.mkdir(exist_ok=True)


def load_all_transcripts() -> list[dict]:
    """Load all transcripts + metadata from corpus directory."""
    transcripts = []
    for transcript_file in sorted(CORPUS.rglob("transcript.json")):
        handle = transcript_file.parts[-3]      # corpus/handle/video_id/
        video_id = transcript_file.parts[-2]
        meta_file = transcript_file.parent / "metadata.json"
        meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
        data = json.loads(transcript_file.read_text())
        transcripts.append({
            "handle": handle,
            "video_id": video_id,
            "transcript": data.get("text", ""),
            "segments": data.get("segments", []),
            "meta": meta,
        })
    return transcripts


def run():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("❌  ANTHROPIC_API_KEY not set. Add it to .env and re-run.")
        sys.exit(1)

    all_transcripts = load_all_transcripts()
    if not all_transcripts:
        print("❌  No transcripts found in corpus/. Run build_corpus.py first.")
        sys.exit(1)

    print(f"Loaded {len(all_transcripts)} transcripts from corpus.")

    # Group by channel
    by_handle: dict[str, list[dict]] = {}
    for t in all_transcripts:
        by_handle.setdefault(t["handle"], []).append(t)

    # ── Channel profiles ─────────────────────────────────────────
    print(f"\n[1/4] Building {len(by_handle)} channel profiles…")
    for i, (handle, transcripts) in enumerate(by_handle.items(), 1):
        print(f"  {i}/{len(by_handle)} @{handle}… ", end="", flush=True)
        path = build_channel_profile(handle, transcripts)
        print(f"✓ {path}")

    # ── Format skills ────────────────────────────────────────────
    print("\n[2/4] Clustering formats and building format skills…")
    format_paths = cluster_and_build_format_skills(all_transcripts)
    print(f"  ✓ {len(format_paths)} format skill files generated")

    # ── Hook library ─────────────────────────────────────────────
    print("\n[3/4] Building hook library…")
    hook_path = build_hook_library(all_transcripts)
    print(f"  ✓ {hook_path}")

    # ── Viral patterns ───────────────────────────────────────────
    print("\n[4/4] Building viral structure patterns…")
    patterns_path = build_viral_patterns(all_transcripts)
    print(f"  ✓ {patterns_path}")

    # ── Summary ──────────────────────────────────────────────────
    skill_files = sorted(SKILLS.glob("*.md"))
    print(f"\n{'='*60}")
    print(f"SKILL EXTRACTION COMPLETE — {len(skill_files)} files in /skills/:")
    for f in skill_files:
        size = f.stat().st_size
        print(f"  {f.name}  ({size:,} bytes)")
    print(f"\nNext: python generate_daily.py  (Phase 3 — coming soon)")


if __name__ == "__main__":
    run()
