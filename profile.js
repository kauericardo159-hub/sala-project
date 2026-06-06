"use strict";

// profile.js - Gerenciamento de Exibição, Edição de Nome e Upload de Avatar

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
    
    // Novos elementos para alteração de nome de exibição
    const inputNewName = document.getElementById("input-change-displayname");
    const btnSaveName = document.getElementById("btn-save-displayname");

    // Preenche os dados iniciais na tela
    if (txtName) txtName.innerText = user.displayName || user.username;
    if (txtTag) txtTag.innerText = user.tag ? `@${user.username}#${user.tag}` : `@${user.username}`;
    
    // Define o valor inicial do input de texto com o nome atual
    if (inputNewName) inputNewName.value = user.displayName || user.username;
    
    // Renderiza o avatar de forma permanente (Base64 vindo do Supabase ou o DiceBear padrão)
    if (imgAvatar) {
        if (user.avatarUrl && user.avatarUrl !== "user-photo.jpg" && user.avatarUrl.trim() !== "") {
            imgAvatar.src = user.avatarUrl;
        } else {
            imgAvatar.src = "https://api.dicebear.com/7.x/bottts/svg?seed=" + user.username;
        }
    }

    // Configura o escutador de upload de foto (Evita duplicações de cliques)
    if (avatarUploader) {
        // Correção de boas práticas: recria o listener limpando o anterior clones/atribuições
        const newUploader = avatarUploader.cloneNode(true);
        avatarUploader.parentNode.replaceChild(newUploader, avatarUploader);
        newUploader.addEventListener("change", handleAvatarUpload);
    }

    // Configura o escutador do botão de salvar novo nome
    if (btnSaveName) {
        const newBtn = btnSaveName.cloneNode(true);
        btnSaveName.parentNode.replaceChild(newBtn, btnSaveName);
        newBtn.addEventListener("click", () => {
            const newNameText = document.getElementById("input-change-displayname")?.value.trim();
            if (!newNameText) return alert("O Nome de Exibição não pode ficar vazio!");
            
            console.log("[PROFILE] Solicitando alteração permanente de nome para:", newNameText);
            
            // Dispara para o evento centralizado do servidor
            socket.emit("update_user_profile", {
                roomId: appState.activeRoom ? appState.activeRoom.id : null,
                user: {
                    uid: user.uid,
                    name: newNameText,
                    avatar: user.avatarUrl // Mantém a foto que já está salva
                }
            });
        });
    }

    // ==========================================
    // ESCUTAS DE RETORNO DO SERVIDOR (CORRIGIDAS)
    // ==========================================
    
    // 1. Retorno completo de alteração (update_user_profile ou update_avatar redirecionado)
    socket.off("profile_updated_success").on("profile_updated_success", (updatedAccount) => {
        console.log("[PROFILE] Sincronização recebida do Supabase:", updatedAccount);
        if (updatedAccount) {
            // Salva de forma permanente na RAM do aplicativo
            appState.currentUser.displayName = updatedAccount.displayName;
            appState.currentUser.avatarUrl = updatedAccount.avatarUrl;
            
            // Atualiza o LocalStorage para persistir mesmo se fechar o navegador/app
            localStorage.setItem("sala_project_user", JSON.stringify(appState.currentUser));
            
            // Atualiza os elementos visuais da interface imediatamente
            if (txtName) txtName.innerText = updatedAccount.displayName;
            if (imgAvatar) {
                if (updatedAccount.avatarUrl && updatedAccount.avatarUrl !== "user-photo.jpg") {
                    imgAvatar.src = updatedAccount.avatarUrl;
                } else {
                    imgAvatar.src = "https://api.dicebear.com/7.x/bottts/svg?seed=" + updatedAccount.username;
                }
            }
            
            alert("Perfil atualizado permanentemente na nuvem!");
        }
    });

    // 2. Retorno direto do evento rápido de foto (update_avatar)
    socket.off("profile_updated").on("profile_updated", (data) => {
        if (data.success && data.avatarUrl && appState.currentUser) {
            // Força a gravação permanente no estado e cache
            appState.currentUser.avatarUrl = data.avatarUrl;
            localStorage.setItem("sala_project_user", JSON.stringify(appState.currentUser));
            
            if (imgAvatar) imgAvatar.src = data.avatarUrl;
            console.log("[PROFILE] Avatar persistido local e remotamente.");
        }
    });
}

// ==========================================
// 2. PROCESSAMENTO E ENVIO DO AVATAR (BASE64)
// ==========================================
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert("A imagem selecionada é muito grande! Escolha uma foto de até 2MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result;
        
        console.log("[PROFILE] Enviando novo avatar em Base64 para persistência...");
        
        // Exibição instantânea preventiva para uma sensação de carregamento veloz
        const imgAvatar = document.getElementById("my-profile-avatar");
        if (imgAvatar) imgAvatar.src = base64Data;

        // Envia para o servidor que agora salva corretamente na coluna 'avatar'
        socket.emit("update_avatar", {
            uid: appState.currentUser.uid,
            avatar: base64Data
        });
    };
    
    reader.readAsDataURL(file);
}
