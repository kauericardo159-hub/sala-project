// Variáveis globais de controle da Call e do Chat
let meuStreamAudio = null;
let meuPeer = null;
let apelidoUsuario = "";
let canalAtual = "";
const chamadasAtivas = {};
const listaParticipantesNaCall = new Set();

/**
 * Inicializa a Tela do Chat e da Call de Voz após a autorização do servidor
 */
async function inicializarPainelChatCall(nomeSala, apelido) {
    canalAtual = nomeSala;
    apelidoUsuario = apelido;

    // Transiciona as telas visualmente
    document.getElementById('tela-salas').style.display = 'none';
    document.getElementById('tela-chat').style.display = 'flex';
    document.getElementById('nome-sala-titulo').innerText = `🔊 Canal de Voz: #${canalAtual}`;

    // Altera o Grid de Vídeo para um container de Avatares de Áudio
    const grid = document.getElementById('video-grid');
    grid.innerHTML = `
        <div id="painel-usuarios-call" style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
            <!-- A lista de quem está falando entra aqui dinamicamente -->
        </div>
    `;

    // Configura o Campo de Entrada de Texto do Chat
    configurarInputMensagem();

    // 1. CAPTURA APENAS O MICROFONE (Sem Câmera para máxima velocidade)
    try {
        meuStreamAudio = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        adicionarIndicadorUsuarioNaTela(meuPeer?.id || "Você", apelidoUsuario, true);
    } catch (erro) {
        console.warn("Aviso: Microfone não detectado ou bloqueado. Entrando como ouvinte.", erro);
        adicionarLogSistema("Você entrou no modo de observação (microfone desativado).");
    }

    // 2. CONFIGURA CONEXÃO PEERJS DINÂMICA (P2P DE ÁUDIO)
    const extrairHost = urlServidor.replace("https://", "").replace("http://", "").split(":")[0];
    const usandoGitHubPages = window.location.hostname.includes("github.io");

    meuPeer = new Peer(undefined, {
        host: usandoGitHubPages ? extrairHost : '/',
        port: usandoGitHubPages ? '443' : window.location.port || '3000',
        secure: window.location.protocol === 'https:' || usandoGitHubPages
    });

    // Quando o PeerJS conecta com sucesso, avisa o Socket.io para entrar na sala
    meuPeer.on('open', (idAudioP2P) => {
        socket.emit('join-room', canalAtual, idAudioP2P);
        // Atualiza o seu próprio card com o ID correto do Peer
        const meuCard = document.getElementById("user-card-Você");
        if (meuCard) meuCard.id = `user-card-${idAudioP2P}`;
    });

    // 3. RECEBER CHAMADAS DE ÁUDIO DE OUTROS USUÁRIOS
    meuPeer.on('call', (chamada) => {
        chamada.answer(meuStreamAudio); // Responde enviando o próprio microfone
        
        const audioRemoto = document.createElement('audio');
        chamada.on('stream', (streamAudioRemoto) => {
            reproduzirAudioRemoto(audioRemoto, streamAudioRemoto);
            adicionarIndicadorUsuarioNaTela(chamada.peer, `Usuário (${chamada.peer.slice(0,4)})`);
        });

        chamada.on('close', () => {
            audioRemoto.remove();
            removerIndicadorUsuarioDaTela(chamada.peer);
        });
    });

    // 4. SINALIZAÇÃO DE ENTRADA DE NOVOS MEMBROS (Socket.io)
    socket.on('user-connected', (idNovoUsuario) => {
        adicionarLogSistema("Um novo usuário se juntou ao canal de voz.");
        
        if (meuStreamAudio) {
            // Liga para o novo usuário enviando nosso áudio
            const chamada = meuPeer.call(idNovoUsuario, meuStreamAudio);
            const audioRemoto = document.createElement('audio');
            
            chamada.on('stream', (streamAudioRemoto) => {
                reproduzirAudioRemoto(audioRemoto, streamAudioRemoto);
                adicionarIndicadorUsuarioNaTela(idNovoUsuario, `Usuário (${idNovoUsuario.slice(0,4)})`);
            });

            chamada.on('close', () => {
                audioRemoto.remove();
                removerIndicadorUsuarioDaTela(idNovoUsuario);
            });

            chamadasAtivas[idNovoUsuario] = chamada;
        }
    });

    // SINALIZAÇÃO DE SAÍDA DE MEMBROS
    socket.on('user-disconnected', (idUsuarioSair) => {
        if (chamadasAtivas[idUsuarioSair]) {
            chamadasAtivas[idUsuarioSair].close();
            delete chamadasAtivas[idUsuarioSair];
        }
        removerIndicadorUsuarioDaTela(idUsuarioSair);
    });
}

/**
 * Configura o input de chat de texto com validações e envio aprimorado
 */
function configurarInputMensagem() {
    const input = document.getElementById('txt-mensagem');
    if (!input) return;

    // Substitui para limpar qualquer listener duplicado antigo da memória
    const novoInput = input.cloneNode(true);
    input.parentNode.replaceChild(novoInput, input);

    novoInput.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter') {
            const mensagem = evento.target.value.trim();
            
            if (!mensagem) return; // Impede o envio de textos vazios ou espaços em branco
            
            // Envia para o servidor processar e distribuir
            socket.emit('send-message', mensagem, apelidoUsuario);
            evento.target.value = ""; // Limpa a barra de digitação instantaneamente
        }
    });
}

/**
 * Escuta as mensagens que o servidor homologa e renderiza na janela de chat
 */
socket.on('create-message', (msg, autor) => {
    const areaMensagens = document.getElementById('chat-mensagens');
    if (!areaMensagens) return;

    const bloco = document.createElement('div');
    bloco.className = "mensagem-bloco";
    
    // Altera a cor se a mensagem for sua para melhor legibilidade
    const corNome = (autor === apelidoUsuario) ? "#5865f2" : "#00aff4";

    bloco.innerHTML = `
        <span class="autor" style="color: ${corNome};">${autor}:</span>
        <span class="texto">${msg}</span>
    `;

    areaMensagens.appendChild(bloco);
    
    // Faz o scroll descer suavemente para exibir a nova mensagem
    areaMensagens.scrollTo({
        top: areaMensagens.scrollHeight,
        behavior: 'smooth'
    });
});

/**
 * Cria um componente visual de avatar com o nome de quem está na call
 */
function adicionarIndicadorUsuarioNaTela(idPeer, nomeExibicao, mutado = false) {
    const listaContainer = document.getElementById('painel-usuarios-call');
    if (!listaContainer || document.getElementById(`user-card-${idPeer}`)) return;

    const card = document.createElement('div');
    card.id = `user-card-${idPeer}`;
    card.style.cssText = `
        display: flex;
        align-items: center;
        background-color: #232428;
        padding: 10px 14px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.05);
        animation: deslizarMensagem 0.2s ease-out;
    `;

    card.innerHTML = `
        <div style="width: 32px; height: 32px; background-color: #5865f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: white; margin-right: 12px;">
            ${nomeExibicao.charAt(0).toUpperCase()}
        </div>
        <div style="flex-grow: 1;">
            <span style="font-size: 14px; font-weight: 600; color: #fff;">${nomeExibicao}</span>
            <span style="display: block; font-size: 11px; color: #248046;">${mutado ? '🎙️ Seu Microfone' : '🔊 Conectado'}</span>
        </div>
    `;

    listaContainer.appendChild(card);
}

/**
 * Remove o indicador visual de quem saiu da call
 */
function removerIndicadorUsuarioDaTela(idPeer) {
    const card = document.getElementById(`user-card-${idPeer}`);
    if (card) card.remove();
}

/**
 * Inicializa a tag interna oculta de áudio para reproduzir a voz dos outros participantes
 */
function reproduzirAudioRemoto(elementoAudio, stream) {
    elementoAudio.srcObject = stream;
    elementoAudio.addEventListener('loadedmetadata', () => {
        elementoAudio.play().catch(e => console.error("Erro ao tocar áudio remoto:", e));
    });
    document.body.appendChild(elementoAudio); // Anexa oculto na página para manter o fluxo ativo
}

/**
 * Insere logs informativos cinzas no histórico do chat
 */
function adicionarLogSistema(texto) {
    const area = document.getElementById('chat-mensagens');
    if (!area) return;
    
    const log = document.createElement('div');
    log.style.cssText = "color: #949ba4; font-size: 12px; font-style: italic; margin: 4px 0; text-align: left;";
    log.innerText = `⚙️ ${texto}`;
    area.appendChild(log);
    area.scrollTop = area.scrollHeight;
}

/**
 * Desconecta tudo e recarrega a página de forma limpa voltando para o lobby
 */
function sairDaSala() {
    if (meuStreamAudio) {
        meuStreamAudio.getTracks().forEach(track => track.stop()); // Desliga o hardware de microfone do celular
    }
    if (meuPeer) {
        meuPeer.destroy(); // Derruba as conexões P2P
    }
    window.location.reload(); // Recarrega para resetar o estado
}
