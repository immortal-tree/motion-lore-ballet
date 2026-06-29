import hashlib
import uuid
import time
from urllib.parse import urlparse, parse_qs
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.models import AnalyzeResponse, JobStatusResponse, SubtitleTrack
from backend.dynamo import get_subtitles, put_subtitles, create_job, get_job, update_job
from backend.gemini import analyze_video
from backend.storage import upload_to_s3, download_from_s3, delete_from_s3
from backend.storage import upload_to_s3, download_from_s3, generate_presigned_url


def normalize_youtube_url(url: str) -> str:
    parsed = urlparse(url)
    if "youtu.be" in parsed.netloc:
        video_id = parsed.path.lstrip("/")
    else:
        video_id = parse_qs(parsed.query).get("v", [None])[0]
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    return f"https://www.youtube.com/watch?v={video_id}"

def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


async def process_video(
    job_id: str,
    video_uri: str,
    video_id: str,
    source_url: str | None,
    title: str | None,
    ttl: int | None,
    is_s3: bool = False,
):
    try:
        update_job(job_id, "processing")

        video_bytes = None
        if is_s3:
            video_bytes = download_from_s3(video_uri)

        track = analyze_video(
            video_uri=video_uri,
            video_id=video_id,
            title=title,
            source_url=source_url,
            video_bytes=video_bytes,
        )

        put_subtitles(track, ttl=ttl)
        update_job(job_id, "done", subtitle_track=track, s3_uri=video_uri if is_s3 else None)

    except Exception as e:
        update_job(job_id, "failed", error=str(e))
        

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="Ballet Subtitles AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    background_tasks: BackgroundTasks,
    video_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    title: Optional[str] = Form(None),
):
    if not video_url and not file:
        raise HTTPException(status_code=400, detail="Provide video_url or upload a file")
    if video_url and file:
        raise HTTPException(status_code=400, detail="Provide only one of video_url or file")

    if video_url:
        normalized = normalize_youtube_url(video_url)
        vid = fingerprint(normalized)
        cached = get_subtitles(vid)
        if cached:
            return AnalyzeResponse(status="cached", job_id="cached", subtitle_track=cached)

        job_id = str(uuid.uuid4())
        create_job(job_id, vid)
        background_tasks.add_task(
            process_video, job_id, normalized, vid, normalized, title, None, False
        )
        return AnalyzeResponse(status="queued", job_id=job_id)

    contents = await file.read()
    vid = hashlib.sha256(contents).hexdigest()
    cached = get_subtitles(vid)
    if cached:
        return AnalyzeResponse(status="cached", job_id="cached", subtitle_track=cached)

    s3_uri = await upload_to_s3(contents, file.filename, file.content_type)
    ttl = int(time.time()) + 60 * 60 * 24 * 30

    job_id = str(uuid.uuid4())
    create_job(job_id, vid)
    background_tasks.add_task(
        process_video, job_id, s3_uri, vid, None, title, ttl, True
    )
    return AnalyzeResponse(status="queued", job_id=job_id)


@app.get("/api/job/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    subtitle_track = None
    if job.get("subtitle_track"):
        subtitle_track = SubtitleTrack.model_validate_json(job["subtitle_track"])

    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        subtitle_track=subtitle_track,
        error=job.get("error_msg"),
    )


@app.get("/api/subtitles/{video_id}", response_model=SubtitleTrack)
def get_cached_subtitles(video_id: str):
    track = get_subtitles(video_id)
    if not track:
        raise HTTPException(status_code=404, detail="No subtitles found for this video")
    return track


@app.get("/api/video/{job_id}")
def get_video_url(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    s3_uri = job.get("s3_uri")
    if not s3_uri:
        raise HTTPException(status_code=404, detail="No uploaded video for this job")
    return {"url": generate_presigned_url(s3_uri)}