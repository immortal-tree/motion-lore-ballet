from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str
    groq_api_key: str
    dynamodb_table: str = "ballet-subtitles"
    dynamodb_jobs_table: str = "ballet-jobs"
    dynamodb_region: str = "ap-southeast-2"
    aws_access_key_id: str
    aws_secret_access_key: str
    s3_bucket: str = "ballet-uploads"

    class Config:
        env_file = Path(__file__).parent / ".env"

settings = Settings()