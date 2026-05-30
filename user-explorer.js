/**
 * Componente Modular 'User-Explorer' - Estilo Project Z
 * Renderiza a lista completa de usuários cadastrados no banco, diferenciando online/offline.
 */
(function() {
    // 1. RECUPERA OS DADOS DA SESSÃO LOCAL DO USUÁRIO
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const meuUsuario = sessao.username || 'Visitante';

    // Helper aprimorado para gerar ou renderizar a foto (Suporta Base64 e IDs nativos)
    function obterUrlAvatar(usernameAlvo) {
        if (!usernameAlvo) return `https://api.dicebear.com/7.x/bottts/svg?seed=Felix`;
        
        // Varre o localStorage ignorando diferenças de maiúsculas/minúsculas na chave
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
            transition: transform 0.2s, border-color 0.2s, opacity 0.2s;
            cursor: pointer;
        }

        /* Opacidade reduzida de forma sutil para usuários offline (padrão Project Z/Discord) */
        .user-card.offline {
            opacity: 0.6;
        }
        .user-card.offline:hover {
            opacity: 0.9;
        }

        /* Destaque para o Card do Próprio Usuário Logado */
        .user-card.meu-perfil {
            background: linear-gradient(90deg, #1d2024 0%, #141619 100%);
            border-left: 4px solid #ff5e00;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            cursor: default;
            opacity: 1 !important;
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
            border: 2px solid #7c848f;
            object-fit: cover;
            transition: border-color 0.2s;
        }

        .user-card.meu-perfil .explorer-avatar,
        .user-card.online .explorer-avatar {
            border-color: #ff5e00;
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
            width: 9px;
            height: 9px;
            border-radius: 50%;
            transition: background-color 0.2s, box-shadow 0.2s;
        }
        
        .explorer-dot.is-online {
            background-color: #23a55a;
            box-shadow: 0 0 8px #23a55a;
        }
        
        .explorer-dot.is-offline {
            background-color: #4f545c;
            box-shadow: none;
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
                    <div class="explorer-dot is-online"></div>
                </div>

                <div class="explorer-title">Todos os Usuários do Servidor</div>
                <div id="z-lista-usuarios-online">
                    <p class="txt-lista-vazia">Buscando os membros no banco de dados...</p>
                </div>

            </div>
        `;
    }

    // 4. ESCUTA E SINCRONIZAÇÃO EM TEMPO REAL VIA SOCKET
    function inicializarEscutasSocket() {
        if (!window.socket) return;

        // Solicita a lista global do servidor assim que carregar
        window.socket.emit('pedir-usuarios-globais'); 

        // Escuta principal: Evento que traz o status detalhado de todos os cadastrados
        window.socket.on('atualizar-usuarios-globais', (listaMembrosMapeados) => {
            console.log("👥 [User-Explorer] Lista global recebida:", listaMembrosMapeados);
            if (Array.isArray(listaMembrosMapeados)) {
                window.atualizarListaInterface(listaMembrosMapeados);
            }
        });

        // Caso o servidor sofra um broadcast de alteração de imagem, renova o pedido
        window.socket.on('foto-atualizada-sucesso', (dados) => {
            if (dados && dados.username) {
                if (dados.username.toLowerCase() === meuUsuario.toLowerCase()) {
                    const minhaFotoCard = document.getElementById('z-explorer-meu-avatar');
                    if (minhaFotoCard) minhaFotoCard.src = obterUrlAvatar(meuUsuario);
                }
                window.socket.emit('pedir-usuarios-globais');
            }
        });
        
        // Se houver reconexões ou atualizações de salas, atualiza os status
        window.socket.on('atualizar-salas', () => {
            window.socket.emit('pedir-usuarios-globais');
        });
    }

    if (window.socket) {
        inicializarEscutasSocket();
    } else {
        const checker = setInterval(() => {
            if (window.socket) {
                inicializarEscutasSocket();
                clearInterval(checker);
            }
        }, 500);
    }

    /**
     * Atualiza dinamicamente a UI mesclando membros online e offline
     */
    window.atualizarListaInterface = function(usuariosGlobais) {
        const listaAlvo = document.getElementById('z-lista-usuarios-online');
        if (!listaAlvo) return;

        // Remove você mesmo da listagem inferior para evitar redundância
        const filtrados = usuariosGlobais.filter(u => u && u.username && u.username.toLowerCase() !== meuUsuario.toLowerCase());

        if (filtrados.length === 0) {
            listaAlvo.innerHTML = `<p class="txt-lista-vazia">Nenhum outro usuário registrado no banco.</p>`;
            return;
        }

        // Ordena para colocar os usuários Online no topo da lista
        filtrados.sort((a, b) => (b.online === a.online) ? 0 : b.online ? 1 : -1);

        // Renderização inteligente de cards baseado no status
        listaAlvo.innerHTML = filtrados.map(user => {
            const statusClasse = user.online ? 'online' : 'offline';
            const dotClasse = user.online ? 'is-online' : 'is-offline';
            const statusTexto = user.online ? 'Disponível no app' : 'Desconectado';

            return `
                <div class="user-card ${statusClasse}" onclick="irParaPerfilPreview('${user.username}')">
                    <div class="user-card-left">
                        <img src="${obterUrlAvatar(user.username)}" class="explorer-avatar" alt="Avatar">
                        <div class="explorer-info">
                            <span class="explorer-username">@${user.username}</span>
                            <span class="explorer-status-text">${statusTexto}</span>
                        </div>
                    </div>
                    <div class="explorer-dot ${dotClasse}"></div>
                </div>
            `;
        }).join('');
    };

    window.irParaPerfilPreview = function(usernameAlvo) {
        if (!usernameAlvo) return;
        console.log(`🎯 Abrindo visualização de: @${usernameAlvo}`);
        localStorage.setItem('zhub_preview_target', usernameAlvo);
        window.location.href = "preview-user.html";
    };

})();
