"use strict";

// Importações dos módulos necessários
import { socket, appState } from './main.js';
import { showScreen } from './ui.js';
import { initHome } from './profile.js';

// Variável local e privada para transitar a senha com segurança até o servidor responder
let pendingPassword = null;

// ==========================================
// 1. CONFIGURAÇÃO DA INTERFACE DE LOGIN/REGISTRO
// ==========================================
export function setupAuthInterface() {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const btnAuthSubmit = document.getElementById("btn-auth-submit");
    const btnLogout = document.getElementById("btn-logout");

    // Alternância de Abas
    if (tabLogin && tabRegister) {
        tabLogin.addEventListener("click", () => switchAuthMode("login"));
        tabRegister.addEventListener("click", () => switchAuthMode("register"));
    }

    // Submissão do Formulário
    if (btnAuthSubmit) {
        btnAuthSubmit.addEventListener("click", (e) => {
            e.preventDefault(); // Evita recarregamentos indesejados da página
            loginOrCreateAccount(btnAuthSubmit);
        });
    }

    // Logout
    if (btnLogout) {
        btnLogout.addEventListener("click", logout);
    }

    // Escutador único para a resposta do servidor (Evita listeners duplicados)
    socket.off("auth_response").on("auth_response", handleAuthResponse);
}

// ==========================================
// 2. LÓGICA DE INTERFACE E VALIDAÇÃO
// ==========================================
function switchAuthMode(mode) {
    appState.setAuthMode(mode);

    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const groupDisplayName = document.getElementById("group-displayname");
    const btnAuthSubmit = document.getElementById("btn-auth-submit");
    const authSubtitle = document.getElementById("auth-subtitle");

    if (mode === "login") {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        if (groupDisplayName) groupDisplayName.style.display = "none";
        if (btnAuthSubmit) btnAuthSubmit.innerText = "Entrar com Segurança";
        if (authSubtitle) authSubtitle.innerText = "De volta ao ecossistema? Faça seu login.";
    } else {
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        if (groupDisplayName) groupDisplayName.style.display = "block";
        if (btnAuthSubmit) btnAuthSubmit.innerText = "Criar Nova Conta";
        if (authSubtitle) authSubtitle.innerText = "Crie uma credencial única e defina seu perfil.";
    }
}

function loginOrCreateAccount(btnElement) {
    // Captura segura com Optional Chaining (?.) para evitar erros se o ID não existir no HTML
    const userTagInput = document.getElementById("login-username")?.value.trim();
    const passwordInput = document.getElementById("login-password")?.value;
    const displayNameInput = document.getElementById("login-displayname")?.value.trim();

    // Validações Base
    if (!userTagInput || !passwordInput) {
        return alert("Por favor, preencha o username e a senha!");
    }

    if (/[A-Z]/.test(userTagInput) || /\s/.test(userTagInput)) {
        return alert("O @username não pode conter letras maiúsculas ou espaços!");
    }

    // Trava o botão para evitar envio duplo (Double-Submit Prevention)
    const originalText = btnElement.innerText;
    btnElement.disabled = true;
    btnElement.innerText = "Autenticando...";
    btnElement.style.opacity = "0.7";
    btnElement.style.cursor = "wait";

    // Armazena a senha temporariamente apenas para salvar no cache em caso de sucesso
    pendingPassword = passwordInput;

    const currentMode = appState.currentAuthMode;

    if (currentMode === 'register') {
        if (!displayNameInput) {
            resetAuthButton(btnElement, originalText);
            return alert("Por favor, informe seu Nome de Exibição!");
        }
        socket.emit("submit_register", { username: userTagInput, displayName: displayNameInput, password: passwordInput });
    } else {
        socket.emit("submit_login", { username: userTagInput, password: passwordInput });
    }
}

// ==========================================
// 3. COMUNICAÇÃO COM O SERVIDOR E PERSISTÊNCIA
// ==========================================
function handleAuthResponse(response) {
    const btnAuthSubmit = document.getElementById("btn-auth-submit");
    if (btnAuthSubmit) {
        resetAuthButton(btnAuthSubmit, appState.currentAuthMode === "login" ? "Entrar com Segurança" : "Criar Nova Conta");
    }

    if (response.success) {
        const user = response.user;
        
        // Atrela a senha de backup para auto-login futuro
        user.password_backup = pendingPassword || (appState.currentUser ? appState.currentUser.password_backup : "");
        pendingPassword = null; // Limpa a variável de segurança da memória RAM

        // Atualiza estado global e grava no navegador
        appState.setCurrentUser(user);
        localStorage.setItem("sala_project_user", JSON.stringify(user));

        // Inicializa o Dashboard
        initHome();
    } else {
        pendingPassword = null; // Descarta a senha em caso de falha
        alert(response.message || "Erro de autenticação.");
        showScreen("login");
    }
}

export function handleAutomaticLogin(savedUserStr) {
    try {
        const savedUser = JSON.parse(savedUserStr);
        if (savedUser && savedUser.uid && savedUser.password_backup) {
            
            // Ocultamente seta o usuário para manter a referência da senha durante o reconnect
            appState.setCurrentUser(savedUser);
            pendingPassword = savedUser.password_backup;

            console.log("[AUTH] Tentando reautenticação silenciosa...");
            socket.emit("submit_login", { 
                username: savedUser.uid.split('#')[0], 
                password: savedUser.password_backup 
            });
        } else {
            throw new Error("Payload de persistência inválido ou obsoleto.");
        }
    } catch (e) {
        console.warn("[AUTH] Falha ao restaurar sessão:", e.message);
        localStorage.removeItem("sala_project_user");
        showScreen("login");
    }
}

function logout() {
    if (confirm("Deseja realmente desconectar do sistema?")) {
        console.log("[AUTH] Encerrando sessão do usuário.");
        localStorage.removeItem("sala_project_user");
        appState.setCurrentUser(null);
        location.reload(); // Hard reset para limpar todos os estados da página
    }
}

// Função utilitária interna
function resetAuthButton(btn, text) {
    btn.disabled = false;
    btn.innerText = text;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
}
