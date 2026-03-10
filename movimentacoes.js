(() => {
    "use strict";

    const listaContas = document.getElementById("listaContas");
    const listaContasConcluidas = document.getElementById("listaContasConcluidas");
    const containerConcluidas = document.getElementById("containerConcluidas");
    const listaGanhos = document.getElementById("listaGanhos");

    let contasExpandidas = new Set();
    let indexParaAnimar = -1;
    let tipoAnimacao = '';

    function ajustarVencimento(dataBase, recorrencia, operacao) {
        let dv = window.parseDataFlex(dataBase);
        if (!dv) dv = new Date();
        let fator = (operacao === 'somar') ? 1 : -1;
        if (recorrencia === 'anual') { dv.setFullYear(dv.getFullYear() + (1 * fator)); } 
        else if (recorrencia === 'trimestral') { dv.setMonth(dv.getMonth() + (3 * fator)); } 
        else { dv.setMonth(dv.getMonth() + (1 * fator)); }
        return window.formatDataInput(dv);
    }

    function registrarPagamento(conta, index) {
        const contas = window.obterContas();
        if (index === -1) return false;
        if(conta.parcelaAtual >= conta.parcelas) return false;

        const valor = window.toNumber(conta.valor);
        if (valor > window.calcularSaldoTotal()) {
            alert("Saldo insuficiente. Adicione saldo aos ganhos!");
            return false;
        }

        if (!conta.pagamentos) conta.pagamentos = [];
        conta.pagamentos.push({ data: new Date(), valor: valor });
        conta.parcelaAtual = (conta.parcelaAtual || 0) + 1;
        conta.vencimento = ajustarVencimento(conta.vencimento, conta.recorrencia, 'somar');

        contas[index] = conta;
        window.salvarContas(contas);
        return true;
    }

    function desfazerPagamento(conta, index) {
        const contas = window.obterContas();
        if (index === -1) return false;

        if (conta.pagamentos && conta.pagamentos.length > 0) {
            conta.pagamentos.pop(); 
            let minParcela = conta.parcelasJaPagas || 0;
            conta.parcelaAtual = Math.max(minParcela, (conta.parcelaAtual || 1) - 1);
            conta.vencimento = ajustarVencimento(conta.vencimento, conta.recorrencia, 'subtrair');

            contas[index] = conta;
            window.salvarContas(contas);
            return true;
        }
        return false;
    }

    function renderizarContas() {
        if (!listaContas) return;
        const contas = window.obterContas();
        
        listaContas.innerHTML = "";
        if (listaContasConcluidas) listaContasConcluidas.innerHTML = "";
        
        let qtdAtivas = 0; let qtdConcluidas = 0;

        contas.forEach((conta, index) => {
            const li = document.createElement("li");
            li.className = "list-group-item conta-item"; 
            if (index === indexParaAnimar) { li.classList.add(tipoAnimacao); }

            const valorParcela = window.toNumber(conta.valor);
            const parcelas = conta.parcelas || 1;
            const parcelaAtual = conta.parcelaAtual || 0;
            const parcelasJaPagas = conta.parcelasJaPagas || 0;
            const porcentagem = Math.round((parcelaAtual / parcelas) * 100);
            
            const badgeCategoria = document.createElement("span");
            badgeCategoria.className = "badge text-uppercase fw-bold";
            badgeCategoria.style.background = window.coresCategoria[conta.categoria] || window.coresCategoria.outros;
            badgeCategoria.style.color = "#fff";
            badgeCategoria.style.fontSize = "0.7rem";
            badgeCategoria.style.padding = "0.4em 0.7em";
            badgeCategoria.style.borderRadius = "6px";
            badgeCategoria.textContent = conta.categoria || "outros";

            let recorrenciaLabel = "";
            if(conta.recorrencia === 'trimestral') recorrenciaLabel = '<span class="badge bg-secondary ms-2" style="font-size:0.65rem;">Trimestral</span>';
            if(conta.recorrencia === 'anual') recorrenciaLabel = '<span class="badge bg-secondary ms-2" style="font-size:0.65rem;">Anual</span>';

            const valorTotal = parcelas * valorParcela;
            const valorPago = parcelaAtual * valorParcela; 
            const valorRestante = valorTotal - valorPago;
            
            // HISTÓRICO (TIMELINE)
            let historicoHTML = '';
            if (parcelasJaPagas === 0 && (!conta.pagamentos || conta.pagamentos.length === 0)) {
                historicoHTML = `
                    <div class="text-center py-4">
                        <i class="bi bi-inbox text-muted" style="font-size: 2.5rem; opacity: 0.5;"></i>
                        <p class="text-muted mt-2 mb-0 fw-medium">Nenhum pagamento registrado ainda.</p>
                    </div>`;
            } else {
                historicoHTML += '<ul class="historico-timeline">';
                if (parcelasJaPagas > 0) {
                    historicoHTML += `
                        <li class="timeline-item old-item">
                            <div>
                                <div class="timeline-title text-muted">Contas Anteriores</div>
                                <div class="timeline-date"><i class="bi bi-info-circle me-1"></i> ${parcelasJaPagas} parcela(s) pagas antes do app</div>
                            </div>
                        </li>`;
                }
                if (conta.pagamentos && conta.pagamentos.length > 0) {
                    conta.pagamentos.forEach((p, i) => {
                        let numParcelaReal = parcelasJaPagas + i + 1;
                        historicoHTML += `
                            <li class="timeline-item">
                                <div>
                                    <div class="timeline-title">Parcela ${numParcelaReal}</div>
                                    <div class="timeline-date"><i class="bi bi-calendar2-check me-1"></i>${window.parseDataFlex(p.data)?.toLocaleDateString('pt-BR')}</div>
                                </div>
                                <div class="timeline-value">+ ${window.formatBRL(window.toNumber(p.valor))}</div>
                            </li>
                        `;
                    });
                }
                historicoHTML += '</ul>';
            }

            const estaExpandido = contasExpandidas.has(index);
            const displayStyle = estaExpandido ? 'block' : 'none';
            const chevronClass = estaExpandido ? 'bi-chevron-up' : 'bi-chevron-down';

            const detalhesAcordeaoHTML = `
                <div class="detalhes-conta" style="display: ${displayStyle};">
                    <div class="row text-center mb-2">
                        <div class="col-4 border-end border-secondary border-opacity-25">
                            <span class="text-muted small text-uppercase fw-bold" style="letter-spacing: 0.5px;">Valor Total</span><br>
                            <span class="fw-bold text-dark mt-1 d-block" style="font-size: 1.1rem;">${window.formatBRL(valorTotal)}</span>
                        </div>
                        <div class="col-4 border-end border-secondary border-opacity-25">
                            <span class="text-muted small text-uppercase fw-bold" style="letter-spacing: 0.5px;">Já Pago</span><br>
                            <span class="fw-bold text-success mt-1 d-block" style="font-size: 1.1rem;">${window.formatBRL(valorPago)}</span>
                        </div>
                        <div class="col-4">
                            <span class="text-muted small text-uppercase fw-bold" style="letter-spacing: 0.5px;">Restante</span><br>
                            <span class="fw-bold text-danger mt-1 d-block" style="font-size: 1.1rem;">${window.formatBRL(valorRestante)}</span>
                        </div>
                    </div>
                    
                    <div class="historico-card">
                        <div class="historico-header">
                            <i class="bi bi-clock-history"></i> Histórico de Pagamentos
                        </div>
                        ${historicoHTML}
                    </div>
                </div>
            `;

            let corProgressBar = porcentagem >= 100 ? "bg-success" : (porcentagem >= 50 ? "bg-warning" : "bg-danger");
            const isConcluida = porcentagem >= 100;

            if (isConcluida) li.classList.add("conta-concluida");

            // HTML PRINCIPAL DA CONTA (CÓDIGO LIMPO E SEM SETA FLUTUANTE)
            li.innerHTML = `
                <div class="main-row w-100">
                    <div class="list-item-content">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex align-items-start">
                                <div class="mt-1">${badgeCategoria.outerHTML}</div>
                                <div class="ms-3">
                                    <div class="d-flex align-items-center gap-2 mb-1">
                                        <strong class="text-dark" style="font-size: 1.1rem;">${conta.nome}</strong> 
                                        ${isConcluida ? '<span class="badge bg-success" style="font-size:0.65rem;"><i class="bi bi-check-lg"></i> Concluído</span>' : recorrenciaLabel}
                                    </div>
                                    <div class="text-muted" style="font-size: 0.85rem;">
                                        ${isConcluida ? `Finalizado em: ${window.parseDataFlex(conta.vencimento)?.toLocaleDateString('pt-BR')}` : `Parcela ${parcelaAtual+1} de ${parcelas} <strong class="text-dark ms-1">${window.formatBRL(valorParcela)}</strong> <span class="ms-2" style="font-size: 0.8rem;"><i class="bi bi-calendar-event me-1"></i>${window.parseDataFlex(conta.vencimento)?.toLocaleDateString('pt-BR')}</span>`}
                                    </div>
                                </div>
                            </div>
                            <i class="bi ${chevronClass} chevron-icon mt-1"></i>
                        </div>
                        <div class="progress mt-3"><div class="progress-bar ${corProgressBar}" role="progressbar" style="width:${Math.max(2, porcentagem)}%;"></div></div>
                    </div>
                    
                    <div class="list-item-actions">
                        ${!isConcluida ? `<button class="btn-action btn-pagar" data-index="${index}" title="Pagar"><i class="bi bi-check2"></i> <span class="btn-texto">Pagar</span></button>` : ''}
                        <button class="btn-action btn-desfazer" data-index="${index}" title="Desfazer"><i class="bi bi-arrow-counterclockwise"></i> <span class="btn-texto">Desfazer</span></button>
                        <button class="btn-action btn-remover" data-index="${index}" title="Excluir"><i class="bi bi-trash"></i> <span class="btn-texto">Excluir</span></button>
                    </div>
                </div>
                ${detalhesAcordeaoHTML}
            `;

            if (isConcluida) {
                if(listaContasConcluidas) listaContasConcluidas.appendChild(li);
                qtdConcluidas++;
            } else {
                listaContas.appendChild(li);
                qtdAtivas++;
            }

            const areaClique = li.querySelector('.list-item-content');
            const detalhes = li.querySelector('.detalhes-conta');
            const iconesSeta = li.querySelectorAll('.bi-chevron-down, .bi-chevron-up');
            
            if (areaClique) {
                areaClique.addEventListener('click', () => {
                    if (detalhes.style.display === 'none') {
                        detalhes.style.display = 'block';
                        iconesSeta.forEach(ic => ic.classList.replace('bi-chevron-down', 'bi-chevron-up'));
                        contasExpandidas.add(index);
                    } else {
                        detalhes.style.display = 'none';
                        iconesSeta.forEach(ic => ic.classList.replace('bi-chevron-up', 'bi-chevron-down'));
                        contasExpandidas.delete(index);
                    }
                });
            }

            li.querySelector(".btn-pagar")?.addEventListener("click", () => {
                if (registrarPagamento(conta, index)) { indexParaAnimar = index; tipoAnimacao = 'animacao-pagar'; renderizarContas(); atualizarResumo(); }
            });
            li.querySelector(".btn-desfazer")?.addEventListener("click", () => {
                if (desfazerPagamento(conta, index)) { indexParaAnimar = index; tipoAnimacao = 'animacao-desfazer'; renderizarContas(); atualizarResumo(); }
            });
            li.querySelector(".btn-remover")?.addEventListener("click", () => {
                if (confirm(`Excluir permanentemente "${conta.nome}"?`)) {
                    const contas = window.obterContas(); contas.splice(index, 1); window.salvarContas(contas);
                    contasExpandidas.clear(); renderizarContas(); atualizarResumo();
                }
            });
        });

        if (qtdAtivas === 0 && listaContas) {
            listaContas.innerHTML = "<li class='list-group-item text-center text-muted py-4 border-0 bg-transparent'>🎉 Nenhuma conta em aberto!</li>";
        }
        if (containerConcluidas) {
            containerConcluidas.style.display = qtdConcluidas > 0 ? "block" : "none";
        }

        indexParaAnimar = -1;
        tipoAnimacao = '';
    }

    function renderizarGanhos() {
        if (!listaGanhos) return;
        const ganhos = window.obterGanhos();
        listaGanhos.innerHTML = "";
        ganhos.forEach((ganho, index) => {
            const li = document.createElement("li");
            li.className = "list-group-item ganho-item";
            li.innerHTML = `
                <div>
                    <strong class="text-dark d-block mb-1 fs-5">${ganho.nome}</strong>
                    <span class="text-success fw-bold">${window.formatBRL(window.toNumber(ganho.valor))}</span>
                    <small class="text-muted ms-2"><i class="bi bi-calendar-event me-1"></i>${ganho.data ? window.parseDataFlex(ganho.data)?.toLocaleDateString('pt-BR') : ''}</small>
                </div>
                <button class="btn-remover-ganho"><i class="bi bi-trash"></i> Remover</button>
            `;
            li.querySelector(".btn-remover-ganho").addEventListener("click", () => {
                if (confirm("Remover este ganho?")) {
                    ganhos.splice(index, 1); window.salvarGanhos(ganhos); renderizarGanhos(); atualizarResumo();
                }
            });
            listaGanhos.appendChild(li);
        });
    }

    function atualizarResumo() {
        const contas = window.obterContas();
        const hoje = new Date();
        const totalGanhos = window.obterGanhos().reduce((total, g) => {
            const gd = window.parseDataFlex(g.data);
            if (gd && gd.getMonth() === hoje.getMonth() && gd.getFullYear() === hoje.getFullYear()) { return total + window.toNumber(g.valor); }
            return total;
        }, 0);

        const totalGastos = contas.reduce((total, c) => {
            return total + (c.pagamentos || []).reduce((s, p) => {
                const pd = window.parseDataFlex(p.data);
                if (pd && pd.getMonth() === hoje.getMonth() && pd.getFullYear() === hoje.getFullYear()) { return s + window.toNumber(p.valor); }
                return s;
            }, 0);
        }, 0);
        
        const saldo = window.calcularSaldoTotal();
        const totalPago = contas.reduce((acc, c) => acc + (c.parcelaAtual || 0) * window.toNumber(c.valor), 0);
        const restante = contas.reduce((acc, c) => {
            let falta = (c.parcelas || 1) - (c.parcelaAtual || 0);
            return acc + (falta > 0 ? falta : 0) * window.toNumber(c.valor);
        }, 0);

        const els = {
            contas: document.getElementById("totalContas"), pago: document.getElementById("totalPago"),
            restante: document.getElementById("totalRestante"), saldo: document.getElementById("saldoTotal"),
            entrada: document.getElementById("entradaMes"), gasto: document.getElementById("gastoMes")
        };

        try {
            if (typeof window.animarNumero === 'function') {
                if(els.contas) window.animarNumero(els.contas, contas.length, v => Math.round(v));
                if(els.pago) window.animarNumero(els.pago, totalPago, window.formatBRL);
                if(els.restante) window.animarNumero(els.restante, restante, window.formatBRL);
                if(els.saldo) window.animarNumero(els.saldo, saldo, window.formatBRL);
                if(els.entrada) window.animarNumero(els.entrada, totalGanhos, window.formatBRL);
                if(els.gasto) window.animarNumero(els.gasto, totalGastos, window.formatBRL);
                return;
            }
        } catch (e) {}

        if(els.contas) els.contas.textContent = contas.length;
        if(els.pago) els.pago.textContent = window.formatBRL(totalPago);
        if(els.restante) els.restante.textContent = window.formatBRL(restante);
        if(els.saldo) els.saldo.textContent = window.formatBRL(saldo);
        if(els.entrada) els.entrada.textContent = window.formatBRL(totalGanhos);
        if(els.gasto) els.gasto.textContent = window.formatBRL(totalGastos);
    }

    document.addEventListener("DOMContentLoaded", () => {
        renderizarContas(); renderizarGanhos(); atualizarResumo();
        function fecharModalSeguro(idModal) {
            if(document.activeElement) document.activeElement.blur(); 
            const modalEl = document.getElementById(idModal);
            if (modalEl) { const modal = bootstrap.Modal.getInstance(modalEl); if (modal) modal.hide(); }
        }

        const recorrenciaSelect = document.getElementById("recorrenciaConta");
        const labelParcelas = document.getElementById("labelParcelasConta");
        const inputParcelas = document.getElementById("parcelasConta");
        const hintParcelas = document.getElementById("hintParcelasConta");

        if (recorrenciaSelect && labelParcelas && inputParcelas && hintParcelas) {
            recorrenciaSelect.addEventListener("change", (e) => {
                const val = e.target.value;
                if (val === "anual") { labelParcelas.textContent = "Por quantos Anos?"; inputParcelas.placeholder = "Ex: 5 (Anos)"; hintParcelas.textContent = "Assinatura contínua? Coloque 10 ou mais."; } 
                else if (val === "trimestral") { labelParcelas.textContent = "Quantos Trimestres?"; inputParcelas.placeholder = "Ex: 4 (1 Ano)"; hintParcelas.textContent = "Assinatura contínua? Coloque um valor alto."; } 
                else { labelParcelas.textContent = "Total de Meses/Parcelas"; inputParcelas.placeholder = "Ex: 48 (Meses)"; hintParcelas.textContent = "Para assinaturas fixas (ex: Netflix), coloque 120 (10 anos)."; }
            });
        }

        const formNovaConta = document.getElementById("formNovaConta");
        if (formNovaConta) {
            formNovaConta.addEventListener("submit", (e) => {
                e.preventDefault();
                const nome = document.getElementById("nomeConta").value.trim();
                const valor = parseFloat(document.getElementById("valorConta").value);
                const vencimento = document.getElementById("vencimentoConta").value;
                const parcelas = parseInt(document.getElementById("parcelasConta").value) || 1;
                const parcelasPagas = parseInt(document.getElementById("parcelasPagasConta").value) || 0;
                const categoria = document.getElementById("categoriaConta").value || "outros";
                const recorrencia = document.getElementById("recorrenciaConta").value || "mensal";

                if (!nome || !valor || !vencimento) return alert("Preencha os campos obrigatórios!");
                if (parcelasPagas > parcelas) return alert("As parcelas já pagas não podem ser maiores que o total de parcelas.");

                const contas = window.obterContas();
                contas.push({ nome, valor, vencimento: vencimento, parcelas, categoria, recorrencia, parcelasJaPagas: parcelasPagas, parcelaAtual: parcelasPagas, pagamentos: [] });
                window.salvarContas(contas); renderizarContas(); atualizarResumo(); formNovaConta.reset(); fecharModalSeguro("modalConta");
                if(labelParcelas) labelParcelas.textContent = "Total de Meses/Parcelas";
                if(inputParcelas) inputParcelas.placeholder = "Ex: 48 (Meses)";
            });
        }
        const btnAdicionarGanho = document.getElementById("adicionarGanho");
        if (btnAdicionarGanho) {
            btnAdicionarGanho.addEventListener("click", () => {
                const nome = document.getElementById("nomeGanho").value.trim();
                const valor = parseFloat(document.getElementById("valorGanho").value);
                const data = document.getElementById("dataGanho").value;
                if (!nome || isNaN(valor) || !data) return alert("Preencha todos os campos!");
                const ganhos = window.obterGanhos();
                ganhos.push({ nome, valor, data }); window.salvarGanhos(ganhos); renderizarGanhos(); atualizarResumo();
                document.getElementById("nomeGanho").value = ""; document.getElementById("valorGanho").value = ""; document.getElementById("dataGanho").value = "";
                fecharModalSeguro("modalGanho");
            });
        }
        window.addEventListener("storage", () => { renderizarContas(); renderizarGanhos(); atualizarResumo(); });
    });
})();