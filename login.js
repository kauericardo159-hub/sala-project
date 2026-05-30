let modoCadastroAtivo = false;

/**
 * Verifica sessões salvas assim que a página termina de renderizar no dispositivo
 */
window.addEventListener('DOMContentLoaded', () => {
    const cacheSessao = localStorage.getItem('zhub_session_data');
    if (cacheSessao) {
        try {
            const dados = JSON.parse(cacheSessao);
            console.log(`🔄 Reconexão Automática: Solicitando acesso para @${dados.username}`);
            
            // Dispara validação automática direto com o servidor Render
            if (socket.connected) {
                despacharValidacaoSilenciosa(dados);
            } else {
                socket.on('connect', () => despacharValidacaoSilenciosa(dados));
            }
        } catch (err) {
            localStorage.removeItem('zhub_session_data');
        }
    }
});

function despacharValidacaoSilenciosa(dados) {
    document.getElementById('auth-main-title').innerText = "Restaurando sessão...";
    socket.emit('login-usuario', { username: dados.username, senha: dados.senha });
}

/**
 * Alterna dinamicamente a UI entre Entrar na Conta e Criar uma Conta
 */
function alternarModoProjectZ(queroRegistrar) {
    modoCadastroAtivo = queroRegistrar;
    
    const titulo = document.getElementById('auth-main-title');
    const subtitulo = document.getElementById('auth-sub-title');
    const botao = document.getElementById('btn-auth-submit');
    const alternadorText = document.getElementById('auth-switch-text');
    const painelAvatar = document.getElementById('container-avatar-cadastro');

    // Reseta inputs para transição limpa
    document.getElementById('auth-username').value = "";
    document.getElementById('auth-password').value = "";

    if (modoCadastroAtivo) {
        titulo.innerText = "Criar uma conta";
        subtitulo.innerText = "Escolha uma tag de usuário única e um avatar.";
        botao.innerText = "Criar minha conta";
        painelAvatar.style.display = "block";
        alternadorText.innerHTML = 'Já tem uma conta? <span onclick="alternarModoProjectZ(false)">Entrar na conta</span>';
    } else {
        titulo.innerText = "Boas-vindas de volta!";
        subtitulo.innerText = "Insira suas credenciais para acessar o lobby.";
        botao.innerText = "Entrar na conta";
        painelAvatar.style.display = "none";
        alternadorText.innerHTML = 'Precisando de uma conta? <span onclick="alternarModoProjectZ(true)">Criar uma conta</span>';
    }
}

/**
 * Recolhe os dados e faz o envio dos pacotes via websockets
 */
function gerenciarSubmissaoAuth() {
    const userIn = document.getElementById('auth-username').value.trim();
    const passIn = document.getElementById('auth-password').value;
    const botao = document.getElementById('btn-auth-submit');

    if (!userIn || !passIn) {
        return alert("Por favor, preencha todos os campos obrigatórios.");
    }

    // Trava preventiva contra múltiplos cliques agressivos
    botao.disabled = true;
    botao.style.opacity = "0.6";
    botao.innerText = modoCadastroAtivo ? "Registrando dados..." : "Autenticando...";

    // Salva a senha na memória RAM volátil para o localStorage caso o login seja aceito
    window.senhaTemporariaSessao = passIn;

    if (modoCadastroAtivo) {
        // Coleta o avatar selecionado no grid de opções
        const avatarSelecionado = document.querySelector('input[name="user-avatar"]:checked').value;
        
        // Armazena a preferência de avatar localmente
        localStorage.setItem(`avatar_@${userIn.toLowerCase()}`, avatarSelecionado);

        socket.emit('cadastrar-usuario', { username: userIn, senha: passIn });
    } else {
        socket.emit('login-usuario', { username: userIn, senha: passIn });
    }
}

function resetarEstadoBotao() {
    const botao = document.getElementById('btn-auth-submit');
    if (botao) {
        botao.disabled = false;
        botao.style.opacity = "1";
        botao.innerText = modoCadastroAtivo ? "Criar minha conta" : "Entrar na conta";
    }
}

// Resposta em caso de sucesso no Registro
socket.on('cadastro-sucesso', (dados) => {
    alert(`Conta @${dados.username} gerada com sucesso! Entre agora usando seus dados.`);
    resetarEstadoBotao();
    alternarModoProjectZ(false); // Transiciona para a tela de Login
});

// Resposta em caso de sucesso no Login (Manual ou Automático)
socket.on('login-sucesso', (dados) => {
    console.log("🟢 Login aceito pelo servidor.");

    // Se houve preenchimento manual de senha, valida e grava a persistência de longo prazo
    if (window.senhaTemporariaSessao) {
        localStorage.setItem('zhub_session_data', JSON.stringify({
            username: dados.username,
            senha: window.senhaTemporariaSessao
        }));
        delete window.senhaTemporariaSessao;
    }

    // Redireciona o usuário oficialmente para o arquivo index.html (Lobby de salas)
    window.location.href = "index.html";
});
