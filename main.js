"use strict";

/* main.js - funções utilitárias e fonte de dados (escopo global) */

/* cores das categorias (mantém mesmas classes visuais do CSS) */
window.coresCategoria = {
  alimentacao: "#28a745",
  transporte: "#0d6efd",
  lazer: "#fd7e14",
  divida: "#dc3545",
  salario: "#0d6efd",
  outros: "#6c757d",
};

window.obterContas = function () {
  try {
    const raw = localStorage.getItem("contas");
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[obterContas] JSON inválido.", e);
    return [];
  }
};

window.salvarContas = function (contas) {
  try {
    localStorage.setItem("contas", JSON.stringify(contas ?? []));
    // dispara evento 'storage' para as outras telas pegarem mudança
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("[salvarContas] Falha ao salvar.", e);
  }
};

window.obterGanhos = function () {
  try {
    const raw = localStorage.getItem("ganhos");
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[obterGanhos] JSON inválido.", e);
    return [];
  }
};

window.salvarGanhos = function (ganhos) {
  try {
    localStorage.setItem("ganhos", JSON.stringify(ganhos ?? []));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("[salvarGanhos] Falha ao salvar ganhos.", e);
  }
};

window.registrarGanho = function (nome, valor, data = new Date(), categoria = "outros") {
  const ganhos = obterGanhos();
  ganhos.push({
    nome: String(nome).trim(),
    valor: toNumber(valor),
    data: data instanceof Date ? data.toISOString() : data,
    categoria,
  });
  salvarGanhos(ganhos);
};

/* formatação e util */
window.formatBRL = function (n) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(n) ? n : 0);
};

window.toNumber = function (v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).trim();
  const norm = s.replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : 0;
};

window.animarNumero = function (el, valorFinal, formatFn = (v) => v, duracaoMs = 400) {
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
    if (p < 1) requestAnimationFrame(step);
    else {
      el.textContent = formatFn(valorFinal);
      el.setAttribute("data-valor", String(valorFinal));
    }
  }
  requestAnimationFrame(step);
};

window.parseDataBr = function (str) {
  if (typeof str !== "string") return null;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  const dt = new Date(+y, +mo - 1, +d);
  return Number.isFinite(dt.getTime()) ? dt : null;
};

window.parseDataFlex = function (v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(`${v}T00:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const br = parseDataBr(v);
  if (br) return br;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

window.semanaDoMes = function (date = new Date()) {
  const dia = date.getDate();
  return Math.min(5, Math.max(1, Math.ceil(dia / 7)));
};

window.obterPagamentosDoMes = function (contas, ano, mes) {
  const pagamentosDoMes = [];
  contas.forEach((conta, idx) => {
    if (!Array.isArray(conta.pagamentos)) return;
    conta.pagamentos.forEach((pag) => {
      const dt = parseDataFlex(pag.data);
      if (dt && dt.getFullYear() === ano && dt.getMonth() === mes) {
        pagamentosDoMes.push({ conta: conta, valor: toNumber(pag.valor), data: dt });
      }
    });
  });
  return pagamentosDoMes;
};

/* calculos */
window.calcularSaldoTotal = function () {
  const contas = obterContas();
  const ganhos = obterGanhos();
  const totalGanhos = ganhos.reduce((acc, g) => acc + toNumber(g.valor), 0);
  const totalPago = contas.reduce((acc, c) => acc + (Array.isArray(c.pagamentos) ? c.pagamentos.reduce((pAcc, p) => pAcc + toNumber(p.valor), 0) : 0), 0);
  const saldo = totalGanhos - totalPago;
  return saldo > 0 ? saldo : 0;
};

window.calcularEntradaDoMes = function () {
  const ganhos = obterGanhos();
  const agora = new Date();
  return ganhos
    .filter(g => {
      const d = parseDataFlex(g.data);
      return d && d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
    })
    .reduce((acc, g) => acc + toNumber(g.valor), 0);
};

window.calcularGastoDoMes = function () {
  const contas = obterContas();
  const agora = new Date();
  const pagamentos = obterPagamentosDoMes(contas, agora.getFullYear(), agora.getMonth());
  return pagamentos.reduce((acc, p) => acc + toNumber(p.valor), 0);
};

/*
 registrarPagamento corrigido: recebe índice (index) da conta no array.
 Isso evita problemas de referência/objetos e garante salvar a lista completa.
 Retorna true se pagamento efetuado.
*/
window.registrarPagamentoPorIndex = function (index) {
  const contas = obterContas();
  if (index < 0 || index >= contas.length) return false;
  const conta = contas[index];
  const valorConta = toNumber(conta.valor);
  const saldo = calcularSaldoTotal();
  if (saldo < valorConta) {
    alert("Saldo insuficiente para pagar esta conta.");
    return false;
  }
  if (!Array.isArray(conta.pagamentos)) conta.pagamentos = [];
  conta.pagamentos.push({ valor: valorConta, data: new Date().toISOString() });
  conta.parcelaAtual = Math.min((conta.parcelaAtual || 0) + 1, conta.parcelas || 1);
  salvarContas(contas);
  return true;
};

window.migrarDadosAntigos = function () {
  let migrado = false;
  const contas = obterContas();
  contas.forEach(conta => {
    if (!Array.isArray(conta.pagamentos) && (conta.parcelaAtual || 0) > 0) {
      conta.pagamentos = [];
      for (let i = 0; i < conta.parcelaAtual; i++) {
        const dv = parseDataFlex(conta.vencimento);
        if (!dv) continue;
        const dt = new Date(dv);
        dt.setMonth(dt.getMonth() + i);
        conta.pagamentos.push({ valor: conta.valor, data: dt.toISOString() });
      }
      migrado = true;
    }
    if (!Array.isArray(conta.pagamentos)) conta.pagamentos = [];
  });
  if (migrado) salvarContas(contas);
};
