"use strict";

// friends-list.js - Gerenciamento de Vínculos, Barramentos e Pedidos de Amizade

import { socket, appState } from './main.js';
import { changeView } from './ui-navigation.js';
import { startPrivateChat } from './direct-messages.js';

// ==========================================
// 1. INICIALIZAÇÃO E ASSINATURA DE EVENTOS
// ==========================================
export function initFriendsList() {
    const btnAddFriend = document.getElementById("btn-add-friend");
    const inputFriendId = document.getElementById("input-friend-id");

    if (btnAddFriend && inputFriendId) {
        btnAddFriend.removeAttribute("data-has-listener");
        btnAddFriend.addEventListener("click", () => {
            const targetTag = inputFriendId.value.trim();
            if (targetTag) {
                sendFriendRequest(targetTag);
                inputFriendId.value = "";
            }
        });
        btnAddFriend.setAttribute("data-has-listener", "true");
    }

    // Solicita as listas atualizadas ao entrar na aba
    requestFriendsSync();

    // Ouvintes em tempo real vindos do servidor
    socket.off("friends_sync_data").on("friends_sync_data", handleFriendsSync);
    socket.off("friend_request_response").on("friend_request_response", (res) => {
        alert(res.message);
        requestFriendsSync();
    });
}

function requestFriendsSync() {
    if (appState.currentUser) {
        socket.emit("get_friends_data", { uid: appState.currentUser.uid });
    }
}

// ==========================================
// 2. ENVIO DE SOLICITAÇÃO (TAG MATCHING)
// ==========================================
function sendFriendRequest(fullTag) {
    // Valida o formato padrão @username#0000
    if (!fullTag.includes('#')) {
        return alert("Formato inválido! Certifique-se de usar o padrão @usuario#0000");
    }

    let cleanTag = fullTag.replace('@', '');
    const parts = cleanTag.split('#');
    const username = parts[0];
    const tagCode = parts[1];

    socket.emit("send_friend_request", {
        senderUid: appState.currentUser.uid,
        targetUsername: username,
        targetTag: tagCode
    });
}

// ==========================================
// 3. RENDERIZAÇÃO REATIVA DO DOM
// ==========================================
function handleFriendsSync(data) {
    const countRequests = document.getElementById("count-requests");
    const containerRequests = document.getElementById("container-friend-requests");
    const containerFriends = document.getElementById("container-friends-list");

    // 1. Renderizar Convites Pendentes
    if (containerRequests) {
        containerRequests.innerHTML = "";
        const requests = data.requests || [];
        if (countRequests) countRequests.innerText = requests.length;

        requests.forEach(req => {
            const row = document.createElement("div");
            row.className = "friend-request-card";
            row.style = "display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid var(--bg-element);";
            
            row.innerHTML = `
                <span><strong>${req.displayName}</strong> (@${req.username})</span>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-accept" style="color: var(--status-online); font-weight: bold;">Aceitar</button>
                    <button class="btn-decline" style="color: var(--status-offline); font-weight: bold;">Recusar</button>
                </div>
            `;

            row.querySelector(".btn-accept").addEventListener("click", () => {
                socket.emit("respond_friend_request", { uid: appState.currentUser.uid, requestId: req.id, action: "accept" });
            });
            row.querySelector(".btn-decline").addEventListener("click", () => {
                socket.emit("respond_friend_request", { uid: appState.currentUser.uid, requestId: req.id, action: "decline" });
            });

            containerRequests.appendChild(row);
        });
    }

    // 2. Renderizar Lista de Amigos
    if (containerFriends) {
        containerFriends.innerHTML = "";
        const friends = data.friends || [];

        if (friends.length === 0) {
            containerFriends.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Sua lista de amigos está vazia.</p>`;
            return;
        }

        friends.forEach(friend => {
            const card = document.createElement("div");
            card.className = "friend-list-card";
            card.style = "display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 14px; border-radius: var(--radius-md); margin-bottom: 10px; border: 1px solid var(--bg-element); cursor: pointer;";
            
            const statusColor = friend.status === "online" ? "var(--status-online)" : "var(--text-muted)";

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${statusColor};"></div>
                    <div>
                        <div style="font-weight: 600;">${friend.displayName}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">@${friend.username}</div>
                    </div>
                </div>
                <button class="btn-open-dm" style="font-size: 1.2rem;" title="Enviar Mensagem">💬</button>
            `;

            // Ao clicar no cartão ou no ícone de chat, abre a conversa privada com o amigo
            card.addEventListener("click", (e) => {
                startPrivateChat(friend);
                changeView("view-messages");
            });

            containerFriends.appendChild(card);
        });
    }
}
