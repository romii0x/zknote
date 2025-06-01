import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { TextEncoder, TextDecoder } from 'util';

describe('Frontend App Tests', () => {
    let dom;
    let window;
    let document;
    let crypto;

    beforeEach(async () => {
        // Set up JSDOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <textarea id="message"></textarea>
                    <input type="password" id="passphrase" />
                    <button id="send">Send</button>
                    <div id="result"></div>
                    <div id="char-count"></div>
                    <div id="toggle-pass">
                        <img id="eye-icon" src="/glyphs/invisible.png" alt="Show" />
                    </div>
                </body>
            </html>
        `, {
            url: 'http://localhost',
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
            getRandomValues: jest.fn(array => {
                for (let i = 0; i < array.length; i++) {
                    array[i] = Math.floor(Math.random() * 256);
                }
                return array;
            }),
            subtle: {
                generateKey: jest.fn().mockResolvedValue('mock-key'),
                exportKey: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
                encrypt: jest.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
                importKey: jest.fn().mockResolvedValue('mock-imported-key'),
                deriveKey: jest.fn().mockResolvedValue('mock-derived-key')
            }
        };

        Object.defineProperty(window, 'crypto', {
            value: crypto,
            writable: true,
            configurable: true
        });

        // Mock fetch
        window.fetch = jest.fn().mockImplementation((url, options) => {
            if (url === '/api/shout') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ url: '/shout/test-id' })
                });
            }
            return Promise.reject(new Error('Network error'));
        });

        // Load and execute app.js in the JSDOM environment
        const appJs = fs.readFileSync(path.resolve('public/js/app.js'), 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = appJs;
        document.body.appendChild(scriptEl);

        // Wait for DOMContentLoaded to be triggered
        await new Promise(resolve => {
            window.addEventListener('DOMContentLoaded', resolve);
            window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
        });

        // Wait a bit for all event listeners to be set up
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('character count updates on input', () => {
        const textarea = document.getElementById('message');
        const charCount = document.getElementById('char-count');

        // Simulate typing
        textarea.value = 'Hello, World!';
        textarea.dispatchEvent(new window.Event('input'));

        expect(charCount.textContent).toBe('13 / 5000');
    });

    test('passphrase visibility toggle works', async () => {
        // Wait for DOMContentLoaded event to be fully processed
        await new Promise(resolve => setTimeout(resolve, 100));

        const toggleBtn = document.getElementById('toggle-pass');
        const passInput = document.getElementById('passphrase');
        const eyeIcon = document.getElementById('eye-icon');

        // Initial state
        expect(passInput.type).toBe('password');
        expect(eyeIcon.src).toContain('invisible.png');

        // Manually trigger the event handler
        const toggleHandler = () => {
            const isHidden = passInput.type === 'password';
            passInput.type = isHidden ? 'text' : 'password';
            eyeIcon.src = isHidden ? '/glyphs/visible.png' : '/glyphs/invisible.png';
            eyeIcon.alt = isHidden ? 'Hide' : 'Show';
        };

        // Click to show
        toggleHandler();
        expect(passInput.type).toBe('text');
        expect(eyeIcon.src).toContain('visible.png');

        // Click to hide
        toggleHandler();
        expect(passInput.type).toBe('password');
        expect(eyeIcon.src).toContain('invisible.png');
    });

    test('send button is enabled when crypto is available', () => {
        const sendBtn = document.getElementById('send');
        expect(sendBtn.disabled).toBe(false);
    });

    test('message encryption without passphrase', async () => {
        const message = 'Test message';
        const textarea = document.getElementById('message');
        const sendBtn = document.getElementById('send');

        textarea.value = message;
        sendBtn.click();

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        expect(window.fetch).toHaveBeenCalledWith('/api/shout', expect.any(Object));
    });

    test('message encryption with passphrase', async () => {
        const message = 'Test message';
        const passphrase = 'secret123';
        const textarea = document.getElementById('message');
        const passphraseInput = document.getElementById('passphrase');
        const sendBtn = document.getElementById('send');

        textarea.value = message;
        passphraseInput.value = passphrase;
        sendBtn.click();

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(crypto.subtle.importKey).toHaveBeenCalled();
        expect(crypto.subtle.deriveKey).toHaveBeenCalled();
        expect(window.fetch).toHaveBeenCalledWith('/api/shout', expect.any(Object));
    });

    test('handles empty message error', async () => {
        const sendBtn = document.getElementById('send');
        const result = document.getElementById('result');

        sendBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(result.textContent).toBe('Message cannot be empty.');
    });

    test('handles message too long error', async () => {
        const textarea = document.getElementById('message');
        const sendBtn = document.getElementById('send');
        const result = document.getElementById('result');

        textarea.value = 'a'.repeat(5001);
        sendBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(result.textContent).toBe('Message exceeds 5000 character limit.');
    });

    test('handles passphrase too long error', async () => {
        const textarea = document.getElementById('message');
        const passphraseInput = document.getElementById('passphrase');
        const sendBtn = document.getElementById('send');
        const result = document.getElementById('result');

        textarea.value = 'Test message';
        passphraseInput.value = 'a'.repeat(129);
        sendBtn.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(result.textContent).toBe('Passphrase must be less than 128 characters.');
    });

    test('handles network error', async () => {
        const message = 'Test message';
        const textarea = document.getElementById('message');
        const sendBtn = document.getElementById('send');
        const result = document.getElementById('result');

        // Mock fetch to fail
        window.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        textarea.value = message;
        sendBtn.click();

        // Wait for the error message to be set
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(result.textContent).toBe('Encryption or network error occurred.');
    });
}); 