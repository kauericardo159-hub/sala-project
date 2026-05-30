/**
 * Componente Modular 'Perfil' - Estilo Project Z
 * Gerencia a exibição dos dados da conta e alteração da foto de perfil.
 */
(function() {
    // 1. CARREGA DADOS DO USUÁRIO LOGADO
    const sessao = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
    const username = sessao.username || 'Membro Z';
    
    // Recupera o ID real se ele já tiver sido salvo, caso contrário usa um placeholder temporário até o socket responder
    let idUsuario = sessao.id && !sessao.id.startsWith('id_0.') ? sessao.id : 'Carregando ID...';

    // Recupera a foto atual (seja Base64 carregada ou ID de avatar nativo)
    let fotoAtual = localStorage.getItem(`avatar_@${username.toLowerCase()}`) || 'avatar1';
    
    // Resolve a imagem inicial que deve ser exibida na tela
    function obterUrlFoto(valor) {
        if (valor.startsWith('data:image')) return valor; // Imagem em Base64 vinda do dispositivo
        
        let seed = "Felix";
        if (valor === 'avatar2') seed = "Aneka";
        if (valor === 'avatar3') seed = "Jack";
        if (valor === 'avatar4') seed = "Midnight";
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    }

    // 2. INJEÇÃO DOS ESTILOS CSS DO PERFIL
    const estiloCss = document.createElement('style');
    estiloCss.textContent = `
        .perfil-container {
            max-width: 500px;
            margin: 40px auto;
            padding: 24px;
            background-color: #141619;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.02);
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }

        /* Avatar com efeito de clique e hover */
        .perfil-avatar-wrapper {
            position: relative;
            width: 120px;
            height: 120px;
            margin: 0 auto 20px auto;
            cursor: pointer;
        }

        .perfil-foto-exibicao {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: 3px solid #ff5e00;
            background-color: #1d2024;
            object-fit: cover;
            transition: filter 0.2s;
        }

        .perfil-avatar-wrapper:hover .perfil-foto-exibicao {
            filter: brightness(0.5);
        }

        /* Ícone de câmera que aparece no hover */
        .perfil-avatar-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ffffff;
            font-size: 20px;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
        }

        .perfil-avatar-wrapper:hover .perfil-avatar-overlay {
            opacity: 1;
        }

        .perfil-nome {
            font-size: 22px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 4px;
        }

        .perfil-id {
            font-size: 13px;
            font-weight: 600;
            color: #7c848f;
            background-color: #1d2024;
            padding: 4px 12px;
            border-radius: 20px;
            display: inline-block;
            letter-spacing: 0.5px;
        }

        /* Modal / Janela Flutuante de Seleção de Foto */
        .z-modal-perfil {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: rgba(0, 0, 0, 0.85);
            z-index: 100;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .z-modal-content {
            background-color: #141619;
            width: 100%;
            max-width: 400px;
            padding: 30px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            text-align: center;
        }

        .z-modal-content h3 {
            font-size: 18px;
            margin-bottom: 20px;
            color: #ffffff;
        }

        /* Grid de Opções do Site */
        .modal-avatar-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }

        .modal-avatar-option {
            background-color: #1d2024;
            padding: 8px;
            border-radius: 12px;
            cursor: pointer;
            border: 2px solid transparent;
            transition: border-color 0.2s;
        }

        .modal-avatar-option:hover {
            border-color: rgba(255, 94, 0, 0.5);
        }

        .modal-avatar-option img {
            width: 100%;
            height: auto;
        }

        /* Linha Divisória */
        .modal-divisor {
            height: 1px;
            background-color: rgba(255, 255, 255, 0.05);
            margin: 20px 0;
        }

        /* Botão Dispositivo */
        .btn-upload-local {
            background-color: #ff5e00;
            color: #ffffff;
            border: none;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            width: 100%;
            transition: background-color 0.2s;
        }

        .btn-upload-local:hover {
            background-color: #e05200;
        }

        .btn-fechar-modal {
            background: transparent;
            color: #7c848f;
            border: none;
            margin-top: 15px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
        }
        .btn-fechar-modal:hover {
            color: #ffffff;
        }
    `;
    document.head.appendChild(estiloCss);

    // 3. INJETA ESTRUTURA DO PERFIL E DO MODAL DE ESCOLHA
    const containerAlvo = document.getElementById('layout-user-explorer');
    if (containerAlvo) {
        containerAlvo.innerHTML = `
            <div class="perfil-container">
                <div class="perfil-avatar-wrapper" onclick="abrirSeletorFotos()">
                    <img id="z-foto-perfil-tela" src="${obterUrlFoto(fotoAtual)}" class="perfil-foto-exibicao" alt="Foto">
                    <div class="perfil-avatar-overlay">📸</div>
                </div>
                
                <h2 class="perfil-nome">@${username}</h2>
                <span id="z-id-perfil-tela" class="perfil-id">ID: ${idUsuario}</span>
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
                        📁 Escolher arquivo do aparelho
                    </button>
                    <input type="file" id="input-arquivo-oculto" accept="image/*" style="display: none;" onchange="processarFotoDispositivo(this)">

                    <br>
                    <button class="btn-fechar-modal" onclick="fecharSeletorFotos()">Cancelar</button>
                </div>
            </div>
        `;
    }

    // INTERCEPTADOR DE SEGURANÇA: Escuta a resposta do login silencioso do perfil.html para pegar o ID real do servidor
    if (window.socket) {
        window.socket.on('login-sucesso', (dadosBackEnd) => {
            if (dadosBackEnd && dadosBackEnd.id) {
                idUsuario = dadosBackEnd.id;
                
                // Atualiza visualmente na tela o ID verdadeiro vindo do banco do server.js
                const tagIdElemento = document.getElementById('z-id-perfil-tela');
                if (tagIdElemento) tagIdElemento.innerText = `ID: ${idUsuario}`;

                // Corrige o cache local salvando o ID definitivo nele também
                const dadosSessaoAtualizados = JSON.parse(localStorage.getItem('zhub_session_data') || '{}');
                dadosSessaoAtualizados.id = idUsuario;
                localStorage.setItem('zhub_session_data', JSON.stringify(dadosSessaoAtualizados));
            }
        });
    }

    // 4. FUNÇÕES INTERNAS DE CONTROLE DE INTERFACE
    window.abrirSeletorFotos = function() {
        document.getElementById('z-modal-fotos').style.display = 'flex';
    };

    window.fecharSeletorFotos = function() {
        document.getElementById('z-modal-fotos').style.display = 'none';
    };

    // 5. TRATAMENTO DE IMAGEM DO DISPOSITIVO (Transforma em Base64 limpo)
    window.processarFotoDispositivo = function(input) {
        if (input.files && input.files[0]) {
            const leitor = new FileReader();
            leitor.onload = function(e) {
                const imagemBase64 = e.target.result;
                salvarFotoPerfil(imagemBase64); // Salva o Base64 gerado
            };
            leitor.readAsDataURL(input.files[0]);
        }
    };

    // 6. PERSISTÊNCIA AUTOMÁTICA E ENVIO PARA O SALVAMENTO
    window.salvarFotoPerfil = function(novoValor) {
        // Atualiza a imagem imediatamente na tela principal e na Topbar da barra.js
        const urlResolvida = obterUrlFoto(novoValor);
        document.getElementById('z-foto-perfil-tela').src = urlResolvida;
        
        const topbarAvatar = document.querySelector('.z-user-avatar');
        if (topbarAvatar) topbarAvatar.src = urlResolvida;

        // Salva localmente no repositório de avatares do usuário em formato textual ou base64
        localStorage.setItem(`avatar_@${username.toLowerCase()}`, novoValor);
        
        fecharSeletorFotos();
        console.log("💾 Foto de perfil atualizada localmente.");

        // Despacha os dados atualizados de forma limpa para o save-conta.js
        if (typeof window.despacharParaSaveConta === "function") {
            window.despacharParaSaveConta({
                username: username,
                id: idUsuario,
                foto: novoValor
            });
        }
    };

})();
