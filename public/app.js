document.addEventListener("DOMContentLoaded", () => {
    const sendBtn = document.getElementById("send");
    const textarea = document.getElementById("message");
    const result = document.getElementById("result");
    const charCount = document.getElementById("char-count");

    
    //check webcrypto support
    if (window.crypto?.subtle) {
        sendBtn.disabled = false;
    } else {
        document.getElementById("result").textContent = "Your browser doesn't support secure encryption.";
    }

    //character limit
    textarea.addEventListener("input", () => {
    charCount.textContent = `${textarea.value.length} / 5000`;
    });

    document.getElementById("send").addEventListener("click", async () => {
        const message = textarea.value;

        if (!message.trim()) {
            result.textContent = "Message cannot be empty.";
            return;
        }

        if (message.length > 5000) {
            result.textContent = "Message exceeds 5000 character limit.";
            return;
        }

        try {
            const { ciphertext, key, iv } = await encryptMessage(message);

            const response = await fetch("/api/shout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: ciphertext, iv }),
            });

            if (!response.ok) {
                result.textContent = "Failed to send message.";
                return;
            }

            const data = await response.json();
            const fullUrl = `${location.origin}${data.url}#k=${encodeURIComponent(key)}`;
            result.innerHTML = `🔗 Your secret link: <a href="${fullUrl}" target="_blank">${fullUrl}</a>`;

        } catch (err) {
            result.textContent = "Encryption or network error occurred.";
            console.error(err);
        }
    });
});

function uint8ArrayToBase64url(u8) {
  const base64 = btoa(String.fromCharCode(...u8));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function encryptMessage(plaintext) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const rawKey = await crypto.subtle.exportKey("raw", key);
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(plaintext)
    );

    return {
        ciphertext: uint8ArrayToBase64url(new Uint8Array(ciphertext)),
        key: uint8ArrayToBase64url(new Uint8Array(rawKey)),
        iv: uint8ArrayToBase64url(iv),
    };
}
