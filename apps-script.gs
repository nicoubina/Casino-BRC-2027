/**
 * CASINO BRC - ANTO CAPUTO
 * Backend para Google Apps Script + Google Sheets.
 *
 * 1) Pegá el ID de tu Google Sheet.
 * 2) Ejecutá setupCasino() una vez desde el editor.
 * 3) Desplegá como Aplicación web.
 */

const SPREADSHEET_ID = "https://script.google.com/macros/s/AKfycby_ZdrJDTGVAT-lB9yLComJUe65fGOtoyqwZfp34jXrstWs45LNP2ZceeO30B9t5Qsq/exec";

const SHEETS = {
  CONFIG: "Config",
  USERS: "Usuarios",
  MARKETS: "Mercados",
  OPTIONS: "Opciones",
  BETS: "Apuestas",
  ROOM_COMBINATIONS: "HabitacionCombinadas",
  RESULTS: "Resultados",
  MOVEMENTS: "Movimientos",
};

const HEADERS = {
  Config: ["clave", "valor"],
  Usuarios: ["id", "usuario", "saldo", "rol", "fecha_registro"],
  Mercados: [
    "id",
    "categoria",
    "evento",
    "tipo",
    "estado",
    "fecha_creacion",
    "fecha_limite_cancelacion",
    "fecha_limite_apuesta",
    "permitir_apuesta_propia",
  ],
  Opciones: ["id", "mercado_id", "opcion", "linea", "lado", "cuota"],
  Apuestas: [
    "id",
    "usuario",
    "mercado_id",
    "opcion_id",
    "opcion",
    "tipo_mercado",
    "lado",
    "linea",
    "monto",
    "cuota",
    "estado",
    "pago",
    "fecha",
  ],
  HabitacionCombinadas: [
    "id",
    "usuario",
    "mercado_cantidad_id",
    "apuesta_cantidad_id",
    "cantidad_personas",
    "companeros_json",
    "cuota_cantidad",
    "cuota_companeros",
    "cuota_total",
    "monto",
    "estado",
    "pago",
    "fecha",
  ],
  Resultados: ["mercado_id", "resultado", "opcion_id_ganadora", "fecha_resolucion"],
  Movimientos: ["id", "usuario", "tipo", "monto", "descripcion", "fecha"],
};

const MARKET_TYPES = ["SI_NO", "NOMBRE", "OVER_UNDER", "HABITACION_COMBINADA"];
const MARKET_STATES = ["Abierto", "Cerrado", "Resuelto", "Cancelado"];
const CATEGORY_ORDER = ["Viaje", "Habitaciones", "Wachineadas", "Quebrados", "Minas", "Peleas", "Especiales"];
const ADMIN_SESSION_SECONDS = 21600;
const DATA_CACHE_SECONDS = 45;
const DATA_CACHE_KEYS = {
  MARKETS: "casino_markets_v4",
  BALANCE_RANKING: "casino_balance_ranking_v2",
  WINNINGS_RANKING: "casino_winnings_ranking_v2",
};
const ALLOWED_USERS = ["Capu", "Nico", "Juanpi", "Fran", "Jane"];
const ROOM_CATEGORY = "Habitaciones";
const ROOM_COUNT_EVENT = "¿Cuántas personas habrá en tu habitación?";
const ROOM_COMBINATION_EVENT = "Combinada de habitación";
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

let databaseInstance_ = null;
let sheetInstanceCache_ = {};
let headerIndexCache_ = {};

function doGet(e) {
  const payload = Object.assign({}, (e && e.parameter) || {});
  return routeRequest_(payload);
}

function doPost(e) {
  let payload = {};
  try {
    const raw = e && e.postData ? e.postData.contents : "";
    payload = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return jsonOutput_({ success: false, error: "El cuerpo enviado no es JSON válido." });
  }
  return routeRequest_(payload);
}

function routeRequest_(payload) {
  try {
    const action = String(payload.action || "").trim();
    if (!action) throw new Error("Falta indicar la acción.");

    const handlers = {
      register: register_,
      login: login_,
      getConfig: getPublicConfig_,
      getUserData: getUserData_,
      getMarkets: getMarkets_,
      getDashboardData: getDashboardData_,
      placeBet: placeBet_,
      placeHabitacionCombinada: placeHabitacionCombinada_,
      cancelBet: cancelBet_,
      getMyBets: getMyBets_,
      getRankingSaldo: getBalanceRanking_,
      getRankingGanancias: getWinningsRanking_,
      getMovements: getMovements_,
      adminLogin: adminLogin_,
      adminCreateMarket: adminCreateMarket_,
      adminCreateOption: adminCreateOption_,
      adminUpdateOdds: adminUpdateOdds_,
      adminUpdateCancelDeadline: adminUpdateCancelDeadline_,
      adminUpdateBetDeadline: adminUpdateBetDeadline_,
      adminToggleSelfBet: adminToggleSelfBet_,
      adminCloseMarket: adminCloseMarket_,
      adminResolveMarket: adminResolveMarket_,
      adminCancelMarket: adminCancelMarket_,
      adminGetAllBets: adminGetAllBets_,
      adminResolveHabitacionCombinadas: adminResolveHabitacionCombinadas_,
    };

    if (!handlers[action]) throw new Error("Acción " + action + " no reconocida.");
    const result = handlers[action](payload) || {};
    return jsonOutput_({
      success: true,
      data: result.data || result,
      message: result.message || "",
    });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonOutput_({
      success: false,
      error: error && error.message ? error.message : "Ocurrió un error inesperado.",
    });
  }
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function unwrapData_(result) {
  return result && result.data ? result.data : result || {};
}

function getCachedJson_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function putCachedJson_(key, value, seconds) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), seconds);
  } catch (_error) {
    // CacheService has strict size limits; skipping cache is safer than failing the request.
  }
}

function clearDataCaches_() {
  try {
    CacheService.getScriptCache().removeAll(Object.keys(DATA_CACHE_KEYS).map(function (key) {
      return DATA_CACHE_KEYS[key];
    }));
  } catch (_error) {
    // Cache invalidation should never break a write path.
  }
}

function register_(payload) {
  return withScriptLock_(function () {
    const username = canonicalAllowedUsername_(validateUsername_(payload.usuario));
    const usersSheet = getSheet_(SHEETS.USERS);
    const users = getRowsAsObjects_(usersSheet);

    if (findUser_(users, username)) {
      throw new Error("Ese nombre de usuario ya está registrado.");
    }

    const user = createAllowedUser_(usersSheet, users, username);

    return {
      data: { user: serializeUser_(user) },
      message: "Usuario registrado correctamente.",
    };
  });
}

function login_(payload) {
  const username = canonicalAllowedUsername_(validateUsername_(payload.usuario));
  let user = findUser_(getRowsAsObjects_(getSheet_(SHEETS.USERS)), username);
  if (!user) {
    user = withScriptLock_(function () {
      const usersSheet = getSheet_(SHEETS.USERS);
      const users = getRowsAsObjects_(usersSheet);
      return findUser_(users, username) || createAllowedUser_(usersSheet, users, username);
    });
  }
  return {
    data: { user: serializeUser_(user) },
    message: "Sesión iniciada.",
  };
}

function getPublicConfig_() {
  const config = getConfigMap_();
  return {
    config: {
      saldo_inicial: number_(config.saldo_inicial),
      admin_user: String(config.admin_user || "Nico"),
    },
  };
}

function getUserData_(payload) {
  const user = requireUser_(payload.usuario);
  return { user: serializeUser_(user) };
}

function getMarkets_() {
  const cached = getCachedJson_(DATA_CACHE_KEYS.MARKETS);
  if (cached) return { markets: cached };

  const markets = buildMarketsFromRows_(
    getRowsAsObjects_(getSheet_(SHEETS.MARKETS)),
    getRowsAsObjects_(getSheet_(SHEETS.OPTIONS)),
  );
  putCachedJson_(DATA_CACHE_KEYS.MARKETS, markets, DATA_CACHE_SECONDS);
  return { markets: markets };
}

function buildMarketsFromRows_(markets, options) {
  const optionsByMarket = {};

  options.forEach(function (option) {
    const key = String(option.mercado_id);
    if (!optionsByMarket[key]) optionsByMarket[key] = [];
    optionsByMarket[key].push(serializeOption_(option));
  });

  Object.keys(optionsByMarket).forEach(function (key) {
    optionsByMarket[key].sort(function (a, b) {
      if (number_(a.linea) !== number_(b.linea)) return number_(a.linea) - number_(b.linea);
      if (a.lado !== b.lado) return a.lado === "Menos de" ? -1 : 1;
      return number_(a.id) - number_(b.id);
    });
  });

  return markets
    .map(function (market) {
      return {
        id: market.id,
        categoria: String(market.categoria),
        evento: String(market.evento),
        tipo: String(market.tipo),
        estado: String(market.estado),
        fecha_creacion: toIso_(market.fecha_creacion),
        fecha_limite_cancelacion: toIso_(market.fecha_limite_cancelacion),
        fecha_limite_apuesta: toIso_(market.fecha_limite_apuesta),
        permitir_apuesta_propia: boolean_(market.permitir_apuesta_propia),
        opciones: optionsByMarket[String(market.id)] || [],
      };
    })
    .sort(function (a, b) {
      const categoryDifference =
        categoryPosition_(a.categoria) - categoryPosition_(b.categoria);
      return categoryDifference || number_(a.id) - number_(b.id);
    });
}

function getDashboardData_(payload) {
  payload = payload || {};
  if (!payload.usuario) throw new Error("Falta el usuario.");

  const username = canonicalAllowedUsername_(validateUsername_(payload.usuario));
  const tables = readTables_([
    SHEETS.USERS,
    SHEETS.MARKETS,
    SHEETS.OPTIONS,
    SHEETS.BETS,
    SHEETS.ROOM_COMBINATIONS,
    SHEETS.MOVEMENTS,
  ]);
  const users = tables[SHEETS.USERS];
  const user = findUser_(users, username);
  if (!user) throw new Error("Usuario no encontrado.");

  return {
    userData: serializeUser_(user),
    markets: buildMarketsFromRows_(tables[SHEETS.MARKETS], tables[SHEETS.OPTIONS]),
    bets: buildUserBetsFromRows_(username, tables[SHEETS.BETS], tables[SHEETS.MARKETS]),
    roomCombinations: buildUserRoomCombinationsFromRows_(
      username,
      tables[SHEETS.ROOM_COMBINATIONS],
    ),
    balanceRanking: buildBalanceRankingFromRows_(users),
    winningsRanking: buildWinningsRankingFromRows_(users, tables[SHEETS.MOVEMENTS]),
    movements: buildUserMovementsFromRows_(username, tables[SHEETS.MOVEMENTS]),
  };
}

function readTables_(sheetNames) {
  const result = {};
  sheetNames.forEach(function (name) {
    const sheet = name === SHEETS.ROOM_COMBINATIONS
      ? getRoomCombinationsSheet_()
      : getSheet_(name);
    result[name] = getRowsAsObjects_(sheet);
  });
  return result;
}

function buildMarketMapFromRows_(markets) {
  const marketMap = {};
  markets.forEach(function (market) {
    marketMap[String(market.id)] = market;
  });
  return marketMap;
}

function buildUserBetsFromRows_(username, bets, markets) {
  const marketMap = buildMarketMapFromRows_(markets);
  return bets
    .filter(function (bet) {
      return normalizeKey_(bet.usuario) === normalizeKey_(username);
    })
    .map(function (bet) {
      return serializeBet_(bet, marketMap);
    })
    .sort(sortByDateDesc_);
}

function buildUserRoomCombinationsFromRows_(username, combinations) {
  return combinations
    .filter(function (combination) {
      return normalizeKey_(combination.usuario) === normalizeKey_(username);
    })
    .map(serializeRoomCombination_)
    .sort(sortByDateDesc_);
}

function buildBalanceRankingFromRows_(users) {
  return users
    .map(function (user) {
      return { usuario: String(user.usuario), saldo: number_(user.saldo) };
    })
    .sort(function (a, b) {
      return b.saldo - a.saldo || a.usuario.localeCompare(b.usuario);
    });
}

function buildWinningsRankingFromRows_(users, movements) {
  const totals = {};
  users.forEach(function (user) {
    totals[normalizeKey_(user.usuario)] = {
      usuario: String(user.usuario),
      ganancias: 0,
    };
  });

  movements.forEach(function (movement) {
    if (String(movement.tipo) !== "Ganancia") return;
    const key = normalizeKey_(movement.usuario);
    if (!totals[key]) {
      totals[key] = { usuario: String(movement.usuario), ganancias: 0 };
    }
    totals[key].ganancias = roundNumber_(
      totals[key].ganancias + number_(movement.monto),
    );
  });

  return Object.keys(totals)
    .map(function (key) {
      return totals[key];
    })
    .sort(function (a, b) {
      return b.ganancias - a.ganancias || a.usuario.localeCompare(b.usuario);
    });
}

function buildUserMovementsFromRows_(username, movements) {
  return movements
    .filter(function (movement) {
      return normalizeKey_(movement.usuario) === normalizeKey_(username);
    })
    .map(serializeMovement_)
    .sort(sortByDateDesc_);
}

function placeBet_(payload) {
  return withScriptLock_(function () {
    const username = canonicalAllowedUsername_(validateUsername_(payload.usuario));
    const marketId = requiredId_(payload.mercado_id, "mercado");
    const optionId = requiredId_(payload.opcion_id, "opción");
    const amount = positiveNumber_(payload.monto, "El monto");

    const usersSheet = getSheet_(SHEETS.USERS);
    const users = getRowsAsObjects_(usersSheet);
    const user = findUser_(users, username);
    if (!user) throw new Error("Usuario no encontrado.");

    const markets = getRowsAsObjects_(getSheet_(SHEETS.MARKETS));
    const market = markets.find(function (item) {
      return String(item.id) === String(marketId);
    });
    if (!market) throw new Error("El mercado no existe.");
    if (market.estado !== "Abierto") throw new Error("El mercado no está abierto.");
    if (market.tipo === "HABITACION_COMBINADA") {
      throw new Error("La combinada de habitación se apuesta desde su bloque especial.");
    }
    const betDeadline = optionalDate_(
      market.fecha_limite_apuesta,
      "La fecha límite de apuestas",
    );
    if (betDeadline && new Date().getTime() > betDeadline.getTime()) {
      throw new Error("Ya venció el plazo para apostar en este mercado.");
    }

    const options = getRowsAsObjects_(getSheet_(SHEETS.OPTIONS));
    const option = options.find(function (item) {
      return (
        String(item.id) === String(optionId) &&
        String(item.mercado_id) === String(marketId)
      );
    });
    if (!option) throw new Error("La opción no existe o no pertenece al mercado.");
    if (
      !boolean_(market.permitir_apuesta_propia) &&
      normalizeKey_(option.opcion) === normalizeKey_(username)
    ) {
      throw new Error("No podés apostar por vos mismo en este mercado.");
    }

    const balance = number_(user.saldo);
    if (balance < amount) throw new Error("Saldo insuficiente.");

    const betsSheet = getSheet_(SHEETS.BETS);
    const bets = getRowsAsObjects_(betsSheet);
    const userMarketBets = bets.filter(function (bet) {
      return (
        normalizeKey_(bet.usuario) === normalizeKey_(username) &&
        String(bet.mercado_id) === String(marketId) &&
        String(bet.estado) === "Abierta"
      );
    });

    if (market.tipo === "OVER_UNDER") {
      if (!["Menos de", "Más de"].includes(String(option.lado))) {
        throw new Error("La opción OVER_UNDER no tiene un lado válido.");
      }
      const repeatedSide = userMarketBets.some(function (bet) {
        return String(bet.lado) === String(option.lado);
      });
      if (repeatedSide) {
        throw new Error("Ya hiciste una apuesta a ese lado en este mercado.");
      }
      if (userMarketBets.length >= 2) {
        throw new Error("Ya alcanzaste el máximo de dos apuestas en este mercado.");
      }
    } else if (userMarketBets.length) {
      throw new Error("Ya hiciste una apuesta en este mercado.");
    }

    const now = new Date();
    const betId = nextId_(bets);
    const newBalance = roundNumber_(balance - amount);
    usersSheet.getRange(user._row, headerIndex_(usersSheet, "saldo")).setValue(newBalance);

    betsSheet.appendRow([
      betId,
      username,
      marketId,
      optionId,
      option.opcion,
      market.tipo,
      option.lado || "",
      option.linea === "" ? "" : option.linea,
      amount,
      number_(option.cuota),
      "Abierta",
      0,
      now,
    ]);

    const bet = {
      id: betId,
      usuario: username,
      mercado_id: marketId,
      opcion_id: optionId,
      opcion: option.opcion,
      tipo_mercado: market.tipo,
      lado: option.lado || "",
      linea: option.linea === "" ? "" : option.linea,
      monto: amount,
      cuota: number_(option.cuota),
      estado: "Abierta",
      pago: 0,
      fecha: now,
    };
    const movement = appendMovement_(
      username,
      "Apuesta",
      -amount,
      "Apuesta en " + market.evento + " · " + option.opcion,
      now,
    );
    user.saldo = newBalance;
    clearDataCaches_();

    return {
      data: {
        user: serializeUser_(user),
        bet: serializeBet_(bet, buildMarketMapFromRows_(markets)),
        movement: movement,
        saldo: newBalance,
      },
      message: "Apuesta registrada correctamente.",
    };
  });
}

function placeHabitacionCombinada_(payload) {
  return withScriptLock_(function () {
    const username = canonicalAllowedUsername_(validateUsername_(payload.usuario));
    const countBetId = requiredId_(payload.apuesta_cantidad_id, "apuesta de cantidad");
    const amount = positiveNumber_(payload.monto, "El monto");

    const usersSheet = getSheet_(SHEETS.USERS);
    const users = getRowsAsObjects_(usersSheet);
    const user = findUser_(users, username);
    if (!user) throw new Error("Usuario no encontrado.");

    const bets = getRowsAsObjects_(getSheet_(SHEETS.BETS));
    const countBet = bets.find(function (bet) {
      return String(bet.id) === String(countBetId);
    });
    if (!countBet) throw new Error("La apuesta de cantidad no existe.");
    if (normalizeKey_(countBet.usuario) !== normalizeKey_(username)) {
      throw new Error("La apuesta de cantidad no pertenece al usuario.");
    }
    if (String(countBet.estado) !== "Abierta") {
      throw new Error("La apuesta de cantidad debe estar abierta.");
    }

    const markets = getRowsAsObjects_(getSheet_(SHEETS.MARKETS));
    const market = markets.find(function (item) {
      return String(item.id) === String(countBet.mercado_id);
    });
    if (!market || !isRoomCountMarket_(market)) {
      throw new Error("La apuesta elegida no corresponde al mercado de cantidad de habitación.");
    }
    if (String(market.estado) !== "Abierto") {
      throw new Error("El mercado de habitación no está abierto.");
    }

    const betDeadline = optionalDate_(
      market.fecha_limite_apuesta,
      "La fecha límite de apuestas",
    );
    if (betDeadline && new Date().getTime() > betDeadline.getTime()) {
      throw new Error("Ya venció el plazo para apostar en este mercado.");
    }

    const options = getRowsAsObjects_(getSheet_(SHEETS.OPTIONS));
    const countOption = options.find(function (option) {
      return (
        String(option.id) === String(countBet.opcion_id) &&
        String(option.mercado_id) === String(market.id)
      );
    });
    if (!countOption) throw new Error("No se encontró la opción de cantidad apostada.");

    const roomSize = parseRoomSize_(countBet.opcion || countOption.opcion);
    const requiredCompanions = roomSize - 1;
    const companionSelection = validateRoomCompanionSelection_(
      payload.companeros,
      username,
      requiredCompanions,
    );

    const combinationsSheet = getRoomCombinationsSheet_();
    const combinations = getRowsAsObjects_(combinationsSheet);
    const duplicated = combinations.some(function (combination) {
      return (
        String(combination.apuesta_cantidad_id) === String(countBetId) &&
        String(combination.estado) === "Abierta"
      );
    });
    if (duplicated) {
      throw new Error("Ya existe una combinada abierta para esa apuesta de cantidad.");
    }

    const balance = number_(user.saldo);
    if (balance < amount) throw new Error("Saldo insuficiente.");

    const now = new Date();
    const combinationId = nextId_(combinations);
    const countOdds = number_(countBet.cuota);
    const companionOdds = roundNumber_(companionSelection.odds);
    const totalOdds = roundNumber_(countOdds * companionOdds);
    const newBalance = roundNumber_(balance - amount);

    usersSheet.getRange(user._row, headerIndex_(usersSheet, "saldo")).setValue(newBalance);
    combinationsSheet.appendRow([
      combinationId,
      username,
      market.id,
      countBetId,
      roomSize,
      JSON.stringify(companionSelection.names),
      countOdds,
      companionOdds,
      totalOdds,
      amount,
      "Abierta",
      0,
      now,
    ]);

    const combination = {
      id: combinationId,
      usuario: username,
      mercado_cantidad_id: market.id,
      apuesta_cantidad_id: countBetId,
      cantidad_personas: roomSize,
      companeros_json: JSON.stringify(companionSelection.names),
      cuota_cantidad: countOdds,
      cuota_companeros: companionOdds,
      cuota_total: totalOdds,
      monto: amount,
      estado: "Abierta",
      pago: 0,
      fecha: now,
    };
    const movement = appendMovement_(
      username,
      "Apuesta",
      -amount,
      ROOM_COMBINATION_EVENT + " · " + roomSize + " personas · " + companionSelection.names.join(", "),
      now,
    );
    user.saldo = newBalance;
    clearDataCaches_();

    return {
      data: {
        user: serializeUser_(user),
        combinada: serializeRoomCombination_(combination),
        movement: movement,
        saldo: newBalance,
      },
      message: "Combinada de habitación registrada correctamente.",
    };
  });
}

function cancelBet_(payload) {
  return withScriptLock_(function () {
    const username = canonicalAllowedUsername_(validateUsername_(payload.usuario));
    const betId = requiredId_(payload.apuesta_id, "apuesta");

    const usersSheet = getSheet_(SHEETS.USERS);
    const users = getRowsAsObjects_(usersSheet);
    const markets = getRowsAsObjects_(getSheet_(SHEETS.MARKETS));
    const betsSheet = getSheet_(SHEETS.BETS);
    const bets = getRowsAsObjects_(betsSheet);

    const bet = bets.find(function (item) {
      return String(item.id) === String(betId);
    });
    if (!bet) throw new Error("La apuesta no existe.");
    if (normalizeKey_(bet.usuario) !== normalizeKey_(username)) {
      throw new Error("La apuesta no pertenece al usuario.");
    }
    if (String(bet.estado) !== "Abierta") {
      throw new Error("Solo se pueden cancelar apuestas abiertas.");
    }

    const market = markets.find(function (item) {
      return String(item.id) === String(bet.mercado_id);
    });
    if (!market) throw new Error("El mercado asociado no existe.");
    if (String(market.estado) !== "Abierto") {
      throw new Error("La apuesta no se puede cancelar porque el mercado ya no está abierto.");
    }
    const cancelDeadline = optionalDate_(
      market.fecha_limite_cancelacion,
      "La fecha límite de cancelación",
    );
    if (cancelDeadline && new Date().getTime() > cancelDeadline.getTime()) {
      throw new Error("Ya venció el plazo para cancelar esta apuesta.");
    }

    const user = findUser_(users, username);
    if (!user) throw new Error("Usuario no encontrado.");

    const amount = positiveNumber_(bet.monto, "El monto de la apuesta");
    const combinationsSheet = getRoomCombinationsSheet_();
    const linkedCombinations = getRowsAsObjects_(combinationsSheet).filter(function (combination) {
      return (
        String(combination.apuesta_cantidad_id) === String(betId) &&
        normalizeKey_(combination.usuario) === normalizeKey_(username) &&
        String(combination.estado) === "Abierta"
      );
    });
    const combinationsRefund = linkedCombinations.reduce(function (sum, combination) {
      return sum + positiveNumber_(combination.monto, "El monto de la combinada");
    }, 0);
    const newBalance = roundNumber_(number_(user.saldo) + amount + combinationsRefund);
    const now = new Date();

    usersSheet
      .getRange(user._row, headerIndex_(usersSheet, "saldo"))
      .setValue(newBalance);
    betsSheet
      .getRange(bet._row, headerIndex_(betsSheet, "estado"), 1, 2)
      .setValues([["Devuelta", amount]]);
    bet.estado = "Devuelta";
    bet.pago = amount;

    linkedCombinations.forEach(function (combination) {
      combinationsSheet
        .getRange(combination._row, headerIndex_(combinationsSheet, "estado"), 1, 2)
        .setValues([["Devuelta", number_(combination.monto)]]);
      combination.estado = "Devuelta";
      combination.pago = number_(combination.monto);
    });

    const movements = [];
    movements.push(appendMovement_(
      username,
      "Devolucion",
      amount,
      "Cancelación de apuesta en " + market.evento + " · " + bet.opcion,
      now,
    ));
    if (combinationsRefund > 0) {
      movements.push(appendMovement_(
        username,
        "Devolucion",
        combinationsRefund,
        "Cancelación de combinada vinculada a " + market.evento,
        now,
      ));
    }
    user.saldo = newBalance;
    clearDataCaches_();

    return {
      data: {
        user: serializeUser_(user),
        bet: serializeBet_(bet, buildMarketMapFromRows_(markets)),
        linked_combinations: linkedCombinations.map(serializeRoomCombination_),
        movements: movements,
        saldo: newBalance,
        apuesta_id: betId,
      },
      message: combinationsRefund > 0
        ? "Apuesta y combinada vinculada canceladas. Fichas devueltas."
        : "Apuesta cancelada y fichas devueltas.",
    };
  });
}

function getMyBets_(payload) {
  const username = validateUsername_(payload.usuario);
  requireUser_(username);
  const tables = readTables_([SHEETS.MARKETS, SHEETS.BETS, SHEETS.ROOM_COMBINATIONS]);
  const bets = buildUserBetsFromRows_(username, tables[SHEETS.BETS], tables[SHEETS.MARKETS]);
  const roomCombinations = buildUserRoomCombinationsFromRows_(
    username,
    tables[SHEETS.ROOM_COMBINATIONS],
  );

  return { bets: bets, habitacion_combinadas: roomCombinations };
}

function getBalanceRanking_() {
  const cached = getCachedJson_(DATA_CACHE_KEYS.BALANCE_RANKING);
  if (cached) return { ranking: cached };
  const ranking = buildBalanceRankingFromRows_(
    getRowsAsObjects_(getSheet_(SHEETS.USERS)),
  );
  putCachedJson_(DATA_CACHE_KEYS.BALANCE_RANKING, ranking, DATA_CACHE_SECONDS);
  return { ranking: ranking };
}

function getWinningsRanking_() {
  const cached = getCachedJson_(DATA_CACHE_KEYS.WINNINGS_RANKING);
  if (cached) return { ranking: cached };
  const tables = readTables_([SHEETS.USERS, SHEETS.MOVEMENTS]);
  const ranking = buildWinningsRankingFromRows_(
    tables[SHEETS.USERS],
    tables[SHEETS.MOVEMENTS],
  );
  putCachedJson_(DATA_CACHE_KEYS.WINNINGS_RANKING, ranking, DATA_CACHE_SECONDS);
  return { ranking: ranking };
}

function getMovements_(payload) {
  const username = validateUsername_(payload.usuario);
  requireUser_(username);
  const movements = buildUserMovementsFromRows_(
    username,
    getRowsAsObjects_(getSheet_(SHEETS.MOVEMENTS)),
  );
  return { movements: movements };
}

function adminLogin_(payload) {
  const username = validateUsername_(payload.usuario);
  const password = String(payload.password || "");
  const user = requireUser_(username);
  if (user.rol !== "admin") throw new Error("El usuario no tiene rol de administrador.");

  const config = getConfigMap_();
  if (
    normalizeKey_(username) !== normalizeKey_(config.admin_user || "Nico") ||
    password !== String(config.admin_password || "")
  ) {
    throw new Error("Usuario o clave de administrador incorrectos.");
  }

  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  CacheService.getScriptCache().put(
    "admin_session_" + token,
    String(user.usuario),
    ADMIN_SESSION_SECONDS,
  );
  return {
    data: { token: token, expires_in: ADMIN_SESSION_SECONDS },
    message: "Acceso de administrador concedido.",
  };
}

function adminCreateMarket_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const category = requiredText_(payload.categoria, "La categoría", 60);
    const event = requiredText_(payload.evento, "El evento", 200);
    const type = String(payload.tipo || "").trim().toUpperCase();
    if (!MARKET_TYPES.includes(type)) throw new Error("Tipo de mercado inválido.");

    const sheet = getSheet_(SHEETS.MARKETS);
    const markets = getRowsAsObjects_(sheet);
    const id = nextId_(markets);
    sheet.appendRow([id, category, event, type, "Abierto", new Date(), "", "", false]);
    clearDataCaches_();
    return {
      data: { market: { id: id, categoria: category, evento: event, tipo: type } },
      message: "Mercado creado correctamente.",
    };
  });
}

function adminCreateOption_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const marketId = requiredId_(payload.mercado_id, "mercado");
    const odds = positiveNumber_(payload.cuota, "La cuota");
    if (odds < 1) throw new Error("La cuota debe ser mayor o igual a 1.");

    const market = requireMarket_(marketId);
    if (["Resuelto", "Cancelado"].includes(market.estado)) {
      throw new Error("No se pueden agregar opciones a un mercado finalizado.");
    }

    let optionName = String(payload.opcion || "").trim();
    let line = "";
    let side = "";
    if (market.tipo === "OVER_UNDER") {
      line = finiteNumber_(payload.linea, "La línea");
      side = String(payload.lado || "").trim();
      if (!["Menos de", "Más de"].includes(side)) {
        throw new Error("El lado debe ser “Menos de” o “Más de”.");
      }
      optionName = side + " " + formatPlainNumber_(line);
    } else {
      optionName = requiredText_(optionName, "La opción", 100);
    }

    const sheet = getSheet_(SHEETS.OPTIONS);
    const options = getRowsAsObjects_(sheet);
    const duplicate = options.some(function (option) {
      return (
        String(option.mercado_id) === String(marketId) &&
        normalizeKey_(option.opcion) === normalizeKey_(optionName)
      );
    });
    if (duplicate) throw new Error("Esa opción ya existe en el mercado.");

    const id = nextId_(options);
    sheet.appendRow([id, marketId, optionName, line, side, odds]);
    clearDataCaches_();
    return {
      data: { option: { id: id, mercado_id: marketId, opcion: optionName, cuota: odds } },
      message: "Opción agregada correctamente.",
    };
  });
}

function adminUpdateOdds_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const optionId = requiredId_(payload.opcion_id, "opción");
    const odds = positiveNumber_(payload.cuota, "La cuota");
    if (odds < 1) throw new Error("La cuota debe ser mayor o igual a 1.");

    const optionsSheet = getSheet_(SHEETS.OPTIONS);
    const options = getRowsAsObjects_(optionsSheet);
    const option = options.find(function (item) {
      return String(item.id) === String(optionId);
    });
    if (!option) throw new Error("Opción no encontrada.");

    const market = requireMarket_(option.mercado_id);
    if (["Resuelto", "Cancelado"].includes(market.estado)) {
      throw new Error("No se pueden editar cuotas de un mercado finalizado.");
    }

    optionsSheet
      .getRange(option._row, headerIndex_(optionsSheet, "cuota"))
      .setValue(odds);
    clearDataCaches_();
    return { message: "Cuota actualizada correctamente." };
  });
}

function adminUpdateCancelDeadline_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const marketId = requiredId_(payload.mercado_id, "mercado");
    const marketsSheet = getSheet_(SHEETS.MARKETS);
    const market = requireMarket_(marketId, marketsSheet);
    if (["Resuelto", "Cancelado"].includes(String(market.estado))) {
      throw new Error(
        "No se puede modificar el límite de cancelación de un mercado finalizado.",
      );
    }

    const deadline = optionalDate_(
      payload.fecha_limite_cancelacion,
      "La fecha límite de cancelación",
    );
    marketsSheet
      .getRange(
        market._row,
        headerIndex_(marketsSheet, "fecha_limite_cancelacion"),
      )
      .setValue(deadline || "");
    clearDataCaches_();

    return {
      data: {
        mercado_id: marketId,
        fecha_limite_cancelacion: deadline ? deadline.toISOString() : "",
      },
      message: "Fecha límite de cancelación actualizada.",
    };
  });
}

function adminUpdateBetDeadline_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const marketId = requiredId_(payload.mercado_id, "mercado");
    const marketsSheet = getSheet_(SHEETS.MARKETS);
    const market = requireMarket_(marketId, marketsSheet);
    if (["Resuelto", "Cancelado"].includes(String(market.estado))) {
      throw new Error(
        "No se puede modificar el límite de apuestas de un mercado finalizado.",
      );
    }

    const deadline = optionalDate_(
      payload.fecha_limite_apuesta,
      "La fecha límite de apuestas",
    );
    marketsSheet
      .getRange(
        market._row,
        headerIndex_(marketsSheet, "fecha_limite_apuesta"),
      )
      .setValue(deadline || "");
    clearDataCaches_();

    return {
      data: {
        mercado_id: marketId,
        fecha_limite_apuesta: deadline ? deadline.toISOString() : "",
      },
      message: "Fecha límite de apuestas actualizada.",
    };
  });
}

function adminToggleSelfBet_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const marketId = requiredId_(payload.mercado_id, "mercado");
    const marketsSheet = getSheet_(SHEETS.MARKETS);
    const market = requireMarket_(marketId, marketsSheet);
    if (["Resuelto", "Cancelado"].includes(String(market.estado))) {
      throw new Error("No se puede modificar la apuesta propia de un mercado finalizado.");
    }

    const allowSelfBet = boolean_(payload.permitir_apuesta_propia);
    let selfBetColumn = 0;
    try {
      selfBetColumn = headerIndex_(marketsSheet, "permitir_apuesta_propia");
    } catch (_error) {
      throw new Error("No se encontró la columna permitir_apuesta_propia.");
    }
    marketsSheet
      .getRange(market._row, selfBetColumn)
      .setValue(allowSelfBet);
    clearDataCaches_();

    return {
      data: {
        mercado_id: marketId,
        permitir_apuesta_propia: allowSelfBet,
      },
      message: "Configuración de apuesta propia actualizada.",
    };
  });
}

function adminCloseMarket_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const marketId = requiredId_(payload.mercado_id, "mercado");
    const sheet = getSheet_(SHEETS.MARKETS);
    const market = requireMarket_(marketId, sheet);
    if (market.estado !== "Abierto") {
      throw new Error("Solo se pueden cerrar mercados abiertos.");
    }
    sheet
      .getRange(market._row, headerIndex_(sheet, "estado"))
      .setValue("Cerrado");
    clearDataCaches_();
    return { message: "Mercado cerrado correctamente." };
  });
}

function adminResolveMarket_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const marketId = requiredId_(payload.mercado_id, "mercado");
    const winnerOptionId = requiredId_(
      payload.opcion_id_ganadora,
      "opción ganadora",
    );
    const marketsSheet = getSheet_(SHEETS.MARKETS);
    const market = requireMarket_(marketId, marketsSheet);
    if (market.estado === "Resuelto") throw new Error("El mercado ya fue resuelto.");
    if (market.estado === "Cancelado") throw new Error("Un mercado cancelado no se puede resolver.");

    const options = getRowsAsObjects_(getSheet_(SHEETS.OPTIONS));
    const winner = options.find(function (option) {
      return (
        String(option.id) === String(winnerOptionId) &&
        String(option.mercado_id) === String(marketId)
      );
    });
    if (!winner) throw new Error("La opción ganadora no pertenece al mercado.");

    const resultsSheet = getSheet_(SHEETS.RESULTS);
    const alreadyResolved = getRowsAsObjects_(resultsSheet).some(function (result) {
      return String(result.mercado_id) === String(marketId);
    });
    if (alreadyResolved) throw new Error("Ya existe un resultado para este mercado.");

    const betsSheet = getSheet_(SHEETS.BETS);
    const betValues = betsSheet.getDataRange().getValues();
    const betHeaders = betValues[0];
    const betIndex = indexMap_(betHeaders);
    const usersSheet = getSheet_(SHEETS.USERS);
    const userValues = usersSheet.getDataRange().getValues();
    const userIndex = indexMap_(userValues[0]);
    const userRows = {};
    for (let i = 1; i < userValues.length; i += 1) {
      userRows[normalizeKey_(userValues[i][userIndex.usuario])] = i;
    }

    const now = new Date();
    const movementRows = [];
    let winners = 0;
    let losers = 0;

    for (let row = 1; row < betValues.length; row += 1) {
      if (
        String(betValues[row][betIndex.mercado_id]) !== String(marketId) ||
        String(betValues[row][betIndex.estado]) !== "Abierta"
      ) {
        continue;
      }

      if (String(betValues[row][betIndex.opcion_id]) === String(winnerOptionId)) {
        const amount = number_(betValues[row][betIndex.monto]);
        const odds = number_(betValues[row][betIndex.cuota]);
        const payment = roundNumber_(amount * odds);
        const username = String(betValues[row][betIndex.usuario]);
        const userRow = userRows[normalizeKey_(username)];
        if (userRow === undefined) {
          throw new Error("No se encontró al usuario ganador " + username + ".");
        }

        betValues[row][betIndex.estado] = "Ganada";
        betValues[row][betIndex.pago] = payment;
        userValues[userRow][userIndex.saldo] = roundNumber_(
          number_(userValues[userRow][userIndex.saldo]) + payment,
        );
        movementRows.push([
          null,
          username,
          "Ganancia",
          payment,
          "Ganó apuesta en " + market.evento + " · " + winner.opcion,
          now,
        ]);
        winners += 1;
      } else {
        betValues[row][betIndex.estado] = "Perdida";
        betValues[row][betIndex.pago] = 0;
        losers += 1;
      }
    }

    if (betValues.length > 1) {
      betsSheet.getRange(1, 1, betValues.length, betValues[0].length).setValues(betValues);
    }
    if (userValues.length > 1) {
      usersSheet.getRange(1, 1, userValues.length, userValues[0].length).setValues(userValues);
    }

    appendMovementRows_(movementRows);
    resultsSheet.appendRow([marketId, winner.opcion, winnerOptionId, now]);
    marketsSheet
      .getRange(market._row, headerIndex_(marketsSheet, "estado"))
      .setValue("Resuelto");
    clearDataCaches_();

    return {
      data: { winners: winners, losers: losers },
      message: "Mercado resuelto. Ganadoras: " + winners + ". Perdedoras: " + losers + ".",
    };
  });
}

function adminCancelMarket_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const marketId = requiredId_(payload.mercado_id, "mercado");
    const marketsSheet = getSheet_(SHEETS.MARKETS);
    const market = requireMarket_(marketId, marketsSheet);
    if (market.estado === "Resuelto") {
      throw new Error("No se puede cancelar un mercado resuelto.");
    }
    if (market.estado === "Cancelado") {
      throw new Error("El mercado ya está cancelado.");
    }

    const betsSheet = getSheet_(SHEETS.BETS);
    const betValues = betsSheet.getDataRange().getValues();
    const betIndex = indexMap_(betValues[0]);
    const usersSheet = getSheet_(SHEETS.USERS);
    const userValues = usersSheet.getDataRange().getValues();
    const userIndex = indexMap_(userValues[0]);
    const userRows = {};
    for (let i = 1; i < userValues.length; i += 1) {
      userRows[normalizeKey_(userValues[i][userIndex.usuario])] = i;
    }

    const now = new Date();
    const movementRows = [];
    let refunds = 0;
    let combinationRefunds = 0;
    let combinationsSheet = null;
    let combinationValues = null;

    for (let row = 1; row < betValues.length; row += 1) {
      if (
        String(betValues[row][betIndex.mercado_id]) !== String(marketId) ||
        String(betValues[row][betIndex.estado]) !== "Abierta"
      ) {
        continue;
      }

      const username = String(betValues[row][betIndex.usuario]);
      const amount = number_(betValues[row][betIndex.monto]);
      const userRow = userRows[normalizeKey_(username)];
      if (userRow === undefined) throw new Error("No se encontró al usuario " + username + ".");

      betValues[row][betIndex.estado] = "Devuelta";
      betValues[row][betIndex.pago] = amount;
      userValues[userRow][userIndex.saldo] = roundNumber_(
        number_(userValues[userRow][userIndex.saldo]) + amount,
      );
      movementRows.push([
        null,
        username,
        "Devolucion",
        amount,
        "Devolución por mercado cancelado: " + market.evento,
        now,
      ]);
      refunds += 1;
    }

    if (isRoomCountMarket_(market)) {
      combinationsSheet = getRoomCombinationsSheet_();
      combinationValues = combinationsSheet.getDataRange().getValues();
      const combinationIndex = indexMap_(combinationValues[0]);
      for (let row = 1; row < combinationValues.length; row += 1) {
        if (
          String(combinationValues[row][combinationIndex.mercado_cantidad_id]) !== String(marketId) ||
          String(combinationValues[row][combinationIndex.estado]) !== "Abierta"
        ) {
          continue;
        }

        const username = String(combinationValues[row][combinationIndex.usuario]);
        const amount = number_(combinationValues[row][combinationIndex.monto]);
        const userRow = userRows[normalizeKey_(username)];
        if (userRow === undefined) throw new Error("No se encontró al usuario " + username + ".");

        combinationValues[row][combinationIndex.estado] = "Devuelta";
        combinationValues[row][combinationIndex.pago] = amount;
        userValues[userRow][userIndex.saldo] = roundNumber_(
          number_(userValues[userRow][userIndex.saldo]) + amount,
        );
        movementRows.push([
          null,
          username,
          "Devolucion",
          amount,
          "Devolución por combinada de habitación cancelada",
          now,
        ]);
        combinationRefunds += 1;
      }
    }

    if (betValues.length > 1) {
      betsSheet.getRange(1, 1, betValues.length, betValues[0].length).setValues(betValues);
    }
    if (combinationValues && combinationValues.length > 1) {
      combinationsSheet
        .getRange(1, 1, combinationValues.length, combinationValues[0].length)
        .setValues(combinationValues);
    }
    if (userValues.length > 1) {
      usersSheet.getRange(1, 1, userValues.length, userValues[0].length).setValues(userValues);
    }
    appendMovementRows_(movementRows);
    marketsSheet
      .getRange(market._row, headerIndex_(marketsSheet, "estado"))
      .setValue("Cancelado");
    clearDataCaches_();

    return {
      data: { refunds: refunds, combination_refunds: combinationRefunds },
      message:
        "Mercado cancelado. Apuestas devueltas: " +
        refunds +
        ". Combinadas devueltas: " +
        combinationRefunds +
        ".",
    };
  });
}

function adminGetAllBets_(payload) {
  requireAdmin_(payload);
  const markets = getRowsAsObjects_(getSheet_(SHEETS.MARKETS));
  const marketMap = buildMarketMapFromRows_(markets);
  const bets = getRowsAsObjects_(getSheet_(SHEETS.BETS))
    .map(function (bet) {
      return serializeBet_(bet, marketMap);
    })
    .sort(sortByDateDesc_);
  const roomCombinations = getRowsAsObjects_(getRoomCombinationsSheet_())
    .map(serializeRoomCombination_)
    .sort(sortByDateDesc_);
  return { bets: bets, habitacion_combinadas: roomCombinations };
}

function adminResolveHabitacionCombinadas_(payload) {
  requireAdmin_(payload);
  return withScriptLock_(function () {
    const realRoomSize = requiredRoomSize_(payload.cantidad_real);
    const realCompanions = validateRoomCompanionSelection_(
      payload.companeros_reales,
      "",
      realRoomSize - 1,
      { skipOwnUser: true, label: "La lista real de compañeros" },
    );

    const combinationsSheet = getRoomCombinationsSheet_();
    const combinationValues = combinationsSheet.getDataRange().getValues();
    const combinationIndex = indexMap_(combinationValues[0]);
    const usersSheet = getSheet_(SHEETS.USERS);
    const userValues = usersSheet.getDataRange().getValues();
    const userIndex = indexMap_(userValues[0]);
    const userRows = {};
    for (let i = 1; i < userValues.length; i += 1) {
      userRows[normalizeKey_(userValues[i][userIndex.usuario])] = i;
    }

    const now = new Date();
    const movementRows = [];
    let winners = 0;
    let losers = 0;

    for (let row = 1; row < combinationValues.length; row += 1) {
      if (String(combinationValues[row][combinationIndex.estado]) !== "Abierta") {
        continue;
      }

      const username = String(combinationValues[row][combinationIndex.usuario]);
      const selectedCompanions = parseCompanionsJson_(
        combinationValues[row][combinationIndex.companeros_json],
      );
      const wins =
        number_(combinationValues[row][combinationIndex.cantidad_personas]) === realRoomSize &&
        sameCompanionSet_(selectedCompanions, realCompanions.names);

      if (wins) {
        const amount = number_(combinationValues[row][combinationIndex.monto]);
        const odds = number_(combinationValues[row][combinationIndex.cuota_total]);
        const payment = roundNumber_(amount * odds);
        const userRow = userRows[normalizeKey_(username)];
        if (userRow === undefined) throw new Error("No se encontró al usuario " + username + ".");

        combinationValues[row][combinationIndex.estado] = "Ganada";
        combinationValues[row][combinationIndex.pago] = payment;
        userValues[userRow][userIndex.saldo] = roundNumber_(
          number_(userValues[userRow][userIndex.saldo]) + payment,
        );
        movementRows.push([
          null,
          username,
          "Ganancia",
          payment,
          "Ganó " + ROOM_COMBINATION_EVENT + " · " + realRoomSize + " personas",
          now,
        ]);
        winners += 1;
      } else {
        combinationValues[row][combinationIndex.estado] = "Perdida";
        combinationValues[row][combinationIndex.pago] = 0;
        losers += 1;
      }
    }

    if (combinationValues.length > 1) {
      combinationsSheet
        .getRange(1, 1, combinationValues.length, combinationValues[0].length)
        .setValues(combinationValues);
    }
    if (userValues.length > 1) {
      usersSheet.getRange(1, 1, userValues.length, userValues[0].length).setValues(userValues);
    }
    appendMovementRows_(movementRows);
    clearDataCaches_();

    return {
      data: { winners: winners, losers: losers },
      message:
        "Combinadas resueltas. Ganadoras: " +
        winners +
        ". Perdedoras: " +
        losers +
        ".",
    };
  });
}

/**
 * Ejecutar manualmente una vez. Crea hojas, encabezados, configuración,
 * usuarios de prueba y los mercados / opciones del documento fuente.
 * No duplica mercados si las hojas ya tienen datos.
 */
function setupCasino() {
  const spreadsheet = getDatabase_();
  migrateCasinoSchema_(spreadsheet);
  Object.keys(HEADERS).forEach(function (sheetName) {
    ensureSheet_(spreadsheet, sheetName, HEADERS[sheetName]);
  });

  seedConfig_();
  seedUsers_();
  seedMarketsAndOptions_();
  formatSheets_();
  clearDataCaches_();

  return {
    spreadsheet_url: spreadsheet.getUrl(),
    markets: getRowsAsObjects_(getSheet_(SHEETS.MARKETS)).length,
    options: getRowsAsObjects_(getSheet_(SHEETS.OPTIONS)).length,
  };
}

/**
 * Ejecutar manualmente en planillas existentes para agregar solo Habitaciones.
 * No toca usuarios, apuestas, saldos ni movimientos, y evita duplicar mercados.
 */
function seedHabitacionesMarkets() {
  const spreadsheet = getDatabase_();
  migrateCasinoSchema_(spreadsheet);
  ensureSheet_(spreadsheet, SHEETS.MARKETS, HEADERS.Mercados);
  ensureSheet_(spreadsheet, SHEETS.OPTIONS, HEADERS.Opciones);
  ensureSheet_(spreadsheet, SHEETS.ROOM_COMBINATIONS, HEADERS.HabitacionCombinadas);
  return appendMarketDefinitionsIfMissing_(getHabitacionesMarketDefinitions_());
}

function seedConfig_() {
  const sheet = getSheet_(SHEETS.CONFIG);
  const existing = getRowsAsObjects_(sheet);
  const existingKeys = new Set(
    existing.map(function (row) {
      return normalizeKey_(row.clave);
    }),
  );
  const defaults = [
    ["saldo_inicial", 10000],
    ["admin_user", "Nico"],
    ["admin_password", "cambiar_esta_clave"],
  ];
  defaults.forEach(function (row) {
    if (!existingKeys.has(normalizeKey_(row[0]))) sheet.appendRow(row);
  });
}

function seedUsers_() {
  const usersSheet = getSheet_(SHEETS.USERS);
  const existing = getRowsAsObjects_(usersSheet);
  const initialBalance = number_(getConfigMap_().saldo_inicial) || 10000;
  const now = new Date();
  let nextUserId = nextId_(existing);
  const userRows = [];
  const movementRows = [];

  ALLOWED_USERS.forEach(function (username) {
    if (findUser_(existing, username)) return;
    const role = normalizeKey_(username) === normalizeKey_("Nico") ? "admin" : "user";
    userRows.push([nextUserId, username, initialBalance, role, now]);
    movementRows.push([null, username, "Registro", initialBalance, "Saldo inicial", now]);
    nextUserId += 1;
  });

  if (userRows.length) {
    usersSheet
      .getRange(usersSheet.getLastRow() + 1, 1, userRows.length, userRows[0].length)
      .setValues(userRows);
    appendMovementRows_(movementRows);
  }
}

function seedMarketsAndOptions_() {
  const marketsSheet = getSheet_(SHEETS.MARKETS);
  const optionsSheet = getSheet_(SHEETS.OPTIONS);
  if (
    getRowsAsObjects_(marketsSheet).length ||
    getRowsAsObjects_(optionsSheet).length
  ) {
    return;
  }

  const definitions = getInitialMarketDefinitions_();
  const now = new Date();
  const marketRows = [];
  const optionRows = [];
  let marketId = 1;
  let optionId = 1;

  definitions.forEach(function (definition) {
    marketRows.push([
      marketId,
      definition.categoria,
      definition.evento,
      definition.tipo,
      "Abierto",
      now,
      "",
      "",
      false,
    ]);
    definition.opciones.forEach(function (option) {
      optionRows.push([
        optionId,
        marketId,
        option.opcion,
        option.linea === null ? "" : option.linea,
        option.lado || "",
        option.cuota,
      ]);
      optionId += 1;
    });
    marketId += 1;
  });

  marketsSheet
    .getRange(2, 1, marketRows.length, marketRows[0].length)
    .setValues(marketRows);
  optionsSheet
    .getRange(2, 1, optionRows.length, optionRows[0].length)
    .setValues(optionRows);
}

function appendMarketDefinitionsIfMissing_(definitions) {
  const marketsSheet = getSheet_(SHEETS.MARKETS);
  const optionsSheet = getSheet_(SHEETS.OPTIONS);
  const markets = getRowsAsObjects_(marketsSheet);
  const options = getRowsAsObjects_(optionsSheet);
  const existingKeys = new Set(
    markets.map(function (market) {
      return normalizeKey_(market.categoria) + "|" + normalizeKey_(market.evento);
    }),
  );

  const now = new Date();
  const marketRows = [];
  const optionRows = [];
  let marketId = nextId_(markets);
  let optionId = nextId_(options);
  let skippedMarkets = 0;

  definitions.forEach(function (definition) {
    const key = normalizeKey_(definition.categoria) + "|" + normalizeKey_(definition.evento);
    if (existingKeys.has(key)) {
      skippedMarkets += 1;
      return;
    }
    existingKeys.add(key);
    marketRows.push([
      marketId,
      definition.categoria,
      definition.evento,
      definition.tipo,
      "Abierto",
      now,
      "",
      "",
      false,
    ]);
    definition.opciones.forEach(function (option) {
      optionRows.push([
        optionId,
        marketId,
        option.opcion,
        option.linea === null ? "" : option.linea,
        option.lado || "",
        option.cuota,
      ]);
      optionId += 1;
    });
    marketId += 1;
  });

  if (marketRows.length) {
    marketsSheet
      .getRange(marketsSheet.getLastRow() + 1, 1, marketRows.length, marketRows[0].length)
      .setValues(marketRows);
  }
  if (optionRows.length) {
    optionsSheet
      .getRange(optionsSheet.getLastRow() + 1, 1, optionRows.length, optionRows[0].length)
      .setValues(optionRows);
  }

  return {
    inserted_markets: marketRows.length,
    inserted_options: optionRows.length,
    skipped_markets: skippedMarkets,
  };
}

function getHabitacionesMarketDefinitions_() {
  return [
    {
      categoria: ROOM_CATEGORY,
      evento: ROOM_COUNT_EVENT,
      tipo: "NOMBRE",
      opciones: [
        ["3 personas", 8],
        ["4 personas", 2.2],
        ["5 personas", 2],
        ["6 personas", 3.5],
        ["7 personas", 8],
        ["8 personas", 10],
        ["9 personas", 40],
        ["10 personas", 80],
      ].map(function (entry) {
        return { opcion: entry[0], linea: null, lado: "", cuota: entry[1] };
      }),
    },
    {
      categoria: ROOM_CATEGORY,
      evento: "¿Habrá al menos un quebrado dentro de tu habitación?",
      tipo: "SI_NO",
      opciones: [
        { opcion: "Sí", linea: null, lado: "", cuota: 1.9 },
        { opcion: "No", linea: null, lado: "", cuota: 1.1 },
      ],
    },
    {
      categoria: ROOM_CATEGORY,
      evento: "¿Será la habitación con más minas llevadas a solas?",
      tipo: "SI_NO",
      opciones: [
        { opcion: "Sí", linea: null, lado: "", cuota: 2.8 },
        { opcion: "No", linea: null, lado: "", cuota: 1.15 },
      ],
    },
    {
      categoria: ROOM_CATEGORY,
      evento: "¿Cuántos quebrados tendrá tu habitación?",
      tipo: "OVER_UNDER",
      opciones: [
        { opcion: "Menos de 1", linea: 1, lado: "Menos de", cuota: 1.15 },
        { opcion: "Más de 1", linea: 1, lado: "Más de", cuota: 1.9 },
        { opcion: "Menos de 2", linea: 2, lado: "Menos de", cuota: 1.1 },
        { opcion: "Más de 2", linea: 2, lado: "Más de", cuota: 3.5 },
        { opcion: "Menos de 3", linea: 3, lado: "Menos de", cuota: 1.05 },
        { opcion: "Más de 3", linea: 3, lado: "Más de", cuota: 10 },
      ],
    },
    {
      categoria: ROOM_CATEGORY,
      evento: "¿Habrá por lo menos una vez que la habitación sea usada como previa?",
      tipo: "SI_NO",
      opciones: [
        { opcion: "Sí", linea: null, lado: "", cuota: 1.9 },
        { opcion: "No", linea: null, lado: "", cuota: 1.3 },
      ],
    },
  ];
}

function getInitialMarketDefinitions_() {
  const markets = [];

  function addYesNo(category, event, yesOdds, noOdds) {
    markets.push({
      categoria: category,
      evento: event,
      tipo: "SI_NO",
      opciones: [
        { opcion: "Sí", linea: null, lado: "", cuota: yesOdds },
        { opcion: "No", linea: null, lado: "", cuota: noOdds },
      ],
    });
  }

  function addNames(category, event, entries) {
    markets.push({
      categoria: category,
      evento: event,
      tipo: "NOMBRE",
      opciones: entries.map(function (entry) {
        return { opcion: entry[0], linea: null, lado: "", cuota: entry[1] };
      }),
    });
  }

  function addOverUnder(category, event, lines) {
    const options = [];
    lines.forEach(function (line) {
      options.push({
        opcion: "Menos de " + formatPlainNumber_(line[0]),
        linea: line[0],
        lado: "Menos de",
        cuota: line[1],
      });
      options.push({
        opcion: "Más de " + formatPlainNumber_(line[0]),
        linea: line[0],
        lado: "Más de",
        cuota: line[2],
      });
    });
    markets.push({
      categoria: category,
      evento: event,
      tipo: "OVER_UNDER",
      opciones: options,
    });
  }

  getHabitacionesMarketDefinitions_().forEach(function (definition) {
    markets.push(definition);
  });

  addYesNo("Wachineadas", "¿Habrá una wachineada de Facu?", 1.1, 3.5);
  addYesNo("Wachineadas", "¿Habrá una wachineada de Nachón?", 1.25, 2.8);
  addYesNo("Wachineadas", "¿Habrá una wachineada de Dante?", 1.9, 1.9);
  addNames("Wachineadas", "¿Quién hará la primera wachineada?", [
    ["Facu", 4.5],
    ["Nachón", 5],
    ["Dante", 7],
    ["Pipa", 40],
    ["Romi", 20],
    ["Nico", 20],
    ["Juanpi", 20],
    ["Joaco", 20],
    ["Jane", 20],
    ["Capu", 20],
    ["Biglia", 20],
    ["Fran", 20],
    ["Gonzas", 20],
    ["Jesús", 20],
    ["Ivi", 20],
    ["Rocco", 20],
  ]);

  addYesNo("Quebrados", "¿Habrá al menos un quebrado durante el viaje?", 1.02, 15);
  addNames("Quebrados", "¿Quién será el primer quebrado del viaje?", [
    ["Gonza Boca", 3.5],
    ["Joaco", 4],
    ["Romi", 5],
    ["Nico", 7],
    ["Facu", 7],
    ["Rocco", 7],
    ["Jane", 9],
    ["Fran", 9],
    ["Juanpi", 20],
    ["Ivi", 20],
    ["Pipa", 20],
    ["Gonza R", 20],
    ["Jesús", 20],
  ]);
  addYesNo("Quebrados", "¿Habrá más de 5 quebrados distintos durante el viaje?", 15, 1.02);
  addYesNo("Quebrados", "¿Habrá un doble quebrado de la misma persona?", 7, 1.02);
  addYesNo("Quebrados", "¿Gonza Boca será el primer quebrado?", 3.5, 2);
  addYesNo("Quebrados", "¿El primer quebrado ocurrirá antes de la primera noche?", 7, 1.05);

  addYesNo(
    "Peleas",
    "¿Dos o más integrantes de LBCD se agarrarán a las piñas entre sí?",
    8,
    1.05,
  );
  addYesNo(
    "Peleas",
    "¿Algún integrante de LBCD se agarrará a las piñas con alguien externo?",
    6,
    1.1,
  );
  addYesNo("Peleas", "¿Alguien la boqueará feo y después no hará nada?", 2.5, 1.5);

  addNames("Viaje", "¿En qué semana de agosto sale el viaje?", [
    ["Primera semana (1-7)", 1.85],
    ["Segunda semana (8-15)", 1.85],
  ]);
  addNames(
    "Viaje",
    "¿Qué día de agosto despega el avión?",
    [
      12, 10, 8.5, 7, 6, 5.5, 5, 4.8, 5, 5.5, 6, 7, 8.5, 10, 18,
    ].map(function (odds, index) {
      return [String(index + 1) + " de agosto", odds];
    }),
  );

  addNames("Minas", "¿Quién encarará más durante el viaje?", [
    ["Nico", 3.5],
    ["Juanpi", 4],
    ["Capu", 6],
    ["Jane", 7],
    ["Dante", 8],
    ["Gonza Boca", 8],
    ["Jesús", 12],
    ["Rocco", 12],
    ["Fran", 25],
    ["Pipa", 50],
    ["Ivi", 50],
    ["Gonza R", 50],
  ]);

  const eatenMarkets = {
    Nico: [
      [2, 5, 1.1],
      [4, 2.8, 1.35],
      [5, 2, 1.7],
      [6, 1.6, 2.2],
      [7, 1.35, 3],
      [8, 1.1, 5],
    ],
    Juanpi: [
      [2, 4.5, 1.15],
      [4, 2.5, 1.45],
      [5, 1.9, 1.8],
      [6, 1.55, 2.3],
      [7, 1.3, 3.2],
      [8, 1.08, 5.5],
    ],
    Capu: [
      [2, 3, 1.3],
      [4, 1.8, 1.9],
      [5, 1.45, 2.5],
      [6, 1.15, 4],
      [7, 1.05, 7],
      [8, 1.01, 12],
    ],
    Jane: [
      [2, 3, 1.3],
      [4, 1.8, 1.9],
      [5, 1.45, 2.5],
      [6, 1.15, 4],
      [7, 1.05, 7],
      [8, 1.01, 12],
    ],
    Dante: [
      [2, 2.4, 1.5],
      [4, 1.45, 2.5],
      [5, 1.15, 4],
      [6, 1.05, 7],
      [7, 1.01, 12],
      [8, 1, 20],
    ],
    "Gonza Boca": [
      [2, 2.4, 1.5],
      [4, 1.45, 2.5],
      [5, 1.15, 4],
      [6, 1.05, 7],
      [7, 1.01, 12],
      [8, 1, 20],
    ],
    "Jesús": [
      [2, 1.6, 2.2],
      [4, 1.1, 6],
      [5, 1.02, 12],
      [6, 1, 20],
    ],
    Rocco: [
      [2, 1.6, 2.2],
      [4, 1.1, 6],
      [5, 1.02, 12],
      [6, 1, 20],
    ],
    Fran: [
      [2, 1.2, 4],
      [4, 1.01, 15],
      [5, 1, 30],
    ],
    Pipa: [
      [2, 1.05, 10],
      [4, 1, 50],
      [5, 1, 100],
    ],
    "Gonza R": [
      [2, 1.05, 10],
      [4, 1, 50],
      [5, 1, 100],
    ],
    Ivi: [
      [2, 1.05, 10],
      [4, 1, 50],
      [5, 1, 100],
    ],
  };
  Object.keys(eatenMarkets).forEach(function (person) {
    addOverUnder(
      "Minas",
      "Cantidad de minas comidas por " + person,
      eatenMarkets[person],
    );
  });

  addYesNo("Minas", "¿Romi se come a una mina?", 100, 1.002);

  addNames("Minas", "¿Quién se comerá más minas durante todo el viaje?", [
    ["Nico", 3.5],
    ["Juanpi", 3.5],
    ["Capu", 5],
    ["Jane", 5],
    ["Dante", 6],
    ["Gonza Boca", 6],
    ["Jesús", 10],
    ["Rocco", 10],
    ["Fran", 20],
    ["Pipa", 50],
    ["Ivi", 50],
    ["Gonza R", 50],
  ]);

  const differentRoomMarkets = {
    Nico: [
      [1, 2, 1.95],
      [2, 1.45, 2.5],
      [3, 1.15, 5],
    ],
    Juanpi: [
      [1, 2, 1.95],
      [2, 1.35, 2.8],
      [3, 1.1, 6],
    ],
    Capu: [
      [1, 1.5, 2],
      [2, 1.15, 5],
      [3, 1.02, 12],
    ],
    Jane: [
      [1, 1.5, 2],
      [2, 1.15, 5],
      [3, 1.02, 12],
    ],
    Dante: [
      [1, 1.5, 2.5],
      [2, 1.08, 7],
      [3, 1.01, 15],
    ],
    "Gonza Boca": [
      [1, 1.45, 1.1],
      [2, 1.08, 3],
      [3, 1.01, 15],
    ],
    "Jesús": [
      [1, 1.2, 3],
      [2, 1.02, 12],
      [3, 1, 25],
    ],
    Rocco: [
      [1, 1.2, 3],
      [2, 1.02, 12],
      [3, 1, 25],
    ],
    Fran: [
      [1, 1.08, 7],
      [2, 1.01, 25],
      [3, 1, 60],
    ],
    Pipa: [
      [1, 1.02, 20],
      [2, 1, 75],
      [3, 1, 150],
    ],
    Ivi: [
      [1, 1.02, 20],
      [2, 1, 75],
      [3, 1, 150],
    ],
    "Gonza R": [
      [1, 1.02, 20],
      [2, 1, 75],
      [3, 1, 150],
    ],
    Romi: [
      [1, 1, 300],
      [2, 1, 1000],
      [3, 1, 5000],
    ],
  };
  Object.keys(differentRoomMarkets).forEach(function (person) {
    addOverUnder(
      "Minas",
      "Cantidad de minas diferentes llevadas a la pieza por " + person,
      differentRoomMarkets[person],
    );
  });

  const totalRoomMarkets = {
    Nico: [
      [1, 3.5, 1.25],
      [3, 1.35, 2.8],
      [5, 1.03, 15],
    ],
    Juanpi: [
      [1, 3.2, 1.3],
      [3, 1.3, 3],
      [5, 1.02, 18],
    ],
    Capu: [
      [1, 2.2, 1.6],
      [3, 1.15, 5],
      [5, 1.01, 30],
    ],
    Jane: [
      [1, 2.2, 1.6],
      [3, 1.15, 5],
      [5, 1.01, 30],
    ],
    Dante: [
      [1, 1.7, 2],
      [3, 1.08, 7],
      [5, 1, 40],
    ],
    "Gonza Boca": [
      [1, 1.7, 2],
      [3, 1.08, 7],
      [5, 1, 40],
    ],
    "Jesús": [
      [1, 1.25, 3.5],
      [3, 1.03, 15],
      [5, 1, 75],
    ],
    Rocco: [
      [1, 1.25, 3.5],
      [3, 1.03, 15],
      [5, 1, 75],
    ],
    Fran: [
      [1, 1.06, 8],
      [3, 1, 40],
      [5, 1, 150],
    ],
    Pipa: [
      [1, 1.01, 25],
      [3, 1, 150],
      [5, 1, 500],
    ],
    Ivi: [
      [1, 1.01, 25],
      [3, 1, 150],
      [5, 1, 500],
    ],
    "Gonza R": [
      [1, 1.01, 25],
      [3, 1, 150],
      [5, 1, 500],
    ],
    "Romi (novia)": [
      [1, 1, 300],
      [3, 1, 3000],
      [5, 1, 10000],
    ],
  };
  Object.keys(totalRoomMarkets).forEach(function (person) {
    addOverUnder(
      "Minas",
      "Cantidad total de minas llevadas a la pieza por " + person,
      totalRoomMarkets[person],
    );
  });

  addYesNo(
    "Minas",
    "¿Alguien llevará minas a la pieza más de 5 veces durante todo el viaje?",
    8,
    1.002,
  );
  addNames("Minas", "¿Quién pedirá más Instagram durante el viaje?", [
    ["Nico", 3.5],
    ["Juanpi", 4],
    ["Capu", 5],
    ["Jane", 5.5],
    ["Dante", 6],
    ["Gonza Boca", 6],
    ["Jesús", 8],
    ["Rocco", 8],
    ["Fran", 12],
    ["Pipa", 20],
    ["Ivi", 20],
    ["Gonza R", 20],
    ["Romi", 30],
  ]);
  addYesNo("Minas", "¿El líder de Instagram pedirá más de 15?", 2.2, 1.3);
  addYesNo("Minas", "¿Alguien estará con la coordinadora?", 15, 1.01);
  addYesNo(
    "Minas",
    "¿Alguien conseguirá que la coordinadora le devuelva el follow?",
    4,
    1.02,
  );

  return markets;
}

function requireAdmin_(payload) {
  const username = validateUsername_(payload.usuario);
  const token = String(payload.admin_token || "");
  if (!token) throw new Error("Falta la sesión de administrador.");

  const cachedUser = CacheService.getScriptCache().get("admin_session_" + token);
  if (!cachedUser || normalizeKey_(cachedUser) !== normalizeKey_(username)) {
    throw new Error("La sesión de administrador venció. Volvé a ingresar la clave.");
  }

  const user = requireUser_(username);
  if (user.rol !== "admin") throw new Error("El usuario no tiene rol de administrador.");
  return user;
}

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getDatabase_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf("PEGA_AQUI") !== -1) {
    throw new Error("Configurá SPREADSHEET_ID en apps-script.gs.");
  }
  if (!databaseInstance_) {
    databaseInstance_ = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return databaseInstance_;
}

function getRoomCombinationsSheet_() {
  if (sheetInstanceCache_[SHEETS.ROOM_COMBINATIONS]) {
    return sheetInstanceCache_[SHEETS.ROOM_COMBINATIONS];
  }
  const sheet = ensureSheet_(
    getDatabase_(),
    SHEETS.ROOM_COMBINATIONS,
    HEADERS.HabitacionCombinadas,
  );
  sheetInstanceCache_[SHEETS.ROOM_COMBINATIONS] = sheet;
  return sheet;
}

function getSheet_(name) {
  if (sheetInstanceCache_[name]) return sheetInstanceCache_[name];
  const sheet = getDatabase_().getSheetByName(name);
  if (!sheet) {
    throw new Error(
      "Falta la hoja “" + name + "”. Ejecutá setupCasino() desde Apps Script.",
    );
  }
  if (name === SHEETS.MARKETS) {
    ensureOptionalColumns_(sheet, [
      "fecha_limite_cancelacion",
      "fecha_limite_apuesta",
      "permitir_apuesta_propia",
    ]);
  }
  sheetInstanceCache_[name] = sheet;
  return sheet;
}

function migrateCasinoSchema_(spreadsheet) {
  const marketsSheet = spreadsheet.getSheetByName(SHEETS.MARKETS);
  if (marketsSheet) {
    ensureOptionalColumns_(marketsSheet, [
      "fecha_limite_cancelacion",
      "fecha_limite_apuesta",
      "permitir_apuesta_propia",
    ]);
  }
  ensureSheet_(spreadsheet, SHEETS.ROOM_COMBINATIONS, HEADERS.HabitacionCombinadas);
}

function ensureOptionalColumns_(sheet, columns) {
  if (sheet.getLastRow() === 0) return;

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(String);

  columns.forEach(function (column, columnIndex) {
    if (existingHeaders.indexOf(column) !== -1) return;

    let nextExistingColumn = -1;
    for (let nextIndex = columnIndex + 1; nextIndex < columns.length; nextIndex += 1) {
      nextExistingColumn = existingHeaders.indexOf(columns[nextIndex]);
      if (nextExistingColumn !== -1) break;
    }

    if (nextExistingColumn !== -1) {
      const targetColumn = nextExistingColumn + 1;
      sheet.insertColumnBefore(targetColumn);
      sheet.getRange(1, targetColumn).setValue(column);
      existingHeaders.splice(nextExistingColumn, 0, column);
      return;
    }

    const nextColumn = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextColumn).setValue(column);
    existingHeaders.push(column);
  });
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const currentHeaders = sheet
      .getRange(1, 1, 1, headers.length)
      .getValues()[0]
      .map(String);
    if (currentHeaders.join("|") !== headers.join("|")) {
      throw new Error(
        "Los encabezados de la hoja “" +
          name +
          "” no coinciden. Se esperaba: " +
          headers.join(", "),
      );
    }
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function formatSheets_() {
  const spreadsheet = getDatabase_();
  Object.keys(HEADERS).forEach(function (name) {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return;
    const headerRange = sheet.getRange(1, 1, 1, HEADERS[name].length);
    headerRange
      .setBackground("#173a29")
      .setFontColor("#f3d98f")
      .setFontWeight("bold");
    sheet.autoResizeColumns(1, HEADERS[name].length);
  });
}

function getRowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length || values.length === 1) return [];
  const headers = values[0].map(String);
  const rows = [];
  for (let row = 1; row < values.length; row += 1) {
    if (values[row].every(function (cell) { return cell === ""; })) continue;
    const object = { _row: row + 1 };
    headers.forEach(function (header, column) {
      object[header] = values[row][column];
    });
    rows.push(object);
  }
  return rows;
}

function headerIndex_(sheet, header) {
  const cacheKey = sheet.getName() + ":" + sheet.getLastColumn();
  if (!headerIndexCache_[cacheKey]) {
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(String);
    headerIndexCache_[cacheKey] = indexMap_(headers);
  }
  const index = headerIndexCache_[cacheKey][header];
  if (index === undefined) {
    throw new Error("Falta la columna " + header + " en " + sheet.getName() + ".");
  }
  if (index === -1) throw new Error("Falta la columna “" + header + "” en " + sheet.getName() + ".");
  return index + 1;
}

function indexMap_(headers) {
  const result = {};
  headers.forEach(function (header, index) {
    result[String(header)] = index;
  });
  return result;
}

function getConfigMap_() {
  const result = {};
  getRowsAsObjects_(getSheet_(SHEETS.CONFIG)).forEach(function (row) {
    result[String(row.clave)] = row.valor;
  });
  return result;
}

function requireUser_(username) {
  const canonicalUsername = canonicalAllowedUsername_(validateUsername_(username));
  const user = findUser_(
    getRowsAsObjects_(getSheet_(SHEETS.USERS)),
    canonicalUsername,
  );
  if (!user) throw new Error("Usuario no encontrado.");
  return user;
}

function findUser_(users, username) {
  const key = normalizeKey_(username);
  return users.find(function (user) {
    return normalizeKey_(user.usuario) === key;
  });
}

function canonicalAllowedUsername_(username) {
  const key = normalizeKey_(username);
  const allowedUsername = ALLOWED_USERS.find(function (allowed) {
    return normalizeKey_(allowed) === key;
  });
  if (!allowedUsername) throw new Error("Usuario no habilitado para esta app.");
  return allowedUsername;
}

function createAllowedUser_(usersSheet, users, username) {
  const config = getConfigMap_();
  const initialBalance = positiveNumber_(config.saldo_inicial, "El saldo inicial configurado");
  const adminUser = String(config.admin_user || "Nico");
  const now = new Date();
  const user = {
    id: nextId_(users),
    usuario: username,
    saldo: initialBalance,
    rol: normalizeKey_(username) === normalizeKey_(adminUser) ? "admin" : "user",
    fecha_registro: now,
  };

  usersSheet.appendRow([user.id, user.usuario, user.saldo, user.rol, user.fecha_registro]);
  appendMovement_(username, "Registro", initialBalance, "Saldo inicial", now);
  clearDataCaches_();
  return user;
}

function requireMarket_(marketId, optionalSheet) {
  const sheet = optionalSheet || getSheet_(SHEETS.MARKETS);
  const market = getRowsAsObjects_(sheet).find(function (item) {
    return String(item.id) === String(marketId);
  });
  if (!market) throw new Error("Mercado no encontrado.");
  return market;
}

function isRoomCountMarket_(market) {
  return (
    normalizeKey_(market.categoria) === normalizeKey_(ROOM_CATEGORY) &&
    normalizeKey_(market.evento) === normalizeKey_(ROOM_COUNT_EVENT)
  );
}

function parseRoomSize_(value) {
  const match = String(value || "").match(/\d+/);
  if (!match) throw new Error("No se pudo leer la cantidad de personas de la habitación.");
  return requiredRoomSize_(match[0]);
}

function requiredRoomSize_(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 3 || parsed > 10) {
    throw new Error("La cantidad real de personas debe ser un entero entre 3 y 10.");
  }
  return parsed;
}

function validateRoomCompanionSelection_(value, username, requiredCount, options) {
  const config = options || {};
  const label = config.label || "La selección de compañeros";
  const companionMap = getRoomCompanionMap_();
  const seen = new Set();
  const names = [];
  let odds = 1;

  parseCompanionInput_(value).forEach(function (rawName) {
    const name = String(rawName || "").trim().replace(/\s+/g, " ");
    if (!name) return;
    const key = normalizeKey_(name);
    if (seen.has(key)) throw new Error("No se puede elegir dos veces a " + name + ".");
    if (!config.skipOwnUser && username && key === normalizeKey_(username)) {
      throw new Error("No podés seleccionarte como compañero.");
    }
    const companion = companionMap[key];
    if (!companion) throw new Error(name + " no es un compañero válido para la combinada.");
    seen.add(key);
    names.push(companion.name);
    odds *= companion.odds;
  });

  if (names.length !== requiredCount) {
    throw new Error(label + " debe tener exactamente " + requiredCount + " compañeros.");
  }

  return { names: names, odds: odds };
}

function parseCompanionInput_(value) {
  if (Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch (_error) {
    // El admin puede ingresar una lista separada por comas o saltos de línea.
  }
  return text.split(/[,;\n]+/);
}

function getRoomCompanionMap_() {
  const map = {};
  ROOM_COMPANIONS.forEach(function (entry) {
    map[normalizeKey_(entry[0])] = { name: entry[0], odds: number_(entry[1]) };
  });
  return map;
}

function parseCompanionsJson_(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed)
      ? parsed.map(function (name) { return String(name); })
      : [];
  } catch (_error) {
    return [];
  }
}

function sameCompanionSet_(left, right) {
  const leftKeys = left.map(normalizeKey_).sort();
  const rightKeys = right.map(normalizeKey_).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(function (key, index) {
    return key === rightKeys[index];
  });
}

function appendMovement_(username, type, amount, description, date) {
  const sheet = getSheet_(SHEETS.MOVEMENTS);
  const movement = {
    id: nextSheetId_(sheet, "id"),
    usuario: username,
    tipo: type,
    monto: roundNumber_(amount),
    descripcion: description,
    fecha: date || new Date(),
  };
  sheet.appendRow([
    movement.id,
    username,
    type,
    movement.monto,
    description,
    movement.fecha,
  ]);
  return serializeMovement_(movement);
}

function appendMovementRows_(rows) {
  if (!rows.length) return;
  const sheet = getSheet_(SHEETS.MOVEMENTS);
  let id = nextSheetId_(sheet, "id");
  rows.forEach(function (row) {
    row[0] = id;
    id += 1;
  });
  sheet
    .getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.Movimientos.length)
    .setValues(rows);
}

function nextId_(rows) {
  return (
    rows.reduce(function (maximum, row) {
      return Math.max(maximum, number_(row.id));
    }, 0) + 1
  );
}

function nextSheetId_(sheet, header) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  const idColumn = headerIndex_(sheet, header || "id");
  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  return (
    values.reduce(function (maximum, row) {
      return Math.max(maximum, number_(row[0]));
    }, 0) + 1
  );
}

function validateUsername_(value) {
  const username = String(value || "").trim().replace(/\s+/g, " ");
  if (!username) throw new Error("El nombre de usuario no puede estar vacío.");
  if (username.length < 2 || username.length > 30) {
    throw new Error("El nombre debe tener entre 2 y 30 caracteres.");
  }
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_. -]+$/.test(username)) {
    throw new Error("El nombre contiene caracteres no permitidos.");
  }
  if (/^[=+@-]/.test(username)) {
    throw new Error("El nombre no puede comenzar con ese carácter.");
  }
  return username;
}

function requiredText_(value, label, maximumLength) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) throw new Error(label + " no puede estar vacío.");
  if (maximumLength && text.length > maximumLength) {
    throw new Error(label + " supera el máximo de " + maximumLength + " caracteres.");
  }
  return text;
}

function requiredId_(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("El ID de " + label + " no es válido.");
  }
  return parsed;
}

function positiveNumber_(value, label) {
  const parsed = finiteNumber_(value, label);
  if (parsed <= 0) throw new Error(label + " debe ser mayor a cero.");
  return parsed;
}

function finiteNumber_(value, label) {
  const normalized =
    typeof value === "string" ? value.trim().replace(",", ".") : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(label + " debe ser un número válido.");
  return parsed;
}

function optionalDate_(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(label + " debe ser una fecha válida.");
  }
  return parsed;
}

function number_(value) {
  if (typeof value === "string") value = value.trim().replace(",", ".");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolean_(value) {
  if (value === true) return true;
  if (value === false) return false;
  const key = normalizeKey_(value);
  return ["true", "si", "sí", "1", "yes"].includes(key);
}

function roundNumber_(value) {
  return Math.round((number_(value) + Number.EPSILON) * 1000) / 1000;
}

function normalizeKey_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatPlainNumber_(value) {
  const parsed = number_(value);
  return Number.isInteger(parsed) ? String(parsed) : String(parsed);
}

function categoryPosition_(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function toIso_(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function serializeUser_(user) {
  return {
    id: user.id,
    usuario: String(user.usuario),
    saldo: number_(user.saldo),
    rol: String(user.rol),
    fecha_registro: toIso_(user.fecha_registro),
  };
}

function serializeOption_(option) {
  return {
    id: option.id,
    mercado_id: option.mercado_id,
    opcion: String(option.opcion),
    linea: option.linea === "" ? "" : number_(option.linea),
    lado: String(option.lado || ""),
    cuota: number_(option.cuota),
  };
}

function serializeMovement_(movement) {
  return {
    id: movement.id,
    usuario: String(movement.usuario),
    tipo: String(movement.tipo),
    monto: number_(movement.monto),
    descripcion: String(movement.descripcion),
    fecha: toIso_(movement.fecha),
  };
}

function serializeRoomCombination_(combination) {
  const companions = parseCompanionsJson_(combination.companeros_json);
  const roomSize = number_(combination.cantidad_personas);
  return {
    id: combination.id,
    usuario: String(combination.usuario),
    mercado_cantidad_id: combination.mercado_cantidad_id,
    apuesta_cantidad_id: combination.apuesta_cantidad_id,
    cantidad_personas: roomSize,
    companeros: companions,
    companeros_text: companions.join(", "),
    cuota_cantidad: number_(combination.cuota_cantidad),
    cuota_companeros: number_(combination.cuota_companeros),
    cuota_total: number_(combination.cuota_total),
    monto: number_(combination.monto),
    estado: String(combination.estado),
    pago: number_(combination.pago),
    fecha: toIso_(combination.fecha),
    evento: ROOM_COMBINATION_EVENT,
    opcion: roomSize + " personas · " + companions.join(", "),
    cuota: number_(combination.cuota_total),
    tipo_apuesta: "HABITACION_COMBINADA",
  };
}

function serializeBet_(bet, marketMap) {
  const market = marketMap[String(bet.mercado_id)];
  return {
    id: bet.id,
    usuario: String(bet.usuario),
    mercado_id: bet.mercado_id,
    evento: market ? String(market.evento) : "",
    opcion_id: bet.opcion_id,
    opcion: String(bet.opcion),
    tipo_mercado: String(bet.tipo_mercado),
    lado: String(bet.lado || ""),
    linea: bet.linea === "" ? "" : number_(bet.linea),
    monto: number_(bet.monto),
    cuota: number_(bet.cuota),
    estado: String(bet.estado),
    pago: number_(bet.pago),
    fecha: toIso_(bet.fecha),
  };
}

function sortByDateDesc_(a, b) {
  return new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime();
}
