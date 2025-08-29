import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { executeQuery } from '@/lib/db';

// allowed expiry times in milliseconds
const ALLOWED_EXPIRIES = [60000, 180000, 300000, 600000, 3600000, 86400000, 604800000];
const DEFAULT_EXPIRY = 86400000;

// validation patterns for input sanitization
const IV_PATTERN = /^[A-Za-z0-9_-]{16,24}$/;
const SALT_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// converts UUID to base64url format for note IDs
function uuidToBase64url(uuid: string): string {
  const hex = uuid.replace(/-/g, "");
  const buffer = Buffer.from(hex, "hex");
  return buffer.toString("base64url").replace(/=+$/, "");
}

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, iv, salt, expiry } = body;

    // validate message input
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        await errorResponse(400, 'Message cannot be empty.'),
        { status: 400 }
      );
    }

    if (message.length < 1) {
      return NextResponse.json(
        await errorResponse(400, 'Message cannot be empty.'),
        { status: 400 }
      );
    }

    // encrypted messages are ~33% larger than plaintext, allow for 100k chars
    const MAX_ENCRYPTED_MESSAGE_LENGTH = 140000;
    
    if (message.length > MAX_ENCRYPTED_MESSAGE_LENGTH) {
      return NextResponse.json(
        await errorResponse(400, 'Message too large.'),
        { status: 400 }
      );
    }

    // validate base64 content format
    if (!/^[A-Za-z0-9+/=_-]+$/.test(message)) {
      return NextResponse.json(
        await errorResponse(400, 'Invalid message format.'),
        { status: 400 }
      );
    }

    if (!iv || typeof iv !== 'string') {
      return NextResponse.json(
        await errorResponse(400, 'IV is required'),
        { status: 400 }
      );
    }

    if (!IV_PATTERN.test(iv)) {
      return NextResponse.json(
        await errorResponse(400, 'Invalid IV format'),
        { status: 400 }
      );
    }

    if (salt !== undefined && salt !== null) {
      if (typeof salt !== 'string') {
        return NextResponse.json(
          await errorResponse(400, 'Salt must be a string'),
          { status: 400 }
        );
      }
      
      if (!SALT_PATTERN.test(salt)) {
        return NextResponse.json(
          await errorResponse(400, 'Invalid salt format'),
          { status: 400 }
        );
      }
    }

    if (expiry !== undefined && expiry !== null) {
      if (!Number.isInteger(expiry) || !ALLOWED_EXPIRIES.includes(expiry)) {
        return NextResponse.json(
          await errorResponse(400, 'Invalid expiry'),
          { status: 400 }
        );
      }
    }

    const finalExpiry = ALLOWED_EXPIRIES.includes(expiry) ? expiry : DEFAULT_EXPIRY;

    // generate unique note ID from UUID
    const noteId = uuidToBase64url(uuidv4());
    
    // validate generated ID format
    if (!ID_PATTERN.test(noteId)) {
      return NextResponse.json(
        await errorResponse(500, 'Failed to generate valid note ID'),
        { status: 500 }
      );
    }
    
    const deleteToken = crypto.randomBytes(16).toString('hex');
    
    // calculate expiration timestamp
    const expiresAt = new Date(Date.now() + finalExpiry).toISOString();
    
    // store encrypted note data
    await executeQuery(
      'INSERT INTO notes (id, message, iv, salt, delete_token, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        noteId,
        message, // Already encrypted by client
        iv,
        salt || null,
        deleteToken,
        expiresAt,
      ]
    );
    
    return NextResponse.json({
      id: noteId,
      url: `/note/${noteId}`,
      deleteToken,
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      await errorResponse(500, 'Internal server error'),
      { status: 500 }
    );
  }
} 