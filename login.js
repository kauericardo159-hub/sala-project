let modoCadastro = false;
let contaLogada = { username: "", id: "" };

/**
 * Altera dinamicamente os textos e o comportamento da tela entre Login e Registro
 * @param {boolean} queroRegistrar - Define se a tela vai para o modo de cadastro
 */
function alternarModoAuth(queroRegistrar) {
    modoCadastro = queroRegistrar;
    const titulo = document.getElementById('login-titulo');
    const subtitulo = document.getElementById('login-subtitulo');
    const botao = document.getElementById('btn-auth-acao');
    const alternador = document.getElementById('txt-alternar-auth');

    // Limpa os campos ao alternar para evitar carregar dados incorretos
    document.getElementById('login-username').value = "";
    document.getElementById('login-password').value = "";

    if (modoCadastro) {
        titulo.innerText = "Criar uma conta";
        subtitulo.innerText = "Escolha um @user original e uma senha segura";
        botao.innerText = "Registrar-se";
        alternador.innerHTML = 'Já tem uma conta? <span onclick="alternarModoAuth(false)">Entrar</span>';
    } else {
        titulo.innerText = "Boas-vindas de volta!";
        subtitulo.innerText = "Estamos muito animados em ver você de novo!";
        botao.innerText = "Entrar";
        alternador.innerHTML = 'Precisando de uma conta? <span onclick="alternarModoAuth(true)">Registre-se</span>';
    }
}

/**
 * Coleta os dados digitados e despacha o evento correspondente para o servidor Node.js
 */
function executarAutenticacao() {
    const userIn = document.getElementById('login-username').value.trim();
    const passIn = document.getElementById('login-password').value;

    if (!userIn || !passIn) {
        return alert("Por favor, preencha todos os campos antes de prosseguir.");
    }

    if (modoCadastro) {
        socket.emit('cadastrar-usuario', { username: userIn, senha: passIn });
    } else {
        socket.emit('login-usuario', { username: userIn, senha: passIn });
    }
}

// Escuta a confirmação de cadastro bem-sucedido vinda do servidor
socket.on('cadastro-sucesso', (dados) => {
    alert(`Conta @${dados.username} gerada e salva com sucesso! Prossiga fazendo o seu login.`);
    alternarModoAuth(false); // Transiciona o usuário de volta para a tela de login
});

// Escuta o sucesso de login, liberando o acesso ao Lobby de canais
socket.on('login-sucesso', (dados) => {
    contaLogada = dados;

    // Atualiza os dados de perfil no topo do Lobby (salas.js)
    document.getElementById('perfil-tag-usuario').innerText = `@${dados.username}`;
    document.getElementById('perfil-id-usuario').innerText = `ID: ${dados.id}`;

    // Executa a transição visual das telas ocultando o login e mostrando as salas
    document.getElementById('tela-autenticacao').style.display = 'none';
    document.getElementById('tela-salas').style.display = 'block';
    
    // Alinha o barramento global do salas.js para usar o nick autenticado
    if (typeof iniciarSincronizacaoLobby === "function") {
        iniciarSincronizacaoLobby(dados.username);
    } else {
        // Fallback caso o salas.js ainda não tenha carregado a função
        meuApelido = dados.username;
        socket.emit('pedir-salas');
    }
});
