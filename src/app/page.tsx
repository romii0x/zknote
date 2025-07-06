'use client';

import { useState } from 'react';

function generatePassphrase(length = 32) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return pass;
}

const EXPIRY_OPTIONS = [
  { value: 60000, label: '1 min' },
  { value: 180000, label: '3 min' },
  { value: 300000, label: '5 min' },
  { value: 600000, label: '10 min' },
  { value: 3600000, label: '1 hour' },
  { value: 86400000, label: '24 hours' },
  { value: 604800000, label: '1 week' },
];

const MAX_NOTE_LENGTH = 100000;
const MAX_PASSPHRASE_LENGTH = 128;

// conversion helpers
function uint8ArrayToBase64(u8: Uint8Array): string {
  return btoa(String.fromCharCode(...u8));
}

function uint8ArrayToBase64url(u8: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...u8));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// encrypt with random key
async function encrypt(plaintext: string) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    key: uint8ArrayToBase64url(new Uint8Array(rawKey)),
    iv: uint8ArrayToBase64url(iv),
  };
}

// encrypt with passphrase
async function encryptWithPassphrase(plaintext: string, passphrase: string) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );

  const result = {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    key: null, // no key in URL
    iv: uint8ArrayToBase64url(iv),
    salt: uint8ArrayToBase64url(salt),
  };

  // clean up sensitive data from memory
  iv.fill(0);
  salt.fill(0);

  return result;
}

export default function Home() {
  const [note, setNote] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [expiry, setExpiry] = useState(86400000);
  const [isCreating, setIsCreating] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Message cannot be empty.');
      return;
    }
    if (note.length > MAX_NOTE_LENGTH) {
      setError('Message exceeds 100000 character limit.');
      return;
    }
    if (passphrase.length > MAX_PASSPHRASE_LENGTH) {
      setError('Passphrase must be less than 128 characters.');
      return;
    }

    setIsCreating(true);
    setError(null);
    
    try {
      let encryptionResult;
      if (passphrase.trim()) {
        encryptionResult = await encryptWithPassphrase(note, passphrase);
      } else {
        encryptionResult = await encrypt(note);
      }

      const { ciphertext, key, iv, ...rest } = encryptionResult;
      const body: any = { message: ciphertext, iv, expiry };

      if ('salt' in rest) body.salt = rest.salt;

      const response = await fetch('/api/note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to create note');
        return;
      }
      
      const data = await response.json();
      setNoteId(data.id);
      setExpiresAt(new Date(Date.now() + expiry).toISOString());
      
      // generate share URL based on mode using the URL from API response
      if (passphrase.trim()) {
        // with passphrase: just the URL, no passphrase in URL
        setShareUrl(`${window.location.origin}${data.url}`);
      } else {
        // without passphrase: key in URL hash
        setShareUrl(`${window.location.origin}${data.url}#k=${encodeURIComponent(key as string)}`);
      }
      
      setNote('');
    } catch (err) {
      setError('Encryption or network error occurred.');
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const togglePassphraseVisibility = () => {
    setShowPassphrase(!showPassphrase);
  };

  return (
    <div className="min-h-screen bg-page text-text flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">zknote</h1>
          <p className="text-text-secondary">Send encrypted, self-destructing messages</p>
        </div>
        
        {!noteId ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <textarea
                id="note"
                value={note}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= MAX_NOTE_LENGTH) {
                    setNote(value);
                  }
                }}
                placeholder="Write your secret message..."
                className="w-full h-64 p-4 bg-input border border-border rounded-lg text-text placeholder-text-secondary resize-y focus:outline-none focus:ring-2 focus:ring-accent"
                maxLength={MAX_NOTE_LENGTH}
                spellCheck={false}
                required
              />
              <div className="text-xs text-text-secondary text-right mt-1">
                {note.length} / {MAX_NOTE_LENGTH}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-1">
                <input
                  type={showPassphrase ? "text" : "password"}
                  id="passphrase"
                  value={passphrase}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= MAX_PASSPHRASE_LENGTH) {
                      setPassphrase(value);
                    }
                  }}
                  placeholder="Leave blank for auto-generated key..."
                  className="w-full px-4 h-12 pr-10 bg-input border border-border rounded-lg text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  maxLength={MAX_PASSPHRASE_LENGTH}
                  autoComplete="new-password"
                  aria-label="Encryption passphrase"
                />
                <button
                  type="button"
                  onClick={togglePassphraseVisibility}
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
              <select
                id="expiry"
                value={expiry}
                onChange={(e) => setExpiry(Number(e.target.value))}
                className="min-w-[120px] px-4 h-12 bg-input border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {EXPIRY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-center">
              <button 
                type="submit"
                disabled={isCreating || note.length === 0}
                className="h-12 bg-button hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed text-text font-medium rounded-lg transition-colors px-6"
              >
                {isCreating ? 'Creating...' : 'Generate Link'}
              </button>
            </div>
            
            {error && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error">
                {error}
              </div>
            )}
          </form>
        ) : (
          <div className="space-y-6">
            <div className="p-6 bg-surface border border-border rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Note Created!</h2>
              <p className="text-text-secondary mb-4">
                Your note has been encrypted and stored. Share this link with the recipient:
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 p-3 bg-input border border-border rounded">
                  <input
                    type="text"
                    value={shareUrl || ''}
                    readOnly
                    className="flex-1 bg-transparent text-text outline-none"
                  />
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
                {passphrase.trim() && (
                  <div className="text-xs text-text-secondary">
                    <span className="font-semibold">Passphrase:</span> <span className="font-mono">{passphrase}</span>
                  </div>
                )}
                <div className="text-xs text-text-secondary">
                  <span className="font-semibold">Expires:</span> {expiresAt && new Date(expiresAt).toLocaleString()}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setNoteId(null);
                setError(null);
                setShareUrl(null);
                setPassphrase('');
              }}
              className="w-full h-12 bg-button hover:bg-button-hover text-text font-medium rounded-lg transition-colors"
            >
              Create Another Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
