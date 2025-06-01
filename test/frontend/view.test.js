import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { TextEncoder, TextDecoder } from 'util';

describe('Frontend View Tests', () => {
    let dom;
    let window;
    let document;
    let crypto;
    let mockMessageData;

    beforeEach(async () => {
        // Set up JSDOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div id="content">
                        <input type="password" id="passphrase" />
                        <button id="decrypt-btn">Decrypt</button>
                        <div id="toggle-pass">
                            <img id="eye-icon" src="/glyphs/invisible.png" alt="Show" />
                        </div>
                        <div id="decrypt-error"></div>
                    </div>
                    <div id="status"></div>
                </body>
            </html>
        `, {
            url: 'http://localhost:3000/shout/test-id',
            contentType: 'text/html',
            runScripts: 'dangerously',
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;

        // Add TextEncoder and TextDecoder to window
        window.TextEncoder = TextEncoder;
        window.TextDecoder = TextDecoder;

        // Mock crypto API
        crypto = {
            subtle: {
                importKey: jest.fn().mockImplementation(async (format, keyData, algorithm) => {
                    if (algorithm === 'PBKDF2') {
                        return 'mock-pbkdf2-key';
                    }
                    return 'mock-aes-key';
                }),
                deriveKey: jest.fn().mockResolvedValue('mock-derived-key'),
                decrypt: jest.fn().mockImplementation(async () => {
                    return new TextEncoder().encode('decrypted message');
                })
            }
        };

        Object.defineProperty(window, 'crypto', {
            value: crypto,
            writable: true,
            configurable: true
        });

        // Mock fetch
        window.fetch = jest.fn().mockImplementation((url) => {
            if (url.includes('/data')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        id: 'test-id',
                        message: btoa('encrypted-message'),
                        iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
                        salt: null, // No salt for URL key decryption
                        deleteToken: 'test-delete-token'
                    })
                });
            }
            return Promise.resolve({ ok: true });
        });

        // Mock clipboard API
        window.navigator.clipboard = {
            writeText: jest.fn().mockResolvedValue(undefined)
        };

        // Load and execute view.js in the JSDOM environment
        const viewJs = fs.readFileSync(path.resolve('public/js/view.js'), 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = viewJs;
        document.body.appendChild(scriptEl);

        // Wait for the initial fetch request and view initialization
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('passphrase visibility toggle works', async () => {
        const toggleBtn = document.getElementById('toggle-pass');
        const passInput = document.getElementById('passphrase');
        const eyeIcon = document.getElementById('eye-icon');

        // Initial state
        expect(passInput.type).toBe('password');
        expect(eyeIcon.src).toContain('invisible.png');

        // Click to show
        toggleBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(passInput.type).toBe('text');
        expect(eyeIcon.src).toContain('visible.png');

        // Click to hide
        toggleBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(passInput.type).toBe('password');
        expect(eyeIcon.src).toContain('invisible.png');
    });

    test('decrypts message with passphrase', async () => {
        // Set up test data
        await window.initializeView({
            id: 'test-id',
            message: btoa('encrypted-message'),
            iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            salt: btoa('test-salt').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            deleteToken: 'test-delete-token'
        });

        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');

        // Wait for event handlers to be set up
        await new Promise(resolve => setTimeout(resolve, 100));

        passInput.value = 'test-passphrase';
        decryptBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(crypto.subtle.importKey).toHaveBeenCalledWith(
            'raw',
            expect.any(Uint8Array),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        expect(crypto.subtle.deriveKey).toHaveBeenCalled();
        expect(crypto.subtle.decrypt).toHaveBeenCalled();

        // Check if message is displayed
        const messageContent = document.querySelector('.message-content');
        expect(messageContent).toBeTruthy();
        expect(messageContent.textContent).toBe('decrypted message');
    });

    test('decrypts message with URL key', async () => {
        // Set up URL hash with key
        window.location.hash = '#k=dGVzdC1rZXk='; // base64url encoded "test-key"
        
        // Mock fetch response for this specific test
        window.fetch = jest.fn().mockImplementation((url) => {
            if (url.includes('/data')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        id: 'test-id',
                        message: btoa('encrypted-message'),
                        iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
                        salt: null, // No salt for URL key decryption
                        deleteToken: 'test-delete-token'
                    })
                });
            }
            return Promise.resolve({ ok: true });
        });

        // Reset crypto mocks
        crypto.subtle.importKey.mockClear();
        crypto.subtle.decrypt.mockClear();

        // Set up test data
        await window.initializeView({
            id: 'test-id',
            message: btoa('encrypted-message'),
            iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            salt: null,
            deleteToken: 'test-delete-token'
        });

        // Hide content to simulate URL key decryption
        document.getElementById('content').style.display = 'none';
        
        // Call decryptMessage directly with null passphrase to trigger URL key decryption
        await window.decryptMessage(null);
        
        // Wait for decryption to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify importKey was called with correct parameters
        expect(crypto.subtle.importKey).toHaveBeenCalled();
        const importKeyCall = crypto.subtle.importKey.mock.calls[0];
        expect(importKeyCall[0]).toBe('raw');
        expect(importKeyCall[2]).toEqual({ name: 'AES-GCM' });
        expect(importKeyCall[3]).toBe(false);
        expect(importKeyCall[4]).toEqual(['decrypt']);

        // Verify decrypt was called with correct parameters
        expect(crypto.subtle.decrypt).toHaveBeenCalled();
        const decryptCall = crypto.subtle.decrypt.mock.calls[0];
        expect(decryptCall[0].name).toBe('AES-GCM');
        expect(ArrayBuffer.isView(decryptCall[0].iv)).toBe(true);
        expect(decryptCall[1]).toBe('mock-aes-key');
        expect(ArrayBuffer.isView(decryptCall[2])).toBe(true);

        // Check if message is displayed
        const messageContent = document.querySelector('.message-content');
        expect(messageContent).toBeTruthy();
        expect(messageContent.textContent).toBe('decrypted message');
    });

    test('handles empty passphrase error', async () => {
        // Set up test data
        await window.initializeView({
            id: 'test-id',
            message: btoa('encrypted-message'),
            iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            salt: btoa('test-salt').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            deleteToken: 'test-delete-token'
        });

        const decryptBtn = document.getElementById('decrypt-btn');
        const errorBox = document.getElementById('decrypt-error');

        // Wait for event handlers to be set up
        await new Promise(resolve => setTimeout(resolve, 100));

        decryptBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(errorBox.textContent).toBe('Please enter a passphrase.');
    });

    test('handles passphrase too long error', async () => {
        // Set up test data
        await window.initializeView({
            id: 'test-id',
            message: btoa('encrypted-message'),
            iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            salt: btoa('test-salt').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            deleteToken: 'test-delete-token'
        });

        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');
        const errorBox = document.getElementById('decrypt-error');

        // Wait for event handlers to be set up
        await new Promise(resolve => setTimeout(resolve, 100));

        passInput.value = 'a'.repeat(129);
        decryptBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(errorBox.textContent).toBe('Passphrase must be less than 128 characters.');
    });

    test('handles decryption error', async () => {
        // Set up test data
        await window.initializeView({
            id: 'test-id',
            message: btoa('encrypted-message'),
            iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            salt: btoa('test-salt').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            deleteToken: 'test-delete-token'
        });

        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');
        const errorBox = document.getElementById('decrypt-error');

        // Mock decrypt to fail
        crypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

        // Wait for event handlers to be set up
        await new Promise(resolve => setTimeout(resolve, 100));

        passInput.value = 'test-passphrase';
        decryptBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(errorBox.textContent).toBe('Failed to decrypt message. Please check your passphrase and try again.');
    });

    test('handles message deletion after decryption', async () => {
        // Set up test data
        await window.initializeView({
            id: 'test-id',
            message: btoa('encrypted-message'),
            iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            salt: btoa('test-salt').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            deleteToken: 'test-delete-token'
        });

        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');

        // Wait for event handlers to be set up
        await new Promise(resolve => setTimeout(resolve, 100));

        passInput.value = 'test-passphrase';
        decryptBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify delete request was made
        expect(window.fetch).toHaveBeenCalledWith(
            '/api/shout/test-id',
            expect.objectContaining({
                method: 'DELETE',
                headers: expect.objectContaining({
                    'x-delete-token': 'test-delete-token'
                })
            })
        );
    });

    test('handles copy button functionality', async () => {
        // Set up test data
        await window.initializeView({
            id: 'test-id',
            message: btoa('encrypted-message'),
            iv: btoa('test-iv').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            salt: btoa('test-salt').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            deleteToken: 'test-delete-token'
        });

        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');

        // Wait for event handlers to be set up
        await new Promise(resolve => setTimeout(resolve, 100));

        passInput.value = 'test-passphrase';
        decryptBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));

        const copyBtn = document.querySelector('.icon-button');
        expect(copyBtn).toBeTruthy();
        copyBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('decrypted message');
    });
}); 