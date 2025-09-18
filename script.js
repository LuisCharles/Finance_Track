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

    // Trata a string de data adicionando T00:00:00
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

// =========================
// Resumo (cards do topo)
// =========================
function atualizarResumoHome() {
    const contas = obterContas();
    const saldoTotalEl = document.getElementById("saldoTotal");
    const gastosMesEl = document.getElementById("gastosMes");
    const entradasMesEl = document.getElementById("entradasMes");
    const alertasEl = document.getElementById("alertas");
    // Removido: const proximasContasEl = document.getElementById("proximasContas");

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const proximoMes = (mesAtual === 11) ? 0 : mesAtual + 1;
    const anoProximoMes = (mesAtual === 11) ? anoAtual + 1 : anoAtual;

    const pagamentos = obterPagamentosDoMes(contas, anoAtual, mesAtual);
    let gastosDoMes = pagamentos.reduce((acc, p) => acc + p.valor, 0);

    const saldoTotal = 0;
    const entradasMes = 0;

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
        
        // Adiciona um separador se houver contas futuras
        const contasProximoMes = contas.filter(c => {
            const dataVencimento = parseDataFlex(c.vencimento);
            if (!dataVencimento) return false;

            const proximaParcela = c.parcelaAtual + 1;
            if (proximaParcela > c.parcelas) {
                return false;
            }

            const vencimentoProximaParcela = new Date(dataVencimento);
            vencimentoProximaParcela.setMonth(dataVencimento.getMonth() + proximaParcela);

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
                vencimentoProximaParcela.setMonth(dataVencimento.getMonth() + (c.parcelaAtual + 1));

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
                                <span class="alerta-info">Parcela ${c.parcelaAtual + 2} de ${c.parcelas}</span>
                            </div>
                        </div>
                    </div>
                `;
                alertasEl.appendChild(li);
            });
        }
    }
}


// =========================
// Novo: Renderiza os detalhes de gastos semanais
// =========================
function renderizarDetalheGastos(semana, pagamentos) {
    const detalheEl = document.getElementById("detalheGastos");
    if (!detalheEl) return;

    detalheEl.innerHTML = `<h4>Gastos da Semana ${semana}</h4>`;
    const ul = document.createElement("ul");

    if (pagamentos.length > 0) {
        pagamentos.forEach(pag => {
            const li = document.createElement("li");
            const dataPagamentoFormatada = pag.data.toLocaleDateString();
            const valorFormatado = formatBRL(pag.valor);

            const categoria = pag.conta.categoria || 'outros';
            const categoriaClass = `cat-${categoria}`;
            const tagClass = `tag-${categoria}`;
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

// =========================
// Mini calendário semanal
// =========================
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

        div.textContent = `Semana ${i + 1}\n${formatBRL(valorPorSemana[i])}`;

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

            if (semanaAtiva === semanaClicada) {
                // Clicou na mesma semana: esconde
                detalheEl.classList.remove("mostrar");
                semanaAtiva = -1;
            } else {
                // Clicou em uma nova semana: mostra
                renderizarDetalheGastos(semanaClicada, pagamentosPorSemana[semanaClicada - 1]);
                detalheEl.classList.add("mostrar");
                semanaAtiva = semanaClicada;
            }
        });

        calendarioEl.appendChild(div);
    }
}

// =========================
// Gráfico pizza (Chart.js)
// =========================
let graficoPizza;
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
    const data = keys.map((k) => somaPorCategoria[k]);
    const colors = keys.map((k) => coresCategoria[k]);

    // Filtra categorias com valor 0 para não mostrar no gráfico e na legenda
    const dadosFiltrados = data.map((v, i) => ({
        label: labels[i],
        key: keys[i],
        valor: v,
        cor: colors[i],
    })).filter(item => item.valor > 0);

    // Se não há dados, mostra mensagem
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
                    display: false, // Esconde a legenda padrão do Chart.js
                },
            },
        },
    });

    // Renderiza a legenda customizada
    legendaEl.innerHTML = ""; // Limpa a legenda antiga
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
            dataPonto.hidden = !dataPonto.hidden; // Alterna a visibilidade
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

window.atualizarHome = atualizarHome;

document.addEventListener("DOMContentLoaded", atualizarHome);

window.addEventListener("storage", (event) => {
    if (event.key === "contas") {
        atualizarHome();
    }
});

// =========================
// FUNÇÃO DE RENDERIZAÇÃO DA PÁGINA DE MOVIMENTAÇÕES
// =========================
const renderizarContas = () => {
    const listaContas = document.getElementById("listaContas");
    if (!listaContas) return;

    let contas = obterContas();
    listaContas.innerHTML = "";

    contas.forEach((conta, index) => {
        const li = document.createElement("li");
        li.className = "list-group-item";

        const valorParcela = toNumber(conta.valor);
        const parcelas = conta.parcelas || 1;
        const parcelaAtual = conta.parcelaAtual || 0;
        const porcentagem = Math.round((parcelaAtual / parcelas) * 100);

        const corCategoria = coresCategoria[conta.categoria] || coresCategoria.outros;

        let barraClass = "#dc3545"; // vermelho
        if (porcentagem >= 50 && porcentagem < 100) barraClass = "#ffc107"; // amarelo
        if (porcentagem >= 100) barraClass = "#198754"; // verde

        let vencTexto = "";
        if (conta.vencimento) {
            const dataOriginal = parseDataFlex(conta.vencimento);
            if(dataOriginal) {
                // CORREÇÃO: Usa setMonth para garantir que a data não mude com a troca de mês
                const proximoVencimento = new Date(dataOriginal);
                proximoVencimento.setMonth(dataOriginal.getMonth() + parcelaAtual);
                vencTexto = ` | Venc.: ${proximoVencimento.toLocaleDateString('pt-BR')}`;
            }
        }

        const badgeCategoria = `<span class="badge" style="background:${corCategoria}; margin-right:5px">${conta.categoria}</span>`;

        if (porcentagem >= 100) {
            li.classList.add("conta-concluida");
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>${badgeCategoria}<strong>${conta.nome}</strong> - Concluído - ${formatBRL(
                        valorParcela * parcelas
                    )} ${vencTexto}</div>
                    <div><button class="btn btn-sm btn-danger btn-remover">Remover</button></div>
                </div>
                <div class="progress">
                    <div class="progress-bar" role="progressbar"
                        style="width:100%; background:${barraClass};" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            `;
        } else {
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>${badgeCategoria}<strong>${conta.nome}</strong> - Parcela ${parcelaAtual + 1} de ${parcelas} - ${formatBRL(
                        valorParcela
                    )} ${vencTexto}</div>
                    <div>
                        <button class="btn btn-sm btn-primary btn-pagar me-2">Pagar</button>
                        <button class="btn btn-sm btn-warning btn-desfazer me-2">Desfazer</button>
                        <button class="btn btn-sm btn-danger btn-remover">Remover</button>
                    </div>
                </div>
                <div class="progress">
                    <div class="progress-bar" role="progressbar"
                        style="width:${Math.max(2, porcentagem)}%; background:${barraClass};" aria-valuenow="${porcentagem}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            `;
        }

        const btnPagar = li.querySelector(".btn-pagar");
        const btnDesfazer = li.querySelector(".btn-desfazer");
        const btnRemover = li.querySelector(".btn-remover");

        if (btnPagar)
            btnPagar.addEventListener("click", () => {
                let contas = obterContas();
                if (contas[index].parcelaAtual < contas[index].parcelas) {
                    registrarPagamento(contas[index]);
                    salvarContas(contas);
                    renderizarContas();
                }
            });
        if (btnDesfazer)
            btnDesfazer.addEventListener("click", () => {
                let contas = obterContas();
                if (contas[index].parcelaAtual > 0) {
                    contas[index].parcelaAtual--;
                    // remove o último pagamento registrado
                    if(contas[index].pagamentos && contas[index].pagamentos.length > 0) {
                        contas[index].pagamentos.pop();
                    }
                    salvarContas(contas);
                    renderizarContas();
                }
            });
        if (btnRemover)
            btnRemover.addEventListener("click", () => {
                if (confirm(`Remover "${contas[index].nome}"?`)) {
                    contas.splice(index, 1);
                    salvarContas(contas);
                    renderizarContas();
                }
            });

        listaContas.appendChild(li);
        li.classList.add("animar-entrada");
    });
    atualizarResumo(); // Chame a função de atualização do resumo da página de movimentações
};

function atualizarResumo() {
    const contas = obterContas();
    const totalContasEl = document.getElementById("totalContas");
    const totalPagoEl = document.getElementById("totalPago");
    const totalRestanteEl = document.getElementById("totalRestante");

    const totalContas = contas.length;
    const totalPago = contas.reduce(
        (acc, c) => acc + (c.pagamentos ? c.pagamentos.reduce((pAcc, p) => pAcc + toNumber(p.valor), 0) : 0),
        0
    );
    const totalRestante = contas.reduce(
        (acc, c) => acc + (toNumber(c.valor) * ((c.parcelas || 0) - (c.parcelaAtual || 0))),
        0
    );

    if (totalContasEl) animarNumero(totalContasEl, totalContas, Math.round);
    if (totalPagoEl) animarNumero(totalPagoEl, totalPago, formatBRL);
    if (totalRestanteEl) animarNumero(totalRestanteEl, totalRestante, formatBRL);
}

// NOVO: FUNÇÃO PARA REGISTRAR UM PAGAMENTO COM DATA
function registrarPagamento(conta) {
  if (!Array.isArray(conta.pagamentos)) {
    conta.pagamentos = [];
  }
  conta.pagamentos.push({
    valor: conta.valor,
    data: new Date().toISOString(), // Registra a data e hora do pagamento
  });
  conta.parcelaAtual = Math.max(0, (conta.parcelaAtual || 0) + 1);
}

// NOVO: FUNÇÃO PARA MIGRAR DADOS ANTIGOS
function migrarDadosAntigos() {
  let dadosMigrados = false;
  let contas = obterContas();
  contas.forEach(conta => {
    // Se a conta não tiver o array de pagamentos mas tiver parcelas pagas, migra.
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
    // Adiciona o array vazio para novas contas
    if (!Array.isArray(conta.pagamentos)) {
        conta.pagamentos = [];
    }
  });
  // Salva se houve alguma mudança
  if (dadosMigrados) {
    salvarContas(contas);
  }
}

document.addEventListener("DOMContentLoaded", () => {
    migrarDadosAntigos();
    renderizarContas();
});
