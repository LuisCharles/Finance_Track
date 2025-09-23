"use strict";

// =========================
// Funções da página Home
// =========================
let graficoPizza;

function atualizarResumoHome() {
    const contas = obterContas();
    const saldoTotalEl = document.getElementById("saldoTotal");
    const gastosMesEl = document.getElementById("gastosMes");
    const entradasMesEl = document.getElementById("entradasMes");
    const alertasEl = document.getElementById("alertas");

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const proximoMes = (mesAtual === 11) ? 0 : mesAtual + 1;
    const anoProximoMes = (mesAtual === 11) ? anoAtual + 1 : anoAtual;

    const pagamentos = obterPagamentosDoMes(contas, anoAtual, mesAtual);
    const gastosDoMes = pagamentos.reduce((acc, p) => acc + p.valor, 0);

    const saldoTotal = 0; // Você precisa implementar a lógica para o saldo total
    const entradasMes = 0; // Você precisa implementar a lógica para as entradas

    if (saldoTotalEl) animarNumero(saldoTotalEl, saldoTotal, formatBRL);
    if (gastosMesEl) animarNumero(gastosMesEl, gastosDoMes, formatBRL);
    if (entradasMesEl) animarNumero(entradasMesEl, entradasMes, formatBRL);

    // Renderiza a seção de ALERTA DE CONTAS
    if (alertasEl) {
        alertasEl.innerHTML = "";

        // Contas pendentes do mês atual
        const contasPendentesMesAtual = contas.filter(c => {
            const dataVencimento = parseDataFlex(c.vencimento);
            if (!dataVencimento) return false;

            const vencimentoParcela = new Date(dataVencimento);
            vencimentoParcela.setMonth(dataVencimento.getMonth() + (c.parcelaAtual || 0));

            const estaNoMesAtual = vencimentoParcela.getFullYear() === anoAtual && vencimentoParcela.getMonth() === mesAtual;
            
            const pagaNesteMes = (c.pagamentos || []).some(pag => {
                const dataPagamento = parseDataFlex(pag.data);
                return dataPagamento && dataPagamento.getFullYear() === anoAtual && dataPagamento.getMonth() === mesAtual;
            });

            return estaNoMesAtual && !pagaNesteMes;
        });

        if (contasPendentesMesAtual.length === 0) {
            const li = document.createElement("li");
            li.innerHTML = `<h5 class="text-success text-center py-3">🎉 Todas as suas contas deste mês foram quitadas! 🎉</h5>`;
            alertasEl.appendChild(li);
        } else {
            contasPendentesMesAtual.forEach(c => {
                const dataVencimento = parseDataFlex(c.vencimento);
                if (!dataVencimento) return;

                const hojeLimpo = new Date();
                hojeLimpo.setHours(0, 0, 0, 0);

                const vencimentoParcela = new Date(dataVencimento);
                vencimentoParcela.setMonth(dataVencimento.getMonth() + (c.parcelaAtual || 0));
                vencimentoParcela.setHours(0, 0, 0, 0);

                const diffTime = vencimentoParcela - hojeLimpo;
                const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let statusText;
                let statusClass;
                let corTextoVencimento;
                let corTextoStatus;

                if (diasRestantes < 0) {
                    statusText = `Conta Vencida. Pague imediatamente!`;
                    statusClass = 'alerta-urgente';
                    corTextoVencimento = 'texto-vencido';
                    corTextoStatus = 'texto-vencido';
                } else if (diasRestantes === 0) {
                    statusText = `Sua conta vence hoje, pague para não sofrer com juros!`;
                    statusClass = 'alerta-aviso';
                    corTextoVencimento = 'texto-vence-hoje';
                    corTextoStatus = 'texto-vence-hoje';
                } else if (diasRestantes <= 5) {
                    statusText = `Sua conta vence em ${diasRestantes} dias.`;
                    statusClass = 'alerta-atencao';
                    corTextoVencimento = 'texto-vence-breve';
                    corTextoStatus = 'texto-vence-breve';
                } else {
                    statusText = `Sua conta vence em ${diasRestantes} dias.`;
                    statusClass = 'alerta-normal';
                    corTextoVencimento = 'texto-normal';
                    corTextoStatus = 'texto-normal';
                }

                const dataFormatada = vencimentoParcela.toLocaleDateString('pt-BR');
                const categoriaDisplay = c.categoria ? c.categoria.charAt(0).toUpperCase() + c.categoria.slice(1) : 'Outros';
                const tagClass = c.categoria ? `tag-${c.categoria.toLowerCase()}` : `tag-outros`;
                const valorConta = formatBRL(c.valor || 0);

                const li = document.createElement("li");
                li.innerHTML = `
                    <div class="alerta-item ${statusClass}">
                        <div class="alerta-header">
                            <div class="alerta-title-group">
                                <span class="alerta-categoria-tag ${tagClass}">${categoriaDisplay}</span>
                                <span class="alerta-title">${c.nome}</span>
                            </div>
                            <span class="alerta-valor">${valorConta}</span>
                        </div>
                        <div class="alerta-body">
                            <span class="alerta-message ${corTextoStatus}">${statusText}</span>
                            <div class="alerta-right-group">
                                <span class="alerta-data ${corTextoVencimento}">Vencimento: ${dataFormatada}</span>
                                <span class="alerta-info">Parcela ${c.parcelaAtual + 1} de ${c.parcelas}</span>
                            </div>
                        </div>
                    </div>
                `;
                alertasEl.appendChild(li);
            });
        }
        
        // CORRIGIDO: Esta parte agora é independente da seção acima
        const contasProximoMes = contas.filter(c => {
            const dataVencimento = parseDataFlex(c.vencimento);
            if (!dataVencimento) return false;

            // Para exibir as próximas contas, consideramos a parcela já paga (c.parcelaAtual)
            // e verificamos a data da parcela seguinte (c.parcelaAtual + 1)
            const proximaParcelaIndex = c.parcelaAtual;
            
            // Se já pagou todas as parcelas, não tem próxima
            if (proximaParcelaIndex >= c.parcelas) {
                return false;
            }

            const vencimentoProximaParcela = new Date(dataVencimento);
            vencimentoProximaParcela.setMonth(dataVencimento.getMonth() + proximaParcelaIndex);

            return vencimentoProximaParcela.getFullYear() === anoProximoMes && vencimentoProximaParcela.getMonth() === proximoMes;
        });

        if (contasProximoMes.length > 0) {
            const h5 = document.createElement("h5");
            h5.className = "text-center py-3 mt-4";
            h5.textContent = `Próximas Contas (${new Date(anoProximoMes, proximoMes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})`;
            alertasEl.appendChild(h5);

            contasProximoMes.forEach(c => {
                const dataVencimento = parseDataFlex(c.vencimento);
                if (!dataVencimento) return;

                const vencimentoProximaParcela = new Date(dataVencimento);
                vencimentoProximaParcela.setMonth(dataVencimento.getMonth() + (c.parcelaAtual));

                const dataFormatada = vencimentoProximaParcela.toLocaleDateString('pt-BR');
                const categoriaDisplay = c.categoria ? c.categoria.charAt(0).toUpperCase() + c.categoria.slice(1) : 'Outros';
                const tagClass = c.categoria ? `tag-${c.categoria.toLowerCase()}` : `tag-outros`;
                const valorConta = formatBRL(c.valor || 0);

                const li = document.createElement("li");
                li.innerHTML = `
                    <div class="alerta-item alerta-normal">
                        <div class="alerta-header">
                            <div class="alerta-title-group">
                                <span class="alerta-categoria-tag ${tagClass}">${categoriaDisplay}</span>
                                <span class="alerta-title">${c.nome}</span>
                            </div>
                            <span class="alerta-valor">${valorConta}</span>
                        </div>
                        <div class="alerta-body">
                            <span class="alerta-message texto-normal">A conta vence no próximo mês.</span>
                            <div class="alerta-right-group">
                                <span class="alerta-data texto-normal">Vencimento: ${dataFormatada}</span>
                                <span class="alerta-info">Parcela ${c.parcelaAtual + 1} de ${c.parcelas}</span>
                            </div>
                        </div>
                    </div>
                `;
                alertasEl.appendChild(li);
            });
        }
    }
}

function renderizarDetalheGastos(semana, pagamentos) {
    const detalheEl = document.getElementById("detalheGastos");
    if (!detalheEl) return;

    detalheEl.innerHTML = `<h4>Gastos da Semana ${semana}</h4>`;
    const ul = document.createElement("ul");
    ul.className = 'list-unstyled';

    if (pagamentos.length > 0) {
        pagamentos.forEach(pag => {
            const li = document.createElement("li");
            const dataPagamentoFormatada = pag.data.toLocaleDateString();
            const valorFormatado = formatBRL(pag.valor);

            const categoria = pag.conta.categoria || 'outros';
            const categoriaClass = `cat-${categoria}`;
            const categoriaDisplay = categoria.charAt(0).toUpperCase() + categoria.slice(1);

            li.innerHTML = `
                <div class="gasto-detalhe-card ${categoriaClass}">
                    <div class="gasto-detalhe-header">
                        <span class="gasto-detalhe-title">${pag.conta.nome}</span>
                        <span class="gasto-detalhe-valor">${valorFormatado}</span>
                    </div>
                    <div class="gasto-detalhe-body">
                        <span class="gasto-detalhe-data">Pago em: ${dataPagamentoFormatada}</span>
                        <small class="text-muted">Parcela ${pag.conta.parcelaAtual + 1} de ${pag.conta.parcelas}</small>
                    </div>
                </div>
            `;
            ul.appendChild(li);
        });
    } else {
        const li = document.createElement("li");
        li.textContent = "Nenhum gasto registrado nesta semana.";
        li.className = "text-muted text-center py-3";
        ul.appendChild(li);
    }
    detalheEl.appendChild(ul);
}


function atualizarCalendarioSemana() {
    const contas = obterContas();
    const calendarioEl = document.getElementById("calendarioSemana");
    if (!calendarioEl) return;

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const semanas = 5;
    const valorPorSemana = Array(semanas).fill(0);
    const pagamentosPorSemana = Array(semanas).fill(null).map(() => []);

    const pagamentos = obterPagamentosDoMes(contas, anoAtual, mesAtual);

    pagamentos.forEach((pag) => {
        const sem = semanaDoMes(pag.data);
        valorPorSemana[sem - 1] += pag.valor;
        pagamentosPorSemana[sem - 1].push(pag);
    });

    const maxValor = Math.max(...valorPorSemana, 1);
    calendarioEl.innerHTML = "";

    const detalheEl = document.getElementById("detalheGastos");
    if (detalheEl) detalheEl.innerHTML = '';
    let semanaAtiva = -1;

    for (let i = 0; i < semanas; i++) {
        const div = document.createElement("div");
        div.classList.add("semana-card");
        div.style.flex = "1";
        div.style.margin = "2px";
        div.style.padding = "10px";
        div.style.borderRadius = "5px";
        div.style.textAlign = "center";
        div.setAttribute("data-semana", i + 1);

        div.innerHTML = `Semana ${i + 1}<br/>${formatBRL(valorPorSemana[i])}`;

        if (valorPorSemana[i] > 0) {
            div.classList.add("gasto");
            const intensidade = valorPorSemana[i] / maxValor;
            div.style.backgroundColor = `rgba(220,53,69,${0.3 + intensidade * 0.7})`;
            div.style.color = "white";
        } else {
            div.style.backgroundColor = "#e9ecef";
            div.style.color = "#000";
        }

        div.addEventListener("click", () => {
            const semanaClicada = i + 1;

            document.querySelectorAll(".semana-card").forEach(el => el.classList.remove("semana-ativa"));
            
            if (semanaAtiva === semanaClicada) {
                // Remove o conteúdo do detalhe
                if (detalheEl) {
                    detalheEl.classList.remove("mostrar");
                    detalheEl.innerHTML = '';
                }
                semanaAtiva = -1;
            } else {
                renderizarDetalheGastos(semanaClicada, pagamentosPorSemana[semanaClicada - 1]);
                if (detalheEl) detalheEl.classList.add("mostrar");
                semanaAtiva = semanaClicada;
                div.classList.add("semana-ativa");
            }
        });

        calendarioEl.appendChild(div);
    }
}


function atualizarGrafico() {
    const ctx = document.getElementById("graficoGastos");
    const legendaEl = document.getElementById("legendaCategorias");
    if (!ctx || !legendaEl || typeof Chart === "undefined") return;

    const contas = obterContas();
    const somaPorCategoria = {
        alimentacao: 0,
        transporte: 0,
        lazer: 0,
        divida: 0,
        outros: 0,
    };

    const hoje = new Date();
    const pagamentos = obterPagamentosDoMes(contas, hoje.getFullYear(), hoje.getMonth());

    pagamentos.forEach((pag) => {
        const cat = pag.conta.categoria || "outros";
        const key = somaPorCategoria.hasOwnProperty(cat) ? cat : "outros";
        somaPorCategoria[key] += pag.valor;
    });

    const labels = ["Alimentação", "Transporte", "Lazer", "Dívida", "Outros"];
    const keys = ["alimentacao", "transporte", "lazer", "divida", "outros"];
    const colors = keys.map((k) => coresCategoria[k]);

    const dadosFiltrados = keys.map((k, i) => ({
        label: labels[i],
        key: k,
        valor: somaPorCategoria[k],
        cor: colors[i],
    })).filter(item => item.valor > 0);

    if (dadosFiltrados.length === 0) {
        ctx.style.display = 'none';
        legendaEl.innerHTML = '<p class="text-center text-muted">Nenhum gasto registrado neste mês.</p>';
        if (graficoPizza) graficoPizza.destroy();
        return;
    } else {
        ctx.style.display = 'block';
    }

    if (graficoPizza) graficoPizza.destroy();

    graficoPizza = new Chart(ctx, {
        type: "pie",
        data: {
            labels: dadosFiltrados.map(item => item.label),
            datasets: [
                {
                    data: dadosFiltrados.map(item => item.valor),
                    backgroundColor: dadosFiltrados.map(item => item.cor),
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
        },
    });

    legendaEl.innerHTML = "";
    dadosFiltrados.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "legenda-item";
        div.innerHTML = `
            <span class="legenda-cor" style="background-color: ${item.cor}"></span>
            <span class="legenda-nome">${item.label}</span>
            <span class="legenda-valor">${formatBRL(item.valor)}</span>
        `;

        div.addEventListener("click", () => {
            const meta = graficoPizza.getDatasetMeta(0);
            const dataPonto = meta.data[index];
            dataPonto.hidden = !dataPonto.hidden;
            div.classList.toggle("inativo", dataPonto.hidden);
            graficoPizza.update();
        });

        legendaEl.appendChild(div);
    });
}

// =========================
// Boot / Sync entre telas
// =========================
function atualizarHome() {
    try {
        atualizarResumoHome();
        atualizarCalendarioSemana();
        atualizarGrafico();
    } catch (e) {
        console.error("[atualizarHome] Erro ao atualizar a Home:", e);
    }
}

document.addEventListener("DOMContentLoaded", atualizarHome);

window.addEventListener("storage", (event) => {
    if (event.key === "contas") {
        atualizarHome();
    }
});