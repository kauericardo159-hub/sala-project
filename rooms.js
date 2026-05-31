"use strict";

// rooms.js - Gerenciamento de Salas, Feed Público e Ingressos Controlados — Pro Version

import { socket, appState } from './main.js';
import { showScreen, escapeHTML, updateRoomHeader, renderVoiceCards } from './ui.js';

// ==========================================
// 1. CONFIGURAÇÃO DA INTERFACE DE SALAS
// ==========================================
export function setupRoomCreationInterface() {
    const btnCreateRoom = document.getElementById("btn-create-room");
    const selectRoomType = document.getElementById("room-type");
    const groupRoomPassword = document.getElementById("group-room-password");
    const roomFeedContainer = document.getElementById("rooms-feed");

    // Exibe ou oculta o campo de senha dependendo do tipo de sala selecionado
    if (selectRoomType && groupRoomPassword) {
        selectRoomType.addEventListener("change", (e) => {
            if (e.target.value === "private") {
                groupRoomPassword.style.display = "block";
            } else {
                groupRoomPassword.style.display = "none";
                const inputPass = document.getElementById("room-password");
                if (inputPass) inputPass.value = ""; // Limpa para evitar lixo de memória
            }
        });
    }

    // Evento para disparar a criação da sala
    if (btnCreateRoom) {
        btnCreateRoom.addEventListener("click", (e) => {
            e.preventDefault();
            createNewRoom(btnCreateRoom);
        });
    }

    // Delegação de Eventos para o Feed de Salas
    if (roomFeedContainer) {
        roomFeedContainer.addEventListener("click", (e) => {
            const card = e.target.closest(".room-card");
            if (!card) return;

            const roomId = card.getAttribute("data-room-id");
            const isPrivate = card.getAttribute("data-is-private") === "true";
            
            if (roomId) {
                tryJoinRoom(roomId, isPrivate);
            }
        });
    }

    // ==========================================
    // ESCUTADORES SOCKET (RESPOSTAS DO SERVIDOR)
    // ==========================================
    
    // Atualiza a lista de salas na tela
    socket.off("update_room_list").on("update_room_list", renderRoomList);

    // [CORREÇÃO] Unificado para escutar 'room_joined_success' alinhado com o main.js e server.js
    socket.off("room_joined_success").on("room_joined_success", (roomData) => {
        appState.setCurrentRoom(roomData);
        
        // Altera a tela para o modo Call/Sala
        showScreen("room");
        updateRoomHeader(roomData);
        renderVoiceCards(roomData.users, roomData.ownerId);

        // Limpa os inputs do formulário de criação para quando o usuário voltar ao lobby estar limpo
        clearRoomInputs();

        // Restaura o estado do botão de criação
        if (btnCreateRoom) resetRoomButton(btnCreateRoom);

        console.log(`[SALAS] Você entrou com sucesso na sala: ${roomData.name}`);
    });

    // Erros vindos do servidor (Senha errada, sala cheia, banido, etc.)
    socket.off("room_error").on("room_error", (message) => {
        alert(`Aviso do Sistema: ${message}`);
        // Restaura o botão de criar sala se o erro tiver sido na criação
        if (btnCreateRoom) resetRoomButton(btnCreateRoom);
    });
}

// ==========================================
// 2. LÓGICA DE CRIAÇÃO DE SALAS (CORRIGIDO)
// ==========================================
function createNewRoom(btnElement) {
    const user = appState.currentUser;
    if (!user) return alert("Você precisa estar logado para criar uma sala.");

    const nameInput = document.getElementById("room-name")?.value.trim();
    const typeSelect = document.getElementById("room-type")?.value;
    const limitSelect = parseInt(document.getElementById("room-limit")?.value, 10);
    const passwordInput = document.getElementById("room-password")?.value;

    if (!nameInput) {
        return alert("Por favor, dê um nome para a sua sala!");
    }

    if (typeSelect === "private" && !passwordInput) {
        return alert("Salas privadas exigem uma senha de acesso!");
    }

    // Prevenção de Duplo Clique
    btnElement.disabled = true;
    btnElement.innerText = "Criando Sala...";

    // [CORREÇÃO CRÍTICA] Injetando o 'creatorInfo' no local correto esperado pelo backend
    const roomPayload = {
        id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, 
        name: nameInput,
        type: typeSelect,
        password: typeSelect === "private" ? passwordInput : null,
        limit: limitSelect || 5,
        ownerId: user.uid,
        creatorInfo: {
            uid: user.uid,
            name: user.name,
            avatar: user.avatar // Garante o tráfego da foto em Base64 configurada
        },
        users: []
    };

    console.log("[SALAS] Enviando payload corrigido de criação de sala...");
    // Envia o objeto diretamente sem encapsular em chaves redundantes
    socket.emit("create_room", roomPayload);
}

// ==========================================
// 3. RENDERIZAÇÃO DINÂMICA DO FEED (DOM)
// ==========================================
function renderRoomList(rooms) {
    const container = document.getElementById("rooms-feed");
    if (!container) return;

    if (!rooms || rooms.length === 0) {
        container.innerHTML = `
            <div class="empty-feed">
                <p>Nenhuma sala ativa no momento. Que tal criar a primeira?</p>
            </div>
        `;
        return;
    }

    container.innerHTML = ""; // Limpa o feed antigo

    rooms.forEach(room => {
        const safeName = escapeHTML(room.name);
        const currentCount = room.users ? room.users.length : 0;
        const maxLimit = room.limit;
        const isPrivate = room.type === "private";

        const roomCard = document.createElement("div");
        roomCard.className = `room-card ${isPrivate ? 'private' : 'public'}`;
        roomCard.setAttribute("data-room-id", room.id);
        roomCard.setAttribute("data-is-private", isPrivate ? "true" : "false");

        roomCard.innerHTML = `
            <div class="room-card-header">
                <span class="room-card-badge ${room.type}">${isPrivate ? '🔒 Privada' : '🌐 Pública'}</span>
                <span class="room-card-counter">${currentCount}/${maxLimit} u</span>
            </div>
            <h4 class="room-card-title" title="${safeName}">${safeName}</h4>
            <div class="room-card-action">
                <button class="btn-join-action">Entrar na Sala</button>
            </div>
        `;

        container.appendChild(roomCard);
    });
}

// ==========================================
// 4. LÓGICA PARA INGRESSAR EM UMA SALA
// ==========================================
function tryJoinRoom(roomId, isPrivate) {
    const user = appState.currentUser;
    if (!user) return alert("Você precisa estar logado para entrar em uma sala.");

    let typedPassword = null;

    if (isPrivate) {
        typedPassword = prompt("Esta sala é privada. Digite a senha de acesso:");
        if (typedPassword === null) return; 
        if (typedPassword.trim() === "") return alert("A senha não pode ser vazia!");
    }

    console.log(`[SALAS] Tentando ingressar na sala ${roomId}...`);
    socket.emit("join_room", { roomId: String(roomId), password: typedPassword, user });
}

// ==========================================
// 5. AUXILIARES DE LIMPEZA E INTERFACE
// ==========================================
function resetRoomButton(btn) {
    btn.disabled = false;
    btn.innerText = "Criar Sala";
}

function clearRoomInputs() {
    const nameInput = document.getElementById("room-name");
    const passwordInput = document.getElementById("room-password");
    const groupRoomPassword = document.getElementById("group-room-password");
    const typeSelect = document.getElementById("room-type");

    if (nameInput) nameInput.value = "";
    if (passwordInput) passwordInput.value = "";
    if (typeSelect) typeSelect.value = "public";
    if (groupRoomPassword) groupRoomPassword.style.display = "none";
}
