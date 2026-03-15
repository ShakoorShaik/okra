import { NextRequest, NextResponse } from 'next/server';
import { routeRequest } from '@/lib/watsonx';

export const maxDuration = 20;

export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 });
  }
  const result = await routeRequest(text);
  return NextResponse.json(result);
}
