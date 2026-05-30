/**
 * Componente Modular 'Barra' - Estilo Project Z (Premium Dark & Orange)
 * Injeta dinamicamente a Topbar, Sidebar e o CSS unificado de forma resiliente.
 */
(function() {
    // 1. CARREGA DADOS DO USUÁRIO LOGADO (Recuperados do localStorage)
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const username = sessao.username || 'Visitante';
    
    // Recupera o avatar escolhido no cadastro, perfil ou define o padrão
    let avatarTipo = localStorage.getItem(`avatar_@${username.toLowerCase()}`) || 'avatar1';
    
    // Função auxiliar para resolver a URL real da imagem (Suporta SVG do Dicebear e imagens locais em Base64)
    function resolverUrlFoto(valor) {
        if (!valor) return `https://api.dicebear.com/7.x/bottts/svg?seed=Felix`;
        if (valor.startsWith('data:image')) return valor; // Imagem customizada em Base64 do dispositivo
        
        let seedAvatar = "Felix";
        if (valor === 'avatar2') seedAvatar = "Aneka";
        if (valor === 'avatar3') seedAvatar = "Jack";
        if (valor === 'avatar4') seedAvatar = "Midnight";
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seedAvatar}`;
    }

    // Descobre qual é a página atual olhando o final da URL (Tratado contra parâmetros e rotas secundárias)
    const urlCaminho = window.location.pathname.split("/").pop() || "index.html";
    const paginaAtual = urlCaminho.includes('.html') ? urlCaminho : 'index.html';

    // 2. INJEÇÃO DO ESTILO CSS ISOLADO (Laranja & Preto Carbono)
    const estiloCss = document.createElement('style');
    estiloCss.textContent = `
        :root {
            --z-black-pure: #0b0c0e;
            --z-gray-panel: #141619;
            --z-gray-input: #1d2024;
            --z-orange-neon: #ff5e00;
            --z-orange-hover: #e05200;
            --z-text-white: #ffffff;
            --z-text-gray: #7c848f;
        }

        /* Estrutura Travada do Layout Viewport para impedir quebras visuais */
        #app-viewport {
            display: flex !important; /* Força o alinhamento correto */
            flex-direction: column !important;
            width: 100vw;
            height: 100vh;
            background-color: var(--z-black-pure);
            overflow: hidden !important;
        }

        /* Barra Superior (Header) */
        .z-topbar {
            width: 100%;
            height: 70px;
            background-color: var(--z-gray-panel);
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            z-index: 100;
            flex-shrink: 0; /* Impede que a topbar seja esmagada */
        }

        .z-topbar-left {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            user-select: none;
        }

        .z-logo-badge {
            background-color: var(--z-orange-neon);
            color: #000000;
            font-weight: 900;
            font-size: 20px;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            box-shadow: 0 0 12px rgba(255, 94, 0, 0.3);
        }

        .z-brand-title {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: var(--z-text-white);
        }

        /* Perfil do Usuário na Direita */
        .z-topbar-right {
            display: flex;
            align-items: center;
            gap: 12px;
            background-color: var(--z-gray-input);
            padding: 6px 14px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.02);
            cursor: pointer;
            transition: border-color 0.2s;
            user-select: none;
        }

        .z-topbar-right:hover {
            border-color: rgba(255, 94, 0, 0.3);
        }

        .z-user-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background-color: var(--z-gray-panel);
            border: 2px solid var(--z-orange-neon);
            object-fit: cover;
        }

        .z-user-info {
            display: flex;
            flex-direction: column;
        }

        .z-username-tag {
            font-size: 14px;
            font-weight: 700;
            color: var(--z-text-white);
        }

        .z-status-online {
            font-size: 11px;
            color: #23a55a;
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: 600;
        }

        /* Otimização Crítica do Painel de Conteúdo Intermediário */
        #layout-user-explorer {
            flex: 1 1 auto !important;
            overflow-y: auto !important;
            padding: 20px;
            width: 100%;
        }

        /* Barra Inferior de Navegação Estabilizada (Footer Fixo na Base) */
        .z-navbar-footer {
            width: 100%;
            height: 75px;
            background-color: var(--z-gray-panel);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12px;
            padding: 0 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.03);
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
            z-index: 100;
            flex-shrink: 0; /* NUNCA deixa a barra sumir ou encolher para 0 */
        }

        /* Botões Estilo Project Z */
        .z-nav-btn {
            background-color: var(--z-gray-input);
            color: var(--z-text-gray);
            border: 1px solid transparent;
            padding: 12px 20px;
            border-radius: 14px;
            font-size: 13.5px;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.1s ease, background-color 0.2s, color 0.2s, border-color 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .z-nav-btn:hover {
            background-color: rgba(255, 94, 0, 0.05);
            color: var(--z-orange-neon);
            border-color: rgba(255, 94, 0, 0.2);
        }

        /* Botão Ativo / Selecionado */
        .z-nav-btn.active {
            background-color: var(--z-orange-neon);
            color: #ffffff;
            box-shadow: 0 4px 15px rgba(255, 94, 0, 0.3);
        }

        .z-nav-btn:active {
            transform: scale(0.96);
        }

        /* Responsividade Mobile Fluida */
        @media (max-width: 480px) {
            .z-navbar-footer {
                padding: 0 8px;
                gap: 4px;
                height: 65px;
            }
            .z-nav-btn {
                padding: 10px 10px;
                font-size: 11.5px;
                border-radius: 10px;
                gap: 4px;
            }
        }
    `;
    document.head.appendChild(estiloCss);

    // 3. ESTRUTURAÇÃO DO HTML DINÂMICO SEM QUEBRAR O DOM ORIGINAL
    const containerBarra = document.getElementById('layout-barra-lateral');
    const viewport = document.getElementById('app-viewport');

    if (containerBarra && viewport) {
        // Injeta a Topbar no seu local correto
        containerBarra.innerHTML = `
            <header class="z-topbar">
                <div class="z-topbar-left" onclick="navegarZHub('index.html')">
                    <div class="z-logo-badge">Z</div>
                    <span class="z-brand-title">Z-HUB</span>
                </div>
                
                <div class="z-topbar-right" onclick="navegarZHub('perfil.html')">
                    <img id="z-header-avatar" src="${resolverUrlFoto(avatarTipo)}" class="z-user-avatar" alt="Avatar">
                    <div class="z-user-info">
                        <span class="z-username-tag">@${username}</span>
                        <span class="z-status-online">● Online</span>
                    </div>
                </div>
            </header>
        `;
        
        // CORREÇÃO IMUTÁVEL: Remove o footer antigo se ele já existir por re-renderização
        const footerAntigo = document.getElementById('z-global-footer-nav');
        if (footerAntigo) footerAntigo.remove();

        // Cria o Menu Inferior Permanente acoplado direto na raiz do viewport flexbox
        const footerNav = document.createElement('footer');
        footerNav.id = "z-global-footer-nav";
        footerNav.className = "z-navbar-footer";
        footerNav.innerHTML = `
            <button class="z-nav-btn ${paginaAtual === 'index.html' ? 'active' : ''}" onclick="navegarZHub('index.html')">🏠 Início</button>
            <button class="z-nav-btn ${paginaAtual === 'sala.html' ? 'active' : ''}" onclick="navegarZHub('sala.html')">💬 Salas</button>
            <button class="z-nav-btn ${paginaAtual === 'chat.html' ? 'active' : ''}" onclick="navegarZHub('chat.html')">🔊 Chat & Call</button>
            <button class="z-nav-btn ${paginaAtual === 'perfil.html' ? 'active' : ''}" onclick="navegarZHub('perfil.html')">👤 Perfil</button>
        `;
        
        // Empurra o footer para o final absoluto do contêiner pai
        viewport.appendChild(footerNav);
    }

    // 4. PROTOCOLOS DE ESCUTA EM TEMPO REAL (Evita loops e concorrência)
    function escutarAtualizacoesDeSessao() {
        if (!window.socket) return;

        window.socket.on('login-sucesso', (dadosBackEnd) => {
            if (dadosBackEnd && dadosBackEnd.avatar) {
                const imgHeader = document.getElementById('z-header-avatar');
                if (imgHeader) {
                    imgHeader.src = resolverUrlFoto(dadosBackEnd.avatar);
                }
            }
        });
    }

    if (window.socket) {
        escutarAtualizacoesDeSessao();
    } else {
        const checker = setInterval(() => {
            if (window.socket) {
                escutarAtualizacoesDeSessao();
                clearInterval(checker);
            }
        }, 300);
    }
})();

/**
 * Roteador físico do ecossistema para troca real de páginas
 */
function navegarZHub(arquivoDestino) {
    if (!arquivoDestino) return;
    console.log(`🚀 Navegando para a página: ${arquivoDestino}`);
    window.location.href = arquivoDestino;
}
