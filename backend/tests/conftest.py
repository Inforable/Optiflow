import os
import sys

os.environ.setdefault("STORE", "memory")
os.environ.setdefault("AI_MODE", "cached")
os.environ.setdefault("AUTH_MODE", "off")
os.environ.setdefault("REPLAY_DELAY_SCALE", "0")
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("GOOGLE_CLOUD_PROJECT", None)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
