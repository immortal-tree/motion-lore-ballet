import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const contentType = request.headers.get('content-type') || '';

    const res = await fetch(`${backendUrl}/api/analyze`, {
      method: 'POST',
      body: request.body,
      // @ts-ignore
      duplex: 'half',
      headers: {
        'content-type': contentType,
      },
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
