const listaContas = document.getElementById("listaContas");
const inputNome = document.getElementById("nomeConta");
const inputValor = document.getElementById("valorConta");
const inputParcelas = document.getElementById("parcelasConta");
const inputVencimento = document.getElementById("vencimentoConta");
const inputCategoria = document.getElementById("categoriaConta");
const btnAdicionar = document.getElementById("adicionarConta");

// cores por categoria
const coresCategoria = {
  alimentacao: "#0d6efd",
  transporte: "#198754",
  lazer: "#ffc107",
  divida: "#dc3545",
  outros: "#6c757d"
};

// carrega do localStorage
let contas = JSON.parse(localStorage.getItem("contas")) || [];

// helpers
const salvarContas = () => localStorage.setItem("contas", JSON.stringify(contas));
const toNumber = (v) => (typeof v === "number" ? v : parseFloat(v || 0));
const formatBRL = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

// animação de contagem nos cards
function contarValor(el, valorFinal) {
  let valorAtual = parseFloat(el.getAttribute("data-valor")) || 0;
  const passo = (valorFinal - valorAtual) / 20; // 20 frames
  let count = 0;

  function animar() {
    if (count < 20) {
      valorAtual += passo;
      el.textContent = el.id === "totalContas" ? Math.round(valorAtual) : formatBRL(valorAtual);
      count++;
      requestAnimationFrame(animar);
    } else {
      el.textContent = el.id === "totalContas" ? valorFinal : formatBRL(valorFinal);
      el.setAttribute("data-valor", valorFinal);
    }
  }

  animar();
}

// atualiza cards do resumo
function atualizarResumo() {
  const totalContasEl = document.getElementById("totalContas");
  const totalPagoEl = document.getElementById("totalPago");
  const totalRestanteEl = document.getElementById("totalRestante");

  const totalContas = contas.length;
  const totalPago = contas.reduce((acc, c) => acc + (toNumber(c.valor) * (c.parcelaAtual || 0)), 0);
  const totalRestante = contas.reduce(
    (acc, c) => acc + (toNumber(c.valor) * ((c.parcelas || 0) - (c.parcelaAtual || 0))),
    0
  );

  contarValor(totalContasEl, totalContas);
  contarValor(totalPagoEl, totalPago);
  contarValor(totalRestanteEl, totalRestante);
}

// renderiza lista
const renderizarContas = () => {
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

    const vencTexto = conta.vencimento ? ` | Venc.: ${new Date(conta.vencimento).toLocaleDateString()}` : "";
    const badgeCategoria = `<span class="badge" style="background:${corCategoria}; margin-right:5px">${conta.categoria}</span>`;

    if (porcentagem >= 100) {
      li.classList.add("conta-concluida");
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>${badgeCategoria}<strong>${conta.nome}</strong> - Concluído - ${formatBRL(valorParcela * parcelas)} ${vencTexto}</div>
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
          <div>${badgeCategoria}<strong>${conta.nome}</strong> - Parcela ${parcelaAtual} de ${parcelas} - ${formatBRL(valorParcela)} ${vencTexto}</div>
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

    if (btnPagar) btnPagar.addEventListener("click", () => { if (conta.parcelaAtual < conta.parcelas) { conta.parcelaAtual++; salvarContas(); renderizarContas(); }});
    if (btnDesfazer) btnDesfazer.addEventListener("click", () => { if (conta.parcelaAtual > 0) { conta.parcelaAtual--; salvarContas(); renderizarContas(); }});
    if (btnRemover) btnRemover.addEventListener("click", () => { if (confirm(`Remover "${conta.nome}"?`)) { contas.splice(index, 1); salvarContas(); renderizarContas(); }});

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

  contas.push({
    nome: inputNome.value.trim(),
    valor: parseFloat(inputValor.value),
    parcelas: parseInt(inputParcelas.value),
    parcelaAtual: 0,
    vencimento: inputVencimento.value,
    categoria: inputCategoria.value || "outros"
  });

  salvarContas();
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
renderizarContas();
  