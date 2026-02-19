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
  activeTf: "1h",
  overlays: {
    ema: true,
    bb: true,
    structure: true,
  },
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

function dirKo(direction) {
  return direction === "long" ? "롱" : direction === "short" ? "숏" : "-";
}

function moveKo(bucket) {
  if (bucket === "weak") {
    return "약함";
  }
  if (bucket === "mid") {
    return "중간";
  }
  if (bucket === "strong") {
    return "강함";
  }
  return "-";
}

function caseTypeKo(value) {
  if (value === "winner_case") {
    return "수익 케이스";
  }
  if (value === "trap_case") {
    return "함정 케이스";
  }
  return value || "-";
}

function emaStackKo(value) {
  if (value === "bull") {
    return "상승 정렬";
  }
  if (value === "bear") {
    return "하락 정렬";
  }
  if (value === "mixed") {
    return "혼합";
  }
  return value || "-";
}

function tfKo(tf) {
  if (tf === "1h") {
    return "1시간봉";
  }
  if (tf === "15m") {
    return "15분봉";
  }
  if (tf === "5m") {
    return "5분봉";
  }
  return tf || "-";
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

  state.series.bbUpper = state.chart.addLineSeries({
    color: "#7c3aed",
    lineWidth: 1,
    priceLineVisible: false,
  });
  state.series.bbLower = state.chart.addLineSeries({
    color: "#7c3aed",
    lineWidth: 1,
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

  state.series.structureHigh = state.chart.addLineSeries({
    color: "#0ea5e9",
    lineWidth: 1,
    lineStyle: 2,
    priceLineVisible: false,
  });
  state.series.structureLow = state.chart.addLineSeries({
    color: "#0ea5e9",
    lineWidth: 1,
    lineStyle: 2,
    priceLineVisible: false,
  });
  state.series.structureVwap = state.chart.addLineSeries({
    color: "#d97706",
    lineWidth: 1,
    lineStyle: 1,
    priceLineVisible: false,
  });
  state.series.trendGuide = state.chart.addLineSeries({
    color: "#0f766e",
    lineWidth: 2,
    lineStyle: 0,
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
  const num = Number(price);
  if (!Number.isFinite(num)) {
    return [];
  }
  return [
    { time: start, value: num },
    { time: end, value: num },
  ];
}

function clearOverlaySeries() {
  state.series.ema20.setData([]);
  state.series.ema50.setData([]);
  state.series.ema200.setData([]);
  state.series.bbUpper.setData([]);
  state.series.bbLower.setData([]);
  state.series.entry.setData([]);
  state.series.stop.setData([]);
  state.series.t1.setData([]);
  state.series.t2.setData([]);
  state.series.flip.setData([]);
  state.series.structureHigh.setData([]);
  state.series.structureLow.setData([]);
  state.series.structureVwap.setData([]);
  state.series.trendGuide.setData([]);
  state.series.candle.setMarkers([]);
}

function setRevealLineOptions(revealed) {
  state.series.stop.applyOptions({
    priceLineVisible: revealed,
    lastValueVisible: revealed,
  });
  state.series.t1.applyOptions({
    priceLineVisible: revealed,
    lastValueVisible: revealed,
  });
  state.series.t2.applyOptions({
    priceLineVisible: revealed,
    lastValueVisible: revealed,
  });
  state.series.flip.applyOptions({
    priceLineVisible: revealed,
    lastValueVisible: revealed,
  });
}

function getTfPayload(question, tf) {
  if (question?.timeframes && question.timeframes[tf]) {
    return question.timeframes[tf];
  }
  if (tf === "15m" && question?.series) {
    return {
      series: question.series,
      reveal_index: question.reveal_index,
      drawings: question.drawings || {},
      markers: question.markers || [],
      context_bars: question.reveal_index + 1,
      future_bars: Math.max(0, question.series.length - (question.reveal_index + 1)),
    };
  }
  return null;
}

function getAvailableTfs(question) {
  if (Array.isArray(question?.available_tfs) && question.available_tfs.length > 0) {
    return question.available_tfs;
  }
  if (question?.timeframes && typeof question.timeframes === "object") {
    return Object.keys(question.timeframes);
  }
  return ["15m"];
}

function normalizeActiveTf(question) {
  const available = getAvailableTfs(question);
  if (!available.includes(state.activeTf)) {
    if (available.includes("1h")) {
      state.activeTf = "1h";
    } else if (available.includes("15m")) {
      state.activeTf = "15m";
    } else {
      state.activeTf = available[0];
    }
  }
  return available;
}

function renderTfTabs(available) {
  document.querySelectorAll(".tf-tab").forEach((btn) => {
    const tf = btn.dataset.tf;
    const usable = available.includes(tf);
    btn.disabled = !usable;
    btn.style.opacity = usable ? "1" : "0.35";
    btn.classList.toggle("active", usable && tf === state.activeTf);
  });
}

function renderChart(question, revealed) {
  if (!state.chart || !state.series.candle) {
    return;
  }

  const tfPayload = getTfPayload(question, state.activeTf);
  if (!tfPayload || !Array.isArray(tfPayload.series) || tfPayload.series.length === 0) {
    clearOverlaySeries();
    return;
  }

  const allBars = tfPayload.series.map(toBar);
  const cutoff = Number(tfPayload.reveal_index) + 1;
  const visibleBars = revealed ? allBars : allBars.slice(0, cutoff);
  const visibleSeries = revealed ? tfPayload.series : tfPayload.series.slice(0, cutoff);

  if (visibleBars.length === 0) {
    clearOverlaySeries();
    return;
  }

  state.series.candle.setData(visibleBars);

  if (state.overlays.ema) {
    state.series.ema20.setData(visibleSeries.map((x) => toLine(x, "ema20")));
    state.series.ema50.setData(visibleSeries.map((x) => toLine(x, "ema50")));
    state.series.ema200.setData(visibleSeries.map((x) => toLine(x, "ema200")));
  } else {
    state.series.ema20.setData([]);
    state.series.ema50.setData([]);
    state.series.ema200.setData([]);
  }

  if (state.overlays.bb) {
    state.series.bbUpper.setData(visibleSeries.map((x) => toLine(x, "bb_u")));
    state.series.bbLower.setData(visibleSeries.map((x) => toLine(x, "bb_l")));
  } else {
    state.series.bbUpper.setData([]);
    state.series.bbLower.setData([]);
  }

  const start = visibleBars[0]?.time;
  const end = visibleBars[visibleBars.length - 1]?.time;
  if (!start || !end) {
    clearOverlaySeries();
    return;
  }

  const allStart = allBars[0]?.time;
  const allEnd = allBars[allBars.length - 1]?.time;
  const answer = question.answer || {};
  setRevealLineOptions(revealed);

  state.series.entry.setData(horizontalLineData(start, end, question.entry_price));
  if (revealed) {
    state.series.stop.setData(horizontalLineData(allStart, allEnd, answer.recommended_stop_price));
    state.series.t1.setData(horizontalLineData(allStart, allEnd, answer.target_1_price));
    state.series.t2.setData(horizontalLineData(allStart, allEnd, answer.target_2_price));
    state.series.flip.setData(horizontalLineData(allStart, allEnd, answer.flip_price));
  } else {
    state.series.stop.setData([]);
    state.series.t1.setData([]);
    state.series.t2.setData([]);
    state.series.flip.setData([]);
  }

  const drawings = tfPayload.drawings || {};
  if (state.overlays.structure) {
    state.series.structureHigh.setData(horizontalLineData(start, end, drawings.prev_high20));
    state.series.structureLow.setData(horizontalLineData(start, end, drawings.prev_low20));
    state.series.structureVwap.setData(horizontalLineData(start, end, drawings.vwap48));

    const trend = drawings.guide_trend;
    if (trend && Number.isFinite(Number(trend.t1)) && Number.isFinite(Number(trend.t2))) {
      const t1 = Math.floor(Number(trend.t1) / 1000);
      const t2 = Math.floor(Number(trend.t2) / 1000);
      const p1 = Number(trend.p1);
      const p2 = Number(trend.p2);
      if (revealed || t2 <= end) {
        state.series.trendGuide.setData([
          { time: t1, value: p1 },
          { time: t2, value: p2 },
        ]);
      } else {
        state.series.trendGuide.setData([]);
      }
    } else {
      state.series.trendGuide.setData([]);
    }
  } else {
    state.series.structureHigh.setData([]);
    state.series.structureLow.setData([]);
    state.series.structureVwap.setData([]);
    state.series.trendGuide.setData([]);
  }

  const markerLimitTime = end;
  const markers = [];
  if (state.overlays.structure && Array.isArray(tfPayload.markers)) {
    tfPayload.markers.forEach((m) => {
      const t = Math.floor(Number(m.t) / 1000);
      if (Number.isFinite(t) && t <= markerLimitTime) {
        markers.push({
          time: t,
          position: "aboveBar",
          color: "#0ea5e9",
          shape: "circle",
          text: String(m.text || "신호"),
        });
      }
    });
  }

  const revealBar = tfPayload.series[Number(tfPayload.reveal_index)];
  if (revealBar) {
    markers.push({
      time: Math.floor(Number(revealBar.t) / 1000),
      position: answer.direction === "long" ? "belowBar" : "aboveBar",
      color: answer.direction === "long" ? "#166534" : "#b91c1c",
      shape: answer.direction === "long" ? "arrowUp" : "arrowDown",
      text: revealed ? `${question.id} 진입` : `${question.id}`,
    });
  }

  if (revealed && allEnd) {
    const targetPosition = answer.direction === "long" ? "aboveBar" : "belowBar";
    const targetShape = answer.direction === "long" ? "arrowUp" : "arrowDown";
    markers.push({
      time: allEnd,
      position: targetPosition,
      color: "#166534",
      shape: targetShape,
      text: `권장 T1 ${fmt(answer.target_1_price, 4)}`,
    });
    markers.push({
      time: allEnd,
      position: targetPosition,
      color: "#14532d",
      shape: targetShape,
      text: `권장 T2 ${fmt(answer.target_2_price, 4)}`,
    });
  }

  markers.sort((a, b) => Number(a.time) - Number(b.time));
  state.series.candle.setMarkers(markers);
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
    ["EMA 정렬", emaStackKo(s.ema_stack)],
    ["RSI14", fmt(s.rsi14, 2)],
    ["ATR14%", fmt(s.atr14_pct, 3)],
    ["거래량 비율20", fmt(s.vol_ratio20, 2)],
    ["변동성 확장", fmt(s.range_expansion, 2)],
    ["트랩 점수", fmt(s.trap_score, 1)],
  ]
    .map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`)
    .join("");
  byId("snapshot").innerHTML = html;
}

function renderHints(question) {
  byId("mindset").textContent = question.mindset;
  byId("hint-list").innerHTML = (question.hints || []).map((h) => `<li>${h}</li>`).join("");
  byId("basis-list").innerHTML = (question.decision_basis || [])
    .map((h) => `<li>${h}</li>`)
    .join("");
}

function renderAnswerPanel(question, answer) {
  const panel = byId("answer-panel");

  if (!answer?.breakdown) {
    panel.innerHTML = "<p>채점을 먼저 진행하세요.</p>";
    return;
  }

  if (!answer.revealed) {
    panel.innerHTML = `<p>현재 점수: <strong>${answer.breakdown.total} / 100</strong><br/>정답 공개를 누르면 차트에 권장 타겟(T1/T2), 스탑, 반전가가 표시됩니다.</p>`;
    return;
  }

  const a = question.answer;
  const b = question.backtest_ref;
  const directionClass = a.direction === "long" ? "up" : "down";
  const directionText = dirKo(a.direction);
  const moveText = moveKo(a.move_bucket);
  panel.innerHTML = `
    <p>
      정답 방향: <strong class="${directionClass}">${directionText}</strong> /
      예상 강도: <strong>${moveText}</strong> /
      실제 확장: <strong>${fmt(a.move_pct, 3)}%</strong>
    </p>
    <p>
      권장 스탑: <strong>${fmt(a.recommended_stop_price, 4)}</strong> (${fmt(a.recommended_stop_pct, 3)}%) |
      반전 확인가: <strong>${fmt(a.flip_price, 4)}</strong>
    </p>
    <p>
      권장 타겟1: <strong>${fmt(a.target_1_price, 4)}</strong> |
      권장 타겟2: <strong>${fmt(a.target_2_price, 4)}</strong> |
      역행폭: <strong>${fmt(a.adverse_pct, 3)}%</strong>
    </p>
    <p>
      백테스트 참조: 방향 ${dirKo(b.trade_direction)} / 손익 ${fmt(b.trade_pnl, 4)} / 보유봉 ${b.bars_held} / 종료사유 ${b.exit_reason}
    </p>
  `;
}

function renderCurrent() {
  const question = state.questions[state.currentIndex];
  if (!question) {
    byId("case-title").textContent = "문항 로드 실패";
    byId("case-meta").textContent = `데이터 파일: ${state.currentDatasetFile}`;
    byId("answer-panel").innerHTML = "<p>문항 데이터가 없습니다.</p>";
    updateGlobalStats();
    renderQuestionList();
    return;
  }

  const answer = state.answers[question.id];
  const availableTfs = normalizeActiveTf(question);
  renderTfTabs(availableTfs);

  byId("case-title").textContent = `${question.id} ${question.symbol} ${question.timeframe} ${caseTypeKo(question.case_type)} | ${tfKo(state.activeTf)}`;
  byId("case-meta").textContent = `진입시각 ${question.entry_time_kst} | UTC ${question.entry_time_utc} | 레짐 ${question.regime} | 세션 ${question.session} | 진입가 ${fmt(question.entry_price, 4)} | 사용 TF ${availableTfs.map(tfKo).join(" / ")}`;

  const revealed = Boolean(answer?.revealed);
  const badge = byId("reveal-badge");
  badge.textContent = revealed ? "정답 공개" : "미공개";
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

  document.querySelectorAll(".tf-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tf = btn.dataset.tf;
      if (!tf || tf === state.activeTf || btn.disabled) {
        return;
      }
      state.activeTf = tf;
      renderCurrent();
    });
  });

  const emaToggle = byId("toggle-ema");
  const bbToggle = byId("toggle-bb");
  const structureToggle = byId("toggle-structure");

  emaToggle.checked = state.overlays.ema;
  bbToggle.checked = state.overlays.bb;
  structureToggle.checked = state.overlays.structure;

  emaToggle.addEventListener("change", () => {
    state.overlays.ema = Boolean(emaToggle.checked);
    renderCurrent();
  });
  bbToggle.addEventListener("change", () => {
    state.overlays.bb = Boolean(bbToggle.checked);
    renderCurrent();
  });
  structureToggle.addEventListener("change", () => {
    state.overlays.structure = Boolean(structureToggle.checked);
    renderCurrent();
  });

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
    throw new Error(`${state.currentDatasetFile} 불러오기 실패: ${res.status}`);
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
