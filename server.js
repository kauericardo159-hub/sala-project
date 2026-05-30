const express = require('express');
const compression = require('compression');
const crypto = require('crypto'); // Biblioteca nativa do Node para criação de hashes e IDs únicos
const fs = require('fs');
const path = require('path');
const app = express();

// Otimizações de rede e entrega de arquivos estáticos do front-end
app.use(compression());
app.use(express.static(__dirname));

const server = require('http').Server(app);
const io = require('socket.io')(server, {
    maxHttpBufferSize: 5e7, // PROTEÇÃO: Eleva o limite máximo do socket para 50MB (suporta avatares Base64 grandes)
    cors: {
        // Origens travadas estritamente para o seu ecossistema de deploy, GitHub e testes locais
        origin: [
            "https://sala-project.onrender.com", 
            "https://kauericardo159-hub.github.io", 
            "http://localhost:3000"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Importação e inicialização dos dados salvos no banco local
const BancoDeDados = require('./bancos');
const salasExistentes = BancoDeDados.obterTodasSalas() || {};
const usuariosCadastrados = BancoDeDados.obterTodosUsuarios() || {};

// Memória volátil para rastrear em tempo real quem está ATIVO/LOGADO no site agora
const usuariosOnlineGlobais = new Set();

io.on('connection', (socket) => {
    let salaAtual = null;
    let meuPeerId = null;
    let meuUsuarioLogado = null;

    // ==========================================================================
    // SISTEMA DE CONTAS E AUTENTICAÇÃO
    // ==========================================================================

    // Evento de Registro / Criação de nova conta
    socket.on('cadastrar-usuario', ({ username, senha }) => {
        if (!username || !senha) return socket.emit('erro', 'Campos incompletos.');
        
        // Remove caracteres especiais para gerar uma tag @ limpa de segurança
        const userTratado = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        
        if (userTratado.length < 3) {
            return socket.emit('erro', 'Nome de usuário inválido. Use no mínimo 3 caracteres (letras, números ou _).');
        }
        if (senha.length < 4) {
            return socket.emit('erro', 'A senha precisa conter no mínimo 4 caracteres.');
        }
        if (usuariosCadastrados[userTratado]) {
            return socket.emit('erro', 'Este nome de usuário (@user) já está em uso.');
        }

        // Criação da identidade única imutável e permanente do usuário
        const novoId = 'id_' + crypto.randomBytes(4).toString('hex'); // Exemplo: id_a3f2b91c

        // Sincronização exata da chave tratada com a persistência do banco (Com avatar padrão)
        usuariosCadastrados[userTratado] = { 
            id: novoId, 
            username: username.trim(), 
            senha: senha,
            avatar: "avatar1" 
        };
        
        // Persiste fisicamente através do modulo de banco local
        BancoDeDados.salvarUsuario(userTratado, { id: novoId, senha: senha, avatar: "avatar1" });

        socket.emit('cadastro-sucesso', { username: username.trim(), id: novoId });
        
        // Notifica a rede para incluir o novo usuário na listagem (como offline inicialmente)
        notificarUsuariosGlobaisMapeados();
    });

    // Evento de Login de usuário existente (Manual ou Automático via Cookie/Storage)
    socket.on('login-usuario', ({ username, senha }) => {
        if (!username || !senha) return socket.emit('erro', 'Preencha todos os campos.');
        
        const userTratado = username.trim().toLowerCase();
        const conta = usuariosCadastrados[userTratado];

        if (!conta || conta.senha !== senha) {
            return socket.emit('erro', 'Credenciais inválidas. Usuário incorreto ou senha incorreta.');
        }

        // Vincula o nome de usuário ao socket desta conexão para rastreamento de presença online
        meuUsuarioLogado = conta.username || username.trim();
        usuariosOnlineGlobais.add(meuUsuarioLogado);

        // Retorna sucesso e envia os dados consolidados da conta imutável
        socket.emit('login-sucesso', { 
            username: meuUsuarioLogado, 
            id: conta.id,
            avatar: conta.avatar || "avatar1"
        });

        // Alerta todos os componentes user-explorer.js sobre a mudança de status
        notificarUsuariosOnlineGlobais();
        notificarUsuariosGlobaisMapeados();
    });

    // ==========================================================================
    // ESCUTA DE LISTAGEM RICA (ONLINE + OFFLINE COMBINADOS)
    // ==========================================================================
    socket.on('pedir-usuarios-globais', () => {
        // Envia a lista mapeada especificamente para quem solicitou
        socket.emit('atualizar-usuarios-globais', obterListaMapeadaOnlineOffline());
    });

    // ==========================================================================
    // SISTEMA DE ATUALIZAÇÃO E SALVAMENTO DE PERFIL (SAVE-CONTA.JS / PERFIL.JS)
    // ==========================================================================
    socket.on('atualizar-foto-usuario', (dados) => {
        if (!dados || !dados.username) return;

        const userTratado = dados.username.toLowerCase();
        
        // Verifica se a conta existe na memória do servidor
        if (usuariosCadastrados[userTratado]) {
            // Atualiza as propriedades sem corromper ou expor a senha existente
            usuariosCadastrados[userTratado].avatar = dados.avatar;
            if (dados.id) usuariosCadastrados[userTratado].id = dados.id;

            // CORREÇÃO ASSÍNCRONA RESILIENTE: Impede gargalos no Render causados por arquivos pesados
            fs.writeFile(
                path.join(__dirname, 'usuarios.json'), 
                JSON.stringify(usuariosCadastrados, null, 2), 
                'utf-8',
                (err) => {
                    if (err) {
                        console.error("🔴 Falha ao gravar usuarios.json de forma assíncrona:", err);
                        return socket.emit('erro', 'Não foi possível salvar as alterações no banco remoto.');
                    }

                    // Devolve uma confirmação de gravação limpa com o avatar atualizado para sincronização de cache
                    io.emit('foto-atualizada-sucesso', { 
                        username: usuariosCadastrados[userTratado].username,
                        avatar: usuariosCadastrados[userTratado].avatar 
                    });
                    
                    // Repassa uma ordem de recarregamento para manter avatares sincronizados no lobby e chat
                    io.emit('atualizar-salas');
                    notificarUsuariosOnlineGlobais();
                    notificarUsuariosGlobaisMapeados();
                }
            );
        }
    });

    // ==========================================================================
    // SISTEMA DE GERENCIAMENTO DE CANAIS (SALAS)
    // ==========================================================================

    socket.on('pedir-salas', () => {
        enviarListaSalas(socket);
        // Aproveita o gatilho para atualizar a aba de contatos ativos do explorer se necessário
        socket.emit('atualizar-usuarios-online', Array.from(usuariosOnlineGlobais));
    });

    socket.on('criar-sala', ({ nomeSala, tipo, senha }) => {
        if (!nomeSala) return socket.emit('erro', 'O nome da sala não pode ser nulo.');
        
        // Normaliza o nome da sala removendo caracteres inadequados para URLs
        const nomeTratado = nomeSala.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
        
        if (!nomeTratado) return socket.emit('erro', 'Nome inválido para criação de sala.');
        if (salasExistentes[nomeTratado]) {
            return socket.emit('erro', 'Já existe um canal ativo com este nome.');
        }

        // Registra a estrutura da sala na memória e no banco
        salasExistentes[nomeTratado] = {
            id: nomeTratado,
            tipo: tipo,
            senha: tipo === 'privada' ? senha : null,
            usuarios: []
        };
        
        // Otimização: Garante salvamento limpo no JSON sem acumular usuários fantasmas antigos
        BancoDeDados.salvarSala(nomeTratado, salasExistentes[nomeTratado]);
        
        // Avisa a todos os clientes conectados sobre o novo canal disponível
        enviarListaSalas(io);
        socket.emit('sala-criada-sucesso', nomeTratado);
    });

    socket.on('tentar-entrar', ({ nomeSala, senha }) => {
        const sala = salasExistentes[nomeSala];
        if (!sala) return socket.emit('erro', 'O canal solicitado não existe mais.');
        if (sala.tipo === 'privada' && sala.senha !== senha) {
            return socket.emit('erro', 'Senha de acesso incorreta para este canal privado.');
        }
        
        socket.emit('entrada-autorizada', nomeSala);
    });

    // ==========================================================================
    // PROTOCOLO CALL DE VOZ E CHAT EM GRUPO / PRIVADO (DM)
    // ==========================================================================

    socket.on('join-room', (roomId, userId) => {
        if (!roomId || !userId) return;

        // Limpeza preventiva se o usuário alternar entre canais rápidos
        if (salaAtual && salaAtual !== roomId) {
            removerUsuarioDeSala(salaAtual, meuPeerId);
        }

        salaAtual = roomId;
        meuPeerId = userId;

        socket.join(roomId);

        // SUPORTE HÍBRIDO: Se for um canal de voz real cadastrado, gerencia os participantes. 
        // Se for sala dinâmica de DM de texto, ignora o bloco de áudio mas permite o join acima.
        if (salasExistentes[roomId]) {
            if (!salasExistentes[roomId].usuarios.includes(userId)) {
                salasExistentes[roomId].usuarios.push(userId);
            }
            // Atualiza os contadores numéricos de pessoas nas salas do lobby de todos
            enviarListaSalas(io);
            // Avisa os outros integrantes da sala para abrirem um canal de áudio P2P
            socket.to(roomId).emit('user-connected', userId);
        }
    });

    socket.on('send-message', (msg, username) => {
        if (!salaAtual || !msg || !msg.trim() || !username) return;
        
        // Distribui a mensagem higienizada para todos os conectados na sala/DM atual
        io.to(salaAtual).emit('create-message', msg.slice(0, 1000), username.slice(0, 30));
    });

    // Evento de desconexão (Sair da sala, trocar de aba ou deslogar)
    socket.on('disconnect', () => {
        // 1. Limpeza do painel de conferência de voz e canais de texto
        if (salaAtual && meuPeerId) {
            removerUsuarioDeSala(salaAtual, meuPeerId);
        }

        // 2. Remove o usuário da lista de presença global online
        if (meuUsuarioLogado) {
            usuariosOnlineGlobais.delete(meuUsuarioLogado);
            notificarUsuariosOnlineGlobais();
            notificarUsuariosGlobaisMapeados(); // Garante que a bolinha dele mude para cinza para todos instantaneamente
        }
    });
});

/**
 * Despacha em tempo real para todos os navegadores a lista antiga de strings online (Legado/Retrocompatibilidade)
 */
function notificarUsuariosOnlineGlobais() {
    io.emit('atualizar-usuarios-online', Array.from(usuariosOnlineGlobais));
}

/**
 * Puxa as contas registradas e mapeia o estado atual de conexão de cada uma delas
 * @returns {Array} Coleção contendo objetos { username, online }
 */
function obtenerListaMapeadaOnlineOffline() {
    // Puxa o estado atual dos usuários salvos fisicamente
    const contasCadastradas = BancoDeDados.obterTodosUsuarios() || {};
    
    return Object.values(contasCadastradas).map(conta => {
        // Confere se o nome original salvo possui correspondência no Set de usuários ativos
        const estaOnline = usuariosOnlineGlobais.has(conta.username);
        return {
            username: conta.username,
            online: estaOnline
        };
    });
}

/**
 * Faz um broadcast da lista rica mista (Online/Offline) para todos os clientes conectados
 */
function notificarUsuariosGlobaisMapeados() {
    io.emit('atualizar-usuarios-globais', obtenerListaMapeadaOnlineOffline());
}

/**
 * Remove cirurgicamente um usuário de uma sala e executa auto-limpeza se ela esvaziar
 */
function removerUsuarioDeSala(roomId, userId) {
    if (!salasExistentes[roomId]) return;

    // Avisa os remotos para cortarem a reprodução de áudio deste ID PeerJS
    io.to(roomId).emit('user-disconnected', userId);

    // Filtra e remove o membro da lista ativa da sala
    salasExistentes[roomId].usuarios = salasExistentes[roomId].usuarios.filter(id => id !== userId);
    
    // AUTO-LIMPEZA CRÍTICA: Se a sala ficou com 0 usuários, deleta da memória de canais ativos
    if (salasExistentes[roomId].usuarios.length === 0) {
        delete salasExistentes[roomId];
    }

    // Repassa a lista atualizada de salas vivas para o lobby de todo mundo
    enviarListaSalas(io);
}

/**
 * Filtra as informações sensíveis de senhas das salas antes de enviar para o cliente
 * @param {object} alvo - Instância de destino (socket individual ou io global)
 */
function enviarListaSalas(alvo) {
    const listaLimpa = Object.values(salasExistentes).map(s => ({
        id: s.id,
        tipo: s.tipo,
        participantes: s.usuarios.length
    }));
    alvo.emit('atualizar-salas', listaLimpa);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Motor central rodando perfeitamente na porta ${PORT}`));
