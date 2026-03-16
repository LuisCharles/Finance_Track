(() => {
    "use strict";

    // --- Variáveis de Gráficos ---
    let chartBarras = null;
    let chartPizza = null;

    // --- Elementos de Filtro ---
    const selectTipo = document.getElementById("filtroTipo");
    const selectMes = document.getElementById("filtroMes");
    const selectAno = document.getElementById("filtroAno");

    // --- Elementos de Resumo e UI ---
    const elEntradas = document.getElementById("relTotalEntradas");
    const elSaidas = document.getElementById("relTotalSaidas");
    const elGuardado = document.getElementById("relTotalGuardado");
    const elInvestido = document.getElementById("relTotalInvestido");
    const elBalanco = document.getElementById("relBalancoTotal");
    const tituloBarra = document.getElementById("tituloGraficoBarra");
    const cardMovimentacoes = document.getElementById("cardMovimentacoes");
    const listaExtrato = document.getElementById("listaExtrato");

    // --- Elementos de Comparativo ---
    const boxComparativo = document.getElementById("boxComparativo");
    const compEntradas = document.getElementById("compEntradas");
    const compSaidas = document.getElementById("compSaidas");
    const compGuardado = document.getElementById("compGuardado");

    // --- Botão de PDF ---
    const btnGerarPDF = document.getElementById("btnGerarPDF");

    // --- Constantes de Datas ---
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    /**
     * Inicializa os selects de filtros com as datas atuais
     */
    function inicializarFiltros() {
        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth();

        // Popular Anos
        [anoAtual - 1, anoAtual, anoAtual + 1].forEach(ano => {
            selectAno.add(new Option(ano, ano, false, ano === anoAtual));
        });

        // Popular Meses
        nomesMeses.forEach((nome, index) => {
            selectMes.add(new Option(nome, index, false, index === mesAtual));
        });

        // Eventos de Mudança
        selectTipo.addEventListener("change", () => {
            selectMes.style.display = selectTipo.value === "mes" ? "block" : "none";
            renderizarRelatorios();
        });

        selectMes.addEventListener("change", renderizarRelatorios);
        selectAno.addEventListener("change", renderizarRelatorios);
    }

    /**
     * Consolida todos os dados para os relatórios
     */
    function processarDados() {
        const tipo = selectTipo.value;
        const mesRef = parseInt(selectMes.value);
        const anoRef = parseInt(selectAno.value);

        const mesAnt = mesRef === 0 ? 11 : mesRef - 1;
        const anoAnt = mesRef === 0 ? anoRef - 1 : anoRef;

        const ganhos = window.obterGanhos();
        const contas = window.obterContas();
        const objetivos = window.obterObjetivos();

        let totalEntradas = 0, totalSaidas = 0, totalGuardado = 0, totalInvestido = 0;
        let antEntradas = 0, antSaidas = 0, antAcumulado = 0;

        let categoriasSoma = {};
        let extrato = [];

        let arrayBarrasEntradas = tipo === 'ano' ? Array(12).fill(0) : [0];
        let arrayBarrasSaidas = tipo === 'ano' ? Array(12).fill(0) : [0];
        let arrayBarrasGuardado = tipo === 'ano' ? Array(12).fill(0) : [0];
        let arrayBarrasInvestido = tipo === 'ano' ? Array(12).fill(0) : [0];
        let labelsBarras = tipo === 'ano' ? mesesAbrev : [nomesMeses[mesRef]];

        // Processamento de Ganhos
        ganhos.forEach(g => {
            const d = window.parseDataFlex(g.data);
            if (d) {
                const v = window.toNumber(g.valor);
                if (d.getFullYear() === anoRef) {
                    if (tipo === 'ano') arrayBarrasEntradas[d.getMonth()] += v;
                    if (tipo === 'ano' || d.getMonth() === mesRef) {
                        totalEntradas += v;
                        if (tipo === 'mes') {
                            arrayBarrasEntradas[0] += v;
                            extrato.push({ data: d, tipo: 'entrada', nome: g.nome, valor: v });
                        }
                    }
                }
                if (tipo === 'mes' && d.getFullYear() === anoAnt && d.getMonth() === mesAnt) antEntradas += v;
            }
        });

        // Processamento de Contas
        contas.forEach(c => {
            const cat = c.categoria || "outros";
            (c.pagamentos || []).forEach(p => {
                const d = window.parseDataFlex(p.data);
                if (d) {
                    const v = window.toNumber(p.valor);
                    if (d.getFullYear() === anoRef) {
                        if (tipo === 'ano') arrayBarrasSaidas[d.getMonth()] += v;
                        if (tipo === 'ano' || d.getMonth() === mesRef) {
                            totalSaidas += v;
                            categoriasSoma[cat] = (categoriasSoma[cat] || 0) + v;
                            if (tipo === 'mes') {
                                arrayBarrasSaidas[0] += v;
                                extrato.push({ data: d, tipo: 'saida', nome: `Pagto: ${c.nome}`, valor: v });
                            }
                        }
                    }
                    if (tipo === 'mes' && d.getFullYear() === anoAnt && d.getMonth() === mesAnt) antSaidas += v;
                }
            });
        });

        // Processamento de Objetivos/Investimentos
        objetivos.forEach(obj => {
            const isInv = obj.tipoRegistro === 'investimento';
            (obj.depositos || []).forEach(d => {
                if (d.tipo === 'rendimento') return;
                const dataDep = window.parseDataFlex(d.data);
                if (dataDep) {
                    const v = window.toNumber(d.valor);
                    if (dataDep.getFullYear() === anoRef) {
                        if (tipo === 'ano' || dataDep.getMonth() === mesRef) {
                            if (isInv) {
                                totalInvestido += v;
                                if (tipo === 'ano') arrayBarrasInvestido[dataDep.getMonth()] += v;
                                else arrayBarrasInvestido[0] += v;
                            } else {
                                totalGuardado += v;
                                if (tipo === 'ano') arrayBarrasGuardado[dataDep.getMonth()] += v;
                                else arrayBarrasGuardado[0] += v;
                            }
                            if (tipo === 'mes') {
                                const txt = v > 0 ? `Aporte em: ${obj.nome}` : `Resgate de: ${obj.nome}`;
                                const corTipo = isInv ? 'investimento' : 'guardado';
                                extrato.push({ data: dataDep, tipo: v > 0 ? corTipo : 'entrada', nome: txt, valor: Math.abs(v) });
                            }
                        }
                    }
                    if (tipo === 'mes' && dataDep.getFullYear() === anoAnt && dataDep.getMonth() === mesAnt) antAcumulado += v;
                }
            });
        });

        if (totalGuardado > 0) categoriasSoma["Objetivos (Guardado)"] = totalGuardado;
        if (totalInvestido > 0) categoriasSoma["Investimentos"] = totalInvestido;

        extrato.sort((a, b) => b.data - a.data);

        return {
            totalEntradas, totalSaidas, totalGuardado, totalInvestido,
            antEntradas, antSaidas, antAcumulado,
            arrayBarrasEntradas, arrayBarrasSaidas, arrayBarrasGuardado, arrayBarrasInvestido,
            labelsBarras, categoriasSoma, extrato, tipo
        };
    }

    /**
     * Gera o HTML das setas de comparação
     */
    function gerarComparativoVisual(valorAtual, valorAntigo, tipoDado) {
        if (valorAntigo === 0 && valorAtual === 0) return `<span class="text-muted small">Sem dados</span>`;
        let diff = valorAtual - valorAntigo;
        let icone = "", cor = "", msg = "";

        if (tipoDado === "entrada" || tipoDado === "acumulado") {
            if (diff > 0) { cor = "text-success"; icone = "bi-graph-up-arrow"; msg = `+${window.formatBRL(diff)}`; }
            else if (diff < 0) { cor = "text-danger"; icone = "bi-graph-down-arrow"; msg = `${window.formatBRL(diff)}`; }
            else { cor = "text-muted"; icone = "bi-dash-lg"; msg = "Igual"; }
        } else {
            if (diff > 0) { cor = "text-danger"; icone = "bi-graph-up-arrow"; msg = `+${window.formatBRL(diff)}`; }
            else if (diff < 0) { cor = "text-success"; icone = "bi-graph-down-arrow"; msg = `${window.formatBRL(diff)}`; }
            else { cor = "text-muted"; icone = "bi-dash-lg"; msg = "Igual"; }
        }
        return `<span class="${cor} fw-bold small"><i class="bi ${icone}"></i> ${msg}</span>`;
    }

    /**
     * Renderiza os gráficos de Barras e Pizza
     */
    function desenharGraficos(dados) {
        const ctxBarras = document.getElementById('graficoBarras');
        if (chartBarras) chartBarras.destroy();
        tituloBarra.innerText = dados.tipo === 'ano' ? 'Evolução (Mês a Mês)' : `Total (Neste Mês)`;

        chartBarras = new Chart(ctxBarras, {
            type: 'bar',
            data: {
                labels: dados.labelsBarras,
                datasets: [
                    { label: 'Entradas', data: dados.arrayBarrasEntradas, backgroundColor: '#28a745', borderRadius: 4 },
                    { label: 'Saídas', data: dados.arrayBarrasSaidas, backgroundColor: '#dc3545', borderRadius: 4 },
                    { label: 'Objetivos', data: dados.arrayBarrasGuardado, backgroundColor: '#A29BFE', borderRadius: 4 },
                    { label: 'Investimentos', data: dados.arrayBarrasInvestido, backgroundColor: '#ffc107', borderRadius: 4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: c => window.formatBRL(c.parsed.y) } } } }
        });

        const ctxPizza = document.getElementById('graficoPizza');
        if (chartPizza) chartPizza.destroy();

        const pLabels = Object.keys(dados.categoriasSoma);
        const pData = pLabels.map(l => dados.categoriasSoma[l]);
        const pColors = pLabels.map(l => {
            if (l === "Objetivos (Guardado)") return "#A29BFE";
            if (l === "Investimentos") return "#ffc107";
            return window.coresCategoria[l] || "#6c757d";
        });

        if (pData.length === 0) {
            chartPizza = new Chart(ctxPizza, {
                type: 'doughnut',
                data: { labels: ['Sem dados'], datasets: [{ data: [1], backgroundColor: ['#e9ecef'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } } }
            });
        } else {
            chartPizza = new Chart(ctxPizza, {
                type: 'doughnut',
                data: {
                    labels: pLabels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                    datasets: [{ data: pData, backgroundColor: pColors, borderWidth: 0 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 10 } },
                        tooltip: { callbacks: { label: c => ` ${window.formatBRL(c.parsed)}` } }
                    }
                }
            });
        }

        // Atualização do Comparativo Visual
        if (dados.tipo === 'mes') {
            boxComparativo.style.display = "block";
            compEntradas.innerHTML = `<span class="text-muted small"><i class="bi bi-arrow-up-circle text-success me-1"></i>Entrou</span> ${gerarComparativoVisual(dados.totalEntradas, dados.antEntradas, "entrada")}`;
            compSaidas.innerHTML = `<span class="text-muted small"><i class="bi bi-arrow-down-circle text-danger me-1"></i>Gastou</span> ${gerarComparativoVisual(dados.totalSaidas, dados.antSaidas, "saida")}`;
            compGuardado.innerHTML = `<span class="text-muted small"><i class="bi bi-piggy-bank text-primary-purple me-1"></i>Aportou</span> ${gerarComparativoVisual((dados.totalGuardado + dados.totalInvestido), dados.antAcumulado, "acumulado")}`;
        } else {
            boxComparativo.style.display = "none";
        }
    }

    /**
     * Atualiza os números e lista na tela
     */
    function renderizarRelatorios() {
        const dados = processarDados();

        // --- CORREÇÃO DE CORES NOS CARDS DE RESUMO ---
        // Forçamos a cor correta em cada elemento para evitar que o tema escuro os deixe brancos
        elEntradas.style.color = "#28a745"; // Verde
        elSaidas.style.color = "#dc3545";   // Vermelho
        elGuardado.style.color = "#A29BFE"; // Roxo
        elInvestido.style.color = "#ffc107"; // Amarelo/Dourado

        window.animarNumero(elEntradas, dados.totalEntradas, window.formatBRL);
        window.animarNumero(elSaidas, dados.totalSaidas, window.formatBRL);
        window.animarNumero(elGuardado, dados.totalGuardado, window.formatBRL);
        window.animarNumero(elInvestido, dados.totalInvestido, window.formatBRL);
        window.animarNumero(elBalanco, (dados.totalEntradas - dados.totalSaidas - dados.totalGuardado - dados.totalInvestido), window.formatBRL);

        desenharGraficos(dados);

        if (dados.tipo === 'mes') {
            cardMovimentacoes.style.display = 'block';
            listaExtrato.innerHTML = '';
            if (dados.extrato.length === 0) {
                listaExtrato.innerHTML = '<p class="text-muted text-center py-3">Nenhuma movimentação neste mês.</p>';
            } else {
                dados.extrato.forEach(mov => {
                    let icone = '<i class="bi bi-arrow-down-circle-fill text-success fs-5"></i>';
                    let corValor = 'text-success';
                    
                    if (mov.tipo === 'saida') { icone = '<i class="bi bi-arrow-up-circle-fill text-danger fs-5"></i>'; corValor = 'text-danger'; }
                    if (mov.tipo === 'guardado') { icone = '<i class="bi bi-piggy-bank-fill text-primary-purple fs-5"></i>'; corValor = 'text-primary-purple'; }
                    if (mov.tipo === 'investimento') { icone = '<i class="bi bi-graph-up-arrow text-warning fs-5"></i>'; corValor = 'text-warning'; }
                    
                    const sinal = mov.tipo === 'entrada' ? '+' : '-';

                    // --- CORREÇÃO: Removemos 'text-dark' do nome para que ele use a cor do tema escuro automaticamente ---
                    listaExtrato.innerHTML += `
                        <div class="mov-item bg-white bg-opacity-10 p-3 rounded shadow-sm border border-light border-opacity-10 d-flex justify-content-between align-items-center mb-2">
                            <div class="d-flex align-items-center gap-3">
                                ${icone}
                                <div>
                                    <strong class="d-block text-white">${mov.nome}</strong> <small class="text-muted">${mov.data.toLocaleDateString('pt-BR')}</small>
                                </div>
                            </div>
                            <span class="fw-bold ${corValor}">${sinal} ${window.formatBRL(mov.valor)}</span>
                        </div>`;
                });
            }
        } else {
            cardMovimentacoes.style.display = 'none';
        }
    }

    /**
     * Exporta o relatório visível para PDF
     */
    async function exportarParaPDF() {
        const { jsPDF } = window.jspdf;
        const dados = processarDados();
        const periodo = selectTipo.value === "mes" ? `${nomesMeses[selectMes.value]} ${selectAno.value}` : `Ano ${selectAno.value}`;

        const pdf = new jsPDF("p", "mm", "a4");
        const largura = pdf.internal.pageSize.getWidth();
        let y = 20;

        // Cabeçalho
        pdf.setFontSize(20);
        pdf.text("Relatório Financeiro", largura / 2, y, { align: "center" });
        y += 8;
        pdf.setFontSize(11);
        pdf.text(`Período: ${periodo}`, largura / 2, y, { align: "center" });
        y += 15;

        // Resumo Numérico
        pdf.setFontSize(14);
        pdf.text("Resumo Financeiro", 15, y);
        y += 8;
        pdf.setFontSize(11);

        const balanco = dados.totalEntradas - dados.totalSaidas - dados.totalGuardado - dados.totalInvestido;
        const resumo = [
            ["Entradas", window.formatBRL(dados.totalEntradas)],
            ["Saídas", window.formatBRL(dados.totalSaidas)],
            ["Guardado", window.formatBRL(dados.totalGuardado)],
            ["Investido", window.formatBRL(dados.totalInvestido)],
            ["Balanço", window.formatBRL(balanco)]
        ];

        resumo.forEach(l => {
            pdf.text(l[0], 20, y);
            pdf.text(l[1], 100, y);
            y += 7;
        });

        y += 10;
        pdf.setFontSize(14);
        pdf.text("Gráficos", 15, y);
        y += 10;

        // Captura do Gráfico de Barras
        const barrasCanvas = document.getElementById("graficoBarras");
        const barrasImg = await html2canvas(barrasCanvas);
        const barrasData = barrasImg.toDataURL("image/png");
        pdf.addImage(barrasData, "PNG", 15, y, 180, 60);
        y += 70;

        // Captura do Gráfico de Pizza
        const pizzaCanvas = document.getElementById("graficoPizza");
        const pizzaImg = await html2canvas(pizzaCanvas);
        const pizzaData = pizzaImg.toDataURL("image/png");
        pdf.addImage(pizzaData, "PNG", 60, y, 90, 90);

        // Página de Histórico (Movimentações)
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.text("Histórico de Movimentações", 15, 20);
        let yTable = 30;
        pdf.setFontSize(11);

        dados.extrato.forEach(mov => {
            if (yTable > 270) {
                pdf.addPage();
                yTable = 20;
            }
            pdf.text(mov.data.toLocaleDateString("pt-BR"), 15, yTable);
            pdf.text(mov.nome.substring(0, 40), 45, yTable);
            pdf.text(mov.tipo, 130, yTable);
            pdf.text(window.formatBRL(mov.valor), 160, yTable);
            yTable += 7;
        });

        pdf.save(`Relatorio_FinanceTrack_${periodo}.pdf`);
    }

    // --- Inicialização ao Carregar o DOM ---
    document.addEventListener("DOMContentLoaded", () => {
        inicializarFiltros();
        renderizarRelatorios();

        if (btnGerarPDF) {
            btnGerarPDF.addEventListener("click", exportarParaPDF);
        }
    });

    window.addEventListener("storage", renderizarRelatorios);

})();