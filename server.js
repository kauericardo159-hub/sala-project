// server.js - Servidor Central de Comunicação Real-Time — Alpha Version

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

// Inicialização do Servidor Socket.io com headers de segurança
const io = new Server(server, {
    cors: { 
        origin: GITHUB_PAGES_URL, 
        methods: ["GET", "POST"] 
    }
});

// Endpoint de verificação de status (Health Check)
app.get('/', (req, res) => { 
    res.send('Servidor Alfa operando com Contas Centralizadas e UID Fixo!'); 
});

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Usuário pareado ao socket ID: ${socket.id}`);

    // ==========================================================================
    // 1. REQUISITOS DE AUTENTICAÇÃO CENTRALIZADA (BANCO EM MEMÓRIA)
    // ==========================================================================
    
    // Processa novas contas gerando o UID fixo (#000000)
    socket.on('submit_register', ({ username, displayName, password }) => {
        const resultado = Banco.registerAccount(username, displayName, password);
        socket.emit('auth_response', resultado);
    });

    // Valida credenciais no servidor contra volatilidade de cookies locais
    socket.on('submit_login', ({ username, password }) => {
        const resultado = Banco.loginAccount(username, password);
        socket.emit('auth_response', resultado);
    });

    // ==========================================================================
    // 2. SISTEMA DE SALAS E NAVEGAÇÃO DE CONTEÚDO
    // ==========================================================================

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
            socket.emit('room_joined_success', novaSala);
            // Notifica o feed global instantaneamente
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
            socket.emit('room_joined_success', resultado.room);
            
            // Sincronização em tempo real na sala específica
            io.to(roomId).emit('room_notification', { text: `${user.name} entrou na sala.` });
            io.to(roomId).emit('room_users_updated', resultado.room.users);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        } else {
            socket.emit('room_error', resultado.message);
        }
    });

    socket.on('leave_room', ({ roomId, uid }) => {
        const room = Banco.findRoomById(roomId);
        let userName = uid;
        if (room) {
            const user = room.users.find(u => u.uid === uid);
            if (user) userName = user.name;
        }
        
        const roomAtualizada = Banco.removeUserFromRoom(roomId, uid);
        socket.leave(roomId);
        
        if (roomAtualizada) {
            io.to(roomId).emit('room_notification', { text: `${userName} saiu da sala.` });
            io.to(roomId).emit('room_users_updated', roomAtualizada.users);
        }
        io.emit('update_room_list', Banco.getPublicRoomsList());
    });

    socket.on('delete_room', ({ roomId }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            io.to(roomId).emit('room_deleted_by_owner');
            Banco.deleteRoom(roomId);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        }
    });

    // ==========================================================================
    // 3. EVENTOS DE SINALIZAÇÃO REAL-TIME (VOZ E MIC)
    // ==========================================================================

    socket.on('update_mic_status', ({ roomId, micOn }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                const listaUsuariosAtualizada = Banco.updateUserMic(roomId, user.uid, micOn);
                if (listaUsuariosAtualizada) {
                    io.to(roomId).emit('room_users_updated', listaUsuariosAtualizada);
                }
            }
        }
    });

    socket.on('update_speaking_status', ({ roomId, isSpeaking }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                user.isSpeaking = isSpeaking;
                // Broadcast otimizado para evitar loops de processamento
                socket.to(roomId).emit('room_users_updated', room.users);
            }
        }
    });

    socket.on('update_user_profile', ({ roomId, user }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const localUser = room.users.find(u => u.uid === user.uid);
            if (localUser) {
                localUser.name = user.name;
                localUser.avatar = user.avatar;
                Banco.updateAccountProfile(user.uid, user.name, user.avatar);
                io.to(roomId).emit('room_users_updated', room.users);
            }
        }
    });

    // ==========================================================================
    // 4. MODERAÇÃO E SISTEMA DE MENSAGENS (CHAT)
    // ==========================================================================

    socket.on('kick_user_request', ({ roomId, targetUid }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const targetUser = room.users.find(u => u.uid === targetUid);
            if (targetUser && targetUser.socketId) {
                io.to(targetUser.socketId).emit('room_kicked');
                Banco.removeUserFromRoom(roomId, targetUid);
                io.to(roomId).emit('room_users_updated', room.users);
                io.to(roomId).emit('room_notification', { text: `${targetUser.name} foi expulso pelo proprietário.` });
                io.emit('update_room_list', Banco.getPublicRoomsList());
            }
        }
    });

    socket.on('send_chat_message', (messageData) => {
        // Envia para todos na sala exceto para o remetente original (controle no client)
        socket.to(messageData.roomId).emit('receive_chat_message', messageData);
    });

    // Tratamento estrito de encerramento abrupto (Queda de conexão/Aba fechada)
    socket.on('disconnect', () => {
        console.log(`[DESCONEXÃO] Canal encerrado para o socket: ${socket.id}`);
        const roomAtualizada = Banco.removeUserFromAllRooms(socket.id);
        
        if (roomAtualizada) {
            io.to(roomAtualizada.id).emit('room_notification', { text: `Um usuário desconectou da chamada.` });
            io.to(roomAtualizada.id).emit('room_users_updated', roomAtualizada.users);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        }
    });
});

// Inicialização da porta dinâmica (Render de Produção / Localhost)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { 
    console.log(`[SUCESSO] Servidor Alfa rodando de forma estável na porta ${PORT}`); 
});
