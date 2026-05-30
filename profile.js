"use strict";

// profile.js - Inicialização do Dashboard e Gerenciamento de Avatar

import { socket, appState } from './main.js';
import { showScreen, escapeHTML } from './ui.js';

// ==========================================
// 1. INICIALIZAÇÃO DA DASHBOARD
// ==========================================
/**
 * Chamada logo após o login ser bem-sucedido.
 * Prepara a tela principal, carrega os dados do usuário e solicita a lista de salas.
 */
export function initHome() {
    const user = appState.currentUser;
    if (!user) {
        console.error("[PERFIL] Tentativa de carregar a Home sem usuário logado.");
        return;
    }

    // Exibe a tela do Dashboard
    showScreen("dashboard");

    // Atualiza as informações visuais da barra lateral
    updateSidebarProfile();

    // Solicita ao servidor a lista atualizada de salas públicas
    console.log("[DASHBOARD] Solicitando lista de salas ao servidor...");
    socket.emit("get_rooms");
}

// ==========================================
// 2. ATUALIZAÇÃO VISUAL (DOM)
// ==========================================
/**
 * Injeta o nome, UID e a foto de perfil do usuário na barra lateral esquerda.
 */
function updateSidebarProfile() {
    const user = appState.currentUser;
    if (!user) return;

    const nameEl = document.getElementById("sidebar-user-name");
    const tagEl = document.getElementById("sidebar-user-tag");
    const avatarEl = document.getElementById("sidebar-avatar");

    if (nameEl) nameEl.innerHTML = escapeHTML(user.name);
    
    if (tagEl) {
        // Separa o UID para exibir formatado (ex: @joao #000001)
        const [username, number] = user.uid.split('#');
        tagEl.innerHTML = `${escapeHTML(username)} <span style="opacity: 0.7">#${escapeHTML(number)}</span>`;
    }

    if (avatarEl) {
        avatarEl.src = user.avatar || "user-photo.jpg";
    }
}

// ==========================================
// 3. EVENTOS DE INTERFACE E UPLOAD
// ==========================================
export function setupProfileInterface() {
    const avatarInput = document.getElementById("avatar-input");

    // Escuta a seleção de um novo arquivo de imagem
    if (avatarInput) {
        avatarInput.addEventListener("change", handleAvatarUpload);
    }

    // Escuta a confirmação do servidor de que o perfil foi atualizado
    socket.off("profile_updated").on("profile_updated", (updatedUser) => {
        if (updatedUser) {
            // Mantém a senha de backup para auto-login
            updatedUser.password_backup = appState.currentUser.password_backup;
            
            // Atualiza o estado global e o localStorage
            appState.setCurrentUser(updatedUser);
            localStorage.setItem("sala_project_user", JSON.stringify(updatedUser));
            
            // Re-renderiza a interface
            updateSidebarProfile();
            console.log("[PERFIL] Avatar atualizado com sucesso!");
        }
    });
}

// ==========================================
// 4. PROCESSAMENTO DE IMAGEM (BASE64)
// ==========================================
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validação 1: É uma imagem?
    if (!file.type.startsWith("image/")) {
        alert("Por favor, selecione apenas arquivos de imagem (PNG, JPG, GIF).");
        event.target.value = ""; // Limpa o input
        return;
    }

    // Validação 2: Tamanho máximo (2MB = 2 * 1024 * 1024 bytes)
    const MAX_SIZE = 2 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
        alert("A imagem é muito pesada! O tamanho máximo permitido é 2MB.");
        event.target.value = ""; 
        return;
    }

    // Processamento seguro utilizando FileReader
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const base64Image = e.target.result;
        const user = appState.currentUser;

        if (user && user.uid) {
            console.log("[PERFIL] Enviando nova imagem para o servidor...");
            
            // Emite para o servidor a alteração (o bancos.js vai interceptar isso)
            socket.emit("update_profile", {
                uid: user.uid,
                newName: user.name, // Mantém o nome atual
                newAvatar: base64Image
            });
        }
    };

    reader.onerror = function() {
        console.error("[ERRO] Falha ao ler o arquivo de imagem.");
        alert("Ocorreu um erro ao processar sua foto. Tente novamente.");
    };

    // Inicia a leitura do arquivo convertendo para string Base64
    reader.readAsDataURL(file);
}
