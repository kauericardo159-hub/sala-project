"use strict";

// auth.js - Handshake de Autenticação e Sincronismo de Sessão

import { socket, appState } from './main.js';
import { changeView } from './ui-navigation.js';
import { initHome } from './profile.js';

let pendingPassword = null;

// ==========================================
// 1. CONFIGURAÇÃO DA INTERFACE DE AUTENTICAÇÃO
// ==========================================
export function setupAuthInterface() {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const authForm = document.getElementById("auth-form");

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener("click", () => switchAuthMode("login"));
        tabRegister.addEventListener("click", () => switchAuthMode("register"));
    }

    if (authForm) {
        authForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById("btn-auth-submit");
            if (btnSubmit && !btnSubmit.disabled) {
                processAuth(btnSubmit);
            }
        });
    }

    // Vincula a escuta única da resposta de autenticação do servidor
    socket.off("auth_response").on("auth_response", handleAuthResponse);
}

// ==========================================
// 2. ALTERNÂNCIA DE MODO (LOGIN / CADASTRO)
// ==========================================
function switchAuthMode(mode) {
    appState.setAuthMode(mode);

    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const groupDisplayName = document.getElementById("group-displayname");
    const btnAuthSubmit = document.getElementById("btn-auth-submit");
    const authSubtitle = document.getElementById("auth-subtitle");

    if (mode === "login") {
        tabLogin?.classList.add("active");
        tabRegister?.classList.remove("active");
        if (groupDisplayName) groupDisplayName.style.setProperty("display", "none", "important");
        if (btnAuthSubmit) btnAuthSubmit.innerText = "Acessar Plataforma";
        if (authSubtitle) authSubtitle.innerText = "Conecte-se ao ecossistema global.";
    } else {
        tabRegister?.classList.add("active");
        tabLogin?.classList.remove("active");
        if (groupDisplayName) groupDisplayName.style.setProperty("display", "block", "important");
        if (btnAuthSubmit) btnAuthSubmit.innerText = "Criar Nova Conta";
        if (authSubtitle) authSubtitle.innerText = "Defina suas credenciais exclusivas.";
    }
}

// ==========================================
// 3. ENVIO DE DADOS PARA O BACKEND
// ==========================================
function processAuth(btnSubmit) {
    const usernameInput = document.getElementById("auth-username")?.value.trim();
    const passwordInput = document.getElementById("auth-password")?.value;
    const displayNameInput = document.getElementById("auth-displayname")?.value.trim();

    if (!usernameInput || !passwordInput) {
        return alert("Preencha todos os campos obrigatórios!");
    }

    if (/[A-Z]/.test(usernameInput) || /\s/.test(usernameInput)) {
        return alert("O username não pode conter letras maiúsculas ou espaços em branco!");
    }

    // Bloqueia cliques duplicados (Double-Submit Protection)
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Processando...";

    pendingPassword = passwordInput;
    const mode = appState.currentAuthMode;

    if (mode === "register") {
        socket.emit("submit_register", { 
            username: usernameInput, 
            displayName: displayNameInput || usernameInput, 
            password: passwordInput 
        });
    } else {
        socket.emit("submit_login", { username: usernameInput, password: passwordInput });
    }
}

// ==========================================
// 4. TRATAMENTO DA RESPOSTA E INICIALIZAÇÃO
// ==========================================
function handleAuthResponse(response) {
    const btnSubmit = document.getElementById("btn-auth-submit");
    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerText = appState.currentAuthMode === "login" ? "Acessar Plataforma" : "Criar Nova Conta";
    }

    if (response.success) {
        const user = response.user;
        
        // Atrela a credencial em RAM e salva na persistência local para relogar sozinho depois
        user.password_backup = pendingPassword || (appState.currentUser ? appState.currentUser.password_backup : "");
        pendingPassword = null;

        appState.setCurrentUser(user);
        localStorage.setItem("sala_project_user", JSON.stringify(user));

        // Transiciona a interface removendo o bloqueio visual do formulário
        const authScreen = document.getElementById("auth-screen");
        const appContainer = document.getElementById("app-container");
        
        if (authScreen) authScreen.style.display = "none";
        if (appContainer) appContainer.style.display = "flex";

        // Inicializa o Perfil padrão e direciona o usuário para a aba de Perfil
        initHome();
        changeView("view-profile");
    } else {
        pendingPassword = null;
        alert(response.message || "Credenciais inválidas.");
    }
}

// ==========================================
// 5. LOGIN AUTOMÁTICO VIA CACHE LOCAL
// ==========================================
export function handleAutomaticLogin(savedUserStr) {
    try {
        const savedUser = JSON.parse(savedUserStr);
        if (savedUser && savedUser.username && savedUser.password_backup) {
            pendingPassword = savedUser.password_backup;
            
            // ADAPTAÇÃO: O username enviado agora é estritamente o texto puro limpo.
            const cleanUsername = savedUser.username.toLowerCase().trim();

            console.log("[AUTH] Tentando login automático estável para:", cleanUsername);
            socket.emit("submit_login", { username: cleanUsername, password: savedUser.password_backup });
        } else {
            throw new Error("Formato de cache corrompido.");
        }
    } catch (e) {
        console.warn("[AUTH] Falha no login automático, limpando cache:", e.message);
        localStorage.removeItem("sala_project_user");
        const authScreen = document.getElementById("auth-screen");
        if (authScreen) authScreen.style.display = "flex";
    }
}
