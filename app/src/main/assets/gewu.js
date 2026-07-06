(() => {
  "use strict";

  const { SIMS, CATEGORIES, getSim } = window.module.exports;
  const byId = Object.fromEntries(SIMS.map(sim => [sim.id, sim]));
  const FAV_KEY = "gw_fav";
  const RECENT_KEY = "gw_recent";
  const VISITED_KEY = "gw_visited";

  const $ = id => document.getElementById(id);
  const homeView = $("home-view");
  const simView = $("sim-view");
  const aboutView = $("about-view");
  const homeContent = $("home-content");
  const canvas = $("sim-canvas");
  const ctx = canvas.getContext("2d");

  let currentView = "home";
  let currentSim = null;
  let state = null;
  let paramValues = {};
  let animationId = 0;
  let lastFrame = 0;
  let appVisible = true;
  let lastBuzz = 0;
  let resizeObserver = null;
  let toastTimer = 0;
  let canvasHintTimer = 0;
  let pendingReadout = null;
  let readoutTimer = 0;
  let lastReadoutUpdate = 0;
  let lastReadoutSignature = "";

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function writeList(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function haptic(force = false) {
    if (!force && localStorage.getItem("gw_haptic") === "0") return;
    try {
      if (window.NativeBridge) NativeBridge.vibrate();
      else if (navigator.vibrate) navigator.vibrate(18);
    } catch (_) {}
  }

  function showToast(message, duration = 1450) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  function updateReadoutDock(lines) {
    const normalized = lines.map(line => [String(line[0]), String(line[1])]);
    const signature = JSON.stringify(normalized);
    if (signature === lastReadoutSignature) return;
    lastReadoutSignature = signature;
    const dock = $("stage-readout");
    dock.replaceChildren(...normalized.map(([label, value]) => {
      const item = document.createElement("div");
      item.className = "readout-item";
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      const valueNode = document.createElement("strong");
      valueNode.textContent = value;
      valueNode.title = value;
      item.append(labelNode, valueNode);
      return item;
    }));
    dock.classList.toggle("hidden", normalized.length === 0);
  }

  function captureReadout(lines) {
    pendingReadout = lines.map(line => [line[0], line[1]]);
    if (readoutTimer) return;
    const wait = Math.max(0, 90 - (performance.now() - lastReadoutUpdate));
    readoutTimer = window.setTimeout(() => {
      readoutTimer = 0;
      lastReadoutUpdate = performance.now();
      if (pendingReadout) updateReadoutDock(pendingReadout);
      pendingReadout = null;
    }, wait);
  }

  function resetReadoutDock() {
    if (readoutTimer) clearTimeout(readoutTimer);
    readoutTimer = 0;
    pendingReadout = null;
    lastReadoutUpdate = 0;
    lastReadoutSignature = "";
    $("stage-readout").replaceChildren();
    $("stage-readout").classList.add("hidden");
  }

  function share(title) {
    try {
      if (window.NativeBridge) {
        NativeBridge.share(title);
      } else if (navigator.share) {
        navigator.share({ title: "格物实验", text: title }).catch(() => {});
      } else {
        showToast("当前环境不支持系统分享");
      }
    } catch (_) {
      showToast("无法打开系统分享");
    }
  }

  function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function matchSim(sim, keyword) {
    const k = keyword.trim().toLowerCase();
    if (!k) return true;
    return sim.title.includes(keyword.trim()) ||
      sim.category.includes(keyword.trim()) ||
      sim.sub.toLowerCase().includes(k);
  }

  function railCard(sim) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rail-card";
    button.innerHTML = `<span>${sim.emoji}</span><span>${sim.title}</span>`;
    button.addEventListener("click", () => openSim(sim.id));
    return button;
  }

  function simCard(sim, favorites) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sim-card";
    button.dataset.id = sim.id;
    button.innerHTML = `
      <span class="sim-icon" style="background:${hexAlpha(sim.color, .14)}">${sim.emoji}</span>
      <span class="sim-copy">
        <strong>${sim.title}${favorites.includes(sim.id) ? '<span class="fav-badge">⭐</span>' : ""}</strong>
        <small>${sim.sub}</small>
      </span>
      <span class="sim-arrow">›</span>`;

    let timer = 0;
    let longPressed = false;
    const start = () => {
      longPressed = false;
      timer = window.setTimeout(() => {
        longPressed = true;
        toggleFavorite(sim.id);
      }, 520);
    };
    const cancel = () => clearTimeout(timer);
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointermove", cancel);
    button.addEventListener("pointercancel", cancel);
    button.addEventListener("pointerup", cancel);
    button.addEventListener("contextmenu", event => event.preventDefault());
    button.addEventListener("click", event => {
      if (longPressed) {
        event.preventDefault();
        longPressed = false;
        return;
      }
      openSim(sim.id);
    });
    return button;
  }

  function refreshHome() {
    const keyword = $("search-input").value || "";
    const favorites = readList(FAV_KEY).filter(id => byId[id]);
    const recent = readList(RECENT_KEY).filter(id => byId[id]).slice(0, 8);
    const visited = readList(VISITED_KEY).filter(id => byId[id]);
    const pct = Math.round(visited.length / SIMS.length * 100);

    $("search-clear").style.display = keyword ? "block" : "none";
    $("progress-count").textContent = `${visited.length} / ${SIMS.length}`;
    $("progress-label").textContent = pct >= 100 ? "🏆 全部探索完成！" : "🧭 探索进度";
    $("progress-fill").style.width = `${pct}%`;
    $("progress-fill").classList.toggle("complete", pct >= 100);

    const favoriteSection = $("favorite-section");
    const favoriteRail = $("favorite-rail");
    favoriteRail.replaceChildren(...favorites.map(id => railCard(byId[id])));
    favoriteSection.classList.toggle("hidden", Boolean(keyword) || favorites.length === 0);

    const recentSection = $("recent-section");
    const recentRail = $("recent-rail");
    recentRail.replaceChildren(...recent.map(id => railCard(byId[id])));
    recentSection.classList.toggle("hidden", Boolean(keyword) || recent.length === 0);

    const groups = $("sim-groups");
    groups.replaceChildren();
    let matchCount = 0;
    CATEGORIES.forEach((category, index) => {
      const sims = SIMS.filter(sim => sim.category === category && matchSim(sim, keyword));
      if (!sims.length) return;
      matchCount += sims.length;
      const section = document.createElement("section");
      section.className = "sim-group";
      section.id = `category-${index}`;
      const title = document.createElement("h2");
      title.className = "group-title";
      title.textContent = `${category} · ${sims.length}`;
      section.append(title, ...sims.map(sim => simCard(sim, favorites)));
      groups.append(section);
    });
    $("empty-state").classList.toggle("hidden", matchCount !== 0);
    $("empty-state").querySelector("strong").textContent =
      keyword ? `没有找到「${keyword}」相关的仿真` : "没有可用的仿真";
    $("home-tip").classList.toggle("hidden", matchCount === 0);
    $("home-tip").textContent = `长按卡片可收藏 · 共 ${SIMS.length} 个仿真`;
  }

  function buildCategoryChips() {
    $("category-chips").replaceChildren(...CATEGORIES.map((category, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-chip";
      const count = SIMS.filter(sim => sim.category === category).length;
      button.innerHTML = `${category}<span>${count}</span>`;
      button.addEventListener("click", () => {
        if ($("search-input").value) {
          $("search-input").value = "";
          refreshHome();
        }
        requestAnimationFrame(() => {
          const target = $(`category-${index}`);
          if (target) homeContent.scrollTo({ top: target.offsetTop - 4, behavior: "smooth" });
        });
      });
      return button;
    }));
  }

  function recordVisit(id) {
    let recent = readList(RECENT_KEY).filter(item => item !== id);
    recent.unshift(id);
    writeList(RECENT_KEY, recent.slice(0, 12));
    const visited = readList(VISITED_KEY);
    if (!visited.includes(id)) {
      visited.push(id);
      writeList(VISITED_KEY, visited);
    }
  }

  function toggleFavorite(id) {
    const favorites = readList(FAV_KEY);
    const index = favorites.indexOf(id);
    if (index >= 0) {
      favorites.splice(index, 1);
      showToast("已取消收藏");
    } else {
      favorites.push(id);
      haptic();
      showToast("已收藏 ⭐");
    }
    writeList(FAV_KEY, favorites);
    refreshHome();
  }

  function switchView(view) {
    currentView = view;
    homeView.classList.toggle("hidden", view !== "home");
    simView.classList.toggle("hidden", view !== "sim");
    aboutView.classList.toggle("hidden", view !== "about");
    if (view !== "sim") stopAnimation();
    if (view === "home") refreshHome();
  }

  function showHome() {
    resetReadoutDock();
    currentSim = null;
    state = null;
    switchView("home");
  }

  function showAbout() {
    switchView("about");
    $("haptic-switch").checked = localStorage.getItem("gw_haptic") !== "0";
    $("dark-switch").checked = localStorage.getItem("gw_dark") === "1";
  }

  function openSim(id) {
    const sim = getSim(id);
    if (!sim) {
      showToast("未找到仿真");
      return;
    }
    recordVisit(id);
    currentSim = sim;
    state = sim.init();
    lastBuzz = state.buzz | 0;
    paramValues = Object.fromEntries(sim.params.map(param => [param.key, param.value]));
    resetReadoutDock();
    $("sim-title").textContent = sim.title;
    $("sim-subtitle").textContent = sim.sub;
    applyStageHeight(sim);
    renderSteppers();
    renderActions();
    renderControls();
    const hasDirectInteraction = Boolean(sim.onTap || sim.onDragStart);
    $("canvas-hint").textContent = sim.hint ||
      (sim.onDragStart ? "直接拖动画面中的物体" : "点按画布进行交互");
    $("canvas-hint").classList.toggle("hidden", !hasDirectInteraction);
    clearTimeout(canvasHintTimer);
    if (hasDirectInteraction) {
      canvasHintTimer = window.setTimeout(
        () => $("canvas-hint").classList.add("hidden"),
        3200,
      );
    }
    switchView("sim");
    requestAnimationFrame(() => {
      resizeCanvas();
      renderFrame(0);
      if (!sim.static) startAnimation();
    });
    if (!localStorage.getItem("gw_hinted")) {
      localStorage.setItem("gw_hinted", "1");
      showToast(sim.onDragStart ? sim.hint : "拖动下方滑块，观察现象变化", 2600);
    }
  }

  function applyStageHeight(sim) {
    const count = sim.params.length;
    const ratio = count >= 5 ? 0.34 : count === 4 ? 0.39 :
      count === 3 ? 0.43 : count === 2 ? 0.47 : 0.5;
    const height = Math.max(240, Math.min(470, Math.round(window.innerHeight * ratio)));
    $("stage").style.setProperty("--stage-height", `${height}px`);
  }

  function syncControlsFromParams() {
    if (!currentSim) return;
    currentSim.params.forEach(param => {
      const value = paramValues[param.key];
      const input = $(`control-${param.key}`);
      const output = $(`value-${param.key}`);
      if (input) input.value = value;
      if (output) output.textContent = param.fmt(value);
    });
  }

  function renderControls() {
    const list = $("control-list");
    list.replaceChildren(...currentSim.params.map(param => {
      const wrapper = document.createElement("div");
      wrapper.className = "control";
      const valueId = `value-${param.key}`;
      wrapper.innerHTML = `
        <div class="control-copy">
          <label for="control-${param.key}">${param.label}</label>
          <output id="${valueId}">${param.fmt(param.value)}</output>
        </div>
        <input id="control-${param.key}" type="range"
          min="${param.min}" max="${param.max}" step="${param.step}" value="${param.value}">`;
      const input = wrapper.querySelector("input");
      input.addEventListener("input", () => {
        const value = Number(input.value);
        paramValues[param.key] = value;
        $(valueId).textContent = param.fmt(value);
        if (currentSim.static) renderFrame(0);
      });
      return wrapper;
    }));
  }

  function actionLabel(action) {
    return typeof action.label === "function" ? action.label(state) : action.label;
  }

  function renderActions() {
    $("action-list").replaceChildren(...currentSim.actions.map((action, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `action-button${action.primary ? " primary" : ""}`;
      button.textContent = actionLabel(action);
      button.addEventListener("click", () => {
        action.on(state, paramValues);
        haptic();
        renderActions();
        renderSteppers();
        if (currentSim.static) renderFrame(0);
      });
      button.dataset.index = index;
      return button;
    }));
  }

  function renderSteppers() {
    const steppers = currentSim.steppers || [];
    $("stepper-list").replaceChildren(...steppers.map(stepper => {
      const row = document.createElement("div");
      row.className = "stepper-row";
      row.innerHTML = `
        <span class="stepper-label">${stepper.label}</span>
        <button type="button" class="stepper-button minus" style="color:${stepper.color}">−</button>
        <span class="stepper-value" style="color:${stepper.color}">${stepper.get(state)}</span>
        <button type="button" class="stepper-button plus" style="color:${stepper.color}">+</button>`;
      const change = delta => {
        const next = Math.max(stepper.min, Math.min(stepper.max, stepper.get(state) + delta));
        stepper.set(state, next);
        row.querySelector(".stepper-value").textContent = next;
        haptic();
        if (currentSim.static) renderFrame(0);
      };
      row.querySelector(".minus").addEventListener("click", () => change(-1));
      row.querySelector(".plus").addEventListener("click", () => change(1));
      return row;
    }));
  }

  function resizeCanvas() {
    if (!currentSim || currentView !== "sim") return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame(0);
  }

  function renderFrame(dt) {
    if (!currentSim || !state || currentView !== "sim") return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    currentSim.step(state, paramValues, dt);
    if ((state.buzz | 0) !== lastBuzz) {
      lastBuzz = state.buzz | 0;
      haptic();
    }
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.__gwReadoutSink = captureReadout;
    currentSim.draw(ctx, rect.width, rect.height, state, paramValues);
  }

  function animate(timestamp) {
    if (!animationId || !appVisible || currentView !== "sim" || !currentSim) return;
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0;
    lastFrame = timestamp;
    renderFrame(dt);
    animationId = requestAnimationFrame(animate);
  }

  function startAnimation() {
    stopAnimation();
    if (!currentSim || currentSim.static || !appVisible) return;
    lastFrame = 0;
    animationId = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = 0;
    lastFrame = 0;
  }

  window.setAppVisible = visible => {
    appVisible = Boolean(visible);
    if (appVisible && currentView === "sim") startAnimation();
    else stopAnimation();
  };

  window.handleAndroidBack = () => {
    if (currentView === "sim" || currentView === "about") {
      showHome();
      return true;
    }
    return false;
  };

  function setupCanvasInteraction() {
    let down = null;
    let dragging = false;
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    canvas.addEventListener("pointerdown", event => {
      down = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      if (currentSim && currentSim.onDragStart) {
        const p = point(event);
        dragging = currentSim.onDragStart(state, paramValues, p.x, p.y) === true;
        if (dragging) {
          event.preventDefault();
          syncControlsFromParams();
          renderActions();
          renderFrame(0);
        }
      }
    });
    canvas.addEventListener("pointermove", event => {
      if (!dragging || !currentSim || !currentSim.onDragMove) return;
      const p = point(event);
      currentSim.onDragMove(state, paramValues, p.x, p.y);
      event.preventDefault();
      syncControlsFromParams();
      renderFrame(0);
    });
    canvas.addEventListener("pointerup", event => {
      if (dragging) {
        const p = point(event);
        if (currentSim && currentSim.onDragEnd) {
          currentSim.onDragEnd(state, paramValues, p.x, p.y);
        }
        dragging = false;
        down = null;
        syncControlsFromParams();
        renderActions();
        renderFrame(0);
        haptic();
        return;
      }
      if (!down || !currentSim) return;
      if (!currentSim.onTap) { down = null; return; }
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      down = null;
      if (moved > 12) return;
      const p = point(event);
      currentSim.onTap(state, paramValues, p.x, p.y);
      if (currentSim.static) renderFrame(0);
    });
    canvas.addEventListener("pointercancel", event => {
      if (dragging && currentSim && currentSim.onDragEnd) {
        const p = point(event);
        currentSim.onDragEnd(state, paramValues, p.x, p.y);
      }
      dragging = false;
      down = null;
    });
  }

  function applyTheme(dark) {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("gw_dark", dark ? "1" : "0");
  }

  function bindUi() {
    $("brand-subtitle").textContent = `Gewu Lab · ${SIMS.length} 个互动仿真`;
    $("about-version").textContent = `版本 3.8.1 · ${SIMS.length} 个互动实验`;
    $("category-stats").replaceChildren(...CATEGORIES.map(category => {
      const span = document.createElement("span");
      span.textContent = `${category} ${SIMS.filter(sim => sim.category === category).length}`;
      return span;
    }));

    $("search-input").addEventListener("input", refreshHome);
    $("search-clear").addEventListener("click", () => {
      $("search-input").value = "";
      refreshHome();
      $("search-input").focus();
    });
    $("empty-state").querySelector("button").addEventListener("click", () => {
      $("search-input").value = "";
      refreshHome();
    });
    $("random-button").addEventListener("click", () => {
      const sim = SIMS[Math.floor(Math.random() * SIMS.length)];
      haptic();
      showToast(`随机探索：${sim.title}`, 1100);
      setTimeout(() => openSim(sim.id), 260);
    });
    $("about-button").addEventListener("click", showAbout);
    $("sim-back").addEventListener("click", showHome);
    $("about-back").addEventListener("click", showHome);
    $("sim-share").addEventListener("click", () => {
      if (currentSim) share(`格物实验 · ${currentSim.title} — 一起动手做实验`);
    });
    $("about-share").addEventListener("click", () => {
      share(`格物实验 — ${SIMS.length} 个互动仿真实验室`);
    });
    $("haptic-switch").addEventListener("change", event => {
      localStorage.setItem("gw_haptic", event.target.checked ? "1" : "0");
      if (event.target.checked) haptic(true);
    });
    $("dark-switch").addEventListener("change", event => applyTheme(event.target.checked));
    $("phet-link").addEventListener("click", () => {
      try {
        if (window.NativeBridge) NativeBridge.openUrl("https://phet.colorado.edu/zh_CN/");
        else window.open("https://phet.colorado.edu/zh_CN/", "_blank");
      } catch (_) {}
    });
    setupCanvasInteraction();
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
    document.addEventListener("visibilitychange", () => {
      window.setAppVisible(!document.hidden);
    });
  }

  applyTheme(localStorage.getItem("gw_dark") === "1");
  buildCategoryChips();
  bindUi();
  refreshHome();
})();
