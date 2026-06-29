import uuid
import boto3
from backend.config import settings

s3 = boto3.client(
    "s3",
    region_name=settings.dynamodb_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)


async def upload_to_s3(contents: bytes, filename: str, content_type: str) -> str:
    """Upload video bytes to S3, return s3:// URI."""
    key = f"uploads/{uuid.uuid4()}_{filename}"
    s3.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=contents,
        ContentType=content_type or "video/mp4",
    )
    return f"s3://{settings.s3_bucket}/{key}"


def download_from_s3(s3_uri: str) -> bytes:
    """Download video bytes from S3."""
    key = s3_uri.removeprefix(f"s3://{settings.s3_bucket}/")
    response = s3.get_object(Bucket=settings.s3_bucket, Key=key)
    return response["Body"].read()


def delete_from_s3(s3_uri: str) -> None:
    """Delete object after Gemini is done with it."""
    key = s3_uri.removeprefix(f"s3://{settings.s3_bucket}/")
    s3.delete_object(Bucket=settings.s3_bucket, Key=key)


def generate_presigned_url(s3_uri: str, expiry: int = 60*60*24*30) -> str:
    key = s3_uri.removeprefix(f"s3://{settings.s3_bucket}/")
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=expiry,
    )