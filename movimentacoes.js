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
  outros: "#6c757d",
};

// carrega do localStorage
let contas = JSON.parse(localStorage.getItem("contas")) || [];

// helpers
const salvarContas = () => localStorage.setItem("contas", JSON.stringify(contas));
const toNumber = (v) => (typeof v === "number" ? v : parseFloat(v || 0));
const formatBRL = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

// ANIMAÇÃO DE CONTAGEM NOS CARDS
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

// ATUALIZA CARDS DO RESUMO
function atualizarResumo() {
  const totalContasEl = document.getElementById("totalContas");
  const totalPagoEl = document.getElementById("totalPago");
  const totalRestanteEl = document.getElementById("totalRestante");

  const totalContas = contas.length;
  // Agora o cálculo usa o array 'pagamentos'
  const totalPago = contas.reduce(
    (acc, c) => acc + (c.pagamentos ? c.pagamentos.reduce((pAcc, p) => pAcc + toNumber(p.valor), 0) : 0),
    0
  );
  const totalRestante = contas.reduce(
    (acc, c) => acc + (toNumber(c.valor) * ((c.parcelas || 0) - (c.parcelaAtual || 0))),
    0
  );

  contarValor(totalContasEl, totalContas);
  contarValor(totalPagoEl, totalPago);
  contarValor(totalRestanteEl, totalRestante);
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
  contas.forEach(conta => {
    // Se a conta não tiver o array de pagamentos mas tiver parcelas pagas, migra.
    if (!Array.isArray(conta.pagamentos) && (conta.parcelaAtual || 0) > 0) {
      conta.pagamentos = [];
      for (let i = 0; i < conta.parcelaAtual; i++) {
        // Cria pagamentos com datas estimadas (baseado no vencimento)
        const dataVencimento = new Date(conta.vencimento);
        const dataMigrada = new Date(dataVencimento.getFullYear(), dataVencimento.getMonth() + i, dataVencimento.getDate());
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
    salvarContas();
  }
}

// renderiza lista
const renderizarContas = () => {
    listaContas.innerHTML = "";
    
    // Altera a função forEach para incluir o parâmetro de índice
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

        // Lógica CORRIGIDA para a data de vencimento
        let vencTexto = "";
        if (conta.vencimento) {
            const dataOriginal = new Date(conta.vencimento);
            // Adiciona o número de parcelas pagas ao mês da data original
            const proximoVencimento = new Date(dataOriginal.getFullYear(), dataOriginal.getMonth() + parcelaAtual, dataOriginal.getDate());
            vencTexto = ` | Venc.: ${proximoVencimento.toLocaleDateString('pt-BR')}`;
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
                if (contas[index].parcelaAtual < contas[index].parcelas) {
                    registrarPagamento(contas[index]);
                    salvarContas();
                    renderizarContas();
                }
            });
        if (btnDesfazer)
            btnDesfazer.addEventListener("click", () => {
                if (contas[index].parcelaAtual > 0) {
                    contas[index].parcelaAtual--;
                    // remove o último pagamento registrado
                    if(contas[index].pagamentos && contas[index].pagamentos.length > 0) {
                        contas[index].pagamentos.pop();
                    }
                    salvarContas();
                    renderizarContas();
                }
            });
        if (btnRemover)
            btnRemover.addEventListener("click", () => {
                if (confirm(`Remover "${contas[index].nome}"?`)) {
                    contas.splice(index, 1);
                    salvarContas();
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

  contas.push({
    nome: inputNome.value.trim(),
    valor: parseFloat(inputValor.value),
    parcelas: parseInt(inputParcelas.value),
    parcelaAtual: 0,
    vencimento: inputVencimento.value,
    categoria: inputCategoria.value || "outros",
    pagamentos: [], // Garante que o array de pagamentos existe desde o início
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
migrarDadosAntigos();
renderizarContas();
