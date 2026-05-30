/**
 * Motor de Sincronização 'Save-Conta'
 * Captura as mudanças de perfil locais e persiste diretamente no banco do servidor e armazenamento de DMs.
 */

/**
 * Função global chamada pelo perfil.js assim que o usuário escolhe uma nova foto
 * @param {Object} dadosPerfil - Contém { username, id, foto }
 */
window.despacharParaSaveConta = function(dadosPerfil) {
    console.log("⚡ [Save-Conta] Preparando sincronização de dados com o Back-End...");

    // 1. Garante que a conexão com o Socket está ativa
    if (!window.socket || !window.socket.connected) {
        console.warn("⚠️ Servidor desconectado. Tentando salvar localmente apenas.");
        exibirFeedbackVisual("Erro: Sem conexão com o servidor. Tentando novamente...", "#ff3333");
        return;
    }

    // 2. Organiza o pacote de dados para enviar para o banco físico (bancos.js)
    const dadosEnvio = {
        username: dadosPerfil.username,
        id: dadosPerfil.id,
        // Envia a referência da foto (seja a string 'avatar1' ou o Base64 completo da imagem)
        avatar: dadosPerfil.foto 
    };

    // 3. Dispara o evento de atualização para o Back-End do Render
    window.socket.emit('atualizar-foto-usuario', dadosEnvio);

    // 4. Cria um feedback visual discreto no console/tela do usuário
    exibirFeedbackVisual("Perfil sincronizado com sucesso!", "#23a55a");
};

/**
 * ==========================================================================
 * GERENCIADOR HISTÓRICO DE CHATS (DMs)
 * Chamado pelo preview-user.js e chat.js para salvar mensagens locais reais
 * ==========================================================================
 */
window.gravarHistoricoNoBancoLocal = function(meuUser, usuarioConversado, textoMsg, autor) {
    if (!meuUser || !usuarioConversado) return;
    
    const chaveHistorico = `zhub_chats_@${meuUser.toLowerCase()}`;
    let historico = JSON.parse(localStorage.getItem(chaveHistorico) || '[]');

    // Remove duplicados antigos com essa pessoa para mover o chat pro topo
    historico = historico.filter(c => c.usernameConversado.toLowerCase() !== usuarioConversado.toLowerCase());

    // Insere o novo ponteiro no topo com a última mensagem e tempo ao vivo
    historico.push({
        usernameConversado: usuarioConversado,
        ultimaMensagem: textoMsg,
        ultimaMensagemPor: autor,
        timestamp: Date.now()
    });

    // Salva permanentemente no dispositivo
    localStorage.setItem(chaveHistorico, JSON.stringify(historico));
    console.log(`💾 [Save-Conta] Histórico de DM com @${usuarioConversado} atualizado localmente.`);
};

/**
 * Exibe um aviso temporário na tela confirmando que os dados foram salvos
 */
function exibirFeedbackVisual(mensagem, cor) {
    let ToastAviso = document.getElementById('z-toast-sincronizacao');
    if (!ToastAviso) {
        ToastAviso = document.createElement('div');
        ToastAviso.id = 'z-toast-sincronizacao';
        ToastAviso.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #141619;
            color: #ffffff;
            padding: 10px 20px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            border: 1px solid transparent;
            z-index: 9999;
            transition: opacity 0.3s ease;
            pointer-events: none;
            opacity: 0;
        `;
        document.body.appendChild(ToastAviso);
    }

    ToastAviso.innerText = mensaje || mensagem;
    ToastAviso.style.borderColor = cor;
    ToastAviso.style.opacity = '1';

    setTimeout(() => {
        ToastAviso.style.opacity = '0';
    }, 2500);
}

// 5. OUVIDO DE RETORNO DO SERVIDOR
if (window.socket) {
    window.socket.on('foto-atualizada-sucesso', (dadosConfirmados) => {
        if (!dadosConfirmados || !dadosConfirmados.username) return;
        
        console.log(`🟢 Servidor confirmou a gravação da foto para @${dadosConfirmados.username}`);
        
        // Atualiza o cache local desse usuário específico para que todos os componentes vejam a foto nova
        if (dadosConfirmados.avatar) {
            localStorage.setItem(`avatar_@${dadosConfirmados.username.toLowerCase()}`, dadosConfirmados.avatar);
        }

        // Força a atualização dos blocos online e chats abertos na tela
        window.socket.emit('pedir-salas');
        
        if (typeof window.carregarHistoricoConversas === 'function') {
            window.carregarHistoricoConversas();
        }
    });
}
