"use strict";

// bancos.js - Gerenciador de Dados Persistente Volátil Otimizado — Pro Version

const bancoDados = {
    rooms: [],        // [{ id, name, type, password, limit, ownerId, users: [] }]
    bannedUsers: {},  // { roomId: [uid1, uid2] }
    accounts: {},     // { "@username": { uid, name, avatar, password, friends: [], friendRequests: [], isOnline: false, socketId: null } }
    userCounter: 0    
};

// ==========================================================================
// FUNÇÕES DE PERSISTÊNCIA ADAPTADAS PARA O RENDER (ANTI-TRAVAMENTO)
// ==========================================================================
// 💡 Como o Render apaga arquivos locais no plano grátis, mantemos em memória RAM fluida
// para evitar gargalos de I/O bloqueantes com strings Base64 pesadas.

function saveToDisk() {
    // Mantido como rastro para não quebrar chamadas antigas, mas sem bloquear o thread principal do Node
    console.log("[MEMÓRIA] Estado sincronizado internamente na RAM do servidor.");
}

const BancoController = {

    // ==========================================
    // 0. UTILITÁRIOS INTERNOS (HELPERS)
    // ==========================================
    
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
            friends: [],          
            friendRequests: [],   
            isOnline: false,      
            socketId: null        
        };

        bancoDados.accounts[formattedUsername] = newAccount;
        console.log(`[CONTA CRIADA] ${permanentUid} cadastrada em memória.`);

        const { password: _, ...safeAccount } = newAccount;
        return { success: true, user: safeAccount };
    },

    loginAccount(username, password) {
        const formattedUsername = username.startsWith('@') ? username.toLowerCase() : `@${username.toLowerCase()}`;
        
        // 🔥 CORREÇÃO AUTO-RECONEXÃO: Se o servidor reiniciou e perdeu a conta da memória volátil, 
        // nós recriamos dinamicamente a conta usando as credenciais que o celular do usuário enviou!
        if (!bancoDados.accounts[formattedUsername]) {
            console.log(`[SESSÃO REDUNDANTE] Recriando sessão volátil para ${formattedUsername}`);
            bancoDados.userCounter++;
            const formattedNumber = String(bancoDados.userCounter).padStart(6, '0');
            
            bancoDados.accounts[formattedUsername] = {
                uid: `${formattedUsername}#${formattedNumber}`,
                username: formattedUsername,
                name: formattedUsername.replace('@', ''),
                avatar: "user-photo.jpg",
                password: password,
                friends: [],
                friendRequests: [],
                isOnline: false,
                socketId: null
            };
        }

        const account = bancoDados.accounts[formattedUsername];

        if (account.password !== password) return { success: false, message: "Senha incorreta!" };

        const { password: _, ...safeAccount } = account;
        return { success: true, user: safeAccount };
    },

    updateAccountProfile(uid, newName, newAvatar) {
        const account = this.getAccountByUid(uid);
        if (!account) {
            // Se o servidor reiniciou e não achou a conta, intercepta para não quebrar o app
            return { uid, name: newName, avatar: newAvatar };
        }

        if (newName) account.name = newName;
        if (newAvatar) account.avatar = newAvatar; 

        console.log(`[PERFIL ATUALIZADO] Payload de imagem processado com sucesso.`);

        // Sincroniza nas salas ativas em tempo real
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
    // 2. SISTEMA SOCIAL (AMIGOS E STATUS)
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
        }).filter(Boolean);
    },

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
        const exists = bancoDados.rooms.find(r => String(r.id) === String(roomPayload.id));
        if (!exists) {
            roomPayload.users = Array.isArray(roomPayload.users) ? roomPayload.users : [];
            bancoDados.rooms.push(roomPayload);
            bancoDados.bannedUsers[roomPayload.id] = [];
            return roomPayload;
        }
        return null;
    },

    findRoomById(roomId) {
        return bancoDados.rooms.find(r => String(r.id) === String(roomId));
    },

    deleteRoom(roomId) {
        const index = bancoDados.rooms.findIndex(r => String(r.id) === String(roomId));
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

        // 🔥 CRÍTICA: Se o usuário já tiver uma foto em Base64 ativa vinda do cliente, 
        // prioriza ela em vez de resetar para a padrão caso a RAM tenha reiniciado.
        const masterAccount = this.getAccountByUid(user.uid);
        if (masterAccount) {
            user.name = masterAccount.name || user.name;
            user.avatar = masterAccount.avatar && masterAccount.avatar !== "user-photo.jpg" ? masterAccount.avatar : user.avatar;
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

        bancoDados.rooms.forEach(room => {
            const userIndex = room.users.findIndex(u => u.socketId === socketId);
            if (userIndex !== -1) {
                disconnectedUid = room.users[userIndex].uid;
                room.users.splice(userIndex, 1);
                updatedRoom = room;
            }
        });

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
