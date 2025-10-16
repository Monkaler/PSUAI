(() => {
  const CONTROL_LABELS = {
    punctuation: "Include punctuation",
    capitalization: "Random capitalization",
    numbers: "Include numbers",
    "limit-mode": "Limit type",
    "limit-value": "Limit value",
  };

  const LETTERS_LOWER = Array.from("abcdefghijklmnopqrstuvwxyz");
  const LETTERS_UPPER = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const DIGITS = Array.from("0123456789");
  const SYMBOLS = Array.from("!@#$%^&*()-_=+[]{}|;:'\",.<>/?`~\\");
  const BLANKS = [" "];
  const TYPABLE_CHARACTERS = [
    ...BLANKS,
    ...LETTERS_LOWER,
    ...LETTERS_UPPER,
    ...DIGITS,
    ...SYMBOLS,
  ];
  const WORD_LIMIT_CHOICES = [15, 25, 50, 100];
  const TIME_LIMIT_CHOICES = [30, 60, 120, 180];

  const BASE_WORDS = [
    "galaxy",
    "python",
    "neptune",
    "krypton",
    "starlit",
    "future",
    "vector",
    "glimmer",
    "quantum",
    "nebula",
    "marble",
    "rocket",
    "bridge",
    "signal",
    "aurora",
    "horizon",
    "plasma",
    "binary",
    "asteroid",
    "circuit",
    "raindrop",
    "violet",
    "spectrum",
    "cipher",
    "lantern",
    "saffron",
    "pulse",
    "turbine",
    "composer",
    "resonant",
    "crystal",
    "swift",
    "magnet",
    "luminous",
    "cascade",
    "venture",
    "ember",
    "glyph",
    "meteor",
  ];

  const PUNCTUATION_MARKS = [".", ",", "!", "?", ";", ":"];
  const NUMBER_CHARS = "0123456789";
  const state = {
    options: {
      punctuation: false,
      capitalization: false,
      numbers: false,
    },
    limitMode: "words",
    limitValue: 25,
    words: [],
    targetText: "",
    currentIndex: 0,
    typedCount: 0,
    errors: 0,
    startTime: null,
    timerId: null,
    running: false,
    timeLimitMs: null,
    judgements: [],
  };

  let latestTargetMarkup = "";

  const els = {
    targetText: document.getElementById("target-text"),
    currentLetter: document.getElementById("current-letter"),
    typedCount: document.getElementById("typed-count"),
    timer: document.getElementById("timer"),
    wpm: document.getElementById("wpm"),
    accuracy: document.getElementById("accuracy"),
    startButton: document.getElementById("start-test"),
    controlButtons: [...document.querySelectorAll(".control-button")],
    controlsContainer: document.querySelector(".controls"),
    overlay: document.getElementById("game-overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    canvas: document.getElementById("game-canvas"),
    resultTemplate: document.getElementById("result-template"),
    overlayLetter: document.getElementById("overlay-letter"),
    overlayWpm: document.getElementById("overlay-wpm"),
    overlaySnippet: document.getElementById("overlay-snippet"),
  };

  class FlightSelector {
    constructor(canvas, overlay) {
      this.canvas = canvas;
      this.overlay = overlay;
      this.ctx = canvas.getContext("2d");
      this.active = false;
      this.items = [];
      this.onComplete = null;
      this.animationId = null;
      this.keyState = { up: false, down: false, left: false, right: false };

      this.finishX = this.canvas.width - 120;
      this.minX = 60;
      this.baseSpeed = 3.6;
      this.gravity = 0.18;
      this.controlForce = 0.9;
      this.maxVelocity = 7.5;
      this.drag = 0.92;
      this.swapInterval = 1800;

      this.bird = {
        x: 80,
        y: this.canvas.height / 2,
        vy: 0,
      };

      this.clouds = this.generateClouds();
      this.lastTime = performance.now();
      this.lastSwap = performance.now();
      this.waitingForEnterRelease = false;

      document.addEventListener("keydown", (ev) => this.handleKey(ev, true));
      document.addEventListener("keyup", (ev) => this.handleKey(ev, false));
    }

    generateClouds() {
      const clouds = [];
      for (let i = 0; i < 12; i += 1) {
        clouds.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * (this.canvas.height * 0.7),
          size: 20 + Math.random() * 40,
          speed: 0.2 + Math.random() * 0.3,
        });
      }
      return clouds;
    }

    handleKey(event, isDown) {
      if (!this.active) {
        return;
      }
      if (event.key === "Enter") {
        if (isDown) {
          if (!this.waitingForEnterRelease) {
            this.waitingForEnterRelease = true;
            this.resolveSelection();
          }
        } else {
          this.waitingForEnterRelease = false;
        }
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowUp") {
        this.keyState.up = isDown;
        event.preventDefault();
      }
      if (event.key === "ArrowDown") {
        this.keyState.down = isDown;
        event.preventDefault();
      }
      if (event.key === "ArrowLeft") {
        this.keyState.left = isDown;
        event.preventDefault();
      }
      if (event.key === "ArrowRight") {
        this.keyState.right = isDown;
        event.preventDefault();
      }
    }

    start(items, title, onComplete) {
      this.items = this.prepareItems(items);
      this.onComplete = onComplete;
      this.active = true;
      this.overlay.classList.remove("hidden");
      els.overlayTitle.textContent = title;
      this.resetBird();
      this.lastTime = performance.now();
      this.lastSwap = performance.now();
      this.swapInterval = 1400 + Math.random() * 1600;
      this.waitingForEnterRelease = false;
      this.loop();
      updateOverlaySnippet();
      updateOverlayWpmDisplay(els.wpm.textContent);
    }

    prepareItems(items) {
      const verticalPadding = 60;
      const rows = Math.min(items.length, 12);
      const columns = Math.ceil(items.length / rows);
      const usableHeight = this.canvas.height - verticalPadding * 2;
      const rowSpacing = rows > 1 ? usableHeight / (rows - 1) : usableHeight;
      const columnSpacing =
        columns > 1 ? Math.min(72, (this.finishX - 80) / (columns - 1)) : 0;
      const startX = this.finishX - columnSpacing * (columns - 1);
      const itemWidth = columns > 1 ? Math.max(36, Math.min(60, columnSpacing * 0.8)) : 150;
      const itemHeight = columns > 1 ? 34 : 48;
      return items.map((item, idx) => {
        const column = Math.floor(idx / rows);
        const row = idx % rows;
        const baseX = startX + column * columnSpacing;
        const baseY = verticalPadding + row * rowSpacing;
        return {
          ...item,
          baseX,
          baseY,
          x: baseX,
          width: itemWidth,
          height: itemHeight,
          y: baseY,
          phase: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.4 + Math.random() * 0.9,
          wobbleRadius: 6 + Math.random() * 6,
        };
      });
    }

    resetBird() {
      this.bird.x = 80;
      this.bird.y = this.canvas.height / 2;
      this.bird.vy = 0;
    }

    loop() {
      if (!this.active) {
        return;
      }
      this.animationId = requestAnimationFrame(() => this.loop());

      const now = performance.now();
      const delta = (now - this.lastTime) / 16.67;
      this.lastTime = now;

      this.updateBird(delta);
      this.updateClouds(delta);
      this.updateItems(now);
      this.drawScene();
    }

    updateBird(delta) {
      const bird = this.bird;
      if (this.keyState.up) {
        bird.vy -= this.controlForce * delta;
      }
      if (this.keyState.down) {
        bird.vy += this.controlForce * delta;
      }
      bird.vy *= Math.pow(this.drag, delta);
      bird.vy += this.gravity * delta;
      bird.vy = Math.max(Math.min(bird.vy, this.maxVelocity), -this.maxVelocity);
      bird.y += bird.vy * delta;
      bird.y = Math.max(24, Math.min(this.canvas.height - 24, bird.y));

      let horizontalSpeed = this.baseSpeed;
      if (this.keyState.right && !this.keyState.left) {
        horizontalSpeed = this.baseSpeed * 4.5;
      } else if (this.keyState.left && !this.keyState.right) {
        horizontalSpeed = -this.baseSpeed * 3.5;
      } else if (this.keyState.left && this.keyState.right) {
        horizontalSpeed = this.baseSpeed;
      }
      bird.x += horizontalSpeed * delta;
      if (bird.x >= this.finishX) {
        bird.x = this.minX + 1;
        bird.vy *= 0.4;
      }
      if (bird.x <= this.minX) {
        bird.x = this.minX;
        bird.vy *= 0.6;
      }
    }

    updateClouds(delta) {
      this.clouds.forEach((cloud) => {
        cloud.x -= cloud.speed * delta;
        if (cloud.x < -cloud.size * 2) {
          cloud.x = this.canvas.width + cloud.size;
          cloud.y = Math.random() * (this.canvas.height * 0.6);
        }
      });
    }

    updateItems(now) {
      if (!this.items.length) return;
      const t = now / 1000;
      this.items.forEach((item) => {
        const wobbleX = Math.sin(t * item.wobbleSpeed + item.phase) * item.wobbleRadius;
        const wobbleY = Math.cos(t * item.wobbleSpeed * 1.1 + item.phase) * (item.wobbleRadius * 0.6);
        item.x = item.baseX + wobbleX;
        item.y = item.baseY + wobbleY;
      });
      if (now - this.lastSwap > this.swapInterval) {
        if (this.items.length > 1) {
          const a = Math.floor(Math.random() * this.items.length);
          let b = Math.floor(Math.random() * this.items.length);
          if (a === b) {
            b = (b + 1) % this.items.length;
          }
          const tempBaseX = this.items[a].baseX;
          const tempBaseY = this.items[a].baseY;
          this.items[a].baseX = this.items[b].baseX;
          this.items[a].baseY = this.items[b].baseY;
          this.items[b].baseX = tempBaseX;
          this.items[b].baseY = tempBaseY;
        }
        this.swapInterval = 1200 + Math.random() * 1800;
        this.lastSwap = now;
      }
    }

    drawScene() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawBackground(ctx);
      this.drawItems(ctx);
      this.drawFinishLine(ctx);
      this.drawBird(ctx);
    }

    drawBackground(ctx) {
      // sky gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, "#0ea5e9");
      gradient.addColorStop(1, "#082f49");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.fillStyle = "rgba(255,255,255,0.25)";
      this.clouds.forEach((cloud) => {
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.size, cloud.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    drawFinishLine(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.setLineDash([12, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.finishX, 40);
      ctx.lineTo(this.finishX, this.canvas.height - 40);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "rgba(244, 244, 245, 0.8)";
      ctx.font = "700 18px 'Fira Code'";
      ctx.textAlign = "center";
      ctx.fillText("Align to choose", this.finishX, 32);
    }

    drawItems(ctx) {
      this.items.forEach((item) => {
        ctx.fillStyle = item.accent || "rgba(13,148,136,0.85)";
        ctx.strokeStyle = "rgba(12, 74, 110, 0.8)";
        ctx.lineWidth = 1.5;
        const x = item.x - item.width / 2;
        const y = item.y - item.height / 2;

        drawRoundedRect(ctx, x, y, item.width, item.height, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = item.label.length > 4 ? "600 14px 'Segoe UI'" : "600 16px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.label, item.x, item.y + 1);
      });
    }

    drawBird(ctx) {
      const bird = this.bird;
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(Math.max(Math.min(bird.vy / 8, 0.6), -0.6));

      const bodyGradient = ctx.createLinearGradient(-24, -18, 32, 22);
      bodyGradient.addColorStop(0, "#facc15");
      bodyGradient.addColorStop(0.5, "#f97316");
      bodyGradient.addColorStop(1, "#ef4444");

      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(15, 23, 42, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.ellipse(-2, 6, 16, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(18, -4);
      ctx.lineTo(34, -10);
      ctx.lineTo(20, 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.moveTo(-6, 10);
      ctx.quadraticCurveTo(20, 26, -16, 18);
      ctx.quadraticCurveTo(-4, 4, -6, 10);
      ctx.fill();

      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(4, -22);
      ctx.quadraticCurveTo(14, -32, 10, -10);
      ctx.quadraticCurveTo(2, -14, 4, -22);
      ctx.fill();

      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.ellipse(-10, -6, 8, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.ellipse(-11, -6, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(-14, 4);
      ctx.lineTo(-24, 16);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    resolveSelection() {
      const bird = this.bird;
      let chosen = this.items[0];
      let minDistance = Infinity;
      this.items.forEach((item) => {
        const dx = item.x - bird.x;
        const dy = item.y - bird.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
          chosen = item;
          minDistance = distance;
        }
      });
      this.finish(chosen);
    }

    finish(choice) {
      cancelAnimationFrame(this.animationId);
      this.active = false;
      this.overlay.classList.add("hidden");
      this.resetBird();
      this.waitingForEnterRelease = false;
      if (this.onComplete) {
        this.onComplete(choice);
      }
    }

    cancel() {
      cancelAnimationFrame(this.animationId);
      this.active = false;
      this.overlay.classList.add("hidden");
      this.resetBird();
      this.waitingForEnterRelease = false;
    }
  }

  const flightSelector = new FlightSelector(els.canvas, els.overlay);

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function refreshControlButtons() {
    els.controlButtons.forEach((button) => {
      const key = button.dataset.option;
      if (!key) return;
      if (key in state.options) {
        const isEnabled = state.options[key];
        button.textContent = isEnabled ? "Enabled (change)" : "Disabled (change)";
        return;
      }
      if (key === "limit-mode") {
        button.textContent = state.limitMode === "words" ? "Words (change)" : "Time (change)";
        return;
      }
      if (key === "limit-value") {
        const suffix = state.limitMode === "words" ? "words" : "s";
        button.textContent = `${state.limitValue} ${suffix} (change)`;
      }
    });
  }

  function scrambleControlLayout() {
    if (!els.controlsContainer) return;
    const elements = [...els.controlsContainer.children];
    if (!elements.length) return;
    const shuffled = elements.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach((node) => els.controlsContainer.appendChild(node));
  }

  function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function generateWords() {
    const words = [];
    const baseWordCount =
      state.limitMode === "words"
        ? Math.max(1, state.limitValue)
        : Math.max(120, state.limitValue * 8);

    for (let i = 0; i < baseWordCount; i += 1) {
      let word = randomFrom(BASE_WORDS);
      if (state.options.capitalization && Math.random() > 0.5) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      if (state.options.numbers && Math.random() < 0.25) {
        const number = randomFrom(NUMBER_CHARS);
        word = Math.random() > 0.5 ? `${word}${number}` : `${number}${word}`;
      }
      if (state.options.punctuation && Math.random() < 0.3) {
        word += randomFrom(PUNCTUATION_MARKS);
      }
      words.push(word);
    }

    const coverageTokens = TYPABLE_CHARACTERS.filter((char) => char !== " ");
    coverageTokens.forEach((token) => {
      const index = Math.floor(Math.random() * (words.length + 1));
      words.splice(index, 0, token);
    });

    state.words = words;
    state.targetText = words.join(" ");
    state.judgements = new Array(state.targetText.length).fill(null);
  }

  function renderTargetText() {
    const chars = [...state.targetText];
    const fragments = chars.map((char, idx) => {
      const classNames = [];
      const judgement = state.judgements[idx];
      if (idx < state.currentIndex) {
        classNames.push("completed");
      }
      if (idx === state.currentIndex) {
        classNames.push("current");
      }
      if (idx > state.currentIndex) {
        classNames.push("remaining");
      }
      if (judgement) {
        classNames.push(judgement);
      }
      const safeChar = char === " " ? "&nbsp;" : escapeHtml(char);
      return `<span class="${classNames.join(" ")}">${safeChar}</span>`;
    });
    if (!chars.length) {
      fragments.push('<span class="current remaining">&nbsp;</span>');
    } else if (state.currentIndex >= chars.length) {
      fragments.push('<span class="current remaining">&nbsp;</span>');
    }
    const markup = fragments.join("");
    latestTargetMarkup = markup;
    const currentChar = chars[state.currentIndex] || "";
    els.targetText.innerHTML = markup;
    els.currentLetter.textContent = describeChar(currentChar);
    setOverlayLetter(describeChar(currentChar));
    updateOverlaySnippet();
  }

  function escapeHtml(text) {
    return (text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function describeChar(char) {
    if (!char) return "-";
    if (char === " ") return "Space";
    if (char === "\n") return "Enter";
    return char;
  }

  function resetState() {
    state.currentIndex = 0;
    state.typedCount = 0;
    state.errors = 0;
    state.startTime = null;
    state.running = false;
    state.timeLimitMs = null;
    state.judgements = [];
    latestTargetMarkup = "";
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    els.timer.textContent = "0.0s";
    els.wpm.textContent = "0";
    els.accuracy.textContent = "100%";
    els.typedCount.textContent = "0";
    updateOverlaySnippet("");
  }

  function startTest() {
    resetState();
    state.timeLimitMs = state.limitMode === "time" ? state.limitValue * 1000 : null;
    if (state.limitMode === "time" && state.timeLimitMs !== null) {
      els.timer.textContent = `${(state.timeLimitMs / 1000).toFixed(1)}s left`;
    }
    generateWords();
    renderTargetText();
    state.running = true;
    beginTimer();
    requestNextLetter();
  }

  function beginTimer() {
    state.startTime = performance.now();
    state.timerId = setInterval(() => {
      if (!state.running) {
        clearInterval(state.timerId);
        state.timerId = null;
        return;
      }
      const elapsed = performance.now() - state.startTime;
      if (state.limitMode === "time" && state.timeLimitMs !== null) {
        const remaining = Math.max(0, state.timeLimitMs - elapsed);
        els.timer.textContent = `${(remaining / 1000).toFixed(1)}s left`;
        if (remaining <= 0) {
          completeTest();
          return;
        }
      } else {
        els.timer.textContent = `${(elapsed / 1000).toFixed(1)}s`;
      }
      updateStats();
    }, 100);
  }

  function completeTest() {
    if (!state.running) return;
    state.running = false;
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    if (flightSelector.active) {
      flightSelector.cancel();
    }
    updateStats();
    showResults();
  }

  function updateStats() {
    if (!state.startTime) {
      return;
    }
    const elapsedMs = performance.now() - state.startTime;
    const elapsedMinutes = elapsedMs / 60000;
    const grossWpm = elapsedMinutes > 0 ? Math.round((state.typedCount / 5) / elapsedMinutes) : 0;
    const accuracy = state.typedCount > 0
      ? Math.max(0, Math.round(((state.typedCount - state.errors) / state.typedCount) * 100))
      : 100;

    els.wpm.textContent = Number.isFinite(grossWpm) ? grossWpm.toString() : "0";
    els.accuracy.textContent = `${accuracy}%`;
    updateOverlayWpmDisplay(els.wpm.textContent);
  }

  function showResults() {
    const modal = els.resultTemplate.content.firstElementChild.cloneNode(true);
    const elapsedSeconds = (performance.now() - state.startTime) / 1000;
    const limitSummary =
      state.limitMode === "time"
        ? `${state.limitValue}s time limit`
        : `${state.limitValue} word limit`;
    const summary = modal.querySelector("#result-summary");
    summary.textContent = `You completed the run in ${elapsedSeconds.toFixed(
      1
    )} seconds with a WPM of ${els.wpm.textContent} and accuracy of ${els.accuracy.textContent} (${limitSummary}).`;
    const finalWpm = document.createElement("p");
    finalWpm.className = "result-wpm";
    finalWpm.textContent = `Final WPM: ${els.wpm.textContent}`;
    summary.insertAdjacentElement("afterend", finalWpm);
    modal.querySelector("#restart").addEventListener("click", () => {
      modal.remove();
      startTest();
    });
    document.body.appendChild(modal);
  }

  function requestOptionSelection(optionKey) {
    if (!optionKey) return;
    if (optionKey === "limit-mode") {
      const items = [
        { label: "Words", value: "words", accent: "rgba(56,189,248,0.9)" },
        { label: "Time", value: "time", accent: "rgba(249,115,22,0.9)" },
      ];
      flightSelector.start(items, "Choose limit type", (choice) => {
        state.limitMode = choice.value;
        state.limitValue =
          state.limitMode === "words" ? WORD_LIMIT_CHOICES[0] : TIME_LIMIT_CHOICES[0];
        refreshControlButtons();
      });
      setOverlayLetter(CONTROL_LABELS[optionKey]);
      return;
    }

    if (optionKey === "limit-value") {
      const pool = state.limitMode === "words" ? WORD_LIMIT_CHOICES : TIME_LIMIT_CHOICES;
      const suffix = state.limitMode === "words" ? "words" : "s";
      const items = pool.map((value) => ({
        label: `${value} ${suffix}`,
        value,
        accent: value === state.limitValue ? "rgba(34,197,94,0.9)" : "rgba(56,189,248,0.85)",
      }));
      flightSelector.start(items, "Choose limit value", (choice) => {
        state.limitValue = choice.value;
        refreshControlButtons();
      });
      setOverlayLetter(CONTROL_LABELS[optionKey]);
      return;
    }

    if (optionKey in state.options) {
      const items = [
        {
          label: "Enable",
          value: true,
          accent: "rgba(34,197,94,0.85)",
        },
        {
          label: "Disable",
          value: false,
          accent: "rgba(248,113,113,0.85)",
        },
      ];
      const title = `${CONTROL_LABELS[optionKey]}?`;
      flightSelector.start(items, title, (choice) => {
        state.options[optionKey] = choice.value;
        refreshControlButtons();
      });
      setOverlayLetter(CONTROL_LABELS[optionKey]);
    }
  }

  function requestNextLetter() {
    if (!state.running) return;
    if (state.currentIndex >= state.targetText.length) {
      completeTest();
      return;
    }
    const expectedChar = state.targetText[state.currentIndex];
    const selectionItems = buildLetterChoices(expectedChar);
    const titleText = `Select: ${describeChar(expectedChar)}`;

    setOverlayLetter(describeChar(expectedChar));
    flightSelector.start(selectionItems, titleText, (choice) => {
      handleLetterSelection(choice.value, expectedChar);
    });
  }

  function buildLetterChoices(expectedChar) {
    const labelForChar = (char) => {
      if (char === " ") return "Space";
      return char;
    };
    const items = TYPABLE_CHARACTERS.map((char) => ({
      label: labelForChar(char),
      value: char,
      accent: char === expectedChar ? "rgba(34,197,94,0.9)" : "rgba(56,189,248,0.6)",
    }));
    const backspaceCount = Math.ceil(items.length / 2);
    for (let i = 0; i < backspaceCount; i += 1) {
      items.push({
        label: "Backspace",
        value: "__backspace",
        accent: "rgba(96,165,250,0.65)",
      });
    }
    items.push({
      label: "Exit",
      value: "__exit",
      accent: "rgba(248,113,113,0.85)",
    });
    items.sort(() => Math.random() - 0.5);
    return items;
  }

  function handleLetterSelection(selectedChar, expectedChar) {
    if (selectedChar === "__exit") {
      completeTest();
      return;
    }

    if (selectedChar === "__backspace") {
      if (state.currentIndex > 0) {
        state.currentIndex -= 1;
        state.judgements[state.currentIndex] = null;
      } else if (state.judgements.length > 0) {
        state.judgements[0] = null;
      }
      renderTargetText();
      updateStats();
      if (state.running) {
        requestNextLetter();
      }
      return;
    }

    state.typedCount += 1;
    if (selectedChar === expectedChar) {
      state.judgements[state.currentIndex] = "correct";
      state.currentIndex += 1;
    } else {
      state.errors += 1;
      if (state.currentIndex > 0) {
        state.currentIndex -= 1;
        state.judgements[state.currentIndex] = "incorrect";
      } else if (state.judgements.length > 0) {
        state.judgements[0] = "incorrect";
      }
    }
    els.typedCount.textContent = state.typedCount.toString();
    renderTargetText();
    updateStats();

    if (state.currentIndex >= state.targetText.length || !state.running) {
      completeTest();
    } else {
      requestNextLetter();
    }
  }

  function initEventHandlers() {
    els.controlButtons.forEach((button) => {
      button.addEventListener("click", () => {
        requestOptionSelection(button.dataset.option);
      });
    });

    els.startButton.addEventListener("click", () => {
      flightSelector.start(
        [
          { label: "Launch", value: "start", accent: "rgba(56,189,248,0.9)" },
          { label: "Not yet", value: "cancel", accent: "rgba(248,113,113,0.85)" },
        ],
        "Ready to fly?",
        (choice) => {
          if (choice.value === "start") {
            startTest();
          }
        }
      );
      setOverlayLetter("Launch");
      updateOverlaySnippet();
      updateOverlayWpmDisplay(els.wpm.textContent);
    });
  }

  function init() {
    refreshControlButtons();
    resetState();
    renderTargetText();
    initEventHandlers();
    initButtonSharks();
  }

  init();

  function initButtonSharks() {
    const sharkButtons = [...els.controlButtons, els.startButton].filter(Boolean);
    sharkButtons.forEach((button) => {
      let resetTimer = null;
      let jumpTimer = null;
      const reset = () => {
        if (resetTimer) {
          clearTimeout(resetTimer);
          resetTimer = null;
        }
        if (jumpTimer) {
          clearTimeout(jumpTimer);
          jumpTimer = null;
        }
        button.style.transform = "";
        button.classList.remove("shark-alert");
      };
      const chomp = () => {
        if (resetTimer) {
          clearTimeout(resetTimer);
          resetTimer = null;
        }
        button.classList.add("shark-alert");
        scrambleControlLayout();
        jumpTimer = setTimeout(() => {
          const angle = Math.random() * Math.PI * 2;
          const distance = 80 + Math.random() * 140;
          const translateX = Math.cos(angle) * distance;
          const translateY = Math.sin(angle) * distance;
          button.style.transform = `translate(${translateX}px, ${translateY}px)`;
          resetTimer = setTimeout(reset, 900);
        }, 160);
      };
      button.addEventListener("pointerenter", chomp);
      button.addEventListener("click", reset);
      button.addEventListener("blur", reset);
      button.addEventListener("pointerdown", () => {
        if (resetTimer) {
          clearTimeout(resetTimer);
          resetTimer = null;
        }
        if (jumpTimer) {
          clearTimeout(jumpTimer);
          jumpTimer = null;
        }
      });
    });
  }

  function setOverlayLetter(label) {
    if (!els.overlayLetter) return;
    els.overlayLetter.textContent = label || "-";
  }

  function updateOverlayWpmDisplay(value) {
    if (!els.overlayWpm) return;
    els.overlayWpm.textContent = value || "0";
  }

  function updateOverlaySnippet(markup = latestTargetMarkup) {
    if (!els.overlaySnippet) return;
    if (!markup) {
      els.overlaySnippet.innerHTML = "";
      return;
    }
    els.overlaySnippet.innerHTML = markup;
  }
})();
