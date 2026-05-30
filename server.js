const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Banco = require('./bancos'); // Importa o gerenciador que criamos

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
        const novaSala = Banco.createRoom(roomPayload);
        
        if (novaSala) {
            // Vincula o ID do socket do criador para controle interno
            roomPayload.users.push({
                uid: roomPayload.ownerId,
                name: roomPayload.ownerId.split('#')[0], // Pega o nome antes do #
                avatar: "user-photo.jpg", // O JS do front atualiza isso depois
                socketId: socket.id,
                micOn: false,
                isSpeaking: false
            });

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
        const roomAtualizada = Banco.removeUserFromRoom(roomId, uid);
        socket.leave(roomId);

        if (roomAtualizada) {
            const user = roomAtualizada.users.find(u => u.uid === uid);
            io.to(roomId).emit('room_notification', { text: `Alguém saiu da sala.` });
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
        // Encontra o usuário correspondente ao socket atual
        const room = Banco.findRoomById(roomId);
        if (room) {
            const user = room.users.find(u => u.socketId === socket.id);
            if (user) {
                const listaUsuariosAtualizada = Banco.updateUserMic(roomId, user.uid, micOn);
                if (listaUsuariosAtualizada) {
                    // Repassa a lista atualizada para os cards mudarem no front
                    io.to(roomId).emit('room_users_updated', listaUsuariosAtualizada);
                }
            }
        }
    });

    // 7. Chat de Texto da Sala (Mensagens instantâneas)
    socket.on('send_chat_message', (messageData) => {
        // Envia para todo mundo na sala, EXCETO para quem enviou (já que o front renderiza direto ao clicar em enviar)
        socket.to(messageData.roomId).emit('receive_chat_message', messageData);
    });

    // 8. Queda de Conexão ou Fechamento da aba (Disconnect)
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

// O Render define a porta automaticamente, ou usa a 3000 localmente
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando e pronto para receber conexões na porta ${PORT}`);
});
