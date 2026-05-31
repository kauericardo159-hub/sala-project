"use strict";

// voice.js - Gerenciamento de Hardware, Microfone e Efeito Visual de Voz — Pro Version

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
    
    // [CORREÇÃO] Nome do evento corrigido para 'room_users_updated' (sincronizado com o servidor)
    socket.off("room_users_updated").on("room_users_updated", (users) => {
        const room = appState.currentRoom;
        if (room) {
            room.users = users; // Atualiza o estado local de usuários da sala
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
                renderVoiceCards(room.users, room.ownerId); // Re-renderiza para mudar o ícone de mute
            }
        }
    });

    // Alguém começou ou parou de falar (Efeito de brilho verde)
    socket.off("user_speaking").on("user_speaking", ({ uid, isSpeaking }) => {
        const room = appState.currentRoom;
        if (room) {
            const user = room.users.find(u => u.uid === uid);
            if (user) user.isSpeaking = isSpeaking;

            // Manipulação direta do DOM por performance (evita re-renderizar o grid inteiro a cada milissegundo)
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
// 2. CONTROLE DE HARDWARE (MICROFONE CORRIGIDO)
// ==========================================
async function toggleMicrophone() {
    const btnMute = document.getElementById("btn-mute");
    let stream = appState.localStream;
    let isInitialSetup = false;

    // Se o usuário ainda não permitiu o microfone, solicita acesso
    if (!stream) {
        try {
            console.log("[AUDIO] Solicitando acesso ao microfone...");
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            appState.setAudioEntity('localStream', stream);
            
            // Inicia o monitoramento de volume para a animação
            startAudioAnalyser(stream);
            isInitialSetup = true; // Sinaliza que a trilha acabou de ser criada ativa
        } catch (error) {
            console.error("[ERRO AUDIO] Permissão negada ou hardware não encontrado:", error);
            return alert("Não foi possível acessar seu microfone. Verifique as permissões do navegador.");
        }
    }

    // Pega a trilha de áudio física
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    // [CORREÇÃO UX] Se acabou de inicializar, deixa ativado. Se já existia, inverte o estado atual.
    if (!isInitialSetup) {
        audioTrack.enabled = !audioTrack.enabled;
    } else {
        audioTrack.enabled = true;
    }
    
    const isMicOn = audioTrack.enabled;

    // Atualiza a UI do botão local
    if (btnMute) {
        btnMute.innerText = isMicOn ? "Mutar" : "Desmutar";
        btnMute.classList.toggle("muted-state", !isMicOn);
    }

    // Avisa o servidor para repassar aos outros integrantes da sala
    const room = appState.currentRoom;
    if (room) {
        socket.emit("toggle_mic", { roomId: String(room.id), micOn: isMicOn });
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
            // Se o usuário mutou o hardware, poupa processamento e força o estado estável de silêncio
            const track = stream.getAudioTracks()[0];
            if (!track || !track.enabled) {
                if (isCurrentlySpeaking) {
                    isCurrentlySpeaking = false;
                    const room = appState.currentRoom;
                    if (room) socket.emit("is_speaking", { roomId: String(room.id), isSpeaking: false });
                }
                return;
            }

            analyser.getByteFrequencyData(dataArray);
            
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const averageVolume = sum / bufferLength;

            // Sensibilidade do corte (valores acima de 15 indicam captação ativa de voz)
            const speakingNow = averageVolume > 15; 

            // Se o estado mudou (começou ou parou de falar), dispara o evento para o servidor
            if (speakingNow !== isCurrentlySpeaking) {
                isCurrentlySpeaking = speakingNow;
                const room = appState.currentRoom;
                if (room) {
                    socket.emit("is_speaking", { roomId: String(room.id), isSpeaking: speakingNow });
                }
            }
        }, 100);

        appState.setAudioEntity('micInterval', intervalId);

    } catch (e) {
        console.warn("[AUDIO] API de Web Audio não suportada ou bloqueada. Animação desabilitada.", e);
    }
}

// ==========================================
// 4. LIMPEZA DE MEMÓRIA (SAÍDA DA SALA)
// ==========================================
function leaveRoom() {
    const room = appState.currentRoom;
    if (!room) return;

    console.log(`[SALAS] Saindo da sala: ${room.name}`);
    socket.emit("leave_room", { roomId: String(room.id) });

    // 1. Limpa o estado da sala global
    appState.setCurrentRoom(null);

    // 2. Desliga o Hardware (Apaga de verdade a luz/ícone de gravação do navegador)
    const stream = appState.localStream;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        appState.setAudioEntity('localStream', null);
    }

    // 3. Desliga o Analisador de Áudio e limpa intervalos de CPU
    const interval = appState.micInterval;
    if (interval) clearInterval(interval);

    const ctx = appState.audioContext;
    if (ctx && ctx.state !== 'closed') {
        ctx.close();
        appState.setAudioEntity('audioContext', null);
    }

    // 4. Restaura a UI original do botão de mute
    const btnMute = document.getElementById("btn-mute");
    if (btnMute) {
        btnMute.innerText = "Ligar Microfone";
        btnMute.classList.remove("muted-state");
    }

    // 5. Redireciona visualmente de volta para o Dashboard
    showScreen("dashboard");
}
