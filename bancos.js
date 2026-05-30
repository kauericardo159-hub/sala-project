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
        try {
            fs.writeFileSync(arquivo, JSON.stringify({}, null, 2), 'utf-8');
        } catch (erro) {
            console.error(`🔴 Erro crítico ao criar o arquivo físico de banco: ${arquivo}`, erro);
        }
    }
}

// Inicializa os arquivos uma única vez ao rodar o servidor, poupando processamento de I/O
inicializarBanco(arquivoUsuarios);
inicializarBanco(arquivoSalas);

const BancoDeDados = {
    // ==========================================================================
    // SEÇÃO DE GERENCIAMENTO DE USUÁRIOS
    // ==========================================================================
    
    /**
     * Retorna todas as contas registradas no sistema (Leitura rápida)
     */
    obterTodosUsuarios: () => {
        try { 
            const conteudo = fs.readFileSync(arquivoUsuarios, 'utf-8');
            return JSON.parse(conteudo) || {}; 
        } catch (e) { 
            console.warn("⚠️ Falha na leitura de salas.json, redefinindo cache local.");
            return {}; 
        }
    },

    /**
     * Registra ou atualiza um usuário permanentemente de forma ASSÍNCRONA no arquivo usuarios.json
     */
    salvarUsuario: (userTratado, dadosUsuario) => {
        const usuarios = BancoDeDados.obterTodosUsuarios();
        
        // Mantém as propriedades antigas (como senha) caso seja apenas uma atualização parcial de avatar/ID
        const usuarioExistente = usuarios[userTratado] || {};

        // Sincronia total de chaves com o padrão do server.js e suporte a avatares (String ou Base64)
        usuarios[userTratado] = {
            id: dadosUsuario.id || usuarioExistente.id,
            username: dadosUsuario.username || usuarioExistente.username || userTratado,
            senha: dadosUsuario.senha || usuarioExistente.senha,
            avatar: dadosUsuario.avatar || usuarioExistente.avatar || "avatar1"
        };
        
        // CORREÇÃO: Escrita não-bloqueante evita corromper o arquivo com dados grandes (Base64)
        fs.writeFile(arquivoUsuarios, JSON.stringify(usuarios, null, 2), 'utf-8', (erro) => {
            if (erro) {
                console.error("🔴 Falha assíncrona ao persistir novos usuários no disco:", erro);
            } else {
                console.log(`💾 [Bancos] Usuário @${userTratado} gravado fisicamente com sucesso.`);
            }
        });
    },

    // ==========================================================================
    // SEÇÃO DE GERENCIAMENTO DE SALAS
    // ==========================================================================
    
    /**
     * Retorna o estado atualizado das salas na memória física
     */
    obterTodasSalas: () => {
        try { 
            const conteudo = fs.readFileSync(arquivoSalas, 'utf-8');
            return JSON.parse(conteudo) || {}; 
        } catch (e) { 
            console.warn("⚠️ Falha na leitura de salas.json, redefinindo cache local.");
            return {}; 
        }
    },

    /**
     * Registra uma nova sala de forma ASSÍNCRONA no repositório local
     */
    salvarSala: (idSala, dadosSala) => {
        const salas = BancoDeDados.obterTodasSalas();
        
        salas[idSala] = {
            id: dadosSala.id,
            tipo: dadosSala.tipo,
            senha: dadosSala.senha,
            usuarios: [] // Força inicialização com 0 participantes ativos de forma segura
        };
        
        // CORREÇÃO: Escrita não-bloqueante para gerenciamento leve de salas
        fs.writeFile(arquivoSalas, JSON.stringify(salas, null, 2), 'utf-8', (erro) => {
            if (erro) {
                console.error("🔴 Falha assíncrona ao persistir a criação de canais no disco:", erro);
            }
        });
    }
};

module.exports = BancoDeDados;
