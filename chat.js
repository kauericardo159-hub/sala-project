/**
 * Componente 'Chat' - Estilo Project Z
 * Controla a interface interna da conversa, envio de mensagens e sincronização local.
 */
(function() {
    // 1. CONFIGURAÇÕES E SESSÃO
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const meuUsuario = sessao.username || 'Visitante';
    const alvoAtivo = localStorage.getItem('zhub_chat_alvo_ativo'); // Usuário com quem vou conversar

    // Se não houver um alvo ativo, exibe tela de seleção e interrompe
    if (!alvoAtivo) {
        renderizarTelaSemChat();
        return;
    }

    // Identificador único da sala privada (ordem alfabética para garantir que ambos entrem na mesma sala)
    const salaId = [meuUsuario.toLowerCase(), alvoAtivo.toLowerCase()].sort().join('_room_');

    // Helpers de Avatar
    function obterAvatar(username) {
        const avatarTipo = localStorage.getItem(`avatar_@${username.toLowerCase()}`) || 'avatar1';
        if (avatarTipo.startsWith('data:image')) return avatarTipo;
        
        let seed = "Felix";
        if (avatarTipo === 'avatar2') seed = "Aneka";
        if (avatarTipo === 'avatar3') seed = "Jack";
        if (avatarTipo === 'avatar4') seed = "Midnight";
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    }

    // 2. INJEÇÃO DOS ESTILOS CSS (Estilo Project Z)
    const estiloCss = document.createElement('style');
    estiloCss.textContent = `
        .chat-window-container {
            display: flex;
            flex-direction: column;
            height: calc(100vh - 160px); /* Ajuste perfeito para caber entre a topbar e footer */
            max-width: 600px;
            margin: 0 auto;
            background-color: var(--z-black-pure);
        }

        /* Cabeçalho Interno do Chat */
        .chat-window-header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background-color: var(--z-gray-panel);
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            border-radius: 16px 16px 0 0;
        }

        .btn-voltar-list {
            background: transparent;
            border: none;
            color: var(--z-orange-neon);
            font-size: 18px;
            cursor: pointer;
            margin-right: 12px;
            font-weight: 900;
        }

        .chat-header-avatar {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            border: 2px solid var(--z-orange-neon);
            margin-right: 12px;
            object-fit: cover;
        }

        .chat-header-info {
            display: flex;
            flex-direction: column;
        }

        .chat-header-name {
            font-size: 15px;
            font-weight: 800;
            color: var(--z-text-white);
        }

        .chat-header-status {
            font-size: 11px;
            color: #23a55a;
            font-weight: 600;
        }

        /* Área de Mensagens (Scrollable) */
        .chat-messages-area {
            flex-grow: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background-color: #0e1012;
        }

        /* Balões de Mensagem */
        .msg-bubble-wrapper {
            display: flex;
            width: 100%;
        }

        .msg-bubble-wrapper.me {
            justify-content: flex-end;
        }

        .msg-bubble-wrapper.outro {
            justify-content: flex-start;
        }

        .msg-bubble {
            max-width: 75%;
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 14.5px;
            font-weight: 500;
            line-height: 1.4;
            word-break: break-word;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .msg-bubble-wrapper.me .msg-bubble {
            background-color: var(--z-orange-neon);
            color: #ffffff;
            border-bottom-right-radius: 4px;
        }

        .msg-bubble-wrapper.outro .msg-bubble {
            background-color: var(--z-gray-input);
            color: var(--z-text-white);
            border-bottom-left-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.02);
        }

        /* Barra de Input Inferior */
        .chat-input-bar {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background-color: var(--z-gray-panel);
            border-top: 1px solid rgba(255, 255, 255, 0.03);
            border-radius: 0 0 16px 16px;
            gap: 10px;
        }

        .chat-input-field {
            flex-grow: 1;
            background-color: var(--z-gray-input);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 12px 16px;
            border-radius: 24px;
            color: var(--z-text-white);
            font-size: 14px;
            font-weight: 600;
            outline: none;
            transition: border-color 0.2s;
        }

        .chat-input-field:focus {
            border-color: rgba(255, 94, 0, 0.4);
        }

        .btn-send-message {
            background-color: var(--z-orange-neon);
            color: #ffffff;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s, transform 0.1s;
            box-shadow: 0 4px 10px rgba(255, 94, 0, 0.2);
        }

        .btn-send-message:hover {
            background-color: var(--z-orange-hover);
        }

        .btn-send-message:active {
            transform: scale(0.95);
        }

        /* Estado Vazio Individual */
        .no-chat-selected {
            text-align: center;
            padding: 40px 20px;
            max-width: 400px;
            margin: 80px auto;
            background-color: var(--z-gray-panel);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.02);
        }
        .btn-call-action {
            background-color: var(--z-gray-input);
            color: var(--z-orange-neon);
            border: 1px solid rgba(255, 94, 0, 0.2);
            padding: 10px 20px;
            border-radius: 12px;
            font-weight: 700;
            cursor: pointer;
            margin-top: 15px;
        }
    `;
    document.head.appendChild(estiloCss);

    // 3. INJETA A ESTRUTURA DO CHAT ATIVO
    const containerAlvo = document.getElementById('layout-user-explorer');
    if (containerAlvo) {
        containerAlvo.innerHTML = `
            <div class="chat-window-container">
                <div class="chat-window-header">
                    <button class="btn-voltar-list" onclick="fecharChatEVoltar()">‹</button>
                    <img src="${obterAvatar(alvoAtivo)}" class="chat-header-avatar" alt="Avatar">
                    <div class="chat-header-info">
                        <span class="chat-header-name">@${alvoAtivo}</span>
                        <span class="chat-header-status">● Online</span>
                    </div>
                </div>

                <div id="z-mensagens-chat-box" class="chat-messages-area">
                    </div>

                <div class="chat-input-bar">
                    <input type="text" id="z-input-mensagem-campo" class="chat-input-field" placeholder="Digite uma mensagem..." autocomplete="off">
                    <button class="btn-send-message" onclick="dispararMensagemPrivada()">➔</button>
                </div>
            </div>
        `;

        // Ativa o envio ao apertar a tecla "Enter"
        document.getElementById('z-input-mensagem-campo').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') dispararMensagemPrivada();
        });
    }

    // 4. LOGICA DE COMUNICAÇÃO (SOCKET IO)
    if (window.socket) {
        // Conecta o usuário na sala privada exclusiva desse par de amigos
        window.socket.emit('join-room', salaId, sessao.id || 'p2p_user');

        // Escuta novas mensagens vindas do servidor nesta sala
        window.socket.on('create-message', (msg, autor) => {
            adicionarBalaoNaTela(msg, autor);
            
            // Força a gravação no histórico do banco local (save-conta.js)
            if (typeof window.gravarHistoricoNoBancoLocal === "function") {
                window.gravarHistoricoNoBancoLocal(meuUsuario, alvoAtivo, msg, autor);
            }
        });
    }

    /**
     * Envia o texto digitado para o servidor
     */
    window.dispararMensagemPrivada = function() {
        const input = document.getElementById('z-input-mensagem-campo');
        const texto = input.value.trim();
        if (!texto || !window.socket) return;

        // Dispara o evento padrão já configurado no seu server.js
        window.socket.emit('send-message', texto, meuUsuario);
        input.value = '';
    };

    /**
     * Adiciona o balão estilizado visualmente na tela
     */
    window.adicionarBalaoNaTela = function(msg, autor) {
        const box = document.getElementById('z-mensagens-chat-box');
        if (!box) return;

        const souEu = autor.toLowerCase() === meuUsuario.toLowerCase();
        const classeDono = souEu ? 'me' : 'outro';

        const wrapper = document.createElement('div');
        wrapper.className = `msg-bubble-wrapper ${classeDono}`;
        wrapper.innerHTML = `<div class="msg-bubble">${msg}</div>`;
        
        box.appendChild(wrapper);
        
        // Auto-scroll para manter a última mensagem sempre visível
        box.scrollTop = box.scrollHeight;
    };

    /**
     * Limpa o ponteiro e volta para a listagem
     */
    window.fecharChatEVoltar = function() {
        localStorage.removeItem('zhub_chat_alvo_ativo');
        // Recarrega o componente injetando a lista limpa
        if (typeof window.carregarHistoricoConversas === "function") {
            window.location.reload();
        }
    };

    /**
     * Tela padrão caso nenhum chat esteja selecionado
     */
    function renderizarTelaSemChat() {
        const boxAlvo = document.getElementById('layout-user-explorer');
        if (boxAlvo) {
            boxAlvo.innerHTML = `
                <div class="no-chat-selected">
                    <p style="font-size: 32px;">💬</p>
                    <h3 style="color: #fff; margin-top: 10px; font-size: 16px;">Nenhuma conversa aberta</h3>
                    <p style="color: var(--z-text-gray); font-size: 13px; margin-top: 6px;">Escolha um dos seus chats recentes na lista ou procure amigos ativos.</p>
                    <button class="btn-call-action" onclick="window.navegarZHub('index.html')">Procurar Amigos</button>
                </div>
            `;
        }
    }

})();
