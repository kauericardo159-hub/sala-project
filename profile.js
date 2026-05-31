"use strict";

// profile.js - Inicialização do Dashboard e Gerenciamento de Avatar — Pro Version

import { socket, appState } from './main.js';
import { showScreen, escapeHTML } from './ui.js';

// ==========================================
// 1. INICIALIZAÇÃO DA DASHBOARD
// ==========================================
export function initHome() {
    const user = appState.currentUser;
    if (!user) {
        console.error("[PERFIL] Tentativa de carregar a Home sem usuário logado.");
        return;
    }

    // Exibe a tela do Dashboard
    showScreen("dashboard");

    // 🔥 CORREÇÃO: Garante que os dados locais mais recentes do localStorage sejam aplicados na barra lateral
    restoreLocalProfileData();

    // Atualiza as informações visuais da barra lateral
    updateSidebarProfile();

    console.log("[DASHBOARD] Solicitando lista de salas ao servidor...");
    socket.emit("request_room_list");
}

// ==========================================
// 2. RECUPERAÇÃO DE SEGURANÇA LOCAL
// ==========================================
function restoreLocalProfileData() {
    try {
        const savedUserRaw = localStorage.getItem("sala_project_user");
        if (savedUserRaw) {
            const cachedUser = JSON.parse(savedUserRaw);
            const currentUser = appState.currentUser;
            
            // Se o cache local tiver dados mais recentes ou uma foto que o servidor perdeu, recupera
            if (currentUser && cachedUser && cachedUser.uid === currentUser.uid) {
                if (cachedUser.avatar && !currentUser.avatar) {
                    console.log("[PERFIL] Sincronizando avatar do localStorage para o appState.");
                    currentUser.avatar = cachedUser.avatar;
                }
            }
        }
    } catch (e) {
        console.error("[PERFIL] Erro na redundância de cache local:", e);
    }
}

// ==========================================
// 3. ATUALIZAÇÃO VISUAL (DOM)
// ==========================================
function updateSidebarProfile() {
    const user = appState.currentUser;
    if (!user) return;

    const nameEl = document.getElementById("sidebar-user-name");
    const tagEl = document.getElementById("sidebar-user-tag");
    const avatarEl = document.getElementById("sidebar-avatar");

    if (nameEl) nameEl.innerHTML = escapeHTML(user.name);
    
    if (tagEl && user.uid) {
        const parts = user.uid.split('#');
        const username = parts[0] || "user";
        const number = parts[1] || "0000";
        tagEl.innerHTML = `${escapeHTML(username)} <span style="opacity: 0.7">#${escapeHTML(number)}</span>`;
    }

    if (avatarEl) {
        avatarEl.onerror = null;
        
        const targetSrc = user.avatar || "user-photo.jpg";
        
        console.log("[DOM] Renderizando imagem no perfil. Tipo:", targetSrc.startsWith("data:") ? "Base64 Real" : "URL Estática");
        avatarEl.src = targetSrc;
        
        if (!targetSrc.startsWith("data:")) {
            avatarEl.onerror = function() {
                this.src = "user-photo.jpg";
                this.onerror = null;
            };
        }
    }
}

// ==========================================
// 4. EVENTOS DE INTERFACE E UPLOAD
// ==========================================
export function setupProfileInterface() {
    const avatarInput = document.getElementById("avatar-input");

    if (avatarInput) {
        console.log("[PERFIL] Escutador do input de arquivo ativado com sucesso.");
        // 🔥 CORREÇÃO: Remove listeners antigos antes de aplicar para evitar disparos duplicados no Acode
        avatarInput.removeEventListener("change", handleAvatarUpload);
        avatarInput.addEventListener("change", handleAvatarUpload);
    } else {
        console.warn("[PERFIL] Alerta: O elemento '#avatar-input' não foi encontrado no HTML atual.");
    }

    // Escuta a resposta positiva de salvamento vinda do servidor
    socket.off("profile_updated_success").on("profile_updated_success", (updatedUser) => {
        if (updatedUser) {
            console.log("[PERFIL] Confirmação recebida do servidor. Atualizando persistência.");
            
            // 🔥 CORREÇÃO CRÍTICA: Preserva a senha criptografada de backup para não quebrar o auto-login do main.js
            const currentBackup = appState.currentUser?.password_backup;
            
            // Atualiza o estado global com os dados limpos do servidor
            appState.setCurrentUser(updatedUser);
            
            // Injeta o backup de volta no estado atualizado
            if (currentBackup && appState.currentUser) {
                appState.currentUser.password_backup = currentBackup;
            }
            
            // Salva de forma definitiva no LocalStorage do navegador/celular
            localStorage.setItem("sala_project_user", JSON.stringify(appState.currentUser));
            
            // Força o DOM a redesenhar
            updateSidebarProfile();
        }
    });
}

// ==========================================
// 5. PROCESSAMENTO DE IMAGEM (PREVIEW IMEDIATO)
// ==========================================
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Por favor, selecione apenas arquivos de imagem (PNG, JPG, GIF).");
        event.target.value = "";
        return;
    }

    // 💡 Reduzido para 1MB estável. Strings Base64 aumentam o tamanho do arquivo em ~33%. 
    // 1MB em arquivo físico vira ~1.33MB de texto, margem perfeita para o Render processar sem dar timeout.
    const MAX_SIZE = 1 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
        alert("A imagem escolhida é muito pesada! Escolha uma imagem de até 1MB para evitar erros de rede.");
        event.target.value = ""; 
        return;
    }

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const base64Image = e.target.result;
        const user = appState.currentUser;

        if (!user) return;

        // OTIMISMO VISUAL: Atualiza a tela na hora para o usuário sentir o app rápido
        const avatarEl = document.getElementById("sidebar-avatar");
        if (avatarEl) {
            avatarEl.src = base64Image;
        }

        // 🔥 CORREÇÃO: Atualiza o estado na memória do celular imediatamente antes do envio
        user.avatar = base64Image;
        localStorage.setItem("sala_project_user", JSON.stringify(user));

        console.log("[PERFIL] Despachando payload de atualização para o servidor...");
        const activeRoomId = appState.currentRoom ? appState.currentRoom.id : null;

        socket.emit("update_user_profile", {
            roomId: activeRoomId,
            user: {
                uid: user.uid,
                name: user.name,
                avatar: base64Image
            }
        });
    };

    reader.onerror = function() {
        console.error("[ERRO] O FileReader falhou ao decodificar a imagem.");
        alert("Erro ao ler o arquivo físico no dispositivo.");
    };

    reader.readAsDataURL(file);
}
