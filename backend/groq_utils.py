# groq_utils.py
import json
from groq import Groq
from config import settings

client = Groq(api_key=settings.groq_api_key)

CLARITY_PROMPT = """
You are given a video title. Determine if it clearly identifies a specific ballet performance.

A title is UNCLEAR if it:
- Looks like a file ID or hash (vid123, abc_def_456)
- Is generic with no ballet name ("dance video", "performance", "untitled")
- Is in a format that gives no artistic context

A title is CLEAR if it:
- Contains a recognizable ballet name ("Swan Lake", "The Pharaoh's Daughter")
- Contains a composer, choreographer, or company name alongside context
- Contains act/scene references alongside a ballet name

Return ONLY valid JSON:
{
  "is_clear": true,
  "reason": "contains recognizable ballet name"
}
"""

CONTEXT_PROMPT = """
You are an expert on classical ballet. Given a ballet title, return structured context
that will help generate accurate subtitle narration for a newcomer audience.

Return ONLY valid JSON with no markdown:
{
  "title": "...",
  "setting": "...",
  "tone": "...",
  "characters": [
    {
      "name": "...",
      "role": "protagonist | antagonist | supporting",
      "description": "..."
    }
  ],
  "plot_summary": "2-3 sentence summary of the full ballet"
}
"""


def is_title_clear(title: str) -> bool:
    if not title or len(title.strip()) < 3:
        return False

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": CLARITY_PROMPT},
            {"role": "user", "content": f"Title: {title}"},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )

    data = json.loads(response.choices[0].message.content)
    return data.get("is_clear", False)


def get_ballet_context(title: str) -> dict:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": CONTEXT_PROMPT},
            {"role": "user", "content": f"Ballet title: {title}"},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    data = json.loads(response.choices[0].message.content)
    return data