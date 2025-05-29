document.addEventListener("DOMContentLoaded", async () => {
    const id = location.pathname.split("/").pop();
    const status = document.getElementById("status");
    const errorBox = document.getElementById("decrypt-error");

    //passphrase glyph handler
    document.getElementById("toggle-pass").addEventListener("click", () => {
        const passInput = document.getElementById("passphrase");
        const eyeIcon = document.getElementById("eye-icon");
        const isHidden = passInput.type === "password";
        passInput.type = isHidden ? "text" : "password";
        eyeIcon.src = isHidden ? "/glyphs/visible.png" : "/glyphs/invisible.png";
        eyeIcon.alt = isHidden ? "Hide" : "Show";
    });

    try {
        //request shout data from server
        const res = await fetch(`/api/shout/${id}/data`);
        if (!res.ok) {
            status.textContent = "Message not found or expired.";
        return;
        }
        const data = await res.json();

        //inject shout data into view.html
        const container = document.createElement("div");
        container.id = "data";
        container.dataset.id = data.id;
        container.dataset.message = data.message;
        container.dataset.iv = data.iv;
        container.dataset.salt = data.salt;
        document.body.appendChild(container);

        const hasSalt = Boolean(data.salt);
        const hash = location.hash.slice(1);
        const keyParam = new URLSearchParams(hash).get("k");

        if (!hasSalt && keyParam) {
            //validate keyParam
            if (!/^[A-Za-z0-9\-_]+$/.test(keyParam || "")) {
                errorBox.textContent = "Invalid key format.";
                return;
            }
            document.getElementById("content").style.display = "none";
            decryptMessage(null); //no passphrase, decrypt immediately
        } else if (hasSalt) {
            //passphrase required
            document.getElementById("decrypt-btn").addEventListener("click", () => {
                const passphrase = document.getElementById("passphrase").value.trim();
                if (!passphrase) {
                    errorBox.textContent = "Please enter a passphrase.";
                    return;
                }
                if (passphrase.length > 128) {
                    errorBox.textContent = "Passphrase must be less than 128 characters.";
                    return;
                }
                errorBox.textContent = "";
                decryptMessage(passphrase);
            });
        } else {
            errorBox.textContent = "No decryption key or passphrase found.";
        }
    } catch (err) {
        console.error(err);
        status.textContent = err.message;
    }
});
    

//conversion helpers
function base64ToBytes(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function base64urlToBytes(b64url) {
    const padLength = (4 - (b64url.length % 4)) % 4;
    const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

//decrypt message
async function decryptMessage(passphrase) {
    const status = document.getElementById("status");
    const container = document.getElementById("data");
    if (!container) {
        status.textContent = "Missing decryption data.";
        return;
    }
    const errorBox = document.getElementById("decrypt-error");

    const messageId = container.dataset.id;
    const ciphertext = base64ToBytes(container.dataset.message);
    const iv = base64urlToBytes(container.dataset.iv);
    const saltB64 = container.dataset.salt;
    
    try {
        let key;

        if (passphrase === null) {
            //no passphrase
            const hash = location.hash.slice(1);
            const keyParam = new URLSearchParams(hash).get("k");
            if (!keyParam) throw new Error("Missing decryption key.");
            const keyBytes = base64urlToBytes(keyParam);
            key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
        } else if (saltB64) {
            //passphrase required
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
        
        // Delete the message after successful decryption
        try {
            const deleteResponse = await fetch(`/api/shout/${messageId}`, {
                method: 'DELETE'
            });
            if (!deleteResponse.ok) {
                console.error('Failed to delete message:', await deleteResponse.text());
            }
        } catch (deleteErr) {
            console.error('Error deleting message:', deleteErr);
        }

        // Create message container with copy button
        status.innerHTML = `
            <div class="message-container">
                <div class="message-actions">
                    <button id="copy-btn" class="icon-button" aria-label="Copy message">
                        <img src="/glyphs/copy.png" alt="" width="20" height="20">
                    </button>
                </div>
                <pre class="message-content">${escapeHtml(plaintext)}</pre>
                <p class="warning">This message has been deleted from the server and cannot be accessed again</p>
            </div>
        `;

        // Add copy button functionality
        document.getElementById("copy-btn").addEventListener("click", () => {
            navigator.clipboard.writeText(plaintext).then(() => {
                const btn = document.getElementById("copy-btn");
                const img = btn.querySelector("img");
                img.src = "/glyphs/check.gif";
                setTimeout(() => {
                    img.src = "/glyphs/copy.png";
                }, 1000);
            });
        });

        // Hide the decrypt form since we're done with it
        document.getElementById("content").style.display = "none";

    } catch (err) {
        console.error(err);
        errorBox.textContent = "Failed to decrypt message. Please check your passphrase and try again.";
    }
}

// Helper function to escape HTML
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}