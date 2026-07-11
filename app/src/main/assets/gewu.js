(() => {
  "use strict";

  const {
    SIMS,
    CATEGORIES,
    getSim,
    tr,
    setLanguage,
    getLanguage,
    simText,
    wrapCanvasContext,
  } = window.module.exports;
  const byId = Object.fromEntries(SIMS.map(sim => [sim.id, sim]));
  const FAV_KEY = "gw_fav";
  const RECENT_KEY = "gw_recent";
  const VISITED_KEY = "gw_visited";
  const LANG_KEY = "gw_lang";
  const VERSION = "4.0.0";

  const $ = id => document.getElementById(id);
  const homeView = $("home-view");
  const simView = $("sim-view");
  const aboutView = $("about-view");
  const homeContent = $("home-content");
  const canvas = $("sim-canvas");
  const ctx = canvas.getContext("2d");
  wrapCanvasContext(ctx);
  setLanguage(localStorage.getItem(LANG_KEY) || "zh");

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
  let stageLayoutId = 0;
  let canvasHintText = "";

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

  function t(text) {
    return tr(text);
  }

  function uiText(zh, en) {
    return getLanguage() === "en" ? en : zh;
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function meta(sim) {
    return simText(sim);
  }

  function showToast(message, duration = 1450) {
    const toast = $("toast");
    toast.textContent = t(message);
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
        navigator.share({ title: t("格物实验"), text: title }).catch(() => {});
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
    const m = meta(sim);
    return [sim.title, sim.category, sim.sub, m.title, m.category, m.sub]
      .some(text => String(text).toLowerCase().includes(k));
  }

  function railCard(sim) {
    const m = meta(sim);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rail-card";
    button.innerHTML = `<span>${sim.emoji}</span><span>${m.title}</span>`;
    button.addEventListener("click", () => openSim(sim.id));
    return button;
  }

  function simCard(sim, favorites) {
    const m = meta(sim);
    const interaction = sim.onDragStart ?
      { icon: "↔", label: uiText("可拖动", "Drag") } :
      (sim.onTap ? { icon: "●", label: uiText("可点按", "Tap") } : null);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sim-card";
    button.dataset.id = sim.id;
    button.innerHTML = `
      <span class="sim-icon" style="background:${hexAlpha(sim.color, .14)}">${sim.emoji}</span>
      <span class="sim-copy">
        <strong>${m.title}${favorites.includes(sim.id) ? '<span class="fav-badge">⭐</span>' : ""}</strong>
        <small>${m.sub}</small>
        ${interaction ? `<span class="interaction-badge"><span aria-hidden="true">${interaction.icon}</span>${interaction.label}</span>` : ""}
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
    $("progress-label").textContent = pct >= 100 ? `🏆 ${t("全部探索完成！")}` : `🧭 ${t("探索进度")}`;
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
      title.textContent = `${t(category)} · ${sims.length}`;
      section.append(title, ...sims.map(sim => simCard(sim, favorites)));
      groups.append(section);
    });
    $("empty-state").classList.toggle("hidden", matchCount !== 0);
    $("empty-state").querySelector("strong").textContent =
      keyword ? `${t("没有找到「")}${keyword}${t("」相关的仿真")}` : t("没有可用的仿真");
    $("home-tip").classList.toggle("hidden", matchCount === 0);
    $("home-tip").textContent = `${t("长按卡片可收藏")} · ${t("共")} ${SIMS.length} ${t("个仿真")}`;
  }

  function buildCategoryChips() {
    $("category-chips").replaceChildren(...CATEGORIES.map((category, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-chip";
      const count = SIMS.filter(sim => sim.category === category).length;
      button.innerHTML = `${t(category)}<span>${count}</span>`;
      button.addEventListener("click", () => {
        if ($("search-input").value) {
          $("search-input").value = "";
          refreshHome();
        }
        requestAnimationFrame(() => {
          const target = $(`category-${index}`);
          if (target) homeContent.scrollTo({
            top: target.offsetTop - 4,
            behavior: reducedMotion() ? "auto" : "smooth",
          });
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
    renderStaticText();
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
    const m = meta(sim);
    $("sim-title").textContent = m.title;
    $("sim-subtitle").textContent = m.sub;
    renderSteppers();
    renderActions();
    renderControls();
    const hasDirectInteraction = Boolean(sim.onTap || sim.onDragStart);
    canvasHintText = sim.hint ?
      t(sim.hint) :
      (sim.onDragStart ? t("直接拖动画面中的物体") : t("点按画布进行交互"));
    const canvasFrame = canvas.parentElement;
    canvasFrame.classList.toggle("is-interactive", hasDirectInteraction);
    canvasFrame.classList.remove("is-dragging");
    canvas.setAttribute("aria-label", hasDirectInteraction ? canvasHintText : uiText("实验画布", "Simulation canvas"));
    if (hasDirectInteraction) {
      showCanvasHint(canvasHintText, false, 3200);
    } else {
      hideCanvasHint();
    }
    $("stage").dataset.layoutReady = "false";
    switchView("sim");
    requestAnimationFrame(() => {
      applyStageHeight(sim);
      resizeCanvas();
      renderFrame(0);
      if (!sim.static) startAnimation();
    });
    if (!localStorage.getItem("gw_hinted")) {
      localStorage.setItem("gw_hinted", "1");
      showToast(sim.onDragStart ? (sim.hint || "直接拖动画面中的物体") : "拖动下方滑块，观察现象变化", 2600);
    }
  }

  function hideCanvasHint() {
    clearTimeout(canvasHintTimer);
    canvasHintTimer = 0;
    const hint = $("canvas-hint");
    hint.classList.remove("dragging");
    hint.classList.add("hidden");
  }

  function showCanvasHint(text, dragging = false, autoHide = 0) {
    clearTimeout(canvasHintTimer);
    canvasHintTimer = 0;
    const hint = $("canvas-hint");
    hint.textContent = text;
    hint.classList.toggle("dragging", dragging);
    hint.classList.remove("hidden");
    if (autoHide > 0) {
      canvasHintTimer = window.setTimeout(hideCanvasHint, autoHide);
    }
  }

  function naturalControlHeight() {
    const panel = document.querySelector(".control-panel");
    const content = $("control-content");
    const styles = getComputedStyle(panel);
    const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    return Math.ceil(content.scrollHeight + padding + 2);
  }

  function preferredStageHeight(sim, viewportHeight) {
    const count = sim.params.length;
    const fallbackRatio = count >= 5 ? 0.34 : count === 4 ? 0.39 :
      count === 3 ? 0.43 : count === 2 ? 0.47 : 0.5;
    const configuredRatio = Number(sim.stageRatio);
    const ratio = Number.isFinite(configuredRatio) ?
      Math.max(.2, Math.min(.82, configuredRatio)) : fallbackRatio;
    const configuredMinimum = Number(sim.stageMinHeight);
    const minimum = Number.isFinite(configuredMinimum) ?
      Math.max(80, configuredMinimum) : (innerWidth > innerHeight ? 140 : 168);
    return Math.min(500, Math.max(minimum, Math.round(viewportHeight * ratio)));
  }

  function applyStageHeight(sim = currentSim) {
    if (!sim || currentView !== "sim") return;
    const viewportHeight = simView.clientHeight || window.innerHeight;
    const headerHeight = simView.querySelector(".sim-header").getBoundingClientRect().height;
    const maxForControls = Math.max(0, viewportHeight - headerHeight - naturalControlHeight());
    const hardMinimum = innerWidth > innerHeight ? 110 : 144;
    const height = Math.max(hardMinimum, Math.min(preferredStageHeight(sim, viewportHeight), maxForControls));
    $("stage").style.setProperty("--stage-height", `${height}px`);
    $("stage").dataset.layoutReady = "true";
  }

  function requestStageLayout() {
    if (!currentSim || currentView !== "sim") return;
    $("stage").dataset.layoutReady = "false";
    if (stageLayoutId) cancelAnimationFrame(stageLayoutId);
    stageLayoutId = requestAnimationFrame(() => {
      stageLayoutId = 0;
      applyStageHeight();
      resizeCanvas();
    });
  }

  function syncControlsFromParams() {
    if (!currentSim) return;
    currentSim.params.forEach(param => {
      const value = paramValues[param.key];
      const input = $(`control-${param.key}`);
      const output = $(`value-${param.key}`);
      if (input) input.value = value;
      if (output) output.textContent = t(param.fmt(value));
    });
  }

  function renderControls() {
    const list = $("control-list");
    list.replaceChildren(...currentSim.params.map(param => {
      const wrapper = document.createElement("div");
      wrapper.className = "control";
      const valueId = `value-${param.key}`;
      const currentValue = paramValues[param.key] ?? param.value;
      wrapper.innerHTML = `
        <div class="control-copy">
          <label for="control-${param.key}">${t(param.label)}</label>
          <output id="${valueId}">${t(param.fmt(currentValue))}</output>
        </div>
        <input id="control-${param.key}" type="range"
          min="${param.min}" max="${param.max}" step="${param.step}" value="${currentValue}">`;
      const input = wrapper.querySelector("input");
      input.addEventListener("input", () => {
        const value = Number(input.value);
        paramValues[param.key] = value;
        $(valueId).textContent = t(param.fmt(value));
        if (currentSim.static) renderFrame(0);
      });
      input.addEventListener("pointerdown", () => wrapper.classList.add("is-adjusting"));
      ["pointerup", "pointercancel", "blur"].forEach(type => {
        input.addEventListener(type, () => wrapper.classList.remove("is-adjusting"));
      });
      return wrapper;
    }));
    requestStageLayout();
  }

  function actionLabel(action) {
    const label = typeof action.label === "function" ? action.label(state) : action.label;
    return t(label);
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
        syncControlsFromParams();
        renderActions();
        renderSteppers();
        if (currentSim.static) renderFrame(0);
      });
      button.dataset.index = index;
      return button;
    }));
    requestStageLayout();
  }

  function renderSteppers() {
    const steppers = currentSim.steppers || [];
    $("stepper-list").replaceChildren(...steppers.map(stepper => {
      const row = document.createElement("div");
      row.className = "stepper-row";
      row.innerHTML = `
        <span class="stepper-label">${t(stepper.label)}</span>
        <button type="button" class="stepper-button minus" style="color:${stepper.color}" aria-label="${uiText("减少", "Decrease")} ${t(stepper.label)}">−</button>
        <span class="stepper-value" style="color:${stepper.color}">${stepper.get(state)}</span>
        <button type="button" class="stepper-button plus" style="color:${stepper.color}" aria-label="${uiText("增加", "Increase")} ${t(stepper.label)}">+</button>`;
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
    requestStageLayout();
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

  window.setNativeInsets = insets => {
    const source = insets && typeof insets === "object" ? insets : {};
    const value = key => {
      const parsed = Number(source[key]);
      return Number.isFinite(parsed) ? Math.max(0, Math.min(256, parsed)) : 0;
    };
    const root = document.documentElement;
    ["top", "right", "bottom", "left"].forEach(side => {
      root.style.setProperty(`--native-inset-${side}`, `${value(side)}px`);
    });
    requestStageLayout();
  };

  function setupCanvasInteraction() {
    let activePointerId = null;
    let down = null;
    let lastPoint = null;
    let dragging = false;
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const releasePointer = pointerId => {
      activePointerId = null;
      try {
        if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      } catch (_) {}
    };
    const resetDragVisuals = () => {
      canvas.parentElement.classList.remove("is-dragging");
      $("canvas-hint").classList.remove("dragging");
    };
    const syncAfterGesture = () => {
      syncControlsFromParams();
      renderActions();
      renderSteppers();
      renderFrame(0);
      requestStageLayout();
    };
    const finishDrag = (event, cancelled) => {
      if (activePointerId === null || event.pointerId !== activePointerId) return false;
      const pointerId = activePointerId;
      if (dragging && currentSim && currentSim.onDragEnd) {
        const p = lastPoint || point(event);
        currentSim.onDragEnd(state, paramValues, p.x, p.y);
      }
      const wasDragging = dragging;
      dragging = false;
      down = null;
      lastPoint = null;
      releasePointer(pointerId);
      resetDragVisuals();
      if (wasDragging) {
        syncAfterGesture();
        showCanvasHint(
          cancelled ?
            uiText("操作已取消，状态已同步", "Gesture cancelled · state synced") :
            uiText("已更新，可继续拖动", "Updated · drag again"),
          false,
          1100,
        );
        if (!cancelled) haptic();
      }
      return wasDragging;
    };
    canvas.addEventListener("pointerdown", event => {
      if (activePointerId !== null || event.isPrimary === false || event.button > 0) return;
      activePointerId = event.pointerId;
      down = { x: event.clientX, y: event.clientY };
      lastPoint = point(event);
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
      if (currentSim && currentSim.onDragStart) {
        const p = lastPoint;
        dragging = currentSim.onDragStart(state, paramValues, p.x, p.y) === true;
        if (dragging) {
          event.preventDefault();
          canvas.parentElement.classList.add("is-dragging");
          showCanvasHint(uiText("正在拖动，松手完成", "Dragging · release to apply"), true);
          syncControlsFromParams();
          renderActions();
          renderSteppers();
          renderFrame(0);
        }
      }
    });
    canvas.addEventListener("pointermove", event => {
      if (event.pointerId !== activePointerId || !dragging || !currentSim || !currentSim.onDragMove) return;
      const p = point(event);
      lastPoint = p;
      currentSim.onDragMove(state, paramValues, p.x, p.y);
      event.preventDefault();
      syncControlsFromParams();
      renderFrame(0);
    });
    canvas.addEventListener("pointerup", event => {
      if (event.pointerId !== activePointerId) return;
      lastPoint = point(event);
      if (dragging && finishDrag(event, false)) return;
      const pointerId = activePointerId;
      if (!down || !currentSim) { releasePointer(pointerId); return; }
      if (!currentSim.onTap) { down = null; releasePointer(pointerId); return; }
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      down = null;
      lastPoint = null;
      releasePointer(pointerId);
      if (moved > 12) return;
      const p = point(event);
      currentSim.onTap(state, paramValues, p.x, p.y);
      syncAfterGesture();
      showCanvasHint(uiText("已更新，继续点按探索", "Updated · tap again"), false, 1100);
      haptic();
    });
    canvas.addEventListener("pointercancel", event => finishDrag(event, true));
    canvas.addEventListener("lostpointercapture", event => finishDrag(event, true));
  }

  function applyTheme(dark) {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("gw_dark", dark ? "1" : "0");
  }

  function renderLanguageButtons() {
    document.querySelectorAll("[data-lang-option]").forEach(button => {
      const active = button.dataset.langOption === getLanguage();
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderStaticText() {
    document.documentElement.lang = getLanguage() === "en" ? "en" : "zh-CN";
    document.title = t("格物实验");
    document.querySelector(".brand h1").textContent = t("格物实验");
    $("brand-subtitle").textContent = `Gewu Lab · ${SIMS.length} ${t("个互动仿真")}`;
    $("random-button").setAttribute("aria-label", t("随机探索"));
    $("about-button").setAttribute("aria-label", t("关于与设置"));
    $("category-chips").setAttribute("aria-label", t("实验分类"));
    $("search-input").placeholder = t("搜索：单摆 / 电路 / 光学 / 能量…");
    $("search-clear").setAttribute("aria-label", t("清除搜索"));
    $("favorite-section").querySelector("h2").textContent = `⭐ ${t("我的收藏")}`;
    $("recent-section").querySelector("h2").textContent = `🕐 ${t("最近使用")}`;
    $("empty-state").querySelector("button").textContent = t("清除搜索");
    $("sim-back").setAttribute("aria-label", t("返回"));
    $("sim-share").textContent = t("分享");
    $("sim-share").setAttribute("aria-label", t("分享"));
    $("about-back").setAttribute("aria-label", t("返回"));
    $("about-title").textContent = t("关于与设置");
    $("about-subtitle").textContent = t("离线互动科学实验室");
    $("about-share").textContent = t("分享");
    $("about-hero-title").textContent = t("格物实验");
    $("about-version").textContent = `${t("版本")} ${VERSION} · ${SIMS.length} ${t("个互动实验")}`;
    $("haptic-title").textContent = t("触感反馈");
    $("haptic-subtitle").textContent = t("命中、碰撞和按钮操作时轻微震动");
    $("dark-title").textContent = t("深色模式");
    $("dark-subtitle").textContent = t("降低暗光环境下的屏幕亮度");
    $("language-title").textContent = t("语言");
    $("language-subtitle").textContent = t("选择界面和实验文字语言");
    $("lang-zh").textContent = t("中文");
    $("lang-en").textContent = "English";
    $("about-copy-1").textContent = t("格物实验是一款原生封装、完全离线的互动仿真实验室，覆盖力学、波动与光、电磁、热学、原子、化学与人工智能等领域。");
    $("about-copy-2").textContent = t("直接拖动、按压、连接、投料和手写，实时观察现象与数据；长按首页卡片可收藏。应用取“格物致知”之意，教学理念受 PhET 启发。");
    $("phet-link").textContent = t("访问 PhET 官网 ↗");
    renderAboutStats();
    renderLanguageButtons();
  }

  function renderAboutStats() {
    $("category-stats").replaceChildren(...CATEGORIES.map(category => {
      const span = document.createElement("span");
      span.textContent = `${t(category)} ${SIMS.filter(sim => sim.category === category).length}`;
      return span;
    }));
  }

  function applyLanguage(lang) {
    setLanguage(lang);
    localStorage.setItem(LANG_KEY, getLanguage());
    renderStaticText();
    buildCategoryChips();
    refreshHome();
    if (currentSim) {
      const m = meta(currentSim);
      $("sim-title").textContent = m.title;
      $("sim-subtitle").textContent = m.sub;
      canvasHintText = currentSim.hint ? t(currentSim.hint) :
        (currentSim.onDragStart ? t("直接拖动画面中的物体") : t("点按画布进行交互"));
      canvas.setAttribute("aria-label", currentSim.onTap || currentSim.onDragStart ?
        canvasHintText : uiText("实验画布", "Simulation canvas"));
      renderSteppers();
      renderActions();
      renderControls();
      renderFrame(0);
      requestStageLayout();
    }
  }

  function bindUi() {
    renderStaticText();

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
      if (currentSim) share(`${t("格物实验")} · ${meta(currentSim).title} — ${t("一起动手做实验")}`);
    });
    $("about-share").addEventListener("click", () => {
      share(`${t("格物实验")} — ${SIMS.length} ${t("个互动仿真实验室")}`);
    });
    $("haptic-switch").addEventListener("change", event => {
      localStorage.setItem("gw_haptic", event.target.checked ? "1" : "0");
      if (event.target.checked) haptic(true);
    });
    $("dark-switch").addEventListener("change", event => applyTheme(event.target.checked));
    $("lang-zh").addEventListener("click", () => applyLanguage("zh"));
    $("lang-en").addEventListener("click", () => applyLanguage("en"));
    $("phet-link").addEventListener("click", () => {
      try {
        const url = getLanguage() === "en" ? "https://phet.colorado.edu/" : "https://phet.colorado.edu/zh_CN/";
        if (window.NativeBridge) NativeBridge.openUrl(url);
        else window.open(url, "_blank");
      } catch (_) {}
    });
    setupCanvasInteraction();
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
    window.addEventListener("resize", requestStageLayout);
    window.addEventListener("orientationchange", () => {
      requestStageLayout();
      window.setTimeout(requestStageLayout, 160);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", requestStageLayout);
    }
    document.addEventListener("visibilitychange", () => {
      window.setAppVisible(!document.hidden);
    });
  }

  applyTheme(localStorage.getItem("gw_dark") === "1");
  buildCategoryChips();
  bindUi();
  refreshHome();
})();
