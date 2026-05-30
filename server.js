const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

// Importa o nosso novo sistema de banco de dados baseado em arquivo
const BancoDeDados = require('./bancos');

// Express serve os arquivos da raiz (index.html, style.css)
app.use(express.static(__dirname));

// Carrega as salas persistentes assim que o servidor inicia
const salasExistentes = BancoDeDados.obterTodasSalas();

io.on('connection', (socket) => {
    
    // Envia o estado atual das salas para o usuário que acabou de conectar
    enviarListaSalas(socket);

    // Evento para criar salas
    socket.on('criar-sala', ({ nomeSala, tipo, senha }) => {
        const nomeTratado = nomeSala.trim().toLowerCase();
        
        if (!nomeTratado) return socket.emit('erro', 'Nome da sala é obrigatório.');
        if (salasExistentes[nomeTratado]) return socket.emit('erro', 'Esta sala já existe.');

        // 1. Atualiza na memória do servidor rodando
        salasExistentes[nomeTratado] = {
            id: nomeTratado,
            tipo: tipo,
            senha: tipo === 'privada' ? senha : null,
            usuarios: []
        };

        // 2. Grava no banco de dados (salas.json) para nunca perder
        BancoDeDados.salvarSala(nomeTratado, salasExistentes[nomeTratado]);

        // 3. Atualiza todo mundo e avisa o criador
        enviarListaSalas(io);
        socket.emit('sala-criada-sucesso', nomeTratado);
    });

    // Validação de entrada de sala (Pública ou Protegida por Senha)
    socket.on('tentar-entrar', ({ nomeSala, senha }) => {
        const sala = salasExistentes[nomeSala];
        
        if (!sala) return socket.emit('erro', 'Esta sala não existe mais.');
        if (sala.tipo === 'privada' && sala.senha !== senha) return socket.emit('erro', 'Senha incorreta!');
        
        socket.emit('entrada-autorizada', nomeSala);
    });

    // Conexão interna da Sala (Transmissão de texto e IDs da Call)
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        
        if (salasExistentes[roomId]) {
            if (!salasExistentes[roomId].usuarios.includes(userId)) {
                salasExistentes[roomId].usuarios.push(userId);
            }
            enviarListaSalas(io); // Atualiza os contadores de pessoas online no lobby
        }

        // Avisa a sala que um novo integrante chegou para o WebRTC agir
        socket.to(roomId).emit('user-connected', userId);

        // Chat de Texto centralizado
        socket.on('send-message', (msg, username) => {
            io.to(roomId).emit('create-message', msg, username);
        });

        // Evento de Desconexão limpa
        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
            
            if (salasExistentes[roomId]) {
                salasExistentes[roomId].usuarios = salasExistentes[roomId].usuarios.filter(id => id !== userId);
                enviarListaSalas(io);
            }
        });
    });
});

// Função otimizada para despachar as salas ocultando as senhas por privacidade
function enviarListaSalas(alvo) {
    const listaLimpa = Object.values(salasExistentes).map(s => ({
        id: s.id,
        tipo: s.tipo,
        participantes: s.usuarios ? s.usuarios.length : 0
    }));
    alvo.emit('atualizar-salas', listaLimpa);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor rodando perfeitamente na porta ${PORT}`));
