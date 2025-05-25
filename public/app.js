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

    //click handler
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
            const passphrase = document.getElementById("passphrase").value.trim();

            let encryptionResult;
            if (passphrase) {
                encryptionResult = await encryptWithPassphrase(message, passphrase);
            } else {
                encryptionResult = await encrypt(message);
            }

            const { ciphertext, key, iv, salt } = encryptionResult;
            const body = { message: ciphertext, iv };

            if (salt) body.salt = salt;

            const response = await fetch("/api/shout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                result.textContent = "Failed to send message.";
                return;
            }

            const data = await response.json();

            if (passphrase) {
                result.innerHTML = `🔐 Message sent. Share this link and passphrase separately:<br><a href="${location.origin}${data.url}" target="_blank">${location.origin}${data.url}</a>`;
            } else {
                const fullUrl = `${location.origin}${data.url}#k=${encodeURIComponent(key)}`;
                result.innerHTML = `🔗 Your secret link: <a href="${fullUrl}" target="_blank">${fullUrl}</a>`;
            }

        } catch (err) {
            result.textContent = "Encryption or network error occurred.";
            console.error(err);
        }
    });
});

function uint8ArrayToBase64(u8) {
    return btoa(String.fromCharCode(...u8));
}

function uint8ArrayToBase64url(u8) {
  const base64 = btoa(String.fromCharCode(...u8));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function encrypt(plaintext) {
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
        ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
        key: uint8ArrayToBase64(new Uint8Array(rawKey)),
        iv: uint8ArrayToBase64url(iv),
    };
}

async function encryptWithPassphrase(plaintext, passphrase) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(plaintext)
    );

    return {
        ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
        key: null, // no key in URL
        iv: uint8ArrayToBase64url(iv),
        salt: uint8ArrayToBase64url(salt)
    };
}