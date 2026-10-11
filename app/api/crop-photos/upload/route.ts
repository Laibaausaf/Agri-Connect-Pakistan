import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png' };

export async function POST(request: Request) {
  try {
    await requireCapability('farmer.batch.manage');
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a picture first.' }, { status: 400 });
    if (!extensions[file.type]) return NextResponse.json({ error: 'Only PNG, JPG, and JPEG pictures are accepted.' }, { status: 415 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Picture must be smaller than 8 MB.' }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    // Verify file signatures instead of trusting the filename or browser MIME type.
    const isPng = file.type === 'image/png' && bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = file.type === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpeg) return NextResponse.json({ error: 'This file does not look like a valid PNG or JPEG picture.' }, { status: 415 });
    const directory = path.join(process.cwd(), 'public', 'uploads', 'crops');
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}${extensions[file.type]}`;
    await writeFile(path.join(directory, filename), bytes, { flag: 'wx' });
    return NextResponse.json({ url: `/uploads/crops/${filename}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Picture upload failed.';
    return NextResponse.json({ error: message.includes('Unauthorized') ? 'Please sign in again and retry.' : 'Could not save this picture. Please try again.' }, { status: 500 });
  }
}
