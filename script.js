"use strict";

const STORAGE_KEYS = {
  history: "buscaCepHistory",
  theme: "buscaCepTheme"
};

const MAX_HISTORY_ITEMS = 10;

const elements = {
  form: document.getElementById("cepForm"),
  cep: document.getElementById("cep"),
  cepError: document.getElementById("cepError"),
  searchButton: document.getElementById("searchButton"),
  resultCard: document.getElementById("resultCard"),
  resultTitle: document.getElementById("resultTitle"),
  logradouro: document.getElementById("logradouro"),
  bairro: document.getElementById("bairro"),
  cidade: document.getElementById("cidade"),
  estado: document.getElementById("estado"),
  regiao: document.getElementById("regiao"),
  numero: document.getElementById("numero"),
  complemento: document.getElementById("complemento"),
  fullAddress: document.getElementById("fullAddress"),
  copyButton: document.getElementById("copyButton"),
  mapButton: document.getElementById("mapButton"),
  historyList: document.getElementById("historyList"),
  emptyHistory: document.getElementById("emptyHistory"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  toastContainer: document.getElementById("toastContainer"),
  themeToggle: document.getElementById("themeToggle"),
  themeIcon: document.getElementById("themeIcon"),
  confirmModal: document.getElementById("confirmModal"),
  cancelClearButton: document.getElementById("cancelClearButton"),
  confirmClearButton: document.getElementById("confirmClearButton")
};

let currentAddress = null;
let history = loadHistory();

function sanitizeDigits(value) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function formatCep(value) {
  const digits = sanitizeDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function isValidCep(value) {
  const digits = sanitizeDigits(value);
  return /^\d{8}$/.test(digits) && !/^(\d)\1{7}$/.test(digits);
}

function setCepError(message = "") {
  elements.cepError.textContent = message;
  elements.cep.setAttribute("aria-invalid", String(Boolean(message)));
}

function setLoading(isLoading) {
  elements.form.classList.toggle("loading", isLoading);
  elements.searchButton.disabled = isLoading;
  elements.cep.disabled = isLoading;
  elements.searchButton.querySelector("span:last-child").textContent = isLoading ? "Buscando" : "Buscar CEP";
}

async function fetchAddress(cep) {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP agora.");
  }

  const data = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado. Verifique os números informados.");
  }

  return normalizeAddress(data);
}

function normalizeAddress(data) {
  return {
    cep: formatCep(data.cep || ""),
    logradouro: data.logradouro || "Não informado",
    bairro: data.bairro || "Não informado",
    cidade: data.localidade || "Não informado",
    estado: data.estado || data.uf || "Não informado",
    uf: data.uf || "",
    regiao: data.regiao || "Não informada",
    numero: "",
    complemento: "",
    consultedAt: new Date().toISOString()
  };
}

function renderAddress(address, shouldScroll = true) {
  currentAddress = { ...address };

  elements.resultTitle.textContent = address.cep;
  elements.logradouro.textContent = address.logradouro;
  elements.bairro.textContent = address.bairro;
  elements.cidade.textContent = address.cidade;
  elements.estado.textContent = address.uf ? `${address.estado} (${address.uf})` : address.estado;
  elements.regiao.textContent = address.regiao;
  elements.numero.value = address.numero || "";
  elements.complemento.value = address.complemento || "";
  elements.resultCard.classList.remove("hidden");
  updateFullAddress();

  if (shouldScroll) {
    elements.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function buildFullAddress(address = currentAddress) {
  if (!address) return "";

  const streetParts = [address.logradouro];
  const number = (elements.numero.value || address.numero || "").trim();
  const complement = (elements.complemento.value || address.complemento || "").trim();

  if (number) streetParts.push(number);
  if (complement) streetParts.push(complement);

  return [
    streetParts.filter(Boolean).join(", "),
    address.bairro,
    `${address.cidade} - ${address.uf || address.estado}`,
    `CEP ${address.cep}`,
    address.regiao !== "Não informada" ? `Região ${address.regiao}` : ""
  ].filter(Boolean).join(" | ");
}

function updateFullAddress() {
  if (!currentAddress) return;

  currentAddress.numero = elements.numero.value.trim();
  currentAddress.complemento = elements.complemento.value.trim();
  elements.fullAddress.textContent = buildFullAddress();
}

function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.history));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
}

function addToHistory(address) {
  const entry = {
    ...address,
    numero: "",
    complemento: "",
    consultedAt: new Date().toISOString()
  };

  history = [entry, ...history.filter((item) => item.cep !== entry.cep)].slice(0, MAX_HISTORY_ITEMS);
  saveHistory();
  renderHistory();
}

function removeHistoryItem(cep) {
  history = history.filter((item) => item.cep !== cep);
  saveHistory();
  renderHistory();
  showToast("Consulta removida do histórico.", "success");
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  const hasHistory = history.length > 0;

  elements.emptyHistory.classList.toggle("hidden", hasHistory);
  elements.clearHistoryButton.classList.toggle("hidden", !hasHistory);

  history.forEach((item) => {
    const wrapper = document.createElement("article");
    wrapper.className = "history-item";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "history-item__main";
    openButton.setAttribute("aria-label", `Abrir consulta do CEP ${item.cep}`);

    const cep = document.createElement("span");
    cep.className = "history-item__cep";
    cep.textContent = item.cep;

    const address = document.createElement("span");
    address.className = "history-item__address";
    address.textContent = `${item.logradouro}, ${item.bairro} — ${item.cidade}/${item.uf}`;

    const date = document.createElement("span");
    date.className = "history-item__date";
    date.textContent = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(item.consultedAt));

    openButton.append(cep, address, date);
    openButton.addEventListener("click", () => {
      elements.cep.value = item.cep;
      renderAddress(item);
      showToast("Consulta carregada do histórico.", "success");
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "history-item__remove";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remover CEP ${item.cep} do histórico`);
    removeButton.addEventListener("click", () => removeHistoryItem(item.cep));

    wrapper.append(openButton, removeButton);
    elements.historyList.appendChild(wrapper);
  });
}

async function copyFullAddress() {
  const text = buildFullAddress();

  if (!text) {
    showToast("Consulte um CEP antes de copiar.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("Endereço completo copiado.", "success");
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
    showToast("Endereço completo copiado.", "success");
  }
}

function openMap() {
  const address = buildFullAddress();

  if (!address) {
    showToast("Consulte um CEP antes de abrir o mapa.", "error");
    return;
  }

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.innerHTML = `<span aria-hidden="true">${type === "error" ? "!" : "✓"}</span><span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  window.setTimeout(() => toast.remove(), 3500);
}

function openClearModal() {
  if (!history.length) return;
  elements.confirmModal.classList.remove("hidden");
  elements.cancelClearButton.focus();
}

function closeClearModal() {
  elements.confirmModal.classList.add("hidden");
  elements.clearHistoryButton.focus();
}

function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
  closeClearModal();
  showToast("Histórico limpo com sucesso.", "success");
}

function getPreferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const isDark = theme === "dark";
  elements.themeIcon.textContent = isDark ? "☀" : "☾";
  elements.themeToggle.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
  document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? "#0b1220" : "#2563eb");
}

async function handleSubmit(event) {
  event.preventDefault();
  setCepError();

  const cep = sanitizeDigits(elements.cep.value);

  if (!isValidCep(cep)) {
    setCepError("Informe um CEP válido com 8 números.");
    elements.cep.focus();
    showToast("CEP inválido. Revise os números digitados.", "error");
    return;
  }

  setLoading(true);

  try {
    const address = await fetchAddress(cep);
    elements.cep.value = address.cep;
    renderAddress(address);
    addToHistory(address);
    showToast("Endereço encontrado com sucesso.", "success");
  } catch (error) {
    setCepError(error.message);
    showToast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

elements.cep.addEventListener("input", (event) => {
  event.target.value = formatCep(event.target.value);
  if (elements.cepError.textContent) setCepError();
});

elements.cep.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.target.value = "";
    setCepError();
  }
});

elements.form.addEventListener("submit", handleSubmit);
elements.numero.addEventListener("input", updateFullAddress);
elements.complemento.addEventListener("input", updateFullAddress);
elements.copyButton.addEventListener("click", copyFullAddress);
elements.mapButton.addEventListener("click", openMap);
elements.clearHistoryButton.addEventListener("click", openClearModal);
elements.cancelClearButton.addEventListener("click", closeClearModal);
elements.confirmClearButton.addEventListener("click", clearHistory);
elements.confirmModal.addEventListener("click", (event) => {
  if (event.target === elements.confirmModal) closeClearModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.confirmModal.classList.contains("hidden")) {
    closeClearModal();
  }
});

elements.themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});

applyTheme(getPreferredTheme());
renderHistory();
