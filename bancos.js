const fs = require('fs');
const path = require('path');

const arquivoBanco = path.join(__dirname, 'salas.json');

function inicializarBanco() {
    if (!fs.existsSync(arquivoBanco)) {
        fs.writeFileSync(arquivoBanco, JSON.stringify({}), 'utf-8');
    }
}

const BancoDeDados = {
    obterTodasSalas: () => {
        inicializarBanco();
        try {
            return JSON.parse(fs.readFileSync(arquivoBanco, 'utf-8'));
        } catch (e) {
            return {};
        }
    },
    salvarSala: (idSala, dadosSala) => {
        inicializarBanco();
        const salas = BancoDeDados.obterTodasSalas();
        salas[idSala] = { id: dadosSala.id, tipo: dadosSala.tipo, senha: dadosSala.senha, usuarios: [] };
        fs.writeFileSync(arquivoBanco, JSON.stringify(salas, null, 2), 'utf-8');
    }
};

module.exports = BancoDeDados;
