const express = require('express');
const compression = require('compression'); // Compacta os dados trafegados na rede
const app = express();

// Ativa a otimização de compressão antes de servir os arquivos
app.use(compression());
app.use(express.static(__dirname));

const server = require('http').Server(app);

// CORS Otimizado para aceitar conexões locais e de produção do seu GitHub Pages
const io = require('socket.io')(server, {
    cors: {
        origin: ["https://kauericardo159-hub.github.io", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    },
    pipeWebSocket: true // Força maior eficiência no tráfego de WebSockets no Render
});

const BancoDeDados = require('./bancos');

// Carrega o estado inicial das salas salvas no arquivo JSON
const salasExistentes = BancoDeDados.obterTodasSalas() || {};

io.on('connection', (socket) => {
    // Variáveis de escopo do socket para evitar buscas repetidas na CPU
    let salaAtual = null;
    let meuPeerId = null;

    // Envia a lista de canais disponíveis imediatamente ao conectar
    enviarListaSalas(socket);

    // [AÇÃO]: Criar Canais
    socket.on('criar-sala', ({ nomeSala, tipo, senha }) => {
        if (!nomeSala) return socket.emit('erro', 'Nome da sala não pode ser vazio.');
        
        const nomeTratado = nomeSala.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
        if (!nomeTratado) return socket.emit('erro', 'Nome da sala contém caracteres inválidos.');
        if (salasExistentes[nomeTratado]) return socket.emit('erro', 'Esta sala já existe.');

        // Registra a nova estrutura
        salasExistentes[nomeTratado] = {
            id: nomeTratado,
            tipo: tipo,
            senha: tipo === 'privada' ? senha : null,
            usuarios: []
        };

        // Salva na persistência física (bancos.js)
        BancoDeDados.salvarSala(nomeTratado, salasExistentes[nomeTratado]);

        // Sincroniza o lobby global e avisa o criador
        enviarListaSalas(io);
        socket.emit('sala-criada-sucesso', nomeTratado);
    });

    // [AÇÃO]: Validar Credenciais de Entrada
    socket.on('tentar-entrar', ({ nomeSala, senha }) => {
        const sala = salasExistentes[nomeSala];
        if (!sala) return socket.emit('erro', 'A sala procurada não existe.');
        if (sala.tipo === 'privada' && sala.senha !== senha) return socket.emit('erro', 'Senha de segurança incorreta.');
        
        socket.emit('entrada-autorizada', nomeSala);
    });

    // [AÇÃO]: Conexão e sincronização interna da Call/Chat (WebRTC)
    socket.on('join-room', (roomId, userId) => {
        if (!salasExistentes[roomId] || !userId) return;

        salaAtual = roomId;
        meuPeerId = userId;

        socket.join(roomId);

        // Evita duplicar o mesmo usuário no array
        if (!salasExistentes[roomId].usuarios.includes(userId)) {
            salasExistentes[roomId].usuarios.push(userId);
        }

        // Atualiza os contadores numéricos no Lobby global
        enviarListaSalas(io);

        // Avisa os outros clientes da sala para abrirem o fluxo WebRTC (Voz/Vídeo)
        socket.to(roomId).emit('user-connected', userId);
    });

    // [AÇÃO OTIMIZADA]: Chat de Texto Isolado (Evita vazamento de memória e loops)
    socket.on('send-message', (msg, username) => {
        if (!salaAtual || !msg.trim()) return;
        
        // Limita o tamanho do texto para evitar travamentos por pacotes gigantes
        const mensagemSegura = msg.slice(0, 1000); 
        const nomeSeguro = username ? username.slice(0, 25) : "Anônimo";

        io.to(salaAtual).emit('create-message', mensagemSegura, nomeSeguro);
    });

    // [AÇÃO OTIMIZADA]: Desconexão Inteligente e Limpeza de Lixo da Memória
    socket.on('disconnect', () => {
        if (!salaAtual || !meuPeerId) return;

        // Avisa a sala para fechar a tag <video> do usuário que saiu
        socket.to(salaAtual).emit('user-disconnected', meuPeerId);

        if (salasExistentes[salaAtual]) {
            // Remove o usuário atual da lista
            salasExistentes[salaAtual].usuarios = salasExistentes[salaAtual].usuarios.filter(id => id !== meuPeerId);
            
            // Otimização Opcional: Se quiser que salas vazias sumam do mapa para poupar memória,
            // descomente a linha abaixo:
            // if (salasExistentes[salaAtual].usuarios.length === 0 && salasExistentes[salaAtual].tipo === 'publica') delete salasExistentes[salaAtual];

            enviarListaSalas(io);
        }
    });
});

// Despacha as salas filtrando os dados sensíveis (senhas nunca viajam na rede à toa)
function enviarListaSalas(alvo) {
    const listaLimpa = Object.values(salasExistentes).map(s => ({
        id: s.id,
        tipo: s.tipo,
        participantes: s.usuarios ? s.usuarios.length : 0
    }));
    alvo.emit('atualizar-salas', listaLimpa);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor otimizado ativo na porta ${PORT}`));
