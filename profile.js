"use strict";

// profile.js - Gerenciamento de Exibição e Dados do Perfil Local

import { appState, socket } from './main.js';

// ==========================================
// 1. INICIALIZAÇÃO E POVOAMENTO DO PERFIL
// ==========================================
export function initHome() {
    const user = appState.currentUser;
    if (!user) return;

    // Captura os elementos do DOM da aba de perfil
    const imgAvatar = document.getElementById("my-profile-avatar");
    const txtName = document.getElementById("my-profile-name");
    const txtTag = document.getElementById("my-profile-tag");
    const avatarUploader = document.getElementById("avatar-uploader");

    // Atualiza os dados de texto com base no payload do usuário
    if (txtName) txtName.innerText = user.displayName || user.username;
    if (txtTag) txtTag.innerText = user.tag ? `@${user.username}#${user.tag}` : `@${user.username}`;
    
    // Define o avatar padrão caso o usuário não possua um em nuvem
    if (imgAvatar && user.avatarUrl) {
        imgAvatar.src = user.avatarUrl;
    } else if (imgAvatar) {
        imgAvatar.src = "https://api.dicebear.com/7.x/bottts/svg?seed=" + user.username;
    }

    // Configura o escutador do seletor de arquivos de imagem (Evita duplicações)
    if (avatarUploader) {
        avatarUploader.removeAttribute("data-has-listener");
        avatarUploader.addEventListener("change", handleAvatarUpload);
        avatarUploader.setAttribute("data-has-listener", "true");
    }

    // Escuta atualizações de perfil vindas do servidor
    socket.off("profile_updated").on("profile_updated", (data) => {
        if (data.success && appState.currentUser) {
            appState.currentUser.avatarUrl = data.avatarUrl;
            localStorage.setItem("sala_project_user", JSON.stringify(appState.currentUser));
            if (imgAvatar) imgAvatar.src = data.avatarUrl;
        }
    });
}

// ==========================================
// 2. PROCESSAMENTO DO BUFFER DO AVATAR (BASE64)
// ==========================================
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Limita o tamanho do arquivo a 2MB para tráfego seguro via WebSockets
    if (file.size > 2 * 1024 * 1024) {
        alert("A imagem selecionada é muito grande! Escolha uma foto de até 2MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result;
        
        console.log("[PROFILE] Enviando novo avatar para processamento...");
        socket.emit("update_avatar", {
            uid: appState.currentUser.uid,
            avatar: base64Data
        });
    };
    
    reader.readAsDataURL(file);
}
