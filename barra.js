/**
 * Componente Modular 'Barra' - Estilo Project Z (Premium Dark & Orange)
 * Injeta dinamicamente a Topbar, Sidebar e o CSS unificado.
 */
(function() {
    // 1. CARREGA DADOS DO USUÁRIO LOGADO (Recuperados do localStorage)
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const username = sessao.username || 'Visitante';
    
    // Recupera o avatar escolhido no cadastro, perfil ou define o padrão
    let avatarTipo = localStorage.getItem(`avatar_@${username.toLowerCase()}`) || 'avatar1';
    
    // Função auxiliar para resolver a URL real da imagem (Suporta SVG do Dicebear e imagens locais em Base64)
    function resolverUrlFoto(valor) {
        if (valor.startsWith('data:image')) return valor; // Imagem customizada em Base64 do dispositivo
        
        let seedAvatar = "Felix";
        if (valor === 'avatar2') seedAvatar = "Aneka";
        if (valor === 'avatar3') seedAvatar = "Jack";
        if (valor === 'avatar4') seedAvatar = "Midnight";
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seedAvatar}`;
    }

    // Descobre qual é a página atual olhando o final da URL
    const paginaAtual = window.location.pathname.split("/").pop() || "index.html";

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

        /* Estrutura do Layout Grid Pai */
        #app-viewport {
            display: flex;
            flex-direction: column;
            width: 100vw;
            height: 100vh;
            background-color: var(--z-black-pure);
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
            z-index: 10;
        }

        .z-topbar-left {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
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

        /* Container Principal Inferior */
        .z-main-content-wrapper {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: calc(100vh - 70px);
            overflow: hidden;
        }

        /* Visualização da Área do Explorer */
        #layout-user-explorer {
            flex-grow: 1;
            overflow-y: auto;
            padding: 20px;
        }

        /* Barra Inferior de Navegação (Menu de Botões) */
        .z-navbar-footer {
            width: 100%;
            background-color: var(--z-gray-panel);
            padding: 16px 24px;
            display: flex;
            justify-content: center;
            gap: 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.03);
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
        }

        /* Estilização dos Botões Estilo Project Z */
        .z-nav-btn {
            background-color: var(--z-gray-input);
            color: var(--z-text-gray);
            border: 1px solid transparent;
            padding: 12px 20px;
            border-radius: 14px;
            font-size: 13.5px;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.1s ease, background-color 0.2s, color 0.2s;
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

        /* Responsividade para telas menores */
        @media (max-width: 480px) {
            .z-navbar-footer {
                padding: 12px 10px;
                gap: 6px;
            }
            .z-nav-btn {
                padding: 10px 12px;
                font-size: 12px;
                border-radius: 10px;
            }
        }
    `;
    document.head.appendChild(estiloCss);

    // 3. ESTRUTURAÇÃO DO HTML DINÂMICO
    const containerBarra = document.getElementById('layout-barra-lateral');
    if (containerBarra) {
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
        
        const viewport = document.getElementById('app-viewport');
        const wrapper = document.createElement('div');
        wrapper.className = "z-main-content-wrapper";
        
        const explorer = document.getElementById('layout-user-explorer');
        viewport.appendChild(wrapper);
        wrapper.appendChild(explorer);

        // Injeta a barra com as 4 rotas físicas do ecossistema e marca o botão ativo baseado na URL
        const footerNav = document.createElement('footer');
        footerNav.className = "z-navbar-footer";
        footerNav.innerHTML = `
            <button class="z-nav-btn ${paginaAtual === 'index.html' ? 'active' : ''}" onclick="navegarZHub('index.html')">🏠 Início</button>
            <button class="z-nav-btn ${paginaAtual === 'sala.html' ? 'active' : ''}" onclick="navegarZHub('sala.html')">💬 Salas</button>
            <button class="z-nav-btn ${paginaAtual === 'chat.html' ? 'active' : ''}" onclick="navegarZHub('chat.html')">🔊 Chat & Call</button>
            <button class="z-nav-btn ${paginaAtual === 'perfil.html' ? 'active' : ''}" onclick="navegarZHub('perfil.html')">👤 Perfil</button>
        `;
        wrapper.appendChild(footerNav);
    }

    // INTERCEPTADOR: Sincroniza o avatar caso o login de validação retorne uma foto diferente do back-end
    if (window.socket) {
        window.socket.on('login-sucesso', (dadosBackEnd) => {
            if (dadosBackEnd && dadosBackEnd.avatar) {
                const imgHeader = document.getElementById('z-header-avatar');
                if (imgHeader) {
                    imgHeader.src = resolverUrlFoto(dadosBackEnd.avatar);
                }
            }
        });
    }
})();

/**
 * Roteador físico do ecossistema do site para trocar de páginas de verdade
 */
function navegarZHub(arquivoDestino) {
    console.log(`🚀 Navegando para a página: ${arquivoDestino}`);
    window.location.href = arquivoDestino;
}
