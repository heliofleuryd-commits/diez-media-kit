"""
Phase 2: Use Claude Opus 4.8 to extract skill files from the corpus.

All prompts enforce structural extraction only — never verbatim content.
Uses prompt caching to avoid re-paying on reruns.
"""

import json
import os
import sys
from pathlib import Path

import anthropic

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import STYLE_BRIEF, PRIORITY_CHANNELS

MODEL = "claude-opus-4-8"
SKILLS_DIR = Path("skills")
CACHE_DIR = Path("cache")


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def _cached_call(cache_key: str, messages: list[dict], system: str) -> str:
    """Call Claude with disk-level cache — skip if already done."""
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())["content"]

    client = _client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=messages,
    )
    content = response.content[0].text
    cache_file.write_text(json.dumps({"content": content}, ensure_ascii=False, indent=2))
    return content


SYSTEM_STRUCTURAL = f"""You are a viral content strategist analysing TikTok and YouTube football videos.
RULES:
- Extract STRUCTURE only. Never reproduce verbatim phrasing, examples, or specific claims from source material.
- Focus on: hook patterns, pacing, reveal timing, CTA style, sentence structure, emotional register, POV stance, visual rhythm.
- Every template must demand a strong point of view. Football virality = passion, hot takes, controversy — not neutral facts.
- Output clean Markdown.

{STYLE_BRIEF}"""


def build_channel_profile(handle: str, transcripts: list[dict]) -> Path:
    """Generate channel-[handle]-profile.md."""
    out = SKILLS_DIR / f"channel-{handle}-profile.md"
    if out.exists():
        return out

    corpus_text = "\n\n---\n\n".join(
        f"VIDEO {i+1} (views: {t['meta'].get('views', '?')}):\n{t['transcript']}"
        for i, t in enumerate(transcripts)
    )
    priority_note = (
        "\n⭐ PRIORITY CHANNEL: This is one of the primary reference channels. "
        "Analyse it in greater depth. This creator's style is the gold standard we are trying to learn from.\n"
        if handle in PRIORITY_CHANNELS else ""
    )
    content = _cached_call(
        f"profile-{handle}",
        [{"role": "user", "content": f"""Analyse these {len(transcripts)} transcripts from TikTok channel @{handle}.{priority_note}

TRANSCRIPTS:
{corpus_text}

Generate a channel profile covering:
1. Voice & persona (1 paragraph)
2. Vocabulary register (formal/informal, football jargon level, signature phrases — described structurally, not quoted)
3. Recurring rhetorical devices (list with brief description of each)
4. Typical length & pacing (with timestamp structure)
5. Primary audience hook (what emotional lever this creator pulls most)
6. Signature format patterns (describe 2–3 recurring structural templates)

Output as clean Markdown with ## headers."""}],
        SYSTEM_STRUCTURAL,
    )
    out.write_text(f"# Channel Profile: @{handle}\n\n{content}\n")
    return out


def cluster_and_build_format_skills(all_transcripts: list[dict]) -> list[Path]:
    """Cluster all videos into format types, then generate format-[type].md per cluster."""
    # Step 1: cluster
    cluster_cache = CACHE_DIR / "clusters.json"
    if cluster_cache.exists():
        clusters = json.loads(cluster_cache.read_text())
    else:
        corpus_summary = "\n".join(
            f"[{t['handle']} / {t['video_id']}] views:{t['meta'].get('views','?')} | {t['transcript'][:200]}..."
            for t in all_transcripts
        )
        raw = _cached_call(
            "cluster-formats",
            [{"role": "user", "content": f"""Analyse these 100 TikTok football video transcripts and cluster them into 4–6 format types.

SUMMARIES:
{corpus_summary}

Output ONLY valid JSON in this exact shape (no markdown):
{{
  "clusters": {{
    "format-slug": {{
      "name": "Human-readable name",
      "video_ids": ["id1", "id2", ...]
    }}
  }}
}}"""}],
            SYSTEM_STRUCTURAL,
        )
        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = "\n".join(cleaned.split("\n")[1:])
            cleaned = cleaned.rsplit("```", 1)[0]
        clusters = json.loads(cleaned)
        cluster_cache.write_text(json.dumps(clusters, indent=2))

    # Step 2: generate a skill file per cluster
    by_id = {t["video_id"]: t for t in all_transcripts}
    out_paths = []
    for slug, cluster_info in clusters["clusters"].items():
        out = SKILLS_DIR / f"{slug}.md"
        if out.exists():
            out_paths.append(out)
            continue
        vids = [by_id[vid] for vid in cluster_info["video_ids"] if vid in by_id]
        if not vids:
            continue
        sample = "\n\n---\n\n".join(
            f"VIDEO (channel:@{v['handle']} views:{v['meta'].get('views','?')}):\n{v['transcript']}"
            for v in vids[:15]  # cap at 15 to stay within token budget
        )
        content = _cached_call(
            f"format-{slug}",
            [{"role": "user", "content": f"""These {len(vids)} TikTok football videos all belong to the "{cluster_info['name']}" format.

SAMPLE TRANSCRIPTS:
{sample}

Generate a format skill file covering:
1. Structural pattern (describe the arc: hook → setup → reveal/payoff → CTA)
2. Pacing template with timestamps (e.g. 0–3s hook, 3–15s setup, 15–45s payoff, 45–60s CTA)
3. Visual rhythm (cut frequency, text overlay style, b-roll pattern)
4. When to use this format (what topics / moments it suits best)
5. Common failure modes (what kills virality in this format)
6. 3 abstracted structural templates (NOT verbatim — describe the architecture only)

Output as clean Markdown."""}],
            SYSTEM_STRUCTURAL,
        )
        out.write_text(f"# Format Skill: {cluster_info['name']}\n\n{content}\n")
        out_paths.append(out)
    return out_paths


def build_hook_library(all_transcripts: list[dict]) -> Path:
    """Generate hook-library.md from first ~3 seconds of every video."""
    out = SKILLS_DIR / "hook-library.md"
    if out.exists():
        return out

    hooks = []
    for t in all_transcripts:
        segs = t.get("segments", [])
        # Grab segments in first 3 seconds
        hook_text = " ".join(
            s["text"] for s in segs if s.get("end", 99) <= 4.0
        ).strip()
        if not hook_text and t.get("transcript"):
            # Fallback: first 120 chars of transcript
            hook_text = t["transcript"][:120]
        if hook_text:
            hooks.append(f"@{t['handle']} | views:{t['meta'].get('views','?')} | {hook_text}")

    hooks_text = "\n".join(hooks)
    content = _cached_call(
        "hook-library",
        [{"role": "user", "content": f"""Here are the opening hooks (first ~3 seconds) from 100 TikTok football videos:

{hooks_text}

Generate a hook library:
1. Categorise all hooks into emotion types: shock / curiosity / controversy / nostalgia / FOMO / contrarian
2. For each category, provide 5–10 abstracted structural templates — NOT verbatim quotes.
   Templates must describe the architecture (e.g. "Bold false-assumption opener that player/team contradicts in second clause")
3. For each category, note: what makes it work, what kills it, which topics it suits best.

Output as clean Markdown with ## headers per emotion category."""}],
        SYSTEM_STRUCTURAL,
    )
    out.write_text(f"# Hook Library\n\n{content}\n")
    return out


def build_viral_patterns(all_transcripts: list[dict]) -> Path:
    """Generate viral-structure-patterns.md — cross-channel patterns."""
    out = SKILLS_DIR / "viral-structure-patterns.md"
    if out.exists():
        return out

    # Use top 20 by views as representative sample
    top = sorted(all_transcripts, key=lambda t: t["meta"].get("views", 0), reverse=True)[:20]
    sample = "\n\n---\n\n".join(
        f"@{t['handle']} | views:{t['meta'].get('views','?')} | duration:{t['meta'].get('duration','?')}s\n{t['transcript']}"
        for t in top
    )
    content = _cached_call(
        "viral-patterns",
        [{"role": "user", "content": f"""Here are the top 20 highest-view TikTok football videos from 10 different channels:

{sample}

Extract cross-channel structural patterns covering:
1. Pacing patterns (seconds distribution across hook / setup / reveal / CTA)
2. Reveal timing (when does the key insight land relative to total duration?)
3. CTA patterns (how do viral videos end? what CTAs get used?)
4. On-screen text patterns (when does text appear, what role does it serve?)
5. Sound/music patterns (silence vs music, when transitions happen)
6. The single most consistent pattern shared by all top-performers

Focus on structure only. Output as clean Markdown."""}],
        SYSTEM_STRUCTURAL,
    )
    out.write_text(f"# Viral Structure Patterns\n\n{content}\n")
    return out
