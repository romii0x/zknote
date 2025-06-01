import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Frontend View Tests', () => {
    let dom;
    let window;
    let document;
    let crypto;
    let mockMessageData;

    beforeEach(() => {
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
            url: 'http://localhost/shout/test-id',
            contentType: 'text/html',
            runScripts: 'dangerously',
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;

        // Mock crypto API
        crypto = {
            subtle: {
                importKey: jest.fn().mockResolvedValue('mock-imported-key'),
                deriveKey: jest.fn().mockResolvedValue('mock-derived-key'),
                decrypt: jest.fn().mockResolvedValue(new TextEncoder().encode('decrypted message'))
            }
        };

        Object.defineProperty(window, 'crypto', {
            value: crypto,
            writable: true
        });

        window.TextEncoder = TextEncoder;
        window.TextDecoder = TextDecoder;

        // Mock message data
        mockMessageData = {
            id: 'test-id',
            message: 'encrypted-message-base64',
            iv: 'test-iv',
            salt: 'test-salt',
            deleteToken: 'test-delete-token'
        };

        // Mock fetch
        window.fetch = jest.fn().mockImplementation((url) => {
            if (url.includes('/data')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockMessageData)
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
        });

        // Mock clipboard API
        window.navigator.clipboard = {
            writeText: jest.fn().mockResolvedValue(undefined)
        };

        // Load and execute view.js in the JSDOM environment
        const viewJs = fs.readFileSync(path.resolve('public/js/view.js'), 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = `
            ${viewJs}
            // Initialize the view
            document.addEventListener('DOMContentLoaded', () => {
                initializeView();
            });
        `;
        document.body.appendChild(scriptEl);

        // Trigger DOMContentLoaded
        window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    });

    test('passphrase visibility toggle works', () => {
        const toggleBtn = document.getElementById('toggle-pass');
        const passInput = document.getElementById('passphrase');
        const eyeIcon = document.getElementById('eye-icon');

        // Initial state
        expect(passInput.type).toBe('password');
        expect(eyeIcon.src).toContain('invisible.png');

        // Click to show
        toggleBtn.click();
        expect(passInput.type).toBe('text');
        expect(eyeIcon.src).toContain('visible.png');

        // Click to hide
        toggleBtn.click();
        expect(passInput.type).toBe('password');
        expect(eyeIcon.src).toContain('invisible.png');
    });

    test('decrypts message with passphrase', async () => {
        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');
        const status = document.getElementById('status');

        passInput.value = 'test-passphrase';
        await decryptBtn.click();

        expect(crypto.subtle.importKey).toHaveBeenCalled();
        expect(crypto.subtle.deriveKey).toHaveBeenCalled();
        expect(crypto.subtle.decrypt).toHaveBeenCalled();

        // Check if message is displayed
        expect(status.querySelector('.message-content')).toBeTruthy();
        expect(status.querySelector('.message-content').textContent).toBe('decrypted message');
    });

    test('decrypts message with URL key', async () => {
        // Simulate key in URL hash
        window.location.hash = '#k=test-key';
        
        // Trigger decryption
        document.getElementById('content').style.display = 'none';
        
        expect(crypto.subtle.importKey).toHaveBeenCalled();
        expect(crypto.subtle.decrypt).toHaveBeenCalled();
    });

    test('handles empty passphrase error', async () => {
        const decryptBtn = document.getElementById('decrypt-btn');
        const errorBox = document.getElementById('decrypt-error');

        await decryptBtn.click();
        expect(errorBox.textContent).toBe('Please enter a passphrase.');
    });

    test('handles passphrase too long error', async () => {
        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');
        const errorBox = document.getElementById('decrypt-error');

        passInput.value = 'a'.repeat(129);
        await decryptBtn.click();
        expect(errorBox.textContent).toBe('Passphrase must be less than 128 characters.');
    });

    test('handles decryption error', async () => {
        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');
        const errorBox = document.getElementById('decrypt-error');

        // Mock decrypt to fail
        crypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

        passInput.value = 'test-passphrase';
        await decryptBtn.click();

        expect(errorBox.textContent).toBe('Failed to decrypt message. Please check your passphrase and try again.');
    });

    test('handles message deletion after decryption', async () => {
        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');

        passInput.value = 'test-passphrase';
        await decryptBtn.click();

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
        const passInput = document.getElementById('passphrase');
        const decryptBtn = document.getElementById('decrypt-btn');

        passInput.value = 'test-passphrase';
        await decryptBtn.click();

        const copyBtn = document.querySelector('.icon-button');
        await copyBtn.click();

        expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('decrypted message');
    });
}); 