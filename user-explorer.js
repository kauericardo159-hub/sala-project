/**
 * Componente Modular 'User-Explorer' - Estilo Project Z
 * Renderiza em tempo real a lista de usuários online no servidor.
 */
(function() {
    // 1. RECUPERA OS DADOS DA SESSÃO LOCAL DO USUÁRIO
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const meuUsuario = sessao.username || 'Visitante';

    // Helper aprimorado para gerar ou renderizar a foto (Suporta Base64 e IDs nativos)
    function obterUrlAvatar(usernameAlvo) {
        const avatarTipo = localStorage.getItem(`avatar_@${usernameAlvo.toLowerCase()}`) || 'avatar1';
        
        if (avatarTipo.startsWith('data:image')) return avatarTipo; // Retorna o Base64 caso seja foto do dispositivo
        
        let seed = "Felix";
        if (avatarTipo === 'avatar2') seed = "Aneka";
        if (avatarTipo === 'avatar3') seed = "Jack";
        if (avatarTipo === 'avatar4') seed = "Midnight";
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    }

    // 2. INJEÇÃO DOS ESTILOS CSS DO EXPLORER
    const estiloCss = document.createElement('style');
    estiloCss.textContent = `
        .explorer-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 10px;
        }

        .explorer-title {
            font-size: 14px;
            font-weight: 700;
            color: #7c848f;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            margin-top: 20px;
        }

        /* Card de Usuário (Base) */
        .user-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background-color: #141619;
            padding: 14px 20px;
            border-radius: 16px;
            margin-bottom: 10px;
            border: 1px solid rgba(255, 255, 255, 0.02);
            transition: transform 0.2s, border-color 0.2s;
            cursor: pointer; /* Feedback visual de clique */
        }

        /* Destaque para o Card do Próprio Usuário Logado */
        .user-card.meu-perfil {
            background: linear-gradient(90deg, #1d2024 0%, #141619 100%);
            border-left: 4px solid #ff5e00;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            cursor: default;
        }

        .user-card:hover:not(.meu-perfil) {
            border-color: rgba(255, 94, 0, 0.3);
            transform: translateY(-1px);
        }

        .user-card-left {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .explorer-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background-color: #1d2024;
            border: 2px solid #ff5e00;
            object-fit: cover;
        }

        .user-card.meu-perfil .explorer-avatar {
            border-color: #ff5e00;
        }

        .user-card:not(.meu-perfil) .explorer-avatar {
            border-color: #7c848f;
        }

        .explorer-info {
            display: flex;
            flex-direction: column;
        }

        .explorer-username {
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
        }

        .explorer-badge-me {
            font-size: 11px;
            background-color: rgba(255, 94, 0, 0.15);
            color: #ff5e00;
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 700;
            margin-left: 8px;
            display: inline-block;
            vertical-align: middle;
        }

        .explorer-status-text {
            font-size: 12px;
            color: #7c848f;
            margin-top: 2px;
        }

        /* Indicador de Bolinha Online */
        .explorer-dot {
            width: 8px;
            height: 8px;
            background-color: #23a55a;
            border-radius: 50%;
            box-shadow: 0 0 8px #23a55a;
        }
        
        .txt-lista-vazia {
            color: #7c848f;
            font-size: 14px;
            text-align: center;
            padding: 20px;
            background-color: #141619;
            border-radius: 16px;
            border: 1px dashed rgba(255, 255, 255, 0.05);
        }
    `;
    document.head.appendChild(estiloCss);

    // 3. MONTA A ESTRUTURA INICIAL INTERNA
    const containerExplorer = document.getElementById('layout-user-explorer');
    if (containerExplorer) {
        containerExplorer.innerHTML = `
            <div class="explorer-container">
                
                <div class="explorer-title">Eu</div>
                <div class="user-card meu-perfil">
                    <div class="user-card-left">
                        <img id="z-explorer-meu-avatar" src="${obterUrlAvatar(meuUsuario)}" class="explorer-avatar" alt="Meu Avatar">
                        <div class="explorer-info">
                            <span class="explorer-username">@${meuUsuario} <span class="explorer-badge-me">VOCÊ</span></span>
                            <span class="explorer-status-text">Conectado ao ecossistema</span>
                        </div>
                    </div>
                    <div class="explorer-dot"></div>
                </div>

                <div class="explorer-title">Usuários Online</div>
                <div id="z-lista-usuarios-online">
                    <p class="txt-lista-vazia">Buscando outros membros no multiverso...</p>
                </div>

            </div>
        `;
    }

    // 4. ESCUTA E SINCRONIZAÇÃO EM TEMPO REAL VIA SOCKET
    function inicializarEscutasSocket() {
        if (!window.socket) return;

        // Pede a lista atualizada imediatamente
        window.socket.emit('pedir-salas'); 

        // Escuta principal: Evento direto de usuários online
        window.socket.on('atualizar-usuarios-online', (listaUsuariosLogados) => {
            if (Array.isArray(listaUsuariosLogados)) {
                window.atualizarListaInterface(listaUsuariosLogados);
            }
        });

        // Escuta secundária (Fallback): Extrai usuários ativos se o servidor mandar atualização de salas
        window.socket.on('atualizar-salas', (dadosSalas) => {
            if (dadosSalas && typeof dadosSalas === 'object') {
                // Coleta de forma limpa todos os usernames trafegando pelos canais ativos
                const usuariosExtraidos = new Set();
                Object.values(dadosSalas).forEach(sala => {
                    if (Array.isArray(sala.usuarios)) {
                        sala.usuarios.forEach(u => usuariosExtraidos.add(u));
                    }
                });
                if (usuariosExtraidos.size > 0) {
                    window.atualizarListaInterface(Array.from(usuariosExtraidos));
                }
            }
        });

        // Atualiza a foto do próprio usuário caso mude no painel
        window.socket.on('foto-atualizada-sucesso', (dados) => {
            if (dados && dados.username && dados.username.toLowerCase() === meuUsuario.toLowerCase()) {
                const minhaFotoCard = document.getElementById('z-explorer-meu-avatar');
                if (minhaFotoCard) minhaFotoCard.src = obterUrlAvatar(meuUsuario);
            }
        });
    }

    // Executa e define um pequeno intervalo de verificação caso a conexão com o Render demore um instante
    if (window.socket) {
        inicializarEscutasSocket();
    } else {
        const checker = setInterval(() => {
            if (window.socket) {
                inicializarEscutasSocket();
                clearInterval(checker);
            }
        }, 1000);
    }

    /**
     * Atualiza dinamicamente a UI com os dados reais recebidos do back-end
     */
    window.atualizarListaInterface = function(usuariosOnline) {
        const listaAlvo = document.getElementById('z-lista-usuarios-online');
        if (!listaAlvo) return;

        // Filtra para remover você da lista de outros membros online abaixo
        const filtrados = usuariosOnline.filter(u => u.toLowerCase() !== meuUsuario.toLowerCase());

        if (filtrados.length === 0) {
            listaAlvo.innerHTML = `<p class="txt-lista-vazia">Nenhum outro usuário online no momento.</p>`;
            return;
        }

        listaAlvo.innerHTML = filtrados.map(user => `
            <div class="user-card" onclick="irParaPerfilPreview('${user}')">
                <div class="user-card-left">
                    <img src="${obterUrlAvatar(user)}" class="explorer-avatar" alt="Avatar">
                    <div class="explorer-info">
                        <span class="explorer-username">@${user}</span>
                        <span class="explorer-status-text">Disponível no app</span>
                    </div>
                </div>
                <div class="explorer-dot"></div>
            </div>
        `).join('');
    };

    /**
     * Guarda o alvo selecionado no cache local e navega para o preview do perfil
     */
    window.irParaPerfilPreview = function(usernameAlvo) {
        console.log(`🎯 Abrindo visualização de: @${usernameAlvo}`);
        localStorage.setItem('zhub_preview_target', usernameAlvo);
        window.location.href = "preview-user.html";
    };

})();
