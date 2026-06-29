import boto3
import json
from datetime import datetime, timezone
from typing import Optional
from backend.config import settings
from backend.models import SubtitleTrack

_kwargs = dict(
    region_name=settings.dynamodb_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)

dynamodb = boto3.resource("dynamodb", **_kwargs)

subtitles_table = dynamodb.Table(settings.dynamodb_table)
jobs_table = dynamodb.Table(settings.dynamodb_jobs_table)


# ── subtitle cache ────────────────────────────────────────────────────────────

def get_subtitles(video_id: str) -> Optional[SubtitleTrack]:
    response = subtitles_table.get_item(Key={"video_id": video_id})
    item = response.get("Item")
    if not item:
        return None
    return SubtitleTrack(**json.loads(item["subtitle_track"]))


def put_subtitles(track: SubtitleTrack, ttl: Optional[int] = None) -> None:
    item = {
        "video_id": track.video_id,
        "subtitle_track": track.model_dump_json(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if ttl:
        item["ttl"] = ttl
    subtitles_table.put_item(Item=item)


# ── job state (survives restarts, shared across instances) ────────────────────

def create_job(job_id: str, video_id: str) -> None:
    jobs_table.put_item(Item={
        "job_id": job_id,
        "video_id": video_id,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def get_job(job_id: str) -> Optional[dict]:
    response = jobs_table.get_item(Key={"job_id": job_id})
    return response.get("Item")


def update_job(job_id: str, status: str, subtitle_track=None, error=None, s3_uri=None):
    expr = "SET #s = :s, updated_at = :t"
    names = {"#s": "status"}
    values = {":s": status, ":t": datetime.now(timezone.utc).isoformat()}
    if subtitle_track:
        expr += ", subtitle_track = :st"
        values[":st"] = subtitle_track.model_dump_json()
    if error:
        expr += ", error_msg = :e"
        values[":e"] = error
    if s3_uri:
        expr += ", s3_uri = :u"
        values[":u"] = s3_uri
    jobs_table.update_item(
        Key={"job_id": job_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )