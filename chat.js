// Variáveis globais de gerenciamento da Call e Chat (P2P e Sockets)
let meuStreamAudio = null;
let meuPeer = null;
let apelidoUsuario = "";
let canalAtual = "";
const chamadasAtivas = {};

/**
 * Inicializa a estrutura interna do Chat e da Call de Áudio
 * @param {string} nomeSala - Nome do canal autorizado pelo servidor
 * @param {string} apelido - @user original do usuário logado
 */
async function inicializarPainelChatCall(nomeSala, apelido) {
    canalAtual = nomeSala;
    apelidoUsuario = apelido;

    // Efetua a transição visual ocultando o lobby e abrindo a sala
    document.getElementById('tela-salas').style.display = 'none';
    document.getElementById('tela-chat').style.display = 'flex';
    document.getElementById('nome-sala-titulo').innerText = `🔊 Canal: #${canalAtual}`;

    // Limpa e prepara o container de usuários da chamada
    const painelUsuarios = document.getElementById('painel-usuarios-call');
    if (painelUsuarios) {
        painelUsuarios.innerHTML = "";
    }

    // Configura o evento do teclado para a caixa de mensagens de texto
    configurarInputMensagem();

    // 1. CAPTURA APENAS O MICROFONE (Sem Câmera = Conexão Ultra Rápida)
    try {
        meuStreamAudio = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        // Adiciona você mesmo no topo da lista de membros da chamada
        adicionarUsuarioNaListaCall("voce_local", `${apelidoUsuario} (Você)`, true);
    } catch (erro) {
        console.warn("Aviso: Microfone indisponível ou bloqueado. Entrando no modo ouvinte.", erro);
        adicionarLogSistema("Você entrou no modo ouvinte (Microfone desativado/bloqueado).");
        adicionarUsuarioNaListaCall("voce_local", `${apelidoUsuario} (Ouvinte)`, false);
    }

    // 2. CONFIGURA O MOTOR PEERJS (Conexões de Áudio Diretas P2P)
    const extrairHost = urlServidor.replace("https://", "").replace("http://", "").split(":")[0];
    const usandoGitHubPages = window.location.hostname.includes("github.io");

    meuPeer = new Peer(undefined, {
        host: usandoGitHubPages ? extrairHost : '/',
        port: usandoGitHubPages ? '443' : window.location.port || '3000',
        secure: window.location.protocol === 'https:' || usandoGitHubPages
    });

    // Quando o canal PeerJS abrir com sucesso, conecta no Socket da sala
    meuPeer.on('open', (idAudioP2P) => {
        socket.emit('join-room', canalAtual, idAudioP2P);
    });

    // 3. ATENDE CHAMADAS DE ÁUDIO CHEGANDO DE OUTROS USUÁRIOS
    meuPeer.on('call', (chamada) => {
        // Responde enviando o nosso fluxo de áudio (se houver microfone ativo)
        chamada.answer(meuStreamAudio);
        
        const elementoAudioRemoto = document.createElement('audio');
        
        chamada.on('stream', (streamAudioMembro) => {
            reproduzirAudioMembro(elementoAudioRemoto, streamAudioMembro);
            adicionarUsuarioNaListaCall(chamada.peer, `@user_remoto_${chamada.peer.slice(0,4)}`);
        });

        chamada.on('close', () => {
            elementoAudioRemoto.remove();
            removerUsuarioDaListaCall(chamada.peer);
        });
    });

    // 4. ESCUTA NOVOS MEMBROS CONECTANDO NA SALA (Sinalização via Socket.io)
    socket.on('user-connected', (idNovoUsuarioP2P) => {
        adicionarLogSistema("Alguém se juntou ao canal de voz.");
        
        if (meuStreamAudio) {
            // Dispara uma ligação P2P direta para o microfone do novo usuário
            const chamada = meuPeer.call(idNovoUsuarioP2P, meuStreamAudio);
            const elementoAudioRemoto = document.createElement('audio');
            
            chamada.on('stream', (streamAudioMembro) => {
                reproduzirAudioMembro(elementoAudioRemoto, streamAudioMembro);
                adicionarUsuarioNaListaCall(idNovoUsuarioP2P, `@user_remoto_${idNovoUsuarioP2P.slice(0,4)}`);
            });

            chamada.on('close', () => {
                elementoAudioRemoto.remove();
                removerUsuarioDaListaCall(idNovoUsuarioP2P);
            });

            // Armazena a referência para poder desligar se ele sair
            chamadasAtivas[idNovoUsuarioP2P] = llamada;
        }
    });

    // ESCUTA QUANDO ALGUÉM CAI OU FECHA O APP
    socket.on('user-disconnected', (idUsuarioSairP2P) => {
        if (chamadasAtivas[idUsuarioSairP2P]) {
            chamadasAtivas[idUsuarioSairP2P].close();
            delete chamadasAtivas[idUsuarioSairP2P];
        }
        removerUsuarioDaListaCall(idUsuarioSairP2P);
    });
}

/**
 * Vincula o input do chat limpando instâncias antigas para otimizar a memória
 */
function configurarInputMensagem() {
    const input = document.getElementById('txt-mensagem');
    if (!input) return;

    const novoInput = input.cloneNode(true);
    input.parentNode.replaceChild(novoInput, input);

    novoInput.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter') {
            const mensagem = evento.target.value.trim();
            
            if (!mensagem) return; // Barra envios de texto em branco ou spam de espaço
            
            // Dispara o texto para a validação central do servidor Node.js
            socket.emit('send-message', mensagem, apelidoUsuario);
            evento.target.value = ""; // Reseta o campo instantaneamente
        }
    });
}

// Escuta a homologação das mensagens e renderiza na janela
socket.on('create-message', (msg, autor) => {
    const areaMensagens = document.getElementById('chat-mensagens');
    if (!areaMensagens) return;

    const bloco = document.createElement('div');
    bloco.className = "mensagem-bloco";
    
    // Altera dinamicamente o tom do nome para destacar o seu próprio texto
    const corNome = (autor === apelidoUsuario) ? "#5865f2" : "#00aff4";

    bloco.innerHTML = `
        <span class="autor" style="color: ${corNome};">${autor}:</span>
        <span class="texto">${msg}</span>
    `;

    areaMensagens.appendChild(bloco);
    
    // Arrasta a barra de rolagem de forma automática e suave para a última linha
    areaMensagens.scrollTo({ top: areaMensagens.scrollHeight, behavior: 'smooth' });
});

/**
 * Cria a linha visual do usuário dentro da lista da Call (Substitutos dos blocos de vídeo)
 */
function adicionarUsuarioNaListaCall(idCard, nomeExibicao, eOMeuPerfil = false) {
    const listaContainer = document.getElementById('painel-usuarios-call');
    if (!listaContainer || document.getElementById(`card-call-${idCard}`)) return;

    const card = document.createElement('div');
    card.id = `card-call-${idCard}`;
    card.style.cssText = `
        display: flex;
        align-items: center;
        background-color: #232428;
        padding: 10px 14px;
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.05);
        margin-bottom: 6px;
        animation: deslizarMensagem 0.2s ease-out;
    `;

    card.innerHTML = `
        <div style="width: 32px; height: 32px; background-color: #5865f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: white; margin-right: 12px;">
            ${nomeExibicao.charAt(0).toUpperCase()}
        </div>
        <div style="flex-grow: 1;">
            <span style="font-size: 14px; font-weight: 600; color: #fff; display: block;">${nomeExibicao}</span>
            <span style="font-size: 11px; color: #248046; display: block;">${eOMeuPerfil ? '🎙️ Seu Microfone Ativo' : '🔊 Ouvindo Voz'}</span>
        </div>
    `;

    listaContainer.appendChild(card);
}

/**
 * Remove o card visual de quem saiu da chamada de voz
 */
function removerUsuarioDaListaCall(idCard) {
    const card = document.getElementById(`card-call-${idCard}`);
    if (card) card.remove();
}

/**
 * Executa a reprodução física dos fluxos de áudio distribuídos via P2P
 */
function reproduzirAudioMembro(elementoAudio, stream) {
    elementoAudio.srcObject = stream;
    elementoAudio.addEventListener('loadedmetadata', () => {
        elementoAudio.play().catch(e => console.error("Erro ao reproduzir voz de canal remoto:", e));
    });
    document.body.appendChild(elementoAudio); // Mantém o fluxo anexado de forma oculta na janela
}

/**
 * Injeta alertas cinzas do sistema na timeline do chat de texto
 */
function adicionarLogSistema(texto) {
    const area = document.getElementById('chat-mensagens');
    if (!area) return;
    const log = document.createElement('div');
    log.style.cssText = "color: #949ba4; font-size: 12px; font-style: italic; margin: 4px 0;";
    log.innerText = `⚙️ ${texto}`;
    area.appendChild(log);
    area.scrollTop = area.scrollHeight;
}

/**
 * Desconecta todos os canais de hardware e socket, reiniciando o app para o estado limpo do lobby
 */
function sairDaSala() {
    if (meuStreamAudio) {
        meuStreamAudio.getTracks().forEach(track => track.stop()); // Desliga fisicamente o microfone do aparelho
    }
    if (meuPeer) {
        meuPeer.destroy(); // Fecha todas as conexões diretas P2P
    }
    window.location.reload(); // Recarrega a página de forma limpa voltando para o lobby de login estável
}
