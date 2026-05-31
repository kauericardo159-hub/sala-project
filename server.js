"use strict";

// server.js - Servidor Central de Comunicação Real-Time — Pro Version (Fixed)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Banco = require('./bancos');
const path = require('path');

const app = express();

// 🚀 LINK DE PRODUÇÃO (Recuperado para evitar o erro de variável indefinida)
const GITHUB_PAGES_URL = "https://kauericardo159-hub.github.io";

// Diz ao Express para servir seus arquivos (HTML, CSS, JS) automaticamente
app.use(express.static(__dirname)); 

// Flexibiliza o CORS do Express para aceitar tanto a produção (GitHub) quanto os testes locais
app.use(cors({ 
    origin: [GITHUB_PAGES_URL, "http://127.0.0.1:3000", "http://localhost:3000"] 
}));
const server = http.createServer(app);

// Inicialização do Servidor Socket.io
const io = new Server(server, {
    maxHttpBufferSize: 1e7, // 10MB de limite para aguentar as strings Base64 das fotos
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 🔥 CORREÇÃO: Agora o servidor entrega o seu index.html real quando você acessa a porta 3000
app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, 'index.html')); 
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
            
            Banco.setUserOnlineStatus(uid, true, socket.id);
            socket.emit('auth_response', resultado);

            notifyUserFriendsList(uid);
            notifyUserRequestsList(uid);

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
            notifyUserRequestsList(targetUid);
        } else {
            socket.emit('friend_notification', resultado.message);
        }
    });

    socket.on('respond_friend_request', ({ myUid, targetUid, action }) => {
        const resultado = Banco.respondFriendRequest(myUid, targetUid, action);
        if (resultado) {
            notifyUserRequestsList(myUid);
            notifyUserFriendsList(myUid);
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
        if (roomPayload && roomPayload.id) roomPayload.id = String(roomPayload.id);
        
        const creatorData = roomPayload.creatorInfo; 
        const novaSala = Banco.createRoom(roomPayload);
        
        if (novaSala) {
            if (creatorData) {
                novaSala.users.push({
                    uid: creatorData.uid,
                    name: creatorData.name, 
                    avatar: creatorData.avatar || "user-photo.jpg",
                    socketId: socket.id,
                    micOn: false,
                    isSpeaking: false
                });
            }
            socket.join(String(novaSala.id));
            
            socket.emit('room_joined', novaSala); 
            socket.emit('room_joined_success', novaSala);
            
            io.emit('update_room_list', Banco.getPublicRoomsList());
        } else {
            socket.emit('room_error', 'Não foi possível criar esta sala.');
        }
    });

    socket.on('join_room', ({ roomId, password, user }) => {
        const idString = String(roomId);
        const room = Banco.findRoomById(idString);
        
        if (!room) return socket.emit('room_error', 'Esta sala não existe mais.');
        if (room.type === 'private' && room.password !== password) return socket.emit('room_error', 'Senha incorreta!');

        user.socketId = socket.id;
        const resultado = Banco.addUserToRoom(idString, user);

        if (resultado.success) {
            socket.join(idString);
            socket.emit('room_joined', resultado.room); 
            socket.emit('room_joined_success', resultado.room);
            
            io.to(idString).emit('room_notification', { text: `${user.name} entrou na sala.` });
            io.to(idString).emit('room_users_updated', resultado.room.users);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        } else {
            socket.emit('room_error', resultado.message);
        }
    });

    socket.on('leave_room', ({ roomId }) => {
        const idString = String(roomId);
        const room = Banco.findRoomById(idString);
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
            const roomAtualizada = Banco.removeUserFromRoom(idString, uid);
            socket.leave(idString);
            
            if (roomAtualizada) {
                io.to(idString).emit('room_notification', { text: `${userName} saiu da sala.` });
                io.to(idString).emit('room_users_updated', roomAtualizada.users);
            }
            io.emit('update_room_list', Banco.getPublicRoomsList());
        }
    });

    // ==========================================
    // 4. ATUALIZAÇÃO DE PERFIL E FOTO
    // ==========================================
    socket.on('update_user_profile', ({ roomId, user }) => {
        if (!user || !user.uid) return;

        const safeAccount = Banco.updateAccountProfile(user.uid, user.name, user.avatar);

        if (safeAccount) {
            if (roomId) {
                const room = Banco.findRoomById(String(roomId));
                if (room) {
                    const player = room.users.find(u => u.uid === user.uid);
                    if (player) {
                        if (user.name) player.name = user.name;
                        if (user.avatar) player.avatar = user.avatar;
                    }
                    io.to(String(roomId)).emit('room_users_updated', room.users);
                }
            }

            const accountMaster = Banco.getAccountByUid(user.uid);
            if (accountMaster && accountMaster.friends) {
                accountMaster.friends.forEach(friendUid => notifyUserFriendsList(friendUid));
            }

            socket.emit('profile_updated_success', safeAccount);
        }
    });

    // ==========================================
    // 5. CHAT DE TEXTO E VOZ
    // ==========================================
    socket.on('send_message', (messagePayload) => {
        if (messagePayload && messagePayload.roomId) {
            io.to(String(messagePayload.roomId)).emit('receive_message', messagePayload);
        }
    });

    socket.on('toggle_mic', ({ roomId, micOn }) => {
        const idString = String(roomId);
        const room = Banco.findRoomById(idString);
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                Banco.updateUserMic(idString, user.uid, micOn);
                io.to(idString).emit('user_mic_toggled', { uid: user.uid, micOn });
            }
        }
    });

    socket.on('is_speaking', ({ roomId, isSpeaking }) => {
        const idString = String(roomId);
        const room = Banco.findRoomById(idString);
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                user.isSpeaking = isSpeaking;
                io.to(idString).emit('user_speaking', { uid: user.uid, isSpeaking });
            }
        }
    });

    // ==========================================
    // 6. TRATAMENTO DE DESCONEXÃO
    // ==========================================
    socket.on('disconnect', () => {
        console.log(`[DESCONEXÃO] Socket perdido: ${socket.id}`);
        
        const { updatedRoom, disconnectedUid } = Banco.removeUserFromAllRooms(socket.id);
        
        if (updatedRoom) {
            io.to(String(updatedRoom.id)).emit('room_notification', { text: `Alguém caiu da chamada.` });
            io.to(String(updatedRoom.id)).emit('room_users_updated', updatedRoom.users);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        }

        if (disconnectedUid) {
            const account = Banco.getAccountByUid(disconnectedUid);
            if (account && account.friends) {
                account.friends.forEach(friendUid => notifyUserFriendsList(friendUid));
            }
        }
    });
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;

// Escutando em 0.0.0.0 para aceitar conexões locais internas do navegador do celular
server.listen(PORT, '0.0.0.0', () => { 
    console.log(`[SUCESSO] Servidor Pro rodando na porta ${PORT}`); 
});
