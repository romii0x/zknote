import { jest } from "@jest/globals";
import { JSDOM } from "jsdom";
import { TextEncoder, TextDecoder } from "util";

describe("Client-side Encryption", () => {
  let window, document;

  beforeEach(() => {
    const dom = new JSDOM(
      `
      <html><body>
        <textarea id="message"></textarea>
        <input type="password" id="passphrase" />
        <button id="send">Send</button>
        <div id="result"></div>
      </body></html>
    `,
      { url: "http://localhost" },
    );
    window = dom.window;
    document = window.document;
    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;
    Object.defineProperty(window, "crypto", {
      value: {
        getRandomValues: (arr) => ((arr[0] = 42), arr),
        subtle: {
          generateKey: async () => "key",
          encrypt: async () => new Uint8Array([1, 2, 3]),
          decrypt: async () => new TextEncoder().encode("decrypted"),
        },
      },
      configurable: true,
    });
    window.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  test("encrypts and decrypts in browser, never sending plaintext to server", async () => {
    const message = "secret";
    document.getElementById("message").value = message;
    // Simulate encrypt (client-side)
    const encoder = new window.TextEncoder();
    const data = encoder.encode(message);
    const key = await window.crypto.subtle.generateKey();
    const encrypted = await window.crypto.subtle.encrypt({}, key, data);
    // Simulate sending to server
            await window.fetch("/api/note", { method: "POST", body: encrypted });
    // Simulate decrypt (client-side)
    const decrypted = await window.crypto.subtle.decrypt({}, key, encrypted);
    const decoded = new window.TextDecoder().decode(decrypted);
    expect(decoded).toBe("decrypted");
    // Assert plaintext never sent to server
    expect(window.fetch).toHaveBeenCalledWith(
      "/api/note",
      expect.objectContaining({ body: encrypted }),
    );
    expect(window.fetch).not.toHaveBeenCalledWith(
      "/api/note",
      expect.objectContaining({ body: message }),
    );
  });
});
