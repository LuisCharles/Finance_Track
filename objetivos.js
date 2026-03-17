(() => {
    "use strict";

    const listaObjetivos = document.getElementById("listaObjetivos");
    const elTotalGuardado = document.getElementById("totalGuardado");
    const elSaldoLivre = document.getElementById("saldoLivre");
    
    // Elementos do Modal Novo Registro
    const selectTipoRegistro = document.getElementById("tipoRegistro");
    const boxTicker = document.getElementById("boxTicker"); 
    const inputTicker = document.getElementById("tickerAtivo");
    const boxDataAlvo = document.getElementById("boxDataAlvo");
    const labelNome = document.getElementById("labelNome");
    const labelValorAlvo = document.getElementById("labelValorAlvo");

    // Elementos do Modal Manipular
    const modalManipular = document.getElementById('modalManipularObjetivo');
    const tituloManipular = document.getElementById('tituloManipular');
    const descManipular = document.getElementById('descManipular');
    const inputValor = document.getElementById('valorManipular');
    const avisoSaldo = document.getElementById('avisoSaldo');
    const btnConfirmar = document.getElementById('btnConfirmarAcao');
    const inputIndex = document.getElementById('indexObjetivoAtivo');
    const inputTipo = document.getElementById('tipoAcaoModal');

    // --- NOVOS ELEMENTOS DO EXPLORADOR (MANTIDOS) ---
    const btnLupa = document.getElementById('btnExplorarMercado');
    const inputBuscaExplorar = document.getElementById('buscaExplorar');
    const containerResultados = document.getElementById('containerResultados');
    const modalExplorarEl = document.getElementById('modalExplorar');

    // ==========================================================
    // INTEGRAÇÃO COM API DA BOLSA (Brapi) 
    // ==========================================================
    async function buscarDadosBolsa(ticker) {
        if (!ticker) return null;
        try {
            const response = await fetch(`https://brapi.dev/api/quote/${ticker.toUpperCase()}?token=vn5Jk1x6eBKPTEjzYK8it2`);
            const data = await response.json();
            if (data.results && data.results[0]) {
                return {
                    preco: data.results[0].regularMarketPrice,
                    variacao: data.results[0].regularMarketChangePercent,
                    nome: data.results[0].longName
                };
            } else {
                return "erro"; // Retorna string de erro se o ticker não existir
            }
        } catch (e) {
            console.error("Erro ao buscar Ticker:", ticker, e);
            return null;
        }
    }

    // ==========================================================
    // LÓGICA DO EXPLORADOR 
    // ==========================================================
    async function atualizarInterfaceExplorador(filtro = "") {
        if (!window.carregarListaTickers) return;
        
        const tickers = await window.carregarListaTickers(); 
        const filtrados = tickers.filter(t => t.includes(filtro.toUpperCase())).slice(0, 60);

        containerResultados.innerHTML = filtrados.map(t => `
            <button type="button" class="btn btn-outline-dark btn-sm fw-bold px-3 py-2 btn-ticker-item" data-ticker="${t}">
                ${t}
            </button>
        `).join('');

        document.querySelectorAll('.btn-ticker-item').forEach(btn => {
            btn.addEventListener('click', function() {
                inputTicker.value = this.dataset.ticker;
                const m = bootstrap.Modal.getInstance(modalExplorarEl);
                if (m) m.hide();
            });
        });
    }

    // Lógica de mostrar/esconder campos ao criar - MANTIDO
    if(selectTipoRegistro) {
        selectTipoRegistro.addEventListener("change", function() {
            if(this.value === 'investimento') {
                boxDataAlvo.style.display = 'none';
                boxTicker.style.display = 'block'; 
                labelNome.innerText = "Apelido do Investimento";
                labelValorAlvo.innerText = "Valor do Primeiro Aporte";
            } else {
                boxDataAlvo.style.display = 'block';
                boxTicker.style.display = 'none'; 
                labelNome.innerText = "Nome do Objetivo";
                labelValorAlvo.innerText = "Valor Alvo (Meta)";
            }
        });
    }

    function fecharModais() {
        if(document.activeElement) document.activeElement.blur();
        const m1 = bootstrap.Modal.getInstance(document.getElementById("modalObjetivo"));
        const m2 = bootstrap.Modal.getInstance(modalManipular);
        if (m1) m1.hide();
        if (m2) m2.hide();
    }

    function atualizarResumo() {
        const saldoLivre = window.calcularSaldoTotal();
        const objetivos = window.obterObjetivos();
        const totalPatrimonio = objetivos.reduce((acc, obj) => acc + (obj.depositos || []).reduce((s, d) => s + window.toNumber(d.valor), 0), 0);

        if (elSaldoLivre) elSaldoLivre.textContent = window.formatBRL(saldoLivre);
        if (elTotalGuardado) elTotalGuardado.textContent = window.formatBRL(totalPatrimonio);
    }

    function abrirModalAcao(index, nome, tipo) {
        inputIndex.value = index;
        inputTipo.value = tipo;
        inputValor.value = '';
        avisoSaldo.style.display = 'none';

        if (tipo === 'guardar') {
            tituloManipular.innerHTML = '<i class="bi bi-box-arrow-in-down text-success me-2"></i>Aportar / Guardar';
            descManipular.innerHTML = `Quanto do seu <strong>Saldo Livre</strong> deseja aportar em <strong class="text-dark">${nome}</strong>?`;
            btnConfirmar.className = 'btn btn-success w-100 py-2 fs-5 fw-bold';
            btnConfirmar.innerHTML = 'Confirmar Aporte';
        } else if (tipo === 'resgatar') {
            tituloManipular.innerHTML = '<i class="bi bi-box-arrow-up text-primary me-2"></i>Resgatar Dinheiro';
            descManipular.innerHTML = `Quanto deseja resgatar de <strong class="text-dark">${nome}</strong> de volta para o saldo livre?`;
            btnConfirmar.className = 'btn btn-primary w-100 py-2 fs-5 fw-bold';
            btnConfirmar.innerHTML = 'Resgatar';
        } else if (tipo === 'rendimento') {
            tituloManipular.innerHTML = '<i class="bi bi-graph-up-arrow text-warning me-2"></i>Registar Lucro';
            descManipular.innerHTML = `Qual foi o rendimento/dividendo de <strong class="text-dark">${nome}</strong>? <br><small class="text-muted">(Não desconta do Saldo Livre)</small>`;
            btnConfirmar.className = 'btn btn-warning text-dark w-100 py-2 fs-5 fw-bold';
            btnConfirmar.innerHTML = 'Registar Lucro';
        }
        new bootstrap.Modal(modalManipular).show();
    }

    function processarAcaoModal() {
        const index = parseInt(inputIndex.value);
        const tipo = inputTipo.value;
        const valor = parseFloat(inputValor.value);

        if (isNaN(valor) || valor <= 0) return;

        const objetivos = window.obterObjetivos();
        const obj = objetivos[index];
        if (!obj) return;

        const saldoLivre = window.calcularSaldoTotal();
        const saldoDoObjetivo = (obj.depositos || []).reduce((s, d) => s + window.toNumber(d.valor), 0);

        if (!obj.depositos) obj.depositos = [];

        if (tipo === 'guardar') {
            if (valor > saldoLivre) {
                avisoSaldo.textContent = "Saldo Livre insuficiente!";
                avisoSaldo.style.display = 'block';
                return;
            }
            obj.depositos.push({ data: new Date(), valor: valor, tipo: 'deposito' });
        } 
        else if (tipo === 'resgatar') {
            if (valor > saldoDoObjetivo) {
                avisoSaldo.textContent = "Valor maior que o acumulado!";
                avisoSaldo.style.display = 'block';
                return;
            }
            obj.depositos.push({ data: new Date(), valor: -valor, tipo: 'resgate' });
        } 
        else if (tipo === 'rendimento') {
            obj.depositos.push({ data: new Date(), valor: valor, tipo: 'rendimento' });
        }

        window.salvarObjetivos(objetivos);
        fecharModais();
        renderizarObjetivos();
        atualizarResumo();
    }

    // Renderização ASSÍNCRONA - MANTIDO COM CORREÇÃO DA CAIXA DE TICKER
    async function renderizarObjetivos() {
        if (!listaObjetivos) return;
        const objetivos = window.obterObjetivos();
        listaObjetivos.innerHTML = "";

        if (objetivos.length === 0) {
            listaObjetivos.innerHTML = `<div class="col-12 text-center py-5"><h5 class="text-muted fw-bold">Sem registos</h5></div>`;
            return;
        }

        for (const [index, obj] of objetivos.entries()) {
            const col = document.createElement("div");
            col.className = "col-md-6 mb-4";

            const isInv = obj.tipoRegistro === 'investimento';
            const valorAlvo = window.toNumber(obj.alvo);
            
            let investido = 0;
            let rendimentos = 0;

            (obj.depositos || []).forEach(d => {
                if (d.tipo === 'rendimento') rendimentos += window.toNumber(d.valor);
                else investido += window.toNumber(d.valor);
            });

            const totalAcumulado = investido + rendimentos;
            
            // --- LOGICA DA CAIXA DE TICKER (APARECE SEMPRE QUE TIVER TICKER) ---
            let htmlBolsa = "";
            if (isInv && obj.ticker) {
                const info = await buscarDadosBolsa(obj.ticker);
                
                if (info && info !== "erro") {
                    // SE ACHOU O ATIVO (Sucesso)
                    const corVar = info.variacao >= 0 ? 'text-success' : 'text-danger';
                    const seta = info.variacao >= 0 ? '↑' : '↓';
                    htmlBolsa = `
                        <div class="mt-2 p-2 rounded bg-dark bg-opacity-10 border border-secondary border-opacity-25">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="small fw-bold text-muted">${obj.ticker.toUpperCase()}</span>
                                <span class="fw-bold text-dark">Cotação: ${window.formatBRL(info.preco)}</span>
                            </div>
                            <div class="text-end ${corVar}" style="font-size: 0.75rem;">
                                <strong>${seta} ${info.variacao.toFixed(2)}%</strong> hoje
                            </div>
                        </div>`;
                } else {
                    // SE NÃO ACHOU OU DEU ERRO (Caso do MRXF11 ou sem internet)
                    htmlBolsa = `
                        <div class="mt-2 p-2 rounded bg-dark bg-opacity-10 border border-secondary border-opacity-25">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="small fw-bold text-muted">${obj.ticker.toUpperCase()}</span>
                                <span class="fw-bold text-danger" style="font-size: 0.75rem;">Ativo não encontrado</span>
                            </div>
                        </div>`;
                }
            }

            const porcentagem = isInv ? 100 : Math.min((totalAcumulado / valorAlvo) * 100, 100);

            let textoPrazo = "";
            if (!isInv && obj.dataAlvo) {
                const dataObj = window.parseDataFlex(obj.dataAlvo);
                if (dataObj) {
                    const dataFormatada = new Date(dataObj.getTime() + Math.abs(dataObj.getTimezoneOffset() * 60000)).toLocaleDateString('pt-BR');
                    const hoje = new Date(); hoje.setHours(0,0,0,0);
                    const alvoCalculo = new Date(dataObj.getTime() + Math.abs(dataObj.getTimezoneOffset() * 60000)); alvoCalculo.setHours(0,0,0,0);
                    const diffDias = Math.ceil((alvoCalculo - hoje) / (1000 * 60 * 60 * 24));
                    
                    if (diffDias < 0) textoPrazo = `até ${dataFormatada} <span class="text-danger fw-bold ms-1">(Esgotado)</span>`;
                    else if (diffDias === 0) textoPrazo = `até ${dataFormatada} <span class="text-warning fw-bold ms-1">(Termina hoje)</span>`;
                    else textoPrazo = `até ${dataFormatada} <span class="text-primary ms-1 fw-bold">(Faltam ${diffDias} dias)</span>`;
                }
            } else if (!isInv) {
                textoPrazo = `<span class="text-muted ms-1 fst-italic">(Sem prazo definido)</span>`;
            }

            const iconeCard = isInv 
                ? `<div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width: 50px; height: 50px; background-color: rgba(255, 193, 7, 0.15);"><i class="bi bi-graph-up-arrow text-warning fs-3"></i></div>`
                : `<div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width: 50px; height: 50px; background-color: rgba(108, 92, 231, 0.1);"><i class="bi bi-bullseye text-primary-purple fs-3"></i></div>`;

            const headerInfo = isInv 
                ? `<small class="text-warning fw-bold d-block mt-1">Investimento Variável</small>`
                : `<small class="text-muted d-block mt-1">Alvo: <strong>${window.formatBRL(valorAlvo)}</strong> ${textoPrazo}</small>`;

            const barraHtml = isInv ? '' : `
                <div class="d-flex justify-content-between align-items-end mb-1 mt-2">
                    <span class="fs-4 fw-bold text-dark">${window.formatBRL(totalAcumulado)}</span>
                    <span class="fw-bold ${totalAcumulado >= valorAlvo ? 'text-success' : 'text-primary'}">${Math.floor(porcentagem)}%</span>
                </div>
                <div class="progress mb-3" style="height: 10px; border-radius: 5px; background-color: #e9ecef;">
                    <div class="progress-bar ${totalAcumulado >= valorAlvo ? 'bg-success' : 'bg-primary'} progress-bar-striped ${totalAcumulado < valorAlvo ? 'progress-bar-animated' : ''}" style="width: ${porcentagem}%"></div>
                </div>
            `;

            const totalHtml = isInv ? `<div class="fs-3 fw-bold text-dark mt-2 mb-1">${window.formatBRL(totalAcumulado)}</div>` : '';

            col.innerHTML = `
                <div class="card h-100 shadow-sm conta-item">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="d-flex align-items-center gap-3">
                                ${iconeCard}
                                <div><h5 class="card-title fw-bold mb-0 text-dark">${obj.nome}</h5>${headerInfo}</div>
                            </div>
                            <button class="btn btn-sm btn-light text-danger btn-excluir"><i class="bi bi-trash"></i></button>
                        </div>
                        <div class="d-flex justify-content-between text-muted mt-3 mb-1" style="font-size: 0.8rem;">
                            <span>Aportes: <strong class="text-dark">${window.formatBRL(investido)}</strong></span>
                            <span>Rendimentos: <strong class="text-success">+${window.formatBRL(rendimentos)}</strong></span>
                        </div>
                        ${barraHtml}
                        ${totalHtml}
                        ${htmlBolsa}
                        <div class="d-flex gap-2 pt-3 mt-3 border-top flex-wrap">
                            <button class="btn btn-outline-success flex-grow-1 fw-bold btn-guardar"><i class="bi bi-plus-lg"></i> Aportar</button>
                            <button class="btn btn-outline-primary flex-grow-1 fw-bold btn-resgatar"><i class="bi bi-dash-lg"></i> Resgatar</button>
                            <button class="btn btn-outline-warning w-100 fw-bold btn-rendimento text-dark mt-1"><i class="bi bi-graph-up-arrow"></i> Registar Lucro</button>
                        </div>
                    </div>
                </div>`;

            col.querySelector('.btn-guardar').addEventListener('click', () => abrirModalAcao(index, obj.nome, 'guardar'));
            col.querySelector('.btn-resgatar').addEventListener('click', () => abrirModalAcao(index, obj.nome, 'resgatar'));
            col.querySelector('.btn-rendimento').addEventListener('click', () => abrirModalAcao(index, obj.nome, 'rendimento'));
            col.querySelector('.btn-excluir').addEventListener('click', () => {
                if (confirm(`Excluir "${obj.nome}"?`)) {
                    const objs = window.obterObjetivos();
                    objs.splice(index, 1);
                    window.salvarObjetivos(objs);
                    renderizarObjetivos();
                    atualizarResumo();
                }
            });

            listaObjetivos.appendChild(col);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        renderizarObjetivos();
        atualizarResumo();

        // --- LISTENERS DO EXPLORADOR ---
        if (btnLupa) {
            btnLupa.addEventListener('click', () => {
                new bootstrap.Modal(modalExplorarEl).show();
                atualizarInterfaceExplorador();
            });
        }
        if (inputBuscaExplorar) {
            inputBuscaExplorar.addEventListener('input', (e) => atualizarInterfaceExplorador(e.target.value));
        }

        const formNovoObjetivo = document.getElementById("formNovoObjetivo");
        if (formNovoObjetivo) {
            formNovoObjetivo.addEventListener("submit", (e) => {
                e.preventDefault();
                const tipoRegistro = document.getElementById("tipoRegistro").value;
                const ticker = inputTicker.value.trim();
                const nome = document.getElementById("nomeObjetivo").value.trim();
                const valorDigitado = parseFloat(document.getElementById("valorAlvo").value);
                const dataAlvo = document.getElementById("dataAlvoObjetivo").value;

                if (!nome || isNaN(valorDigitado) || valorDigitado <= 0) return alert("Preencha corretamente!");

                const objetivos = window.obterObjetivos();
                if (tipoRegistro === 'investimento') {
                    if (valorDigitado > window.calcularSaldoTotal()) return alert("Saldo insuficiente!");
                    objetivos.push({ tipoRegistro, nome, ticker, alvo: 0, dataAlvo: '', depositos: [{ data: new Date(), valor: valorDigitado, tipo: 'deposito' }] });
                } else {
                    objetivos.push({ tipoRegistro, nome, alvo: valorDigitado, dataAlvo, depositos: [] });
                }

                window.salvarObjetivos(objetivos);
                formNovoObjetivo.reset();
                boxTicker.style.display = 'none';
                fecharModais();
                renderizarObjetivos();
                atualizarResumo();
            });
        }

        if (btnConfirmar) btnConfirmar.addEventListener("click", processarAcaoModal);
        window.addEventListener("storage", () => { renderizarObjetivos(); atualizarResumo(); });
    });
})();