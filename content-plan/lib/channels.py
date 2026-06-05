"""Read and validate channels.txt."""
from pathlib import Path


def load_channels(path: str = "channels.txt") -> list[str]:
    """Return list of TikTok URLs, stripping comments and blanks."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"channels.txt not found at {p.resolve()}")
    urls = []
    for line in p.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            urls.append(line)
    return urls


def handle_from_url(url: str) -> str:
    """Extract @handle from a TikTok URL."""
    # https://www.tiktok.com/@handle or https://www.tiktok.com/@handle/...
    for part in url.rstrip("/").split("/"):
        if part.startswith("@"):
            return part.lstrip("@")
    raise ValueError(f"Could not extract handle from: {url}")
