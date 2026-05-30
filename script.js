// Conexão com o servidor back-end hospedado no Render
const socket = io("https://sala-project.onrender.com");

// ==========================================
// ESTADO GLOBAL DO APLICATIVO
// ==========================================
let currentUser = null;
let currentRoom = null;
let localStream = null;
let audioContext = null;
let audioAnalyser = null;
let micInterval = null;

// Elementos das Telas Principais
const screenLogin = document.getElementById("screen-login");
const screenHome = document.getElementById("screen-home");
const screenRoom = document.getElementById("screen-room");

// ==========================================
// 1. EVENTO INICIAL (PERSISTÊNCIA DE SESSÃO)
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem("sala_project_user");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        initHome();
    } else {
        showScreen("login");
    }
});

// ==========================================
// 2. SISTEMA DE AUTENTICAÇÃO (ENTRAR vs REGISTRAR)
// ==========================================
function loginOrCreateAccount(mode) {
    const userTagInput = document.getElementById("login-username").value.trim();
    const passwordInput = document.getElementById("login-password").value;
    const displayNameInput = document.getElementById("login-displayname").value.trim();

    if (!userTagInput || !passwordInput) {
        return alert("Por favor, preencha o username e a senha!");
    }

    // Regra rígida de tag/username estilo Discord/X
    if (/[A-Z]/.test(userTagInput) || /\s/.test(userTagInput)) {
        return alert("O @username não pode conter letras maiúsculas ou espaços!");
    }

    const userTagFormatted = `@${userTagInput}`;

    if (mode === 'register') {
        // Fluxo de Criação de Conta
        if (!displayNameInput) {
            return alert("Para registrar uma nova conta, preencha o Nome de Exibição!");
        }

        currentUser = {
            uid: userTagFormatted,
            name: displayNameInput,
            avatar: "user-photo.jpg",
            password: passwordInput // Armazenamento simples local na versão Alfa
        };

        localStorage.setItem(`account_${userTagFormatted}`, JSON.stringify(currentUser));
        localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
        alert("Conta criada com sucesso!");
        initHome();

    } else {
        // Fluxo de Login (Apenas Entrar)
        const localAccount = localStorage.getItem(`account_${userTagFormatted}`);
        
        if (!localAccount) {
            return alert("Esta conta não foi encontrada! Mude para a aba 'Criar Conta' se for seu primeiro acesso.");
        }

        const parsedAccount = JSON.parse(localAccount);

        if (parsedAccount.password !== passwordInput) {
            return alert("Senha incorreta para este usuário!");
        }

        currentUser = parsedAccount;
        localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
        initHome();
    }
}

function logout() {
    localStorage.removeItem("sala_project_user");
    currentUser = null;
    location.reload();
}

// ==========================================
// 3. HOME & GERENCIAMENTO DE PERFIL NA SIDEBAR
// ==========================================
function initHome() {
    showScreen("home");
    
    // Atualiza as informações do painel lateral esquerdo
    document.getElementById("user-uid").innerText = currentUser.uid;
    document.getElementById("sidebar-display-name").innerText = currentUser.name;
    document.getElementById("profile-display-name").value = currentUser.name;
    document.getElementById("avatar-preview").src = currentUser.avatar;

    // Solicita a lista de salas para o servidor
    socket.emit("request_room_list");
}

function updateDisplayName() {
    const newName = document.getElementById("profile-display-name").value.trim();
    if (!newName) return alert("O nome não pode ser vazio.");
    
    currentUser.name = newName;
    
    // Atualiza os storages locais (sessão atual e banco da conta)
    localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
    localStorage.setItem(`account_${currentUser.uid}`, JSON.stringify(currentUser));
    
    document.getElementById("sidebar-display-name").innerText = newName;
    alert("Nome atualizado!");

    // Se o usuário estiver dentro de uma sala ativa, atualiza os outros membros na hora
    if (currentRoom) {
        socket.emit("update_user_profile", { roomId: currentRoom.id, user: currentUser });
    }
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentUser.avatar = e.target.result;
            document.getElementById("avatar-preview").src = currentUser.avatar;
            
            localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
            localStorage.setItem(`account_${currentUser.uid}`, JSON.stringify(currentUser));
            
            if (currentRoom) {
                socket.emit("update_user_profile", { roomId: currentRoom.id, user: currentUser });
            }
        };
        reader.readAsDataURL(file);
    }
}

// ==========================================
// 4. CRIAÇÃO E ENTRADA EM SALAS DE VOZ
// ==========================================
function createRoomData() {
    const roomName = document.getElementById("room-name-input").value.trim();
    const roomType = document.getElementById("room-type-select").value;
    const roomPassword = document.getElementById("room-password-input").value;
    const roomLimit = document.getElementById("room-limit-input").value;

    if (!roomName) return alert("A sala precisa de um nome!");
    if (roomType === "private" && !roomPassword) return alert("Defina uma senha para a sala privada.");

    const roomPayload = {
        id: "room_" + Math.random().toString(36).substr(2, 9),
        name: roomName,
        type: roomType,
        password: roomPassword,
        limit: parseInt(roomLimit) || 8,
        ownerId: currentUser.uid,
        users: []
    };

    socket.emit("create_room", roomPayload);
}

// Recebe e renderiza a lista de salas disponíveis no Feed Central
socket.on("update_room_list", (rooms) => {
    const listContainer = document.getElementById("rooms-live-list");
    listContainer.innerHTML = rooms.length === 0 ? 
        `<div class="no-rooms-notice">Nenhuma sala ativa no momento. Seja o primeiro a criar uma!</div>` : "";

    rooms.forEach(room => {
        const roomCard = document.createElement("div");
        roomCard.className = "room-card";
        roomCard.innerHTML = `
            <div class="room-card-info">
                <strong class="room-card-title">${room.name}</strong>
                <span class="room-badge ${room.type}">${room.type === 'private' ? '🔒 Privada' : '🔓 Pública'}</span>
                <div class="room-count">Membros: <b>${room.users.length}/${room.limit}</b></div>
            </div>
            <button class="btn-primary" onclick="tryJoinRoom('${room.id}', '${room.type}')">Entrar na Sala</button>
        `;
        listContainer.appendChild(roomCard);
    });
});

function tryJoinRoom(roomId, type) {
    let password = "";
    if (type === "private") {
        password = prompt("Esta sala é privada. Digite a senha para entrar:");
        if (password === null) return; // Cancela ação se o usuário clicar em cancelar
    }
    socket.emit("join_room", { roomId, password, user: currentUser });
}

// ==========================================
// 5. GERENCIAMENTO DE ÁUDIO E DETECÇÃO DE VOZ (INDICADOR VERDE)
// ==========================================
socket.on("room_joined_success", async (room) => {
    currentRoom = room;
    showScreen("room");
    document.getElementById("room-title").innerText = room.name;
    
    // Mostra controles de gerência apenas se o usuário for o criador (Dono)
    document.getElementById("owner-controls").style.display = room.ownerId === currentUser.uid ? "block" : "none";

    await startLocalAudio();
    renderVoiceCards(room.users);
});

async function startLocalAudio() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        currentUser.micOn = true;
        
        updateMicButtonUI(true);
        socket.emit("update_mic_status", { roomId: currentRoom.id, micOn: true });
        setupVoiceAnalyser();
    } catch (err) {
        console.warn("Microfone inacessível.", err);
        alert("Você entrou como Ouvinte (Sem microfone detectado ou permissão negada).");
        currentUser.micOn = false;
        updateMicButtonUI(false);
    }
}

function setupVoiceAnalyser() {
    if (!localStream) return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(localStream);
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 256; 
    source.connect(audioAnalyser);

    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    
    micInterval = setInterval(() => {
        if (!currentUser.micOn) return;
        
        audioAnalyser.getByteFrequencyData(dataArray);
        let total = 0;
        for (let i = 0; i < dataArray.length; i++) { total += dataArray[i]; }
        const volumeMecanico = total / dataArray.length;

        // Sensibilidade de captação de voz (Threshold)
        const isSpeaking = volumeMecanico > 10; 
        
        if (isSpeaking !== currentUser.isSpeaking) {
            currentUser.isSpeaking = isSpeaking;
            socket.emit("update_speaking_status", { roomId: currentRoom.id, isSpeaking });
            toggleCardSpeakingUI(currentUser.uid, isSpeaking);
        }
    }, 120);
}

function toggleMicrophone() {
    if (!localStream) {
        startLocalAudio();
        return;
    }
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    currentUser.micOn = audioTrack.enabled;

    socket.emit("update_mic_status", { roomId: currentRoom.id, micOn: audioTrack.enabled });
    updateMicButtonUI(audioTrack.enabled);

    if (!audioTrack.enabled) {
        currentUser.isSpeaking = false;
        socket.emit("update_speaking_status", { roomId: currentRoom.id, isSpeaking: false });
        toggleCardSpeakingUI(currentUser.uid, false);
    }
}

function updateMicButtonUI(isActive) {
    const btn = document.getElementById("btn-mic");
    if (isActive) {
        btn.className = "btn-success status-dock-btn";
        btn.innerText = "🎙️ Microfone Ativo";
    } else {
        btn.className = "btn-danger status-dock-btn";
        btn.innerText = "🔇 Mutado";
    }
}

function toggleCardSpeakingUI(uid, isSpeaking) {
    const targetCard = document.querySelector(`[data-uid="${uid}"]`);
    if (targetCard) {
        if (isSpeaking) targetCard.classList.add("speaking");
        else targetCard.classList.remove("speaking");
    }
}

// ==========================================
// 6. INTERFACE DENTRO DA SALA (CARDS E EXCLUSÕES)
// ==========================================
function renderVoiceCards(users) {
    const cardContainer = document.getElementById("voice-cards-container");
    cardContainer.innerHTML = "";

    users.forEach(user => {
        const isOwner = user.uid === currentRoom.ownerId;
        const card = document.createElement("div");
        card.className = `voice-card ${user.isSpeaking ? "speaking" : ""}`;
        card.setAttribute("data-uid", user.uid);
        
        card.innerHTML = `
            <div class="avatar-wrapper" style="width: 70px; height: 70px;">
                <img src="${user.avatar}" alt="Avatar" class="voice-avatar">
                <div class="mic-indicator-dot ${user.micOn ? 'on' : 'off'}"></div>
            </div>
            <div class="voice-info">
                <span class="voice-name">${user.name}</span>
                <span class="voice-user-tag">${user.uid}</span>
            </div>
            <div class="voice-roles">
                ${isOwner ? '<span class="badge-role owner">👑 Dono</span>' : '<span class="badge-role">Membro</span>'}
            </div>
            ${currentRoom.ownerId === currentUser.uid && user.uid !== currentUser.uid ? 
                `<button onclick="kickUser('${user.uid}')" class="btn-kick-action">Expulsar</button>` : ''}
        `;
        cardContainer.appendChild(card);
    });
}

function kickUser(targetUid) {
    if (confirm(`Tem certeza que deseja expulsar ${targetUid} da sala?`)) {
        socket.emit("kick_user_request", { roomId: currentRoom.id, targetUid });
    }
}

function leaveRoom() {
    if (currentRoom) {
        clearInterval(micInterval);
        if (audioContext) audioContext.close();
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        socket.emit("leave_room", { roomId: currentRoom.id, uid: currentUser.uid });
        currentRoom = null;
        initHome();
    }
}

function deleteRoomByOwner() {
    if (confirm("Você vai fechar a sala para todos os membros permanentemente. Continuar?")) {
        socket.emit("delete_room", { roomId: currentRoom.id });
    }
}

// ==========================================
// 7. CHAT INTEGRADO DA SALA (MENSAGENS)
// ==========================================
function sendTextMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    const messageData = {
        roomId: currentRoom.id,
        user: { name: currentUser.name, uid: currentUser.uid, avatar: currentUser.avatar },
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit("send_chat_message", messageData);
    appendMessage(messageData, "my-message");
    input.value = "";
}

socket.on("receive_chat_message", (data) => {
    appendMessage(data, "other-message");
});

socket.on("room_notification", (notif) => {
    appendMessage({ text: notif.text, system: true }, "system-message");
});

socket.on("room_users_updated", (updatedUsers) => {
    if (currentRoom) {
        currentRoom.users = updatedUsers;
        renderVoiceCards(updatedUsers);
    }
});

socket.on("room_kicked", () => {
    alert("Você foi expulso da sala pelo proprietário.");
    currentRoom = null;
    initHome();
});

socket.on("room_deleted_by_owner", () => {
    alert("A sala ativa foi fechada pelo proprietário.");
    currentRoom = null;
    initHome();
});

socket.on("room_error", (msg) => alert(msg));

function appendMessage(data, typeClass) {
    const chatArea = document.getElementById("chat-area");
    const msgElement = document.createElement("div");
    msgElement.className = `message-item ${typeClass}`;

    if (data.system) {
        msgElement.innerHTML = `<div class="sys-msg-inside"><i>${data.text}</i></div>`;
    } else {
        msgElement.innerHTML = `
            <img src="${data.user.avatar}" class="chat-avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="chat-name">${data.user.name}</span>
                    <span class="chat-tag">${data.user.uid}</span>
                    <span class="chat-time">${data.time}</span>
                </div>
                <p class="chat-text">${data.text}</p>
            </div>
        `;
    }
    chatArea.appendChild(msgElement);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// Auxiliar para navegação entre telas nativas
function showScreen(screen) {
    screenLogin.style.display = screen === "login" ? "flex" : "none";
    screenHome.style.display = screen === "home" ? "grid" : "none";
    screenRoom.style.display = screen === "room" ? "grid" : "none";
}
