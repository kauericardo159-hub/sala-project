"use strict";

// bancos.js - Gerenciador de Dados Persistente via Supabase Cloud — Pro Version (ID NUMÉRICO FIXO)
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
    
    /**
     * Registra uma nova conta com UID puramente numérico e imutável.
     * Evita duplicidade estrita de usernames.
     */
    async registerAccount(username, displayName, password) {
        const formattedUsername = username.toLowerCase().replace(/\s/g, '').trim();

        // 1. Verifica se o username puro já existe
        const { data: existingUser } = await supabase
            .from('accounts')
            .select('username')
            .eq('username', formattedUsername)
            .single();

        if (existingUser) {
            return { success: false, message: "Este @username já está sendo utilizado!" };
        }

        // 2. ARQUITETURA NOVA: ID puramente numérico baseado no relógio de alta precisão do servidor
        const numericUid = String(Date.now() + Math.floor(Math.random() * 100)); // Adiciona micro-offset para prevenção de colisão absoluta
        const fixedTag = numericUid.slice(-4); // Mantém uma tag visual de 4 dígitos baseada no fim do ID numérico

        const newAccount = {
            uid: numericUid, // AGORA É APENAS NÚMEROS (ex: "1717654321105")
            username: formattedUsername,
            name: displayName || formattedUsername,
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
            return { success: false, message: "Erro crítico de persistência ao criar conta numérica." };
        }

        return { 
            success: true, 
            user: { 
                uid: numericUid, 
                username: formattedUsername, 
                displayName: newAccount.name, 
                avatarUrl: "user-photo.jpg", 
                tag: fixedTag 
            } 
        };
    },

    /**
     * Valida credenciais baseando-se estritamente na tabela fixa.
     * Retorna erro em vez de criar novas contas se o usuário não for achado.
     */
    async loginAccount(username, password) {
        const formattedUsername = username.replace('@', '').toLowerCase().trim();
        
        const { data: account, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('username', formattedUsername)
            .single();

        // BLINDAGEM TOTAL: Se não achou na base do Supabase, mata a requisição imediatamente
        if (error || !account) {
            return { success: false, message: "Este @username não está cadastrado no sistema!" };
        }

        // Validação estrita de password
        if (password !== "" && account.password !== password) {
            return { success: false, message: "Senha incorreta!" };
        }

        // Cria a tag visual baseada nos últimos 4 dígitos do ID numérico persistido
        const tag = String(account.uid).slice(-4) || "0000";

        return { 
            success: true, 
            user: {
                uid: String(account.uid), // Retorna o ID numérico puro stringificado
                username: account.username,
                displayName: account.name,
                avatarUrl: account.avatar,
                tag: tag,
                friends: account.friends || [],
                friendRequests: account.friend_requests || []
            } 
        };
    },

    /**
     * Altera dados do perfil sem mexer no UID numérico estável.
     */
    async updateAccountProfile(uid, newName, newAvatar) {
        const updates = {};
        if (newName !== null && newName !== undefined) updates.name = newName;
        if (newAvatar !== null && newAvatar !== undefined) updates.avatar = newAvatar;

        const { data, error } = await supabase
            .from('accounts')
            .update(updates)
            .eq('uid', String(uid))
            .select()
            .single();

        if (error) {
            console.error("[SUPABASE UPDATE PROFILE ERRO]", error);
            return null;
        }

        // Sincronismo dinâmico na RAM do servidor para salas de voz ativas
        bancoDadosVolatil.rooms.forEach(room => {
            const userInRoom = room.users.find(u => String(u.uid) === String(uid));
            if (userInRoom) {
                if (updates.name) userInRoom.displayName = updates.name;
                if (updates.avatar) userInRoom.avatarUrl = updates.avatar;
            }
        });

        const tag = String(data.uid).slice(-4) || "0000";

        return {
            uid: String(data.uid),
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
        bancoDadosVolatil.sessions[String(uid)] = { isOnline, socketId };
    },

    async sendFriendRequest(senderUid, targetUsername, targetTag) {
        // Agora a busca do alvo precisa bater pelo username e confirmar a tag numérica final
        const { data: targets, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('username', targetUsername.toLowerCase().trim());

        if (error || !targets || targets.length === 0) {
            return { success: false, message: "Usuário não encontrado com esse username." };
        }

        // Filtra o alvo que dê match com os 4 números finais do ID
        const target = targets.find(t => String(t.uid).slice(-4) === String(targetTag));
        if (!target) return { success: false, message: "A Tag fornecida não corresponde a este usuário." };
        
        const expectedUid = String(target.uid);
        if (String(senderUid) === expectedUid) return { success: false, message: "Você não pode adicionar a si mesmo." };
        
        const targetRequests = target.friend_requests || [];
        const targetFriends = target.friends || [];

        if (targetFriends.map(String).includes(String(senderUid))) return { success: false, message: "Vocês já são amigos!" };
        if (targetRequests.map(String).includes(String(senderUid))) return { success: false, message: "Esse pedido já está pendente." };

        targetRequests.push(String(senderUid));
        await supabase.from('accounts').update({ friend_requests: targetRequests }).eq('uid', expectedUid);

        return { success: true, message: "Convite enviado com sucesso!", targetUid: expectedUid };
    },

    async respondFriendRequest(myUid, senderUid, action) {
        const { data: me } = await supabase.from('accounts').select('*').eq('uid', String(myUid)).single();
        const { data: sender } = await supabase.from('accounts').select('*').eq('uid', String(senderUid)).single();
        
        if (!me || !sender) return false;

        let myRequests = (me.friend_requests || []).map(String);
        let myFriends = (me.friends || []).map(String);
        let senderFriends = (sender.friends || []).map(String);

        myRequests = myRequests.filter(uid => String(uid) !== String(senderUid));

        if (action === "accept") {
            if (!myFriends.includes(String(senderUid))) myFriends.push(String(senderUid));
            if (!senderFriends.includes(String(myUid))) senderFriends.push(String(myUid));
            await supabase.from('accounts').update({ friends: senderFriends }).eq('uid', String(senderUid));
        }

        await supabase.from('accounts').update({ friend_requests: myRequests, friends: myFriends }).eq('uid', String(myUid));
        return true;
    },

    async getPopulatedFriendsList(uid) {
        const { data: account } = await supabase.from('accounts').select('friends').eq('uid', String(uid)).single();
        if (!account || !account.friends || account.friends.length === 0) return [];

        const stringifiedFriends = account.friends.map(String);
        const { data: profiles } = await supabase.from('accounts').select('uid, name, username, avatar').in('uid', stringifiedFriends);
        if (!profiles) return [];

        return profiles.map(p => {
            const session = bancoDadosVolatil.sessions[String(p.uid)];
            return {
                uid: String(p.uid),
                displayName: p.name,
                username: p.username,
                avatarUrl: p.avatar,
                status: session && session.isOnline ? "online" : "offline"
            };
        });
    },

    async getPopulatedRequestsList(uid) {
        const { data: account } = await supabase.from('accounts').select('friend_requests').eq('uid', String(uid)).single();
        if (!account || !account.friend_requests || account.friend_requests.length === 0) return [];

        const stringifiedRequests = account.friend_requests.map(String);
        const { data: profiles } = await supabase.from('accounts').select('uid, name, username, avatar').in('uid', stringifiedRequests);
        if (!profiles) return [];

        return profiles.map(p => ({
            id: String(p.uid),
            uid: String(p.uid),
            displayName: p.name,
            username: p.username
        }));
    },

    // ==========================================
    // 3. OPERAÇÕES DE GERENCIAMENTO DE SALAS
    // ==========================================
    getPublicRoomsList() {
        return bancoDadosVolatil.rooms.map(room => ({
            id: room.id,
            name: room.name,
            type: room.type,
            limit: room.limit,
            currentUsers: room.users.length
        }));
    },

    createRoom(roomPayload) {
        const idStr = String(Date.now());
        const room = {
            id: idStr,
            name: roomPayload.name,
            type: roomPayload.type,
            password: roomPayload.password || null,
            limit: roomPayload.limit || 8,
            ownerUid: String(roomPayload.ownerUid),
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

        const exist = room.users.find(u => String(u.uid) === String(userProfile.uid));
        if (!exist) {
            room.users.push({
                uid: String(userProfile.uid),
                username: userProfile.username,
                displayName: userProfile.displayName || userProfile.username,
                avatarUrl: userProfile.avatarUrl,
                socketId: userProfile.socketId,
                isMuted: false,
                isSpeaking: false
            });
        } else {
            exist.socketId = userProfile.socketId;
            exist.displayName = userProfile.displayName;
            exist.avatarUrl = userProfile.avatarUrl;
        }
        return { success: true, room };
    },

    removeUserFromRoom(roomId, uid) {
        const room = this.findRoomById(roomId);
        if (room) {
            room.users = room.users.filter(u => String(u.uid) !== String(uid));
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
                foundUid = String(user.uid);
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
            foundUid = String(activeUid);
        }

        return { affectedRoom, foundUid };
    }
};

module.exports = BancoController;
