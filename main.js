"use strict";

// main.js - Ponto de Entrada, Gerenciamento de Estado e Resiliência de Rede
import { showScreen } from './ui.js';
import { setupAuthInterface, handleAutomaticLogin } from './auth.js';
import { setupRoomCreationInterface } from './rooms.js';
import { setupProfileInterface } from './profile.js';
import { setupChatInterface } from './chat.js';
import { setupVoiceInterface } from './voice.js';
import { setupFriendsInterface } from './friends.js'; // [NOVO] Importação do sistema social

// ==========================================
// 1. CONEXÃO RESILIENTE (WEBSOCKET)
// ==========================================
// Configuração avançada com tentativas de reconexão automática e timeouts
export const socket = io("https://sala-project.onrender.com", {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 10000,
    transports: ['websocket', 'polling'] // Prioriza websocket puro para menor latência
});

// Monitoramento proativo da rede
socket.on("connect_error", (err) => {
    console.warn("[REDE] Instabilidade detectada na conexão com o servidor:", err.message);
});

socket.on("reconnect", (attempt) => {
    console.log(`[REDE] Conexão restabelecida após ${attempt} tentativa(s).`);
});

// ==========================================
// 2. GERENCIAMENTO DE ESTADO GLOBAL (SINGLETON)
// ==========================================
// Encapsulamento do estado para evitar mutações diretas indesejadas e garantir rastreabilidade
const _state = {
    currentUser: null,
    currentRoom: null,
    localStream: null,
    audioContext: null,
    audioAnalyser: null,
    micInterval: null,
    currentAuthMode: "login" // 'login' | 'register'
};

// Exportamos um objeto congelado com getters e setters controlados
export const appState = {
    // Getters
    get currentUser() { return _state.currentUser; },
    get currentRoom() { return _state.currentRoom; },
    get localStream() { return _state.localStream; },
    get audioContext() { return _state.audioContext; },
    get audioAnalyser() { return _state.audioAnalyser; },
    get micInterval() { return _state.micInterval; },
    get currentAuthMode() { return _state.currentAuthMode; },

    // Setters controlados com logs para debug facilitado
    setCurrentUser(userData) {
        _state.currentUser = userData;
        console.debug("[ESTADO] currentUser atualizado:", userData ? userData.uid : "null");
    },
    setCurrentRoom(roomData) {
        _state.currentRoom = roomData;
        console.debug("[ESTADO] currentRoom atualizado:", roomData ? roomData.id : "null");
    },
    setAudioEntity(key, value) {
        const validKeys = ['localStream', 'audioContext', 'audioAnalyser', 'micInterval'];
        if (validKeys.includes(key)) {
            _state[key] = value;
        } else {
            console.error(`[ERRO] Tentativa de alterar chave de áudio inválida: ${key}`);
        }
    },
    setAuthMode(mode) {
        if (mode === "login" || mode === "register") {
            _state.currentAuthMode = mode;
        }
    }
};

// ==========================================
// 3. INICIALIZAÇÃO BLINDADA DO DOM (BOOTSTRAP)
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    try {
        console.log("[SISTEMA] Iniciando inicialização do ecossistema Alfa...");

        // 1. Interface de contenção inicial
        showScreen("login");

        // 2. Injeção de dependências e eventos na UI
        initModules();

        // 3. Restauração de Sessão Segura
        restoreSession();

        console.log("[SISTEMA] Ecossistema carregado com sucesso.");
    } catch (error) {
        console.error("[ERRO CRÍTICO] Falha na inicialização do DOM:", error);
        alert("Ocorreu um erro ao carregar o aplicativo. Verifique sua conexão e tente novamente.");
    }
});

function initModules() {
    setupAuthInterface();
    setupProfileInterface();
    setupRoomCreationInterface();
    setupVoiceInterface();
    setupChatInterface();
    setupFriendsInterface(); // [NOVO] Inicialização do sistema de amigos
}

function restoreSession() {
    try {
        const savedUser = localStorage.getItem("sala_project_user");
        if (savedUser) {
            handleAutomaticLogin(savedUser);
        }
    } catch (e) {
        console.error("[SESSÃO] Dados locais corrompidos. Limpando cache.", e);
        localStorage.removeItem("sala_project_user");
    }
}
