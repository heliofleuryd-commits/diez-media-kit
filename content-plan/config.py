"""
Channel weights and style preferences for skill extraction.
Priority channels get more videos pulled and heavier weighting in all prompts.
"""

# Pull top 15 videos instead of 10 for these channels
PRIORITY_CHANNELS = {
    "pechefootball",
    "fiagoball",
    "5.at.the.back",
}

# Standard channels get top 10
DEFAULT_TOP_N = 10
PRIORITY_TOP_N = 15

# Channels that need more videos and NO YTD date filter
# (key = handle, value = number of videos to pull)
DEEP_CHANNELS: dict[str, int] = {
    "toqueymedio": 50,
    "elefutbol": 50,
}

# Channels with primarily non-English content — triggers the emotional/storytelling
# profile prompt instead of the standard analytical one
EMOTIONAL_CHANNELS = {
    "toqueymedio",
    "elefutbol",
}

# Injected into every Opus prompt to bias toward the target style
STYLE_BRIEF = """
TARGET CREATOR STYLE (weight this heavily in all outputs):
- Primary reference channels: @pechefootball, @fiagoball, @5.at.the.back
- Format: high-quality storytelling, ~50% on-camera presenter / 50% b-roll or match footage
- Tone: confident, passionate, opinionated — presenter has a clear POV, not a neutral narrator
- Pacing: cinematic, not rushed — lets moments breathe, uses silence and music intentionally
- Hook style: opens with a bold statement or question delivered straight to camera
- Structure: the presenter GUIDES the viewer through a narrative arc, not just lists facts
- Production feel: clean, intentional cuts — every b-roll clip earns its place
- Avoid: rapid-fire lists, reaction-only formats, low-effort "did you know" structures
"""
