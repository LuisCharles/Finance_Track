"use strict";

// =========================
// Helpers / Fonte de dados
// =========================

function obterContas() {
  try {
    const raw = localStorage.getItem("contas");
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[obterContas] JSON inválido em localStorage.contas.", e);
    return [];
  }
}

function salvarContas(contas) {
  try {
    localStorage.setItem("contas", JSON.stringify(contas ?? []));
  } catch (e) {
    console.error("[salvarContas] Falha ao salvar contas.", e);
  }
}

// Formata em BRL
const formatBRL = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(n) ? n : 0
  );

// Converte com segurança para número (aceita "1.234,56" ou "1234.56")
function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).trim();
  const norm = s.replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : 0;
}

// Anima números nos cards (suave, sem “pulos” após refresh)
function animarNumero(el, valorFinal, formatFn = (v) => v, duracaoMs = 500) {
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
    if (p < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = formatFn(valorFinal);
      el.setAttribute("data-valor", String(valorFinal));
    }
  }
  requestAnimationFrame(step);
}

function semanaDoMes(date = new Date()) {
  const dia = date.getDate();
  return Math.min(5, Math.max(1, Math.ceil(dia / 7)));
}

const coresCategoria = {
  alimentacao: "#28a745", // Verde
  transporte: "#0d6efd", // Azul
  lazer: "#fd7e14", // Laranja
  divida: "#dc3545", // Vermelho
  outros: "#6c757d", // Cinza
};

// =========================
// Datas
// =========================
function parseDataBr(str) {
  if (typeof str !== "string") return null;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  const dt = new Date(+y, +mo - 1, +d);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function parseDataFlex(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const br = parseDataBr(v);
  if (br) return br;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// =========================
// Obtém todos os pagamentos de um mês
// =========================
function obterPagamentosDoMes(contas, ano, mes) {
  const pagamentosDoMes = [];
  contas.forEach((conta) => {
    if (Array.isArray(conta.pagamentos) && conta.pagamentos.length) {
      conta.pagamentos.forEach((pag) => {
        const dt = parseDataFlex(pag.data);
        if (dt && dt.getFullYear() === ano && dt.getMonth() === mes) {
          pagamentosDoMes.push({ conta: conta, valor: toNumber(pag.valor), data: dt });
        }
      });
    }
  });
  return pagamentosDoMes;
}

// =========================
// Resumo (cards do topo)
// =========================
function atualizarResumoHome() {
  const contas = obterContas();
  const saldoTotalEl = document.getElementById("saldoTotal");
  const gastosMesEl = document.getElementById("gastosMes");
  const entradasMesEl = document.getElementById("entradasMes");
  const alertasEl = document.getElementById("alertas");

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();

  const pagamentos = obterPagamentosDoMes(contas, anoAtual, mesAtual);
  let gastosDoMes = pagamentos.reduce((acc, p) => acc + p.valor, 0);

  const saldoTotal = 0;
  const entradasMes = 0;

  if (saldoTotalEl) animarNumero(saldoTotalEl, saldoTotal, formatBRL);
  if (gastosMesEl) animarNumero(gastosMesEl, gastosDoMes, formatBRL);
  if (entradasMesEl) animarNumero(entradasMesEl, entradasMes, formatBRL);

  if (alertasEl) {
    alertasEl.innerHTML = "";
    
    let alertasAdicionados = 0;

    contas.forEach(c => {
        let dataVencimento;
        if (c.dataVencimento) {
            dataVencimento = parseDataFlex(c.dataVencimento);
        } else if (c.pagamentos && c.pagamentos.length > 0 && c.parcelas > 1) {
            const ultimoPagamento = new Date(c.pagamentos[c.pagamentos.length - 1].data);
            dataVencimento = new Date(ultimoPagamento.getFullYear(), ultimoPagamento.getMonth() + 1, ultimoPagamento.getDate());
        } else if (c.dataInicio) {
            const dataInicial = parseDataFlex(c.dataInicio);
            dataVencimento = new Date(dataInicial.getFullYear(), dataInicial.getMonth() + (c.parcelaAtual || 0), dataInicial.getDate());
        } else {
            return;
        }

        if (!dataVencimento) {
            return;
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataVencimento.setHours(0, 0, 0, 0);

        const diffTime = dataVencimento - hoje;
        const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');

        // NOVA LÓGICA: Esta condição verifica se a conta deve ser mostrada como alerta.
        // Se a conta não foi paga (parcelaAtual < parcelas) OU se ela está vencida (diasRestantes <= 0),
        // ela deve ser exibida no painel de alertas.
        const deveMostrarAlerta = (c.parcelaAtual || 0) < (c.parcelas || 0) || diasRestantes <= 0;

        if (deveMostrarAlerta) {
            let statusText;
            let statusClass;

            if (diasRestantes <= 0) {
                statusText = `VENCIDO. Pague agora!`;
                statusClass = 'alerta-urgente';
            } else if (diasRestantes <= 5) {
                statusText = `Vence em ${diasRestantes} dias.`;
                statusClass = 'alerta-atencao';
            } else {
                statusText = `Faltam ${diasRestantes} dias para o pagamento.`;
                statusClass = 'alerta-normal';
            }
            
            const li = document.createElement("li");
            li.innerHTML = `
                <div class="alerta-item ${statusClass}">
                    <div class="alerta-header">
                        <span class="alerta-title">${c.nome}</span>
                        <span class="alerta-data">Vencimento: ${dataFormatada}</span>
                    </div>
                    <div class="alerta-body">
                        <p class="alerta-message">${statusText}</p>
                        <span class="alerta-info">Parcela ${c.parcelaAtual + 1} de ${c.parcelas}</span>
                    </div>
                </div>
            `;
            alertasEl.appendChild(li);
            alertasAdicionados++;
        }
    });

    if (alertasAdicionados === 0) {
        const li = document.createElement("li");
        li.textContent = "Nenhum alerta ou lembrete para as próximas contas.";
        li.className = "text-muted text-center py-3";
        alertasEl.appendChild(li);
    }
  }
}


// =========================
// Novo: Renderiza os detalhes de gastos semanais
// =========================
function renderizarDetalheGastos(semana, pagamentos) {
  const detalheEl = document.getElementById("detalheGastos");
  if (!detalheEl) return;

  detalheEl.innerHTML = `<h4>Gastos da Semana ${semana}</h4>`;
  const ul = document.createElement("ul");
  
  if (pagamentos.length > 0) {
    pagamentos.forEach(pag => {
      const li = document.createElement("li");
      const dataPagamentoFormatada = pag.data.toLocaleDateString();
      const valorFormatado = formatBRL(pag.valor);
      
      const categoria = pag.conta.categoria || 'outros';
      const categoriaClass = `cat-${categoria}`;

      li.innerHTML = `
        <div class="gasto-detalhe-card ${categoriaClass}">
          <div class="gasto-detalhe-header">
            <span class="gasto-detalhe-title">${pag.conta.nome}</span>
            <span class="gasto-detalhe-data">Pago em: ${dataPagamentoFormatada}</span>
          </div>
          <div class="gasto-detalhe-body">
            <span class="gasto-detalhe-valor">${valorFormatado}</span>
            <small class="text-muted">Categoria: ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}</small>
          </div>
        </div>
      `;
      ul.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "Nenhum gasto registrado nesta semana.";
    li.className = "text-muted text-center py-3";
    ul.appendChild(li);
  }
  
  detalheEl.appendChild(ul);
}

// =========================
// Mini calendário semanal
// =========================
function atualizarCalendarioSemana() {
  const contas = obterContas();
  const calendarioEl = document.getElementById("calendarioSemana");
  if (!calendarioEl) return;

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const semanas = 5;
  const valorPorSemana = Array(semanas).fill(0);
  const pagamentosPorSemana = Array(semanas).fill(null).map(() => []);

  const pagamentos = obterPagamentosDoMes(contas, anoAtual, mesAtual);

  pagamentos.forEach((pag) => {
    const sem = semanaDoMes(pag.data);
    valorPorSemana[sem - 1] += pag.valor;
    pagamentosPorSemana[sem - 1].push(pag);
  });

  const maxValor = Math.max(...valorPorSemana, 1);
  calendarioEl.innerHTML = "";

  const detalheEl = document.getElementById("detalheGastos");
  let semanaAtiva = -1;

  for (let i = 0; i < semanas; i++) {
    const div = document.createElement("div");
    div.classList.add("semana-card");
    div.style.flex = "1";
    div.style.margin = "2px";
    div.style.padding = "10px";
    div.style.borderRadius = "5px";
    div.style.textAlign = "center";
    div.setAttribute("data-semana", i + 1);

    div.textContent = `Semana ${i + 1}\n${formatBRL(valorPorSemana[i])}`;

    if (valorPorSemana[i] > 0) {
      div.classList.add("gasto");
      const intensidade = valorPorSemana[i] / maxValor;
      div.style.backgroundColor = `rgba(220,53,69,${0.3 + intensidade * 0.7})`;
      div.style.color = "#fff";
    } else {
      div.style.backgroundColor = "#e9ecef";
      div.style.color = "#000";
    }

    div.addEventListener("click", () => {
      const semanaClicada = i + 1;

      if (semanaAtiva === semanaClicada) {
        // Clicou na mesma semana: esconde
        detalheEl.classList.remove("mostrar");
        semanaAtiva = -1;
      } else {
        // Clicou em uma nova semana: mostra
        renderizarDetalheGastos(semanaClicada, pagamentosPorSemana[semanaClicada - 1]);
        detalheEl.classList.add("mostrar");
        semanaAtiva = semanaClicada;
      }
    });

    calendarioEl.appendChild(div);
  }
}

// =========================
// Gráfico pizza (Chart.js)
// =========================
let graficoPizza;
function atualizarGrafico() {
  const ctx = document.getElementById("graficoGastos");
  if (!ctx || typeof Chart === "undefined") return;

  const contas = obterContas();
  const somaPorCategoria = {
    alimentacao: 0,
    transporte: 0,
    lazer: 0,
    divida: 0,
    outros: 0,
  };

  const hoje = new Date();
  const pagamentos = obterPagamentosDoMes(contas, hoje.getFullYear(), hoje.getMonth());

  pagamentos.forEach((pag) => {
    const cat = pag.conta.categoria || "outros";
    const key = somaPorCategoria.hasOwnProperty(cat) ? cat : "outros";
    somaPorCategoria[key] += pag.valor;
  });

  const labels = ["Alimentação", "Transporte", "Lazer", "Dívida", "Outros"];
  const keys = ["alimentacao", "transporte", "lazer", "divida", "outros"];
  const data = keys.map((k) => somaPorCategoria[k]);
  const colors = keys.map((k) => coresCategoria[k]);

  if (graficoPizza) graficoPizza.destroy();

  graficoPizza = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
        },
      ],
    },
    options: { responsive: true },
  });
}

// =========================
// Boot / Sync entre telas
// =========================
function atualizarHome() {
  try {
    atualizarResumoHome();
    atualizarCalendarioSemana();
    atualizarGrafico();
  } catch (e) {
    console.error("[atualizarHome] Erro ao atualizar a Home:", e);
  }
}

window.atualizarHome = atualizarHome;

document.addEventListener("DOMContentLoaded", atualizarHome);

window.addEventListener("storage", (event) => {
  if (event.key === "contas") {
    atualizarHome();
  }
});