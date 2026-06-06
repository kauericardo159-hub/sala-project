"use strict";

// bancos.js - Gerenciador de Dados Persistente via Supabase Cloud — Pro Version
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zfmitiynlocxmibbvcww.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LgMAx-dzMCyp_LPxXQxDew_Jxt6mAHR'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const bancoDadosVolatil = {
    rooms: [],        
    bannedUsers: {},  
    sessions: {}      
};

const BancoController = {
    bancoDadosVolatil,

    // ==========================================
    // 1. SISTEMA CENTRAL DE CONTAS E AUTENTICAÇÃO
    // ==========================================
    async registerAccount(username, displayName, password) {
        const formattedUsername = username.toLowerCase().replace(/\s/g, '');

        const { data: existingUser } = await supabase
            .from('accounts')
            .select('username')
            .eq('username', formattedUsername)
            .single();

        if (existingUser) {
            return { success: false, message: "Este @username já está sendo utilizado!" };
        }

        const randomId = String(Math.floor(1000 + Math.random() * 9000));
        const permanentUid = `${formattedUsername}_${randomId}`;

        const newAccount = {
            uid: permanentUid,
            username: formattedUsername,
            name: displayName,
            avatar: "user-photo.jpg", 
            password: password,
            friends: [],          
            friend_requests: []   
        };

        const { error } = await supabase
            .from('accounts')
            .insert([newAccount]);

        if (error) {
            console.error("[SUPABASE CADASTRO ERRO]", error);
            return { success: false, message: "Erro crítico de persistência ao criar conta." };
        }

        return { 
            success: true, 
            user: { uid: permanentUid, username: formattedUsername, displayName, avatarUrl: "user-photo.jpg", tag: randomId } 
        };
    },

    async loginAccount(username, password) {
        const formattedUsername = username.replace('@', '').toLowerCase().trim();
        
        const { data: account, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('username', formattedUsername)
            .single();

        if (error || !account) {
            const randomId = String(Math.floor(1000 + Math.random() * 9000));
            const permanentUid = `${formattedUsername}_${randomId}`;
            
            const recoveryAccount = {
                uid: permanentUid,
                username: formattedUsername,
                name: formattedUsername,
                avatar: "user-photo.jpg",
                password: password,
                friends: [],
                friend_requests: []
            };

            await supabase.from('accounts').insert([recoveryAccount]);
            return { success: true, user: { uid: permanentUid, username: formattedUsername, displayName: formattedUsername, avatarUrl: "user-photo.jpg", tag: randomId } };
        }

        if (account.password !== password) return { success: false, message: "Senha incorreta!" };

        const parts = account.uid.split('_');
        const tag = parts[parts.length - 1] || "0000";

        return { 
            success: true, 
            user: {
                uid: account.uid,
                username: account.username,
                displayName: account.name,
                avatarUrl: account.avatar,
                tag: tag,
                friends: account.friends || [],
                friendRequests: account.friend_requests || []
            } 
        };
    },

    async updateAccountProfile(uid, newName, newAvatar) {
        const updates = {};
        if (newName) updates.name = newName;
        if (newAvatar) updates.avatar = newAvatar;

        const { data, error } = await supabase
            .from('accounts')
            .update(updates)
            .eq('uid', uid)
            .select()
            .single();

        if (error) {
            console.error("[SUPABASE UPDATE PROFILE ERRO]", error);
            return null;
        }

        bancoDadosVolatil.rooms.forEach(room => {
            const userInRoom = room.users.find(u => u.uid === uid);
            if (userInRoom) {
                if (newName) userInRoom.displayName = newName;
                if (newAvatar) userInRoom.avatarUrl = newAvatar;
            }
        });

        const parts = data.uid.split('_');
        const tag = parts[parts.length - 1] || "0000";

        return {
            uid: data.uid,
            username: data.username,
            displayName: data.name,
            avatarUrl: data.avatar,
            tag: tag
        };
    },

    // ==========================================
    // 2. SISTEMA SOCIAL (AMIGOS)
    // ==========================================
    setUserOnlineStatus(uid, isOnline, socketId = null) {
        bancoDadosVolatil.sessions[uid] = { isOnline, socketId };
    },

    async sendFriendRequest(senderUid, targetUsername, targetTag) {
        const expectedUid = `${targetUsername}_${targetTag}`;
        if (senderUid === expectedUid) return { success: false, message: "Você não pode adicionar a si mesmo." };

        const { data: target } = await supabase.from('accounts').select('*').eq('uid', expectedUid).single();
        if (!target) return { success: false, message: "Usuário não encontrado com essa Tag." };
        
        const targetRequests = target.friend_requests || [];
        const targetFriends = target.friends || [];

        if (targetFriends.includes(senderUid)) return { success: false, message: "Vocês já são amigos!" };
        if (targetRequests.includes(senderUid)) return { success: false, message: "Esse pedido já está pendente." };

        targetRequests.push(senderUid);
        await supabase.from('accounts').update({ friend_requests: targetRequests }).eq('uid', expectedUid);

        return { success: true, message: "Convite enviado com sucesso!", targetUid: expectedUid };
    },

    async respondFriendRequest(myUid, senderUid, action) {
        const { data: me } = await supabase.from('accounts').select('*').eq('uid', myUid).single();
        const { data: sender } = await supabase.from('accounts').select('*').eq('uid', senderUid).single();
        
        if (!me || !sender) return false;

        let myRequests = me.friend_requests || [];
        let myFriends = me.friends || [];
        let senderFriends = sender.friends || [];

        myRequests = myRequests.filter(uid => uid !== senderUid);

        if (action === "accept") {
            if (!myFriends.includes(senderUid)) myFriends.push(senderUid);
            if (!senderFriends.includes(myUid)) senderFriends.push(myUid);
            await supabase.from('accounts').update({ friends: senderFriends }).eq('uid', senderUid);
        }

        await supabase.from('accounts').update({ friend_requests: myRequests, friends: myFriends }).eq('uid', myUid);
        return true;
    },

    async getPopulatedFriendsList(uid) {
        const { data: account } = await supabase.from('accounts').select('friends').eq('uid', uid).single();
        if (!account || !account.friends || account.friends.length === 0) return [];

        const { data: profiles } = await supabase.from('accounts').select('uid, name, username, avatar').in('uid', account.friends);
        if (!profiles) return [];

        return profiles.map(p => {
            const session = bancoDadosVolatil.sessions[p.uid];
            return {
                uid: p.uid,
                displayName: p.name,
                username: p.username,
                avatarUrl: p.avatar,
                status: session && session.isOnline ? "online" : "offline"
            };
        });
    },

    async getPopulatedRequestsList(uid) {
        const { data: account } = await supabase.from('accounts').select('friend_requests').eq('uid', uid).single();
        if (!account || !account.friend_requests || account.friend_requests.length === 0) return [];

        const { data: profiles } = await supabase.from('accounts').select('uid, name, username, avatar').in('uid', account.friend_requests);
        return profiles.map(p => ({
            id: p.uid,
            uid: p.uid,
            displayName: p.name,
            username: p.username
        })) || [];
    },

    // ==========================================
    // 3. OPERAÇÕES DE GERENCIAMENTO DE SALAS
    // ==========================================
    getPublicRoomsList() {
        return bancoDadosVolatil.rooms.map(room => {
            return {
                id: room.id,
                name: room.name,
                type: room.type,
                limit: room.limit,
                currentUsers: room.users.length
            };
        });
    },

    createRoom(roomPayload) {
        const idStr = String(Date.now());
        const room = {
            id: idStr,
            name: roomPayload.name,
            type: roomPayload.type,
            password: roomPayload.password || null,
            limit: roomPayload.limit || 8,
            ownerUid: roomPayload.ownerUid,
            users: []
        };
        bancoDadosVolatil.rooms.push(room);
        bancoDadosVolatil.bannedUsers[idStr] = [];
        return room;
    },

    findRoomById(roomId) {
        return bancoDadosVolatil.rooms.find(r => String(r.id) === String(roomId));
    },

    addUserToRoom(roomId, userProfile) {
        const room = this.findRoomById(roomId);
        if (!room) return { success: false, message: "Esta sala não existe mais." };
        if (room.users.length >= room.limit) return { success: false, message: "A sala está cheia!" };

        const exist = room.users.find(u => u.uid === userProfile.uid);
        if (!exist) {
            room.users.push({
                uid: userProfile.uid,
                username: userProfile.username,
                displayName: userProfile.displayName || userProfile.username,
                avatarUrl: userProfile.avatarUrl,
                socketId: userProfile.socketId,
                isMuted: false,
                isSpeaking: false
            });
        } else {
            exist.socketId = userProfile.socketId;
        }
        return { success: true, room };
    },

    removeUserFromRoom(roomId, uid) {
        const room = this.findRoomById(roomId);
        if (room) {
            room.users = room.users.filter(u => u.uid !== uid);
            if (room.users.length === 0) {
                const index = bancoDadosVolatil.rooms.findIndex(r => String(r.id) === String(roomId));
                if (index !== -1) bancoDadosVolatil.rooms.splice(index, 1);
                return null;
            }
            return room;
        }
        return null;
    },

    removeUserFromAllRooms(socketId) {
        let affectedRoom = null;
        let foundUid = null;

        bancoDadosVolatil.rooms.forEach(room => {
            const user = room.users.find(u => u.socketId === socketId);
            if (user) {
                foundUid = user.uid;
                room.users = room.users.filter(u => u.socketId !== socketId);
                affectedRoom = room;
            }
        });

        const activeUid = Object.keys(bancoDadosVolatil.sessions).find(
            uid => bancoDadosVolatil.sessions[uid].socketId === socketId
        );
        if (activeUid) {
            bancoDadosVolatil.sessions[activeUid].isOnline = false;
            bancoDadosVolatil.sessions[activeUid].socketId = null;
            foundUid = activeUid;
        }

        return { affectedRoom, foundUid };
    }
};

module.exports = BancoController;
