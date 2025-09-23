"use strict";

const listaContas = document.getElementById("listaContas");
const inputNome = document.getElementById("nomeConta");
const inputValor = document.getElementById("valorConta");
const inputParcelas = document.getElementById("parcelasConta");
const inputVencimento = document.getElementById("vencimentoConta");
const inputCategoria = document.getElementById("categoriaConta");
const btnAdicionar = document.getElementById("adicionarConta");

// ATUALIZA CARDS DO RESUMO
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

// renderiza lista
const renderizarContas = () => {
    const contas = obterContas();
    if (!listaContas) return;

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
            if (dataOriginal) {
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
    atualizarResumo();
};

// adicionar nova conta
btnAdicionar.addEventListener("click", () => {
    if (!inputNome.value || !inputValor.value || !inputParcelas.value || !inputVencimento.value) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    const contas = obterContas();
    contas.push({
        nome: inputNome.value.trim(),
        valor: parseFloat(inputValor.value),
        parcelas: parseInt(inputParcelas.value),
        parcelaAtual: 0,
        vencimento: inputVencimento.value,
        categoria: inputCategoria.value || "outros",
        pagamentos: [],
    });

    salvarContas(contas);
    renderizarContas();

    inputNome.value = "";
    inputValor.value = "";
    inputParcelas.value = "";
    inputVencimento.value = "";
    inputCategoria.value = "alimentacao";

    const modalElement = document.getElementById("modalConta");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.hide();
});

// renderização inicial
document.addEventListener("DOMContentLoaded", () => {
    migrarDadosAntigos();
    renderizarContas();
});

// Sincroniza com outras abas
window.addEventListener("storage", (event) => {
    if (event.key === "contas") {
        renderizarContas();
    }
});