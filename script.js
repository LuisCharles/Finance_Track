(() => {
    "use strict";

    const elSaldoTotal = document.getElementById("saldoTotal");
    const elGastoMes = document.getElementById("gastoMes");
    const elEntradaMes = document.getElementById("entradaMes");
    const calendarioSemana = document.getElementById("calendarioSemana");
    const detalheGastos = document.getElementById("detalheGastos");
    const alertasContainer = document.getElementById("alertas");
    const graficoCtxEl = document.getElementById("graficoGastos");
    const legendaContainer = document.getElementById("legendaCategorias");
    let graficoPizza = null;

    function semanaDoMes(d) { return Math.ceil(d.getDate() / 7); }

    function calcularGastoDoMesSeguro() {
        const contas = window.obterContas();
        const hoje = new Date();
        return contas.reduce((total, c) => {
            (c.pagamentos || []).forEach(p => {
                const pd = window.parseDataFlex(p.data);
                if (pd && pd.getMonth() === hoje.getMonth() && pd.getFullYear() === hoje.getFullYear()) {
                    total += window.toNumber(p.valor);
                }
            });
            return total;
        }, 0);
    }

    function calcularEntradaDoMesSeguro() {
        const ganhos = window.obterGanhos();
        const hoje = new Date();
        return ganhos.reduce((total, g) => {
            const gd = window.parseDataFlex(g.data);
            if (gd && gd.getMonth() === hoje.getMonth() && gd.getFullYear() === hoje.getFullYear()) {
                total += window.toNumber(g.valor);
            }
            return total;
        }, 0);
    }

    function diasParaVencimento(vencimento) {
        const hoje = new Date();
        const dv = window.parseDataFlex(vencimento);
        if (!dv) return null;
        hoje.setHours(0, 0, 0, 0);
        dv.setHours(0, 0, 0, 0);
        return Math.ceil((dv - hoje) / (1000 * 60 * 60 * 24));
    }
    
    function corAlerta(dias) {
        if (dias <= 0) return "urgente";
        if (dias <= 3) return "aviso";
        return "normal"; // Verde para o resto do mes atual
    }
    
    function classeTextoAlerta(dias) {
        if (dias < 0) return "texto-vencido";
        if (dias <= 3) return "texto-vence-breve";
        return "texto-normal";
    }
    
    function mensagemAlerta(dias, recorrencia) {
        if (dias < 0) return "Conta vencida, pague imediatamente!";
        if (dias === 0) return "Sua conta vence HOJE!";
        
        // Se for uma conta para o ano que vem (Longo Prazo)
        if (dias > 45) {
            let tipo = (recorrencia === 'anual') ? 'no próximo ano' : 'nos próximos meses';
            return `Você só se preocupa com isso ${tipo} (Faltam ${dias} dias)`;
        }
        
        return `Sua conta vence em ${dias} dia(s)`;
    }

    function criarElementoGasto(gasto, isAlerta = false) {
        const li = document.createElement("li");
        const conta = gasto.conta;
        
        const dataObj = window.parseDataFlex(gasto.data);
        const dataFormat = dataObj ? dataObj.toLocaleDateString('pt-BR') : 'Data não disponível';

        let innerHTML = '';
        if (isAlerta) {
            const dias = diasParaVencimento(conta.vencimento);
            
            // Se a conta for para daqui a muito tempo (Ex: Trimestral/Anual paga recém), fica cinza
            let cor = corAlerta(dias);
            if (dias > 45) cor = "secondary"; 

            const classeTexto = classeTextoAlerta(dias);
            const mensagem = mensagemAlerta(dias, conta.recorrencia);
            
            const vencimentoObj = window.parseDataFlex(conta.vencimento);
            const vencimentoFormatado = vencimentoObj ? vencimentoObj.toLocaleDateString('pt-BR') : 'Data não disponível';

            const numProximaParcela = (conta.parcelaAtual || 0) + 1; 

            innerHTML = `
                <div class="alerta-item alerta-${cor}">
                    <div class="alerta-header">
                        <div class="alerta-title-group">
                            <span class="alerta-categoria-tag tag-${conta.categoria || 'outros'}">${(conta.categoria || 'Outros').charAt(0).toUpperCase() + (conta.categoria || 'Outros').slice(1)}</span>
                            <span class="alerta-title">${conta.nome}</span>
                        </div>
                        <span class="alerta-valor">${window.formatBRL(conta.valor)}</span>
                    </div>
                    <div class="alerta-body">
                        <span class="alerta-message ${dias > 45 ? 'text-muted' : classeTexto}">${mensagem}</span>
                        <div class="alerta-right-group">
                            <span class="alerta-data ${dias > 45 ? 'text-muted' : classeTexto}">Vencimento: ${vencimentoFormatado}</span>
                            <span class="alerta-info">Parcela ${numProximaParcela} de ${conta.parcelas || 1}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            innerHTML = `
                <div class="gasto-detalhe-card cat-${conta.categoria || "outros"}">
                    <div class="gasto-detalhe-header">
                        <span class="gasto-detalhe-title">${conta.nome}</span>
                        <span class="gasto-detalhe-valor">${window.formatBRL(gasto.valor)}</span>
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

    function atualizarAlertas() {
        if (!alertasContainer) return;

        const alertaMesConcluidoContainer = document.getElementById("alerta-mes-concluido");
        if (alertaMesConcluidoContainer) alertaMesConcluidoContainer.innerHTML = "";
        alertasContainer.innerHTML = "";

        const contas = window.obterContas();
        const contasPendentes = contas.filter(c => (c.parcelaAtual || 0) < (c.parcelas || 1));

        // Pega contas vencidas (dias <= 0) OU contas que vencem nos próximos 35 dias
        let contasParaExibir = contasPendentes.filter(c => {
            const dias = diasParaVencimento(c.vencimento);
            return dias !== null && dias <= 35;
        });

        // Se não tiver nada pra pagar esse mês, pega contas mais pra frente (Longo prazo)
        if (contasParaExibir.length === 0 && contasPendentes.length > 0) {
            contasParaExibir = contasPendentes; // Mostra as anuais/trimestrais do futuro
            
            if (alertaMesConcluidoContainer) {
                alertaMesConcluidoContainer.innerHTML = `
                    <div class="alerta-mes-concluido border-success bg-success bg-opacity-10 text-success shadow-sm mb-4 p-3 rounded d-flex align-items-center justify-content-center">
                        <span class="fs-4 me-2">🎉</span>
                        <span class="fw-bold">Nenhuma conta para os próximos 30 dias! Listando seus compromissos futuros:</span>
                    </div>
                `;
            }
        }

        contasParaExibir.sort((a, b) => diasParaVencimento(a.vencimento) - diasParaVencimento(b.vencimento));

        if (contasParaExibir.length > 0) {
            contasParaExibir.forEach(c => {
                const li = criarElementoGasto({ conta: c }, true);
                alertasContainer.appendChild(li);
            });
        } else {
            alertasContainer.innerHTML = "<p class='text-muted text-center py-4 bg-light rounded'>Você não possui nenhuma conta pendente no sistema.</p>";
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
                const li = criarElementoGasto(p);
                ul.appendChild(li);
            });
        }
        detalheGastos.appendChild(ul);
    }

    function atualizarCalendarioSemana() {
        if (!calendarioSemana) return;
        const contas = window.obterContas();
        const semanas = 5;
        const valorPorSemana = Array.from({ length: semanas }, () => 0);
        const pagamentosPorSemana = Array.from({ length: semanas }, () => []);

        contas.forEach(c => {
            (c.pagamentos || []).forEach(p => {
                const pd = window.parseDataFlex(p.data);
                if (!pd) return;
                const sem = semanaDoMes(pd);
                if (sem >= 1 && sem <= semanas) {
                    valorPorSemana[sem - 1] += window.toNumber(p.valor);
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
            div.innerHTML = `Semana ${i + 1}<br/>${window.formatBRL(valorPorSemana[i])}`;
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

    function atualizarGraficoGastos() {
        if (!graficoCtxEl) return;
        const contas = window.obterContas();
        const hoje = new Date();
        const pagamentos = contas.flatMap(c => (c.pagamentos || []).map(p => ({ ...p, conta: c })))
            .filter(p => {
                const pd = window.parseDataFlex(p.data);
                return pd && pd.getMonth() === hoje.getMonth() && pd.getFullYear() === hoje.getFullYear();
            });

        const somaPorCat = {};
        pagamentos.forEach(p => {
            const cat = p.conta.categoria || "outros";
            somaPorCat[cat] = (somaPorCat[cat] || 0) + window.toNumber(p.valor);
        });

        const labels = Object.keys(somaPorCat);
        const data = labels.map(l => somaPorCat[l]);
        const colors = labels.map(l => window.coresCategoria[l] || "#6c757d");

        if (graficoPizza) graficoPizza.destroy();

        graficoPizza = new Chart(graficoCtxEl, {
            type: "pie",
            data: {
                labels,
                datasets: [{ data, backgroundColor: colors, borderColor: "#fff", borderWidth: 2 }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.parsed;
                                const perc = ((val / total) * 100).toFixed(1) + "%";
                                return `${context.label}: ${window.formatBRL(val)} (${perc})`;
                            }
                        }
                    }
                }
            }
        });

        if (legendaContainer) {
            legendaContainer.innerHTML = "";
            labels.forEach((label, i) => {
                const div = document.createElement("div");
                div.className = "legenda-item";
                div.innerHTML = `
                    <span class="legenda-cor" style="background-color:${colors[i]}"></span>
                    <span class="legenda-nome">${label}</span>
                    <span class="legenda-valor">${window.formatBRL(data[i])}</span>
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

    function atualizarHome() {
        if(elSaldoTotal) elSaldoTotal.textContent = window.formatBRL(window.calcularSaldoTotal());
        if(elGastoMes) elGastoMes.textContent = window.formatBRL(calcularGastoDoMesSeguro());
        if(elEntradaMes) elEntradaMes.textContent = window.formatBRL(calcularEntradaDoMesSeguro());
        atualizarCalendarioSemana();
        atualizarAlertas();
        atualizarGraficoGastos();
    }

    document.addEventListener("DOMContentLoaded", atualizarHome);
    window.addEventListener("storage", atualizarHome);

})();