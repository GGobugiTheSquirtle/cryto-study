const STORAGE_KEY_PREFIX = "manual_trader_quiz_answers_v2";
const DATASET_FILES = {
  10: "questions_10.json",
  20: "questions_20.json",
  30: "questions_30.json",
};
const DEFAULT_DATASET = "30";

const state = {
  payload: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  currentSet: DEFAULT_DATASET,
  currentDatasetFile: "questions.json",
  chart: null,
  series: {},
};

function fmt(value, digits = 2) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits) : "-";
}

function parseStop(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function byId(id) {
  return document.getElementById(id);
}

function getRequestedSet() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("set");
  if (requested && DATASET_FILES[requested]) {
    return requested;
  }
  return DEFAULT_DATASET;
}

function currentStorageKey() {
  return `${STORAGE_KEY_PREFIX}_${state.currentSet}`;
}

function loadAnswers() {
  try {
    const raw = localStorage.getItem(currentStorageKey());
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAnswers() {
  localStorage.setItem(currentStorageKey(), JSON.stringify(state.answers));
}

function updateSetSubtitle() {
  const sub = byId("set-sub");
  if (!sub) {
    return;
  }
  sub.textContent = `백테스트 기반 ${state.questions.length}문항 실전 퀴즈`;
}

function setupChart() {
  const el = byId("chart");
  if (!window.LightweightCharts) {
    el.innerHTML = "차트 라이브러리 로드 실패";
    return;
  }

  state.chart = LightweightCharts.createChart(el, {
    layout: {
      textColor: "#1d2a2a",
      background: { type: "solid", color: "#fffdf8" },
      fontFamily: "Noto Sans KR, sans-serif",
    },
    grid: {
      vertLines: { color: "#edf1ea" },
      horzLines: { color: "#edf1ea" },
    },
    rightPriceScale: {
      borderColor: "#d7d9d2",
    },
    timeScale: {
      borderColor: "#d7d9d2",
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
  });

  state.series.candle = state.chart.addCandlestickSeries({
    upColor: "#138a64",
    downColor: "#d24d44",
    borderVisible: false,
    wickUpColor: "#138a64",
    wickDownColor: "#d24d44",
  });

  state.series.ema20 = state.chart.addLineSeries({
    color: "#0f766e",
    lineWidth: 2,
    priceLineVisible: false,
  });
  state.series.ema50 = state.chart.addLineSeries({
    color: "#b45309",
    lineWidth: 2,
    priceLineVisible: false,
  });
  state.series.ema200 = state.chart.addLineSeries({
    color: "#475569",
    lineWidth: 2,
    priceLineVisible: false,
  });

  state.series.entry = state.chart.addLineSeries({
    color: "#1f2937",
    lineWidth: 1,
    lineStyle: 1,
    priceLineVisible: false,
  });
  state.series.stop = state.chart.addLineSeries({
    color: "#b91c1c",
    lineWidth: 2,
    lineStyle: 2,
    priceLineVisible: false,
  });
  state.series.t1 = state.chart.addLineSeries({
    color: "#166534",
    lineWidth: 2,
    lineStyle: 0,
    priceLineVisible: false,
  });
  state.series.t2 = state.chart.addLineSeries({
    color: "#14532d",
    lineWidth: 2,
    lineStyle: 2,
    priceLineVisible: false,
  });
  state.series.flip = state.chart.addLineSeries({
    color: "#c2410c",
    lineWidth: 2,
    lineStyle: 1,
    priceLineVisible: false,
  });

  const resize = () => {
    const width = el.clientWidth || 800;
    const height = el.clientHeight || 460;
    state.chart.applyOptions({ width, height });
  };

  resize();
  window.addEventListener("resize", resize);
}

function toBar(item) {
  return {
    time: Math.floor(Number(item.t) / 1000),
    open: Number(item.o),
    high: Number(item.h),
    low: Number(item.l),
    close: Number(item.c),
  };
}

function toLine(item, key) {
  return {
    time: Math.floor(Number(item.t) / 1000),
    value: Number(item[key]),
  };
}

function horizontalLineData(start, end, price) {
  return [
    { time: start, value: Number(price) },
    { time: end, value: Number(price) },
  ];
}

function renderChart(question, revealed) {
  if (!state.chart || !state.series.candle) {
    return;
  }

  const allBars = question.series.map(toBar);
  const cutoff = Number(question.reveal_index) + 1;
  const visibleBars = revealed ? allBars : allBars.slice(0, cutoff);
  const visibleSeries = revealed ? question.series : question.series.slice(0, cutoff);

  state.series.candle.setData(visibleBars);
  state.series.ema20.setData(visibleSeries.map((x) => toLine(x, "ema20")));
  state.series.ema50.setData(visibleSeries.map((x) => toLine(x, "ema50")));
  state.series.ema200.setData(visibleSeries.map((x) => toLine(x, "ema200")));

  const start = visibleBars[0]?.time;
  const end = visibleBars[visibleBars.length - 1]?.time;

  if (!start || !end) {
    return;
  }

  if (revealed) {
    const fullStart = allBars[0]?.time;
    const fullEnd = allBars[allBars.length - 1]?.time;
    const answer = question.answer;

    state.series.entry.setData(horizontalLineData(fullStart, fullEnd, question.entry_price));
    state.series.stop.setData(horizontalLineData(fullStart, fullEnd, answer.recommended_stop_price));
    state.series.t1.setData(horizontalLineData(fullStart, fullEnd, answer.target_1_price));
    state.series.t2.setData(horizontalLineData(fullStart, fullEnd, answer.target_2_price));
    state.series.flip.setData(horizontalLineData(fullStart, fullEnd, answer.flip_price));

    state.series.candle.setMarkers([
      {
        time: Math.floor(Number(question.series[question.reveal_index].t) / 1000),
        position: answer.direction === "long" ? "belowBar" : "aboveBar",
        color: answer.direction === "long" ? "#166534" : "#b91c1c",
        shape: answer.direction === "long" ? "arrowUp" : "arrowDown",
        text: `${question.id} entry`,
      },
    ]);
  } else {
    state.series.entry.setData([]);
    state.series.stop.setData([]);
    state.series.t1.setData([]);
    state.series.t2.setData([]);
    state.series.flip.setData([]);
    state.series.candle.setMarkers([]);
  }

  state.chart.timeScale().fitContent();
}

function renderQuestionList() {
  const wrap = byId("question-list");
  wrap.innerHTML = "";

  state.questions.forEach((q, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "q-item";

    const ans = state.answers[q.id];
    if (idx === state.currentIndex) {
      btn.classList.add("active");
    }
    if (ans?.breakdown) {
      btn.classList.add("done");
    }

    const left = document.createElement("span");
    left.textContent = `${q.id} ${q.symbol}`;

    const right = document.createElement("span");
    right.className = "score";
    right.textContent = ans?.breakdown ? `${ans.breakdown.total}점` : "-";

    btn.append(left, right);
    btn.addEventListener("click", () => {
      state.currentIndex = idx;
      renderCurrent();
    });
    wrap.appendChild(btn);
  });
}

function updateGlobalStats() {
  const done = Object.values(state.answers).filter((x) => x && x.breakdown);
  const count = state.questions.length;
  const avg = done.length
    ? done.reduce((acc, x) => acc + Number(x.breakdown.total || 0), 0) / done.length
    : 0;

  byId("stat-count").textContent = String(count);
  byId("stat-done").textContent = String(done.length);
  byId("stat-avg").textContent = fmt(avg, 1);
}

function setFormValues(answer) {
  document.querySelectorAll('input[name="direction"]').forEach((el) => {
    el.checked = Boolean(answer?.input?.direction && el.value === answer.input.direction);
  });
  document.querySelectorAll('input[name="move"]').forEach((el) => {
    el.checked = Boolean(answer?.input?.move && el.value === answer.input.move);
  });
  byId("stop-input").value = answer?.input?.stop ?? "";
}

function readFormValues() {
  const direction = document.querySelector('input[name="direction"]:checked')?.value || "";
  const move = document.querySelector('input[name="move"]:checked')?.value || "";
  const stopRaw = byId("stop-input").value;
  const stop = parseStop(stopRaw);
  return {
    direction,
    move,
    stop: Number.isFinite(stop) ? stop : NaN,
  };
}

function scoreStop(inputStop, recommended, direction, entry) {
  if (!Number.isFinite(inputStop)) {
    return 0;
  }
  if (direction === "long" && inputStop >= entry) {
    return 0;
  }
  if (direction === "short" && inputStop <= entry) {
    return 0;
  }

  const distPct = (Math.abs(inputStop - recommended) / entry) * 100;
  if (distPct <= 0.2) {
    return 25;
  }
  if (distPct <= 0.4) {
    return 20;
  }
  if (distPct <= 0.8) {
    return 12;
  }
  if (distPct <= 1.2) {
    return 6;
  }
  return 0;
}

function grade(question, input) {
  const answer = question.answer;
  const directionScore = input.direction === answer.direction ? 50 : 0;
  const moveScore = input.move === answer.move_bucket ? 25 : 0;
  const stopScore = scoreStop(
    input.stop,
    Number(answer.recommended_stop_price),
    answer.direction,
    Number(question.entry_price),
  );

  return {
    direction: directionScore,
    move: moveScore,
    stop: stopScore,
    total: directionScore + moveScore + stopScore,
  };
}

function renderScore(answer) {
  const breakdown = answer?.breakdown || { direction: 0, move: 0, stop: 0, total: 0 };
  byId("score-dir").textContent = String(breakdown.direction);
  byId("score-move").textContent = String(breakdown.move);
  byId("score-stop").textContent = String(breakdown.stop);
  byId("score-total").textContent = `${breakdown.total} / 100`;
}

function renderSnapshot(question) {
  const s = question.indicator_snapshot;
  const html = [
    ["EMA stack", s.ema_stack],
    ["RSI14", fmt(s.rsi14, 2)],
    ["ATR14%", fmt(s.atr14_pct, 3)],
    ["Vol ratio20", fmt(s.vol_ratio20, 2)],
    ["Range expansion", fmt(s.range_expansion, 2)],
    ["Trap score", fmt(s.trap_score, 1)],
  ]
    .map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`)
    .join("");
  byId("snapshot").innerHTML = html;
}

function renderHints(question) {
  byId("mindset").textContent = question.mindset;
  byId("hint-list").innerHTML = question.hints.map((h) => `<li>${h}</li>`).join("");
}

function renderAnswerPanel(question, answer) {
  const panel = byId("answer-panel");

  if (!answer?.breakdown) {
    panel.innerHTML = "<p>채점을 먼저 진행하세요.</p>";
    return;
  }

  if (!answer.revealed) {
    panel.innerHTML = `<p>현재 점수: <strong>${answer.breakdown.total} / 100</strong><br/>정답 공개를 누르면 목표가/반전가/함정 포인트를 확인할 수 있습니다.</p>`;
    return;
  }

  const a = question.answer;
  const b = question.backtest_ref;
  const directionClass = a.direction === "long" ? "up" : "down";
  panel.innerHTML = `
    <p>
      정답 방향: <strong class="${directionClass}">${a.direction.toUpperCase()}</strong> /
      예상 강도: <strong>${a.move_bucket.toUpperCase()}</strong> /
      실제 확장: <strong>${fmt(a.move_pct, 3)}%</strong>
    </p>
    <p>
      권장 스탑: <strong>${fmt(a.recommended_stop_price, 4)}</strong> (${fmt(a.recommended_stop_pct, 3)}%) |
      Flip: <strong>${fmt(a.flip_price, 4)}</strong>
    </p>
    <p>
      Target1: <strong>${fmt(a.target_1_price, 4)}</strong> |
      Target2: <strong>${fmt(a.target_2_price, 4)}</strong> |
      Adverse: <strong>${fmt(a.adverse_pct, 3)}%</strong>
    </p>
    <p>
      Backtest ref: ${b.trade_direction} / pnl ${fmt(b.trade_pnl, 4)} / bars ${b.bars_held} / exit ${b.exit_reason}
    </p>
  `;
}

function renderCurrent() {
  const question = state.questions[state.currentIndex];
  if (!question) {
    byId("case-title").textContent = "문항 로드 실패";
    byId("case-meta").textContent = `Dataset: ${state.currentDatasetFile}`;
    byId("answer-panel").innerHTML = "<p>문항 데이터가 없습니다.</p>";
    updateGlobalStats();
    renderQuestionList();
    return;
  }

  const answer = state.answers[question.id];

  byId("case-title").textContent = `${question.id} ${question.symbol} ${question.timeframe} ${question.case_type}`;
  byId("case-meta").textContent = `Entry ${question.entry_time_kst} | UTC ${question.entry_time_utc} | regime ${question.regime} | session ${question.session} | entry ${fmt(question.entry_price, 4)}`;

  const revealed = Boolean(answer?.revealed);
  const badge = byId("reveal-badge");
  badge.textContent = revealed ? "Revealed" : "Hidden";
  badge.classList.toggle("revealed", revealed);

  renderHints(question);
  renderSnapshot(question);
  renderScore(answer);
  renderAnswerPanel(question, answer);
  setFormValues(answer);
  renderChart(question, revealed);

  byId("prev-btn").disabled = state.currentIndex === 0;
  byId("next-btn").disabled = state.currentIndex === state.questions.length - 1;

  renderQuestionList();
  updateGlobalStats();
}

function gradeCurrent() {
  const question = state.questions[state.currentIndex];
  if (!question) {
    return;
  }

  const input = readFormValues();

  if (!input.direction || !input.move) {
    byId("answer-panel").innerHTML = "<p>방향/강도를 먼저 선택하세요.</p>";
    return;
  }

  const breakdown = grade(question, input);
  const prev = state.answers[question.id] || {};

  state.answers[question.id] = {
    ...prev,
    input: {
      direction: input.direction,
      move: input.move,
      stop: Number.isFinite(input.stop) ? input.stop : null,
    },
    breakdown,
    updated_at: new Date().toISOString(),
    revealed: Boolean(prev.revealed),
  };

  saveAnswers();
  renderCurrent();
}

function revealCurrent() {
  const question = state.questions[state.currentIndex];
  if (!question) {
    return;
  }

  const answer = state.answers[question.id];

  if (!answer?.breakdown) {
    gradeCurrent();
  }

  const latest = state.answers[question.id];
  if (!latest?.breakdown) {
    return;
  }

  latest.revealed = true;
  state.answers[question.id] = latest;
  saveAnswers();
  renderCurrent();
}

function bindEvents() {
  byId("prev-btn").addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderCurrent();
    }
  });

  byId("next-btn").addEventListener("click", () => {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex += 1;
      renderCurrent();
    }
  });

  byId("grade-btn").addEventListener("click", gradeCurrent);
  byId("reveal-btn").addEventListener("click", revealCurrent);

  const setSelect = byId("set-select");
  if (setSelect) {
    setSelect.value = state.currentSet;
    setSelect.addEventListener("change", (event) => {
      const nextSet = String(event.target.value || "");
      if (!DATASET_FILES[nextSet] || nextSet === state.currentSet) {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      params.set("set", nextSet);
      window.location.search = params.toString();
    });
  }
}

async function loadDataset(setKey) {
  state.currentSet = setKey;
  state.currentDatasetFile = DATASET_FILES[setKey] || "questions.json";

  let res = await fetch(`./${state.currentDatasetFile}`, { cache: "no-store" });
  if (!res.ok && state.currentDatasetFile !== "questions.json") {
    state.currentDatasetFile = "questions.json";
    res = await fetch("./questions.json", { cache: "no-store" });
  }
  if (!res.ok) {
    throw new Error(`${state.currentDatasetFile} load failed: ${res.status}`);
  }

  state.payload = await res.json();
  state.questions = state.payload.questions || [];
  state.currentIndex = 0;
  state.answers = loadAnswers();
  updateSetSubtitle();
}

async function init() {
  const setKey = getRequestedSet();
  await loadDataset(setKey);
  setupChart();
  bindEvents();
  renderCurrent();
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    const title = byId("case-title");
    if (title) {
      title.textContent = "로드 실패";
    }
    const meta = byId("case-meta");
    if (meta) {
      meta.textContent = String(err.message || err);
    }
  });
});
