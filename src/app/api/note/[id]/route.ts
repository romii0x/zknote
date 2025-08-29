import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

const DELETE_TOKEN_LENGTH = 32;

// validation pattern for note ID format
const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// adds random delay to prevent timing attacks
async function addTimingDelay(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
}

// creates consistent error responses with timing protection
async function errorResponse(statusCode: number, message: string, details?: unknown) {
  await addTimingDelay();
  
  const response: Record<string, unknown> = {
    error: message,
    statusCode,
  };
  if (details) {
    response.details = details;
  }
  return response;
}

// securely deletes note using delete token
async function secureDelete(noteId: string, deleteToken: string): Promise<boolean> {
  try {
    const result = await executeQuery(
      'DELETE FROM notes WHERE id = $1 AND delete_token = $2',
      [noteId, deleteToken]
    );
    
    const deleted = (result.rowCount ?? 0) > 0;

    return deleted;
  } catch {
    return false;
  }
}

// deletes note using delete token validation
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

    // add timing delay for security
    await addTimingDelay();

    if (!deleted) {
      return NextResponse.json(
        await errorResponse(404, 'Note not found or invalid delete token'),
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      await errorResponse(500, 'Internal server error'),
      { status: 500 }
    );
  }
} 