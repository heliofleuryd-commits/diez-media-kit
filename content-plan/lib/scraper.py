"""
Fetch a channel's top videos from TikTok.

Strategy:
  1. Try yt-dlp flat-playlist (most reliable, no auth needed).
  2. Return list of video dicts sorted by view count descending.

Each dict contains: video_id, url, title, views, likes, comments,
shares, duration, upload_date, description, hashtags, sound.
"""

import json
import subprocess
import time
import re
from datetime import datetime, date
from pathlib import Path


YTD_START = date(2026, 1, 1)
REQUEST_DELAY = 3.0  # seconds between requests


def _yt_dlp_channel(url: str, max_videos: int = 200) -> list[dict]:
    """Fetch video list via yt-dlp --flat-playlist."""
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        "--playlist-end", str(max_videos),
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    videos = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        upload_str = entry.get("upload_date", "")
        try:
            upload_date = datetime.strptime(upload_str, "%Y%m%d").date()
        except (ValueError, TypeError):
            upload_date = None

        if upload_date and upload_date < YTD_START:
            continue  # skip pre-2026 videos

        hashtags = []
        desc = entry.get("description") or entry.get("title") or ""
        hashtags = re.findall(r"#\w+", desc)

        videos.append({
            "video_id":    entry.get("id", ""),
            "url":         entry.get("url") or entry.get("webpage_url") or f"https://www.tiktok.com/video/{entry.get('id','')}",
            "title":       entry.get("title", ""),
            "views":       entry.get("view_count") or 0,
            "likes":       entry.get("like_count") or 0,
            "comments":    entry.get("comment_count") or 0,
            "shares":      entry.get("repost_count") or 0,
            "duration":    entry.get("duration") or 0,
            "upload_date": upload_str,
            "description": desc,
            "hashtags":    hashtags,
            "sound":       entry.get("track") or entry.get("music") or "",
        })
    return videos


def get_top_videos(channel_url: str, top_n: int = 10) -> list[dict]:
    """Return top_n YTD videos sorted by views desc."""
    time.sleep(REQUEST_DELAY)
    videos = _yt_dlp_channel(channel_url)
    if not videos:
        raise RuntimeError(
            f"yt-dlp returned 0 videos for {channel_url}. "
            "TikTok may be blocking. Provide an Apify API key and re-run."
        )
    videos.sort(key=lambda v: v["views"], reverse=True)
    return videos[:top_n]
