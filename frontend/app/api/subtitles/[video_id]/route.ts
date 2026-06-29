import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ video_id: string }> }
) {
  try {
    const { video_id } = await params;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    const res = await fetch(`${backendUrl}/api/subtitles/${video_id}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      try {
        const errJson = JSON.parse(errText);
        return NextResponse.json(errJson, { status: res.status });
      } catch {
        return NextResponse.json({ detail: errText }, { status: res.status });
      }
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ detail: String(err) }, { status: 500 });
  }
}
