"use strict";

const STORAGE_KEY = "listaCompras";
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxxS-a5YlhyP2MOJSN_Y8FBMLlf1T5UDECAaJFi0B6HRhcbZbrEmexY8Do1ZtX1D0tASQ/exec";

/* =========================
   Fallback (caso Página2 esteja vazia/offline)
========================= */
const ITENS_FIXOS_FALLBACK = [
  "Feijão",
  "Macarrão",
  "Leite",
  "Flocão",
  "Milho",
  "Molho",
  "Alho",
  "Leite condensado",
  "Creme de leite",
  "Manteiga",
  "Maionese",
  "Farofa Swift",
  "Pão",
  "Ovo",
  "Frango",
  "Carne",
  "Açúcar",
  "Shampoo",
  "Condicionador",
  "Pasta",
  "Cloro",
  "Sabão",
  "Desinfetante",
  "Amaciante",
  "Areia p/ gato",
  "Desodorante",
  "Detergente",
  "Bucha"
];

// ✅ Itens fixos carregados (virão da Página2)
let ITENS_FIXOS = [];

/* =========================
   Helpers DOM
========================= */
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function getMesAtual() {
  return new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

/* =========================
   Storage
========================= */
function salvarNoStorage(dados) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  } catch (e) {
    console.warn("LocalStorage indisponível");
  }
}

function lerDoStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    console.warn("Falha ao carregar localStorage");
    return [];
  }
}

/* =========================
   Carregar lista fixa da Página2 (JSONP)
   - evita CORS (funciona até com file://)
========================= */
function carregarFixosDaPlanilhaJSONP() {
  return new Promise((resolve, reject) => {
    const callbackName = "__cbFixos_" + Date.now();
    const script = document.createElement("script");

    window[callbackName] = (itens) => {
      try {
        delete window[callbackName];
        script.remove();

        if (!Array.isArray(itens)) {
          reject(new Error("Resposta do doGet não é uma lista."));
          return;
        }

        const limpos = itens
          .map(v => String(v).trim())
          .filter(v => v && v !== "null" && v !== "undefined");

        resolve(limpos);
      } catch (err) {
        reject(err);
      }
    };

    script.onerror = () => {
      try { delete window[callbackName]; } catch (e) {}
      script.remove();
      reject(new Error("Falha ao carregar lista fixa via JSONP."));
    };

    // ✅ chama doGet com callback
    script.src = `${SHEET_URL}?callback=${callbackName}&_=${Date.now()}`;
    document.body.appendChild(script);
  });
}

/* =========================
   Template / Linhas
========================= */
function criarLinhaPeloTemplate(nome, qtd = 0, valor = 0, selecionado = false, fixo = false) {
  const template = qs("#template-item-fixo");
  if (!template) {
    throw new Error("Template #template-item-fixo não encontrado no HTML.");
  }

  const tr = template.content.cloneNode(true).querySelector("tr");

  if (!fixo) {
    delete tr.dataset.fixo;
  } else {
    tr.dataset.fixo = "true";
  }

  qs(".item", tr).innerText = nome;

  const check = tr.children[0].querySelector("input");
  const qtdInput = tr.children[2].querySelector("input");
  const valorInput = tr.children[3].querySelector("input");

  check.checked = !!selecionado;
  qtdInput.value = qtd ? String(qtd) : "";
  valorInput.value = valor ? String(valor) : "";

  check.addEventListener("input", calcular);
  qtdInput.addEventListener("input", calcular);
  valorInput.addEventListener("input", calcular);

  return tr;
}

function montarItensFixos() {
  const tbody = qs("#listaItens");
  tbody.innerHTML = "";

  ITENS_FIXOS.forEach(nome => {
    tbody.appendChild(criarLinhaPeloTemplate(nome, 0, 0, false, true));
  });
}

/* =========================
   Calcular / Atualizar UI
========================= */
function calcular() {
  const linhas = qsa("#tabelaCompras tbody tr");
  let totalGeral = 0;

  const dados = linhas.map(tr => {
    const check = tr.children[0].querySelector("input").checked;
    const qtd = toNumber(tr.children[2].querySelector("input").value);
    const valor = toNumber(tr.children[3].querySelector("input").value);
    const totalItem = qtd * valor;

    tr.children[4].innerText = totalItem.toFixed(2);
    if (check) totalGeral += totalItem;

    return {
      item: tr.children[1].innerText,
      quantidade: qtd,
      valor: valor,
      selecionado: check,
      fixo: tr.dataset.fixo === "true"
    };
  });

  salvarNoStorage(dados);
  qs("#totalGeral").innerText = "Total Geral: R$ " + totalGeral.toFixed(2);
}

/* =========================
   Carregar dados salvos
   - Monta fixos (da Página2)
   - Aplica valores nos fixos por índice
   - Recria itens adicionados
========================= */
function carregarDados() {
  const dados = lerDoStorage();

  // 1) Garante os fixos sempre presentes
  montarItensFixos();

  // 2) Aplica valores nos fixos (por índice)
  const linhas = qsa("#tabelaCompras tbody tr");
  const limite = Math.min(ITENS_FIXOS.length, dados.length);

  for (let i = 0; i < limite; i++) {
    const d = dados[i];
    if (!linhas[i]) continue;

    linhas[i].children[0].querySelector("input").checked = !!d.selecionado;
    linhas[i].children[2].querySelector("input").value = d.quantidade ? String(d.quantidade) : "";
    linhas[i].children[3].querySelector("input").value = d.valor ? String(d.valor) : "";
  }

  // 3) Recria os itens adicionados (além dos fixos)
  for (let i = ITENS_FIXOS.length; i < dados.length; i++) {
    const d = dados[i];
    qs("#listaItens").appendChild(
      criarLinhaPeloTemplate(d.item, d.quantidade, d.valor, d.selecionado, false)
    );
  }

  calcular();
}

/* =========================
   Ações
========================= */
function adicionarItem() {
  const input = qs("#novoItemNome");
  const nome = (input.value || "").trim();

  if (!nome) {
    alert("Digite o nome do item.");
    return;
  }

  qs("#listaItens").appendChild(criarLinhaPeloTemplate(nome, 0, 0, false, false));

  input.value = "";
  input.focus();
  calcular();
}

function apagarTudo() {
  const confirmar = confirm("Tem certeza que deseja apagar toda a lista?\n\nEssa ação não pode ser desfeita.");
  if (!confirmar) return;

  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

  const tbody = qs("#listaItens");

  // remove adicionados (não fixos)
  qsa("tr", tbody).forEach(tr => {
    const isFixo = tr.dataset.fixo === "true";
    if (!isFixo) tr.remove();
  });

  // zera fixos
  qsa("tr", tbody).forEach(tr => {
    tr.children[0].querySelector("input").checked = false;
    tr.children[2].querySelector("input").value = "";
    tr.children[3].querySelector("input").value = "";
    tr.children[4].innerText = "0.00";
  });

  qs("#totalGeral").innerText = "Total Geral: R$ 0.00";
}

function enviarParaPlanilha() {
  const linhas = qsa("#tabelaCompras tbody tr");
  const mesAtual = getMesAtual();
  let selecionados = 0;

  linhas.forEach(tr => {
    const check = tr.children[0].querySelector("input").checked;
    if (!check) return;

    const item = tr.children[1].innerText;
    const quantidade = toNumber(tr.children[2].querySelector("input").value);
    const valor = toNumber(tr.children[3].querySelector("input").value);
    const total = quantidade * valor;

    selecionados++;

    fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, quantidade, valor, total, mes: mesAtual })
    }).catch(err => console.error("Erro fetch:", err));
  });

  alert(`Envio iniciado. Itens marcados: ${selecionados}`);
}

/* =========================
   Init
========================= */
async function init() {
  // Botões
  qs("#btnAdicionar").addEventListener("click", adicionarItem);
  qs("#btnEnviar").addEventListener("click", enviarParaPlanilha);
  qs("#btnApagar").addEventListener("click", apagarTudo);

  // Enter no input adiciona
  qs("#novoItemNome").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionarItem();
    }
  });

  // ✅ 1) tenta carregar a lista fixa da Página2
  try {
    const fixos = await carregarFixosDaPlanilhaJSONP();
    if (!fixos.length) throw new Error("Página2 vazia.");
    ITENS_FIXOS = fixos;
  } catch (e) {
    console.warn("Não consegui carregar fixos da Página2. Usando fallback.", e);
    ITENS_FIXOS = ITENS_FIXOS_FALLBACK.slice();
  }

  // ✅ 2) monta fixos e aplica dados
  carregarDados();
}

document.addEventListener("DOMContentLoaded", init);
