const SOURCE_WIDTH = 1260;
const SOURCE_HEIGHT = 745;

// Koordinatlar, kaynak şemadaki gerçek ekipmanların kesileceği alanlardır.
const EQUIPMENT = [
  { id: "drain", name: "Boşaltma vanası", x: 124, y: 480, w: 33, h: 31, crop: { x: 124, y: 486, w: 33, h: 27 } },
  { id: "safety", name: "Emniyet ventili", x: 157, y: 480, w: 34, h: 40, crop: { x: 157, y: 486, w: 34, h: 34 } },
  { id: "boiler-pump", name: "Kazan pompası", x: 128, y: 500, w: 51, h: 59, crop: { x: 130, y: 507, w: 47, h: 50 } },
  { id: "air", name: "Hava tutucu", x: 296, y: 588, w: 39, h: 49, crop: { x: 297, y: 592, w: 38, h: 45 } },
  { id: "separator", name: "Denge kabı", x: 341, y: 516, w: 44, h: 216 },
  { id: "dirt", name: "Tortu tutucu", x: 501, y: 681, w: 33, h: 55 },
  { id: "filter", name: "Filtre", x: 534, y: 681, w: 37, h: 25 },
  { id: "system-pump", name: "Isıtma devresi pompası", x: 582, y: 437, w: 46, h: 54 }
];

// Oyun sırasında şema üzerinde cevabı açık eden ekipman yazıları kapatılır.
const ANSWER_LABELS = [
  { id: "drain", x: 112, y: 464, w: 46, h: 20 },
  { id: "safety", x: 157, y: 464, w: 44, h: 20 },
  { id: "air", x: 286, y: 565, w: 54, h: 25 },
  { id: "separator", x: 337, y: 550, w: 35, h: 104 },
  { id: "dirt", x: 480, y: 657, w: 57, h: 24 },
  { id: "filter", x: 535, y: 662, w: 48, h: 21 },
  { id: "system-pump", x: 617, y: 378, w: 68, h: 36 }
];

const canvas = document.querySelector("#diagram");
const ctx = canvas.getContext("2d");
const image = new Image();
image.src = "assets/kazan-semasi.png";

const state = {
  started: false,
  finished: false,
  placed: new Set(),
  mistakes: 0,
  score: 0,
  seconds: 0,
  timerId: null,
  hintId: null,
  hinted: null,
  selected: null
};

const ui = {
  score: document.querySelector("#score"),
  correct: document.querySelector("#correct"),
  total: document.querySelector("#total"),
  mistakes: document.querySelector("#mistakes"),
  timer: document.querySelector("#timer"),
  statusText: document.querySelector("#statusText"),
  statusDot: document.querySelector("#statusDot"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  hintBtn: document.querySelector("#hintBtn"),
  tray: document.querySelector("#pieces"),
  traySection: document.querySelector("#traySection"),
  hotspotLayer: document.querySelector("#hotspotLayer"),
  feedback: document.querySelector("#dropFeedback"),
  modal: document.querySelector("#finishModal")
};

ui.total.textContent = EQUIPMENT.length;

image.addEventListener("load", () => {
  drawDiagram();
  createPieces();
  createHotspots();
});

function drawDiagram() {
  ctx.clearRect(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);
  ctx.drawImage(image, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);
  if (!state.started) return;

  ANSWER_LABELS.forEach((label) => {
    if (state.placed.has(label.id)) return;
    ctx.fillStyle = "rgba(255,255,255,.98)";
    ctx.fillRect(label.x, label.y, label.w, label.h);
  });

  EQUIPMENT.forEach((item, index) => {
    if (state.placed.has(item.id)) return;
    const pad = 3;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.97)";
    ctx.fillRect(item.x - pad, item.y - pad, item.w + pad * 2, item.h + pad * 2);
    ctx.restore();
  });
  syncHotspots();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function createPieces() {
  ui.tray.replaceChildren();
  shuffled(EQUIPMENT).forEach((item) => {
    const piece = document.createElement("div");
    piece.className = "piece";
    piece.dataset.id = item.id;
    piece.setAttribute("role", "button");
    piece.setAttribute("tabindex", "0");
    piece.setAttribute("aria-label", `${item.name} parçası`);

    const crop = document.createElement("canvas");
    const source = item.crop ?? item;
    crop.width = source.w;
    crop.height = source.h;
    crop.getContext("2d").drawImage(image, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
    const label = document.createElement("span");
    label.textContent = item.name;
    piece.append(crop, label);
    addPointerDragging(piece, item);
    ui.tray.append(piece);
  });
}

function createHotspots() {
  ui.hotspotLayer.replaceChildren();
  EQUIPMENT.forEach((item, index) => {
    const hotspot = document.createElement("button");
    hotspot.type = "button";
    hotspot.className = "hotspot";
    hotspot.dataset.id = item.id;
    hotspot.textContent = String(index + 1);
    hotspot.setAttribute("aria-label", `${index + 1} numaralı ekipman yuvası`);
    hotspot.style.left = `${item.x / SOURCE_WIDTH * 100}%`;
    hotspot.style.top = `${item.y / SOURCE_HEIGHT * 100}%`;
    hotspot.style.width = `${item.w / SOURCE_WIDTH * 100}%`;
    hotspot.style.height = `${item.h / SOURCE_HEIGHT * 100}%`;
    hotspot.addEventListener("click", () => placeSelectedIn(item));
    ui.hotspotLayer.append(hotspot);
  });
  syncHotspots();
}

function syncHotspots() {
  if (!ui.hotspotLayer) return;
  ui.hotspotLayer.querySelectorAll(".hotspot").forEach((hotspot) => {
    const id = hotspot.dataset.id;
    hotspot.classList.toggle("placed", state.placed.has(id));
    hotspot.classList.toggle("hint", state.hinted === id);
    hotspot.classList.toggle("ready", Boolean(state.selected));
  });
}

function addPointerDragging(piece, item) {
  let origin = null;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  let moved = false;

  piece.addEventListener("pointerdown", (event) => {
    if (!state.started || state.placed.has(item.id)) return;
    event.preventDefault();
    origin = { parent: piece.parentNode, next: piece.nextSibling };
    const rect = piece.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    startX = event.clientX;
    startY = event.clientY;
    moved = false;
    piece.style.left = `${rect.left}px`;
    piece.style.top = `${rect.top}px`;
    piece.classList.add("dragging");
    document.body.append(piece);
    piece.setPointerCapture(event.pointerId);
  });

  piece.addEventListener("pointermove", (event) => {
    if (!origin) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 7) moved = true;
    piece.style.left = `${event.clientX - offsetX}px`;
    piece.style.top = `${event.clientY - offsetY}px`;
  });

  piece.addEventListener("pointerup", (event) => {
    if (!origin) return;
    const correct = isInsideTarget(event.clientX, event.clientY, item);
    piece.releasePointerCapture(event.pointerId);
    piece.classList.remove("dragging");
    piece.removeAttribute("style");
    if (origin.next && origin.next.parentNode === origin.parent) origin.parent.insertBefore(piece, origin.next);
    else origin.parent.append(piece);
    origin = null;
    if (!moved) {
      selectPiece(piece, item);
      return;
    }
    correct ? placePiece(piece, item) : rejectPiece(piece);
  });
}

function isInsideTarget(clientX, clientY, item) {
  const hotspot = ui.hotspotLayer.querySelector(`[data-id="${item.id}"]`);
  if (!hotspot) return false;
  const rect = hotspot.getBoundingClientRect();
  const tolerance = 18;
  return clientX >= rect.left - tolerance && clientX <= rect.right + tolerance && clientY >= rect.top - tolerance && clientY <= rect.bottom + tolerance;
}

function selectPiece(piece, item) {
  ui.tray.querySelectorAll(".piece.selected").forEach((entry) => entry.classList.remove("selected"));
  state.selected = item.id;
  piece.classList.add("selected");
  ui.statusText.textContent = `${item.name} seçildi. Şemadaki doğru numaralı yuvaya tıkla.`;
  syncHotspots();
}

function placeSelectedIn(target) {
  if (!state.selected || state.placed.has(target.id)) return;
  const item = EQUIPMENT.find((entry) => entry.id === state.selected);
  const piece = ui.tray.querySelector(`[data-id="${state.selected}"]`);
  if (item.id === target.id) placePiece(piece, item);
  else rejectPiece(piece);
}

function placePiece(piece, item) {
  state.placed.add(item.id);
  state.selected = null;
  state.score += 100;
  piece.classList.add("placed");
  showFeedback(`Doğru: ${item.name}`, "ok");
  updateUI();
  drawDiagram();
  if (state.placed.size === EQUIPMENT.length) finishGame();
}

function rejectPiece(piece) {
  state.mistakes += 1;
  state.score = Math.max(0, state.score - 15);
  piece.classList.remove("wrong");
  void piece.offsetWidth;
  piece.classList.add("wrong");
  showFeedback("Bu ekipmanın yeri burası değil", "error");
  ui.statusText.textContent = `${piece.querySelector("span").textContent} seçili. Başka bir yuvayı dene.`;
  updateUI();
}

function startGame() {
  clearInterval(state.timerId);
  clearTimeout(state.hintId);
  Object.assign(state, { started: true, finished: false, placed: new Set(), mistakes: 0, score: 0, seconds: 0, hinted: null, selected: null });
  createPieces();
  ui.traySection.hidden = false;
  ui.hotspotLayer.hidden = false;
  ui.hintBtn.disabled = false;
  ui.shuffleBtn.textContent = "Baştan Başla";
  ui.statusDot.className = "status-dot active";
  ui.statusText.textContent = "Şema bozuldu. Sekiz ekipmanı doğru yuvalarına yerleştir.";
  ui.modal.hidden = true;
  state.timerId = setInterval(() => { state.seconds += 1; updateUI(); }, 1000);
  updateUI();
  drawDiagram();
  setTimeout(() => ui.traySection.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
}

function showHint() {
  const remaining = EQUIPMENT.filter((item) => !state.placed.has(item.id));
  if (!remaining.length) return;
  clearTimeout(state.hintId);
  state.hinted = remaining[Math.floor(Math.random() * remaining.length)].id;
  state.score = Math.max(0, state.score - 20);
  const item = EQUIPMENT.find((entry) => entry.id === state.hinted);
  ui.statusText.textContent = `İpucu: ${item.name} için parlayan yuvaya bak.`;
  updateUI();
  drawDiagram();
  state.hintId = setTimeout(() => {
    state.hinted = null;
    ui.statusText.textContent = "Parçaları doğru yuvalarına yerleştir.";
    drawDiagram();
  }, 2200);
}

function finishGame() {
  state.finished = true;
  clearInterval(state.timerId);
  state.score += Math.max(0, 300 - state.seconds) + Math.max(0, 100 - state.mistakes * 10);
  ui.hintBtn.disabled = true;
  ui.statusDot.className = "status-dot success";
  ui.statusText.textContent = "Tebrikler! Kazan altı tesisat şemasını tamamladın.";
  updateUI();
  document.querySelector("#finalScore").textContent = state.score;
  document.querySelector("#finalTime").textContent = formatTime(state.seconds);
  document.querySelector("#finalMistakes").textContent = state.mistakes;
  document.querySelector("#finishSummary").textContent = state.mistakes === 0
    ? "Kusursuz montaj — bütün ekipmanları ilk denemede buldun."
    : `${EQUIPMENT.length} ekipmanı ${state.mistakes} hatayla doğru konumlarına yerleştirdin.`;
  setTimeout(() => { ui.modal.hidden = false; }, 450);
}

function updateUI() {
  ui.score.textContent = state.score;
  ui.correct.textContent = state.placed.size;
  ui.mistakes.textContent = state.mistakes;
  ui.timer.textContent = formatTime(state.seconds);
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function showFeedback(message, type) {
  ui.feedback.textContent = message;
  ui.feedback.className = `drop-feedback show ${type}`;
  clearTimeout(showFeedback.timeout);
  showFeedback.timeout = setTimeout(() => { ui.feedback.className = "drop-feedback"; }, 1300);
}

function shuffled(list) {
  return [...list].sort(() => Math.random() - .5);
}

ui.shuffleBtn.addEventListener("click", startGame);
ui.hintBtn.addEventListener("click", showHint);
document.querySelector("#playAgainBtn").addEventListener("click", startGame);
