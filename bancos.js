const fs = require('fs');
const path = require('path');

// Caminho onde o arquivo de texto/json que guardará as salas ficará salvo
const arquivoBanco = path.join(__dirname, 'salas.json');

// Função interna para garantir que o arquivo exista
function inicializarBanco() {
    if (!fs.existsSync(arquivoBanco)) {
        fs.writeFileSync(arquivoBanco, JSON.stringify({}), 'utf-8');
    }
}

const BancoDeDados = {
    // Ler todas as salas salvas
    obterTodasSalas: () => {
        inicializarBanco();
        try {
            const dados = fs.readFileSync(arquivoBanco, 'utf-8');
            return JSON.parse(dados);
        } catch (erro) {
            console.error("Erro ao ler o banco de dados, resetando...", erro);
            return {};
        }
    },

    // Salvar uma nova sala ou atualizar uma existente
    salvarSala: (idSala, dadosSala) => {
        inicializarBanco();
        const salas = BancoDeDados.obterTodasSalas();
        
        // Salvamos os dados vitais da sala, mas resetamos a contagem de usuários online 
        // já que quando o servidor liga, ninguém está conectado ainda.
        salas[idSala] = {
            id: dadosSala.id,
            tipo: dadosSala.tipo,
            senha: dadosSala.senha,
            usuarios: [] 
        };

        fs.writeFileSync(arquivoBanco, JSON.stringify(salas, null, 2), 'utf-8');
    },

    // Remover sala do histórico caso queira limpar salas vazias
    deletarSala: (idSala) => {
        inicializarBanco();
        const salas = BancoDeDados.obterTodasSalas();
        if (salas[idSala]) {
            delete salas[idSala];
            fs.writeFileSync(arquivoBanco, JSON.stringify(salas, null, 2), 'utf-8');
        }
    }
};

module.exports = BancoDeDados;
