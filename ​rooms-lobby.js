"use strict";

// rooms-lobby.js - Criação, Listagem e Filtro de Salas Disponíveis

import { socket, appState } from './main.js';
import { changeView } from './ui-navigation.js';
import { joinActiveRoom } from './room-active.js';

// ==========================================
// 1. INICIALIZAÇÃO DO LOBBY GERAL
// ==========================================
export function initRoomsLobby() {
    const btnCreate = document.getElementById("btn-submit-create-room");
    const selectType = document.getElementById("room-create-type");

    if (selectType) {
        selectType.removeAttribute("data-has-listener");
        selectType.addEventListener("change", (e) => {
            const inputPassword = document.getElementById("room-create-password");
            if (inputPassword) {
                inputPassword.style.display = e.target.value === "private" ? "block" : "none";
            }
        });
        selectType.setAttribute("data-has-listener", "true");
    }

    if (btnCreate) {
        btnCreate.removeAttribute("data-has-listener");
        btnCreate.addEventListener("click", processRoomCreation);
        btnCreate.setAttribute("data-has-listener", "true");
    }

    // Solicita a lista de salas vigentes ao servidor
    socket.emit("get_rooms_list");

    // Escuta atualizações da grade em tempo real
    socket.off("rooms_list_update").on("rooms_list_update", renderRoomsGrid);
    socket.off("room_creation_response").on("room_creation_response", handleRoomCreationResponse);
}

// ==========================================
// 2. FORMULÁRIO DE CRIAÇÃO DE SALAS
// ==========================================
function processRoomCreation() {
    const nameInput = document.getElementById("room-create-name");
    const typeSelect = document.getElementById("room-create-type");
    const passwordInput = document.getElementById("room-create-password");
    const limitInput = document.getElementById("room-create-limit");

    const roomName = nameInput?.value.trim();
    if (!roomName) return alert("Por favor, dê um nome à sua nova sala!");

    const payload = {
        ownerUid: appState.currentUser.uid,
        name: roomName,
        type: typeSelect?.value || "public",
        password: typeSelect?.value === "private" ? passwordInput?.value : null,
        limit: parseInt(limitInput?.value || "8", 10)
    };

    if (payload.type === "private" && !payload.password) {
        return alert("Salas privadas necessitam de uma senha de acesso!");
    }

    console.log("[LOBBY] Solicitando abertura de nova sala...");
    socket.emit("create_room", payload);

    // Reseta o input de nome para evitar duplo clique acidental
    if (nameInput) nameInput.value = "";
}

function handleRoomCreationResponse(response) {
    if (response.success && response.room) {
        console.log("[LOBBY] Sala criada e registrada pelo servidor.");
        // Encaminha o criador diretamente para dentro da sala ativa
        joinActiveRoom(response.room.id);
    } else {
        alert(response.message || "Falha ao erguer sala.");
    }
}

// ==========================================
// 3. RENDERIZAÇÃO DA GRADE DE CARDS (RESPONSIVO)
// ==========================================
function renderRoomsGrid(rooms) {
    const grid = document.getElementById("lobby-rooms-grid");
    if (!grid) return;

    grid.innerHTML = "";

    if (!rooms || rooms.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-muted); font-size: 0.95rem; text-align: center; padding: 40px 0;">Nenhuma sala ativa no momento. Seja o primeiro a criar uma!</p>`;
        return;
    }

    rooms.forEach(room => {
        const card = document.createElement("div");
        card.className = "room-lobby-card";
        
        card.style = `
            background-color: var(--bg-surface);
            border: 1px solid var(--bg-element);
            border-radius: var(--radius-md);
            padding: 16px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 12px;
        `;

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="font-size: 1.05rem; color: var(--text-main);">${room.name}</strong>
                    <span style="font-size: 0.75rem; padding: 2px 6px; border-radius: var(--radius-sm); background: var(--bg-element); color: var(--text-muted);">
                        ${room.type === "private" ? "🔒 Privada" : "🌐 Pública"}
                    </span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    Integrantes: ${room.currentUsers}/${room.limit}
                </div>
            </div>
            <button class="btn-primary btn-join-room" style="padding: 8px 14px; font-size: 0.85rem; width: 100%;">
                Conectar-se
            </button>
        `;

        card.querySelector(".btn-join-room").addEventListener("click", () => {
            if (room.type === "private") {
                const pass = prompt("Esta sala é protegida por senha. Digite-a para entrar:");
                if (pass !== null) {
                    joinActiveRoom(room.id, pass);
                }
            } else {
                joinActiveRoom(room.id);
            }
        });

        grid.appendChild(card);
    });
}
