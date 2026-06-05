#!/bin/bash
# One-time setup: install system tools and Python dependencies.
# Run: bash setup.sh

set -e
echo "=== Content Plan Setup ==="

# ── System tools ──────────────────────────────────────────────────
echo ""
echo "[1/3] Checking system tools…"

if ! command -v brew &>/dev/null; then
  echo "⚠  Homebrew not found. Install it from https://brew.sh then re-run."
  exit 1
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "  Installing ffmpeg via Homebrew…"
  brew install ffmpeg
else
  echo "  ✓ ffmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"
fi

# ── Python venv ───────────────────────────────────────────────────
echo ""
echo "[2/3] Setting up Python venv…"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "  ✓ venv ready"

# ── .env ──────────────────────────────────────────────────────────
echo ""
echo "[3/3] Checking .env…"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  ⚠  Created .env from template."
  echo "     Add your ANTHROPIC_API_KEY (and optionally GROQ_API_KEY) to .env"
else
  echo "  ✓ .env exists"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Fill in channels.txt with your 10 TikTok channel URLs"
echo "  2. Add API keys to .env"
echo "  3. source .venv/bin/activate"
echo "  4. python dry_run.py"
