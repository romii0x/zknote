function base64ToBytes(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function base64urlToBytes(b64url) {
    const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
        + "===".slice((b64url.length + 3) % 4);
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

async function decryptMessage() {
    const status = document.getElementById("status");
    const container = document.getElementById("data");

    if (!container) {
        status.textContent = "Missing decryption data.";
        return;
    }

    const messageId = container.dataset.id;
    const ciphertextB64 = container.dataset.message;
    const ivB64 = container.dataset.iv;

    const hash = location.hash;
    const keyParam = new URLSearchParams(hash.slice(1)).get("k");

    if (!keyParam) {
        status.textContent = "Missing decryption key in URL.";
        return;
    }

    try {
        const keyBytes = base64ToBytes(keyParam);
        const key = await crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        const ciphertext = base64ToBytes(ciphertextB64);
        const iv = base64urlToBytes(ivB64);

        const plaintextBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );

        const plaintext = new TextDecoder().decode(plaintextBuffer);
        status.innerHTML = `<pre>${plaintext}</pre>`;

        await fetch('/api/shout/' + messageId, { method: 'DELETE' });

    } catch (err) {
        console.error(err);
        status.textContent = "Failed to decrypt message. Invalid key?";
    }
}

decryptMessage();
