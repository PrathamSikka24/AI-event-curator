import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured on the server.' },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const uploaded = formData.get('file') as Blob | File | null;

    if (!uploaded || !(uploaded instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing audio file in request.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await uploaded.arrayBuffer());
    const file = await toFile(buffer, 'audio.webm', {
      type: uploaded.type || 'audio/webm',
    });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    const text = transcription.text?.trim() ?? '';

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Error in /api/transcribe:', error);
    return NextResponse.json(
      { error: 'Transcription failed.' },
      { status: 500 },
    );
  }
}
