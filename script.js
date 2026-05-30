// script.js - Arquitetura de Comunicação Real-Time (Alpha Version)
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
let currentAuthMode = "login"; // 'login' ou 'register'

// ==========================================
// 1. INICIALIZAÇÃO DE GATILHOS E COMPORTAMENTOS (DOM)
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    // Apresenta a interface inicial blindada contra telas escuras
    showScreen("login");

    // Acoplamento estrito de eventos nos elementos estruturais do HTML
    setupCoreEventListeners();

    // Verificação de persistência local assistida pelo servidor
    const savedUser = localStorage.getItem("sala_project_user");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // Sincroniza credenciais salvas no banco centralizado
            socket.emit("submit_login", { 
                username: currentUser.uid.split('#')[0], 
                password: currentUser.password_backup 
            });
        } catch (e) {
            localStorage.removeItem("sala_project_user");
            showScreen("login");
        }
    }
});

function setupCoreEventListeners() {
    // Abas de Autenticação
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const btnAuthSubmit = document.getElementById("btn-auth-submit");

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener("click", () => {
            currentAuthMode = "login";
            tabLogin.classList.add("active");
            tabRegister.classList.remove("active");
            toggleAuthFields();
        });

        tabRegister.addEventListener("click", () => {
            currentAuthMode = "register";
            tabRegister.classList.add("active");
            tabLogin.classList.remove("active");
            toggleAuthFields();
        });
    }

    if (btnAuthSubmit) {
        btnAuthSubmit.addEventListener("click", loginOrCreateAccount);
    }

    // Configurações e Gerenciamento de Perfil na Sidebar
    const avatarInput = document.getElementById("avatar-input");
    if (avatarInput) {
        avatarInput.addEventListener("change", handleAvatarUpload);
    }

    const btnSaveProfileName = document.getElementById("btn-save-profile-name");
    if (btnSaveProfileName) {
        btnSaveProfileName.addEventListener("click", updateDisplayName);
    }

    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", logout);
    }

    // Criação e Privacidade de Salas
    const roomTypeSelect = document.getElementById("room-type-select");
    if (roomTypeSelect) {
        roomTypeSelect.addEventListener("change", (e) => {
            const container = document.getElementById("room-password-container");
            if (container) container.style.display = e.target.value === "private" ? "block" : "none";
        });
    }

    const btnCreateRoomSubmit = document.getElementById("btn-create-room-submit");
    if (btnCreateRoomSubmit) {
        btnCreateRoomSubmit.addEventListener("click", createRoomData);
    }

    // Controles Internos da Sala (Voz / Moderação / Saída)
    const btnDeleteRoom = document.getElementById("btn-delete-room");
    if (btnDeleteRoom) {
        btnDeleteRoom.addEventListener("click", deleteRoomByOwner);
    }

    document.querySelectorAll(".room-leave-trigger").forEach(trigger => {
        trigger.addEventListener("click", leaveRoom);
    });

    const btnMic = document.getElementById("btn-mic");
    if (btnMic) {
        btnMic.addEventListener("click", toggleMicrophone);
    }

    // Chat Integrado (Envio e Captura por Teclado)
    const btnChatSend = document.getElementById("btn-chat-send");
    if (btnChatSend) {
        btnChatSend.addEventListener("click", sendTextMessage);
    }

    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendTextMessage();
        });
    }
}

function toggleAuthFields() {
    const groupDisplayName = document.getElementById("group-displayname");
    const btnAuthSubmit = document.getElementById("btn-auth-submit");
    const authSubtitle = document.getElementById("auth-subtitle");

    if (currentAuthMode === "login") {
        if (groupDisplayName) groupDisplayName.style.display = "none";
        if (btnAuthSubmit) btnAuthSubmit.innerText = "Entrar com Segurança";
        if (authSubtitle) authSubtitle.innerText = "De volta ao ecossistema? Faça seu login.";
    } else {
        if (groupDisplayName) groupDisplayName.style.display = "block";
        if (btnAuthSubmit) btnAuthSubmit.innerText = "Criar Nova Conta";
        if (authSubtitle) authSubtitle.innerText = "Crie uma credencial única e defina seu perfil.";
    }
}

// ==========================================
// 2. LÓGICA CENTRAL DE AUTENTICAÇÃO E PERSISTÊNCIA
// ==========================================
function loginOrCreateAccount() {
    const userTagInput = document.getElementById("login-username").value.trim();
    const passwordInput = document.getElementById("login-password").value;
    const displayNameInput = document.getElementById("login-displayname") ? document.getElementById("login-displayname").value.trim() : "";

    if (!userTagInput || !passwordInput) {
        return alert("Por favor, preencha o username e a senha!");
    }

    if (/[A-Z]/.test(userTagInput) || /\s/.test(userTagInput)) {
        return alert("O @username não pode conter letras maiúsculas ou espaços!");
    }

    if (currentAuthMode === 'register') {
        if (!displayNameInput) return alert("Por favor, informe seu Nome de Exibição!");
        socket.emit("submit_register", { username: userTagInput, displayName: displayNameInput, password: passwordInput });
    } else {
        socket.emit("submit_login", { username: userTagInput, password: passwordInput });
    }
    
    currentUser = { password_backup: passwordInput };
}

socket.on("auth_response", (response) => {
    if (response.success) {
        const passwordToken = currentUser ? currentUser.password_backup : "";
        currentUser = response.user;
        currentUser.password_backup = passwordToken;
        
        localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
        initHome();
    } else {
        alert(response.message);
        showScreen("login");
    }
});

function logout() {
    localStorage.removeItem("sala_project_user");
    currentUser = null;
    location.reload();
}

// ==========================================
// 3. AMBIENTE DASHBOARD (HOME E INTEGRALIZAÇÃO DE PERFIL)
// ==========================================
function initHome() {
    showScreen("home");
    
    if (document.getElementById("user-uid")) document.getElementById("user-uid").innerText = currentUser.uid;
    if (document.getElementById("sidebar-display-name")) document.getElementById("sidebar-display-name").innerText = currentUser.name;
    if (document.getElementById("profile-display-name")) document.getElementById("profile-display-name").value = currentUser.name;
    if (document.getElementById("avatar-preview")) document.getElementById("avatar-preview").src = currentUser.avatar || "user-photo.jpg";

    socket.emit("request_room_list");
}

function updateDisplayName() {
    const newName = document.getElementById("profile-display-name").value.trim();
    if (!newName) return alert("O nome não pode ser vazio.");
    
    currentUser.name = newName;
    localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
    if (document.getElementById("sidebar-display-name")) document.getElementById("sidebar-display-name").innerText = newName;
    alert("Nome de exibição atualizado!");

    if (currentRoom) {
        socket.emit("update_user_profile", { roomId: currentRoom.id, user: currentUser });
    }
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Avatar = e.target.result;
            
            // Gravação local imediata para renderização fluida
            currentUser.avatar = base64Avatar;
            if (document.getElementById("avatar-preview")) document.getElementById("avatar-preview").src = base64Avatar;
            localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
            
            // Sincronização direta com a base de dados do servidor (Evita perdas na atualização)
            socket.emit("update_user_profile", { roomId: currentRoom ? currentRoom.id : null, user: currentUser });
        };
        reader.readAsDataURL(file);
    }
}

// ==========================================
// 4. EMISSÃO E ALIMENTAÇÃO DO FEED DE SALAS
// ==========================================
function createRoomData() {
    const roomName = document.getElementById("room-name-input").value.trim();
    const roomType = document.getElementById("room-type-select").value;
    const roomPassword = document.getElementById("room-password-input") ? document.getElementById("room-password-input").value : "";
    const roomLimit = document.getElementById("room-limit-input") ? document.getElementById("room-limit-input").value : 8;

    if (!roomName) return alert("A sala precisa de um nome válido!");
    if (roomType === "private" && !roomPassword) return alert("Defina uma senha de acesso!");

    const roomPayload = {
        id: "room_" + Math.random().toString(36).substr(2, 9),
        name: roomName,
        type: roomType,
        password: roomPassword,
        limit: parseInt(roomLimit) || 8,
        ownerId: currentUser.uid,
        creatorInfo: currentUser,
        users: []
    };

    socket.emit("create_room", roomPayload);
}

socket.on("update_room_list", (rooms) => {
    const listContainer = document.getElementById("rooms-live-list");
    if (!listContainer) return;

    listContainer.innerHTML = rooms.length === 0 ? 
        `<div class="no-rooms-notice">Nenhuma sala ativa no momento. Crie uma nova acima!</div>` : "";

    rooms.forEach(room => {
        const roomCard = document.createElement("div");
        roomCard.className = "room-card";
        roomCard.innerHTML = `
            <div class="room-card-info">
                <strong class="room-card-title">${room.name}</strong>
                <span class="room-badge ${room.type}">${room.type === 'private' ? '🔒 Privada' : '🔓 Pública'}</span>
                <div class="room-count">Membros: <b>${room.users.length}/${room.limit}</b></div>
            </div>
            <button class="btn-primary join-room-trigger" data-id="${room.id}" data-type="${room.type}">Entrar na Sala</button>
        `;
        listContainer.appendChild(roomCard);
    });

    // Vincula eventos dinamicamente nos botões gerados pelo feed de salas
    document.querySelectorAll(".join-room-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const roomId = e.target.getAttribute("data-id");
            const roomType = e.target.getAttribute("data-type");
            tryJoinRoom(roomId, roomType);
        });
    });
});

function tryJoinRoom(roomId, type) {
    let password = "";
    if (type === "private") {
        password = prompt("Digite a senha secreta desta sala:");
        if (password === null) return;
    }
    socket.emit("join_room", { roomId, password, user: currentUser });
}

// ==========================================
// 5. INFRAESTRUTURA DE ÁUDIO EM TEMPO REAL
// ==========================================
socket.on("room_joined_success", async (room) => {
    currentRoom = room;
    showScreen("room");
    if (document.getElementById("room-title")) document.getElementById("room-title").innerText = room.name;
    if (document.getElementById("owner-controls")) document.getElementById("owner-controls").style.display = room.ownerId === currentUser.uid ? "block" : "none";

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
        console.warn("Microfone inacessível ou negado.", err);
        currentUser.micOn = false;
        updateMicButtonUI(false);
    }
}

function setupVoiceAnalyser() {
    if (!localStream) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(localStream);
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 256; 
        source.connect(audioAnalyser);

        const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
        
        micInterval = setInterval(() => {
            if (!currentUser.micOn || !audioAnalyser) return;
            
            audioAnalyser.getByteFrequencyData(dataArray);
            let total = 0;
            for (let i = 0; i < dataArray.length; i++) { total += dataArray[i]; }
            const volume = total / dataArray.length;

            const isSpeaking = volume > 10;
            
            if (isSpeaking !== currentUser.isSpeaking) {
                currentUser.isSpeaking = isSpeaking;
                socket.emit("update_speaking_status", { roomId: currentRoom.id, isSpeaking });
                toggleCardSpeakingUI(currentUser.uid, isSpeaking);
            }
        }, 120);
    } catch (e) {
        console.error("Análise de áudio indisponível", e);
    }
}

function toggleMicrophone() {
    if (!localStream) return startLocalAudio();
    
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
    if (!btn) return;
    btn.className = isActive ? "btn-success status-dock-btn" : "btn-danger status-dock-btn";
    btn.innerText = isActive ? "🎙️ Microfone Ativo" : "🔇 Mutado";
}

function toggleCardSpeakingUI(uid, isSpeaking) {
    const targetCard = document.querySelector(`[data-uid="${uid}"]`);
    if (targetCard) {
        if (isSpeaking) targetCard.classList.add("speaking");
        else targetCard.classList.remove("speaking");
    }
}

// ==========================================
// 6. RENDERIZAÇÃO E MODERAÇÃO DA GRID DE PARTICIPANTES
// ==========================================
function renderVoiceCards(users) {
    const cardContainer = document.getElementById("voice-cards-container");
    if (!cardContainer) return;
    cardContainer.innerHTML = "";

    users.forEach(user => {
        const isOwner = user.uid === currentRoom.ownerId;
        const card = document.createElement("div");
        card.className = `voice-card ${user.isSpeaking ? "speaking" : ""}`;
        card.setAttribute("data-uid", user.uid);
        
        card.innerHTML = `
            <div class="avatar-wrapper" style="width: 70px; height: 70px; position: relative;">
                <img src="${user.avatar || 'user-photo.jpg'}" alt="Avatar" class="voice-avatar">
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
                `<button class="btn-kick-action kick-user-trigger" data-uid="${user.uid}">Expulsar</button>` : ''}
        `;
        cardContainer.appendChild(card);
    });

    // Escutador dinâmico mapeado para moderação de expulsão
    document.querySelectorAll(".kick-user-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetUid = e.target.getAttribute("data-uid");
            kickUser(targetUid);
        });
    });
}

function kickUser(targetUid) {
    if (confirm(`Expulsar usuário ${targetUid} da chamada?`)) {
        socket.emit("kick_user_request", { roomId: currentRoom.id, targetUid });
    }
}

function leaveRoom() {
    if (currentRoom) {
        clearInterval(micInterval);
        if (audioContext) audioContext.close().catch(()=>{});
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
    if (confirm("Deseja fechar permanentemente a sala e desconectar todos os membros?")) {
        socket.emit("delete_room", { roomId: currentRoom.id });
    }
}

// ==========================================
// 7. CHAT TEXTUAL INTEGRADO EM TEMPO REAL
// ==========================================
function sendTextMessage() {
    const input = document.getElementById("chat-input");
    if (!input) return;
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

socket.on("receive_chat_message", (data) => appendMessage(data, "other-message"));
socket.on("room_notification", (notif) => appendMessage({ text: notif.text, system: true }, "system-message"));

socket.on("room_users_updated", (updatedUsers) => {
    if (currentRoom) {
        currentRoom.users = updatedUsers;
        renderVoiceCards(updatedUsers);
    }
});

socket.on("room_kicked", () => {
    alert("Você foi expulso desta sala.");
    currentRoom = null;
    initHome();
});

socket.on("room_deleted_by_owner", () => {
    alert("Esta sala foi finalizada pelo proprietário.");
    currentRoom = null;
    initHome();
});

socket.on("room_error", (msg) => alert(msg));

function appendMessage(data, typeClass) {
    const chatArea = document.getElementById("chat-area");
    if (!chatArea) return;
    
    const msgElement = document.createElement("div");
    msgElement.className = `message-item ${typeClass}`;

    if (data.system) {
        msgElement.innerHTML = `<div class="sys-msg-inside"><i>${data.text}</i></div>`;
    } else {
        msgElement.innerHTML = `
            <img src="${data.user.avatar || 'user-photo.jpg'}" class="chat-avatar">
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

// ==========================================
// CONTROLADOR DE EXIBIÇÃO DE INTERFACES (DOM BLINDADO)
// ==========================================
function showScreen(screen) {
    const sLogin = document.getElementById("screen-login");
    const sHome = document.getElementById("screen-home");
    const sRoom = document.getElementById("screen-room");

    if (sLogin) sLogin.style.display = screen === "login" ? "flex" : "none";
    if (sHome) sHome.style.display = screen === "home" ? "grid" : "none";
    if (sRoom) sRoom.style.display = screen === "room" ? "grid" : "none";
}
