"""
Download audio (mp3) and extract 6 evenly-spaced frames for a video.
Idempotent: skips already-downloaded files.
"""

import subprocess
import json
import time
from pathlib import Path


REQUEST_DELAY = 2.0


def video_dir(corpus_root: Path, handle: str, video_id: str) -> Path:
    d = corpus_root / handle / video_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def download_audio(url: str, out_dir: Path) -> Path:
    """Download audio as mp3. Returns path to mp3."""
    mp3 = out_dir / "audio.mp3"
    if mp3.exists():
        return mp3
    cmd = [
        "yt-dlp",
        "-x", "--audio-format", "mp3",
        "--audio-quality", "5",
        "--no-warnings",
        "-o", str(out_dir / "audio.%(ext)s"),
        url,
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    time.sleep(REQUEST_DELAY)
    return mp3


def extract_frames(mp3_path: Path, url: str, out_dir: Path, n_frames: int = 6) -> list[Path]:
    """
    Extract n_frames evenly-spaced frames from the video.
    Downloads video temporarily if needed, then removes it.
    Returns list of frame paths.
    """
    frames_dir = out_dir / "frames"
    frames_dir.mkdir(exist_ok=True)

    # Check if frames already extracted
    existing = sorted(frames_dir.glob("frame_*.jpg"))
    if len(existing) >= n_frames:
        return existing[:n_frames]

    # Download video (no audio) to temp file
    tmp_video = out_dir / "_tmp_video.mp4"
    if not tmp_video.exists():
        cmd = [
            "yt-dlp",
            "-f", "mp4/bestvideo[height<=480]",
            "--no-warnings",
            "-o", str(tmp_video),
            url,
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=180)
        except subprocess.CalledProcessError:
            # Some videos block video download; skip frames gracefully
            return []

    # Get duration via ffprobe
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", str(tmp_video)],
        capture_output=True, text=True, timeout=30,
    )
    duration = 30.0  # fallback
    try:
        info = json.loads(probe.stdout)
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                duration = float(stream.get("duration", 30))
                break
    except (json.JSONDecodeError, ValueError):
        pass

    # Extract frames at evenly-spaced timestamps
    frames = []
    for i in range(n_frames):
        t = (duration / (n_frames + 1)) * (i + 1)
        out_path = frames_dir / f"frame_{i+1:02d}.jpg"
        subprocess.run(
            ["ffmpeg", "-ss", str(t), "-i", str(tmp_video),
             "-vframes", "1", "-q:v", "3", str(out_path), "-y"],
            capture_output=True, timeout=30,
        )
        if out_path.exists():
            frames.append(out_path)

    # Clean up temp video
    tmp_video.unlink(missing_ok=True)
    return frames


def save_metadata(meta: dict, out_dir: Path) -> None:
    """Write metadata.json (idempotent)."""
    p = out_dir / "metadata.json"
    if p.exists():
        return
    import json as _json
    p.write_text(_json.dumps(meta, indent=2, ensure_ascii=False))
