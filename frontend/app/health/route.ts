import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const res = await fetch(`${backendUrl}/health`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ status: 'error', detail: 'Backend unhealthy' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ status: 'error', detail: String(err) }, { status: 500 });
  }
}
