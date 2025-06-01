import { JSDOM } from 'jsdom';
import { TextEncoder, TextDecoder } from 'util';

describe('Frontend View (decrypt message)', () => {
  let window, document;
  beforeEach(() => {
    const dom = new JSDOM(`
      <html><body>
        <div id="content"></div>
      </body></html>
    `, { url: 'http://localhost' });
    window = dom.window;
    document = window.document;
    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;
    Object.defineProperty(window, 'crypto', {
      value: {
        subtle: {
          importKey: async () => 'key',
          decrypt: async () => new TextEncoder().encode('decrypted')
        }
      },
      configurable: true
    });
  });
  test('decrypts message client-side', async () => {
    const encrypted = new Uint8Array([1,2,3]);
    const key = await window.crypto.subtle.importKey();
    const decrypted = await window.crypto.subtle.decrypt({}, key, encrypted);
    const decoded = new window.TextDecoder().decode(decrypted);
    expect(decoded).toBe('decrypted');
  });
}); 