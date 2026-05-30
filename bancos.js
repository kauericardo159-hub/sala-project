const fs = require('fs');
const path = require('path');

// Caminhos absolutos para os arquivos de persistência de dados
const arquivoSalas = path.join(__dirname, 'salas.json');
const arquivoUsuarios = path.join(__dirname, 'usuarios.json');

// Memória cache de segurança para impedir leituras síncronas repetidas (Evita gargalo de RAM no Render)
let cacheUsuarios = null;
let cacheSalas = null;

// Semáforo simples para evitar escritas simultâneas concorrentes no mesmo arquivo
let estaEscrevendoUsuario = false;
let filaEscritaUsuario = false;

/**
 * Garante que o arquivo JSON exista na raiz, inicializando-o como um objeto vazio caso não exista
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

// Inicializa os arquivos uma única vez ao rodar o servidor
inicializarBanco(arquivoUsuarios);
inicializarBanco(arquivoSalas);

const BancoDeDados = {
    // ==========================================================================
    // SEÇÃO DE GERENCIAMENTO DE USUÁRIOS
    // ==========================================================================
    
    /**
     * Retorna todas as contas registradas no sistema (Leitura ultra rápida por Cache/RAM)
     */
    obterTodosUsuarios: () => {
        // Se já tivermos a lista em memória (RAM), retorna direto sem tocar no disco rígido do Render
        if (cacheUsuarios !== null) {
            return cacheUsuarios;
        }
        try { 
            const conteudo = fs.readFileSync(arquivoUsuarios, 'utf-8');
            cacheUsuarios = JSON.parse(conteudo) || {}; 
            return cacheUsuarios;
        } catch (e) { 
            console.warn("⚠️ Falha na leitura de usuarios.json, usando cache de emergência vazio.");
            cacheUsuarios = cacheUsuarios || {};
            return cacheUsuarios;
        }
    },

    /**
     * Registra ou atualiza um usuário permanentemente de forma ASSÍNCRONA e CONTROLADA
     */
    salvarUsuario: (userTratado, dadosUsuario) => {
        const usuarios = BancoDeDados.obterTodosUsuarios();
        const usuarioExistente = usuarios[userTratado] || {};

        // Limitação de payload de Avatar para segurança do servidor (Corta Base64s abusivos de mais de 1.5MB)
        let avatarSeguro = dadosUsuario.avatar || usuarioExistente.avatar || "avatar1";
        if (avatarSeguro.startsWith('data:image') && avatarSeguro.length > 2000000) {
            console.warn(`⚠️ [Bancos] Bloqueada tentativa de salvar imagem Base64 muito grande de @${userTratado}.`);
            avatarSeguro = usuarioExistente.avatar || "avatar1"; // Reverte para o anterior
        }

        // Sincronia total de chaves com o padrão do server.js
        usuarios[userTratado] = {
            id: dadosUsuario.id || usuarioExistente.id,
            username: dadosUsuario.username || usuarioExistente.username || userTratado,
            senha: dadosUsuario.senha || usuarioExistente.senha,
            avatar: avatarSeguro
        };
        
        // Atualiza imediatamente o cache em memória RAM para o servidor não ficar desatualizado se cair
        cacheUsuarios = usuarios;

        // Função interna para executar a escrita de forma segura
        const executarEscritaFisica = () => {
            if (estaEscrevendoUsuario) {
                filaEscritaUsuario = true;
                return;
            }

            estaEscrevendoUsuario = true;
            
            // Transforma em string de forma otimizada
            const dadosString = JSON.stringify(cacheUsuarios, null, 2);

            fs.writeFile(arquivoUsuarios, dadosString, 'utf-8', (erro) => {
                estaEscrevendoUsuario = false;
                
                if (erro) {
                    console.error("🔴 Falha assíncrona ao persistir novos usuários no disco:", erro);
                } else {
                    console.log(`💾 [Bancos] Banco de dados atualizado fisicamente. Usuário: @${userTratado}`);
                }

                // Se houver uma nova alteração na fila de espera, executa ela agora
                if (filaEscritaUsuario) {
                    filaEscritaUsuario = false;
                    executarEscritaFisica();
                }
            });
        };

        executarEscritaFisica();
    },

    // ==========================================================================
    // SEÇÃO DE GERENCIAMENTO DE SALAS
    // ==========================================================================
    
    /**
     * Retorna o estado atualizado das salas na memória física
     */
    obterTodasSalas: () => {
        if (cacheSalas !== null) {
            return cacheSalas;
        }
        try { 
            const conteudo = fs.readFileSync(arquivoSalas, 'utf-8');
            cacheSalas = JSON.parse(conteudo) || {}; 
            return cacheSalas;
        } catch (e) { 
            console.warn("⚠️ Falha na leitura de salas.json, redefinindo cache local.");
            cacheSalas = cacheSalas || {};
            return cacheSalas;
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
            usuarios: [] 
        };
        
        cacheSalas = salas;

        fs.writeFile(arquivoSalas, JSON.stringify(salas, null, 2), 'utf-8', (erro) => {
            if (erro) {
                console.error("🔴 Falha assíncrona ao persistir a criação de canais no disco:", erro);
            }
        });
    }
};

module.exports = BancoDeDados;
