# models.py
from pydantic import BaseModel, HttpUrl
from typing import Optional
from enum import Enum

class VideoSource(str, Enum):
    youtube = "youtube"
    upload = "upload"

class AnalyzeRequest(BaseModel):
    video_url: Optional[HttpUrl] = None

class SubtitleCue(BaseModel):
    id: str
    start_ms: int
    end_ms: int
    text: str
    gesture_type: Optional[str] = None

class SubtitleTrack(BaseModel):
    video_id: str
    source_url: Optional[str] = None
    title: Optional[str] = None           # resolved ballet title
    ballet_context: Optional[dict] = None # full Groq context object
    cues: list[SubtitleCue]
    generated_at: str

class AnalyzeResponse(BaseModel):
    job_id: str
    status: str
    subtitle_track: Optional[SubtitleTrack] = None

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    subtitle_track: Optional[SubtitleTrack] = None
    error: Optional[str] = None