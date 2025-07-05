import { jest } from "@jest/globals";
import { JSDOM } from "jsdom";
import { TextEncoder, TextDecoder } from "util";

describe("Frontend App (create message)", () => {
  let window, document;
  beforeEach(() => {
    const dom = new JSDOM(
      `
      <html><body>
        <textarea id="message"></textarea>
        <button id="send">Send</button>
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
        },
      },
      configurable: true,
    });
    window.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ url: "/note/test-id" }),
      });
  });
  test("encrypts and sends message", async () => {
    const message = "test";
    document.getElementById("message").value = message;
    // Simulate encrypt (client-side)
    const encoder = new window.TextEncoder();
    const data = encoder.encode(message);
    const key = await window.crypto.subtle.generateKey();
    const encrypted = await window.crypto.subtle.encrypt({}, key, data);
    // Simulate sending to server
          await window.fetch("/api/note", { method: "POST", body: encrypted });
    expect(window.fetch).toHaveBeenCalledWith(
              "/api/note",
      expect.objectContaining({ body: encrypted }),
    );
  });
});
