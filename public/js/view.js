// Initial visibility check
const content = document.getElementById("content");
const status = document.getElementById("status");
const MAX_KEY_LENGTH = 512; // Maximum length for URL key param

// Hide content until we verify message exists
content.style.display = "none";
status.style.display = "none";

// Check if message exists first
(async () => {
  const id = location.pathname.split("/").pop();
  try {
    const res = await fetch(`/api/shout/${id}/data`);
    if (!res.ok) {
      location.replace("/404.html");
      return;
    }
    initializeView(await res.json());
  } catch {
    location.replace("/404.html");
  }
})();

//main view
async function initializeView(data) {
  const errorBox = document.getElementById("decrypt-error");

  //decrypt with enter button
  document.getElementById("passphrase").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("decrypt-btn").click();
    }
  });

  //passphrase glyph handler
  document.getElementById("toggle-pass").addEventListener("click", () => {
    const passInput = document.getElementById("passphrase");
    const eyeIcon = document.getElementById("eye-icon");
    const isHidden = passInput.type === "password";

    passInput.type = isHidden ? "text" : "password";
    eyeIcon.src = `/glyphs/${isHidden ? "visible" : "invisible"}.png`;
    eyeIcon.alt = isHidden ? "Hide" : "Show";
  });

  //inject shout data into view.html
  const container = document.createElement("div");
  container.id = "data";
  container.dataset.message = data.message;
  container.dataset.iv = data.iv;
  container.dataset.salt = data.salt;
  container.dataset.deleteToken = data.deleteToken;
  container.dataset.messageId = data.id;
  document.body.appendChild(container);

  const hasSalt = Boolean(data.salt);
  const hash = location.hash.slice(1);
  const keyParam = new URLSearchParams(hash).get("k");

  //show content and status now that we have data
  content.style.display = "block";
  status.style.display = "block";

  if (!hasSalt && keyParam) {
    //validate keyParam
    if (
      !/^[A-Za-z0-9\-_]+$/.test(keyParam || "") ||
      keyParam.length > MAX_KEY_LENGTH
    ) {
      errorBox.textContent = "Invalid key format or length.";
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
}

//conversion helpers
function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function base64urlToBytes(b64url) {
  const padLength = (4 - (b64url.length % 4)) % 4;
  const base64 =
    b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
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

  const messageId = container.dataset.messageId;
  const ciphertext = base64ToBytes(container.dataset.message);
  const iv = base64urlToBytes(container.dataset.iv);
  const saltB64 = container.dataset.salt;
  const deleteToken = container.dataset.deleteToken;

  try {
    let key;
    let keyBytes;
    let salt;

    if (passphrase === null) {
      //no passphrase
      const hash = location.hash.slice(1);
      const keyParam = new URLSearchParams(hash).get("k");
      if (!keyParam) throw new Error("Missing decryption key.");
      keyBytes = base64urlToBytes(keyParam);
      key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );
    } else if (saltB64) {
      //passphrase required
      const enc = new TextEncoder();
      salt = base64urlToBytes(saltB64);

      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(passphrase),
        "PBKDF2",
        false,
        ["deriveKey"],
      );

      key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt,
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );
    } else {
      status.textContent = "No decryption key or passphrase found.";
      return;
    }

    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    const plaintext = new TextDecoder().decode(plaintextBuffer);

    // Clean up sensitive data from memory
    if (keyBytes) keyBytes.fill(0);
    if (salt) salt.fill(0);
    if (iv) iv.fill(0);
    if (typeof passphrase === "string") {
      passphrase = "0".repeat(passphrase.length);
    }

    //delete the message after successful decryption
    try {
      const deleteResponse = await fetch(`/api/shout/${messageId}`, {
        method: "DELETE",
        headers: {
          "x-delete-token": deleteToken,
        },
      });
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error("Failed to delete message:", errorText);
        throw new Error("Failed to delete message: " + errorText);
      }
    } catch (deleteErr) {
      console.error("Error deleting message:", deleteErr);
      //continue showing the message even if deletion fails
    }

    //clear any previous content
    status.textContent = "";

    //create message container
    const messageContainer = document.createElement("div");
    messageContainer.className = "message-container";

    //create actions container
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "message-actions";

    //create copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "icon-button";
    copyBtn.setAttribute("aria-label", "Copy message");
    const copyIcon = document.createElement("img");
    copyIcon.src = "/glyphs/copy.png";
    copyIcon.alt = "";
    copyIcon.width = 20;
    copyIcon.height = 20;
    copyBtn.appendChild(copyIcon);
    actionsContainer.appendChild(copyBtn);

    //create message content
    const messageContent = document.createElement("pre");
    messageContent.className = "message-content";
    messageContent.textContent = plaintext;

    //create warning message
    const warning = document.createElement("p");
    warning.className = "warning";
    warning.textContent =
      "This message has been deleted from the server and cannot be accessed again";

    //assemble components
    messageContainer.appendChild(actionsContainer);
    messageContainer.appendChild(messageContent);
    messageContainer.appendChild(warning);

    status.appendChild(messageContainer);

    //hide the decrypt form
    document.getElementById("content").style.display = "none";

    //add copy button functionality
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(plaintext).then(() => {
        copyIcon.src = "/glyphs/check.gif";
        setTimeout(() => {
          copyIcon.src = "/glyphs/copy.png";
        }, 1000);
      });
    });

    //hide the decrypt form since we're done with it
    document.getElementById("content").style.display = "none";
  } catch (err) {
    // Clean up sensitive data on error
    if (typeof passphrase === "string") {
      passphrase = "0".repeat(passphrase.length);
    }
    console.error(err);
    errorBox.textContent =
      "Failed to decrypt message. Please check your passphrase and try again.";
  }
}
