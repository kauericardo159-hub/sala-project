"use strict";

// server.js - Servidor Central de Comunicação Real-Time — Sincronizado com Nova UI

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Banco = require('./bancos');
const path = require('path');

const app = express();
const GITHUB_PAGES_URL = "https://kauericardo159-hub.github.io";

app.use(express.static(__dirname)); 
app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7, // 10MB para fotos em Base64
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// Sincronizadores Auxiliares de Redundância
async function syncFriends(uid) {
    const list = await Banco.getPopulatedFriendsList(uid);
    const session = Banco.bancoDadosVolatil.sessions[uid];
    if (session && session.socketId) {
        io.to(session.socketId).emit('friends_sync_data', { friends: list, requests: await Banco.getPopulatedRequestsList(uid) });
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
    // 3. ECOSSISTEMA DE SALAS (O PONTO CRÍTICO)
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
        const session = Banco.bancoDadosVolatil.sessions[uid];
        if (!session) return socket.emit('join_room_response', { success: false, message: "Sessão inválida." });

        // Busca dados completos do usuário para injetar na memória da sala
        const userList = await Banco.getPopulatedFriendsList(uid); 
        const me = await Banco.loginAccount(uid.split('_')[0], ""); // Puxada rápida fallback
        
        const profilePayload = {
            uid: uid,
            username: uid.split('_')[0],
            displayName: me.user ? me.user.displayName : uid,
            avatarUrl: me.user ? me.user.avatarUrl : "user-photo.jpg",
            socketId: socket.id
        };

        const targetRoom = Banco.findRoomById(roomId);
        if (targetRoom && targetRoom.type === "private" && targetRoom.password !== password) {
            return socket.emit('join_room_response', { success: false, message: "Senha incorreta!" });
        }

        const res = Banco.addUserToRoom(roomId, profilePayload);
        if (res.success) {
            socket.join(String(roomId));
            socket.emit('join_room_response', { success: true, room: res.room });
            
            // Transmite imediatamente a atualização do painel de voz para todos na sala
            io.to(String(roomId)).emit('room_state_broadcast', res.room);
            io.emit('rooms_list_update', Banco.getPublicRoomsList());
        } else {
            socket.emit('join_room_response', res);
        }
    });

    socket.on('send_room_chat_message', ({ roomId, senderUid, displayName, text }) => {
        // Envia o texto acoplado na mesma hora para todos que estão assistindo a sala ativa
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
            const u = room.users.find(usr => usr.uid === uid);
            if (u) u.isMuted = isMuted;
            io.to(String(roomId)).emit('room_state_broadcast', room);
        }
    });

    // ==========================================
    // 4. ATUALIZAÇÕES EXTRA E DIRECT MESSAGES
    // ==========================================
    socket.on('update_avatar', async ({ uid, avatar }) => {
        const res = await Banco.updateAccountProfile(uid, null, avatar);
        if (res) {
            socket.emit('profile_updated', { success: true, avatarUrl: avatar });
        }
    });

    socket.on('disconnect', () => {
        const { affectedRoom, foundUid } = Banco.removeUserFromAllRooms(socket.id);
        if (affectedRoom) {
            io.to(String(affectedRoom.id)).emit('room_state_broadcast', affectedRoom);
        }
        io.emit('rooms_list_update', Banco.getPublicRoomsList());
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => { 
    console.log(`[SUCESSO] Servidor Integrado na porta ${PORT}`); 
});
