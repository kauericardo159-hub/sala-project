const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Banco = require('./bancos'); // Importa o gerenciador de dados em memória

const app = express();
const GITHUB_PAGES_URL = "https://kauericardo159-hub.github.io";

// Libera o CORS para o seu link do GitHub Pages conseguir se conectar
app.use(cors({
    origin: GITHUB_PAGES_URL
}));

const server = http.createServer(app);

// Configura o Socket.io com permissão de CORS
const io = new Server(server, {
    cors: {
        origin: GITHUB_PAGES_URL,
        methods: ["GET", "POST"]
    }
});

// Rota padrão para testar se o servidor do Render está online
app.get('/', (req, res) => {
    res.send('Servidor do Chat rodando com sucesso no Render!');
});

// ==========================================
// GERENCIAMENTO DE CONEXÕES EM TEMPO REAL
// ==========================================
io.on('connection', (socket) => {
    console.log(`Usuário conectado ao socket: ${socket.id}`);

    // 1. Envia a lista de salas assim que o usuário loga e vai para a Home
    socket.on('request_room_list', () => {
        socket.emit('update_room_list', Banco.getPublicRoomsList());
    });

    // 2. Criação de Sala
    socket.on('create_room', (roomPayload) => {
        // Encontra os dados estruturados do criador enviados dentro do payload
        const creatorData = roomPayload.creatorInfo; 
        
        const novaSala = Banco.createRoom(roomPayload);
        
        if (novaSala) {
            // Se o front enviou os dados do criador, injetamos ele com seu perfil atualizado
            if (creatorData) {
                novaSala.users.push({
                    uid: creatorData.uid,
                    name: creatorData.name, 
                    avatar: creatorData.avatar || "user-photo.jpg",
                    socketId: socket.id,
                    micOn: true, // Já inicia com mic ativo ao criar
                    isSpeaking: false
                });
            } else {
                // Fallback de segurança caso falte o payload do criador
                const ownerName = roomPayload.ownerId.startsWith('@') ? roomPayload.ownerId.substring(1) : roomPayload.ownerId;
                novaSala.users.push({
                    uid: roomPayload.ownerId,
                    name: ownerName, 
                    avatar: "user-photo.jpg",
                    socketId: socket.id,
                    micOn: true,
                    isSpeaking: false
                });
            }

            socket.join(novaSala.id);
            socket.emit('room_joined_success', novaSala);
            
            // Atualiza a lista de salas para TODO MUNDO que está na Home
            io.emit('update_room_list', Banco.getPublicRoomsList());
        } else {
            socket.emit('room_error', 'Não foi possível criar a sala. Tente novamente.');
        }
    });

    // 3. Entrar em uma Sala Existente (Pública ou Privada)
    socket.on('join_room', ({ roomId, password, user }) => {
        const room = Banco.findRoomById(roomId);
        
        if (!room) {
            return socket.emit('room_error', 'Esta sala não existe mais.');
        }

        // Validação de Senha para salas privadas
        if (room.type === 'private' && room.password !== password) {
            return socket.emit('room_error', 'Senha incorreta!');
        }

        // Tenta adicionar o usuário no bancos.js (valida limite e ban)
        user.socketId = socket.id; // Salva o socket atual do usuário
        const resultado = Banco.addUserToRoom(roomId, user);

        if (resultado.success) {
            socket.join(roomId);
            
            // Avisa o próprio usuário que ele entrou
            socket.emit('room_joined_success', resultado.room);
            
            // Avisa a sala toda quem entrou (Mensagem de sistema)
            io.to(roomId).emit('room_notification', { text: `${user.name} entrou na sala.` });
            
            // Atualiza os cards de quem está na call para todo mundo da sala
            io.to(roomId).emit('room_users_updated', resultado.room.users);
            
            // Atualiza a quantidade de pessoas na lista da Home
            io.emit('update_room_list', Banco.getPublicRoomsList());
        } else {
            socket.emit('room_error', resultado.message);
        }
    });

    // 4. Sair da Sala voluntariamente
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

        // Atualiza a Home e as listas globais
        io.emit('update_room_list', Banco.getPublicRoomsList());
    });

    // 5. Excluir sala (Ação do Dono / Owner)
    socket.on('delete_room', ({ roomId }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            // Avisa todo mundo da sala para ser jogado de volta para a Home
            io.to(roomId).emit('room_deleted_by_owner');
            
            // Remove a sala do banco
            Banco.deleteRoom(roomId);
            
            // Atualiza a lista da Home de todos
            io.emit('update_room_list', Banco.getPublicRoomsList());
        }
    });

    // 6. Atualizar Status do Microfone (🎙️ / 🔇)
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

    // 7. Atualizar Status de Fala (Indicação Visual Verde de Volume)
    socket.on('update_speaking_status', ({ roomId, isSpeaking }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                user.isSpeaking = isSpeaking;
                // Transmite o estado de fala para todos na sala alterarem as bordas dos cards
                socket.to(roomId).emit('room_users_updated', room.users);
            }
        }
    });

    // 8. Atualizar Perfil no Meio da Conversa (Nome e Avatar Editados)
    socket.on('update_user_profile', ({ roomId, user }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const localUser = room.users.find(u => u.uid === user.uid);
            if (localUser) {
                localUser.name = user.name;
                localUser.avatar = user.avatar;
                // Sincroniza a mudança de foto/nome com os cards de todo mundo
                io.to(roomId).emit('room_users_updated', room.users);
            }
        }
    });

    // 9. Expulsar Usuário (Ação Exclusiva do Owner)
    socket.on('kick_user_request', ({ roomId, targetUid }) => {
        const room = Banco.findRoomById(roomId);
        if (room) {
            const targetUser = room.users.find(u => u.uid === targetUid);
            if (targetUser && targetUser.socketId) {
                // Manda um sinal privado direto para o expulso sair da tela
                io.to(targetUser.socketId).emit('room_kicked');
                
                // Remove ele do controle de dados
                Banco.removeUserFromRoom(roomId, targetUid);
                
                // Notifica o resto dos participantes na sala
                io.to(roomId).emit('room_users_updated', room.users);
                io.to(roomId).emit('room_notification', { text: `${targetUser.name} foi expulso da sala pelo proprietário.` });
                
                // Atualiza a listagem da Home geral
                io.emit('update_room_list', Banco.getPublicRoomsList());
            }
        }
    });

    // 10. Chat de Texto da Sala (Mensagens instantâneas)
    socket.on('send_chat_message', (messageData) => {
        socket.to(messageData.roomId).emit('receive_chat_message', messageData);
    });

    // 11. Queda de Conexão ou Fechamento da aba (Disconnect)
    socket.on('disconnect', () => {
        console.log(`Usuário desconectou do socket: ${socket.id}`);
        
        // Remove o usuário de qualquer sala onde o socketId dele estava ativo
        const roomAtualizada = Banco.removeUserFromAllRooms(socket.id);
        
        if (roomAtualizada) {
            io.to(roomAtualizada.id).emit('room_notification', { text: `Um usuário perdeu a conexão.` });
            io.to(roomAtualizada.id).emit('room_users_updated', roomAtualizada.users);
            io.emit('update_room_list', Banco.getPublicRoomsList());
        }
    });
});

// O Render define a porta automaticamente pela variável PORT, ou usa a 3000 localmente
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor profissional rodando na porta ${PORT}`);
});
