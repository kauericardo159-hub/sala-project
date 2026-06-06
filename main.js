"use strict";

// main.js - Inicializador Core, Estado Global e Instância Socket.io

import { setupAuthInterface, handleAutomaticLogin } from './auth.js';
import { setupNavigation } from './ui-navigation.js';

// ==========================================
// 1. INICIALIZAÇÃO DO WEBSOCKET
// ==========================================
export const socket = io("https://sala-project.onrender.com", {
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

    get currentUser() { return this.#currentUser; }
    setCurrentUser(user) { this.#currentUser = user; }

    get currentAuthMode() { return this.#currentAuthMode; }
    setAuthMode(mode) { this.#currentAuthMode = mode; }

    get activeRoom() { return this.#activeRoom; }
    setActiveRoom(room) { 
        this.#activeRoom = room;
        const navBtnRoom = document.getElementById("nav-btn-room");
        
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

    setupNavigation();
    setupAuthInterface();

    const cachedUserStr = localStorage.getItem("sala_project_user");
    if (cachedUserStr) {
        try {
            const parsed = JSON.parse(cachedUserStr);
            
            // ADAPTAÇÃO: Se o cache tiver o formato antigo misturado, força um reset para evitar falhas
            if (!parsed.username || parsed.username.includes('_') || parsed.username.includes('#')) {
                console.warn("[CORE] Formato de cache antigo detectado. Expulsando resquícios do bug anterior...");
                localStorage.removeItem("sala_project_user");
                document.getElementById("auth-screen").style.display = "flex";
                return;
            }

            handleAutomaticLogin(cachedUserStr);
        } catch (e) {
            localStorage.removeItem("sala_project_user");
            document.getElementById("auth-screen").style.display = "flex";
        }
    } else {
        const authScreen = document.getElementById("auth-screen");
        if (authScreen) authScreen.style.display = "flex";
    }
});

// Sincronização Automática em quedas de rede (Auto-reconnect Auth Match)
socket.on("connect", () => {
    console.log("[SOCKET] Conectado ao servidor de eventos.");
    
    // CORREÇÃO CRÍTICA: Processa a reconexão automática usando apenas o username limpo
    if (appState.currentUser && appState.currentUser.password_backup) {
        const targetUsername = String(appState.currentUser.username).toLowerCase().trim();
        
        console.log("[SOCKET] Reconectando sessão silenciosamente para o usuário estável:", targetUsername);
        socket.emit("submit_login", {
            username: targetUsername,
            password: appState.currentUser.password_backup
        });
    }
});

socket.on("disconnect", () => {
    console.warn("[SOCKET] Conexão perdida com o servidor. Aguardando recuperação...");
});
