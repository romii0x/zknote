import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { executeQuery } from '@/lib/db';

const ALLOWED_EXPIRIES = [60000, 180000, 300000, 600000, 3600000, 86400000, 604800000];
const DEFAULT_EXPIRY = 86400000;

const MAX_NOTE_LENGTH = 100000;
const MAX_PASSPHRASE_LENGTH = 128;

// validation patterns matching original
const IV_PATTERN = /^[A-Za-z0-9_-]{16,24}$/;
const SALT_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// UUID to base64url conversion matching original
function uuidToBase64url(uuid: string): string {
  const hex = uuid.replace(/-/g, "");
  const buffer = Buffer.from(hex, "hex");
  return buffer.toString("base64url").replace(/=+$/, "");
}

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, iv, salt, expiry } = body;

    // input validation
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

    // server receives encrypted message which is ~33% larger than plaintext
    // we need to allow for the encrypted size of 100k chars of plaintext
    const MAX_ENCRYPTED_MESSAGE_LENGTH = 140000;
    
    if (message.length > MAX_ENCRYPTED_MESSAGE_LENGTH) {
      return NextResponse.json(
        await errorResponse(400, 'Message too large.'),
        { status: 400 }
      );
    }

    // validate content pattern (base64 content only)
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

    // generate note ID with proper UUID to base64url conversion
    const noteId = uuidToBase64url(uuidv4());
    
    // validate ID pattern
    if (!ID_PATTERN.test(noteId)) {
      return NextResponse.json(
        await errorResponse(500, 'Failed to generate valid note ID'),
        { status: 500 }
      );
    }
    
    const deleteToken = crypto.randomBytes(16).toString('hex');
    
    // set expiration
    const expiresAt = new Date(Date.now() + finalExpiry).toISOString();
    
    // store already-encrypted data
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