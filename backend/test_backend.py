"""
Ballet Subtitles AI — backend smoke tests
Run from the backend directory: uv run python test_backend.py
"""

import json
import boto3
from datetime import datetime, timezone

from config import settings

PASS = "✅"
FAIL = "❌"

def section(title: str):
    print(f"\n{'─'*50}")
    print(f"  {title}")
    print('─'*50)

# ── 1. DynamoDB ───────────────────────────────────────────────────────────────

def test_dynamodb():
    section("DynamoDB")
    dynamodb = boto3.resource(
        "dynamodb",
        region_name=settings.dynamodb_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

    # ballet-subtitles
    try:
        table = dynamodb.Table(settings.dynamodb_table)
        table.load()
        print(f"{PASS} Table '{settings.dynamodb_table}' exists")
    except Exception as e:
        print(f"{FAIL} Table '{settings.dynamodb_table}' — {e}")

    # ballet-jobs
    try:
        table = dynamodb.Table(settings.dynamodb_jobs_table)
        table.load()
        print(f"{PASS} Table '{settings.dynamodb_jobs_table}' exists")
    except Exception as e:
        print(f"{FAIL} Table '{settings.dynamodb_jobs_table}' — {e}")

    # write + read + delete a test job
    try:
        jobs_table = dynamodb.Table(settings.dynamodb_jobs_table)
        test_id = "test-job-smoke"
        jobs_table.put_item(Item={
            "job_id": test_id,
            "status": "queued",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        resp = jobs_table.get_item(Key={"job_id": test_id})
        assert resp["Item"]["status"] == "queued"
        jobs_table.delete_item(Key={"job_id": test_id})
        print(f"{PASS} DynamoDB write/read/delete works")
    except Exception as e:
        print(f"{FAIL} DynamoDB write/read/delete — {e}")


# ── 2. S3 ─────────────────────────────────────────────────────────────────────

def test_s3():
    section("S3")
    s3 = boto3.client(
        "s3",
        region_name=settings.dynamodb_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

    try:
        s3.head_bucket(Bucket=settings.s3_bucket)
        print(f"{PASS} Bucket '{settings.s3_bucket}' exists and is accessible")
    except Exception as e:
        print(f"{FAIL} Bucket '{settings.s3_bucket}' — {e}")

    # upload + download + delete a test object
    try:
        key = "uploads/smoke-test.txt"
        s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=b"ballet test")
        resp = s3.get_object(Bucket=settings.s3_bucket, Key=key)
        assert resp["Body"].read() == b"ballet test"
        s3.delete_object(Bucket=settings.s3_bucket, Key=key)
        print(f"{PASS} S3 upload/download/delete works")
    except Exception as e:
        print(f"{FAIL} S3 upload/download/delete — {e}")


# ── 3. Groq ───────────────────────────────────────────────────────────────────

def test_groq():
    section("Groq")
    try:
        from groq_utils import is_title_clear, get_ballet_context

        clear = is_title_clear("Swan Lake Act II")
        print(f"{PASS} is_title_clear('Swan Lake Act II') → {clear}")
        assert clear is True, "Expected True for a clear ballet title"

        unclear = is_title_clear("vid_abc123_def")
        print(f"{PASS} is_title_clear('vid_abc123_def') → {unclear}")
        assert unclear is False, "Expected False for a hash-like title"

        ctx = get_ballet_context("Swan Lake")
        assert "title" in ctx and "characters" in ctx
        print(f"{PASS} get_ballet_context works — title: {ctx.get('title')}")
    except Exception as e:
        print(f"{FAIL} Groq — {e}")


# ── 4. Gemini (lightweight — no video) ───────────────────────────────────────

def test_gemini():
    section("Gemini")
    try:
        from google import genai
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Reply with exactly: ok",
        )
        assert response.text.strip().lower().startswith("ok")
        print(f"{PASS} Gemini 2.5 Flash API reachable")
    except Exception as e:
        print(f"{FAIL} Gemini — {e}")


# ── 5. Full subtitle cache round-trip ─────────────────────────────────────────

def test_subtitle_cache():
    section("Subtitle cache (dynamo.py)")
    try:
        from dynamo import put_subtitles, get_subtitles
        from models import SubtitleTrack, SubtitleCue

        track = SubtitleTrack(
            video_id="smoke-test-video",
            source_url=None,
            title="Swan Lake",
            ballet_context=None,
            cues=[SubtitleCue(id="s_001", start_ms=0, end_ms=3000, text="Test cue")],
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
        put_subtitles(track)
        fetched = get_subtitles("smoke-test-video")
        assert fetched is not None
        assert fetched.title == "Swan Lake"
        assert fetched.cues[0].text == "Test cue"

        # cleanup
        dynamodb = boto3.resource(
            "dynamodb",
            region_name=settings.dynamodb_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        dynamodb.Table(settings.dynamodb_table).delete_item(Key={"video_id": "smoke-test-video"})
        print(f"{PASS} Subtitle put/get round-trip works")
    except Exception as e:
        print(f"{FAIL} Subtitle cache — {e}")


# ── 6. Full end-to-end: YouTube → Groq → Gemini → DynamoDB ──────────────────

def test_e2e_youtube():
    section("E2E — YouTube → Groq → Gemini → DynamoDB")
    from dynamo import get_subtitles, put_subtitles
    from gemini import analyze_video

    YT_URL = "https://www.youtube.com/watch?v=H67qzbv-69I"
    VIDEO_ID = "smoke-e2e-" + YT_URL.split("v=")[-1]

    # clear any cached result first so we always exercise the full pipeline
    try:
        import boto3
        dynamodb = boto3.resource(
            "dynamodb",
            region_name=settings.dynamodb_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        dynamodb.Table(settings.dynamodb_table).delete_item(Key={"video_id": VIDEO_ID})
    except Exception:
        pass

    print(f"  Sending to Groq + Gemini... (may take 30-90s)")
    try:
        track = analyze_video(
            video_uri=YT_URL,
            video_id=VIDEO_ID,
            title="Ballet performance",
            source_url=YT_URL,
        )

        assert track.cues, "No cues returned"
        assert track.generated_at

        print(f"{PASS} analyze_video returned {len(track.cues)} cues")
        print(f"  Title   : {track.title}")
        print(f"  Context : {bool(track.ballet_context)}")
        print(f"  First cue: [{track.cues[0].start_ms}ms → {track.cues[0].end_ms}ms] {track.cues[0].text}")

        # cache it
        put_subtitles(track)
        fetched = get_subtitles(VIDEO_ID)
        assert fetched is not None
        assert len(fetched.cues) == len(track.cues)
        print(f"{PASS} Cached and retrieved from DynamoDB")

        # cleanup
        dynamodb.Table(settings.dynamodb_table).delete_item(Key={"video_id": VIDEO_ID})
        print(f"{PASS} Cleanup done")

    except Exception as e:
        print(f"{FAIL} E2E — {e}")
        raise


# ── run all ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    e2e = "--e2e" in sys.argv

    print("\n🩰 Ballet Subtitles AI — Backend Smoke Tests")
    test_dynamodb()
    test_s3()
    test_groq()
    test_gemini()
    test_subtitle_cache()

    if e2e:
        test_e2e_youtube()
    else:
        print(f"\n  (skipping E2E — run with --e2e to test full YouTube → Gemini pipeline)")

    print(f"\n{'─'*50}\nDone.\n")