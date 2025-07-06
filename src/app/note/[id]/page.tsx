'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const MAX_PASSPHRASE_LENGTH = 128;

// conversion helpers
function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function base64urlToBytes(b64url: string): Uint8Array {
  const padLength = (4 - (b64url.length % 4)) % 4;
  const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export default function ViewNote() {
  const params = useParams();
  const noteId = params.id as string;
  
  const [passphrase, setPassphrase] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [noteData, setNoteData] = useState<any>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (noteId) {
      loadNote();
    }
  }, [noteId]);

  const loadNote = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/note/${noteId}/data`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Note not found or already destroyed');
        } else if (response.status === 410) {
          setError('Note expired');
        } else {
          setError('Failed to load note');
        }
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      setNoteData(data);
      
      // check for key in URL hash AFTER we have the note data
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.slice(1);
        console.log('URL hash (without #):', hash);
        const keyParam = new URLSearchParams(hash).get('k');
        console.log('Key param from URL:', keyParam);
        if (keyParam) {
          // auto-decrypt with key - pass data directly
          decryptWithKey(keyParam, data);
          return;
        }
      }
      
      // if note has salt, it needs passphrase
      if (data.salt) {
        // show passphrase input - do nothing, it will show automatically
      } else {
        // no salt and no key - error
        setError('No decryption key found. This note requires a key in the URL.');
      }
    } catch (err) {
      setError('Failed to load note');
    } finally {
      setIsLoading(false);
    }
  };

  const decryptWithKey = async (key: string, data?: any) => {
    const noteDataToUse = data || noteData;
    
    if (!noteDataToUse) {
      console.log('No noteData available for decryption');
      return;
    }
    
    setIsDecrypting(true);
    setError(null);



    try {
      const keyBytes = base64urlToBytes(key);
      
      const keyObj = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // for key mode, the message includes the auth tag
      const ciphertext = base64ToBytes(noteDataToUse.message);
      const iv = base64urlToBytes(noteDataToUse.iv);

      const plaintextBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        keyObj,
        ciphertext
      );

      const plaintext = new TextDecoder().decode(plaintextBuffer);
      
      // clean up
      keyBytes.fill(0);
      iv.fill(0);

      // delete note
      await deleteNote(noteDataToUse);

      setNote(plaintext);
      setIsDecrypted(true);
    } catch (err) {
      setError('Failed to decrypt note. Invalid key.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setError('Please enter a passphrase.');
      return;
    }
    if (passphrase.length > MAX_PASSPHRASE_LENGTH) {
      setError('Passphrase must be less than 128 characters.');
      return;
    }

    if (!noteData) return;

    setIsDecrypting(true);
    setError(null);

    try {
      const enc = new TextEncoder();
      const salt = base64urlToBytes(noteData.salt);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const ciphertext = base64ToBytes(noteData.message);
      const iv = base64urlToBytes(noteData.iv);

      const plaintextBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      const plaintext = new TextDecoder().decode(plaintextBuffer);

      // clean up
      salt.fill(0);
      iv.fill(0);

      // delete note
      await deleteNote();

      setNote(plaintext);
      setIsDecrypted(true);
    } catch (err) {
      setError('Failed to decrypt note. Please check your passphrase.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const deleteNote = async (data?: any) => {
    const noteDataToUse = data || noteData;
    try {
      const response = await fetch(`/api/note/${noteId}/data`, {
        method: 'DELETE',
        headers: {
          'x-delete-token': noteDataToUse.deleteToken,
        },
      });
      if (!response.ok) {
        console.error('Failed to delete note');
      }
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const copyToClipboard = async () => {
    if (note) {
      try {
        await navigator.clipboard.writeText(note);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-page text-text flex items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-4xl font-bold mb-2">zknote</h1>
          <p className="text-text-secondary mb-4">Decrypt your secret note</p>
          <div className="text-text-secondary">Loading...</div>
        </div>
      </div>
    );
  }

  // show error state
  if (error && !noteData) {
    return (
      <div className="min-h-screen bg-page text-text flex items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-4xl font-bold mb-2">zknote</h1>
          <p className="text-text-secondary mb-4">Decrypt your secret note</p>
          <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error">
            {error}
          </div>
          <a
            href="/"
            className="block w-full h-12 bg-button hover:bg-button-hover text-text font-medium rounded-lg transition-colors text-center leading-[48px] mt-4"
          >
            Create New Note
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-text flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">zknote</h1>
          <p className="text-text-secondary">Decrypt your secret note</p>
        </div>

        {!isDecrypted ? (
          <div className="space-y-6">
            {/* show passphrase input if note has salt (passphrase mode) */}
            {noteData && noteData.salt && (
              <form onSubmit={handleDecrypt} className="space-y-6">
                <div>
                  <label htmlFor="passphrase" className="block text-sm font-medium mb-2">
                    Passphrase
                  </label>
                  <div className="relative">
                    <input
                      id="passphrase"
                      type={showPassphrase ? "text" : "password"}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Enter the passphrase..."
                      className="w-full h-12 px-4 pr-12 bg-input border border-border rounded-lg text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                      maxLength={MAX_PASSPHRASE_LENGTH}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded hover:bg-accent transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPassphrase ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        )}
                      </svg>
                    </button>
                  </div>
                  <div className="text-xs text-text-secondary text-right mt-1">
                    {passphrase.length} / {MAX_PASSPHRASE_LENGTH}
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isDecrypting || !passphrase.trim() || passphrase.length > MAX_PASSPHRASE_LENGTH}
                  className="w-full h-12 bg-button hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed text-text font-medium rounded-lg transition-colors"
                >
                  {isDecrypting ? 'Decrypting...' : 'Decrypt Note'}
                </button>
              </form>
            )}

            {/* show loading state */}
            {isDecrypting && (
              <div className="text-center">
                <p>Decrypting...</p>
              </div>
            )}

            {/* show error if no salt and no key */}
            {noteData && !noteData.salt && !window.location.hash && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error">
                No decryption key found. This note requires a key in the URL.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-6 bg-surface border border-border rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Your Note</h2>
                <button
                  onClick={copyToClipboard}
                  className="p-2 hover:bg-accent rounded transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <span className="text-sm font-medium text-text leading-none flex items-center h-5">Copied!</span>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="p-4 bg-input border border-border rounded-lg">
                <pre className="text-text whitespace-pre-wrap font-mono">{note}</pre>
              </div>
              <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-warning text-sm">
                  ⚠️ This note has been destroyed and can no longer be accessed.
                </p>
              </div>
            </div>

            <a
              href="/"
              className="block w-full h-12 bg-button hover:bg-button-hover text-text font-medium rounded-lg transition-colors text-center leading-[48px]"
            >
              Create New Note
            </a>
          </div>
        )}
      </div>
    </div>
  );
} 