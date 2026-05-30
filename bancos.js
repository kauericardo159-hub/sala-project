// bancos.js - Gerenciador de Dados Temporal (Em Memória) do Chat

// Armazenamento das salas ativas e usuários banidos
const bancoDados = {
    rooms: [],        // Lista de todas as salas criadas [{ id, name, type, password, limit, ownerId, users: [] }]
    bannedUsers: {},  // Registro de banimentos por sala { roomId: [uid1, uid2] }
};

const BancoController = {

    // --- OPERAÇÕES DE SALA ---

    // Retorna todas as salas existentes (removendo as senhas por segurança antes de enviar ao front)
    getPublicRoomsList() {
        return bancoDados.rooms.map(room => {
            const { password, ...roomWithoutPassword } = room;
            return roomWithoutPassword;
        });
    },

    // Cria uma nova sala se ela já não existir
    createRoom(roomPayload) {
        const exists = bancoDados.rooms.find(r => r.id === roomPayload.id);
        if (!exists) {
            // Garante que a lista de usuários e banidos comece vazia e estruturada
            roomPayload.users = [];
            bancoDados.rooms.push(roomPayload);
            bancoDados.bannedUsers[roomPayload.id] = [];
            return roomPayload;
        }
        return null;
    },

    // Busca uma sala específica pelo ID
    findRoomById(roomId) {
        return bancoDados.rooms.find(r => r.id === roomId);
    },

    // Deleta uma sala do sistema (quando o Owner fecha ela)
    deleteRoom(roomId) {
        const index = bancoDados.rooms.findIndex(r => r.id === roomId);
        if (index !== -1) {
            bancoDados.rooms.splice(index, 1);
            delete bancoDados.bannedUsers[roomId]; // Limpa os bans daquela sala
            return true;
        }
        return false;
    },

    // --- OPERAÇÕES DE USUÁRIOS DENTRO DAS SALAS ---

    // Adiciona um usuário a uma sala específica
    addUserToRoom(roomId, user) {
        const room = this.findRoomById(roomId);
        if (!room) return { success: false, message: "Sala não encontrada." };
        
        // Verifica se o usuário está banido
        if (bancoDados.bannedUsers[roomId]?.includes(user.uid)) {
            return { success: false, message: "Você foi banido desta sala e não pode retornar." };
        }

        // Verifica limite de usuários
        if (room.users.length >= room.limit) {
            return { success: false, message: "A sala está cheia!" };
        }

        // Verifica se o usuário já não está dentro dela para evitar duplicatas
        const userExists = room.users.find(u => u.uid === user.uid);
        if (!userExists) {
            // Define propriedades padrão de voz para o usuário que entra
            user.micOn = false;
            user.isSpeaking = false;
            room.users.push(user);
        }

        return { success: true, room };
    },

    // Remove um usuário da sala (quando ele clica em Sair ou desconecta)
    removeUserFromRoom(roomId, uid) {
        const room = this.findRoomById(roomId);
        if (room) {
            room.users = room.users.filter(user => user.uid !== uid);
            return room;
        }
        return null;
    },

    // Remove o usuário de QUALQUER sala (útil se a internet dele cair do nada)
    removeUserFromAllRooms(socketId) {
        let updatedRoom = null;
        bancoDados.rooms.forEach(room => {
            const userIndex = room.users.findIndex(u => u.socketId === socketId || u.id === socketId);
            if (userIndex !== -1) {
                room.users.splice(userIndex, 1);
                updatedRoom = room;
            }
        });
        return updatedRoom;
    },

    // Atualiza o estado do microfone do usuário (mutado/desmutado)
    updateUserMic(roomId, uid, micOn) {
        const room = this.findRoomById(roomId);
        if (room) {
            const user = room.users.find(u => u.uid === uid);
            if (user) {
                user.micOn = micOn;
                return room.users;
            }
        }
        return null;
    },

    // --- MODERAÇÃO (KICK / BAN) ---

    // Bane o usuário adicionando o UID dele na lista negra daquela sala
    banUserFromRoom(roomId, uid) {
        if (bancoDados.bannedUsers[roomId]) {
            if (!bancoDados.bannedUsers[roomId].includes(uid)) {
                bancoDados.bannedUsers[roomId].push(uid);
            }
            // Remove ele imediatamente da lista de usuários ativos da sala
            return this.removeUserFromRoom(roomId, uid);
        }
        return null;
    }
};

module.exports = BancoController;
