<p align="center">
  <img src="frontend/public/assets/ballet-dancer.png" width="140" alt="Motion Lore Logo" />
</p>

<h1 align="center">Motion Lore</h1>
<p align="center"><strong>AI-Powered Ballet Subtitle Generator</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54" alt="Python" />
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="Amazon AWS" />
  <img src="https://img.shields.io/badge/Gemini-8E75C2?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/Groq-f55a42?style=for-the-badge&logo=groq&logoColor=white" alt="Groq" />
</p>

---

Motion Lore is an intelligent, context-aware subtitle generator designed specifically for ballet performances. By leveraging advanced multimodal AI models and context-enrichment pipelines, the application analyzes video recordings of ballet and translates non-verbal gestures, pantomime, dramatic expressions, and musical stages into structured narrative subtitles.

---

## Architecture Overview

The system is split into a modern decoupled architecture consisting of a Next.js frontend client and a high-performance FastAPI backend server.

```
+------------------+           +------------------+           +----------------------+
|                  |  POST     |                  |  Context  |  Groq Llama 3.3      |
| Next.js Frontend | --------> | FastAPI Backend  | --------> | (Enrichment Engine)  |
| (React, Stage3D) | <-------- | (Async Queue)    | <-------- |                      |
|                  |  Poll     |                  |           +----------------------+
+------------------+           +------------------+                      |
         |                               |                               v
         v                               v                    +----------------------+
+------------------+           +------------------+  Analyze  |                      |
|                  |           |                  | --------> | Gemini Multi-        |
| Local Storage    |           | AWS S3           | <-------- | modal AI Engine      |
| (Subtitle Cache) |           | (Video Storage)  |           |                      |
|                  |           |                  |           +----------------------+
+------------------+           +------------------+                      |
                                         |                               v
                                         v                    +----------------------+
                               +------------------+           |                      |
                               |                  |           | AWS DynamoDB         |
                               | Temporary Local  |           | (Job States & Cues)  |
                               | Tempfile / Cache |           |                      |
                               +------------------+           +----------------------+
```

### 1. Frontend Client
- **Framework**: Next.js (App Router, React 19, TypeScript).
- **Visual Presentation**: Features an immersive, responsive 3D parallax theatre stage setting implemented in [Stage.tsx](file:///Users/apurvaarya/Desktop/wow/motion-lore-ballet/frontend/app/components/Stage.tsx) using Next.js Image Optimization and real-time cursor tracking. It programmatically translates stage curtains (left and right) and the dancer on move events.
- **Playback & Integration**:
  - Implements the YouTube IFrame API to embed standard links, programmatically polling video playtime.
  - Automatically branches to an HTML5 video player for custom uploaded files, streaming via the backend's presigned S3 endpoints (`/api/video/{job_id}`).
  - Subtitle cues are bound to the video time context, enabling real-time overlay sync and interactive click-to-seek seeking in the subtitle transcript table.
  - **Exporting**: Users can download the generated subtitles as industry-standard `.srt` files or raw structured `.json` payloads.

### 2. Backend API
- **Framework**: FastAPI (Python 3.13) in [main.py](file:///Users/apurvaarya/Desktop/wow/motion-lore-ballet/backend/main.py) utilizing asynchronous lifespans and background tasks for non-blocking analysis processing.
- **Database & Storage**:
  - **Amazon S3**: Temporarily holds uploaded video files for analysis in [storage.py](file:///Users/apurvaarya/Desktop/wow/motion-lore-ballet/backend/storage.py) and provides presigned URLs for client-side HTML5 streaming.
  - **Amazon DynamoDB**: Maintained in [dynamo.py](file:///Users/apurvaarya/Desktop/wow/motion-lore-ballet/backend/dynamo.py). It stores job progress states, indexing metadata, and caches finalized subtitle results across two configured tables: `ballet-subtitles` (subtitle track cache) and `ballet-jobs` (async job status logs).

### 3. AI Analysis & Context Enrichment Engine
- **Context Enrichment (Groq)**: Configured in [groq_utils.py](file:///Users/apurvaarya/Desktop/wow/motion-lore-ballet/backend/groq_utils.py). If the performance title is provided, the backend uses `llama-3.3-70b-versatile` on Groq to determine title clarity. If the title is clear, Groq retrieves structured context for the ballet performance (such as setting, tone, character list with roles, and plot summary).
- **Gemini Video Processing**: Orchestrated in [gemini.py](file:///Users/apurvaarya/Desktop/wow/motion-lore-ballet/backend/gemini.py). Feeds the video (via YouTube URL or S3 bytes uploaded via Gemini File API) along with the structured ballet context block into `gemini-3.5-flash` using the new Google GenAI Python SDK (`google-genai`).
- **Structured Subtitle Cues Generation**: Google Gemini processes video frames and audio context, extracting spatial-temporal movements, mime gestures, and emotions. Generates structured JSON output with precise millisecond timestamps, text, and gesture categorization (`pantomime`, `emotion`, `narrative`).

---

## Subtitle Schema / Data Model

Subtitle tracks are defined in [models.py](file:///Users/apurvaarya/Desktop/wow/motion-lore-ballet/backend/models.py) and stored in DynamoDB under the following schema:

```json
{
  "video_id": "sha256_content_hash",
  "source_url": "https://www.youtube.com/watch?v=...",
  "title": "Swan Lake Act II",
  "ballet_context": {
    "title": "Swan Lake",
    "setting": "A moonlit lakeside shore surrounded by ruins",
    "tone": "Tragic, melancholic, and romantic",
    "characters": [
      {
        "name": "Odette",
        "role": "protagonist",
        "description": "The Swan Queen"
      },
      {
        "name": "Prince Siegfried",
        "role": "protagonist",
        "description": "The Prince"
      }
    ],
    "plot_summary": "..."
  },
  "cues": [
    {
      "id": "s_001",
      "start_ms": 75000,
      "end_ms": 78000,
      "gesture_type": "pantomime",
      "text": "She extends her arms, making the mime gesture for a sacred oath of love."
    }
  ],
  "generated_at": "2026-07-19T03:25:53+00:00"
}
```

---

## Installation & Setup

### Prerequisites
- Python 3.13 or higher
- Node.js 18.x or higher
- AWS Account (S3 and DynamoDB tables configured)
- Gemini API Key
- Groq API Key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and configure your environment file:
   ```bash
   cp .env.example .env
   ```
   Provide the following parameters in your `.env`:
   - `GEMINI_API_KEY`: Your Google Gemini developer key.
   - `GROQ_API_KEY`: Your Groq API key.
   - `DYNAMODB_TABLE`: The DynamoDB table name (defaults to `ballet-subtitles`).
   - `DYNAMODB_JOBS_TABLE`: The DynamoDB jobs table name (defaults to `ballet-jobs`).
   - `DYNAMODB_REGION`: The AWS region (defaults to `ap-southeast-2`).
   - `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: AWS credentials.
   - `S3_BUCKET`: Target S3 bucket (defaults to `ballet-uploads`).

3. Install dependencies and start the backend development server using `uv`:
   ```bash
   uv sync
   uv run uvicorn main:app --reload --port 8000
   ```

4. Run backend smoke tests [test_backend.py](file:///Users/apurvaarya/Desktop/wow/motion-lore-ballet/backend/test_backend.py) to verify AWS and AI API connections:
   ```bash
   uv run python test_backend.py
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Create your environment file:
   ```bash
   echo "BACKEND_URL=http://localhost:8000" > .env.local
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the Next.js development server:
   ```bash
   npm run dev
   ```
   The client will be running at `http://localhost:3000`.

---

## API Documentation

### 1. Ingest Video
- **Endpoint**: `POST /api/analyze`
- **Payload**: `Multipart/Form-Data`
  - `video_url` (Optional): String (YouTube URL)
  - `file` (Optional): Uploaded video file (.mp4, .mov, etc.)
  - `title` (Optional): String (Ballet title to resolve context)
- **Response** (If not cached):
  ```json
  {
    "job_id": "uuid-v4-string",
    "status": "queued"
  }
  ```
- **Response** (If cached):
  ```json
  {
    "job_id": "cached",
    "status": "cached",
    "subtitle_track": { ... }
  }
  ```

### 2. Check Job Status
- **Endpoint**: `GET /api/job/{job_id}`
- **Response**:
  ```json
  {
    "job_id": "uuid-v4-string",
    "status": "queued | processing | done | failed",
    "subtitle_track": { ... } | null,
    "error": null | "error_msg_string"
  }
  ```

### 3. Fetch Cached Subtitles
- **Endpoint**: `GET /api/subtitles/{video_id}`
- **Response**: Returns the fully analyzed `SubtitleTrack` JSON payload.

### 4. Fetch Presigned Video Playback URL
- **Endpoint**: `GET /api/video/{job_id}`
- **Response**:
  ```json
  {
    "url": "https://s3.amazonaws.com/ballet-uploads/uploads/...?"
  }
  ```
