/**
 * Componente Modular 'Perfil' - Estilo Project Z (Premium Dark & Neon)
 * Gerencia a exibição dos dados da conta, biografia, badges e alteração da foto de perfil.
 */
(function() {
    // 1. CARREGA DADOS DO USUÁRIO LOGADO
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const username = sessao.username || 'Membro Z';
    
    // Recupera o ID real se ele já tiver sido salvo, caso contrário usa um placeholder temporário
    let idUsuario = sessao.id && !sessao.id.startsWith('id_0.') ? sessao.id : 'Carregando ID...';

    // Recupera a foto atual (seja Base64 carregada ou ID de avatar nativo)
    let fotoAtual = localStorage.getItem(`avatar_@${username.toLowerCase()}`) || 'avatar1';
    
    // Recupera a bio salva ou define uma padrão
    let bioAtual = localStorage.getItem(`bio_@${username.toLowerCase()}`) || 'Olá! Estou explorando o ecossistema modular do Z-Hub.';

    // Resolve a imagem inicial que deve ser exibida na tela
    function obterUrlFoto(valor) {
        if (valor && valor.startsWith('data:image')) return valor; // Imagem em Base64 vinda do dispositivo
        
        let seed = "Felix";
        if (valor === 'avatar2') seed = "Aneka";
        if (valor === 'avatar3') seed = "Jack";
        if (valor === 'avatar4') seed = "Midnight";
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    }

    // 2. INJEÇÃO DOS ESTILOS CSS DO PERFIL
    const estiloCss = document.createElement('style');
    estiloCss.textContent = `
        .perfil-wrapper-scroller {
            width: 100%;
            max-width: 520px;
            margin: 20px auto;
            padding: 0 15px;
        }

        .perfil-container {
            background-color: var(--z-gray-panel, #141619);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.03);
            text-align: center;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5);
            position: relative;
            overflow: hidden;
            padding: 30px 24px;
        }

        /* Linha neon de design superior */
        .perfil-container::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 5px;
            background: linear-gradient(90deg, var(--z-orange-neon, #ff5e00), #ff8800);
        }

        /* Avatar com efeito de clique e hover */
        .perfil-avatar-wrapper {
            position: relative;
            width: 115px;
            height: 115px;
            margin: 10px auto 16px auto;
            cursor: pointer;
        }

        .perfil-foto-exibicao {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 3px solid var(--z-orange-neon, #ff5e00);
            background-color: var(--z-gray-input, #1d2024);
            object-fit: cover;
            transition: transform 0.2s, filter 0.2s;
            box-shadow: 0 0 20px rgba(255, 94, 0, 0.2);
        }

        .perfil-avatar-wrapper:hover .perfil-foto-exibicao {
            filter: brightness(0.4);
            transform: scale(1.02);
        }

        .perfil-avatar-overlay {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            color: #ffffff;
            font-size: 22px;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
        }

        .perfil-avatar-wrapper:hover .perfil-avatar-overlay {
            opacity: 1;
        }

        .perfil-nome {
            font-size: 24px;
            font-weight: 800;
            color: var(--z-text-white, #ffffff);
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }

        /* Bloco do ID com clique para copiar */
        .perfil-id-badge {
            font-size: 12.5px;
            font-weight: 700;
            color: var(--z-text-gray, #7c848f);
            background-color: var(--z-gray-input, #1d2024);
            padding: 6px 14px;
            border-radius: 20px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: background-color 0.2s, color 0.2s;
            border: 1px solid rgba(255, 255, 255, 0.01);
        }

        .perfil-id-badge:hover {
            background-color: rgba(255, 94, 0, 0.08);
            color: var(--z-orange-neon, #ff5e00);
        }

        /* Painel de Badges/Conquistas */
        .perfil-badges-section {
            margin: 24px 0;
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .z-badge {
            padding: 5px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .z-badge-dev { background-color: rgba(255, 94, 0, 0.1); color: #ff5e00; border: 1px solid rgba(255, 94, 0, 0.15); }
        .z-badge-beta { background-color: rgba(0, 170, 255, 0.1); color: #00aaff; border: 1px solid rgba(0, 170, 255, 0.15); }

        /* Área de Status/Bio Customizável */
        .perfil-bio-box {
            background-color: var(--z-gray-input, #1d2024);
            border-radius: 16px;
            padding: 16px;
            text-align: left;
            margin-top: 10px;
            border: 1px solid rgba(255, 255, 255, 0.01);
        }

        .perfil-bio-label {
            font-size: 11px;
            font-weight: 800;
            color: var(--z-text-gray, #7c848f);
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .perfil-bio-btn-editar {
            background: transparent;
            border: none;
            color: var(--z-orange-neon, #ff5e00);
            font-weight: 700;
            font-size: 11px;
            cursor: pointer;
        }

        .perfil-bio-text {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.85);
            line-height: 1.5;
            word-break: break-word;
        }

        .perfil-bio-textarea {
            width: 100%;
            height: 65px;
            background-color: #141619;
            border: 1px solid rgba(255, 94, 0, 0.3);
            border-radius: 8px;
            color: #ffffff;
            padding: 8px;
            font-size: 13.5px;
            resize: none;
            outline: none;
            font-family: inherit;
        }

        /* Modal de Seleção de Foto */
        .z-modal-perfil {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: rgba(0, 0, 0, 0.85);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .z-modal-content {
            background-color: #141619;
            width: 100%;
            max-width: 380px;
            padding: 24px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            text-align: center;
        }

        .z-modal-content h3 {
            font-size: 17px;
            margin-bottom: 18px;
            color: #ffffff;
            font-weight: 800;
        }

        .modal-avatar-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }

        .modal-avatar-option {
            background-color: #1d2024;
            padding: 6px;
            border-radius: 12px;
            cursor: pointer;
            border: 2px solid transparent;
            transition: border-color 0.2s, transform 0.1s;
        }

        .modal-avatar-option:hover {
            border-color: var(--z-orange-neon, #ff5e00);
            transform: scale(1.05);
        }

        .modal-avatar-option img {
            width: 100%;
            height: auto;
            border-radius: 50%;
        }

        .modal-divisor {
            height: 1px;
            background-color: rgba(255, 255, 255, 0.06);
            margin: 16px 0;
        }

        .btn-upload-local {
            background-color: var(--z-orange-neon, #ff5e00);
            color: #ffffff;
            border: none;
            padding: 12px;
            border-radius: 12px;
            font-weight: 800;
            font-size: 14px;
            cursor: pointer;
            width: 100%;
            transition: opacity 0.2s;
        }

        .btn-upload-local:hover { opacity: 0.9; }
        .btn-fechar-modal { background: transparent; color: #7c848f; border: none; margin-top: 14px; cursor: pointer; font-weight: 700; font-size: 13px; }
        .btn-fechar-modal:hover { color: #ffffff; }
    `;
    document.head.appendChild(estiloCss);

    // 3. INJETA ESTRUTURA COMPLETA DO PERFIL
    const containerAlvo = document.getElementById('layout-user-explorer');
    if (containerAlvo) {
        containerAlvo.innerHTML = `
            <div class="perfil-wrapper-scroller">
                <div class="perfil-container">
                    
                    <div class="perfil-avatar-wrapper" onclick="abrirSeletorFotos()">
                        <img id="z-foto-perfil-tela" src="${obterUrlFoto(fotoAtual)}" class="perfil-foto-exibicao" alt="Foto">
                        <div class="perfil-avatar-overlay">📸</div>
                    </div>
                    
                    <h2 class="perfil-nome">@${username}</h2>
                    <div id="z-id-perfil-tela" class="perfil-id-badge" onclick="copiarIDUsuario()">
                        <span>ID: ${idUsuario}</span> 📋
                    </div>

                    <div class="perfil-badges-section">
                        <span class="z-badge z-badge-dev">🛠️ Desenvolvedor</span>
                        <span class="z-badge z-badge-beta">🚀 Z-Beta Tester</span>
                    </div>

                    <div class="perfil-bio-box">
                        <div class="perfil-bio-label">
                            <span>Status / Biografia</span>
                            <button id="z-bio-btn-acao" class="perfil-bio-btn-editar" onclick="alternarModoBio()">Editar</button>
                        </div>
                        <div id="z-bio-corpo">
                            <p id="z-bio-texto-exibicao" class="perfil-bio-text"></p>
                        </div>
                    </div>

                </div>
            </div>

            <div id="z-modal-fotos" class="z-modal-perfil">
                <div class="z-modal-content">
                    <h3>Mudar foto de perfil</h3>
                    
                    <div class="modal-avatar-grid">
                        <div class="modal-avatar-option" onclick="salvarFotoPerfil('avatar1')"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=Felix"></div>
                        <div class="modal-avatar-option" onclick="salvarFotoPerfil('avatar2')"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=Aneka"></div>
                        <div class="modal-avatar-option" onclick="salvarFotoPerfil('avatar3')"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=Jack"></div>
                        <div class="modal-avatar-option" onclick="salvarFotoPerfil('avatar4')"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=Midnight"></div>
                    </div>

                    <div class="modal-divisor"></div>

                    <button class="btn-upload-local" onclick="document.getElementById('input-arquivo-oculto').click()">
                        📁 Escolher do Aparelho
                    </button>
                    <input type="file" id="input-arquivo-oculto" accept="image/*" style="display: none;" onchange="processarFotoDispositivo(this)">

                    <br>
                    <button class="btn-fechar-modal" onclick="fecharSeletorFotos()">Cancelar</button>
                </div>
            </div>
        `;
        
        // Renderiza o texto inicial higienizado da Bio
        document.getElementById('z-bio-texto-exibicao').innerText = bioAtual;
    }

    // 4. SISTEMA DE COPILAÇÃO DO ID
    window.copiarIDUsuario = function() {
        if (idUsuario.includes('...')) return;
        navigator.clipboard.writeText(idUsuario).then(() => {
            const badge = document.querySelector('.perfil-id-badge span');
            const textoOriginal = badge.innerText;
            badge.innerText = "Copiado com sucesso!";
            setTimeout(() => { badge.innerText = textoOriginal; }, 1500);
        });
    };

    // 5. INTERATIVIDADE DA BIOGRAFIA (Salvar/Editar sem travar)
    let emModoEdicaoBio = false;
    window.alternarModoBio = function() {
        const corpoBio = document.getElementById('z-bio-corpo');
        const btnAcao = document.getElementById('z-bio-btn-acao');

        if (!emModoEdicaoBio) {
            // Entra em modo de edição mudando para textarea
            emModoEdicaoBio = true;
            btnAcao.innerText = "Salvar";
            corpoBio.innerHTML = `<textarea id="z-bio-input-campo" class="perfil-bio-textarea" maxlength="160"></textarea>`;
            document.getElementById('z-bio-input-campo').value = bioAtual;
            document.getElementById('z-bio-input-campo').focus();
        } else {
            // Sai do modo salvando as alterações
            emModoEdicaoBio = false;
            btnAcao.innerText = "Editar";
            const textoDigitado = document.getElementById('z-bio-input-campo').value.trim() || 'Sem biografia.';
            bioAtual = textoDigitado;
            
            // Grava localmente no repositório do usuário
            localStorage.setItem(`bio_@${username.toLowerCase()}`, bioAtual);
            corpoBio.innerHTML = `<p id="z-bio-texto-exibicao" class="perfil-bio-text"></p>`;
            document.getElementById('z-bio-texto-exibicao').innerText = bioAtual;
        }
    };

    // INTERCEPTADOR DE SEGURANÇA: Atualiza o ID em tempo real assim que o back-end autentica
    if (window.socket) {
        window.socket.on('login-sucesso', (dadosBackEnd) => {
            if (dadosBackEnd && dadosBackEnd.id) {
                idUsuario = dadosBackEnd.id;
                const tagIdElemento = document.getElementById('z-id-perfil-tela');
                if (tagIdElemento) tagIdElemento.querySelector('span').innerText = `ID: ${idUsuario}`;

                const dadosSessaoAtualizados = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
                dadosSessaoAtualizados.id = idUsuario;
                localStorage.setItem('zhub_session_data', JSON.stringify(dadosSessaoAtualizados));
            }
        });
    }

    // 6. FUNÇÕES DO SELETOR DE IMAGENS
    window.abrirSeletorFotos = function() { document.getElementById('z-modal-fotos').style.display = 'flex'; };
    window.fecharSeletorFotos = function() { document.getElementById('z-modal-fotos').style.display = 'none'; };

    window.processarFotoDispositivo = function(input) {
        if (input.files && input.files[0]) {
            const leitor = new FileReader();
            leitor.onload = function(e) {
                salvarFotoPerfil(e.target.result);
            };
            leitor.readAsDataURL(input.files[0]);
        }
    };

    window.salvarFotoPerfil = function(novoValor) {
        const urlResolvida = obterUrlFoto(novoValor);
        document.getElementById('z-foto-perfil-tela').src = urlResolvida;
        
        const topbarAvatar = document.querySelector('.z-user-avatar');
        if (topbarAvatar) topbarAvatar.src = urlResolvida;

        localStorage.setItem(`avatar_@${username.toLowerCase()}`, novoValor);
        fecharSeletorFotos();

        if (typeof window.despacharParaSaveConta === "function") {
            window.despacharParaSaveConta({
                username: username,
                id: idUsuario,
                foto: novoValor
            });
        }
    };
})();
