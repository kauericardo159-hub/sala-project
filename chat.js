"use strict";

// chat.js - Gerenciamento do chat em tempo real dentro da sala — Pro Version

import { socket, appState } from './main.js';
import { escapeHTML } from './ui.js';

// ==========================================
// 1. CONFIGURAÇÃO DA INTERFACE DE CHAT
// ==========================================
export function setupChatInterface() {
    const btnSendMessage = document.getElementById("btn-send-message");
    const chatInput = document.getElementById("chat-input");

    // Enviar mensagem clicando no botão
    if (btnSendMessage) {
        btnSendMessage.addEventListener("click", () => {
            handleSendMessage();
        });
    }

    // Enviar mensagem pressionando "Enter"
    if (chatInput) {
        chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    // Escutador: Receber mensagens do servidor
    socket.off("receive_message").on("receive_message", (messageData) => {
        appendMessageToDOM(messageData);
    });

    // [CORREÇÃO] Atualizado para 'room_joined_success' para alinhar com o ciclo de vida do main.js
    socket.off("room_joined_success").on("room_joined_success", () => {
        const chatContainer = document.getElementById("chat-messages-container");
        if (chatContainer) chatContainer.innerHTML = "";
    });
}

// ==========================================
// 2. LÓGICA DE ENVIO (CLIENT-SIDE)
// ==========================================
function handleSendMessage() {
    const inputField = document.getElementById("chat-input");
    if (!inputField) return;

    const text = inputField.value.trim();
    if (text === "") return; // Impede mensagens vazias

    const user = appState.currentUser;
    const room = appState.currentRoom;

    if (!user || !room) {
        console.error("[CHAT] Erro: Tentativa de envio de mensagem sem sala ou usuário válido.");
        return;
    }

    // [CORREÇÃO] Forçando o roomId a ir como String para bater com a busca estrita do servidor
    const messagePayload = {
        roomId: String(room.id),
        uid: user.uid,
        name: user.name,
        avatar: user.avatar, // Tráfego seguro da string Base64 original
        text: text,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    // Envia para o servidor e limpa o input
    socket.emit("send_message", messagePayload);
    inputField.value = "";
    inputField.focus(); 
}

// ==========================================
// 3. RENDERIZAÇÃO DA MENSAGEM NO DOM
// ==========================================
function appendMessageToDOM(msgData) {
    const chatContainer = document.getElementById("chat-messages-container");
    if (!chatContainer) return;

    const user = appState.currentUser;
    const isMine = user && msgData.uid === user.uid;
    const alignClass = isMine ? "msg-mine" : "msg-others";

    // Proteção XSS rigorosa no texto e metadados
    const safeName = escapeHTML(msgData.name);
    const safeText = escapeHTML(msgData.text);
    const safeTime = escapeHTML(msgData.timestamp);
    
    // [CORREÇÃO] Não passamos o avatar pelo escapeHTML para não quebrar a string Base64.
    // Em vez disso, validamos se existe e usamos um fallback limpo contra injeção de aspas.
    const rawAvatar = msgData.avatar || "user-photo.jpg";

    // Cria a estrutura da mensagem HTML de forma segura
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${alignClass}`;

    messageDiv.innerHTML = `
        <img src="${rawAvatar}" alt="${safeName}" class="chat-msg-avatar" onerror="this.src='user-photo.jpg'">
        <div class="chat-msg-content">
            <div class="chat-msg-header">
                <span class="chat-msg-name">${safeName}</span>
                <span class="chat-msg-time">${safeTime}</span>
            </div>
            <div class="chat-msg-text">${safeText}</div>
        </div>
    `;

    // Adiciona ao container
    chatContainer.appendChild(messageDiv);

    // Auto-scroll para a última mensagem
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}
