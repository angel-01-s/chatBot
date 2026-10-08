const chatWindow = document.querySelector("#chatWindow");
const openChatButton = document.querySelector("#openChat");
const closeChatButton = document.querySelector("#closeChat");
const form = document.querySelector("#chatForm");
const sendButton = document.querySelector(".send-button");
const input = document.querySelector("#messageInput");
const chat = document.querySelector("#messages");

function setChatOpen(isOpen) {
    chatWindow.classList.toggle("is-open", isOpen);
    chatWindow.setAttribute("aria-hidden", String(!isOpen));
    openChatButton.classList.toggle("is-open", isOpen);
    openChatButton.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) input.focus();
    else openChatButton.focus();
}

function scrollChatToBottom() {
    requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
    });
}

function addMessage(className, text) {
    const message = document.createElement("div");
    message.className = className;

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    message.append(paragraph);
    chat.append(message);
    scrollChatToBottom();
    return message;
}

async function sendMsg() {
    const userMessage = input.value.trim();
    if (!userMessage || sendButton.disabled) return;

    input.value = "";
    input.style.height = "42px";
    addMessage("user", userMessage);

    const reply = addMessage("model", "Thinking…");
    const replyText = reply.querySelector("p");
    sendButton.disabled = true;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Request failed.");
        }
        if (!response.body) throw new Error("This browser cannot read the streamed response.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (!line) continue;
                const chunk = JSON.parse(line);
                if (chunk.error) throw new Error(chunk.error);
                if (chunk.text && replyText.textContent === "Thinking…") replyText.textContent = "";
                replyText.textContent += chunk.text || "";
                scrollChatToBottom();
            }
            if (done) break;
        }

        if (buffer) {
            const chunk = JSON.parse(buffer);
            if (chunk.error) throw new Error(chunk.error);
            if (chunk.text && replyText.textContent === "Thinking…") replyText.textContent = "";
            replyText.textContent += chunk.text || "";
        }

        if (replyText.textContent === "Thinking…") replyText.textContent = "I didn’t receive a response. Please try again.";
    } catch (error) {
        reply.classList.add("error");
        replyText.textContent = `Sorry, something went wrong. ${error.message}`;
    } finally {
        sendButton.disabled = false;
        scrollChatToBottom();
        input.focus();
    }
}

openChatButton.addEventListener("click", () => {
    setChatOpen(!chatWindow.classList.contains("is-open"));
});
closeChatButton.addEventListener("click", () => setChatOpen(false));

form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMsg();
});

input.addEventListener("input", () => {
    input.style.height = "42px";
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
});

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && chatWindow.classList.contains("is-open")) {
        setChatOpen(false);
    }
});
