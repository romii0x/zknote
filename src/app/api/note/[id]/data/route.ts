import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// validation patterns matching original
const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// timing attack protection
async function addTimingDelay(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
}

// error response helper with constant time responses
async function errorResponse(statusCode: number, message: string, details?: any) {
  await addTimingDelay();
  
  const response: any = {
    error: message,
    statusCode,
  };
  if (details) {
    response.details = details;
  }
  return response;
}

// GET endpoint to retrieve encrypted note data
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const noteId = params.id;

    // validate note ID pattern
    if (!ID_PATTERN.test(noteId)) {
      return NextResponse.json(
        await errorResponse(400, 'Invalid note ID format'),
        { status: 400 }
      );
    }

    // get note from database with constant time response
    const db = await getDb();
    const note = await db.get(
      'SELECT * FROM notes WHERE id = ? AND expires_at > datetime("now")',
      [noteId]
    );

    // constant time response for both found and not found cases
    await addTimingDelay();

    if (!note) {
      return NextResponse.json(
        await errorResponse(404, 'Note not found'),
        { status: 404 }
      );
    }

    // check if note has expired
    const expiresAt = new Date(note.expires_at);
    if (expiresAt < new Date()) {
      // delete expired note
      await db.run('DELETE FROM notes WHERE id = ?', [noteId]);
      return NextResponse.json(
        await errorResponse(410, 'Note expired'),
        { status: 410 }
      );
    }

    // return encrypted data for client-side decryption
    return NextResponse.json({
      id: note.id,
      message: note.message,
      iv: note.iv,
      salt: note.salt,
      deleteToken: note.delete_token,
    });
  } catch (error) {
    console.error('Error retrieving note:', error);
    return NextResponse.json(
      await errorResponse(500, 'Server error'),
      { status: 500 }
    );
  }
}

// DELETE endpoint for note deletion after successful client-side decryption
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const noteId = params.id;
    const deleteToken = request.headers.get('x-delete-token');

    // validate note ID pattern
    if (!ID_PATTERN.test(noteId)) {
      return NextResponse.json(
        await errorResponse(400, 'Invalid note ID format'),
        { status: 400 }
      );
    }

    if (!deleteToken || typeof deleteToken !== 'string') {
      return NextResponse.json(
        await errorResponse(400, 'Delete token is required'),
        { status: 400 }
      );
    }

    // delete the note after successful client-side decryption
    const db = await getDb();
    const result = await db.run(
      'DELETE FROM notes WHERE id = ? AND delete_token = ?',
      [noteId, deleteToken]
    );

    // constant time response
    await addTimingDelay();

    if ((result.changes || 0) === 0) {
      return NextResponse.json(
        await errorResponse(404, 'Note not found or invalid delete token'),
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      await errorResponse(500, 'Internal server error'),
      { status: 500 }
    );
  }
} 