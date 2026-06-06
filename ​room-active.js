"use strict";

// room-active.js - Controle de Presença em Voz e Chat Acoplado da Sala Ativa

import { socket, appState } from './main.js';
import { changeView } from './ui-navigation.js';

// ==========================================
// 1. ENTRYPOINT DE ENTRADA NA SALA
// ==========================================
export function joinActiveRoom(roomId, password = null) {
    console.log(`[ROOM] Tentando conexão na sala: ${roomId}`);
    
    socket.emit("join_room", {
        uid: appState.currentUser.uid,
        roomId: roomId,
        password: password
    });

    // Assina os eventos de resposta de entrada e atualizações internas de estado
    socket.off("join_room_response").on("join_room_response", handleRoomJoinResponse);
}

function handleRoomJoinResponse(response) {
    if (response.success && response.room) {
        console.log("[ROOM] Autenticado e alocado na sala com sucesso.");
        
        // Aloca a sala no Estado Global para habilitar o atalho flutuante na navbar
        appState.setActiveRoom(response.room);
        
        // Muda o foco de visualização imediatamente para a tela da sala
        changeView("view-room-active");
        
        // Inicializa os escutadores internos do chat e controles de voz
        setupRoomEventBindings();
        
        // Força uma renderização imediata com os dados iniciais trazidos no handshake
        renderRoomState(response.room);
    } else {
        alert(response.message || "Não foi possível ingressar nesta sala.");
    }
}

// ==========================================
// 2. CONFIGURAÇÃO DE BINDINGS (CHAT E CONTROLES)
// ==========================================
function setupRoomEventBindings() {
    const btnSend = document.getElementById("btn-send-room-chat");
    const inputMsg = document.getElementById("input-room-chat-message");
    const btnLeave = document.getElementById("btn-room-leave");
    const btnMute = document.getElementById("btn-room-mute");

    // Envio do Chat de Texto
    if (btnSend && inputMsg) {
        btnSend.removeAttribute("data-has-listener");
        btnSend.addEventListener("click", submitRoomChatMessage);
        
        inputMsg.removeAttribute("data-has-listener");
        inputMsg.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submitRoomChatMessage();
        });

        btnSend.setAttribute("data-has-listener", "true");
        inputMsg.setAttribute("data-has-listener", "true");
    }

    // Botão de Desconexão / Sair da Sala
    if (btnLeave) {
        btnLeave.removeAttribute("data-has-listener");
        btnLeave.addEventListener("click", leaveCurrentRoom);
        btnLeave.setAttribute("data-has-listener", "true");
    }

    // Botão de Mutar (Placeholder para integração futura de WebRTC)
    if (btnMute) {
        btnMute.removeAttribute("data-has-listener");
        btnMute.addEventListener("click", () => {
            const isMuted = btnMute.classList.toggle("active");
            btnMute.innerText = isMuted ? "Microfone Mutado" : "Ativar Microfone";
            btnMute.style.backgroundColor = isMuted ? "var(--status-offline)" : "var(--bg-element)";
            
            socket.emit("toggle_mute_state", {
                roomId: appState.activeRoom.id,
                uid: appState.currentUser.uid,
                isMuted: isMuted
            });
        });
        btnMute.setAttribute("data-has-listener", "true");
    }

    // Escuta transmissões contínuas vindas do servidor para esta sala específica
    socket.off("room_state_broadcast").on("room_state_broadcast", renderRoomState);
    socket.off("receive_room_chat_message").on("receive_room_chat_message", appendRoomChatMessage);
}

// ==========================================
// 3. FLUXO DE MENSAGENS E SAÍDA
// ==========================================
function submitRoomChatMessage() {
    const inputMsg = document.getElementById("input-room-chat-message");
    if (!inputMsg || !appState.activeRoom) return;

    const text = inputMsg.value.trim();
    if (!text) return;

    socket.emit("send_room_chat_message", {
        roomId: appState.activeRoom.id,
        senderUid: appState.currentUser.uid,
        displayName: appState.currentUser.displayName || appState.currentUser.username,
        text: text
    });

    inputMsg.value = "";
    inputMsg.focus();
}

function leaveCurrentRoom() {
    if (appState.activeRoom) {
        console.log("[ROOM] Solicitando desvinculação da sala ativa...");
        socket.emit("leave_room", {
            roomId: appState.activeRoom.id,
            uid: appState.currentUser.uid
        });

        // Limpa o estado e limpa os containers de texto
        document.getElementById("room-chat-messages").innerHTML = "";
        appState.setActiveRoom(null);
        
        // Retorna o usuário em segurança para o Lobby geral de salas
        changeView("view-lobby");
    }
}

// ==========================================
// 4. RENDERIZAÇÃO EM TEMPO REAL (QUEM ESTÁ NA SALA)
// ==========================================
function renderRoomState(room) {
    if (!room) return;
    
    // Atualiza a referência em memória local para sincronizar contagens
    appState.setActiveRoom(room);

    const txtTitle = document.getElementById("active-room-title");
    const gridVoice = document.getElementById("room-users-voice-grid");

    if (txtTitle) txtTitle.innerText = `${room.name} (${room.users.length}/${room.limit})`;

    // Reconstrói a grade visual de participantes ativos na hora
    if (gridVoice) {
        gridVoice.innerHTML = "";
        
        room.users.forEach(user => {
            const card = document.createElement("div");
            card.className = "voice-user-card";
            
            // Borda acende em roxo se o usuário estiver falando (reatividade visual)
            const isSpeakingBorder = user.isSpeaking ? "2px solid var(--brand-primary)" : "1px solid var(--bg-element)";
            
            card.style = `
                background-color: var(--bg-base);
                border: ${isSpeakingBorder};
                border-radius: var(--radius-md);
                padding: 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                text-align: center;
                position: relative;
            `;

            // Avatar dinâmico baseado na foto ou gerador randômico estável
            const avatarSrc = user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;

            card.innerHTML = `
                <img src="${avatarSrc}" style="width: 44px; height: 44px; border-radius: var(--radius-full); object-fit: cover;">
                <div style="font-size: 0.85rem; font-weight: 600; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${user.displayName}
                </div>
                <span style="font-size: 0.7rem; color: var(--text-muted);">
                    ${user.isMuted ? "🔇 Mutado" : "🎙️ Ouvindo"}
                </span>
            `;

            gridVoice.appendChild(card);
        });
    }
}

function appendRoomChatMessage(msg) {
    const container = document.getElementById("room-chat-messages");
    if (!container) return;

    const isMe = msg.senderUid === appState.currentUser.uid;
    const item = document.createElement("div");
    
    item.style = `
        display: flex;
        flex-direction: column;
        align-self: ${isMe ? 'flex-end' : 'flex-start'};
        max-width: 80%;
        margin-bottom: 4px;
    `;

    item.innerHTML = `
        <span style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px; align-self: ${isMe ? 'flex-end' : 'flex-start'};">
            ${msg.displayName}
        </span>
        <div style="padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.9rem; line-height: 1.4; word-break: break-word;
            background-color: ${isMe ? 'var(--brand-primary)' : 'var(--bg-element)'}; color: var(--text-main);">
            ${msg.text}
        </div>
    `;

    container.appendChild(item);
    
    // Auto-scroll instantâneo para manter as últimas mensagens trocadas sempre à vista
    container.scrollTop = container.scrollHeight;
}
