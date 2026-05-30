const fs = require('fs');
const path = require('path');

// Caminhos absolutos para os arquivos de persistência de dados
const arquivoSalas = path.join(__dirname, 'salas.json');
const arquivoUsuarios = path.join(__dirname, 'usuarios.json');

/**
 * Garante que o arquivo JSON exista na raiz, inicializando-o como um objeto vazio caso não exista
 * @param {string} arquivo - Caminho completo do arquivo
 */
function inicializarBanco(arquivo) {
    if (!fs.existsSync(arquivo)) {
        fs.writeFileSync(arquivo, JSON.stringify({}), 'utf-8');
    }
}

const BancoDeDados = {
    // ==========================================================================
    // SEÇÃO DE GERENCIAMENTO DE USUÁRIOS (SALVAMENTO PERMANENTE)
    // ==========================================================================
    
    /**
     * Retorna todas as contas registradas no sistema
     */
    obterTodosUsuarios: () => {
        inicializarBanco(arquivoUsuarios);
        try { 
            return JSON.parse(fs.readFileSync(arquivoUsuarios, 'utf-8')); 
        } catch (e) { 
            return {}; 
        }
    },

    /**
     * Registra ou atualiza um usuário permanentemente no arquivo usuarios.json
     */
    salvarUsuario: (username, dadosUsuario) => {
        inicializarBanco(arquivoUsuarios);
        const usuarios = BancoDeDados.obterTodosUsuarios();
        
        // Salva indexado pela versão em minúsculo para garantir exclusividade de login
        usuarios[username.toLowerCase()] = {
            id: dadosUsuario.id,
            username: username, // Mantém a grafia original com maiúsculas/minúsculas para exibição
            senha: dadosUsuario.senha
        };
        
        fs.writeFileSync(arquivoUsuarios, JSON.stringify(usuarios, null, 2), 'utf-8');
    },

    // ==========================================================================
    // SEÇÃO DE GERENCIAMENTO DE SALAS
    // ==========================================================================
    
    /**
     * Retorna o estado atualizado das salas na memória física
     */
    obterTodasSalas: () => {
        inicializarBanco(arquivoSalas);
        try { 
            return JSON.parse(fs.readFileSync(arquivoSalas, 'utf-8')); 
        } catch (e) { 
            return {}; 
        }
    },

    /**
     * Registra uma nova sala no repositório local
     */
    salvarSala: (idSala, dadosSala) => {
        inicializarBanco(arquivoSalas);
        const salas = BancoDeDados.obterTodasSalas();
        
        salas[idSala] = {
            id: dadosSala.id,
            tipo: dadosSala.tipo,
            senha: dadosSala.senha,
            usuarios: [] // Inicializa sem participantes fixados no JSON
        };
        
        fs.writeFileSync(arquivoSalas, JSON.stringify(salas, null, 2), 'utf-8');
    }
};

module.exports = BancoDeDados;
