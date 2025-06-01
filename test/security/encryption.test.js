import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { TextEncoder, TextDecoder } from 'util';

describe('Encryption Security Tests', () => {
    let window;
    let document;
    let crypto;

    beforeEach(() => {
        const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div id="app"></div>
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

        // Mock crypto API with real implementations for key tests
        crypto = {
            getRandomValues: (array) => {
                for (let i = 0; i < array.length; i++) {
                    array[i] = Math.floor(Math.random() * 256);
                }
                return array;
            },
            subtle: {
                generateKey: jest.fn().mockImplementation(async (algorithm) => {
                    expect(algorithm).toEqual({
                        name: 'AES-GCM',
                        length: 256
                    });
                    return 'mock-key';
                }),
                exportKey: jest.fn().mockImplementation(async () => {
                    return new Uint8Array(32); // 256 bits
                }),
                importKey: jest.fn().mockImplementation(async (format, keyData, algorithm) => {
                    if (algorithm === 'PBKDF2') {
                        expect(format).toBe('raw');
                        return 'mock-pbkdf2-key';
                    }
                    expect(format).toBe('raw');
                    expect(algorithm.name).toBe('AES-GCM');
                    return 'mock-aes-key';
                }),
                deriveKey: jest.fn().mockImplementation(async (params, keyMaterial, derivedKeyAlgorithm) => {
                    expect(params.name).toBe('PBKDF2');
                    expect(params.iterations).toBe(100000);
                    expect(params.hash).toBe('SHA-256');
                    expect(derivedKeyAlgorithm.name).toBe('AES-GCM');
                    expect(derivedKeyAlgorithm.length).toBe(256);
                    return 'mock-derived-key';
                }),
                encrypt: jest.fn().mockImplementation(async (params, key, data) => {
                    expect(params.name).toBe('AES-GCM');
                    expect(params.iv).toBeInstanceOf(Uint8Array);
                    expect(params.iv.length).toBe(12);
                    return new Uint8Array([1, 2, 3]); // Mock ciphertext
                }),
                decrypt: jest.fn().mockImplementation(async (params, key, data) => {
                    expect(params.name).toBe('AES-GCM');
                    expect(params.iv).toBeInstanceOf(Uint8Array);
                    expect(params.iv.length).toBe(12);
                    return new TextEncoder().encode('decrypted');
                })
            }
        };

        Object.defineProperty(window, 'crypto', {
            value: crypto,
            writable: true,
            configurable: true
        });

        // Load and execute app.js and view.js in the JSDOM environment
        const appJs = fs.readFileSync(path.resolve('public/js/app.js'), 'utf8');
        const viewJs = fs.readFileSync(path.resolve('public/js/view.js'), 'utf8');
        
        const scriptEl = document.createElement('script');
        scriptEl.textContent = `
            ${appJs}
            ${viewJs}
            window.encrypt = encrypt;
            window.encryptWithPassphrase = encryptWithPassphrase;
            window.decryptMessage = decryptMessage;
        `;
        document.body.appendChild(scriptEl);
    });

    describe('Key Generation', () => {
        test('generates AES-GCM 256-bit keys', async () => {
            const appJs = fs.readFileSync(path.resolve('public/js/app.js'), 'utf8');
            const scriptEl = document.createElement('script');
            scriptEl.textContent = appJs;
            document.body.appendChild(scriptEl);

            await window.encrypt('test message');

            expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        });

        test('uses PBKDF2 with strong parameters for passphrase', async () => {
            const appJs = fs.readFileSync(path.resolve('public/js/app.js'), 'utf8');
            const scriptEl = document.createElement('script');
            scriptEl.textContent = appJs;
            document.body.appendChild(scriptEl);

            await window.encryptWithPassphrase('test message', 'test passphrase');

            expect(crypto.subtle.importKey).toHaveBeenCalledWith(
                'raw',
                expect.any(Uint8Array),
                'PBKDF2',
                false,
                ['deriveKey']
            );

            expect(crypto.subtle.deriveKey).toHaveBeenCalledWith(
                {
                    name: 'PBKDF2',
                    salt: expect.any(Uint8Array),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                'mock-pbkdf2-key',
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        });
    });

    describe('IV Generation', () => {
        test('uses unique 96-bit IV for each encryption', async () => {
            const appJs = fs.readFileSync(path.resolve('public/js/app.js'), 'utf8');
            const scriptEl = document.createElement('script');
            scriptEl.textContent = appJs;
            document.body.appendChild(scriptEl);

            const ivs = new Set();
            for (let i = 0; i < 100; i++) {
                const result = await window.encrypt('test message');
                ivs.add(result.iv);
            }

            // All IVs should be unique
            expect(ivs.size).toBe(100);

            // IV should be base64url encoded and correct length
            const iv = Array.from(ivs)[0];
            expect(iv).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(atob(iv.replace(/-/g, '+').replace(/_/g, '/')).length).toBe(12);
        });
    });

    describe('Salt Generation', () => {
        test('uses unique 128-bit salt for each passphrase encryption', async () => {
            const appJs = fs.readFileSync(path.resolve('public/js/app.js'), 'utf8');
            const scriptEl = document.createElement('script');
            scriptEl.textContent = appJs;
            document.body.appendChild(scriptEl);

            const salts = new Set();
            for (let i = 0; i < 100; i++) {
                const result = await window.encryptWithPassphrase('test message', 'test passphrase');
                salts.add(result.salt);
            }

            // All salts should be unique
            expect(salts.size).toBe(100);

            // Salt should be base64url encoded and correct length
            const salt = Array.from(salts)[0];
            expect(salt).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(atob(salt.replace(/-/g, '+').replace(/_/g, '/')).length).toBe(16);
        });
    });

    describe('Decryption', () => {
        test('decrypts messages with correct key', async () => {
            const viewJs = fs.readFileSync(path.resolve('public/js/view.js'), 'utf8');
            const scriptEl = document.createElement('script');
            scriptEl.textContent = viewJs;
            document.body.appendChild(scriptEl);

            const mockData = {
                message: btoa([1, 2, 3]),
                iv: 'test-iv',
                salt: null
            };

            const decrypted = await window.decryptMessage(null, mockData);
            expect(decrypted).toBe('decrypted');
        });

        test('decrypts messages with correct passphrase', async () => {
            const viewJs = fs.readFileSync(path.resolve('public/js/view.js'), 'utf8');
            const scriptEl = document.createElement('script');
            scriptEl.textContent = viewJs;
            document.body.appendChild(scriptEl);

            const mockData = {
                message: btoa([1, 2, 3]),
                iv: 'test-iv',
                salt: 'test-salt'
            };

            const decrypted = await window.decryptMessage('test passphrase', mockData);
            expect(decrypted).toBe('decrypted');
        });

        test('fails decryption with incorrect key/passphrase', async () => {
            const viewJs = fs.readFileSync(path.resolve('public/js/view.js'), 'utf8');
            const scriptEl = document.createElement('script');
            scriptEl.textContent = viewJs;
            document.body.appendChild(scriptEl);

            crypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

            const mockData = {
                message: btoa([1, 2, 3]),
                iv: 'test-iv',
                salt: 'test-salt'
            };

            await expect(window.decryptMessage('wrong passphrase', mockData))
                .rejects.toThrow('Decryption failed');
        });
    });
}); 