const express = require('express');
const compression = require('compression');
const crypto = require('crypto'); // Biblioteca nativa do Node para criação de hashes e IDs únicos
const app = express();

// Otimizações de rede e entrega de arquivos estáticos do front-end
app.use(compression());
app.use(express.static(__dirname));

const server = require('http').Server(app);
const io = require('socket.io')(server, {
    cors: {
        origin: ["https://kauericardo159-hub.github.io", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Importação e inicialização dos dados salvos no banco local
const BancoDeDados = require('./bancos');
const salasExistentes = BancoDeDados.obterTodasSalas() || {};
const usuariosCadastrados = BancoDeDados.obterTodosUsuarios() || {};

io.on('connection', (socket) => {
    let salaAtual = null;
    let meuPeerId = null;

    // ==========================================================================
    // SISTEMA DE CONTAS E AUTENTICAÇÃO
    // ==========================================================================

    // Evento de Registro / Criação de nova conta
    socket.on('cadastrar-usuario', ({ username, senha }) => {
        // Remove caracteres especiais para gerar uma tag @ limpa de segurança
        const userTratado = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        
        if (!userTratado || userTratado.length < 3) {
            return socket.emit('erro', 'Nome de usuário inválido. Use no mínimo 3 caracteres (letras, números ou linha de sublinhado _).');
        }
        if (!senha || senha.length < 4) {
            return socket.emit('erro', 'A senha precisa conter no mínimo 4 caracteres.');
        }
        if (usuariosCadastrados[userTratado]) {
            return socket.emit('erro', 'Este nome de usuário (@user) já está em uso.');
        }

        // Criação da identidade única imutável e permanente do usuário
        const novoUsuario = {
            id: 'id_' + crypto.randomBytes(4).toString('hex'), // Exemplo: id_a3f2b91c
            senha: senha
        };

        // Salva na memória do servidor e persiste no arquivo usuarios.json
        usuariosCadastrados[userTratado] = { id: novoUsuario.id, username: username.trim(), senha: senha };
        BancoDeDados.salvarUsuario(username.trim(), novoUsuario);

        socket.emit('cadastro-sucesso', { username: username.trim(), id: novoUsuario.id });
    });

    // Evento de Login de usuário existente
    socket.on('login-usuario', ({ username, senha }) => {
        const userTratado = username.trim().toLowerCase();
        const conta = usuariosCadastrados[userTratado];

        if (!conta || conta.senha !== senha) {
            return socket.emit('erro', 'Credenciais inválidas. Usuário incorreto ou senha incorreta.');
        }

        // Retorna sucesso e envia os dados consolidados da conta imutável
        socket.emit('login-sucesso', { username: conta.username, id: conta.id });
    });

    // ==========================================================================
    // SISTEMA DE GERENCIAMENTO DE CANAIS (SALAS)
    // ==========================================================================

    socket.on('pedir-salas', () => {
        enviarListaSalas(socket);
    });

    socket.on('criar-sala', ({ nomeSala, tipo, senha }) => {
        if (!nomeSala) return socket.emit('erro', 'O nome da sala não pode ser nulo.');
        
        // Normaliza o nome da sala removendo caracteres inadequados para URLs
        const nomeTratado = nomeSala.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
        
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
    // PROTOCOLO WEB RENEGOCIATION (CALL DE VOZ E CHAT EM GRUPO)
    // ==========================================================================

    socket.on('join-room', (roomId, userId) => {
        if (!salasExistentes[roomId] || !userId) return;

        salaAtual = roomId;
        meuPeerId = userId;

        socket.join(roomId);

        // Insere o identificador P2P do membro na lista ativa da sala se não estiver lá
        if (!salasExistentes[roomId].usuarios.includes(userId)) {
            salasExistentes[roomId].usuarios.push(userId);
        }

        // Atualiza os contadores numéricos de pessoas nas salas do lobby de todos
        enviarListaSalas(io);

        // Avisa os outros integrantes da sala para abrirem um canal de áudio com ele
        socket.to(roomId).emit('user-connected', userId);
    });

    socket.on('send-message', (msg, username) => {
        if (!salaAtual || !msg.trim()) return;
        // Distribui a mensagem higienizada para todos os conectados na sala atual
        io.to(salaAtual).emit('create-message', msg.slice(0, 1000), username.slice(0, 30));
    });

    // Evento de desconexão (Sair da sala ou fechar a aba)
    socket.on('disconnect', () => {
        if (!salaAtual || !meuPeerId) return;

        // Avisa os remotos para cortarem a reprodução de áudio deste ID PeerJS
        socket.to(salaAtual).emit('user-disconnected', meuPeerId);

        if (salasExistentes[salaAtual]) {
            // Filtra e remove o membro da lista ativa da sala
            salasExistentes[salaAtual].usuarios = salasExistentes[salaAtual].usuarios.filter(id => id !== meuPeerId);
            
            // AUTO-LIMPEZA CRÍTICA: Se a sala ficou com 0 usuários, deleta da memória
            if (salasExistentes[salaAtual].usuarios.length === 0) {
                delete salasExistentes[salaAtual];
            }

            // Repassa a lista atualizada de salas vivas para o lobby de todo mundo
            enviarListaSalas(io);
        }
    });
});

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
