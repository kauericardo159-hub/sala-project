// server.js - Servidor Central de Comunicação Real-Time — Pro Version

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Banco = require('./bancos');

const app = express();
const GITHUB_PAGES_URL = "https://kauericardo159-hub.github.io";

// Configuração estrita de CORS para a API Express
app.use(cors({ origin: GITHUB_PAGES_URL }));
const server = http.createServer(app);

// Inicialização do Servidor Socket.io
const io = new Server(server, {
    cors: { 
        origin: GITHUB_PAGES_URL, 
        methods: ["GET", "POST"] 
    }
});

// Endpoint de verificação de status (Health Check)
app.get('/', (req, res) => { 
    res.send('Servidor Pro operando com Sistema de Amigos e Modularidade!'); 
});

// ==========================================================================
// FUNÇÕES AUXILIARES DE NOTIFICAÇÃO SOCIAL
// ==========================================================================
function notifyUserFriendsList(uid) {
    const account = Banco.getAccountByUid(uid);
    if (account && account.socketId) {
        io.to(account.socketId).emit('update_friends_list', Banco.getPopulatedFriendsList(uid));
    }
}

function notifyUserRequestsList(uid) {
    const account = Banco.getAccountByUid(uid);
    if (account && account.socketId) {
        io.to(account.socketId).emit('update_friend_requests', Banco.getPopulatedRequestsList(uid));
    }
}

// ==========================================================================
// CONEXÃO PRINCIPAL (SOCKET)
// ==========================================================================
io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Socket engatado: ${socket.id}`);

    // ==========================================
    // 1. AUTENTICAÇÃO E STATUS ONLINE
    // ==========================================
    
    socket.on('submit_register', ({ username, displayName, password }) => {
        const resultado = Banco.registerAccount(username, displayName, password);
        if (resultado.success) {
            Banco.setUserOnlineStatus(resultado.user.uid, true, socket.id);
        }
        socket.emit('auth_response', resultado);
    });

    socket.on('submit_login', ({ username, password }) => {
        const resultado = Banco.loginAccount(username, password);
        if (resultado.success) {
            const uid = resultado.user.uid;
            
            // 1. Marca como online
            Banco.setUserOnlineStatus(uid, true, socket.id);
            socket.emit('auth_response', resultado);

            // 2. Envia as listas sociais do próprio usuário
            notifyUserFriendsList(uid);
            notifyUserRequestsList(uid);

            // 3. Avisa aos amigos dele que ele ficou Online
            const account = Banco.getAccountByUid(uid);
            if (account && account.friends) {
                account.friends.forEach(friendUid => notifyUserFriendsList(friendUid));
            }
        } else {
            socket.emit('auth_response', resultado);
        }
    });

    // ==========================================
    // 2. SISTEMA SOCIAL (AMIGOS)
    // ==========================================

    socket.on('send_friend_request', ({ senderUid, targetUid }) => {
        const resultado = Banco.sendFriendRequest(senderUid, targetUid);
        if (resultado.success) {
            socket.emit('friend_notification', resultado.message);
            notifyUserRequestsList(targetUid); // Atualiza a tela de quem recebeu
        } else {
            socket.emit('friend_notification', resultado.message); // Erro
        }
    });

    socket.on('respond_friend_request', ({ myUid, targetUid, action }) => {
        const resultado = Banco.respondFriendRequest(myUid, targetUid, action);
        if (resultado) {
            // Atualiza os convites e a lista de quem aceitou
            notifyUserRequestsList(myUid);
            notifyUserFriendsList(myUid);
            // Atualiza a lista de quem foi aceito
            notifyUserFriendsList(targetUid);
            
            if (action === "accept") {
                io.to(resultado.senderSocket).emit('friend_notification', 'Seu pedido de amizade foi aceito!');
            }
        }
    });

    socket.on('remove_friend', ({ myUid, targetUid }) => {
        Banco.removeFriend(myUid, targetUid);
        notifyUserFriendsList(myUid);
        notifyUserFriendsList(targetUid);
    });

    // ==========================================
    // 3. GERENCIAMENTO DE SALAS
    // ==========================================

    socket.on('request_room_list', () => {
        socket.emit('update_room_list', Banco.getPublicRoomsList());
    });

    socket.on('create_room', (roomPayload) => {
        const creatorData = roomPayload.creatorInfo; 
        const novaSala = Banco.createRoom(roomPayload);
        
        if (novaSala) {
            if (creatorData) {
                novaSala.users.push({
                    uid: creatorData.uid,
                    name: creatorData.name, 
                    avatar: creatorData.avatar || "user-photo.jpg",
                    socketId: socket.id,
                    micOn: true,
                    isSpeaking: false
                });
            }
            socket.join(novaSala.id);
            socket.emit('room_joined', novaSala); // Aciona o gatilho para limpar o chat
            socket.emit('room_joined_success', novaSala);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        } else {
            socket.emit('room_error', 'Não foi possível criar esta sala.');
        }
    });

    socket.on('join_room', ({ roomId, password, user }) => {
        const room = Banco.findRoomById(roomId);
        if (!room) return socket.emit('room_error', 'Esta sala não existe mais.');
        if (room.type === 'private' && room.password !== password) return socket.emit('room_error', 'Senha incorreta!');

        user.socketId = socket.id;
        const resultado = Banco.addUserToRoom(roomId, user);

        if (resultado.success) {
            socket.join(roomId);
            socket.emit('room_joined'); // Aciona o gatilho para limpar o chat no frontend
            socket.emit('room_joined_success', resultado.room);
            
            io.to(roomId).emit('room_notification', { text: `${user.name} entrou na sala.` });
            io.to(roomId).emit('room_users_update', resultado.room.users);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        } else {
            socket.emit('room_error', resultado.message);
        }
    });

    socket.on('leave_room', ({ roomId }) => {
        const room = Banco.findRoomById(roomId);
        let userName = "Alguém";
        let uid = null;
        
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                userName = user.name;
                uid = user.uid;
            }
        }
        
        if (uid) {
            const roomAtualizada = Banco.removeUserFromRoom(roomId, uid);
            socket.leave(roomId);
            
            if (roomAtualizada) {
                io.to(roomId).emit('room_notification', { text: `${userName} saiu da sala.` });
                io.to(roomId).emit('room_users_update', roomAtualizada.users);
            }
            io.emit('update_room_list', Banco.getPublicRoomsList());
        }
    });

    // ==========================================
    // 4. CHAT DE TEXTO E VOZ
    // ==========================================

    socket.on('send_message', (messagePayload) => {
        // Dispara para todo mundo na sala (incluindo quem enviou para que ele veja a própria msg)
        io.to(messagePayload.roomId).emit('receive_message', messagePayload);
    });

    socket.on('toggle_mic', ({ roomId, micOn }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                Banco.updateUserMic(roomId, user.uid, micOn);
                // Avisa apenas sobre esse usuário, economiza banda em vez de mandar o array inteiro
                io.to(roomId).emit('user_mic_toggled', { uid: user.uid, micOn });
            }
        }
    });

    socket.on('is_speaking', ({ roomId, isSpeaking }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                user.isSpeaking = isSpeaking;
                io.to(roomId).emit('user_speaking', { uid: user.uid, isSpeaking });
            }
        }
    });

    // ==========================================
    // 5. TRATAMENTO DE DESCONEXÃO (FECHOU ABA)
    // ==========================================
    socket.on('disconnect', () => {
        console.log(`[DESCONEXÃO] Socket perdido: ${socket.id}`);
        
        // Remove das salas e marca como offline
        const { updatedRoom, disconnectedUid } = Banco.removeUserFromAllRooms(socket.id);
        
        // Se ele estava em uma sala, avisa o resto do pessoal lá
        if (updatedRoom) {
            io.to(updatedRoom.id).emit('room_notification', { text: `Alguém caiu da chamada.` });
            io.to(updatedRoom.id).emit('room_users_update', updatedRoom.users);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        }

        // Se ele tinha uma conta logada, avisa os amigos que ele ficou offline
        if (disconnectedUid) {
            const account = Banco.getAccountByUid(disconnectedUid);
            if (account && account.friends) {
                account.friends.forEach(friendUid => notifyUserFriendsList(friendUid));
            }
        }
    });
});

// Inicialização
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { 
    console.log(`[SUCESSO] Servidor Pro rodando na porta ${PORT}`); 
});
