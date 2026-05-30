"use strict";

// voice.js - Gerenciamento de Hardware, Microfone e Efeito Visual de Voz

import { socket, appState } from './main.js';
import { showScreen, renderVoiceCards } from './ui.js';

// ==========================================
// 1. CONFIGURAÇÃO DA INTERFACE DE ÁUDIO
// ==========================================
export function setupVoiceInterface() {
    const btnMute = document.getElementById("btn-mute");
    const btnLeaveRoom = document.getElementById("btn-leave-room");

    // Botão Mutar / Desmutar
    if (btnMute) {
        btnMute.addEventListener("click", toggleMicrophone);
    }

    // Botão Sair da Sala
    if (btnLeaveRoom) {
        btnLeaveRoom.addEventListener("click", leaveRoom);
    }

    // ==========================================
    // ESCUTADORES SOCKET (EVENTOS DA SALA)
    // ==========================================
    
    // Alguém entrou ou saiu (re-renderiza o grid)
    socket.off("room_users_update").on("room_users_update", (users) => {
        const room = appState.currentRoom;
        if (room) {
            room.users = users; // Atualiza o estado local
            renderVoiceCards(users, room.ownerId);
        }
    });

    // Alguém mutou/desmutou o microfone
    socket.off("user_mic_toggled").on("user_mic_toggled", ({ uid, micOn }) => {
        const room = appState.currentRoom;
        if (room) {
            const user = room.users.find(u => u.uid === uid);
            if (user) {
                user.micOn = micOn;
                renderVoiceCards(room.users, room.ownerId); // Re-renderiza para mudar o ícone
            }
        }
    });

    // Alguém começou ou parou de falar (Efeito de brilho verde)
    socket.off("user_speaking").on("user_speaking", ({ uid, isSpeaking }) => {
        const room = appState.currentRoom;
        if (room) {
            const user = room.users.find(u => u.uid === uid);
            if (user) user.isSpeaking = isSpeaking;

            // Em vez de re-renderizar todo o grid por causa do brilho, alteramos direto no DOM por performance
            const card = document.getElementById(`voice-card-${uid}`);
            if (card) {
                if (isSpeaking) {
                    card.classList.add("speaking");
                } else {
                    card.classList.remove("speaking");
                }
            }
        }
    });
}

// ==========================================
// 2. CONTROLE DE HARDWARE (MICROFONE)
// ==========================================
async function toggleMicrophone() {
    const btnMute = document.getElementById("btn-mute");
    let stream = appState.localStream;

    // Se o usuário ainda não permitiu o microfone, solicita acesso
    if (!stream) {
        try {
            console.log("[AUDIO] Solicitando acesso ao microfone...");
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            appState.setAudioEntity('localStream', stream);
            
            // Inicia o monitoramento de volume para a animação
            startAudioAnalyser(stream);
        } catch (error) {
            console.error("[ERRO AUDIO] Permissão negada ou hardware não encontrado:", error);
            return alert("Não foi possível acessar seu microfone. Verifique as permissões do navegador.");
        }
    }

    // Pega a trilha de áudio física
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    // Alterna o estado de mute do hardware
    audioTrack.enabled = !audioTrack.enabled;
    const isMicOn = audioTrack.enabled;

    // Atualiza a UI do botão local
    if (btnMute) {
        btnMute.innerText = isMicOn ? "Mutar" : "Desmutar";
        btnMute.classList.toggle("muted-state", !isMicOn);
    }

    // Avisa o servidor para que os outros usuários vejam que você mutou/desmutou
    const room = appState.currentRoom;
    if (room) {
        socket.emit("toggle_mic", { roomId: room.id, micOn: isMicOn });
    }
}

// ==========================================
// 3. ANALISADOR DE VOZ (O EFEITO DE BRILHO)
// ==========================================
function startAudioAnalyser(stream) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);

        microphone.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        appState.setAudioEntity('audioContext', audioContext);
        appState.setAudioEntity('audioAnalyser', analyser);

        let isCurrentlySpeaking = false;

        // Loop de verificação de volume a cada 100ms
        const intervalId = setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            
            // Calcula a média do volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const averageVolume = sum / bufferLength;

            // Threshold de sensibilidade (ajuste se necessário)
            const speakingNow = averageVolume > 15; 

            // Se o estado mudou, avisa o servidor para acender/apagar o brilho verde
            if (speakingNow !== isCurrentlySpeaking) {
                isCurrentlySpeaking = speakingNow;
                const room = appState.currentRoom;
                if (room) {
                    socket.emit("is_speaking", { roomId: room.id, isSpeaking: speakingNow });
                }
            }
        }, 100);

        appState.setAudioEntity('micInterval', intervalId);

    } catch (e) {
        console.warn("[AUDIO] API de Web Audio não suportada. Animação de voz desabilitada.", e);
    }
}

// ==========================================
// 4. LIMPEZA DE MEMÓRIA (SAÍDA DA SALA)
// ==========================================
function leaveRoom() {
    const room = appState.currentRoom;
    if (!room) return;

    console.log(`[SALAS] Saindo da sala: ${room.name}`);
    socket.emit("leave_room", { roomId: room.id });

    // 1. Limpa o estado da sala global
    appState.setCurrentRoom(null);

    // 2. Desliga o Hardware (Apaga a luz do microfone do navegador)
    const stream = appState.localStream;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        appState.setAudioEntity('localStream', null);
    }

    // 3. Desliga o Analisador de Áudio e limpa intervalos
    const interval = appState.micInterval;
    if (interval) clearInterval(interval);

    const ctx = appState.audioContext;
    if (ctx && ctx.state !== 'closed') {
        ctx.close();
        appState.setAudioEntity('audioContext', null);
    }

    // 4. Restaura a UI do botão de mute
    const btnMute = document.getElementById("btn-mute");
    if (btnMute) {
        btnMute.innerText = "Ligar Microfone";
        btnMute.classList.remove("muted-state");
    }

    // 5. Volta para o Dashboard
    showScreen("dashboard");
}
