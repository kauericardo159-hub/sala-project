/**
 * Módulo 'Preview-User' - Estilo Project Z
 * Renderiza os dados detalhados de outro usuário e inicializa conversas privadas.
 */
(function() {
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const meuUsuario = sessao.username || 'Visitante';
    
    // Recupera qual usuário foi clicado no explorer
    const alvoPreview = localStorage.getItem('zhub_preview_target');

    // Se não houver alvo para ver, volta para a tela inicial
    if (!alvoPreview) {
        window.location.href = "index.html";
        return;
    }

    // Helper para buscar avatar local ou Base64 do alvo
    function obterAvatarAlvo(username) {
        const avatarTipo = localStorage.getItem(`avatar_@${username.toLowerCase()}`) || 'avatar1';
        if (avatarTipo.startsWith('data:image')) return avatarTipo;
        
        let seed = "Felix";
        if (avatarTipo === 'avatar2') seed = "Aneka";
        if (avatarTipo === 'avatar3') seed = "Jack";
        if (avatarTipo === 'avatar4') seed = "Midnight";
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    }

    // INJEÇÃO DE CSS PREMIUM DARK & ORANGE
    const estiloCss = document.createElement('style');
    estiloCss.textContent = `
        .preview-container {
            max-width: 500px;
            margin: 20px auto;
            padding: 15px;
        }

        /* Botão Voltar Superior Independente */
        .preview-back-bar {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }

        .btn-preview-voltar {
            background-color: var(--z-gray-panel);
            color: var(--z-text-white);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 10px 18px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: border-color 0.2s, color 0.2s;
        }

        .btn-preview-voltar:hover {
            border-color: var(--z-orange-neon);
            color: var(--z-orange-neon);
        }

        /* Card Principal do Perfil */
        .preview-card {
            background-color: var(--z-gray-panel);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.02);
            padding: 30px 24px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            position: relative;
            overflow: hidden;
        }

        /* Detalhe estético de fundo */
        .preview-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 6px;
            background: linear-gradient(90deg, var(--z-orange-neon), #ff8800);
        }

        .preview-avatar-frame {
            position: relative;
            width: 110px;
            height: 110px;
            margin: 10px auto 16px auto;
        }

        .preview-main-avatar {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 3px solid var(--z-orange-neon);
            background-color: var(--z-gray-input);
            object-fit: cover;
            box-shadow: 0 0 20px rgba(255, 94, 0, 0.2);
        }

        .preview-user-title {
            font-size: 22px;
            font-weight: 800;
            color: var(--z-text-white);
            letter-spacing: -0.5px;
            margin-bottom: 6px;
        }

        .preview-user-status-tag {
            font-size: 12px;
            color: #23a55a;
            background-color: rgba(35, 165, 90, 0.1);
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 700;
            display: inline-block;
            margin-bottom: 20px;
        }

        /* Bloco de Informações/Biografia */
        .preview-bio-box {
            background-color: var(--z-gray-input);
            border-radius: 16px;
            padding: 16px;
            text-align: left;
            margin-bottom: 24px;
            border: 1px solid rgba(255, 255, 255, 0.01);
        }

        .preview-bio-label {
            font-size: 11px;
            font-weight: 800;
            color: var(--z-text-gray);
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 6px;
        }

        .preview-bio-text {
            font-size: 13.5px;
            color: rgba(255, 255, 255, 0.85);
            line-height: 1.5;
        }

        /* Botão Gigante de Ação - Chamar na DM */
        .btn-preview-chat {
            width: 100%;
            background-color: var(--z-orange-neon);
            color: #ffffff;
            border: none;
            padding: 14px;
            border-radius: 16px;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: background-color 0.2s, transform 0.1s, box-shadow 0.2s;
            box-shadow: 0 6px 20px rgba(255, 94, 0, 0.25);
        }

        .btn-preview-chat:hover {
            background-color: var(--z-orange-hover);
            box-shadow: 0 8px 24px rgba(255, 94, 0, 0.4);
        }

        .btn-preview-chat:active {
            transform: scale(0.98);
        }
    `;
    document.head.appendChild(estiloCss);

    // MONTA A ESTRUTURA VISUAL DO PREVIEW
    const painelExplorer = document.getElementById('layout-user-explorer');
    if (painelExplorer) {
        painelExplorer.innerHTML = `
            <div class="preview-container">
                
                <div class="preview-back-bar">
                    <button class="btn-preview-voltar" onclick="voltarParaExplorer()">🡔 Voltar para o Início</button>
                </div>

                <div class="preview-card">
                    <div class="preview-avatar-frame">
                        <img src="${obterAvatarAlvo(alvoPreview)}" class="preview-main-avatar" alt="Avatar">
                    </div>

                    <h2 class="preview-user-title">@${alvoPreview}</h2>
                    <div class="preview-user-status-tag">● Integrante do Z-Hub</div>

                    <div class="preview-bio-box">
                        <div class="preview-bio-label">Status Customizado</div>
                        <div class="preview-bio-text">Olá! Estou usando o ecossistema modular do Z-Hub para me conectar e explorar novas calls.</div>
                    </div>

                    <button class="btn-preview-chat" onclick="gerarEIrParaChatPrivado('${alvoPreview}')">
                        💬 Enviar Mensagem Direta
                    </button>
                </div>

            </div>
        `;
    }

    /**
     * Limpa o ponteiro temporário e retorna à aba principal de usuários
     */
    window.voltarParaExplorer = function() {
        localStorage.removeItem('zhub_preview_target');
        window.location.href = "index.html";
    };

    /**
     * Registra o usuário nas DMs salvas do save-conta / listchat e redireciona abrindo o chat
     */
    window.gerarEIrParaChatPrivado = function(usuarioAlvo) {
        console.log(`✨ Criando vínculo de DM com: @${usuarioAlvo}`);
        
        // Verifica se a função global de persistência do save-conta existe
        if (typeof window.gravarHistoricoNoBancoLocal === "function") {
            // Inicializa a linha da conversa com um texto padrão amigável antes do primeiro envio
            window.gravarHistoricoNoBancoLocal(
                meuUsuario, 
                usuarioAlvo, 
                "Conversa iniciada!", 
                usuarioAlvo
            );
        } else {
            // Fallback manual direto no localStorage caso o script ainda esteja indexando
            const chave = `zhub_chats_@${meuUsuario.toLowerCase()}`;
            let historico = JSON.parse(localStorage.getItem(chave) || '[]');
            historico = historico.filter(c => c.usernameConversado.toLowerCase() !== usuarioAlvo.toLowerCase());
            historico.push({
                usernameConversado: usuarioAlvo,
                ultimaMensagem: "Conversa iniciada!",
                ultimaMensagemPor: usuarioAlvo,
                timestamp: Date.now()
            });
            localStorage.setItem(chave, JSON.stringify(historico));
        }

        // Define o alvo que o chat.js deve abrir imediatamente
        localStorage.setItem('zhub_chat_alvo_ativo', usuarioAlvo.toLowerCase());
        
        // Redireciona de verdade para a aba de Chat & Call
        window.location.href = "chat.html";
    };

})();
