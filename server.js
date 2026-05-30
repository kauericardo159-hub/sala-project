const express = require('express');
const app = express();
const server = require('http').Server(app);

// CORS Dinâmico: Aceita conexões locais (Acode/Termux) e do seu GitHub Pages
const io = require('socket.io')(server, {
    cors: {
        origin: ["https://kauericardo159-hub.github.io", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const BancoDeDados = require('./bancos');
app.use(express.static(__dirname));

const salasExistentes = BancoDeDados.obterTodasSalas();

io.on('connection', (socket) => {
    enviarListaSalas(socket);

    socket.on('criar-sala', ({ nomeSala, tipo, senha }) => {
        const nomeTratado = nomeSala.trim().toLowerCase();
        if (!nomeTratado) return socket.emit('erro', 'Nome inválido.');
        if (salasExistentes[nomeTratado]) return socket.emit('erro', 'Sala já existe.');

        salasExistentes[nomeTratado] = { id: nomeTratado, tipo, senha: tipo === 'privada' ? senha : null, usuarios: [] };
        BancoDeDados.salvarSala(nomeTratado, salasExistentes[nomeTratado]);

        enviarListaSalas(io);
        socket.emit('sala-criada-sucesso', nomeTratado);
    });

    socket.on('tentar-entrar', ({ nomeSala, senha }) => {
        const sala = salasExistentes[nomeSala];
        if (!sala) return socket.emit('erro', 'Sala não encontrada.');
        if (sala.tipo === 'privada' && sala.senha !== senha) return socket.emit('erro', 'Senha incorreta.');
        socket.emit('entrada-autorizada', nomeSala);
    });

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        if (salasExistentes[roomId] && !salasExistentes[roomId].usuarios.includes(userId)) {
            salasExistentes[roomId].usuarios.push(userId);
            enviarListaSalas(io);
        }
        socket.to(roomId).emit('user-connected', userId);

        socket.on('send-message', (msg, username) => {
            io.to(roomId).emit('create-message', msg, username);
        });

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
            if (salasExistentes[roomId]) {
                salasExistentes[roomId].usuarios = salasExistentes[roomId].usuarios.filter(id => id !== userId);
                enviarListaSalas(io);
            }
        });
    });
});

function enviarListaSalas(alvo) {
    const lista = Object.values(salasExistentes).map(s => ({ id: s.id, tipo: s.tipo, participantes: s.usuarios.length }));
    alvo.emit('atualizar-salas', lista);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor ativo na porta ${PORT}`));
