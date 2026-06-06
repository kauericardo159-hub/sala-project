"use strict";

// ui-navigation.js - Controle de Fluxo de Telas e Navegação Responsiva

import { appState } from './main.js';

// ==========================================
// 1. CONFIGURAÇÃO DOS ESCUTADORES DE NAVEGAÇÃO
// ==========================================
export function setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const btnGlobalLogout = document.getElementById("btn-global-logout");

    // Vincula o clique de cada botão da barra à sua respectiva View
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetViewId = btn.getAttribute("data-target");
            if (targetViewId) {
                changeView(targetViewId);
            }
        });
    });

    // Botão de deslogar da conta global
    if (btnGlobalLogout) {
        btnGlobalLogout.addEventListener("click", () => {
            if (confirm("Deseja realmente encerrar sua sessão no Sala Project?")) {
                executeGlobalLogout();
            }
        });
    }
}

// ==========================================
// 2. MUDANÇA DE VIEW COMPARTILHADA
// ==========================================
export function changeView(viewId) {
    // Validação preventiva: Se tentar acessar a sala ativa sem estar em uma, barra o fluxo
    if (viewId === "view-room-active" && !appState.activeRoom) {
        alert("Você não está conectado a nenhuma sala ativa no momento.");
        return;
    }

    // 1. Remove o estado ativo de todos os botões e adiciona ao correto
    const navButtons = document.querySelectorAll(".nav-btn");
    navButtons.forEach(btn => {
        if (btn.getAttribute("data-target") === viewId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // 2. Oculta todas as seções e exibe apenas a solicitada
    const allViews = document.querySelectorAll(".app-view");
    allViews.forEach(view => {
        if (view.id === viewId) {
            view.classList.add("active");
            // Força a rolagem para o topo (Essencial para UX Mobile)
            view.scrollTop = 0; 
        } else {
            view.classList.remove("active");
        }
    });

    console.log(`[NAVIGATION] View alterada com sucesso para: ${viewId}`);
}

// ==========================================
// 3. FLUXO DE DESTRUIÇÃO DE SESSÃO
// ==========================================
function executeGlobalLogout() {
    console.log("[AUTH] Limpando persistência de dados locais...");
    
    // Remove os tokens do cache e reseta o Singleton de Estado
    localStorage.removeItem("sala_project_user");
    appState.setCurrentUser(null);
    appState.setActiveRoom(null);

    // Hard reset para descarregar o estado de memória RAM de todos os módulos
    location.reload();
}
