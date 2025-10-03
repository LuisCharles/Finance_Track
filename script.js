"use strict";

// --- Elementos DOM ---
const elSaldoTotal = document.getElementById("saldoTotal");
const elGastoMes = document.getElementById("gastoMes");
const elEntradaMes = document.getElementById("entradaMes");
const calendarioSemana = document.getElementById("calendarioSemana");
const detalheGastos = document.getElementById("detalheGastos");
const alertasContainer = document.getElementById("alertas");
const graficoCtxEl = document.getElementById("graficoGastos");
const legendaContainer = document.getElementById("legendaCategorias");
let graficoPizza = null;

// --- Helpers ---
const toNumber = window.toNumber || ((v) => Number(v) || 0);
const formatBRL = window.formatBRL || ((v) => v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
}));
const coresCategoria = window.coresCategoria || {
    alimentacao: "#28a745",
    lazer: "#fd7e14",
    transporte: "#0d6efd",
    divida: "#dc3545",
    outros: "#6c757d"
};
const obterContas = window.obterContas || (() => []);
const obterGanhos = window.obterGanhos || (() => []);
const calcularSaldoTotal = window.calcularSaldoTotal || (() => 0);
const semanaDoMes = window.semanaDoMes || ((d) => Math.ceil(d.getDate() / 7));

// --- Parse flexível ---
function parseDataFlexSafe(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    const dt = new Date(d);
    return isNaN(dt) ? null : dt;
}

// --- Cálculos do mês ---
function calcularGastoDoMesSeguro() {
    const contas = obterContas();
    const hoje = new Date();
    return contas.reduce((total, c) => {
        (c.pagamentos || []).forEach(p => {
            const pd = parseDataFlexSafe(p.data);
            if (pd && pd.getMonth() === hoje.getMonth() && pd.getFullYear() === hoje.getFullYear()) {
                total += toNumber(p.valor);
            }
        });
        return total;
    }, 0);
}

function calcularEntradaDoMesSeguro() {
    const ganhos = obterGanhos();
    const hoje = new Date();
    return ganhos.reduce((total, g) => {
        const gd = parseDataFlexSafe(g.data);
        if (gd && gd.getMonth() === hoje.getMonth() && gd.getFullYear() === hoje.getFullYear()) {
            total += toNumber(g.valor);
        }
        return total;
    }, 0);
}

// --- Alertas ---
function diasParaVencimento(vencimento) {
    const hoje = new Date();
    const dv = parseDataFlexSafe(vencimento);
    if (!dv) return null;
    hoje.setHours(0, 0, 0, 0);
    dv.setHours(0, 0, 0, 0);
    return Math.ceil((dv - hoje) / (1000 * 60 * 60 * 24));
}
function corAlerta(dias) {
    if (dias <= 0) return "urgente";
    if (dias <= 3) return "aviso";
    return "normal";
}
function classeTextoAlerta(dias) {
    if (dias < 0) return "texto-vencido";
    if (dias <= 3) return "texto-vence-breve";
    return "texto-normal";
}
function mensagemAlerta(dias) {
    if (dias < 0) return "Conta vencida, pague imediatamente";
    if (dias === 0) return "Sua conta vence hoje, pague imediatamente";
    return `Sua conta vence em ${dias} dia(s)`;
}

// --- Calendário Semana ---
function atualizarCalendarioSemana() {
    if (!calendarioSemana) return;
    const contas = obterContas();
    const semanas = 5;
    const valorPorSemana = Array.from({
        length: semanas
    }, () => 0);
    const pagamentosPorSemana = Array.from({
        length: semanas
    }, () => []);

    contas.forEach(c => {
        (c.pagamentos || []).forEach(p => {
            const pd = parseDataFlexSafe(p.data);
            if (!pd) return;
            const sem = semanaDoMes(pd);
            if (sem >= 1 && sem <= semanas) {
                valorPorSemana[sem - 1] += toNumber(p.valor);
                pagamentosPorSemana[sem - 1].push({ ...p,
                    conta: c
                });
            }
        });
    });

    const maxValor = Math.max(...valorPorSemana, 1);
    calendarioSemana.innerHTML = "";
    detalheGastos.innerHTML = "";
    let semanaAtiva = -1;

    for (let i = 0; i < semanas; i++) {
        const div = document.createElement("div");
        div.className = "semana-card";
        div.setAttribute("data-semana", i + 1);
        div.innerHTML = `Semana ${i + 1}<br/>${formatBRL(valorPorSemana[i])}`;
        const corBaseRoxa = [108, 92, 231];
        const intensidade = valorPorSemana[i] > 0 ? (0.3 + (valorPorSemana[i] / maxValor) * 0.7) : 0;
        div.style.backgroundColor = `rgba(${corBaseRoxa.join(',')}, ${intensidade})`;
        div.style.color = valorPorSemana[i] > 0 ? "#fff" : "#000";

        div.addEventListener("click", () => {
            if (semanaAtiva === i + 1) {
                detalheGastos.classList.remove("mostrar");
                detalheGastos.innerHTML = "";
                semanaAtiva = -1;
                document.querySelectorAll(".semana-card").forEach(el => el.classList.remove("semana-ativa"));
                return;
            }
            semanaAtiva = i + 1;
            document.querySelectorAll(".semana-card").forEach(el => el.classList.remove("semana-ativa"));
            div.classList.add("semana-ativa");
            renderizarDetalheGastos(i + 1, pagamentosPorSemana[i]);
            detalheGastos.classList.add("mostrar");
        });
        calendarioSemana.appendChild(div);
    }
}

function criarElementoGasto(gasto, isAlerta = false) {
    const li = document.createElement("li");
    const conta = gasto.conta;
    
    // Verificação de segurança para a data
    const dataObj = parseDataFlexSafe(gasto.data);
    const dataFormat = dataObj ? dataObj.toLocaleDateString('pt-BR') : 'Data não disponível';

    let innerHTML = '';
    if (isAlerta) {
        const dias = diasParaVencimento(conta.vencimento);
        const cor = corAlerta(dias);
        const classeTexto = classeTextoAlerta(dias);
        const mensagem = mensagemAlerta(dias);
        
        const vencimentoObj = parseDataFlexSafe(conta.vencimento);
        const vencimentoFormatado = vencimentoObj ? vencimentoObj.toLocaleDateString('pt-BR') : 'Data não disponível';

        innerHTML = `
            <div class="alerta-item alerta-${cor}">
                <div class="alerta-header">
                    <div class="alerta-title-group">
                        <span class="alerta-categoria-tag tag-${conta.categoria || 'outros'}">${(conta.categoria || 'Outros').charAt(0).toUpperCase() + (conta.categoria || 'Outros').slice(1)}</span>
                        <span class="alerta-title">${conta.nome}</span>
                    </div>
                    <span class="alerta-valor">${formatBRL(conta.valor)}</span>
                </div>
                <div class="alerta-body">
                    <span class="alerta-message ${classeTexto}">${mensagem}</span>
                    <div class="alerta-right-group">
                        <span class="alerta-data ${classeTexto}">Vencimento: ${vencimentoFormatado}</span>
                        <span class="alerta-info">Parcela ${conta.parcelaAtual || 1} de ${conta.parcelas || 1}</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        innerHTML = `
            <div class="gasto-detalhe-card cat-${conta.categoria || "outros"}">
                <div class="gasto-detalhe-header">
                    <span class="gasto-detalhe-title">${conta.nome}</span>
                    <span class="gasto-detalhe-valor">${formatBRL(gasto.valor)}</span>
                </div>
                <div class="gasto-detalhe-body">
                    <span class="gasto-detalhe-data">Pago em: ${dataFormat}</span>
                    <small class="text-muted">Parcela ${conta.parcelaAtual || 1} de ${conta.parcelas || 1}</small>
                </div>
            </div>
        `;
    }
    li.innerHTML = innerHTML;
    return li;
}

function renderizarDetalheGastos(semana, pagamentos) {
    if (!detalheGastos) return;
    detalheGastos.innerHTML = `<h4>Gastos da Semana ${semana}</h4>`;
    const ul = document.createElement("ul");
    if (!pagamentos || pagamentos.length === 0) {
        const li = document.createElement("li");
        li.className = "text-muted text-center py-3";
        li.textContent = "Nenhum gasto registrado nesta semana.";
        ul.appendChild(li);
    } else {
        pagamentos.forEach(p => {
            const li = criarElementoGasto(p);
            ul.appendChild(li);
        });
    }
    detalheGastos.appendChild(ul);
}

// --- Alertas ---
function atualizarAlertas() {
    if (!alertasContainer) return;

    const alertaMesConcluidoContainer = document.getElementById("alerta-mes-concluido");
    if (alertaMesConcluidoContainer) {
        alertaMesConcluidoContainer.innerHTML = "";
    }
    
    alertasContainer.innerHTML = "";

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const contas = obterContas();

    const contasPendentes = contas.filter(c => (c.parcelaAtual || 0) < (c.parcelas || 1));

    let contasParaExibir = contasPendentes.filter(c => {
        const venc = parseDataFlexSafe(c.vencimento);
        return venc && venc.getFullYear() === anoAtual && venc.getMonth() === mesAtual;
    });

    if (contasParaExibir.length === 0) {
        const proximoMes = new Date(anoAtual, mesAtual + 1, 1);
        const nomeProximoMes = proximoMes.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric'
        });

        contasParaExibir = contasPendentes.filter(c => {
            const venc = parseDataFlexSafe(c.vencimento);
            return venc && venc.getFullYear() === proximoMes.getFullYear() && venc.getMonth() === proximoMes.getMonth();
        });

        if (contasParaExibir.length > 0) {
            if (alertaMesConcluidoContainer) {
                alertaMesConcluidoContainer.innerHTML = `
                    <div class="alerta-mes-concluido">
                        <span class="alerta-icone">✅</span>
                        <span class="alerta-texto">Todas as contas do mês quitadas! Aqui estão as contas de ${nomeProximoMes}:</span>
                    </div>
                `;
            }
        }
    }

    contasParaExibir.sort((a, b) => diasParaVencimento(a.vencimento) - diasParaVencimento(b.vencimento));

    if (contasParaExibir.length > 0) {
        contasParaExibir.forEach(c => {
            const li = criarElementoGasto({ conta: c }, true);
            alertasContainer.appendChild(li);
        });
    } else if (contasPendentes.length > 0 && contasParaExibir.length === 0) {
        alertasContainer.innerHTML = "<p class='text-muted text-center'>Nenhuma conta para o próximo mês.</p>";
    } else {
        alertasContainer.innerHTML = "<p class='text-muted text-center'>Nenhuma conta pendente para os próximos meses.</p>";
    }
}


// --- Gráfico de Pizza Interativo ---
function atualizarGraficoGastos() {
    if (!graficoCtxEl) return;

    const contas = obterContas();
    const hoje = new Date();
    const pagamentos = contas.flatMap(c => (c.pagamentos || []).map(p => ({ ...p,
        conta: c
    })))
        .filter(p => {
            const pd = parseDataFlexSafe(p.data);
            return pd && pd.getMonth() === hoje.getMonth() && pd.getFullYear() === hoje.getFullYear();
        });

    const somaPorCat = {};
    pagamentos.forEach(p => {
        const cat = p.conta.categoria || "outros";
        somaPorCat[cat] = (somaPorCat[cat] || 0) + toNumber(p.valor);
    });

    const labels = Object.keys(somaPorCat);
    const data = labels.map(l => somaPorCat[l]);
    const colors = labels.map(l => coresCategoria[l] || "#6c757d");

    if (graficoPizza) graficoPizza.destroy();

    graficoPizza = new Chart(graficoCtxEl, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: "#fff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const val = context.parsed;
                            const perc = ((val / total) * 100).toFixed(1) + "%";
                            return `${context.label}: ${formatBRL(val)} (${perc})`;
                        }
                    }
                }
            }
        }
    });

    // Legenda customizada interativa
    if (legendaContainer) {
        legendaContainer.innerHTML = "";
        labels.forEach((label, i) => {
            const div = document.createElement("div");
            div.className = "legenda-item";
            div.innerHTML = `
                <span class="legenda-cor" style="background-color:${colors[i]}"></span>
                <span class="legenda-nome">${label}</span>
                <span class="legenda-valor">${formatBRL(data[i])}</span>
            `;
            div.addEventListener("click", () => {
                const meta = graficoPizza.getDatasetMeta(0);
                meta.data[i].hidden = !meta.data[i].hidden;
                graficoPizza.update();
                div.classList.toggle("inativo", meta.data[i].hidden);
            });
            legendaContainer.appendChild(div);
        });
    }
}

// --- Atualização Home ---
function atualizarHome() {
    animarNumero(elSaldoTotal, calcularSaldoTotal(), formatBRL);
    animarNumero(elGastoMes, calcularGastoDoMesSeguro(), formatBRL);
    animarNumero(elEntradaMes, calcularEntradaDoMesSeguro(), formatBRL);
    atualizarCalendarioSemana();
    atualizarAlertas();
    atualizarGraficoGastos();
}

// --- DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", atualizarHome);
window.addEventListener("storage", atualizarHome);