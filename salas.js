// Variáveis de controle de estado das salas
let meuApelido = "";

/**
 * Controla a exibição do campo de senha na criação de canais
 */
function alternarCampoSenha() {
    const tipo = document.getElementById('room-type').value;
    const campoSenha = document.getElementById('room-password');
    if (campoSenha) {
        campoSenha.style.display = tipo === 'privada' ? 'block' : 'none';
        if (tipo !== 'privada') campoSenha.value = ""; // Limpa lixo de digitação
    }
}

/**
 * Coleta os dados da interface e solicita a criação de uma nova sala ao servidor
 */
function criarNovaSala() {
    const apelidoInput = document.getElementById('username');
    const nomeInput = document.getElementById('new-room-name');
    const tipoSelect = document.getElementById('room-type');
    const senhaInput = document.getElementById('room-password');

    const apelido = apelidoInput.value.trim();
    const nomeSala = nomeInput.value.trim();
    const tipo = tipoSelect.value;
    const senha = senhaInput.value;

    // Validações de segurança no Front-End
    if (!apelido) return alert("Por favor, escolha um apelido para sua conta antes de continuar.");
    if (!nomeSala) return alert("O nome da sala não pode ficar em branco.");
    if (tipo === 'privada' && !senha) return alert("Canais privados precisam de uma senha de acesso.");

    meuApelido = apelido;
    
    // Dispara o evento de criação para o servidor Node.js
    socket.emit('criar-sala', { nomeSala, tipo, senha });
}

// Quando o servidor confirma a criação da sala com sucesso, nós entramos nela automaticamente
socket.on('sala-criada-sucesso', (nomeSala) => {
    const senha = document.getElementById('room-password').value;
    socket.emit('tentar-entrar', { nomeSala, senha });
});

/**
 * Escuta as atualizações de salas ativas enviadas pelo servidor e renderiza na tela
 */
socket.on('atualizar-salas', (salas) => {
    const containerLista = document.getElementById('lista-de-salas');
    if (!containerLista) return;

    // Se o array de salas vier limpo do banco/servidor
    if (!salas || salas.length === 0) {
        containerLista.innerHTML = `<p class="txt-vazio">Nenhum canal ativo no momento. Crie o seu acima!</p>`;
        return;
    }

    containerLista.innerHTML = ""; // Limpa a lista antiga para evitar repetições

    salas.forEach(sala => {
        const item = document.createElement('div');
        item.className = "sala-item";
        
        // Define o ícone de privacidade
        const iconeCadeado = sala.tipo === 'privada' ? '🔒' : '🌐';
        
        // Elemento com as informações da sala
        const info = document.createElement('span');
        info.innerHTML = `<strong>${iconeCadeado} ${sala.id}</strong> <small style="color: #949ba4; margin-left: 5px;">(${sala.participantes} online)</small>`;
        
        // Botão de ação de entrada
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
 * Gerencia o clique no botão entrar e solicita senha se a sala for privada
 */
function clicarParaEntrar(nomeSala, tipo) {
    const apelido = document.getElementById('username').value.trim();
    if (!apelido) return alert("Digite o seu apelido antes de tentar se conectar a um canal.");
    
    meuApelido = apelido;
    let senha = null;

    if (tipo === 'privada') {
        senha = prompt(`O canal #${nomeSala} é privado. Digite a senha para entrar:`);
        if (senha === null) return; // Usuário cancelou o prompt do navegador
    }

    // Solicita autorização de entrada ao servidor
    socket.emit('tentar-entrar', { nomeSala, senha });
}

// Resposta do servidor liberando a entrada: Delega o controle para a inicialização do chat.js
socket.on('entrada-autorizada', (nomeSala) => {
    if (typeof inicializarPainelChatCall === "function") {
        inicializarPainelChatCall(nomeSala, meuApelido);
    } else {
        console.error("Erro crítico: A função de inicialização do chat/call não foi encontrada.");
    }
});
