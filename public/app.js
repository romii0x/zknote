document.getElementById("send").addEventListener("click", async () => {
  const message = document.getElementById("message").value;
  const passphrase = document.getElementById("passphrase").value;
  const result = document.getElementById("result");

  if (!message.trim()) {
    result.textContent = "Message cannot be empty.";
    return;
  }

  const response = await fetch("/api/shout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, passphrase }),
  });

  if (!response.ok) {
    result.textContent = "Failed to send message.";
    return;
  }

  const data = await response.json();
  const fullUrl = `${location.origin}${data.url}`;
  result.innerHTML = `🔗 Your secret link: <a href="${fullUrl}" target="_blank">${fullUrl}</a>`;
});
