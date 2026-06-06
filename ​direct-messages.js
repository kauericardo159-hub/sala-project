"use strict";

// direct-messages.js - Gerenciador de Conversas Individuais e Histórico Privado

import { socket, appState } from './main.js';

let activeChatPartner = null;

// ==========================================
// 1. INICIALIZAÇÃO E ESCUTAS DE CHAT PÚBLICAS
// ==========================================
export function initDirectMessages() {
    const btnSendDm = document.getElementById("btn-send-dm");
    const inputDm = document.getElementById("input-dm-message");

    if (btnSendDm && inputDm) {
        btnSendDm.removeAttribute("data-has-listener");
        btnSendDm.addEventListener("click", submitPrivateMessage);
        
        inputDm.removeAttribute("data-has-listener");
        inputDm.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submitPrivateMessage();
        });

        btnSendDm.setAttribute("data-has-listener", "true");
        inputDm.setAttribute("data-has-listener", "true");
    }

    // Solicita os canais ativos ao servidor para montar a barra lateral
    socket.emit("get_active_chats", { uid: appState.currentUser.uid });

    // Escutadores Socket dedicados a DMs
    socket.off("receive_private_message").on("receive_private_message", handleIncomingDm);
    socket.off("dm_history_response").on("dm_history_response", renderDmHistory);
    socket.off("active_chats_response").on("active_chats_response", renderActiveChatsSidebar);
}

// ==========================================
// 2. DISPARADOR DE CONVERSA (PROVENIENTE DA LISTA DE AMIGOS)
// ==========================================
export function startPrivateChat(partnerUser) {
    activeChatPartner = partnerUser;
    
    // Inicializa a interface das mensagens para o parceiro selecionado
    initDirectMessages();
    
    // Solicita o histórico de conversas criptografado ou armazenado no backend
    socket.emit("get_dm_history", {
        uid: appState.currentUser.uid,
        targetUid: partnerUser.uid
    });
}

// ==========================================
// 3. ENVIO DE MENSAGENS E ATUALIZAÇÕES
// ==========================================
function submitPrivateMessage() {
    const inputDm = document.getElementById("input-dm-message");
    if (!inputDm || !activeChatPartner) return;

    const messageText = inputDm.value.trim();
    if (!messageText) return;

    const payload = {
        senderUid: appState.currentUser.uid,
        receiverUid: activeChatPartner.uid,
        text: messageText,
        timestamp: Date.now()
    };

    // Dispara para o servidor e espelha localmente de imediato (Optimistic UI)
    socket.emit("send_private_message", payload);
    appendSingleMessage(payload, true);
    
    inputDm.value = "";
    inputDm.focus();
}

// ==========================================
// 4. TRATAMENTO DE ENTRADAS E RENDERIZAÇÃO
// ==========================================
function handleIncomingDm(msg) {
    // Se a mensagem recebida for do parceiro com o qual a conversa está aberta agora
    if (activeChatPartner && (msg.senderUid === activeChatPartner.uid || msg.receiverUid === activeChatPartner.uid)) {
        appendSingleMessage(msg, msg.senderUid === appState.currentUser.uid);
    }
    // Atualiza a barra lateral para reorganizar as últimas conversas
    socket.emit("get_active_chats", { uid: appState.currentUser.uid });
}

function renderDmHistory(response) {
    const container = document.getElementById("dm-messages-container");
    if (!container) return;

    container.innerHTML = "";
    const messages = response.messages || [];

    messages.forEach(msg => {
        const isMe = msg.senderUid === appState.currentUser.uid;
        appendSingleMessage(msg, isMe);
    });
}

function appendSingleMessage(msg, isMe) {
    const container = document.getElementById("dm-messages-container");
    if (!container) return;

    const msgBlock = document.createElement("div");
    msgBlock.style = `
        max-width: 75%;
        padding: 10px 14px;
        border-radius: var(--radius-md);
        font-size: 0.95rem;
        line-height: 1.4;
        word-break: break-word;
        align-self: ${isMe ? 'flex-end' : 'flex-start'};
        background-color: ${isMe ? 'var(--brand-primary)' : 'var(--bg-element)'};
        color: var(--text-main);
    `;
    
    msgBlock.innerText = msg.text;
    container.appendChild(msgBlock);
    
    // Autoscroll para a última mensagem recebida/enviada
    container.scrollTop = container.scrollHeight;
}

function renderActiveChatsSidebar(response) {
    const sidebar = document.getElementById("dm-active-chats-sidebar");
    if (!sidebar) return;

    sidebar.innerHTML = "";
    const channels = response.chats || [];

    if (channels.length === 0) {
        sidebar.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px;">Nenhum chat recente.</p>`;
        return;
    }

    channels.forEach(chat => {
        const row = document.createElement("div");
        const isActive = activeChatPartner && activeChatPartner.uid === chat.uid;
        
        row.style = `
            padding: 10px;
            border-radius: var(--radius-sm);
            margin-bottom: 6px;
            cursor: pointer;
            background-color: ${isActive ? 'var(--bg-surface-hover)' : 'transparent'};
            border-left: ${isActive ? '3px solid var(--brand-primary)' : 'none'};
        `;
        
        row.innerHTML = `
            <div style="font-weight: 500; font-size: 0.9rem;">${chat.displayName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${chat.lastMessage || 'Clique para conversar'}</div>
        `;

        row.addEventListener("click", () => {
            startPrivateChat(chat);
        });

        sidebar.appendChild(row);
    });
}
