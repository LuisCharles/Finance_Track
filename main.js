"use strict";

// --- FUNÇÕES GLOBAIS DE DADOS ---
window.salvarContas = function(contas) { localStorage.setItem("contas", JSON.stringify(contas)); };
window.obterContas = function() { return JSON.parse(localStorage.getItem("contas")) || []; };

window.salvarGanhos = function(ganhos) { localStorage.setItem("ganhos", JSON.stringify(ganhos)); };
window.obterGanhos = function() { return JSON.parse(localStorage.getItem("ganhos")) || []; };

window.salvarObjetivos = function(objetivos) { localStorage.setItem("objetivos", JSON.stringify(objetivos)); };
window.obterObjetivos = function() { return JSON.parse(localStorage.getItem("objetivos")) || []; };

// NOVAS FUNÇÕES: ORÇAMENTO MENSAL E CONFIGURAÇÕES
window.salvarLimite = function(valor) { localStorage.setItem("limiteGastos", valor); };
window.obterLimite = function() { return Number(localStorage.getItem("limiteGastos")) || 0; };

// --- UTILITÁRIOS ---
window.toNumber = function(valor) { return Number(valor) || 0; };
window.formatBRL = function(valor) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };

window.parseDataFlex = function(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    let dateStr = String(d);
    if (dateStr.includes('-') && dateStr.length === 10) {
        dateStr = dateStr.replace(/-/g, '\/');
    }
    const dt = new Date(dateStr);
    return isNaN(dt) ? null : dt;
};

window.formatDataInput = function(dateObj) {
    if (!dateObj) return "";
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// --- REGRA DE OURO DO SALDO (Atualizada para Investimentos) ---
window.calcularSaldoTotal = function() {
    const ganhos = window.obterGanhos();
    const contas = window.obterContas();
    const objetivos = window.obterObjetivos();

    // Soma tudo o que entrou
    const totalGanhos = ganhos.reduce((acc, g) => acc + window.toNumber(g.valor), 0);
    
    // Soma tudo o que pagou
    const totalGastos = contas.reduce((acc, c) => acc + (c.pagamentos || []).reduce((s, p) => s + window.toNumber(p.valor), 0), 0);
    
    // Soma apenas o dinheiro GUARDADO DO SEU BOLSO (ignora os rendimentos)
    const totalGuardado = objetivos.reduce((acc, obj) => {
        return acc + (obj.depositos || []).reduce((s, d) => {
            if (d.tipo === 'rendimento') return s; // O rendimento brotou lá, não saiu do seu saldo!
            return s + window.toNumber(d.valor);
        }, 0);
    }, 0);

    return totalGanhos - totalGastos - totalGuardado;
};

// --- CORES PADRONIZADAS ---
window.coresCategoria = {
    alimentacao: "#28a745",
    mercado: "#20c997",      
    aluguel: "#6f42c1",      
    financiamento: "#17a2b8",
    emprestimo: "#e83e8c",   
    transporte: "#0d6efd",
    lazer: "#fd7e14",
    divida: "#dc3545",       
    outros: "#6c757d"
};

// --- ANIMAÇÃO ---
window.animarNumero = function(elemento, valorFinal, formatador) {
    if (!elemento) return;
    elemento.textContent = formatador ? formatador(valorFinal) : valorFinal; 
};

// --- SISTEMA DE TEMA ESCURO / CLARO ---
window.aplicarTema = function(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem("temaSistema", tema);
    
    // Atualiza todos os botões de tema na tela
    document.querySelectorAll(".btn-toggle-tema").forEach(btn => {
        if (tema === "dark") {
            btn.innerHTML = '<i class="bi bi-sun-fill text-warning"></i>';
            btn.classList.add("dark-active");
        } else {
            btn.innerHTML = '<i class="bi bi-moon-stars-fill text-dark"></i>';
            btn.classList.remove("dark-active");
        }
    });
};

window.alternarTema = function() {
    const temaAtual = localStorage.getItem("temaSistema") || "light";
    const novoTema = temaAtual === "light" ? "dark" : "light";
    window.aplicarTema(novoTema);
};

// Inicializa o tema ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    const temaSalvo = localStorage.getItem("temaSistema") || "light";
    window.aplicarTema(temaSalvo);

    // Adiciona evento de clique a todos os botões de tema
    document.querySelectorAll(".btn-toggle-tema").forEach(btn => {
        btn.addEventListener("click", window.alternarTema);
    });
});

// --- AUTO-SELEÇÃO DO MENU (NAVBAR) ---
document.addEventListener("DOMContentLoaded", () => {
    // Descobre em qual página estamos agora (ex: "movimentacoes.html")
    let paginaAtual = window.location.pathname.split("/").pop();
    
    // Se for a raiz do site, assume que é a Home
    if (paginaAtual === "") paginaAtual = "index.html";

    // Pega todos os links de navegação
    const links = document.querySelectorAll(".nav-link");

    links.forEach(link => {
        // Primeiro, apaga a seleção de todos os botões
        link.classList.remove("active-link");
        
        // Pega o href do botão (ex: "index.html")
        const href = link.getAttribute("href");

        // Se o href do botão for igual ao nome da página atual, acende ele!
        if (href === paginaAtual) {
            link.classList.add("active-link");
        }
    });
});

/* ==========================================================
   INTEGRAÇÃO COM BOLSA DE VALORES (BRAPI)
========================================================== */
async function buscarPrecoAtivo(ticker) {
    if (!ticker) return null;
    try {
        // Brapi permite consultar sem Token para testes básicos ou usando um gratuito
        const res = await fetch(`https://brapi.dev/api/quote/${ticker.toUpperCase()}`);
        const dados = await res.json();
        
        if (dados.results && dados.results[0]) {
            return {
                preco: dados.results[0].regularMarketPrice,
                variacao: dados.results[0].regularMarketChangePercent
            };
        }
    } catch (e) {
        console.error("Erro Bolsa:", e);
    }
    return null;
}

/* ==========================================================
   LISTAGEM GLOBAL DE ATIVOS DA BOLSA (Brapi)
========================================================== */
let cacheTickers = [];

async function carregarListaTickers() {
    // Se já carregamos antes, não gasta internet de novo
    if (cacheTickers.length > 0) return cacheTickers;

    try {
        const res = await fetch('https://brapi.dev/api/available');
        const dados = await res.json();
        cacheTickers = dados.stocks; // Lista de strings: ["AALR3", "ABCB4", ...]
        
        // Alimenta o datalist para o autocomplete funcionar
        const datalist = document.getElementById('listaTickers');
        if (datalist) {
            datalist.innerHTML = cacheTickers.map(t => `<option value="${t}">`).join('');
        }
        return cacheTickers;
    } catch (e) {
        console.error("Erro ao listar ativos:", e);
        return [];
    }
}

// Inicia o carregamento em segundo plano assim que o app abre
document.addEventListener("DOMContentLoaded", carregarListaTickers);