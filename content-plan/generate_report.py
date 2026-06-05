#!/usr/bin/env python3
"""
Generate REPORT.md: corpus stats, failures, and skill spot-checks.

Usage:
  cd content-plan/
  python generate_report.py
"""

import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

CORPUS = Path("corpus")
SKILLS = Path("skills")
LOGS = Path("logs")


def run():
    lines = [
        f"# Content Plan — Corpus Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
    ]

    # ── Corpus stats ─────────────────────────────────────────────
    handles = [d.name for d in sorted(CORPUS.iterdir()) if d.is_dir()]
    total_videos = 0
    total_transcripts = 0
    channel_rows = []

    for handle in handles:
        vids = list((CORPUS / handle).iterdir())
        n_vids = len([v for v in vids if v.is_dir()])
        n_transcripts = len(list((CORPUS / handle).rglob("transcript.json")))
        n_errors = len(list((CORPUS / handle).rglob("error.txt")))
        total_videos += n_vids
        total_transcripts += n_transcripts
        channel_rows.append(f"| @{handle} | {n_vids} | {n_transcripts} | {n_errors} |")

    lines += [
        "## Corpus Summary",
        "",
        f"| Channel | Videos | Transcribed | Errors |",
        f"|---------|--------|-------------|--------|",
    ] + channel_rows + [
        "",
        f"**Total videos:** {total_videos}  ",
        f"**Total transcribed:** {total_transcripts}  ",
        f"**Success rate:** {total_transcripts/max(total_videos,1)*100:.0f}%",
        "",
    ]

    # ── Failures ─────────────────────────────────────────────────
    failures_file = LOGS / "corpus_failures.json"
    if failures_file.exists():
        failures = json.loads(failures_file.read_text())
        lines += [
            "## Failures",
            "",
            f"{len(failures)} failure(s):",
            "",
        ]
        for f in failures:
            lines.append(f"- {f}")
        lines.append("")

    # ── Skill files ──────────────────────────────────────────────
    skill_files = sorted(SKILLS.glob("*.md")) if SKILLS.exists() else []
    lines += [
        "## Generated Skill Files",
        "",
        f"{len(skill_files)} file(s):",
        "",
    ]
    for sf in skill_files:
        lines.append(f"- `{sf.name}` ({sf.stat().st_size:,} bytes)")
    lines.append("")

    # ── Spot checks ──────────────────────────────────────────────
    lines += ["## Spot Checks", ""]

    # First channel profile
    profiles = sorted(SKILLS.glob("channel-*-profile.md")) if SKILLS.exists() else []
    if profiles:
        first_profile = profiles[0]
        content = first_profile.read_text()[:1500]
        lines += [
            f"### Sample: `{first_profile.name}`",
            "",
            "```markdown",
            content,
            "```",
            "",
        ]

    # First format skill
    formats = sorted(SKILLS.glob("format-*.md")) if SKILLS.exists() else []
    if formats:
        first_format = formats[0]
        content = first_format.read_text()[:1500]
        lines += [
            f"### Sample: `{first_format.name}`",
            "",
            "```markdown",
            content,
            "```",
            "",
        ]

    out = Path("REPORT.md")
    out.write_text("\n".join(lines))
    print(f"✓ REPORT.md written ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    run()
