"use strict";

// main.js - Ponto de Entrada, Gerenciamento de Estado e Resiliência de Rede — Pro Version

import { showScreen } from './ui.js';
import { setupAuthInterface, handleAutomaticLogin } from './auth.js';
import { setupRoomCreationInterface } from './rooms.js';
import { setupProfileInterface } from './profile.js';
import { setupChatInterface } from './chat.js';
import { setupVoiceInterface } from './voice.js';
import { setupFriendsInterface } from './friends.js';

// ==========================================
// CONFIGURAÇÃO DE AMBIENTE (CONEXÃO DIRETA COM A NUVEM)
// ==========================================
// 🔥 CORREÇÃO CRÍTICA: Como o Acode não roda backend local, apontamos direto para o Render.
const SERVER_URL = "https://sala-project.onrender.com";

console.log(`[SISTEMA] Conectando ao ecossistema no endereço: ${SERVER_URL}`);

// ==========================================
// 1. CONEXÃO RESILIENTE (WEBSOCKET)
// ==========================================
export const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 15000, // Aumentado um pouco para dar tempo do Render acordar se estiver em standby
    transports: ['websocket', 'polling']
});

// Monitoramento proativo da rede e auto-recuperação de sessão
socket.on("connect_error", (err) => {
    console.warn("[REDE] Instabilidade detectada na conexão com o servidor:", err.message);
});

socket.on("reconnect", (attempt) => {
    console.log(`[REDE] Conexão restabelecida após ${attempt} tentativa(s).`);
    
    // Se o usuário caiu e reconectou, reautentica no servidor em background
    if (_state.currentUser && _state.currentUser.username && _state.currentUser.password_backup) {
        console.log("[REDE] Sincronizando credenciais do Socket com o servidor...");
        socket.emit("submit_login", {
            username: _state.currentUser.username,
            password: _state.currentUser.password_backup
        });
        
        // Se ele estava em uma sala antes da queda, re-entra automaticamente
        if (_state.currentRoom) {
            console.log(`[REDE] Recuperando presença na sala: ${_state.currentRoom.id}`);
            socket.emit("join_room", {
                roomId: _state.currentRoom.id,
                password: _state.currentRoom.password || "",
                user: _state.currentUser
            });
        }
    }
});

// ==========================================
// 2. GERENCIAMENTO DE ESTADO GLOBAL (SINGLETON)
// ==========================================
const _state = {
    currentUser: null,
    currentRoom: null,
    localStream: null,
    audioContext: null,
    audioAnalyser: null,
    micInterval: null,
    currentAuthMode: "login"
};

export const appState = {
    get currentUser() { return _state.currentUser; },
    get currentRoom() { return _state.currentRoom; },
    get localStream() { return _state.localStream; },
    get audioContext() { return _state.audioContext; },
    get audioAnalyser() { return _state.audioAnalyser; },
    get micInterval() { return _state.micInterval; },
    get currentAuthMode() { return _state.currentAuthMode; },

    setCurrentUser(userData) {
        _state.currentUser = userData;
        console.debug("[ESTADO] currentUser updated:", userData ? userData.uid : "null");
    },
    setCurrentRoom(roomData) {
        _state.currentRoom = roomData;
        console.debug("[ESTADO] currentRoom updated:", roomData ? roomData.id : "null");
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
// 3. LISTENERS GLOBAIS DE ESTADO (BLINDAGEM DE INTERFACE)
// ==========================================
socket.on("room_joined_success", (room) => {
    console.log("[ESTADO] Confirmação de entrada na sala recebida com sucesso:", room.id);
    appState.setCurrentRoom(room);
    showScreen("room"); 
});

socket.on("room_error", (errorMessage) => {
    alert(`Erro na Sala: ${errorMessage}`);
});

// ==========================================
// 4. INICIALIZAÇÃO BLINDADA DO DOM (BOOTSTRAP)
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    try {
        console.log("[SISTEMA] Iniciando inicialização do ecossistema Alfa...");

        showScreen("login");
        initModules();
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
    setupFriendsInterface();
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
