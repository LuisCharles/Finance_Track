"use strict";

/* movimentacoes.js - layout original, cadastro, categorias, progress bar, pagar/desfazer/remover */

const listaContas = document.getElementById("listaContas");
const listaGanhos = document.getElementById("listaGanhos");

const totalContasEl = document.getElementById("totalContas");
const totalPagoEl = document.getElementById("totalPago");
const totalRestanteEl = document.getElementById("totalRestante");

const saldoTotalEl = document.getElementById("saldoTotal");
const entradaMesEl = document.getElementById("entradaMes");
const gastoMesEl = document.getElementById("gastoMes");

const formNovaConta = document.getElementById("formNovaConta");

/* ---------------------------
   FUNÇÕES DE STORAGE
---------------------------- */
function salvarContas(contas) {
  localStorage.setItem("contas", JSON.stringify(contas));
}

function obterContas() {
  const contas = localStorage.getItem("contas");
  return contas ? JSON.parse(contas) : [];
}

function salvarGanhos(ganhos) {
  localStorage.setItem("ganhos", JSON.stringify(ganhos));
}

function obterGanhos() {
  const ganhos = localStorage.getItem("ganhos");
  return ganhos ? JSON.parse(ganhos) : [];
}
/* ---------------------------
   FIM STORAGE
---------------------------- */

// Função de parsing seguro
function parseDataFlex(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  const dt = new Date(d);
  return isNaN(dt) ? null : dt;
}

function toNumber(valor) {
  return Number(valor) || 0;
}

function formatBRL(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Criar badge categoria
function criarBadgeCategoria(categoria) {
  const span = document.createElement("span");
  span.className = "badge";
  span.style.background = window.coresCategoria?.[categoria] || window.coresCategoria?.outros || "#6c757d";
  span.style.color = "#fff";
  span.style.textTransform = "capitalize";
  span.textContent = categoria || "outros";
  return span;
}

// Cor da progress bar
function corProgressBar(porcentagem) {
  if (porcentagem >= 100) return "bg-success";
  if (porcentagem >= 50) return "bg-warning";
  return "bg-danger";
}

// Calcular saldo total
function calcularSaldoTotal() {
  const ganhos = obterGanhos() || [];
  const contas = obterContas() || [];
  const totalGanhos = ganhos.reduce((acc, g) => acc + toNumber(g.valor), 0);
  const totalGastos = contas.reduce((acc, c) => acc + (c.pagamentos || []).reduce((s, p) => s + toNumber(p.valor), 0), 0);
  return totalGanhos - totalGastos;
}

// Registrar pagamento
function registrarPagamento(conta) {
  const contas = obterContas() || [];
  const idx = contas.findIndex(c => c.nome === conta.nome && c.vencimento === conta.vencimento);
  if (idx === -1) return false;

  const valor = toNumber(conta.valor);
  const saldo = calcularSaldoTotal();

  if (valor > saldo) {
    alert("Saldo insuficiente. Adicione saldo à conta!");
    return false;
  }

  if (!conta.pagamentos) conta.pagamentos = [];

  if (!conta._ultimaDataVencimento) conta._ultimaDataVencimento = parseDataFlex(conta.vencimento);

  const pagamento = { data: new Date(), valor: valor };
  conta.pagamentos.push(pagamento);
  conta.parcelaAtual = (conta.parcelaAtual || 0) + 1;

  // Atualiza vencimento da próxima parcela
  const dv = new Date(conta._ultimaDataVencimento);
  dv.setMonth(dv.getMonth() + 1);
  conta._ultimaDataVencimento = dv;
  conta.vencimento = dv.toISOString().split('T')[0];

  contas[idx] = conta;
  salvarContas(contas);

  return true;
}

// Desfazer pagamento
function desfazerPagamento(conta) {
  const contas = obterContas() || [];
  const idx = contas.findIndex(c => c.nome === conta.nome && c.vencimento === conta.vencimento);
  if (idx === -1) return false;

  if (conta.pagamentos && conta.pagamentos.length > 0) {
    conta.pagamentos.pop();
    conta.parcelaAtual = Math.max(0, (conta.parcelaAtual || 1) - 1);

    const dv = conta._ultimaDataVencimento ? new Date(conta._ultimaDataVencimento) : parseDataFlex(conta.vencimento);
    dv.setMonth(dv.getMonth() - 1);
    conta._ultimaDataVencimento = dv;
    conta.vencimento = dv.toISOString().split('T')[0];

    contas[idx] = conta;
    salvarContas(contas);
    return true;
  }
  return false;
}

// Adicionar nova conta
if (formNovaConta) {
  formNovaConta.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = document.getElementById("nomeConta").value.trim();
    const valor = parseFloat(document.getElementById("valorConta").value);
    const vencimento = document.getElementById("vencimentoConta").value;
    const parcelas = parseInt(document.getElementById("parcelasConta").value) || 1;
    const categoria = document.getElementById("categoriaConta").value || "outros";

    if (!nome || !valor || !vencimento) return alert("Preencha todos os campos!");

    const contas = obterContas() || [];
    contas.push({
      nome,
      valor,
      vencimento,
      parcelas,
      categoria,
      parcelaAtual: 0,
      pagamentos: [],
      _ultimaDataVencimento: parseDataFlex(vencimento)
    });
    salvarContas(contas);

    renderizarContas();
    atualizarResumo();

    formNovaConta.reset();
    const modal = bootstrap.Modal.getInstance(document.getElementById("modalConta"));
    if (modal) modal.hide();
  });
}

// Renderizar contas
function renderizarContas() {
  const contas = obterContas() || [];
  listaContas.innerHTML = "";

  contas.forEach((conta, index) => {
    const li = document.createElement("li");
    li.className = "list-group-item";

    const valorParcela = toNumber(conta.valor);
    const parcelas = conta.parcelas || 1;
    const parcelaAtual = conta.parcelaAtual || 0;
    const porcentagem = Math.round((parcelaAtual / parcelas) * 100);

    const badgeCategoria = criarBadgeCategoria(conta.categoria);

    if (porcentagem >= 100) {
      li.classList.add("conta-concluida");
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div><strong>${conta.nome}</strong> - Concluído - ${formatBRL(valorParcela * parcelas)} - <small class="text-muted">${new Date(conta.vencimento).toLocaleDateString()}</small></div>
          <div><button class="btn btn-sm btn-danger btn-remover">Remover</button></div>
        </div>
        <div class="progress">
          <div class="progress-bar ${corProgressBar(porcentagem)}" role="progressbar" style="width:100%"></div>
        </div>
      `;
    } else {
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="conta-left"></div>
          <div>
            <button class="btn btn-sm btn-primary btn-pagar me-2">Pagar</button>
            <button class="btn btn-sm btn-warning btn-desfazer me-2">Desfazer</button>
            <button class="btn btn-sm btn-danger btn-remover">Remover</button>
          </div>
        </div>
        <div class="progress">
          <div class="progress-bar ${corProgressBar(porcentagem)}" role="progressbar" style="width:${Math.max(2, porcentagem)}%"></div>
        </div>
      `;

      const leftDiv = li.querySelector(".conta-left");
      leftDiv.appendChild(badgeCategoria);
      const txt = document.createElement("span");
      txt.style.marginLeft = "8px";
      txt.innerHTML = `<strong>${conta.nome}</strong> - Parcela ${parcelaAtual+1} de ${parcelas} - ${formatBRL(valorParcela)}`;
      leftDiv.appendChild(txt);

      const venc = parseDataFlex(conta.vencimento);
      if (venc) {
        const small = document.createElement("small");
        small.className = "text-muted d-block";
        small.textContent = `Venc.: ${venc.toLocaleDateString('pt-BR')}`;
        leftDiv.appendChild(small);
      }
    }

    li.querySelector(".btn-pagar")?.addEventListener("click", () => {
      if (registrarPagamento(conta)) {
        renderizarContas();
        atualizarResumo();
      }
    });

    li.querySelector(".btn-desfazer")?.addEventListener("click", () => {
      if (desfazerPagamento(conta)) {
        renderizarContas();
        atualizarResumo();
      }
    });

    li.querySelector(".btn-remover")?.addEventListener("click", () => {
      if (confirm(`Remover "${conta.nome}"?`)) {
        const contas = obterContas();
        contas.splice(index, 1);
        salvarContas(contas);
        renderizarContas();
        atualizarResumo();
      }
    });

    listaContas.appendChild(li);
  });

  atualizarResumo();
}

// Renderizar ganhos
function renderizarGanhos() {
  const ganhos = obterGanhos() || [];
  listaGanhos.innerHTML = "";

  ganhos.forEach((ganho, index) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";

    const left = document.createElement("div");
    left.innerHTML = `<strong>${ganho.nome}</strong> - ${formatBRL(toNumber(ganho.valor))} <small class="text-muted ms-2">${ganho.data ? parseDataFlex(ganho.data)?.toLocaleDateString('pt-BR') : ''}</small>`;

    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-danger";
    btn.textContent = "Remover";
    btn.addEventListener("click", () => {
      if (confirm("Remover este ganho?")) {
        ganhos.splice(index, 1);
        salvarGanhos(ganhos);
        renderizarGanhos();
        atualizarResumo();
      }
    });

    li.appendChild(left);
    li.appendChild(btn);
    listaGanhos.appendChild(li);
  });

  atualizarResumo();
}

// Calcular gasto do mês
function calcularGastoDoMes() {
  const contas = obterContas() || [];
  const hoje = new Date();
  return contas.reduce((total, c) => {
    const pagamentos = c.pagamentos || [];
    return total + pagamentos.reduce((s, p) => {
      const pd = parseDataFlex(p.data);
      if (!pd) return s;
      if (pd.getMonth() === hoje.getMonth() && pd.getFullYear() === hoje.getFullYear()) {
        return s + toNumber(p.valor);
      }
      return s;
    }, 0);
  }, 0);
}

// Calcular entrada do mês
function calcularEntradaDoMes() {
  const ganhos = obterGanhos() || [];
  const hoje = new Date();
  return ganhos.reduce((total, g) => {
    const gd = parseDataFlex(g.data);
    if (!gd) return total;
    if (gd.getMonth() === hoje.getMonth() && gd.getFullYear() === hoje.getFullYear()) {
      return total + toNumber(g.valor);
    }
    return total;
  }, 0);
}

// Atualizar cards
function atualizarResumo() {
  const contas = obterContas() || [];
  totalContasEl && animarNumero(totalContasEl, contas.length, v => Math.round(v));

  const totalPago = contas.reduce((acc, c) => acc + (c.pagamentos || []).reduce((s, p) => s + toNumber(p.valor), 0), 0);
  totalPagoEl && animarNumero(totalPagoEl, totalPago, formatBRL);

  const totalValor = contas.reduce((acc, c) => acc + toNumber(c.valor) * (c.parcelas || 1), 0);
  const restante = Math.max(0, totalValor - totalPago);
  totalRestanteEl && animarNumero(totalRestanteEl, restante, formatBRL);

  saldoTotalEl && animarNumero(saldoTotalEl, calcularSaldoTotal(), formatBRL);
  entradaMesEl && animarNumero(entradaMesEl, calcularEntradaDoMes(), formatBRL);
  gastoMesEl && animarNumero(gastoMesEl, calcularGastoDoMes(), formatBRL);
}

/* ---------------------------
   BOTÃO ADICIONAR GANHO
---------------------------- */
const nomeGanhoEl = document.getElementById("nomeGanho");
const valorGanhoEl = document.getElementById("valorGanho");
const dataGanhoEl = document.getElementById("dataGanho");
const btnAdicionarGanho = document.getElementById("adicionarGanho");

btnAdicionarGanho.addEventListener("click", () => {
    const nome = nomeGanhoEl.value.trim();
    const valor = parseFloat(valorGanhoEl.value);
    const data = dataGanhoEl.value;

    if (!nome || isNaN(valor) || !data) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    const ganhos = obterGanhos();
    ganhos.push({ nome, valor, data });

    salvarGanhos(ganhos);
    renderizarGanhos();
    atualizarResumo();

    // Fecha modal
    const modal = bootstrap.Modal.getInstance(document.getElementById("modalGanho"));
    if (modal) modal.hide();

    // Limpa campos
    nomeGanhoEl.value = "";
    valorGanhoEl.value = "";
    dataGanhoEl.value = "";
});

/* ---------------------------
   EXPOR FUNÇÕES NO WINDOW
---------------------------- */
window.obterContas = obterContas;
window.obterGanhos = obterGanhos;
window.calcularSaldoTotal = calcularSaldoTotal;
window.calcularGastoDoMes = calcularGastoDoMes;
window.calcularEntradaDoMes = calcularEntradaDoMes;
window.toNumber = toNumber;
window.formatBRL = formatBRL;
window.registrarPagamento = registrarPagamento;
window.desfazerPagamento = desfazerPagamento;
window.renderizarContas = renderizarContas;
window.renderizarGanhos = renderizarGanhos;
window.atualizarResumo = atualizarResumo;

/* ---------------------------
   INIT
---------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderizarContas();
  renderizarGanhos();
  atualizarResumo();
  window.addEventListener("storage", () => {
    renderizarContas();
    renderizarGanhos();
    atualizarResumo();
  });
});
