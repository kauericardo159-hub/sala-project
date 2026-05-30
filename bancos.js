// bancos.js - Gerenciador de Dados Temporal (Em Memória) do Chat — Alpha Version

// Armazenamento estruturado das salas ativas e controle de acessos
const bancoDados = {
    rooms: [],        // Lista de todas as salas criadas [{ id, name, type, password, limit, ownerId, users: [] }]
    bannedUsers: {},  // Registro de banimentos por sala { roomId: [uid1, uid2] }
};

const BancoController = {

    // ==========================================
    // OPERAÇÕES DE GERENCIAMENTO DE SALAS
    // ==========================================

    // Retorna todas as salas existentes ocultando senhas por segurança antes do envio ao front
    getPublicRoomsList() {
        return bancoDados.rooms.map(room => {
            const { password, ...roomWithoutPassword } = room;
            return roomWithoutPassword;
        });
    },

    // Cria uma nova sala preservando os dados iniciais do criador enviados pelo payload
    createRoom(roomPayload) {
        const exists = bancoDados.rooms.find(r => r.id === roomPayload.id);
        if (!exists) {
            // Se o payload não trouxer usuários configurados, inicializa o array vazio
            if (!roomPayload.users || !Array.isArray(roomPayload.users)) {
                roomPayload.users = [];
            }
            
            bancoDados.rooms.push(roomPayload);
            bancoDados.bannedUsers[roomPayload.id] = [];
            return roomPayload;
        }
        return null;
    },

    // Busca uma sala específica de forma direta pelo ID único
    findRoomById(roomId) {
        return bancoDados.rooms.find(r => r.id === roomId);
    },

    // Deleta uma sala do sistema (Ação destrutiva do Dono/Owner)
    deleteRoom(roomId) {
        const index = bancoDados.rooms.findIndex(r => r.id === roomId);
        if (index !== -1) {
            bancoDados.rooms.splice(index, 1);
            delete bancoDados.bannedUsers[roomId]; // Limpa o lixo de memória dos bans daquela sala específica
            return true;
        }
        return false;
    },

    // ==========================================
    // OPERAÇÕES DE PARTICIPANTES (VOZ E PRESENÇA)
    // ==========================================

    // Adiciona e valida novos usuários ao tentar entrar em uma sala ativa
    addUserToRoom(roomId, user) {
        const room = this.findRoomById(roomId);
        if (!room) return { success: false, message: "Esta sala não existe mais ou foi encerrada." };
        
        // Validação de segurança: Verifica se o UID consta na lista negra (banidos) da sala
        if (bancoDados.bannedUsers[roomId] && bancoDados.bannedUsers[roomId].includes(user.uid)) {
            return { success: false, message: "Você foi banido desta sala pelo proprietário e não pode retornar." };
        }

        // Validação de infraestrutura: Limite máximo configurado na criação do espaço
        if (room.users.length >= room.limit) {
            return { success: false, message: "A sala atingiu o limite máximo de participantes!" };
        }

        // Previne clonagem ou conexões duplicadas do mesmo UID no mesmo espaço
        const userExists = room.users.find(u => u.uid === user.uid);
        if (!userExists) {
            // Garante os estados iniciais de comunicação zerados de forma limpa
            user.micOn = user.micOn !== undefined ? user.micOn : false;
            user.isSpeaking = false;
            room.users.push(user);
        } else {
            // Se ele já existia (ex: reconexão rápida), apenas atualiza o socket ID de comunicação
            userExists.socketId = user.socketId;
        }

        return { success: true, room };
    },

    // Remove um usuário específico baseado no UID (Sair voluntariamente ou Expulsão)
    removeUserFromRoom(roomId, uid) {
        const room = this.findRoomById(roomId);
        if (room) {
            room.users = room.users.filter(user => user.uid !== uid);
            return room;
        }
        return null;
    },

    // Varre todas as salas para limpar conexões órfãs (Quedas de internet / Fechamento de abas)
    removeUserFromAllRooms(socketId) {
        let updatedRoom = null;
        bancoDados.rooms.forEach(room => {
            const userIndex = room.users.findIndex(u => u.socketId === socketId);
            if (userIndex !== -1) {
                room.users.splice(userIndex, 1);
                updatedRoom = room; // Retorna a referência da sala modificada para alertar os outros via socket
            }
        });
        return updatedRoom;
    },

    // Sincroniza em tempo real se o microfone está ativo ou mutado no front-end
    updateUserMic(roomId, uid, micOn) {
        const room = this.findRoomById(roomId);
        if (room) {
            const user = room.users.find(u => u.uid === uid);
            if (user) {
                user.micOn = micOn;
                return room.users; // Retorna a lista atualizada para transmissão em massa
            }
        }
        return null;
    },

    // ==========================================
    // SISTEMA DE SEGURANÇA E MODERAÇÃO
    // ==========================================

    // Aplica restrição permanente no UID para que ele não consiga burlar o sistema e reentrar
    banUserFromRoom(roomId, uid) {
        if (bancoDados.bannedUsers[roomId]) {
            if (!bancoDados.bannedUsers[roomId].includes(uid)) {
                bancoDados.bannedUsers[roomId].push(uid);
            }
            // Remove o usuário imediatamente do array ativo para desconectá-lo
            return this.removeUserFromRoom(roomId, uid);
        }
        return null;
    }
};

module.exports = BancoController;
