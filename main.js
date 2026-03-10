"use strict";

// --- FUNÇÕES GLOBAIS (O Cérebro do Sistema) ---

window.salvarContas = function(contas) { localStorage.setItem("contas", JSON.stringify(contas)); };
window.obterContas = function() { return JSON.parse(localStorage.getItem("contas")) || []; };
window.salvarGanhos = function(ganhos) { localStorage.setItem("ganhos", JSON.stringify(ganhos)); };
window.obterGanhos = function() { return JSON.parse(localStorage.getItem("ganhos")) || []; };

window.toNumber = function(valor) { return Number(valor) || 0; };
window.formatBRL = function(valor) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };

// Truque para o JS entender as datas no nosso fuso horário
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

// Devolve a data para o input HTML YYYY-MM-DD
window.formatDataInput = function(dateObj) {
    if (!dateObj) return "";
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

window.calcularSaldoTotal = function() {
    const ganhos = window.obterGanhos();
    const contas = window.obterContas();
    const totalGanhos = ganhos.reduce((acc, g) => acc + window.toNumber(g.valor), 0);
    // Só desconta as parcelas que foram efetivamente pagas DENTRO do app (estão no array)
    const totalGastos = contas.reduce((acc, c) => acc + (c.pagamentos || []).reduce((s, p) => s + window.toNumber(p.valor), 0), 0);
    return totalGanhos - totalGastos;
};

// --- NOVAS CORES DE CATEGORIAS ---
window.coresCategoria = {
    alimentacao: "#28a745",
    mercado: "#20c997",      // Verde ciano
    aluguel: "#6f42c1",      // Roxo escuro
    financiamento: "#17a2b8",// Azul
    emprestimo: "#e83e8c",   // Rosa
    transporte: "#0d6efd",
    lazer: "#fd7e14",
    divida: "#dc3545",       // Vermelho clássico
    outros: "#6c757d"
};

// Função global de animação
window.animarNumero = function(elemento, valorFinal, formatador) {
    if (!elemento) return;
    elemento.textContent = formatador ? formatador(valorFinal) : valorFinal; 
};