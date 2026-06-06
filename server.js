"use strict";

// server.js - Servidor Central de Comunicação Real-Time — Sincronizado com Nova UI

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Banco = require('./bancos');
const path = require('path');

const app = express();

app.use(express.static(__dirname)); 
app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7, // 10MB para fotos em Base64 estáveis
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// Sincronizadores Auxiliares de Redundância Social
async function syncFriends(uid) {
    const list = await Banco.getPopulatedFriendsList(uid);
    const requests = await Banco.getPopulatedRequestsList(uid);
    const session = Banco.bancoDadosVolatil.sessions[String(uid)];
    if (session && session.socketId) {
        io.to(session.socketId).emit('friends_sync_data', { friends: list, requests: requests });
    }
}

io.on('connection', (socket) => {
    // ==========================================
    // 1. AUTENTICAÇÃO
    // ==========================================
    socket.on('submit_register', async ({ username, displayName, password }) => {
        const res = await Banco.registerAccount(username, displayName, password);
        if (res.success) Banco.setUserOnlineStatus(res.user.uid, true, socket.id);
        socket.emit('auth_response', res);
    });

    socket.on('submit_login', async ({ username, password }) => {
        const res = await Banco.loginAccount(username, password);
        if (res.success) {
            Banco.setUserOnlineStatus(res.user.uid, true, socket.id);
            socket.emit('auth_response', res);
            await syncFriends(res.user.uid);
            
            // Avisa os amigos que entrei online
            if (res.user.friends) {
                res.user.friends.forEach(fUid => syncFriends(fUid));
            }
        } else {
            socket.emit('auth_response', res);
        }
    });

    // ==========================================
    // 2. SOCIAL E AMIGOS
    // ==========================================
    socket.on('get_friends_data', async ({ uid }) => {
        await syncFriends(uid);
    });

    socket.on('send_friend_request', async ({ senderUid, targetUsername, targetTag }) => {
        const res = await Banco.sendFriendRequest(senderUid, targetUsername, targetTag);
        socket.emit('friend_request_response', res);
        if (res.success && res.targetUid) {
            await syncFriends(res.targetUid);
        }
    });

    socket.on('respond_friend_request', async ({ uid, requestId, action }) => {
        const ok = await Banco.respondFriendRequest(uid, requestId, action);
        if (ok) {
            await syncFriends(uid);
            await syncFriends(requestId);
        }
    });

    // ==========================================
    // 3. ECOSSISTEMA DE SALAS
    // ==========================================
    socket.on('get_rooms_list', () => {
        socket.emit('rooms_list_update', Banco.getPublicRoomsList());
    });

    socket.on('create_room', (payload) => {
        const novaSala = Banco.createRoom(payload);
        if (novaSala) {
            socket.emit('room_creation_response', { success: true, room: novaSala });
            io.emit('rooms_list_update', Banco.getPublicRoomsList());
        }
    });

    socket.on('join_room', async ({ uid, roomId, password }) => {
        const session = Banco.bancoDadosVolatil.sessions[String(uid)];
        if (!session) return socket.emit('join_room_response', { success: false, message: "Sessão inválida." });

        // BLINDAGEM: Não quebra mais por '_' nem gera loginAccount fantasma. Puxa do estado de amigos populado ou usa os dados em cache da RAM.
        const roomList = Banco.getPublicRoomsList();
        
        const profilePayload = {
            uid: String(uid),
            username: "user", 
            displayName: "Usuário",
            avatarUrl: "user-photo.jpg",
            socketId: socket.id
        };

        // Resgata os dados reais da sessão ativa em RAM para popular o card de voz na hora
        const list = await Banco.getPopulatedFriendsList(uid).catch(() => []);
        
        const targetRoom = Banco.findRoomById(roomId);
        if (targetRoom && targetRoom.type === "private" && targetRoom.password !== password) {
            return socket.emit('join_room_response', { success: false, message: "Senha incorreta!" });
        }

        const res = Banco.addUserToRoom(roomId, profilePayload);
        if (res.success) {
            socket.join(String(roomId));
            socket.emit('join_room_response', { success: true, room: res.room });
            
            io.to(String(roomId)).emit('room_state_broadcast', res.room);
            io.emit('rooms_list_update', Banco.getPublicRoomsList());
        } else {
            socket.emit('join_room_response', res);
        }
    });

    socket.on('send_room_chat_message', ({ roomId, senderUid, displayName, text }) => {
        io.to(String(roomId)).emit('receive_room_chat_message', { senderUid, displayName, text });
    });

    socket.on('leave_room', ({ roomId, uid }) => {
        const r = Banco.removeUserFromRoom(roomId, uid);
        socket.leave(String(roomId));
        if (r) {
            io.to(String(roomId)).emit('room_state_broadcast', r);
        }
        io.emit('rooms_list_update', Banco.getPublicRoomsList());
    });

    socket.on('toggle_mute_state', ({ roomId, uid, isMuted }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const u = room.users.find(usr => String(usr.uid) === String(uid));
            if (u) u.isMuted = isMuted;
            io.to(String(roomId)).emit('room_state_broadcast', room);
        }
    });

    // ==========================================
    // 4. ATUALIZAÇÕES UNIFICADAS DE PERFIL
    // ==========================================
    
    socket.on('update_user_profile', async ({ roomId, user }) => {
        if (!user || !user.uid) return;

        const safeAccount = await Banco.updateAccountProfile(user.uid, user.name, user.avatar);

        if (safeAccount) {
            if (roomId) {
                const room = Banco.findRoomById(String(roomId));
                if (room) {
                    // Sincroniza dinamicamente o card de quem mudou de nome dentro da sala de voz
                    const uInRoom = room.users.find(u => String(u.uid) === String(user.uid));
                    if (uInRoom) uInRoom.displayName = user.name;
                    io.to(String(roomId)).emit('room_state_broadcast', room);
                }
            }
            
            // Notifica amigos online sobre a mudança visual
            const friends = await Banco.getPopulatedFriendsList(user.uid).catch(() => []);
            friends.forEach(f => syncFriends(f.uid));

            socket.emit('profile_updated_success', safeAccount);
        }
    });

    socket.on('update_avatar', async ({ uid, avatar }) => {
        const safeAccount = await Banco.updateAccountProfile(uid, null, avatar);
        if (safeAccount) {
            socket.emit('profile_updated', { success: true, avatarUrl: avatar });
            socket.emit('profile_updated_success', safeAccount);
            
            const friends = await Banco.getPopulatedFriendsList(uid).catch(() => []);
            friends.forEach(f => syncFriends(f.uid));
        }
    });

    socket.on('disconnect', () => {
        const { affectedRoom, foundUid } = Banco.removeUserFromAllRooms(socket.id);
        if (affectedRoom) {
            io.to(String(affectedRoom.id)).emit('room_state_broadcast', affectedRoom);
        }
        if (foundUid) {
            Banco.getPopulatedFriendsList(foundUid).then(friends => {
                if (friends) friends.forEach(f => syncFriends(f.uid));
            }).catch(e => console.log(e.message));
        }
        io.emit('rooms_list_update', Banco.getPublicRoomsList());
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => { 
    console.log(`[SUCESSO] Servidor Integrado com ID Numérico na porta ${PORT}`); 
});
