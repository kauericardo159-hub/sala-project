/**
 * Componente 'ListChat' - Estilo Project Z
 * Renderiza o histórico de conversas ativas do usuário com dados reais e atualizações ao vivo.
 */
(function() {
    // 1. DADOS DA SESSÃO ATUAL
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const meuUsuario = sessao.username || 'Visitante';

    // Helper para buscar a foto atualizada de qualquer usuário (Nativa ou Base64)
    function obterAvatarUsuario(usernameAlvo) {
        const avatarTipo = localStorage.getItem(`avatar_@${usernameAlvo.toLowerCase()}`) || 'avatar1';
        if (avatarTipo.startsWith('data:image')) return avatarTipo;
        
        let seed = "Felix";
        if (avatarTipo === 'avatar2') seed = "Aneka";
        if (avatarTipo === 'avatar3') seed = "Jack";
        if (avatarTipo === 'avatar4') seed = "Midnight";
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    }

    // Helper para formatar o tempo de forma amigável e compacta
    function formatarTempo(timestamp) {
        if (!timestamp) return '';
        const agora = Date.now();
        const diferenca = agora - timestamp;
        
        const segundos = Math.floor(diferenca / 1000);
        const minutos = Math.floor(segundos / 60);
        const horas = Math.floor(minutos / 60);

        if (segundos < 60) return 'agora';
        if (minutos < 60) return `há ${minutos}m`;
        if (horas < 24) return `há ${horas}h`;
        
        const data = new Date(timestamp);
        return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    }

    // 2. INJEÇÃO DOS ESTILOS CSS DA LISTA DE CHATS
    const estiloCss = document.createElement('style');
    estiloCss.textContent = `
        .chatlist-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 10px;
        }

        .chatlist-header {
            font-size: 14px;
            font-weight: 700;
            color: var(--z-text-gray);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 15px 0 15px 5px;
        }

        /* Card de Linha de Conversa */
        .chat-row-item {
            display: flex;
            align-items: center;
            background-color: var(--z-gray-panel);
            padding: 14px 16px;
            border-radius: 18px;
            margin-bottom: 10px;
            border: 1px solid rgba(255, 255, 255, 0.01);
            cursor: pointer;
            transition: transform 0.15s ease, border-color 0.2s, background-color 0.2s;
        }

        .chat-row-item:hover {
            background-color: #1a1d22;
            border-color: rgba(255, 94, 0, 0.15);
            transform: translateY(-1px);
        }

        .chat-row-left {
            position: relative;
            margin-right: 14px;
        }

        .chat-row-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 2px solid #7c848f;
            background-color: var(--z-gray-input);
            object-fit: cover;
        }

        .chat-row-body {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
        }

        .chat-row-topline {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        .chat-row-username {
            font-size: 15px;
            font-weight: 700;
            color: var(--z-text-white);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .chat-row-time {
            font-size: 11px;
            font-weight: 600;
            color: var(--z-text-gray);
            white-space: nowrap;
            padding-left: 8px;
        }

        .chat-row-preview {
            font-size: 13px;
            font-weight: 500;
            color: var(--z-text-gray);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            gap: 4px;
        }

        .chat-preview-prefix {
            color: rgba(255, 255, 255, 0.4);
            font-weight: 700;
        }

        .chat-preview-prefix.me {
            color: var(--z-orange-neon);
        }

        .chatlist-vazia {
            color: var(--z-text-gray);
            font-size: 14px;
            text-align: center;
            padding: 40px 20px;
            background-color: var(--z-gray-panel);
            border-radius: 20px;
            border: 1px dashed rgba(255, 255, 255, 0.04);
        }
    `;
    document.head.appendChild(estiloCss);

    // 3. INJETA ESTRUTURA BASE DA TELA
    const containerAlvo = document.getElementById('layout-user-explorer');
    if (containerAlvo) {
        containerAlvo.innerHTML = `
            <div class="chatlist-container">
                <div class="chatlist-header">Conversas Recentes</div>
                <div id="z-lista-conversas-alvo">
                    </div>
            </div>
        `;
    }

    /**
     * Puxa o histórico unificado de conversas do localStorage
     * A estrutura esperada de persistência segue o padrão do save-conta / chats locais
     */
    window.carregarHistoricoConversas = function() {
        const listaAlvo = document.getElementById('z-lista-conversas-alvo');
        if (!listaAlvo) return;

        // Recupera a lista global de conversas salvas
        const chaveHistorico = `zhub_chats_@${meuUsuario.toLowerCase()}`;
        const historico = JSON.parse(localStorage.getItem(chaveHistorico) || '[]');

        if (historico.length === 0) {
            listaAlvo.innerHTML = `
                <div class="chatlist-vazia">
                    <p>Nenhuma conversa iniciada.</p>
                    <p style="font-size: 12px; margin-top: 5px; color: rgba(255,255,255,0.2);">Vá na aba Início para ver quem está online e bater um papo!</p>
                </div>`;
            return;
        }

        // Ordena por data (as mensagens mais recentes ficam no topo)
        historico.sort((a, b) => b.timestamp - a.timestamp);

        listaAlvo.innerHTML = historico.map(chat => {
            const souEu = chat.ultimaMensagemPor === meuUsuario;
            const prefixoTexto = souEu ? 'Você: ' : `${chat.usernameConversado}: `;
            const classePrefixo = souEu ? 'me' : 'outro';

            return `
                <div class="chat-row-item" onclick="abrirConversaPrivada('${chat.usernameConversado}')">
                    <div class="chat-row-left">
                        <img src="${obterAvatarUsuario(chat.usernameConversado)}" class="chat-row-avatar" alt="Avatar">
                    </div>
                    <div class="chat-row-body">
                        <div class="chat-row-topline">
                            <span class="chat-row-username">@${chat.usernameConversado}</span>
                            <span class="chat-row-time">${formatarTempo(chat.timestamp)}</span>
                        </div>
                        <div class="chat-row-preview">
                            <span class="chat-preview-prefix ${classePrefixo}">${prefixoTexto}</span>
                            <span>${chat.ultimaMensagem}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    /**
     * Redireciona e prepara os parâmetros para o chat.js carregar a sala correta
     */
    window.abrirConversaPrivada = function(usuarioDestino) {
        console.log(`Abrindo chat direto com: @${usuarioDestino}`);
        // Guarda no storage qual é o alvo ativo antes de mudar de página
        localStorage.setItem('zhub_chat_alvo_ativo', usuarioDestino.toLowerCase());
        window.navegarZHub('chat.html');
    };

    // Executa a carga inicial ao renderizar o script
    window.carregarHistoricoConversas();

    // 4. ESCUTA ATUALIZAÇÕES AO VIVO SE HOUVER SINAL DO SOCKET
    if (window.socket) {
        window.socket.on('atualizar-salas', () => {
            // Atualiza o tempo decorrido e novas mensagens recebidas em tempo real
            window.carregarHistoricoConversas();
        });
    }

})();
