import json
import time
from datetime import datetime, timezone
from google import genai
from google.genai import types
from backend.config import settings
from backend.models import SubtitleCue, SubtitleTrack
from backend.groq_utils import is_title_clear, get_ballet_context

client = genai.Client(api_key=settings.gemini_api_key)

PROMPT_TEMPLATE = """
You are an expert ballet interpreter. Analyze this ballet video and generate a subtitle track
that explains the pantomime gestures, character emotions, and narrative storytelling to a newcomer audience.

{context_block}

Return ONLY a valid JSON array with no markdown, no preamble. Each element:
{{
  "id": "s_001",
  "start_ms": 0,
  "end_ms": 3000,
  "text": "The princess gestures to her heart, telling the prince she loves him.",
  "gesture_type": "pantomime"
}}

gesture_type must be one of: pantomime | emotion | narrative

Rules:
- Cover the entire video with no gaps longer than 5 seconds
- Keep text under 120 characters
- Be specific — name characters and describe exactly what the gesture means
- Timestamps must be accurate to what's on screen
"""

def _build_prompt(context: dict | None) -> str:
    if not context:
        return PROMPT_TEMPLATE.format(context_block="")

    block = f"""
Ballet context:
- Title: {context.get('title', 'Unknown')}
- Setting: {context.get('setting', '')}
- Tone: {context.get('tone', '')}
- Plot: {context.get('plot_summary', '')}
- Characters: {json.dumps(context.get('characters', []))}
"""
    return PROMPT_TEMPLATE.format(context_block=block)


def _upload_bytes_to_gemini(video_bytes: bytes, mime_type: str = "video/mp4"):
    """Upload raw bytes via Gemini File API. Returns a file part."""
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(video_bytes)
        tmp_path = f.name
    try:
        uploaded = client.files.upload(
            path=tmp_path,
            config=types.UploadFileConfig(mime_type=mime_type),
        )
        # wait for file to be ACTIVE
        while uploaded.state.name == "PROCESSING":
            time.sleep(2)
            uploaded = client.files.get(name=uploaded.name)
        return types.Part.from_uri(file_uri=uploaded.uri, mime_type=mime_type), uploaded.name
    finally:
        os.unlink(tmp_path)


def analyze_video(
    video_uri: str,
    video_id: str,
    title: str | None = None,
    source_url: str | None = None,
    video_bytes: bytes | None = None,
) -> SubtitleTrack:
    """
    video_uri: YouTube URL or s3:// URI
    video_bytes: raw bytes (required when video_uri is s3://)
    """
    gemini_file_name = None

    if video_uri.startswith("s3://"):
        # upload bytes to Gemini File API
        assert video_bytes, "video_bytes required for S3 uploads"
        part, gemini_file_name = _upload_bytes_to_gemini(video_bytes)
    else:
        # YouTube URL — Gemini handles natively
        part = types.Part.from_uri(file_uri=video_uri, mime_type="video/mp4")

    # ── Groq: resolve title + get ballet context ──────────────────────────────
    resolved_title = title
    context = None

    if resolved_title and is_title_clear(resolved_title):
        context = get_ballet_context(resolved_title)
        resolved_title = context.get("title", resolved_title)

    prompt = _build_prompt(context)

    # ── Gemini: generate subtitles ────────────────────────────────────────────
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=[part, prompt],
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
        ),
    )

    # cleanup Gemini file
    if gemini_file_name:
        try:
            client.files.delete(name=gemini_file_name)
        except Exception:
            pass

    raw = response.text.strip()
    cues_data = json.loads(raw)
    cues = [SubtitleCue(**cue) for cue in cues_data]

    return SubtitleTrack(
        video_id=video_id,
        source_url=source_url,
        title=resolved_title,
        ballet_context=context,
        cues=cues,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )