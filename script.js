// Carrega contas do localStorage
function obterContas() {
  return JSON.parse(localStorage.getItem("contas")) || [];
}

// Formatação de moeda
const formatBRL = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

// Conversão segura de número
function toNumber(v) {
  return typeof v === "number" ? v : parseFloat(v || 0);
}

// --- Atualiza Resumo ---
function atualizarResumo() {
  const contas = obterContas();

  const saldoTotalEl = document.getElementById("saldoTotal");
  const gastosMesEl = document.getElementById("gastosMes");
  const entradasMesEl = document.getElementById("entradasMes");
  const alertasEl = document.getElementById("alertas");

  const totalPago = contas.reduce((acc, c) => acc + (toNumber(c.valor) * (c.parcelaAtual || 0)), 0);
  const totalRestante = contas.reduce((acc, c) => acc + (toNumber(c.valor) * (c.parcelas || 0)) - (toNumber(c.valor) * (c.parcelaAtual || 0)), 0);

  if (saldoTotalEl) saldoTotalEl.textContent = "R$ 0,00"; // só entra quando houver ganhos
  if (entradasMesEl) entradasMesEl.textContent = formatBRL(totalPago);
  if (gastosMesEl) gastosMesEl.textContent = formatBRL(totalRestante);

  // Alertas
  if (alertasEl) {
    alertasEl.innerHTML = "";
    contas.filter(c => c.parcelaAtual < c.parcelas)
           .forEach(c => {
             const li = document.createElement("li");
             li.textContent = `Conta: ${c.nome} - Próxima parcela: ${c.parcelaAtual + 1} de ${c.parcelas}`;
             alertasEl.appendChild(li);
           });
  }
}

// --- Mini calendário semanal ---
function atualizarCalendarioSemana() {
  const contas = obterContas();
  const calendarioEl = document.getElementById("calendarioSemana");
  if (!calendarioEl) return;

  calendarioEl.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const gastoSemana = contas.reduce((acc, c) => acc + ((toNumber(c.valor) * (c.parcelaAtual || 0)) / 4), 0);
    const div = document.createElement("div");
    div.textContent = `Semana ${i + 1}\n${formatBRL(gastoSemana)}`;
    if (gastoSemana > 0) div.classList.add("gasto");
    calendarioEl.appendChild(div);
  }
}

// --- Metas ---
function atualizarMetas() {
  const metas = [
    { nome: "Guardar R$500", valor: 500, atual: 250 },
    { nome: "Investir R$300", valor: 300, atual: 100 },
  ];

  const container = document.getElementById("metasContainer");
  if (!container) return;
  container.innerHTML = "";

  metas.forEach(meta => {
    const div = document.createElement("div");
    div.classList.add("meta");
    div.innerHTML = `
      <div class="d-flex justify-content-between mb-1">
        <span>${meta.nome}</span>
        <span>${formatBRL(meta.atual)} / ${formatBRL(meta.valor)}</span>
      </div>
      <div class="progress">
        <div class="progress-bar bg-success" role="progressbar"
             style="width: ${Math.min(100, (meta.atual / meta.valor) * 100)}%;"
             aria-valuenow="${meta.atual}" aria-valuemin="0" aria-valuemax="${meta.valor}">
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// --- Gráfico rápido ---
function atualizarGrafico() {
  const ctx = document.getElementById("graficoGastos");
  if (!ctx) return;

  const contas = obterContas();
  const categorias = ["Alimentação", "Transporte", "Lazer", "Outros"];
  const dados = [0, 0, 0, 0];

  contas.forEach(c => {
    const idx = Math.floor(Math.random() * 4);
    dados[idx] += toNumber(c.valor) * (c.parcelaAtual || 0);
  });

  if (window.graficoPizza) window.graficoPizza.destroy();

  window.graficoPizza = new Chart(ctx, {
    type: "pie",
    data: {
      labels: categorias,
      datasets: [{
        data: dados,
        backgroundColor: ["#0d6efd", "#198754", "#ffc107", "#dc3545"]
      }]
    },
    options: { responsive: true }
  });
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
  atualizarResumo();
  atualizarCalendarioSemana();
  atualizarMetas();
  atualizarGrafico();
});

window.addEventListener("storage", (event) => {
  if (event.key === "contas") {
    atualizarResumo();
    atualizarCalendarioSemana();
    atualizarGrafico();
  }
});
