// Conexão com o servidor back-end do Render
const socket = io("https://sala-project.onrender.com");

// --- ESTADO GLOBAL DO APP ---
let currentUser = null;
let currentRoom = null;
let localStream = null; // Para o microfone futuramente

// --- ELEMENTOS DO DOM (Telas principais) ---
const screenLogin = document.getElementById("screen-login");
const screenHome = document.getElementById("screen-home");
const screenRoom = document.getElementById("screen-room");

// ==========================================
// 1. TELA DE LOGIN / CADASTRO (Estilo Discord)
// ==========================================

// Verifica se já existe uma conta salva no navegador ao carregar a página
window.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem("sala_project_user");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        initHome();
    } else {
        showScreen("login");
    }
});

// Função para Criar ou Entrar em uma conta
function loginOrCreateAccount(username) {
    if (!username.trim()) return alert("Digite um nome de usuário válido!");

    // Gera um UID único simulado (ex: Kauem#4829)
    const uniqueId = Math.floor(1000 + Math.random() * 9000);
    
    currentUser = {
        uid: `${username}#${uniqueId}`,
        name: username,
        avatar: "user-photo.jpg" // Foto padrão inicial
    };

    // Salva permanentemente no navegador
    localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
    initHome();
}

// ==========================================
// 2. TELA HOME & GERENCIAMENTO DE AVATAR
// ==========================================

function initHome() {
    showScreen("home");
    
    // Atualiza dados do perfil na tela
    document.getElementById("user-uid").innerText = currentUser.uid;
    const avatarImg = document.getElementById("avatar-preview");
    avatarImg.src = currentUser.avatar;

    // Escuta atualizações de salas vindo do servidor
    socket.emit("request_room_list");
}

// Alterar foto de perfil usando arquivos do dispositivo
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentUser.avatar = e.target.result; // Converte a imagem para Base64
            document.getElementById("avatar-preview").src = currentUser.avatar;
            
            // Atualiza o save local
            localStorage.setItem("sala_project_user", JSON.stringify(currentUser));
        };
        reader.readAsDataURL(file);
    }
}

// ==========================================
// 3. CRIAÇÃO E LISTAGEM DE SALAS
// ==========================================

function createRoomData() {
    const roomName = document.getElementById("room-name-input").value;
    const roomType = document.getElementById("room-type-select").value; // "public" ou "private"
    const roomPassword = document.getElementById("room-password-input").value;
    const roomLimit = document.getElementById("room-limit-input").value;

    if (!roomName.trim()) return alert("Dê um nome para a sua sala!");
    if (roomType === "private" && !roomPassword) return alert("Salas privadas precisam de senha!");

    const roomPayload = {
        id: "room_" + Math.random().toString(36).substr(2, 9),
        name: roomName,
        type: roomType,
        password: roomPassword,
        limit: parseInt(roomLimit) || 10,
        ownerId: currentUser.uid,
        users: [] // Lista de participantes conectados
    };

    // Envia o comando de criação para o servidor back-end
    socket.emit("create_room", roomPayload);
}

// Atualiza a lista de salas [Ao Vivo] na interface
socket.on("update_room_list", (rooms) => {
    const listContainer = document.getElementById("rooms-live-list");
    listContainer.innerHTML = ""; // Limpa a lista antiga

    rooms.forEach(room => {
        const roomCard = document.createElement("div");
        roomCard.className = "room-card";
        roomCard.innerHTML = `
            <div>
                <strong>${room.name}</strong> 
                <span>(${room.type === 'private' ? '🔒 Privada' : '🔓 Pública'})</span>
            </div>
            <div>Usuários: ${room.users.length}/${room.limit}</div>
            <button onclick="tryJoinRoom('${room.id}', '${room.type}')">Entrar</button>
        `;
        listContainer.appendChild(roomCard);
    });
});

function tryJoinRoom(roomId, type) {
    let password = "";
    if (type === "private") {
        password = prompt("Esta sala é privada. Digite a senha:");
        if (!password) return;
    }
    
    // Solicita ao servidor para entrar na sala
    socket.emit("join_room", { roomId, password, user: currentUser });
}

// ==========================================
// 4. DENTRO DA SALA (Voz, Cards de Status e Chat)
// ==========================================

socket.on("room_joined_success", (room) => {
    currentRoom = room;
    showScreen("room");
    document.getElementById("room-title").innerText = room.name;
    
    // Se o usuário atual for o criador, mostra opções de Owner
    if (room.ownerId === currentUser.uid) {
        document.getElementById("owner-controls").style.display = "block";
    } else {
        document.getElementById("owner-controls").style.display = "none";
    }

    renderVoiceCards(room.users);
});

socket.on("room_error", (message) => {
    alert(message);
});

// Renderiza os Cards de quem está na chamada (Estilo Discord/Project Z)
function renderVoiceCards(users) {
    const cardContainer = document.getElementById("voice-cards-container");
    cardContainer.innerHTML = "";

    users.forEach(user => {
        const isOwner = user.uid === currentRoom.ownerId;
        const card = document.createElement("div");
        card.className = `voice-card ${user.isSpeaking ? "speaking" : ""}`;
        
        card.innerHTML = `
            <img src="${user.avatar}" alt="Avatar" class="voice-avatar">
            <div class="voice-info">
                <span class="voice-name">${user.name}</span>
                <span class="voice-badge">${isOwner ? "👑 Owner" : "Membro"}</span>
            </div>
            <div class="voice-status">
                ${user.micOn ? "🎙️ Ligado" : "🔇 Mutado"}
            </div>
            ${currentRoom.ownerId === currentUser.uid && user.uid !== currentUser.uid ? 
                `<button onclick="kickUser('${user.uid}')" class="btn-kick">Expulsar</button>` : ''}
        `;
        cardContainer.appendChild(card);
    });
}

// Ações dos Botões de Controle de Call
function toggleMicrophone() {
    if (!localStream) {
        // Pede permissão para usar o microfone do dispositivo
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                localStream = stream;
                currentUser.micOn = true;
                socket.emit("update_mic_status", { roomId: currentRoom.id, micOn: true });
                document.getElementById("btn-mic").innerText = "Mutar Microfone";
            }).catch(err => alert("Não foi possível acessar o microfone."));
    } else {
        // Desliga/Luta o microfone
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        currentUser.micOn = audioTrack.enabled;
        socket.emit("update_mic_status", { roomId: currentRoom.id, micOn: audioTrack.enabled });
        document.getElementById("btn-mic").innerText = audioTrack.enabled ? "Mutar Microfone" : "Ativar Microfone";
    }
}

function leaveRoom() {
    if (currentRoom) {
        socket.emit("leave_room", { roomId: currentRoom.id, uid: currentUser.uid });
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        currentRoom = null;
        initHome();
    }
}

function deleteRoomByOwner() {
    if (confirm("Você tem certeza que deseja excluir esta sala permanentemente?")) {
        socket.emit("delete_room", { roomId: currentRoom.id });
    }
}

// --- CHAT DE TEXTO ---
function sendTextMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value;
    if (!text.trim()) return;

    const messageData = {
        roomId: currentRoom.id,
        user: currentUser,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit("send_chat_message", messageData);
    appendMessage(messageData, "my-message");
    input.value = "";
}

// Escuta novas mensagens de texto e notificações do sistema (entrou/saiu/banido)
socket.on("receive_chat_message", (data) => {
    appendMessage(data, "other-message");
});

socket.on("room_notification", (notif) => {
    // notif.text ex: "Kauem entrou na sala", "Felipe foi expulso pelo dono"
    appendMessage({ text: notif.text, system: true }, "system-message");
});

// Atualiza a tela se as pessoas mudarem o status de voz ou entrarem/saírem da sala ativa
socket.on("room_users_updated", (updatedUsers) => {
    if (currentRoom) {
        currentRoom.users = updatedUsers;
        renderVoiceCards(updatedUsers);
    }
});

socket.on("room_kicked", () => {
    alert("Você foi expulso desta sala pelo proprietário.");
    currentRoom = null;
    initHome();
});

socket.on("room_deleted_by_owner", () => {
    alert("Esta sala foi encerrada pelo proprietário.");
    currentRoom = null;
    initHome();
});

// --- FUNÇÕES AUXILIARES DA INTERFACE ---
function appendMessage(data, typeClass) {
    const chatArea = document.getElementById("chat-area");
    const msgElement = document.createElement("div");
    msgElement.className = `message-item ${typeClass}`;

    if (data.system) {
        msgElement.innerHTML = `<center><i>${data.text}</i></center>`;
    } else {
        msgElement.innerHTML = `
            <img src="${data.user.avatar}" class="chat-avatar">
            <div class="message-content">
                <span class="chat-name">${data.user.name}</span> <span class="chat-time">${data.time}</span>
                <p class="chat-text">${data.text}</p>
            </div>
        `;
    }
    chatArea.appendChild(msgElement);
    chatArea.scrollTop = chatArea.scrollHeight; // Auto-scroll para baixo
}

function showScreen(screen) {
    screenLogin.style.display = screen === "login" ? "block" : "none";
    screenHome.style.display = screen === "home" ? "block" : "none";
    screenRoom.style.display = screen === "room" ? "block" : "none";
}
