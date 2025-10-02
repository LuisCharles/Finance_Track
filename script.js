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
const toNumber = window.toNumber || ((v)=>Number(v)||0);
const formatBRL = window.formatBRL || ((v)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}));
const coresCategoria = window.coresCategoria || {
    alimentacao: "#28a745",
    lazer: "#fd7e14",
    transporte: "#0d6efd",
    divida: "#dc3545",
    outros: "#6c757d"
};
const obterContas = window.obterContas || (()=>[]);
const obterGanhos = window.obterGanhos || (()=>[]);
const calcularSaldoTotal = window.calcularSaldoTotal || (()=>0);
const semanaDoMes = window.semanaDoMes || ((d)=>Math.ceil(d.getDate()/7));

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
    return dv ? Math.floor((dv - hoje) / (1000 * 60 * 60 * 24)) : null;
}
function corAlerta(dias) {
    if (dias <= 0) return "urgente";
    if (dias <= 3) return "aviso";
    if (dias <= 5) return "atencao";
    return "normal";
}
function classeTextoAlerta(dias) {
    if (dias <= 0) return "texto-vencido";
    if (dias <= 3) return "texto-vence-breve";
    if (dias <= 5) return "texto-vence-hoje";
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
    const valorPorSemana = Array.from({ length: semanas }, () => 0);
    const pagamentosPorSemana = Array.from({ length: semanas }, () => []);

    contas.forEach(c => {
        (c.pagamentos || []).forEach(p => {
            const pd = parseDataFlexSafe(p.data);
            if (!pd) return;
            const sem = semanaDoMes(pd);
            if (sem >= 1 && sem <= semanas) {
                valorPorSemana[sem - 1] += toNumber(p.valor);
                pagamentosPorSemana[sem - 1].push({ ...p, conta: c });
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
        div.style.backgroundColor = valorPorSemana[i] > 0 ? `rgba(220,53,69,${0.3 + valorPorSemana[i]/maxValor*0.7})` : "#e9ecef";
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
            const li = document.createElement("li");
            const dataFormat = parseDataFlexSafe(p.data).toLocaleDateString('pt-BR');
            li.innerHTML = `
                <div class="gasto-detalhe-card cat-${p.conta.categoria || "outros"}">
                    <div class="gasto-detalhe-header">
                        <span class="gasto-detalhe-title">${p.conta.nome}</span>
                        <span class="gasto-detalhe-valor">${formatBRL(p.valor)}</span>
                    </div>
                    <div class="gasto-detalhe-body">
                        <span class="gasto-detalhe-data">Pago em: ${dataFormat}</span>
                        <small class="text-muted">Parcela ${p.conta.parcelaAtual || 1} de ${p.conta.parcelas || 1}</small>
                    </div>
                </div>
            `;
            ul.appendChild(li);
        });
    }
    detalheGastos.appendChild(ul);
}

// --- Alertas ---
function atualizarAlertas() {
    if (!alertasContainer) return;
    alertasContainer.innerHTML = "";

    const contas = obterContas();
    let contasPendentes = contas.filter(c => (c.parcelaAtual || 0) < (c.parcelas || 1));

    if (contasPendentes.length === 0) {
        alertasContainer.innerHTML = "<p class='text-success text-center'>Todas as contas do mês quitadas! Aqui estão as contas do próximo mês:</p>";
        contasPendentes = contas;
    }

    contasPendentes.forEach(c => {
        const venc = parseDataFlexSafe(c.vencimento);
        if (!venc) return;
        const proximaParcela = new Date(venc);
        proximaParcela.setMonth(venc.getMonth() + (c.parcelaAtual || 0));
        const dias = diasParaVencimento(proximaParcela);
        const cor = corAlerta(dias);
        const classeTexto = classeTextoAlerta(dias);
        const mensagem = mensagemAlerta(dias);

        const li = document.createElement("li");
        li.innerHTML = `
            <div class="alerta-item alerta-${cor}">
                <div class="alerta-header">
                    <div class="alerta-title-group">
                        <span class="alerta-categoria-tag tag-${c.categoria || 'outros'}">${(c.categoria || 'Outros').charAt(0).toUpperCase() + (c.categoria || 'Outros').slice(1)}</span>
                        <span class="alerta-title">${c.nome}</span>
                    </div>
                    <span class="alerta-valor">${formatBRL(c.valor)}</span>
                </div>
                <div class="alerta-body">
                    <span class="alerta-message ${classeTexto}">${mensagem}</span>
                    <div class="alerta-right-group">
                        <span class="alerta-data ${classeTexto}">Vencimento: ${proximaParcela.toLocaleDateString('pt-BR')}</span>
                        <span class="alerta-info">Parcela ${c.parcelaAtual + 1} de ${c.parcelas}</span>
                    </div>
                </div>
            </div>
        `;
        alertasContainer.appendChild(li);
    });
}

// --- Gráfico de Pizza Interativo ---
function atualizarGraficoGastos() {
    if (!graficoCtxEl) return;

    const contas = obterContas();
    const hoje = new Date();
    const pagamentos = contas.flatMap(c => (c.pagamentos || []).map(p => ({ ...p, conta: c })))
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
        type: "pie", // <-- gráfico cheio, sem buraco
        data: { labels, datasets: [{ data, backgroundColor: colors, borderColor:"#fff", borderWidth:2 }] },
        options: {
            responsive:true,
            plugins:{
                legend:{ display:false },
                tooltip:{
                    callbacks:{
                        label:function(context){
                            const total = context.dataset.data.reduce((a,b)=>a+b,0);
                            const val = context.parsed;
                            const perc = ((val/total)*100).toFixed(1) + "%";
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
        labels.forEach((label,i)=>{
            const div = document.createElement("div");
            div.className = "legenda-item";
            div.innerHTML = `
                <span class="legenda-cor" style="background-color:${colors[i]}"></span>
                <span class="legenda-nome">${label}</span>
                <span class="legenda-valor">${formatBRL(data[i])}</span>
            `;
            div.addEventListener("click", ()=>{
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
