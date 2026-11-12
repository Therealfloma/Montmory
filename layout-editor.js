
(() => {
  const MM_W = 60;
  const MM_H = 80;
  const TEX_W = 1024;
  const TEX_H = 1100;

  const labels = {
    front: {
      title: "Titel",
      profile: "Höhenprofil / Strecke",
      divider: "Trennlinie",
      distance: "Distanz",
      gain: "Höhenmeter",
      duration: "Dauer",
      date: "Datum"
    },
    back: {
      title: "Titel",
      profile: "Strecke / Höhenprofil",
      divider: "Trennlinie",
      brand1: "MONTMORY",
      slogan: "Slogan",
      country: "Widmung (optional)"
    }
  };

  let side = "front";
  let selectedKey = "title";
  let layout = { front: {}, back: {} };
  let hidden = {};
  let locked = {};
  let dragging = null;
  let gridEnabled = true;
  let snapMM = 1;
  let showSafeZone = false;
  let showHiddenLayers = true;

  const board = document.getElementById("layoutBoard");
  const objectLayer = document.getElementById("objectLayer");
  const safeSvg = document.getElementById("safeSvg");
  const elementList = document.getElementById("elementList");
  const sideButtons = [...document.querySelectorAll("[data-side]")];

  const xInput = document.getElementById("propX");
  const yInput = document.getElementById("propY");
  const wInput = document.getElementById("propW");
  const hInput = document.getElementById("propH");
  const fontInput = document.getElementById("propFont");
  const visibleInput = document.getElementById("propVisible");
  const lockedInput = document.getElementById("propLocked");
  const snapInput = document.getElementById("snapSize");
  const gridInput = document.getElementById("gridEnabled");

  function pxToMMX(px) { return px / TEX_W * MM_W; }
  function pxToMMY(px) { return px / TEX_H * MM_H; }
  function mmToPxX(mm) { return mm / MM_W * TEX_W; }
  function mmToPxY(mm) { return mm / MM_H * TEX_H; }

  function boardRect() {
    return board.getBoundingClientRect();
  }

  function textureToBoardX(x) {
    return x / TEX_W * boardRect().width;
  }

  function textureToBoardY(y) {
    return y / TEX_H * boardRect().height;
  }

  function boardToTextureX(x) {
    return x / boardRect().width * TEX_W;
  }

  function boardToTextureY(y) {
    return y / boardRect().height * TEX_H;
  }

  function snapTextureX(value) {
    if (!gridEnabled || snapMM <= 0) return value;
    const mm = pxToMMX(value);
    return mmToPxX(Math.round(mm / snapMM) * snapMM);
  }

  function snapTextureY(value) {
    if (!gridEnabled || snapMM <= 0) return value;
    const mm = pxToMMY(value);
    return mmToPxY(Math.round(mm / snapMM) * snapMM);
  }

  function zoneBounds(key, zone) {
    if (key === "profile" || key === "logo") {
      return { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
    }
    if (key === "divider") {
      return { x: zone.x - zone.width / 2, y: zone.y - zone.height / 2, width: zone.width, height: zone.height };
    }
    if (key === "qr") {
      return { x: zone.x, y: zone.y, width: zone.size, height: zone.size };
    }

    const width = zone.maxWidth || Math.max(160, (zone.fontSize || 40) * 5);
    const height = Math.max(58, (zone.fontSize || 40) * 1.35);
    return {
      x: zone.x - width / 2,
      y: zone.y - height / 2,
      width,
      height
    };
  }

  function patchFromBounds(key, oldZone, bounds) {
    if (key === "profile" || key === "logo") {
      return {
        x: bounds.x, y: bounds.y,
        width: bounds.width, height: bounds.height
      };
    }

    if (key === "divider") {
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, width: bounds.width, height: bounds.height };
    }
    if (key === "qr") {
      return {
        x: bounds.x, y: bounds.y,
        width: Math.min(bounds.width, bounds.height),
        height: Math.min(bounds.width, bounds.height)
      };
    }

    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      width: bounds.width,
      height: bounds.height,
      fontSize: oldZone.fontSize
    };
  }

  function loadFromViewer() {
    for (const currentSide of ["front", "back"]) {
      for (const key of Object.keys(labels[currentSide])) {
        layout[currentSide][key] = window.getEngravingZone(currentSide, key);
        if (hidden[`${currentSide}:${key}`] === undefined)
          hidden[`${currentSide}:${key}`] = !!window.MONTMORY_LAYOUT?.hidden?.[`${currentSide}:${key}`];
        if (locked[`${currentSide}:${key}`] === undefined)
          locked[`${currentSide}:${key}`] = false;
      }
    }
  }

  function renderSafePolygon() {
    if (!showSafeZone) { safeSvg.innerHTML = ""; return; }
    const geometry = window.getEditorGeometry?.();
    if (!geometry) return;
    const points = geometry.safePolygon
      .map(([x, y]) => `${textureToBoardX(x)},${textureToBoardY(y)}`)
      .join(" ");
    safeSvg.innerHTML = `<polygon points="${points}" />`;
  }

  function renderElementList() {
    elementList.innerHTML = "";
    Object.entries(labels[side]).forEach(([key, label]) => {

      const button = document.createElement("button");
      button.type = "button";
      button.className = "element-row" + (key === selectedKey ? " active" : "") + (hidden[`${side}:${key}`] ? " is-hidden" : "");
      button.innerHTML = `
        <span class="layer-icon">${locked[`${side}:${key}`] ? "🔒" : "◇"}</span>
        <span>${label}</span>
        <small>${hidden[`${side}:${key}`] ? "aus" : "an"}</small>
      `;
      button.addEventListener("click", () => {
        selectedKey = key;
        renderAll();
      });
      elementList.appendChild(button);
    });
  }

  function elementPreview(key) {
    const previews = {
      title: "Meine Tour",
      profile: "⌁ Höhenprofil",
      divider: "— ⛰ —",
      distance: "53,3 km",
      gain: "2933 hm",
      duration: "11:10:37 h",
      date: "20.07.2024",
      qr: "▦ QR",
      logo: "⌁ BERGLOGO",
      brand1: "MONTMORY",
      slogan: "From Mountains to Memories.",
      country: "Widmung (optional)"
    };
    return previews[key] || key;
  }

  function renderObjects() {
    objectLayer.innerHTML = "";
    Object.entries(layout[side]).forEach(([key, zone]) => {
      if (!zone || hidden[`${side}:${key}`]) return;

      const bounds = zoneBounds(key, zone);
      const el = document.createElement("div");
      el.className = "design-object" + (key === selectedKey ? " selected" : "");
      el.dataset.key = key;
      el.style.left = `${textureToBoardX(bounds.x)}px`;
      el.style.top = `${textureToBoardY(bounds.y)}px`;
      el.style.width = `${textureToBoardX(bounds.width)}px`;
      el.style.height = `${textureToBoardY(bounds.height)}px`;

      const content = document.createElement("div");
      content.className = `object-content type-${key}`;
      content.textContent = elementPreview(key);
      if (zone.fontSize) {
        content.style.fontSize = `${Math.max(10, textureToBoardY(zone.fontSize) * 0.56)}px`;
      }
      el.appendChild(content);

      if (key === selectedKey && !locked[`${side}:${key}`]) {
        for (const handle of ["nw", "ne", "sw", "se"]) {
          const h = document.createElement("span");
          h.className = `handle ${handle}`;
          h.dataset.handle = handle;
          el.appendChild(h);
        }
      }

      el.addEventListener("pointerdown", (event) => beginDrag(event, key));
      objectLayer.appendChild(el);
    });
  }

  function renderProperties() {
    if (!layout[side][selectedKey]) selectedKey = "title";
    const zone = layout[side][selectedKey];
    if (!zone) return;
    const b = zoneBounds(selectedKey, zone);

    xInput.value = pxToMMX(b.x).toFixed(1);
    yInput.value = pxToMMY(b.y).toFixed(1);
    wInput.value = pxToMMX(b.width).toFixed(1);
    hInput.value = pxToMMY(b.height).toFixed(1);
    fontInput.value = zone.fontSize
      ? pxToMMY(zone.fontSize).toFixed(1)
      : "";
    fontInput.disabled = !zone.fontSize;
    visibleInput.checked = !hidden[`${side}:${selectedKey}`];
    lockedInput.checked = locked[`${side}:${selectedKey}`];
    document.getElementById("selectedName").textContent = labels[side][selectedKey];
  }

  function renderBoardMode() {
    document.getElementById("sideName").textContent =
      side === "front" ? "Vorderseite" : "Rückseite";
    sideButtons.forEach(btn =>
      btn.classList.toggle("active", btn.dataset.side === side)
    );
    board.classList.toggle("back-mode", side === "back");
  }

  function renderAll() {
    renderBoardMode();
    renderSafePolygon();
    renderElementList();
    renderObjects();
    renderProperties();
    window.setEngravingVisibility?.(hidden);
  }

  function beginDrag(event, key) {
    event.preventDefault();
    event.stopPropagation();
    selectedKey = key;

    if (locked[`${side}:${key}`] || hidden[`${side}:${key}`]) {
      renderAll();
      return;
    }

    const zone = layout[side][key];
    const bounds = zoneBounds(key, zone);
    const handle = event.target.dataset.handle || "move";

    dragging = {
      key,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      bounds: { ...bounds },
      zone: JSON.parse(JSON.stringify(zone))
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    renderAll();
  }

  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    const dx = boardToTextureX(event.clientX - dragging.startX);
    const dy = boardToTextureY(event.clientY - dragging.startY);
    let b = { ...dragging.bounds };

    if (dragging.handle === "move") {
      b.x = snapTextureX(dragging.bounds.x + dx);
      b.y = snapTextureY(dragging.bounds.y + dy);
    } else {
      if (dragging.handle.includes("e")) b.width = Math.max(20, dragging.bounds.width + dx);
      if (dragging.handle.includes("s")) b.height = Math.max(20, dragging.bounds.height + dy);
      if (dragging.handle.includes("w")) {
        b.x = dragging.bounds.x + dx;
        b.width = Math.max(20, dragging.bounds.width - dx);
      }
      if (dragging.handle.includes("n")) {
        b.y = dragging.bounds.y + dy;
        b.height = Math.max(20, dragging.bounds.height - dy);
      }
      b.x = snapTextureX(b.x);
      b.y = snapTextureY(b.y);
      b.width = Math.max(20, snapTextureX(b.width));
      b.height = Math.max(20, snapTextureY(b.height));
    }

    const patch = patchFromBounds(dragging.key, dragging.zone, b);
    window.updateEngravingZone(side, dragging.key, patch);
    layout[side][dragging.key] = window.getEngravingZone(side, dragging.key);
    renderObjects();
    renderProperties();
  });

  window.addEventListener("pointerup", () => {
    dragging = null;
  });

  function applyNumericProperties() {
    const zone = layout[side][selectedKey];
    if (!zone) return;

    const b = {
      x: mmToPxX(Number(xInput.value)),
      y: mmToPxY(Number(yInput.value)),
      width: Math.max(10, mmToPxX(Number(wInput.value))),
      height: Math.max(10, mmToPxY(Number(hInput.value)))
    };

    const patch = patchFromBounds(selectedKey, zone, b);
    if (zone.fontSize && fontInput.value !== "") {
      patch.fontSize = mmToPxY(Number(fontInput.value));
    }

    window.updateEngravingZone(side, selectedKey, patch);
    layout[side][selectedKey] = window.getEngravingZone(side, selectedKey);
    renderObjects();
  }

  [xInput, yInput, wInput, hInput, fontInput].forEach(input =>
    input.addEventListener("input", applyNumericProperties)
  );

  visibleInput.addEventListener("change", () => {
    hidden[`${side}:${selectedKey}`] = !visibleInput.checked;
    renderAll();
  });

  lockedInput.addEventListener("change", () => {
    locked[`${side}:${selectedKey}`] = lockedInput.checked;
    renderAll();
  });

  document.getElementById("showSafeZone")?.addEventListener("change", event => {
    showSafeZone = event.target.checked;
    renderSafePolygon();
  });


  gridInput.addEventListener("change", () => {
    gridEnabled = gridInput.checked;
    board.classList.toggle("grid-off", !gridEnabled);
  });

  snapInput.addEventListener("change", () => {
    snapMM = Math.max(0, Number(snapInput.value) || 0);
  });

  sideButtons.forEach(button => {
    button.addEventListener("click", () => {
      side = button.dataset.side;
      selectedKey = Object.keys(labels[side])[0];
      document.getElementById(side === "front" ? "frontView" : "backView").click();
      renderAll();
    });
  });

  document.getElementById("resetLayout").addEventListener("click", () => {
    window.resetEngravingZones();
    hidden = { ...(window.MONTMORY_LAYOUT?.hidden || {}) };
    loadFromViewer();
    renderAll();
  });

  document.getElementById("saveLayout").addEventListener("click", () => {
    const data = {
      version: 1,
      product: { widthMM: MM_W, heightMM: MM_H },
      layout: window.exportEngravingZones(),
      hidden,
      locked
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "default-layout.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("loadLayout").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    const data = JSON.parse(await file.text());
    window.importEngravingZones(data.layout || data);
    hidden = data.hidden || hidden;
    locked = data.locked || locked;
    loadFromViewer();
    renderAll();
  });

  document.getElementById("saveBrowser").addEventListener("click", () => {
    localStorage.setItem("trailmark-v32-layout", JSON.stringify({
      layout: window.exportEngravingZones(),
      hidden,
      locked
    }));
  });

  document.getElementById("loadBrowser").addEventListener("click", () => {
    const raw = localStorage.getItem("trailmark-v32-layout");
    if (!raw) return;
    const data = JSON.parse(raw);
    window.importEngravingZones(data.layout);
    hidden = data.hidden || hidden;
    locked = data.locked || locked;
    loadFromViewer();
    renderAll();
  });

  window.addEventListener("resize", renderAll);

  window.addEventListener("load", () => {
    setTimeout(() => {
      loadFromViewer();
      window.setZoneGuidesVisible?.(false);
      renderAll();
    }, 180);
  });
})();
