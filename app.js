"use strict";

// Reemplazá este valor por la URL /exec de tu Web App de Google Apps Script.
const API_URL = "https://script.google.com/macros/s/AKfycby_ZdrJDTGVAT-lB9yLComJUe65fGOtoyqwZfp34jXrstWs45LNP2ZceeO30B9t5Qsq/exec";

const SESSION_KEY = "casino_brc_session";
const ADMIN_TOKEN_KEY = "casino_brc_admin_token";
const CACHE_PREFIX = "casino_brc_cache";
const DASHBOARD_CACHE_TTL_MS = 45 * 1000;
const PERF_STORAGE_KEY = "casino_brc_perf";
const CATEGORIES = ["Viaje", "Habitaciones", "Wachineadas", "Quebrados", "Minas", "Peleas", "Especiales"];
const ROOM_COUNT_EVENT = "¿Cuántas personas habrá en tu habitación?";
const ROOM_COMPANIONS = [
  ["Romi", 1.4],
  ["Nico", 1.4],
  ["Juanpi", 1.4],
  ["Fran", 1.4],
  ["Jane", 1.4],
  ["Facu", 1.4],
  ["Nachón", 1.4],
  ["Joaco", 1.4],
  ["Gonza Boca", 1.4],
  ["Gonza R", 1.4],
  ["Ivi", 1.4],
  ["Dante", 1.4],
  ["Rocco", 1.4],
  ["Biglia", 1.4],
  ["Jesús", 1.4],
  ["Perrito Barrios", 7],
  ["Abelle", 6],
  ["Pipita", 3],
  ["Rocío", 15],
  ["Nico F", 15],
  ["Mathi Budani", 15],
  ["Mateo", 15],
  ["Nachito Pineda", 15],
];

const state = {
  user: null,
  markets: [],
  bets: [],
  roomCombinations: [],
  balanceRanking: [],
  winningsRanking: [],
  movements: [],
  adminBets: [],
  adminRoomCombinations: [],
  selectedOptions: {},
  roomSelections: {},
  betStatus: "Todas",
  currentView: "markets",
  loadingCount: 0,
  requestSequence: 0,
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();

  const savedSession = readStorage(SESSION_KEY, localStorage);
  if (savedSession && savedSession.usuario) {
    state.user = savedSession;
    const restoredFromCache = restoreDashboardCache();
    showApp();
    if (restoredFromCache) renderDashboardData();
    else renderLoadingPlaceholders();
    refreshAll({ silent: restoredFromCache });
  } else {
    showAuth();
  }
}

function cacheElements() {
  const ids = [
    "auth-view",
    "app-view",
    "login-form",
    "register-form",
    "login-username",
    "register-username",
    "logout-button",
    "header-balance",
    "sidebar-username",
    "user-avatar",
    "admin-nav-item",
    "markets-summary",
    "market-search",
    "category-filter",
    "status-filter",
    "markets-container",
    "bet-stat-cards",
    "bet-filters",
    "bets-container",
    "balance-ranking",
    "winnings-ranking",
    "movements-container",
    "admin-login-card",
    "admin-login-form",
    "admin-password",
    "admin-dashboard",
    "create-market-form",
    "admin-market-category",
    "admin-market-event",
    "admin-market-type",
    "create-option-form",
    "admin-option-market",
    "admin-option-name",
    "admin-option-line",
    "admin-option-side",
    "admin-option-odds",
    "admin-markets-container",
    "admin-bets-container",
    "loading-overlay",
    "toast-region",
    "mobile-menu-button",
    "sidebar",
    "sidebar-backdrop",
  ];

  ids.forEach((id) => {
    elements[toCamelCase(id)] = document.getElementById(id);
  });

  elements.authTabs = [...document.querySelectorAll("[data-auth-tab]")];
  elements.navItems = [...document.querySelectorAll("[data-view]")];
  elements.refreshButtons = [...document.querySelectorAll("[data-refresh]")];
}

function bindEvents() {
  elements.authTabs.forEach((button) => {
    button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
  });

  elements.loginForm.addEventListener("submit", handleLogin);
  elements.registerForm.addEventListener("submit", handleRegister);
  elements.logoutButton.addEventListener("click", logout);

  elements.navItems.forEach((button) => {
    button.addEventListener("click", () => navigateTo(button.dataset.view));
  });

  elements.refreshButtons.forEach((button) => {
    button.addEventListener("click", () => {
      clearClientCache();
      refreshAll();
    });
  });

  elements.marketSearch.addEventListener("input", renderMarkets);
  elements.categoryFilter.addEventListener("change", renderMarkets);
  elements.statusFilter.addEventListener("change", renderMarkets);
  elements.marketsContainer.addEventListener("click", handleMarketClick);
  elements.betsContainer.addEventListener("click", handleBetClick);

  elements.betFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bet-status]");
    if (!button) return;
    state.betStatus = button.dataset.betStatus;
    [...elements.betFilters.querySelectorAll("button")].forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderBets();
  });

  elements.adminLoginForm.addEventListener("submit", handleAdminLogin);
  elements.createMarketForm.addEventListener("submit", handleCreateMarket);
  elements.createOptionForm.addEventListener("submit", handleCreateOption);
  elements.adminMarketsContainer.addEventListener("click", handleAdminMarketClick);
  elements.adminBetsContainer.addEventListener("click", handleAdminBetsClick);

  elements.mobileMenuButton.addEventListener("click", toggleSidebar);
  elements.sidebarBackdrop.addEventListener("click", closeSidebar);
}

async function handleLogin(event) {
  event.preventDefault();
  const usuario = elements.loginUsername.value.trim();
  if (!usuario) return;

  try {
    setLoading(true);
    const data = await callApi("login", { usuario });
    startSession(data.user);
    clearClientCache();
    renderLoadingPlaceholders();
    showToast(`Bienvenido, ${data.user.usuario}.`, "success");
    await refreshAll();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const usuario = elements.registerUsername.value.trim();
  if (!usuario) return;

  try {
    setLoading(true);
    const data = await callApi("register", { usuario });
    startSession(data.user);
    clearClientCache();
    renderLoadingPlaceholders();
    showToast(`Cuenta creada. Recibiste ${formatChips(data.user.saldo)} fichas.`, "success");
    await refreshAll();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function startSession(user) {
  state.user = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  showApp();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  clearClientCache();
  state.user = null;
  state.markets = [];
  state.bets = [];
  state.roomCombinations = [];
  state.adminRoomCombinations = [];
  state.movements = [];
  state.selectedOptions = {};
  state.roomSelections = {};
  elements.loginForm.reset();
  elements.registerForm.reset();
  showAuth();
}

function showAuth() {
  elements.authView.classList.remove("is-hidden");
  elements.appView.classList.add("is-hidden");
  closeSidebar();
  setAuthTab("login");
}

function showApp() {
  elements.authView.classList.add("is-hidden");
  elements.appView.classList.remove("is-hidden");
  updateUserHeader();
  navigateTo(state.currentView);
}

function setAuthTab(tab) {
  const isLogin = tab === "login";
  elements.loginForm.classList.toggle("is-hidden", !isLogin);
  elements.registerForm.classList.toggle("is-hidden", isLogin);
  elements.authTabs.forEach((button) => {
    const active = button.dataset.authTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function navigateTo(view) {
  if (view === "admin" && state.user?.rol !== "admin") return;

  state.currentView = view;
  document.querySelectorAll(".app-view-section").forEach((section) => {
    section.classList.toggle("is-hidden", section.id !== `view-${view}`);
  });
  elements.navItems.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  closeSidebar();

  if (view === "admin") {
    syncAdminView();
  }
}

async function refreshAll(options = {}) {
  try {
    await refreshAllDashboard(options);
  } catch (error) {
    console.warn("getDashboardData falló, usando refresh legacy", error);
    await refreshAllLegacy(options);
  }
}

async function refreshAllDashboard(options = {}) {
  if (!state.user?.usuario) return;

  try {
    if (!options.silent) setLoading(true);
    const dashboard = unwrapDashboardResponse(
      await callApi("getDashboardData", { usuario: state.user.usuario }),
    );

    applyDashboardData(dashboard);
    renderDashboardData();
    writeDashboardCache();

    if (state.currentView === "admin") {
      await refreshAdminData();
    }
  } finally {
    if (!options.silent) setLoading(false);
  }
}

async function refreshAllLegacy(options = {}) {
  if (!state.user?.usuario) return;

  try {
    if (!options.silent) setLoading(true);
    const usuario = state.user.usuario;
    const [userData, markets, bets, balanceRanking, winningsRanking, movements] =
      await Promise.all([
        callApi("getUserData", { usuario }),
        callApi("getMarkets", {}),
        callApi("getMyBets", { usuario }),
        callApi("getRankingSaldo", {}),
        callApi("getRankingGanancias", {}),
        callApi("getMovements", { usuario }),
      ]);

    state.user = userData.user;
    state.markets = markets.markets || [];
    state.bets = bets.bets || [];
    state.roomCombinations = bets.habitacion_combinadas || [];
    state.balanceRanking = balanceRanking.ranking || [];
    state.winningsRanking = winningsRanking.ranking || [];
    state.movements = movements.movements || [];
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.user));

    updateUserHeader();
    populateCategoryFilter();
    renderMarkets();
    renderBets();
    renderRankings();
    renderMovements();
    populateAdminMarketSelect();
    writeDashboardCache();

    if (state.currentView === "admin") {
      await refreshAdminData();
    }
  } catch (error) {
    showToast(error.message, "error");
    if (/usuario no encontrado/i.test(error.message)) logout();
  } finally {
    if (!options.silent) setLoading(false);
  }
}

function unwrapDashboardResponse(response) {
  return response?.data || response || {};
}

function applyDashboardData(data) {
  state.user = data.userData?.user || data.userData || data.user || state.user;
  state.markets = Array.isArray(data.markets) ? data.markets : data.markets?.markets || [];
  state.bets = Array.isArray(data.bets) ? data.bets : data.bets?.bets || [];
  state.roomCombinations =
    data.roomCombinations ||
    data.habitacion_combinadas ||
    data.bets?.habitacion_combinadas ||
    [];
  state.balanceRanking = Array.isArray(data.balanceRanking)
    ? data.balanceRanking
    : data.balanceRanking?.ranking || [];
  state.winningsRanking = Array.isArray(data.winningsRanking)
    ? data.winningsRanking
    : data.winningsRanking?.ranking || [];
  state.movements = Array.isArray(data.movements) ? data.movements : data.movements?.movements || [];
}

function renderDashboardData() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.user));

  updateUserHeader();
  populateCategoryFilter();
  renderMarkets();
  renderBets();
  renderRankings();
  renderMovements();
  populateAdminMarketSelect();
}

function getDashboardCacheKey(username = state.user?.usuario) {
  return `${CACHE_PREFIX}:dashboard:${normalizeText(username)}`;
}

function restoreDashboardCache() {
  if (!state.user?.usuario) return false;
  const cached = readTtlCache(getDashboardCacheKey());
  if (!cached) return false;
  applyDashboardData(cached);
  return true;
}

function writeDashboardCache() {
  if (!state.user?.usuario) return;
  writeTtlCache(getDashboardCacheKey(), {
    user: state.user,
    markets: state.markets,
    bets: state.bets,
    roomCombinations: state.roomCombinations,
    balanceRanking: state.balanceRanking,
    winningsRanking: state.winningsRanking,
    movements: state.movements,
  }, DASHBOARD_CACHE_TTL_MS);
}

function readTtlCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() > Number(parsed.expiresAt || 0)) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch (_error) {
    sessionStorage.removeItem(key);
    return null;
  }
}

function writeTtlCache(key, value, ttlMs) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        value,
        expiresAt: Date.now() + ttlMs,
      }),
    );
  } catch (_error) {
    clearClientCache();
  }
}

function clearClientCache() {
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
  });
}

function renderLoadingPlaceholders() {
  elements.marketsContainer.innerHTML = renderSkeletonList(4);
  elements.betStatCards.innerHTML = renderSkeletonList(4, "skeleton-stat");
  elements.betsContainer.innerHTML = renderSkeletonList(3);
  elements.balanceRanking.innerHTML = renderSkeletonList(4, "skeleton-row");
  elements.winningsRanking.innerHTML = renderSkeletonList(4, "skeleton-row");
  elements.movementsContainer.innerHTML = renderSkeletonList(4, "skeleton-row");
}

function renderSkeletonList(count, extraClass = "") {
  return Array.from({ length: count }, () => `<div class="skeleton ${extraClass}"></div>`).join("");
}

function applyMutationData(data = {}) {
  if (data.user) {
    state.user = data.user;
  } else if (data.saldo !== undefined && state.user) {
    state.user = { ...state.user, saldo: Number(data.saldo) };
  }

  if (data.bet) {
    state.bets = upsertById(state.bets, data.bet);
  }

  const combination = data.combinada || data.roomCombination;
  if (combination) {
    state.roomCombinations = upsertById(state.roomCombinations, combination);
  }

  if (Array.isArray(data.linked_combinations)) {
    data.linked_combinations.forEach((item) => {
      state.roomCombinations = upsertById(state.roomCombinations, item);
    });
  }

  const movements = [
    ...(Array.isArray(data.movements) ? data.movements : []),
    data.movement,
  ].filter(Boolean);
  if (movements.length) {
    state.movements = mergeById(movements, state.movements);
  }

  updateBalanceRankingFromUser();
  renderDashboardData();
  writeDashboardCache();
}

function upsertById(items, item) {
  return mergeById([item], items).sort(sortClientDateDesc);
}

function mergeById(priorityItems, existingItems) {
  const seen = new Set();
  return [...priorityItems, ...existingItems].filter((item) => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateBalanceRankingFromUser() {
  if (!state.user) return;
  const key = normalizeText(state.user.usuario);
  const withoutUser = state.balanceRanking.filter(
    (item) => normalizeText(item.usuario) !== key,
  );
  state.balanceRanking = [
    ...withoutUser,
    { usuario: state.user.usuario, saldo: Number(state.user.saldo) || 0 },
  ].sort((a, b) => Number(b.saldo) - Number(a.saldo) || a.usuario.localeCompare(b.usuario));
}

function sortClientDateDesc(a, b) {
  return new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime();
}

function updateUserHeader() {
  if (!state.user) return;
  elements.headerBalance.textContent = formatChips(state.user.saldo);
  elements.sidebarUsername.textContent = state.user.usuario;
  elements.userAvatar.textContent = state.user.usuario.charAt(0).toUpperCase();
  elements.adminNavItem.classList.toggle("is-hidden", state.user.rol !== "admin");
}

function populateCategoryFilter() {
  const current = elements.categoryFilter.value || "Todas";
  const found = new Set(state.markets.map((market) => market.categoria).filter(Boolean));
  const categories = [...CATEGORIES, ...[...found].filter((item) => !CATEGORIES.includes(item))];
  elements.categoryFilter.innerHTML = [
    '<option value="Todas">Todas las categorías</option>',
    ...categories.map(
      (category) =>
        `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`,
    ),
  ].join("");
  elements.categoryFilter.value = categories.includes(current) || current === "Todas" ? current : "Todas";
}

function renderMarkets() {
  const query = normalizeText(elements.marketSearch.value);
  const category = elements.categoryFilter.value;
  const status = elements.statusFilter.value;

  const filtered = state.markets.filter((market) => {
    const matchesQuery =
      !query ||
      normalizeText(`${market.evento} ${market.categoria} ${market.tipo}`).includes(query);
    const matchesCategory = category === "Todas" || market.categoria === category;
    const matchesStatus = status === "Todos" || market.estado === status;
    return matchesQuery && matchesCategory && matchesStatus;
  });

  const openCount = state.markets.filter((market) => market.estado === "Abierto").length;
  elements.marketsSummary.textContent = `${openCount} mercados abiertos · ${state.markets.length} en total`;

  if (!filtered.length) {
    elements.marketsContainer.innerHTML = emptyState(
      "No encontramos mercados",
      "Probá cambiando la búsqueda o los filtros.",
    );
    return;
  }

  const grouped = filtered.reduce((accumulator, market) => {
    (accumulator[market.categoria] ||= []).push(market);
    return accumulator;
  }, {});

  const orderedCategories = [
    ...CATEGORIES.filter((item) => grouped[item]),
    ...Object.keys(grouped).filter((item) => !CATEGORIES.includes(item)),
  ];

  elements.marketsContainer.innerHTML = orderedCategories
    .map(
      (categoryName) => `
        <section class="market-category">
          <div class="market-category-heading">
            <h3>${escapeHtml(categoryName)}</h3>
            <span class="market-count">${grouped[categoryName].length}</span>
          </div>
          <div class="market-grid">
            ${renderCategoryMarketCards(categoryName, grouped[categoryName])}
          </div>
        </section>
      `,
    )
    .join("");
}

function renderCategoryMarketCards(categoryName, markets) {
  const cards = [];
  let insertedRoomCombination = false;

  markets.forEach((market) => {
    cards.push(renderMarketCard(market));
    if (categoryName === "Habitaciones" && isRoomCountMarket(market)) {
      cards.push(renderRoomCombinationPanel());
      insertedRoomCombination = true;
    }
  });

  if (categoryName === "Habitaciones" && !insertedRoomCombination) {
    cards.push(renderRoomCombinationPanel());
  }

  return cards.join("");
}

function renderMarketCard(market) {
  const options = market.opciones || [];
  const cancelDeadlineBadge = renderCancelDeadlineBadge(
    market.fecha_limite_cancelacion,
  );
  const betDeadlineStatus = getBetDeadlineStatus(
    market.fecha_limite_apuesta,
  );
  const betDeadlineBadge = renderBetDeadlineBadge(
    market.fecha_limite_apuesta,
  );
  const activeMarketBets = state.bets.filter(
    (bet) =>
      String(bet.mercado_id) === String(market.id) &&
      bet.estado === "Abierta",
  );
  const lockedSides = new Set(
    activeMarketBets.map((bet) => bet.lado).filter(Boolean),
  );
  const fullyLocked =
    market.tipo !== "OVER_UNDER" && activeMarketBets.length > 0;
  const isOpen = market.estado === "Abierto";
  const acceptsBets =
    isOpen &&
    (!betDeadlineStatus.exists ||
      (betDeadlineStatus.valid && !betDeadlineStatus.expired));
  const selectedId = String(state.selectedOptions[market.id] || "");

  let optionMarkup = "";
  if (market.tipo === "OVER_UNDER") {
    optionMarkup = renderOverUnderOptions(market, options, selectedId, acceptsBets, lockedSides);
  } else {
    optionMarkup = options.length
      ? options
          .map((option) =>
            renderOptionButton(
              market,
              option,
              selectedId,
              acceptsBets && !fullyLocked && !isSelfBetOption(market, option),
              isSelfBetOption(market, option) ? "No podés apostar por vos mismo" : "",
            ),
          )
          .join("")
      : '<p class="muted">Todavía no hay opciones cargadas.</p>';
  }

  let lockMessage = "";
  if (!isOpen) {
    lockMessage = `Este mercado está ${market.estado.toLowerCase()} y no acepta apuestas.`;
  } else if (betDeadlineStatus.exists && betDeadlineStatus.expired) {
    lockMessage = "Ya venció el plazo para apostar en este mercado.";
  } else if (betDeadlineStatus.exists && !betDeadlineStatus.valid) {
    lockMessage = "La fecha límite de apuestas no es válida.";
  } else if (fullyLocked) {
    lockMessage = "Ya hiciste una apuesta en este mercado.";
  } else if (market.tipo === "OVER_UNDER" && lockedSides.size) {
    lockMessage = `Ya usaste: ${[...lockedSides].join(" y ")}.`;
  }

  const canBet =
    acceptsBets &&
    options.length > 0 &&
    !fullyLocked &&
    !(market.tipo === "OVER_UNDER" && lockedSides.size >= 2);

  return `
    <article class="market-card" data-market-card="${escapeHtml(market.id)}">
      <div class="market-card-head">
        <div class="market-meta">
          <span class="market-type">${escapeHtml(formatMarketType(market.tipo))}</span>
          <span class="status-badge status-${slugify(market.estado)}">${escapeHtml(market.estado)}</span>
        </div>
        <h4>${escapeHtml(market.evento)}</h4>
        ${cancelDeadlineBadge}
        ${betDeadlineBadge}
      </div>
      <div class="market-options">
        ${optionMarkup}
      </div>
      <div class="market-bet-footer">
        <input
          type="number"
          min="1"
          max="${Number(state.user?.saldo || 0)}"
          step="1"
          inputmode="decimal"
          placeholder="Monto"
          aria-label="Monto de la apuesta"
          data-bet-amount="${escapeHtml(market.id)}"
          ${canBet ? "" : "disabled"}
        />
        <button
          class="button button-primary"
          type="button"
          data-place-bet="${escapeHtml(market.id)}"
          ${canBet ? "" : "disabled"}
        >
          Apostar
        </button>
        ${lockMessage ? `<p class="market-lock-message">${escapeHtml(lockMessage)}</p>` : ""}
      </div>
    </article>
  `;
}

function renderRoomCombinationPanel() {
  const countMarket = getRoomCountMarket();
  const countBet = getOpenRoomCountBet();
  if (!countMarket) return "";

  const roomSize = countBet ? parseRoomSizeFromText(countBet.opcion) : 0;
  const requiredCompanions = roomSize ? roomSize - 1 : 0;
  const selectedNames = countBet ? getRoomSelection(countBet.id) : [];
  const selectedKeys = new Set(selectedNames.map(normalizeText));
  const existingCombination = countBet
    ? state.roomCombinations.find(
        (combination) =>
          String(combination.apuesta_cantidad_id) === String(countBet.id) &&
          combination.estado === "Abierta",
      )
    : null;
  const betDeadlineStatus = getBetDeadlineStatus(countMarket.fecha_limite_apuesta);
  const acceptsBets =
    countMarket.estado === "Abierto" &&
    (!betDeadlineStatus.exists ||
      (betDeadlineStatus.valid && !betDeadlineStatus.expired));
  const companionOdds = getCompanionOddsProduct(selectedNames);
  const estimatedOdds = countBet ? Number(countBet.cuota) * companionOdds : 0;
  const isUnlocked = Boolean(countBet && roomSize);
  const canSubmit =
    isUnlocked &&
    acceptsBets &&
    !existingCombination &&
    selectedNames.length === requiredCompanions;

  let lockMessage = "Primero apostá a la cantidad de personas de tu habitación para desbloquear la combinada.";
  if (isUnlocked && existingCombination) {
    lockMessage = "Ya tenés una combinada abierta vinculada a esta apuesta.";
  } else if (isUnlocked && countMarket.estado !== "Abierto") {
    lockMessage = "El mercado de cantidad ya no está abierto.";
  } else if (isUnlocked && betDeadlineStatus.exists && betDeadlineStatus.expired) {
    lockMessage = "Ya venció el plazo para apostar en este mercado.";
  } else if (isUnlocked && betDeadlineStatus.exists && !betDeadlineStatus.valid) {
    lockMessage = "La fecha límite de apuestas no es válida.";
  } else if (isUnlocked) {
    lockMessage = "";
  }

  const statusLabel = existingCombination
    ? existingCombination.estado
    : isUnlocked
      ? "Disponible"
      : "Bloqueada";
  const statusClass = existingCombination
    ? slugify(existingCombination.estado)
    : isUnlocked
      ? "abierta"
      : "bloqueada";

  return `
    <article class="market-card room-combination-card ${isUnlocked ? "" : "is-locked"}">
      <div class="market-card-head">
        <div class="market-meta">
          <span class="market-type">Habitación combinada</span>
          <span class="status-badge status-${statusClass}">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        <h4>Combinada de habitación</h4>
        ${
          isUnlocked
            ? `
              <p class="room-combination-summary">
                Elegiste habitación de ${escapeHtml(roomSize)} personas. Seleccioná exactamente ${escapeHtml(requiredCompanions)} compañeros.
              </p>
            `
            : `
              <p class="room-combination-locked-message">
                Primero apostá a la cantidad de personas de tu habitación para desbloquear la combinada.
              </p>
            `
        }
      </div>

      ${
        isUnlocked
          ? `
            <div class="room-combination-progress">
              <span>${selectedNames.length}/${requiredCompanions} seleccionados</span>
              <strong>Cuota estimada: x${formatOdds(estimatedOdds || countBet.cuota)}</strong>
            </div>

            <div class="companion-grid">
              ${ROOM_COMPANIONS.map(([name, odds]) => {
                const key = normalizeText(name);
                const isSelected = selectedKeys.has(key);
                const isSelf = key === normalizeText(state.user?.usuario);
                const capReached = selectedNames.length >= requiredCompanions && !isSelected;
                const disabled =
                  !acceptsBets ||
                  Boolean(existingCombination) ||
                  isSelf ||
                  capReached;
                return `
                  <button
                    class="companion-button ${isSelected ? "is-selected" : ""}"
                    type="button"
                    data-room-companion="${escapeHtml(name)}"
                    data-room-count-bet="${escapeHtml(countBet.id)}"
                    ${disabled ? "disabled" : ""}
                  >
                    <span>${escapeHtml(name)}</span>
                    <strong>x${formatOdds(odds)}</strong>
                  </button>
                `;
              }).join("")}
            </div>
          `
          : ""
      }

      <div class="room-combination-footer">
        <input
          type="number"
          min="1"
          max="${Number(state.user?.saldo || 0)}"
          step="1"
          inputmode="decimal"
          placeholder="Monto"
          aria-label="Monto de la combinada"
          data-room-combination-amount="${escapeHtml(countBet?.id || "")}"
          ${isUnlocked && acceptsBets && !existingCombination ? "" : "disabled"}
        />
        <button
          class="button button-primary"
          type="button"
          data-place-room-combination="${escapeHtml(countBet?.id || "")}"
          ${canSubmit ? "" : "disabled"}
        >
          Apostar combinada
        </button>
        ${lockMessage && isUnlocked ? `<p class="market-lock-message">${escapeHtml(lockMessage)}</p>` : ""}
      </div>
    </article>
  `;
}

function renderOptionButton(market, option, selectedId, enabled, note = "") {
  const isSelected = selectedId === String(option.id);
  return `
    <button
      class="option-button ${isSelected ? "is-selected" : ""} ${note ? "is-self-blocked" : ""}"
      type="button"
      data-select-option="${escapeHtml(option.id)}"
      data-market-id="${escapeHtml(market.id)}"
      ${note ? `title="${escapeHtml(note)}"` : ""}
      ${enabled ? "" : "disabled"}
    >
      <span class="option-label">
        <span class="option-name">${escapeHtml(option.opcion)}</span>
        ${note ? `<small class="option-hint">${escapeHtml(note)}</small>` : ""}
      </span>
      <span class="odds">x${formatOdds(option.cuota)}</span>
    </button>
  `;
}

function renderOverUnderOptions(market, options, selectedId, isOpen, lockedSides) {
  if (!options.length) return '<p class="muted">Todavía no hay líneas cargadas.</p>';

  const lines = options.reduce((accumulator, option) => {
    const key = String(option.linea);
    (accumulator[key] ||= {})[option.lado] = option;
    return accumulator;
  }, {});

  const sortedLines = Object.keys(lines).sort((a, b) => Number(a) - Number(b));

  return `
    <div class="over-under-wrap">
      <table class="over-under-table">
        <thead>
          <tr>
            <th>Línea</th>
            <th>Menos de</th>
            <th>Más de</th>
          </tr>
        </thead>
        <tbody>
          ${sortedLines
            .map((line) => {
              const under = lines[line]["Menos de"];
              const over = lines[line]["Más de"];
              return `
                <tr>
                  <td class="line-value">${escapeHtml(line)}</td>
                  <td>${under ? renderOverUnderButton(market, under, selectedId, isOpen, lockedSides) : "—"}</td>
                  <td>${over ? renderOverUnderButton(market, over, selectedId, isOpen, lockedSides) : "—"}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOverUnderButton(market, option, selectedId, isOpen, lockedSides) {
  const selfBetBlocked = isSelfBetOption(market, option);
  const note = selfBetBlocked ? "No podés apostar por vos mismo" : "";
  const enabled = isOpen && !lockedSides.has(option.lado) && !selfBetBlocked;
  const isSelected = selectedId === String(option.id);
  return `
    <button
      class="option-button ${isSelected ? "is-selected" : ""} ${note ? "is-self-blocked" : ""}"
      type="button"
      data-select-option="${escapeHtml(option.id)}"
      data-market-id="${escapeHtml(market.id)}"
      ${note ? `title="${escapeHtml(note)}"` : ""}
      ${enabled ? "" : "disabled"}
    >
      <span class="option-label">
        <span class="option-name">${escapeHtml(option.lado)}</span>
        ${note ? `<small class="option-hint">${escapeHtml(note)}</small>` : ""}
      </span>
      <span class="odds">x${formatOdds(option.cuota)}</span>
    </button>
  `;
}

async function handleMarketClick(event) {
  const companionButton = event.target.closest("[data-room-companion]");
  if (companionButton) {
    const betId = companionButton.dataset.roomCountBet;
    const companion = companionButton.dataset.roomCompanion;
    const countBet = state.bets.find((bet) => String(bet.id) === String(betId));
    const roomSize = parseRoomSizeFromText(countBet?.opcion);
    const requiredCompanions = roomSize ? roomSize - 1 : 0;
    const current = getRoomSelection(betId);
    const key = normalizeText(companion);
    const exists = current.some((name) => normalizeText(name) === key);

    if (exists) {
      state.roomSelections[betId] = current.filter((name) => normalizeText(name) !== key);
    } else if (current.length < requiredCompanions) {
      state.roomSelections[betId] = [...current, companion];
    }
    renderMarkets();
    return;
  }

  const roomCombinationButton = event.target.closest("[data-place-room-combination]");
  if (roomCombinationButton) {
    const betId = roomCombinationButton.dataset.placeRoomCombination;
    const countBet = state.bets.find((bet) => String(bet.id) === String(betId));
    const roomSize = parseRoomSizeFromText(countBet?.opcion);
    const requiredCompanions = roomSize ? roomSize - 1 : 0;
    const companions = getRoomSelection(betId);
    const amountInput = elements.marketsContainer.querySelector(
      `[data-room-combination-amount="${cssEscape(betId)}"]`,
    );
    const monto = Number(amountInput?.value);

    if (!countBet || countBet.estado !== "Abierta") {
      showToast("Primero necesitás una apuesta abierta a la cantidad de personas.", "error");
      return;
    }
    if (companions.length !== requiredCompanions) {
      showToast(`Seleccioná exactamente ${requiredCompanions} compañeros.`, "error");
      return;
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      showToast("Ingresá un monto mayor a cero.", "error");
      return;
    }
    if (monto > Number(state.user?.saldo || 0)) {
      showToast("Saldo insuficiente.", "error");
      return;
    }

    try {
      setActionBusy(roomCombinationButton, true, "Registrando...");
      setLoading(true);
      const data = await callApi("placeHabitacionCombinada", {
        usuario: state.user.usuario,
        apuesta_cantidad_id: betId,
        companeros: companions,
        monto,
      });
      delete state.roomSelections[betId];
      showToast(data.message || "Combinada registrada.", "success");
      if (data.combinada || data.roomCombination) {
        applyMutationData(data);
      } else {
        clearClientCache();
        await refreshAll({ silent: true });
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
      setActionBusy(roomCombinationButton, false);
    }
    return;
  }

  const optionButton = event.target.closest("[data-select-option]");
  if (optionButton) {
    const marketId = optionButton.dataset.marketId;
    state.selectedOptions[marketId] = optionButton.dataset.selectOption;
    renderMarkets();
    return;
  }

  const betButton = event.target.closest("[data-place-bet]");
  if (!betButton) return;

  const marketId = betButton.dataset.placeBet;
  const optionId = state.selectedOptions[marketId];
  const amountInput = elements.marketsContainer.querySelector(
    `[data-bet-amount="${cssEscape(marketId)}"]`,
  );
  const monto = Number(amountInput?.value);

  if (!optionId) {
    showToast("Elegí una opción antes de apostar.", "error");
    return;
  }
  const market = state.markets.find((item) => String(item.id) === String(marketId));
  const option = market?.opciones?.find((item) => String(item.id) === String(optionId));
  if (market && option && isSelfBetOption(market, option)) {
    showToast("No podés apostar por vos mismo en este mercado.", "error");
    return;
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    showToast("Ingresá un monto mayor a cero.", "error");
    return;
  }

  try {
    setActionBusy(betButton, true, "Apostando...");
    setLoading(true);
    const data = await callApi("placeBet", {
      usuario: state.user.usuario,
      mercado_id: marketId,
      opcion_id: optionId,
      monto,
    });
    delete state.selectedOptions[marketId];
    showToast(data.message || "Apuesta registrada.", "success");
    if (data.bet) {
      applyMutationData(data);
    } else {
      clearClientCache();
      await refreshAll({ silent: true });
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(false);
    setActionBusy(betButton, false);
  }
}

function getDisplayBets() {
  const normalBets = state.bets.map((bet) => ({
    ...bet,
    tipo_apuesta: bet.tipo_apuesta || "NORMAL",
    cuota: Number(bet.cuota),
  }));
  const roomCombinationBets = state.roomCombinations.map((combination) => ({
    ...combination,
    id: `habitacion-${combination.id}`,
    raw_id: combination.id,
    mercado_id: combination.mercado_cantidad_id,
    evento: combination.evento || "Combinada de habitación",
    opcion:
      combination.opcion ||
      `${combination.cantidad_personas} personas · ${combination.companeros_text || ""}`,
    cuota: Number(combination.cuota_total),
    tipo_apuesta: "HABITACION_COMBINADA",
  }));

  return [...normalBets, ...roomCombinationBets].sort(
    (a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime(),
  );
}

function renderBets() {
  const displayBets = getDisplayBets();
  const statusCounts = {
    Abierta: 0,
    Ganada: 0,
    Perdida: 0,
    Devuelta: 0,
  };
  displayBets.forEach((bet) => {
    if (statusCounts[bet.estado] !== undefined) statusCounts[bet.estado] += 1;
  });

  const potential = displayBets
    .filter((bet) => bet.estado === "Abierta")
    .reduce((sum, bet) => sum + Number(bet.monto) * Number(bet.cuota), 0);

  elements.betStatCards.innerHTML = [
    ["Abiertas", statusCounts.Abierta],
    ["Ganadas", statusCounts.Ganada],
    ["Perdidas", statusCounts.Perdida],
    ["Pago potencial", formatChips(potential)],
  ]
    .map(
      ([label, value]) => `
        <div class="stat-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");

  const filtered =
    state.betStatus === "Todas"
      ? displayBets
      : displayBets.filter((bet) => bet.estado === state.betStatus);

  if (!filtered.length) {
    elements.betsContainer.innerHTML = emptyState(
      "No hay apuestas en esta sección",
      "Cuando hagas una jugada, va a aparecer acá.",
    );
    return;
  }

  elements.betsContainer.innerHTML = filtered
    .map((bet) => {
      const isRoomCombination = bet.tipo_apuesta === "HABITACION_COMBINADA";
      const potentialPayment = Number(bet.monto) * Number(bet.cuota);
      const market = state.markets.find(
        (item) =>
          String(item.id) ===
          String(isRoomCombination ? bet.mercado_cantidad_id : bet.mercado_id),
      );
      const deadlineStatus = getCancelDeadlineStatus(
        market?.fecha_limite_cancelacion,
      );
      const otherwiseCancelable =
        !isRoomCombination &&
        bet.estado === "Abierta" &&
        market &&
        market.estado === "Abierto";
      const canCancel =
        otherwiseCancelable &&
        (!deadlineStatus.exists ||
          (deadlineStatus.valid && !deadlineStatus.expired));
      const deadlineBlocksCancellation =
        otherwiseCancelable &&
        deadlineStatus.exists &&
        (!deadlineStatus.valid || deadlineStatus.expired);
      return `
        <article class="bet-card">
          <div class="bet-card-title">
            <strong>${escapeHtml(bet.evento || `Mercado #${bet.mercado_id}`)}</strong>
            <small>${escapeHtml(bet.opcion)} · ${formatDate(bet.fecha)}</small>
            ${renderCancelDeadlineBadge(market?.fecha_limite_cancelacion)}
            ${renderBetDeadlineBadge(market?.fecha_limite_apuesta)}
          </div>
          <div class="bet-metric">
            <span>Monto</span>
            <strong>${formatChips(bet.monto)}</strong>
          </div>
          <div class="bet-metric">
            <span>${isRoomCombination ? "Cuota total" : "Cuota"}</span>
            <strong>x${formatOdds(bet.cuota)}</strong>
          </div>
          <div class="bet-metric">
            <span>Pago potencial</span>
            <strong>${formatChips(potentialPayment)}</strong>
          </div>
          <div class="bet-card-actions">
            <span class="bet-status bet-status-${slugify(bet.estado)}">${escapeHtml(bet.estado)}</span>
            ${
              canCancel
                ? `
                  <button
                    class="button button-danger button-small"
                    type="button"
                    data-cancel-bet="${escapeHtml(bet.id)}"
                  >
                    Cancelar apuesta
                  </button>
                `
                : deadlineBlocksCancellation
                  ? `
                    <button
                      class="button button-danger button-small"
                      type="button"
                      disabled
                    >
                      Cancelar apuesta
                    </button>
                    <small class="cancel-disabled-reason">
                      ${deadlineStatus.expired ? "Venció el plazo de cancelación" : "Fecha límite inválida"}
                    </small>
                  `
                : ""
            }
            ${
              isRoomCombination && bet.estado === "Abierta"
                ? '<small class="cancel-disabled-reason">Se devuelve si cancelás la apuesta de cantidad vinculada.</small>'
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

async function handleBetClick(event) {
  const cancelButton = event.target.closest("[data-cancel-bet]");
  if (!cancelButton) return;

  const confirmed = window.confirm(
    "¿Seguro que querés cancelar esta apuesta? Se te devolverán las fichas apostadas.",
  );
  if (!confirmed) return;

  try {
    setActionBusy(cancelButton, true, "Cancelando...");
    setLoading(true);
    const data = await callApi("cancelBet", {
      usuario: state.user.usuario,
      apuesta_id: cancelButton.dataset.cancelBet,
    });
    showToast(data.message || "Apuesta cancelada y fichas devueltas.", "success");
    if (data.bet) {
      applyMutationData(data);
    } else {
      clearClientCache();
      await refreshAll({ silent: true });
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(false);
    setActionBusy(cancelButton, false);
  }
}

function renderRankings() {
  elements.balanceRanking.innerHTML = renderRankingList(
    state.balanceRanking,
    (item) => formatChips(item.saldo),
  );
  elements.winningsRanking.innerHTML = renderRankingList(
    state.winningsRanking,
    (item) => formatChips(item.ganancias),
  );
}

function renderRankingList(items, valueFormatter) {
  if (!items.length) return emptyState("Todavía no hay ranking", "Registrá usuarios para empezar.");
  return `
    <div class="ranking-list">
      ${items
        .map(
          (item, index) => `
            <div class="ranking-row">
              <span class="rank-number">${index + 1}</span>
              <span class="ranking-user">${escapeHtml(item.usuario)}</span>
              <span class="ranking-value">${valueFormatter(item)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderMovements() {
  if (!state.movements.length) {
    elements.movementsContainer.innerHTML = emptyState(
      "Sin movimientos",
      "Tu registro de fichas aparecerá acá.",
    );
    return;
  }

  elements.movementsContainer.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Monto</th>
            <th>Descripción</th>
          </tr>
        </thead>
        <tbody>
          ${state.movements
            .map((movement) => {
              const amount = Number(movement.monto);
              return `
                <tr>
                  <td>${formatDate(movement.fecha)}</td>
                  <td><span class="movement-type">${escapeHtml(movement.tipo)}</span></td>
                  <td class="${amount >= 0 ? "amount-positive" : "amount-negative"}">
                    ${amount >= 0 ? "+" : ""}${formatChips(amount)}
                  </td>
                  <td>${escapeHtml(movement.descripcion)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function syncAdminView() {
  const hasToken = Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY));
  elements.adminLoginCard.classList.toggle("is-hidden", hasToken);
  elements.adminDashboard.classList.toggle("is-hidden", !hasToken);
  if (hasToken) refreshAdminData();
}

async function handleAdminLogin(event) {
  event.preventDefault();

  try {
    setLoading(true);
    const data = await callApi("adminLogin", {
      usuario: state.user.usuario,
      password: elements.adminPassword.value,
    });
    sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    elements.adminLoginForm.reset();
    showToast("Panel de administración desbloqueado.", "success");
    syncAdminView();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

async function refreshAdminData() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token || state.user?.rol !== "admin") return;

  try {
    const data = await callApi("adminGetAllBets", {
      usuario: state.user.usuario,
      admin_token: token,
    });
    state.adminBets = data.bets || [];
    state.adminRoomCombinations = data.habitacion_combinadas || [];
    renderAdminMarkets();
    renderAdminBets();
  } catch (error) {
    if (/sesión de administrador|token/i.test(error.message)) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      syncAdminView();
    }
    showToast(error.message, "error");
  }
}

function populateAdminMarketSelect() {
  const current = elements.adminOptionMarket.value;
  elements.adminOptionMarket.innerHTML = state.markets
    .filter((market) => !["Resuelto", "Cancelado"].includes(market.estado))
    .map(
      (market) =>
        `<option value="${escapeHtml(market.id)}">#${escapeHtml(market.id)} · ${escapeHtml(market.evento)}</option>`,
    )
    .join("");
  if ([...elements.adminOptionMarket.options].some((option) => option.value === current)) {
    elements.adminOptionMarket.value = current;
  }
}

async function handleCreateMarket(event) {
  event.preventDefault();
  await runAdminAction(
    "adminCreateMarket",
    {
      categoria: elements.adminMarketCategory.value,
      evento: elements.adminMarketEvent.value.trim(),
      tipo: elements.adminMarketType.value,
    },
    "Mercado creado.",
  );
  elements.createMarketForm.reset();
}

async function handleCreateOption(event) {
  event.preventDefault();
  const lineaValue = elements.adminOptionLine.value;
  await runAdminAction(
    "adminCreateOption",
    {
      mercado_id: elements.adminOptionMarket.value,
      opcion: elements.adminOptionName.value.trim(),
      linea: lineaValue === "" ? "" : Number(lineaValue),
      lado: elements.adminOptionSide.value,
      cuota: Number(elements.adminOptionOdds.value),
    },
    "Opción agregada.",
  );
  elements.createOptionForm.reset();
}

function renderAdminMarkets() {
  if (!state.markets.length) {
    elements.adminMarketsContainer.innerHTML = emptyState(
      "No hay mercados",
      "Creá el primero desde el formulario.",
    );
    return;
  }

  elements.adminMarketsContainer.innerHTML = state.markets
    .map((market) => {
      const options = market.opciones || [];
      const actionable = !["Resuelto", "Cancelado"].includes(market.estado);
      const selfBetAllowed = marketAllowsSelfBet(market);
      return `
        <div class="admin-market-item">
          <div class="admin-market-summary">
            <div>
              <strong>#${escapeHtml(market.id)} · ${escapeHtml(market.evento)}</strong>
              <small>${escapeHtml(market.categoria)} · ${escapeHtml(formatMarketType(market.tipo))} · ${escapeHtml(market.estado)}</small>
            </div>
            <div class="admin-market-actions">
              <button
                class="button button-secondary button-small"
                type="button"
                data-admin-close="${escapeHtml(market.id)}"
                ${market.estado === "Abierto" ? "" : "disabled"}
              >
                Cerrar
              </button>
              <button
                class="button button-danger button-small"
                type="button"
                data-admin-cancel="${escapeHtml(market.id)}"
                ${actionable ? "" : "disabled"}
              >
                Cancelar
              </button>
            </div>
          </div>
          <div class="admin-options">
            <div class="admin-cancel-deadline-row">
              <label>
                Límite para cancelar apuestas
                <input
                  type="datetime-local"
                  value="${escapeHtml(formatDateTimeLocal(market.fecha_limite_cancelacion))}"
                  data-admin-cancel-deadline-input="${escapeHtml(market.id)}"
                  ${actionable ? "" : "disabled"}
                />
              </label>
              <button
                class="button button-secondary button-small"
                type="button"
                data-admin-update-cancel-deadline="${escapeHtml(market.id)}"
                ${actionable ? "" : "disabled"}
              >
                Guardar límite de cancelación
              </button>
            </div>
            <div class="admin-bet-deadline-row">
              <label>
                Límite para realizar apuestas
                <input
                  type="datetime-local"
                  value="${escapeHtml(formatDateTimeLocal(market.fecha_limite_apuesta))}"
                  data-admin-bet-deadline-input="${escapeHtml(market.id)}"
                  ${actionable ? "" : "disabled"}
                />
              </label>
              <button
                class="button button-secondary button-small"
                type="button"
                data-admin-update-bet-deadline="${escapeHtml(market.id)}"
                ${actionable ? "" : "disabled"}
              >
                Guardar límite de apuestas
              </button>
            </div>
            <div class="admin-self-bet-row">
              <span>Apuesta propia: ${selfBetAllowed ? "permitida" : "bloqueada"}</span>
              <button
                class="button button-secondary button-small"
                type="button"
                data-admin-toggle-self-bet="${escapeHtml(market.id)}"
                data-admin-self-bet-next="${selfBetAllowed ? "false" : "true"}"
                ${actionable ? "" : "disabled"}
              >
                ${selfBetAllowed ? "Bloquear apuesta propia" : "Permitir apuesta propia"}
              </button>
            </div>
            ${
              options.length
                ? options
                    .map(
                      (option) => `
                        <div class="admin-option-row">
                          <span>${escapeHtml(option.opcion)}</span>
                          <input
                            type="number"
                            min="1"
                            step="0.001"
                            value="${escapeHtml(option.cuota)}"
                            aria-label="Nueva cuota para ${escapeHtml(option.opcion)}"
                            data-admin-odds-input="${escapeHtml(option.id)}"
                            ${actionable ? "" : "disabled"}
                          />
                          <button
                            class="button button-secondary button-small"
                            type="button"
                            data-admin-update-odds="${escapeHtml(option.id)}"
                            ${actionable ? "" : "disabled"}
                          >
                            Guardar
                          </button>
                        </div>
                      `,
                    )
                    .join("")
                : '<p class="muted">Sin opciones.</p>'
            }
            <div class="admin-resolution">
              <select data-admin-winner="${escapeHtml(market.id)}" ${actionable && options.length ? "" : "disabled"}>
                <option value="">Elegí la opción ganadora</option>
                ${options
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}">${escapeHtml(option.opcion)}</option>`,
                  )
                  .join("")}
              </select>
              <button
                class="button button-primary button-small"
                type="button"
                data-admin-resolve="${escapeHtml(market.id)}"
                ${actionable && options.length ? "" : "disabled"}
              >
                Resolver mercado
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

async function handleAdminMarketClick(event) {
  const betDeadlineButton = event.target.closest(
    "[data-admin-update-bet-deadline]",
  );
  if (betDeadlineButton) {
    const marketId = betDeadlineButton.dataset.adminUpdateBetDeadline;
    const input = elements.adminMarketsContainer.querySelector(
      `[data-admin-bet-deadline-input="${cssEscape(marketId)}"]`,
    );
    await runAdminAction(
      "adminUpdateBetDeadline",
      {
        mercado_id: marketId,
        fecha_limite_apuesta: input.value,
      },
      "Fecha límite de apuestas actualizada.",
    );
    return;
  }

  const deadlineButton = event.target.closest(
    "[data-admin-update-cancel-deadline]",
  );
  if (deadlineButton) {
    const marketId = deadlineButton.dataset.adminUpdateCancelDeadline;
    const input = elements.adminMarketsContainer.querySelector(
      `[data-admin-cancel-deadline-input="${cssEscape(marketId)}"]`,
    );
    await runAdminAction(
      "adminUpdateCancelDeadline",
      {
        mercado_id: marketId,
        fecha_limite_cancelacion: input.value,
      },
      "Fecha límite de cancelación actualizada.",
    );
    return;
  }

  const selfBetButton = event.target.closest("[data-admin-toggle-self-bet]");
  if (selfBetButton) {
    await runAdminAction(
      "adminToggleSelfBet",
      {
        mercado_id: selfBetButton.dataset.adminToggleSelfBet,
        permitir_apuesta_propia: selfBetButton.dataset.adminSelfBetNext === "true",
      },
      "Configuración de apuesta propia actualizada.",
    );
    return;
  }

  const updateButton = event.target.closest("[data-admin-update-odds]");
  if (updateButton) {
    const optionId = updateButton.dataset.adminUpdateOdds;
    const input = elements.adminMarketsContainer.querySelector(
      `[data-admin-odds-input="${cssEscape(optionId)}"]`,
    );
    await runAdminAction(
      "adminUpdateOdds",
      { opcion_id: optionId, cuota: Number(input.value) },
      "Cuota actualizada.",
    );
    return;
  }

  const closeButton = event.target.closest("[data-admin-close]");
  if (closeButton) {
    await runAdminAction(
      "adminCloseMarket",
      { mercado_id: closeButton.dataset.adminClose },
      "Mercado cerrado.",
    );
    return;
  }

  const cancelButton = event.target.closest("[data-admin-cancel]");
  if (cancelButton) {
    const marketId = cancelButton.dataset.adminCancel;
    if (!window.confirm("¿Cancelar este mercado y devolver todas las apuestas abiertas?")) return;
    await runAdminAction(
      "adminCancelMarket",
      { mercado_id: marketId },
      "Mercado cancelado y apuestas devueltas.",
    );
    return;
  }

  const resolveButton = event.target.closest("[data-admin-resolve]");
  if (resolveButton) {
    const marketId = resolveButton.dataset.adminResolve;
    const select = elements.adminMarketsContainer.querySelector(
      `[data-admin-winner="${cssEscape(marketId)}"]`,
    );
    if (!select.value) {
      showToast("Elegí una opción ganadora.", "error");
      return;
    }
    if (!window.confirm("¿Resolver el mercado? Esta acción acredita pagos y no se puede repetir.")) return;
    await runAdminAction(
      "adminResolveMarket",
      { mercado_id: marketId, opcion_id_ganadora: select.value },
      "Mercado resuelto y pagos acreditados.",
    );
  }
}

async function runAdminAction(action, payload, successMessage) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    syncAdminView();
    return;
  }
  const activeButton = document.activeElement?.closest?.("button");

  try {
    setActionBusy(activeButton, true, "Procesando...");
    setLoading(true);
    const data = await callApi(action, {
      ...payload,
      usuario: state.user.usuario,
      admin_token: token,
    });
    showToast(data.message || successMessage, "success");
    clearClientCache();
    await refreshAll({ silent: true });
  } catch (error) {
    if (/sesión de administrador|token/i.test(error.message)) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      syncAdminView();
    }
    showToast(error.message, "error");
  } finally {
    setLoading(false);
    setActionBusy(activeButton, false);
  }
}

function renderAdminBets() {
  if (!state.adminBets.length && !state.adminRoomCombinations.length) {
    elements.adminBetsContainer.innerHTML = emptyState(
      "Todavía no hay apuestas",
      "Las apuestas de todos los usuarios aparecerán acá.",
    );
    return;
  }

  const normalBetsTable = state.adminBets.length
    ? `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Mercado</th>
              <th>Opción</th>
              <th>Monto</th>
              <th>Cuota</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${state.adminBets
              .map(
                (bet) => `
                  <tr>
                    <td>${escapeHtml(bet.usuario)}</td>
                    <td>${escapeHtml(bet.evento || `#${bet.mercado_id}`)}</td>
                    <td>${escapeHtml(bet.opcion)}</td>
                    <td>${formatChips(bet.monto)}</td>
                    <td>x${formatOdds(bet.cuota)}</td>
                    <td><span class="bet-status bet-status-${slugify(bet.estado)}">${escapeHtml(bet.estado)}</span></td>
                    <td>${formatDate(bet.fecha)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : emptyState("Sin apuestas normales", "Las apuestas simples aparecerán acá.");

  elements.adminBetsContainer.innerHTML = `
    ${normalBetsTable}
    ${renderAdminRoomCombinations()}
  `;
}

function renderAdminRoomCombinations() {
  const openCount = state.adminRoomCombinations.filter(
    (combination) => combination.estado === "Abierta",
  ).length;
  const tableMarkup = state.adminRoomCombinations.length
    ? `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Cantidad</th>
              <th>Compañeros</th>
              <th>Monto</th>
              <th>Cuota total</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${state.adminRoomCombinations
              .map(
                (combination) => `
                  <tr>
                    <td>${escapeHtml(combination.usuario)}</td>
                    <td>${escapeHtml(combination.cantidad_personas)} personas</td>
                    <td>${escapeHtml(combination.companeros_text || "")}</td>
                    <td>${formatChips(combination.monto)}</td>
                    <td>x${formatOdds(combination.cuota_total)}</td>
                    <td><span class="bet-status bet-status-${slugify(combination.estado)}">${escapeHtml(combination.estado)}</span></td>
                    <td>${formatDate(combination.fecha)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : emptyState("Sin combinadas de habitación", "Aparecerán cuando alguien apueste una combinada.");

  return `
    <section class="admin-room-combinations">
      <div class="admin-room-heading">
        <div>
          <h4>Combinadas de habitación</h4>
          <small>${openCount} abiertas</small>
        </div>
      </div>
      <div class="admin-room-resolve">
        <label>
          Cantidad real
          <input data-admin-room-real-count type="number" min="3" max="10" step="1" placeholder="5" ${openCount ? "" : "disabled"} />
        </label>
        <label>
          Compañeros reales
          <textarea data-admin-room-real-companions rows="2" placeholder="Nico, Juanpi, Fran, Pipita" ${openCount ? "" : "disabled"}></textarea>
        </label>
        <button
          class="button button-primary button-small"
          type="button"
          data-admin-resolve-room-combinations
          ${openCount ? "" : "disabled"}
        >
          Resolver combinadas
        </button>
      </div>
      ${tableMarkup}
    </section>
  `;
}

async function handleAdminBetsClick(event) {
  const resolveButton = event.target.closest("[data-admin-resolve-room-combinations]");
  if (!resolveButton) return;

  const countInput = elements.adminBetsContainer.querySelector("[data-admin-room-real-count]");
  const companionsInput = elements.adminBetsContainer.querySelector("[data-admin-room-real-companions]");
  const count = Number(countInput?.value);
  const companions = companionsInput?.value.trim() || "";

  if (!Number.isInteger(count) || count < 3 || count > 10) {
    showToast("Ingresá una cantidad real entre 3 y 10.", "error");
    return;
  }
  if (!companions) {
    showToast("Ingresá la lista real de compañeros.", "error");
    return;
  }
  if (!window.confirm("¿Resolver todas las combinadas abiertas de habitación?")) return;

  await runAdminAction(
    "adminResolveHabitacionCombinadas",
    {
      cantidad_real: count,
      companeros_reales: companions,
    },
    "Combinadas de habitación resueltas.",
  );
}

async function callApi(action, payload = {}) {
  if (!API_URL || API_URL.includes("PEGA_AQUI")) {
    throw new Error(
      "Falta configurar API_URL en app.js con la URL /exec de Google Apps Script.",
    );
  }

  const measurementLabel = startApiMeasure(action);
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch (_error) {
    endApiMeasure(measurementLabel);
    throw new Error("No se pudo conectar con Apps Script. Revisá la URL y el despliegue.");
  }

  if (!response.ok) {
    endApiMeasure(measurementLabel);
    throw new Error(`La API respondió con estado ${response.status}.`);
  }

  let result;
  try {
    result = await response.json();
  } catch (_error) {
    endApiMeasure(measurementLabel);
    throw new Error("La API no devolvió JSON válido. Revisá el despliegue de Apps Script.");
  }

  if (!result.success) {
    endApiMeasure(measurementLabel);
    throw new Error(result.error || "Ocurrió un error inesperado.");
  }

  endApiMeasure(measurementLabel);
  return {
    ...(result.data || {}),
    message: result.message || "",
  };
}

function startApiMeasure(action) {
  if (!isPerfEnabled()) return "";
  const label = `api:${action} #${++state.requestSequence}`;
  console.time(label);
  return label;
}

function endApiMeasure(label) {
  if (label) console.timeEnd(label);
}

function isPerfEnabled() {
  const configured = localStorage.getItem(PERF_STORAGE_KEY);
  if (configured === "0") return false;
  if (configured === "1") return true;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function setLoading(visible) {
  state.loadingCount = Math.max(0, state.loadingCount + (visible ? 1 : -1));
  elements.loadingOverlay.classList.toggle("is-hidden", state.loadingCount === 0);
}

function setActionBusy(button, busy, label = "Procesando...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = label;
    return;
  }
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
  button.disabled = false;
  button.removeAttribute("aria-busy");
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "error" ? "!" : "✓"}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  elements.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4300);
}

function toggleSidebar() {
  const open = !elements.sidebar.classList.contains("is-open");
  elements.sidebar.classList.toggle("is-open", open);
  elements.sidebarBackdrop.classList.toggle("is-visible", open);
}

function closeSidebar() {
  elements.sidebar.classList.remove("is-open");
  elements.sidebarBackdrop.classList.remove("is-visible");
}

function getRoomCountMarket() {
  return state.markets.find(isRoomCountMarket);
}

function isRoomCountMarket(market) {
  return (
    normalizeText(market?.categoria) === normalizeText("Habitaciones") &&
    normalizeText(market?.evento) === normalizeText(ROOM_COUNT_EVENT)
  );
}

function getOpenRoomCountBet() {
  const countMarket = getRoomCountMarket();
  if (!countMarket) return null;
  return state.bets.find(
    (bet) =>
      String(bet.mercado_id) === String(countMarket.id) &&
      bet.estado === "Abierta",
  );
}

function parseRoomSizeFromText(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getRoomSelection(betId) {
  return state.roomSelections[betId] || [];
}

function getCompanionOddsProduct(names) {
  return names.reduce((product, name) => {
    const companion = ROOM_COMPANIONS.find(
      ([companionName]) => normalizeText(companionName) === normalizeText(name),
    );
    return product * Number(companion?.[1] || 1);
  }, 1);
}

function emptyState(title, message) {
  return `
    <div class="empty-state">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(message)}</span>
      </div>
    </div>
  `;
}

function formatChips(value) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatOdds(value) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatCancelDeadline(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
}

function formatDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
}

function getCancelDeadlineStatus(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { exists: false, valid: true, expired: false, formatted: "" };
  }
  const date = new Date(value);
  const valid = !Number.isNaN(date.getTime());
  return {
    exists: true,
    valid,
    expired: valid && Date.now() > date.getTime(),
    formatted: valid ? formatCancelDeadline(date) : "",
  };
}

function renderCancelDeadlineBadge(value) {
  const status = getCancelDeadlineStatus(value);
  if (!status.exists) return "";
  if (!status.valid) {
    return '<span class="cancel-deadline-badge is-expired">Fecha límite de cancelación inválida</span>';
  }
  const label = status.expired
    ? "Plazo de cancelación vencido"
    : "Cancelación disponible hasta";
  return `
    <span class="cancel-deadline-badge ${status.expired ? "is-expired" : ""}">
      ${label}: ${escapeHtml(status.formatted)}
    </span>
  `;
}

function getBetDeadlineStatus(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { exists: false, valid: true, expired: false, formatted: "" };
  }
  const date = new Date(value);
  const valid = !Number.isNaN(date.getTime());
  return {
    exists: true,
    valid,
    expired: valid && Date.now() > date.getTime(),
    formatted: valid ? formatCancelDeadline(date) : "",
  };
}

function renderBetDeadlineBadge(value) {
  const status = getBetDeadlineStatus(value);
  if (!status.exists) return "";
  if (!status.valid) {
    return '<span class="bet-deadline-badge is-expired">Fecha límite de apuestas inválida</span>';
  }
  const label = status.expired
    ? "Plazo de apuestas vencido"
    : "Apuestas disponibles hasta";
  return `
    <span class="bet-deadline-badge ${status.expired ? "is-expired" : ""}">
      ${label}: ${escapeHtml(status.formatted)}
    </span>
  `;
}

function formatMarketType(type) {
  return (
    {
      SI_NO: "Sí / No",
      NOMBRE: "Opción / Nombre",
      OVER_UNDER: "Más / Menos",
      HABITACION_COMBINADA: "Habitación combinada",
    }[type] || type
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function marketAllowsSelfBet(market) {
  if (market?.permitir_apuesta_propia === true) return true;
  if (market?.permitir_apuesta_propia === false) return false;
  const value = normalizeText(market?.permitir_apuesta_propia);
  return ["true", "si", "1", "yes"].includes(value);
}

function isSelfBetOption(market, option) {
  return (
    !marketAllowsSelfBet(market) &&
    normalizeText(option?.opcion) === normalizeText(state.user?.usuario)
  );
}

function slugify(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function readStorage(key, storage) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch (_error) {
    storage.removeItem(key);
    return null;
  }
}
