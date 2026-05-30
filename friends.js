"use strict";

// friends.js - Sistema de Amizades, Status Online e Solicitações

import { socket, appState } from './main.js';
import { escapeHTML } from './ui.js';

// ==========================================
// 1. CONFIGURAÇÃO DA INTERFACE SOCIAL
// ==========================================
export function setupFriendsInterface() {
    const btnSendRequest = document.getElementById("btn-send-friend-request");
    const inputFriendUid = document.getElementById("input-friend-uid");
    const friendsContainer = document.getElementById("friends-list-container");
    const requestsContainer = document.getElementById("friend-requests-container");

    // Enviar solicitação de amizade ao clicar
    if (btnSendRequest && inputFriendUid) {
        btnSendRequest.addEventListener("click", () => {
            sendFriendRequest(inputFriendUid.value.trim(), btnSendRequest);
        });
        
        // Permite envio com a tecla Enter
        inputFriendUid.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                sendFriendRequest(inputFriendUid.value.trim(), btnSendRequest);
            }
        });
    }

    // [PRO] Delegação de Eventos para Aceitar/Recusar/Remover amigos
    if (requestsContainer) {
        requestsContainer.addEventListener("click", (e) => {
            const btn = e.target;
            const targetUid = btn.getAttribute("data-uid");
            if (!targetUid) return;

            if (btn.classList.contains("btn-accept-request")) {
                handleFriendRequest(targetUid, "accept", btn);
            } else if (btn.classList.contains("btn-reject-request")) {
                handleFriendRequest(targetUid, "reject", btn);
            }
        });
    }

    if (friendsContainer) {
        friendsContainer.addEventListener("click", (e) => {
            const btn = e.target;
            const targetUid = btn.getAttribute("data-uid");
            
            if (btn.classList.contains("btn-remove-friend") && targetUid) {
                removeFriend(targetUid, btn);
            }
        });
    }

    // ==========================================
    // ESCUTADORES SOCKET (SINCRONIZAÇÃO EM TEMPO REAL)
    // ==========================================
    
    // Atualiza a lista principal de amigos (Online/Offline)
    socket.off("update_friends_list").on("update_friends_list", (friendsList) => {
        renderFriendsList(friendsList);
    });

    // Atualiza a lista de convites pendentes
    socket.off("update_friend_requests").on("update_friend_requests", (requestsList) => {
        renderFriendRequests(requestsList);
    });

    // Notificações em tempo real
    socket.off("friend_notification").on("friend_notification", (message) => {
        // Pode ser trocado por um sistema de Toast (Notificação flutuante)
        console.log(`[SOCIAL] ${message}`);
        alert(`Sistema de Amigos: ${message}`);
    });
}

// ==========================================
// 2. LÓGICA DE ENVIO E AÇÕES (CLIENT-SIDE)
// ==========================================
function sendFriendRequest(targetUid, btnElement) {
    if (!targetUid) return alert("Digite o UID do usuário (Ex: @joao#000001)");

    const user = appState.currentUser;
    if (!user) return alert("Você precisa estar logado!");
    
    if (targetUid === user.uid) return alert("Você não pode adicionar a si mesmo!");

    // Trava o botão temporariamente (Prevenção de spam)
    const originalText = btnElement.innerText;
    btnElement.disabled = true;
    btnElement.innerText = "Enviando...";

    socket.emit("send_friend_request", { senderUid: user.uid, targetUid: targetUid });

    // Destrava após 1.5s
    setTimeout(() => {
        btnElement.disabled = false;
        btnElement.innerText = originalText;
        const input = document.getElementById("input-friend-uid");
        if (input) input.value = "";
    }, 1500);
}

function handleFriendRequest(targetUid, action, btnElement) {
    const user = appState.currentUser;
    if (!user) return;

    btnElement.disabled = true;
    socket.emit("respond_friend_request", { myUid: user.uid, targetUid: targetUid, action: action });
}

function removeFriend(targetUid, btnElement) {
    if (!confirm("Tem certeza que deseja remover este usuário da sua lista de amigos?")) return;

    const user = appState.currentUser;
    if (!user) return;

    btnElement.disabled = true;
    btnElement.innerText = "Removendo...";
    
    socket.emit("remove_friend", { myUid: user.uid, targetUid: targetUid });
}

// ==========================================
// 3. RENDERIZAÇÃO NO DOM (COM PROTEÇÃO XSS)
// ==========================================
function renderFriendsList(friends) {
    const container = document.getElementById("friends-list-container");
    const countEl = document.getElementById("friends-online-count");
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = `<p class="empty-text">Você ainda não adicionou ninguém.</p>`;
        if (countEl) countEl.innerText = "0";
        return;
    }

    container.innerHTML = ""; // Limpa a lista atual
    
    let onlineCount = 0;

    // Ordena para que amigos online fiquem no topo da lista
    const sortedFriends = friends.sort((a, b) => b.isOnline - a.isOnline);

    sortedFriends.forEach(friend => {
        if (friend.isOnline) onlineCount++;

        const safeName = escapeHTML(friend.name);
        const safeUid = escapeHTML(friend.uid);
        const safeAvatar = escapeHTML(friend.avatar || "user-photo.jpg");
        const statusClass = friend.isOnline ? "status-online" : "status-offline";
        const statusText = friend.isOnline ? "Online" : "Offline";

        const card = document.createElement("div");
        card.className = "friend-card";
        
        card.innerHTML = `
            <div class="friend-avatar-wrapper">
                <img src="${safeAvatar}" alt="${safeName}" onerror="this.src='user-photo.jpg'">
                <div class="status-indicator ${statusClass}"></div>
            </div>
            <div class="friend-info">
                <span class="friend-name">${safeName}</span>
                <span class="friend-uid">${safeUid}</span>
                <span class="friend-status ${statusClass}">${statusText}</span>
            </div>
            <div class="friend-actions">
                <button class="btn-remove-friend" data-uid="${safeUid}" title="Desfazer Amizade">❌</button>
            </div>
        `;
        
        container.appendChild(card);
    });

    if (countEl) countEl.innerText = onlineCount;
}

function renderFriendRequests(requests) {
    const container = document.getElementById("friend-requests-container");
    const badgeEl = document.getElementById("friend-requests-badge");
    if (!container) return;

    if (!requests || requests.length === 0) {
        container.innerHTML = `<p class="empty-text">Nenhuma solicitação pendente.</p>`;
        if (badgeEl) badgeEl.style.display = "none";
        return;
    }

    container.innerHTML = "";
    
    if (badgeEl) {
        badgeEl.style.display = "inline-block";
        badgeEl.innerText = requests.length;
    }

    requests.forEach(req => {
        const safeName = escapeHTML(req.name);
        const safeUid = escapeHTML(req.uid);
        const safeAvatar = escapeHTML(req.avatar || "user-photo.jpg");

        const card = document.createElement("div");
        card.className = "friend-request-card";
        
        card.innerHTML = `
            <img src="${safeAvatar}" alt="${safeName}" class="req-avatar" onerror="this.src='user-photo.jpg'">
            <div class="req-info">
                <span class="req-name">${safeName}</span>
                <span class="req-uid">quer ser seu amigo(a)</span>
            </div>
            <div class="req-actions">
                <button class="btn-accept-request" data-uid="${safeUid}">✔️</button>
                <button class="btn-reject-request" data-uid="${safeUid}">✖️</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}
