// bancos.js - Gerenciador de Dados Temporal (Em Memória) — Alpha Version

const bancoDados = {
    rooms: [],        // [{ id, name, type, password, limit, ownerId, users: [] }]
    bannedUsers: {},  // { roomId: [uid1, uid2] }
    accounts: {},     // Guarda as contas cadastradas do sistema { "@username": { uid, name, avatar, password } }
    userCounter: 0    // Contador para gerar o número fixo e permanente do UID (#000001, #000002...)
};

const BancoController = {

    // ==========================================
    // 1. SISTEMA CENTRAL DE CONTAS E AUTENTICAÇÃO
    // ==========================================

    // Registra uma nova conta fixando o UID permanente de forma estrita
    registerAccount(username, displayName, password) {
        const formattedUsername = `@${username.toLowerCase().replace(/\s/g, '')}`;
        
        // Verifica se a conta já existe no servidor
        if (bancoDados.accounts[formattedUsername]) {
            return { success: false, message: "Este @username já está sendo utilizado!" };
        }

        // Incrementa o contador e gera o formato #000001, #000002...
        bancoDados.userCounter++;
        const formattedNumber = String(bancoDados.userCounter).padStart(6, '0');
        const permanentUid = `${formattedUsername}#${formattedNumber}`;

        const newAccount = {
            uid: permanentUid,
            username: formattedUsername,
            name: displayName,
            avatar: "user-photo.jpg", // Avatar padrão inicial
            password: password
        };

        // Salva na memória global do servidor
        bancoDados.accounts[formattedUsername] = newAccount;
        console.log(`[CONTA CRIADA] ${permanentUid} cadastrada com sucesso.`);

        // Retorna a conta omitindo a senha para segurança
        const { password: _, ...safeAccount } = newAccount;
        return { success: true, user: safeAccount };
    },

    // Autentica (Entra) em uma conta existente direto no servidor
    loginAccount(username, password) {
        const formattedUsername = username.startsWith('@') ? username.toLowerCase() : `@${username.toLowerCase()}`;
        const account = bancoDados.accounts[formattedUsername];

        if (!account) {
            return { success: false, message: "Esta conta não foi encontrada no servidor!" };
        }

        if (account.password !== password) {
            return { success: false, message: "Senha incorreta!" };
        }

        // Retorna os dados com sucesso
        const { password: _, ...safeAccount } = account;
        return { success: true, user: safeAccount };
    },

    // Permite que o usuário mude o nome de exibição ou avatar no servidor e atualiza salas ativas
    updateAccountProfile(uid, newName, newAvatar) {
        // 1. Encontra e atualiza o cadastro mestre na tabela de contas
        const usernameKey = Object.keys(bancoDados.accounts).find(
            key => bancoDados.accounts[key].uid === uid
        );

        if (!usernameKey) return null;

        const account = bancoDados.accounts[usernameKey];
        if (newName) account.name = newName;
        if (newAvatar) account.avatar = newAvatar;

        console.log(`[PERFIL ATUALIZADO] Cadastro de ${uid} atualizado no servidor.`);

        // 2. Sincroniza em tempo real as propriedades caso o usuário esteja dentro de alguma sala
        bancoDados.rooms.forEach(room => {
            const userInRoom = room.users.find(u => u.uid === uid);
            if (userInRoom) {
                if (newName) userInRoom.name = newName;
                if (newAvatar) userInRoom.avatar = newAvatar;
                console.log(`[SINCRONIZAÇÃO] Dados de ${uid} replicados na sala: ${room.name}`);
            }
        });

        // Retorna a conta segura atualizada
        const { password: _, ...safeAccount } = account;
        return safeAccount;
    },

    // ==========================================
    // 2. OPERAÇÕES DE GERENCIAMENTO DE SALAS
    // ==========================================

    getPublicRoomsList() {
        return bancoDados.rooms.map(room => {
            const { password, ...roomWithoutPassword } = room;
            return roomWithoutPassword;
        });
    },

    createRoom(roomPayload) {
        const exists = bancoDados.rooms.find(r => r.id === roomPayload.id);
        if (!exists) {
            if (!roomPayload.users || !Array.isArray(roomPayload.users)) {
                roomPayload.users = [];
            }
            bancoDados.rooms.push(roomPayload);
            bancoDados.bannedUsers[roomPayload.id] = [];
            return roomPayload;
        }
        return null;
    },

    findRoomById(roomId) {
        return bancoDados.rooms.find(r => r.id === roomId);
    },

    deleteRoom(roomId) {
        const index = bancoDados.rooms.findIndex(r => r.id === roomId);
        if (index !== -1) {
            bancoDados.rooms.splice(index, 1);
            delete bancoDados.bannedUsers[roomId];
            return true;
        }
        return false;
    },

    // ==========================================
    // 3. OPERAÇÕES DE PARTICIPANTES (VOZ E PRESENÇA)
    // ==========================================

    addUserToRoom(roomId, user) {
        const room = this.findRoomById(roomId);
        if (!room) return { success: false, message: "Esta sala não existe mais." };
        
        if (bancoDados.bannedUsers[roomId] && bancoDados.bannedUsers[roomId].includes(user.uid)) {
            return { success: false, message: "Você foi banido desta sala." };
        }

        if (room.users.length >= room.limit) {
            return { success: false, message: "A sala atingiu o limite máximo!" };
        }

        // Puxa a foto e nome mais recentes salvos no servidor para blindar contra o reset de avatares
        const masterAccount = Object.values(bancoDados.accounts).find(acc => acc.uid === user.uid);
        if (masterAccount) {
            user.name = masterAccount.name;
            user.avatar = masterAccount.avatar;
        }

        const userExists = room.users.find(u => u.uid === user.uid);
        if (!userExists) {
            user.micOn = user.micOn !== undefined ? user.micOn : false;
            user.isSpeaking = false;
            room.users.push(user);
        } else {
            userExists.socketId = user.socketId;
            userExists.name = user.name;
            userExists.avatar = user.avatar;
        }

        return { success: true, room };
    },

    removeUserFromRoom(roomId, uid) {
        const room = this.findRoomById(roomId);
        if (room) {
            room.users = room.users.filter(user => user.uid !== uid);
            return room;
        }
        return null;
    },

    removeUserFromAllRooms(socketId) {
        let updatedRoom = null;
        bancoDados.rooms.forEach(room => {
            const userIndex = room.users.findIndex(u => u.socketId === socketId);
            if (userIndex !== -1) {
                room.users.splice(userIndex, 1);
                updatedRoom = room;
            }
        });
        return updatedRoom;
    },

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
    }
};

module.exports = BancoController;
