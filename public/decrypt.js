function base64ToBytes(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function base64urlToBytes(b64url) {
    const padLength = (4 - (b64url.length % 4)) % 4;
    const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
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
    const saltB64 = container.dataset.salt;

    const ciphertext = base64ToBytes(ciphertextB64);
    const iv = base64urlToBytes(ivB64);

    const hash = location.hash;
    const keyParam = new URLSearchParams(hash.slice(1)).get("k");

    try {
        let key;

        if (keyParam) {
            //no passphrase
            const keyBytes = base64urlToBytes(keyParam);
            key = await crypto.subtle.importKey(
                "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
            );
        } else if (saltB64) {
            //passphrase required
            const passphrase = prompt("Enter passphrase to decrypt message:");
            if (!passphrase) {
                status.textContent = "No passphrase entered.";
                return;
            }

            const enc = new TextEncoder();
            const salt = base64urlToBytes(saltB64);

            const keyMaterial = await crypto.subtle.importKey(
                "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
            );

            key = await crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["decrypt"]
            );
        } else {
            status.textContent = "No decryption key or passphrase found.";
            return;
        }

        const plaintextBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );

        const plaintext = new TextDecoder().decode(plaintextBuffer);
        status.innerHTML = `<pre>${plaintext}</pre>`;

        //delete message after decryption
        await fetch('/api/shout/' + messageId, { method: 'DELETE' });

    } catch (err) {
        console.error(err);
        status.textContent = "❌ Failed to decrypt message. Wrong key or passphrase?";
    }
}

decryptMessage();