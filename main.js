"use strict";

// main.js - Inicializador Core, Estado Global e Instância Socket.io

import { setupAuthInterface, handleAutomaticLogin } from './auth.js';
import { setupNavigation } from './ui-navigation.js';

// ==========================================
// 1. INICIALIZAÇÃO DO WEBSOCKET
// ==========================================
// Altere para a URL correta do seu servidor Node de produção se necessário
export const socket = io("http://localhost:3000", {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000
});

// ==========================================
// 2. SISTEMA DE ESTADO GLOBAL (BLINDADO)
// ==========================================
class ApplicationState {
    #currentUser = null;
    #currentAuthMode = "login"; // "login" ou "register"
    #activeRoom = null;

    constructor() {
        if (ApplicationState.instance) return ApplicationState.instance;
        ApplicationState.instance = this;
    }

    // Getters e Setters controlados
    get currentUser() { return this.#currentUser; }
    setCurrentUser(user) { this.#currentUser = user; }

    get currentAuthMode() { return this.#currentAuthMode; }
    setAuthMode(mode) { this.#currentAuthMode = mode; }

    get activeRoom() { return this.#activeRoom; }
    setActiveRoom(room) { 
        this.#activeRoom = room;
        const navBtnRoom = document.getElementById("nav-btn-room");
        
        // Exibe ou esconde o botão de atalho da sala dinamicamente na barra global
        if (navBtnRoom) {
            navBtnRoom.style.display = room ? "flex" : "none";
        }
    }
}

export const appState = new ApplicationState();

// ==========================================
// 3. MONITORAMENTO DE CONEXÃO E CICLO DE VIDA
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    console.log("[CORE] Inicializando ecossistema Sala Project...");

    // Instancia as escutas de clique da barra de abas e do form de login
    setupNavigation();
    setupAuthInterface();

    // Tenta reautenticação automática via cache local do navegador
    const cachedUser = localStorage.getItem("sala_project_user");
    if (cachedUser) {
        handleAutomaticLogin(cachedUser);
    } else {
        // Se não houver cache, garante que a tela de login flutuante esteja visível
        const authScreen = document.getElementById("auth-screen");
        if (authScreen) authScreen.style.display = "flex";
    }
});

// Sincronização Automática em quedas de rede (Auto-reconnect Auth Match)
socket.on("connect", () => {
    console.log("[SOCKET] Conectado ao servidor de eventos corporativos.");
    
    // Se o usuário já estava logado e o socket caiu, re-autentica em background silenciosamente
    if (appState.currentUser && appState.currentUser.password_backup) {
        let targetUsername = appState.currentUser.username || appState.currentUser.uid;
        if (typeof targetUsername === 'string' && targetUsername.includes('#')) {
            targetUsername = targetUsername.split('#')[0];
        }
        
        socket.emit("submit_login", {
            username: targetUsername,
            password: appState.currentUser.password_backup
        });
    }
});

socket.on("disconnect", () => {
    console.warn("[SOCKET] Conexão perdida com o servidor. Aguardando recuperação...");
});
