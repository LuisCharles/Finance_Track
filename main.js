"use strict";

// =========================
// Helpers / Fonte de dados
// =========================

function obterContas() {
    try {
        const raw = localStorage.getItem("contas");
        if (!raw) return [];
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn("[obterContas] JSON inválido em localStorage.contas.", e);
        return [];
    }
}

function salvarContas(contas) {
    try {
        localStorage.setItem("contas", JSON.stringify(contas ?? []));
        // Dispara o evento 'storage' para notificar outras abas
        window.dispatchEvent(new Event('storage'));
    } catch (e) {
        console.error("[salvarContas] Falha ao salvar contas.", e);
    }
}

// Formata em BRL
const formatBRL = (n) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
        Number.isFinite(n) ? n : 0
    );

// Converte com segurança para número (aceita "1.234,56" ou "1234.56")
function toNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (v == null) return 0;
    const s = String(v).trim();
    const norm = s.replace(/\./g, "").replace(/,/g, ".");
    const n = parseFloat(norm);
    return Number.isFinite(n) ? n : 0;
}

// Anima números nos cards (suave, sem “pulos” após refresh)
function animarNumero(el, valorFinal, formatFn = (v) => v, duracaoMs = 500) {
    if (!el) return;
    const ini = performance.now();
    const valorInicial = parseFloat(el.getAttribute("data-valor") || 0) || 0;

    if (valorInicial === valorFinal) {
        el.textContent = formatFn(valorFinal);
        el.setAttribute("data-valor", String(valorFinal));
        return;
    }

    function step(t) {
        const p = Math.min(1, (t - ini) / duracaoMs);
        const atual = valorInicial + (valorFinal - valorInicial) * p;
        el.textContent = formatFn(atual);
        if (p < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = formatFn(valorFinal);
            el.setAttribute("data-valor", String(valorFinal));
        }
    }
    requestAnimationFrame(step);
}

function semanaDoMes(date = new Date()) {
    const dia = date.getDate();
    return Math.min(5, Math.max(1, Math.ceil(dia / 7)));
}

const coresCategoria = {
    alimentacao: "#28a745", // Verde
    transporte: "#0d6efd", // Azul
    lazer: "#fd7e14", // Laranja
    divida: "#dc3545", // Vermelho
    outros: "#6c757d", // Cinza
};

// =========================
// Datas
// =========================
function parseDataBr(str) {
    if (typeof str !== "string") return null;
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return null;
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    const dt = new Date(+y, +mo - 1, +d);
    return Number.isFinite(dt.getTime()) ? dt : null;
}

function parseDataFlex(v) {
    if (!v) return null;
    if (v instanceof Date) return v;

    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const d = new Date(`${v}T00:00:00`);
        return Number.isFinite(d.getTime()) ? d : null;
    }

    const br = parseDataBr(v);
    if (br) return br;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

// =========================
// Obtém todos os pagamentos de um mês
// =========================
function obterPagamentosDoMes(contas, ano, mes) {
    const pagamentosDoMes = [];
    contas.forEach((conta) => {
        if (Array.isArray(conta.pagamentos) && conta.pagamentos.length) {
            conta.pagamentos.forEach((pag) => {
                const dt = parseDataFlex(pag.data);
                if (dt && dt.getFullYear() === ano && dt.getMonth() === mes) {
                    pagamentosDoMes.push({ conta: conta, valor: toNumber(pag.valor), data: dt });
                }
            });
        }
    });
    return pagamentosDoMes;
}

// NOVO: FUNÇÃO PARA REGISTRAR UM PAGAMENTO COM DATA
function registrarPagamento(conta) {
    if (!Array.isArray(conta.pagamentos)) {
        conta.pagamentos = [];
    }
    conta.pagamentos.push({
        valor: conta.valor,
        data: new Date().toISOString(),
    });
    conta.parcelaAtual = Math.max(0, (conta.parcelaAtual || 0) + 1);
}

// NOVO: FUNÇÃO PARA MIGRAR DADOS ANTIGOS
function migrarDadosAntigos() {
    let dadosMigrados = false;
    let contas = obterContas();
    contas.forEach(conta => {
        if (!Array.isArray(conta.pagamentos) && (conta.parcelaAtual || 0) > 0) {
            conta.pagamentos = [];
            for (let i = 0; i < conta.parcelaAtual; i++) {
                const dataVencimento = parseDataFlex(conta.vencimento);
                if (!dataVencimento) continue;
                const dataMigrada = new Date(dataVencimento);
                dataMigrada.setMonth(dataMigrada.getMonth() + i);
                conta.pagamentos.push({
                    valor: conta.valor,
                    data: dataMigrada.toISOString(),
                });
            }
            dadosMigrados = true;
        }
        if (!Array.isArray(conta.pagamentos)) {
            conta.pagamentos = [];
        }
    });
    if (dadosMigrados) {
        salvarContas(contas);
    }
}