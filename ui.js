"use strict";

// ui.js - Motor de Renderização do DOM e Prevenção XSS

// ==========================================
// 1. UTILITÁRIOS DE SEGURANÇA (PRO FEATURE)
// ==========================================
/**
 * Sanitiza strings para evitar ataques de injeção de HTML/Scripts (XSS).
 * Sempre use isso antes de renderizar nomes ou textos inseridos por usuários.
 */
export function escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ==========================================
// 2. GERENCIADOR DE TELAS (ROTEAMENTO VISUAL)
// ==========================================
/**
 * Alterna as telas principais do aplicativo respeitando os layouts do CSS Grid/Flex.
 * @param {string} screenName - 'login', 'dashboard' ou 'room'
 */
export function showScreen(screenName) {
    const screenLogin = document.getElementById("screen-login");
    const screenDashboard = document.getElementById("screen-dashboard");
    const screenRoom = document.getElementById("screen-room");

    // Oculta todas as telas primeiramente
    if (screenLogin) screenLogin.style.display = "none";
    if (screenDashboard) screenDashboard.style.display = "none";
    if (screenRoom) screenRoom.style.display = "none";

    // Exibe apenas a tela solicitada com o `display` correto baseado no style.css
    switch (screenName) {
        case "login":
            if (screenLogin) screenLogin.style.display = "flex";
            break;
        case "dashboard":
            if (screenDashboard) screenDashboard.style.display = "grid"; // Usa Grid conforme seu CSS
            break;
        case "room":
            if (screenRoom) screenRoom.style.display = "grid"; // Usa Grid conforme seu CSS
            break;
        default:
            console.error(`[UI] Tentativa de renderizar tela desconhecida: ${screenName}`);
            if (screenLogin) screenLogin.style.display = "flex"; // Fallback seguro
    }
}

// ==========================================
// 3. RENDERIZAÇÃO DE COMPONENTES DA SALA DE VOZ
// ==========================================
/**
 * Atualiza o cabeçalho da sala quando o usuário entra.
 */
export function updateRoomHeader(roomData) {
    const roomTitleEl = document.getElementById("room-title");
    if (roomTitleEl && roomData) {
        roomTitleEl.innerHTML = escapeHTML(roomData.name);
    }
}

/**
 * Renderiza a grade de avatares dos participantes na sala de voz.
 * Calcula quem é o dono da sala, quem está mutado e quem está falando.
 * * @param {Array} users - Lista de usuários presentes na sala
 * @param {String} ownerId - UID do dono da sala para dar a tag especial
 */
export function renderVoiceCards(users, ownerId) {
    const container = document.getElementById("voice-subscribers-grid");
    if (!container) return;

    // Limpa o grid atual para re-renderizar
    container.innerHTML = "";

    users.forEach(user => {
        // Verifica status para aplicar classes dinâmicas
        const isOwner = user.uid === ownerId;
        const micClass = user.micOn ? "on" : "off";
        const speakingClass = user.isSpeaking ? "speaking" : ""; // O brilho verde do style.css

        // Sanitização de dados de exibição
        const safeName = escapeHTML(user.name);
        const safeUid = escapeHTML(user.uid);
        const safeAvatar = escapeHTML(user.avatar || "user-photo.jpg");

        // Cria a estrutura do Card (Baseado no seu style.css)
        const card = document.createElement("div");
        card.className = `voice-card ${speakingClass}`;
        card.id = `voice-card-${user.uid}`; // Facilita encontrar o card depois para animações

        card.innerHTML = `
            <div class="avatar-wrapper">
                <img src="${safeAvatar}" alt="${safeName}" class="voice-avatar" onerror="this.src='user-photo.jpg'">
                <div class="mic-indicator-dot ${micClass}" id="mic-dot-${user.uid}"></div>
            </div>
            <div class="voice-info">
                <span class="voice-name" title="${safeName}">${safeName}</span>
                <span class="voice-user-tag" title="${safeUid}">${safeUid}</span>
                <div class="voice-roles">
                    ${isOwner ? '<span class="badge-role owner">Dono da Sala</span>' : '<span class="badge-role">Membro</span>'}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}
