// bancos.js - Gerenciador de Dados Temporal (Em Memória) — Pro Version

const bancoDados = {
    rooms: [],        // [{ id, name, type, password, limit, ownerId, users: [] }]
    bannedUsers: {},  // { roomId: [uid1, uid2] }
    accounts: {},     // { "@username": { uid, name, avatar, password, friends: [], friendRequests: [], isOnline: false, socketId: null } }
    userCounter: 0    // Contador para o UID permanente (#000001)
};

const BancoController = {

    // ==========================================
    // 0. UTILITÁRIOS INTERNOS (HELPERS)
    // ==========================================
    
    // Busca uma conta pelo UID em vez do @username
    getAccountByUid(uid) {
        const usernameKey = Object.keys(bancoDados.accounts).find(
            key => bancoDados.accounts[key].uid === uid
        );
        return usernameKey ? bancoDados.accounts[usernameKey] : null;
    },

    // ==========================================
    // 1. SISTEMA CENTRAL DE CONTAS E AUTENTICAÇÃO
    // ==========================================

    registerAccount(username, displayName, password) {
        const formattedUsername = `@${username.toLowerCase().replace(/\s/g, '')}`;
        
        if (bancoDados.accounts[formattedUsername]) {
            return { success: false, message: "Este @username já está sendo utilizado!" };
        }

        bancoDados.userCounter++;
        const formattedNumber = String(bancoDados.userCounter).padStart(6, '0');
        const permanentUid = `${formattedUsername}#${formattedNumber}`;

        const newAccount = {
            uid: permanentUid,
            username: formattedUsername,
            name: displayName,
            avatar: "user-photo.jpg",
            password: password,
            friends: [],          // [NOVO] Array de UIDs de amigos
            friendRequests: [],   // [NOVO] Array de UIDs de quem enviou convite
            isOnline: false,      // [NOVO] Status
            socketId: null        // [NOVO] Conexão atual
        };

        bancoDados.accounts[formattedUsername] = newAccount;
        console.log(`[CONTA CRIADA] ${permanentUid} cadastrada com sucesso.`);

        const { password: _, ...safeAccount } = newAccount;
        return { success: true, user: safeAccount };
    },

    loginAccount(username, password) {
        const formattedUsername = username.startsWith('@') ? username.toLowerCase() : `@${username.toLowerCase()}`;
        const account = bancoDados.accounts[formattedUsername];

        if (!account) return { success: false, message: "Esta conta não foi encontrada no servidor!" };
        if (account.password !== password) return { success: false, message: "Senha incorreta!" };

        const { password: _, ...safeAccount } = account;
        return { success: true, user: safeAccount };
    },

    updateAccountProfile(uid, newName, newAvatar) {
        const account = this.getAccountByUid(uid);
        if (!account) return null;

        if (newName) account.name = newName;
        if (newAvatar) account.avatar = newAvatar;

        console.log(`[PERFIL ATUALIZADO] Dados de ${uid} salvos.`);

        // Sincroniza nas salas ativas
        bancoDados.rooms.forEach(room => {
            const userInRoom = room.users.find(u => u.uid === uid);
            if (userInRoom) {
                if (newName) userInRoom.name = newName;
                if (newAvatar) userInRoom.avatar = newAvatar;
            }
        });

        const { password: _, ...safeAccount } = account;
        return safeAccount;
    },

    // ==========================================
    // 2. SISTEMA SOCIAL (AMIGOS E STATUS) [NOVO]
    // ==========================================

    setUserOnlineStatus(uid, isOnline, socketId = null) {
        const account = this.getAccountByUid(uid);
        if (account) {
            account.isOnline = isOnline;
            account.socketId = socketId;
        }
    },

    sendFriendRequest(senderUid, targetUid) {
        const sender = this.getAccountByUid(senderUid);
        const target = this.getAccountByUid(targetUid);

        if (!target) return { success: false, message: "Usuário não encontrado." };
        if (senderUid === targetUid) return { success: false, message: "Você não pode adicionar a si mesmo." };
        if (target.friends.includes(senderUid)) return { success: false, message: "Vocês já são amigos!" };
        if (target.friendRequests.includes(senderUid)) return { success: false, message: "Convite já enviado." };

        target.friendRequests.push(senderUid);
        return { success: true, targetSocket: target.socketId, message: "Convite enviado com sucesso!" };
    },

    respondFriendRequest(myUid, senderUid, action) {
        const me = this.getAccountByUid(myUid);
        const sender = this.getAccountByUid(senderUid);
        
        if (!me || !sender) return false;

        // Remove o convite pendente
        me.friendRequests = me.friendRequests.filter(uid => uid !== senderUid);

        if (action === "accept") {
            if (!me.friends.includes(senderUid)) me.friends.push(senderUid);
            if (!sender.friends.includes(myUid)) sender.friends.push(myUid);
        }

        return { myStatus: true, senderSocket: sender.socketId };
    },

    removeFriend(myUid, targetUid) {
        const me = this.getAccountByUid(myUid);
        const target = this.getAccountByUid(targetUid);

        if (me) me.friends = me.friends.filter(uid => uid !== targetUid);
        if (target) target.friends = target.friends.filter(uid => uid !== myUid);

        return { success: true, targetSocket: target ? target.socketId : null };
    },

    // Retorna a lista detalhada de amigos (com foto, nome e status)
    getPopulatedFriendsList(uid) {
        const account = this.getAccountByUid(uid);
        if (!account) return [];

        return account.friends.map(friendUid => {
            const friend = this.getAccountByUid(friendUid);
            return friend ? {
                uid: friend.uid,
                name: friend.name,
                avatar: friend.avatar,
                isOnline: friend.isOnline
            } : null;
        }).filter(Boolean); // Remove nulos
    },

    // Retorna os dados de quem enviou solicitações
    getPopulatedRequestsList(uid) {
        const account = this.getAccountByUid(uid);
        if (!account) return [];

        return account.friendRequests.map(reqUid => {
            const req = this.getAccountByUid(reqUid);
            return req ? {
                uid: req.uid,
                name: req.name,
                avatar: req.avatar
            } : null;
        }).filter(Boolean);
    },

    // ==========================================
    // 3. OPERAÇÕES DE GERENCIAMENTO DE SALAS
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
            roomPayload.users = Array.isArray(roomPayload.users) ? roomPayload.users : [];
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
    // 4. OPERAÇÕES DE PARTICIPANTES (VOZ E PRESENÇA)
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

        const masterAccount = this.getAccountByUid(user.uid);
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
        let disconnectedUid = null;

        // 1. Remove das salas
        bancoDados.rooms.forEach(room => {
            const userIndex = room.users.findIndex(u => u.socketId === socketId);
            if (userIndex !== -1) {
                disconnectedUid = room.users[userIndex].uid;
                room.users.splice(userIndex, 1);
                updatedRoom = room;
            }
        });

        // 2. Marca como offline no sistema central
        const usernameKey = Object.keys(bancoDados.accounts).find(
            key => bancoDados.accounts[key].socketId === socketId
        );
        if (usernameKey) {
            bancoDados.accounts[usernameKey].isOnline = false;
            bancoDados.accounts[usernameKey].socketId = null;
            disconnectedUid = bancoDados.accounts[usernameKey].uid;
        }

        return { updatedRoom, disconnectedUid };
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
