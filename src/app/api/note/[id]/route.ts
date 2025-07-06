import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const DELETE_TOKEN_LENGTH = 32;

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

// secure delete with delete token
async function secureDelete(noteId: string, deleteToken: string): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.run(
      'DELETE FROM notes WHERE id = ? AND delete_token = ?',
      [noteId, deleteToken]
    );
    
    const deleted = (result.changes || 0) > 0;

    return deleted;
  } catch (err) {
    return false;
  }
}

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

    // validate delete token
    if (!deleteToken) {
      return NextResponse.json(
        await errorResponse(400, 'Delete token is required'),
        { status: 400 }
      );
    }

    if (typeof deleteToken !== 'string') {
      return NextResponse.json(
        await errorResponse(400, 'Delete token must be a string'),
        { status: 400 }
      );
    }

    if (deleteToken.length !== DELETE_TOKEN_LENGTH) {
      return NextResponse.json(
        await errorResponse(400, 'Invalid delete token length'),
        { status: 400 }
      );
    }

    // attempt to delete the note
    const deleted = await secureDelete(noteId, deleteToken);

    // constant time response
    await addTimingDelay();

    if (!deleted) {
      return NextResponse.json(
        await errorResponse(404, 'Note not found or invalid delete token'),
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      await errorResponse(500, 'Internal server error'),
      { status: 500 }
    );
  }
} 