// Variável global de escopo do arquivo para guardar o apelido do usuário logado
let meuApelido = "";

/**
 * Função acionada pelo login.js assim que o login é efetuado com sucesso.
 * Ela ativa a sincronização inicial das salas de forma segura.
 */
function iniciarSincronizacaoLobby(username) {
    meuApelido = username;
    // Pede a lista atualizada de salas para o servidor
    socket.emit('pedir-salas');
}

/**
 * Controla a exibição do campo de senha na criação de canais
 */
function alternarCampoSenha() {
    const tipo = document.getElementById('room-type').value;
    const campoSenha = document.getElementById('room-password');
    if (campoSenha) {
        campoSenha.style.display = tipo === 'privada' ? 'block' : 'none';
        if (tipo !== 'privada') campoSenha.value = ""; 
    }
}

/**
 * Coleta os dados da interface e solicita a criação de uma nova sala ao servidor
 */
function criarNovaSala() {
    const nomeInput = document.getElementById('new-room-name');
    const tipoSelect = document.getElementById('room-type');
    const senhaInput = document.getElementById('room-password');

    const nomeSala = nomeInput.value.trim();
    const tipo = tipoSelect.value;
    const senha = senhaInput.value;

    if (!meuApelido) {
        return alert("Erro crítico: Você precisa estar autenticado em uma conta para criar canais.");
    }
    if (!nomeSala) {
        return alert("O nome da sala não pode ficar em branco.");
    }
    if (tipo === 'privada' && !senha) {
        return alert("Canais privados exigem a definição de uma senha de acesso.");
    }

    // Dispara o evento de criação para o servidor Node.js
    socket.emit('criar-sala', { nomeSala, tipo, senha });
    
    // Limpa o campo de texto após o disparo
    nomeInput.value = "";
}

// Quando o servidor confirma a criação da sala, solicita automaticamente a entrada nela
socket.on('sala-criada-sucesso', (nomeSala) => {
    const senha = document.getElementById('room-password').value;
    socket.emit('tentar-entrar', { nomeSala, senha });
});

/**
 * Escuta as atualizações de salas ativas enviadas pelo servidor e renderiza na tela
 * Mostra a contagem exata e remove da lista visual as salas que sumirem (ficarem com 0 pessoas)
 */
socket.on('atualizar-salas', (salas) => {
    const containerLista = document.getElementById('lista-de-salas');
    if (!containerLista) return;

    // Se não houver salas abertas no servidor
    if (!salas || salas.length === 0) {
        containerLista.innerHTML = `<p class="txt-vazio">Nenhum canal ativo no momento. Crie o seu acima!</p>`;
        return;
    }

    containerLista.innerHTML = ""; // Limpa o painel anterior para renovar os contadores

    salas.forEach(sala => {
        const item = document.createElement('div');
        item.className = "sala-item";
        
        const iconeCadeado = sala.tipo === 'privada' ? '🔒' : '🌐';
        
        // Elemento com as informações da sala e quantidade de pessoas online
        const info = document.createElement('span');
        info.innerHTML = `
            <strong>${iconeCadeado} ${sala.id}</strong> 
            <small class="contador-usuarios" style="color: #248046; font-weight: bold; margin-left: 8px;">
                ● ${sala.participantes} ${sala.participantes === 1 ? 'usuário' : 'usuários'} online
            </small>
        `;
        
        // Botão para se juntar à sala específica
        const btnEntrar = document.createElement('button');
        btnEntrar.innerText = "Entrar";
        btnEntrar.className = "btn-entrar-sala";
        btnEntrar.onclick = () => clicarParaEntrar(sala.id, sala.tipo);

        item.appendChild(info);
        item.appendChild(btnEntrar);
        containerLista.appendChild(item);
    });
});

/**
 * Gerencia a intenção de entrada e solicita a senha caso o canal seja restrito
 */
function clicarParaEntrar(nomeSala, tipo) {
    if (!meuApelido) {
        return alert("Você precisa efetuar o login antes de acessar um canal.");
    }

    let senha = null;
    if (tipo === 'privada') {
        senha = prompt(`O canal #${nomeSala} é protegido por senha. Digite a senha para obter acesso:`);
        if (senha === null) return; // Cancelou o prompt do navegador
    }

    // Solicita autorização de entrada enviando as credenciais da sala
    socket.emit('tentar-entrar', { nomeSala, senha });
}

// Resposta do servidor liberando a entrada: Delega o controle para o chat.js passandro o apelido real
socket.on('entrada-autorizada', (nomeSala) => {
    if (typeof inicializarPainelChatCall === "function") {
        // Envia o nome do canal e o apelido do usuário logado para amarrar os sockets e peers
        inicializarPainelChatCall(nomeSala, meuApelido);
    } else {
        console.error("Erro do sistema: O módulo de chat/call (chat.js) não foi carregado.");
    }
});
