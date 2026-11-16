(function () {
  const canvas = document.getElementById('threeViewer');
  const overlay = document.getElementById('viewerOverlay');
  const errorBox = document.getElementById('viewerError');
  const errorText = document.getElementById('viewerErrorText');
  const diagnostic = document.getElementById('diagnosticText');

  // ============================================================
  // V18 – REFERENZLAYOUT AUS DER BESTÄTIGTEN AUFTEILUNG
  //
  // VORDERSEITE:
  // - Titel kompakt im oberen geraden Bereich
  // - Höhenprofil breit darunter
  // - feine Trennlinie + kleines Bergsymbol
  // - Distanz sehr dominant
  // - Höhenmeter links / Dauer rechts
  // - Datum mittig ganz unten
  //
  // RÜCKSEITE:
  // - Titel oben
  // - QR-Code zentral
  // - feine Trennlinie + kleines Bergsymbol
  // - MONTMORY-Markenblock
  // - Slogan
  // - Made in Germany unten
  //
  // 6 mm bleiben nur entlang der echten Bauteilkante frei.
  // ============================================================
  const PRODUCT_MM = { width: 60, height: 80 };
  const SAFE_MARGIN_MM = 6;

  const SAFE_POLYGON = [[512.0, 84.5], [936.2, 287.0], [936.2, 1008.5], [914.5, 1026.7], [109.5, 1026.7], [87.8, 1008.5], [87.8, 287.0]];

  // V35 – festes Layout aus der bereitgestellten JSON-Datei
  let FRONT_LAYOUT = {
  "title": {
    "x": 512,
    "y": 234.66666666666666,
    "fontSize": 103.88888888888889,
    "minFontSize": 40,
    "maxWidth": 789.9428571428572
  },
  "profile": {
    "x": 73.14285714285714,
    "y": 342.22222222222223,
    "width": 877.7142857142857,
    "height": 360
  },
  "distance": {
    "x": 512,
    "y": 799.6388888888889,
    "fontSize": 134.44444444444443,
    "minFontSize": 58,
    "maxWidth": 789.9428571428572
  },
  "gain": {
    "x": 311.5885714285714,
    "y": 945.6944444444445,
    "fontSize": 61.11111111111111,
    "minFontSize": 28,
    "maxWidth": 330.6057142857143
  },
  "duration": {
    "x": 725.5771428571428,
    "y": 945.6944444444445,
    "fontSize": 61.11111111111111,
    "minFontSize": 28,
    "maxWidth": 339.3828571428571
  },
  "date": {
    "x": 519.3142857142857,
    "y": 1044.9694444444444,
    "fontSize": 45.22222222222222,
    "minFontSize": 28,
    "maxWidth": 599.7714285714286
  }
};

  let BACK_LAYOUT = {
  "title": {
    "x": 512.7314285714285,
    "y": 229.16666666666669,
    "fontSize": 85.55555555555556,
    "minFontSize": 32,
    "maxWidth": 680.2285714285714
  },
  "logo": {
    "x": 512,
    "y": 721.1111111111111,
    "width": 455,
    "height": 205
  },
  "brand1": {
    "x": 512,
    "y": 845,
    "fontSize": 72,
    "maxWidth": 720,
    "minFontSize": 40
  },
  "brand2": {
    "x": 509.9714285714286,
    "y": 911.05,
    "fontSize": 46,
    "maxWidth": 230
  },
  "slogan": {
    "x": 512,
    "y": 954,
    "fontSize": 27,
    "maxWidth": 730,
    "minFontSize": 16
  },
  "country": {
    "x": 512,
    "y": 1040,
    "fontSize": 24,
    "maxWidth": 420
  }
}

  // V23: Bohrungen/Vertiefungen sind KEINE Bauteilkante.
  // Für den 6-mm-Abstand zählt ausschließlich die äußere Kontur.
  const BACK_EXCLUSION_ZONES = [];


  // V21: Gesamt-Gravurrahmen pro Seite.
  // Die Einzelzonen werden relativ zu diesem Ausgangsrahmen transformiert.
  const MASTER_FRAME = {
    front: { x: 87.8, y: 84.5, width: 848.4, height: 942.2 },
    back:  { x: 87.8, y: 84.5, width: 848.4, height: 942.2 }
  };

  let ACTIVE_FRAME = {
    front: { ...MASTER_FRAME.front },
    back:  { ...MASTER_FRAME.back }
  };

  FRONT_LAYOUT.divider = { x: 512, y: 715, width: 780, height: 42 };
  BACK_LAYOUT.divider = { x: 512, y: 655, width: 760, height: 42 };
  BACK_LAYOUT.profile = { x: 150, y: 345, width: 724, height: 270 };
  let EDITOR_HIDDEN = { ...window.MONTMORY_LAYOUT?.hidden };
  const isShown = (side, key) => !EDITOR_HIDDEN[`${side}:${key}`];

  const BASE_FRONT_LAYOUT = JSON.parse(JSON.stringify(FRONT_LAYOUT));
  const BASE_BACK_LAYOUT = JSON.parse(JSON.stringify(BACK_LAYOUT));

  function remap(value, oldStart, oldSize, newStart, newSize) {
    if (!oldSize) return newStart;
    return newStart + ((value - oldStart) / oldSize) * newSize;
  }

  function applyMasterFrame(side) {
    const baseFrame = MASTER_FRAME[side];
    const frame = ACTIVE_FRAME[side];
    const sx = frame.width / baseFrame.width;
    const sy = frame.height / baseFrame.height;

    const src = side === 'front' ? BASE_FRONT_LAYOUT : BASE_BACK_LAYOUT;
    const dst = side === 'front' ? FRONT_LAYOUT : BACK_LAYOUT;

    Object.keys(src).forEach(key => {
      const base = src[key];
      const target = dst[key];

      if (typeof base.x === 'number') {
        target.x = remap(base.x, baseFrame.x, baseFrame.width, frame.x, frame.width);
      }
      if (typeof base.y === 'number') {
        target.y = remap(base.y, baseFrame.y, baseFrame.height, frame.y, frame.height);
      }

      if (typeof base.width === 'number') target.width = base.width * sx;
      if (typeof base.height === 'number') target.height = base.height * sy;
      if (typeof base.size === 'number') target.size = base.size * Math.min(sx, sy);
      if (typeof base.maxWidth === 'number') target.maxWidth = base.maxWidth * sx;
      if (typeof base.fontSize === 'number') target.fontSize = base.fontSize * Math.min(sx, sy);
      if (typeof base.minFontSize === 'number') target.minFontSize = base.minFontSize * Math.min(sx, sy);
    });
  }

  // V52: Kundenseite und Editor starten mit dem gelieferten JSON-Layout.
  if (window.MONTMORY_LAYOUT?.layout) {
    FRONT_LAYOUT = JSON.parse(JSON.stringify(window.MONTMORY_LAYOUT.layout.front));
    BACK_LAYOUT = JSON.parse(JSON.stringify(window.MONTMORY_LAYOUT.layout.back));
    EDITOR_HIDDEN = { ...(window.MONTMORY_LAYOUT.hidden || {}) };
  }

  const DEFAULT_FRONT_LAYOUT = JSON.parse(JSON.stringify(FRONT_LAYOUT));
  const DEFAULT_BACK_LAYOUT = JSON.parse(JSON.stringify(BACK_LAYOUT));

  function normalizeEditableZone(side, key, patch) {
    const layout = side === 'front' ? FRONT_LAYOUT : BACK_LAYOUT;
    const zone = layout[key];
    if (!zone) return;

    if (Number.isFinite(patch.x)) zone.x = patch.x;
    if (Number.isFinite(patch.y)) zone.y = patch.y;
    if (Number.isFinite(patch.fontSize) && patch.fontSize > 0) zone.fontSize = patch.fontSize;

    if (key === 'qr') {
      if (Number.isFinite(patch.width) && patch.width > 0) zone.size = patch.width;
    } else if (key === 'profile' || key === 'logo') {
      if (Number.isFinite(patch.width) && patch.width > 0) zone.width = patch.width;
      if (Number.isFinite(patch.height) && patch.height > 0) zone.height = patch.height;
    } else {
      if (Number.isFinite(patch.width) && patch.width > 0) zone.maxWidth = patch.width;
    }
  }


  let engravingCanvas;
  let engravingCtx;
  let engravingTexture;

  let backCanvas;
  let backCtx;
  let backTexture;
  let engravingState = {
    title: 'Meine Tour',
    distance: '53,3 km',
    gain: '2933 hm',
    duration: '11:10:37 h',
    date: '20.07.2024',
    profile: [
      { distance: 0, elevation: 710 },
      { distance: 8, elevation: 755 },
      { distance: 15, elevation: 820 },
      { distance: 24, elevation: 885 },
      { distance: 32, elevation: 930 },
      { distance: 40, elevation: 900 },
      { distance: 47, elevation: 950 },
      { distance: 56, elevation: 1035 },
      { distance: 64, elevation: 1110 },
      { distance: 72, elevation: 1060 },
      { distance: 81, elevation: 990 },
      { distance: 90, elevation: 960 },
      { distance: 98, elevation: 925 },
      { distance: 105, elevation: 845 },
      { distance: 114, elevation: 780 }
    ]
  };

  let backState = {
    title: 'Meine Tour',
    qrText: 'https://example.com/eiger-ultra-trail',
    graphic: [],
    graphicMode: 'route'
  };

  let showZones = false;

  function fail(message) {
    overlay?.classList.add('hidden');
    errorBox?.classList.remove('hidden');
    if (errorText) errorText.textContent = message;
    if (diagnostic) diagnostic.textContent = '✗ ' + message;
    console.error(message);
  }

  try {
    const data = window.TRAIL_MARK_GEOMETRY;
    if (!data) {
      fail('Die eingebetteten Modelldaten wurden nicht gefunden.');
      return;
    }

    const gl =
      canvas.getContext('webgl', {
        antialias: true,
        alpha: true,
        premultipliedAlpha: false
      }) ||
      canvas.getContext('experimental-webgl', {
        antialias: true,
        alpha: true,
        premultipliedAlpha: false
      });

    if (!gl) {
      fail(
        'WebGL ist in diesem Browser nicht verfügbar oder deaktiviert. ' +
        'Teste Chrome oder Edge und prüfe die Hardwarebeschleunigung.'
      );
      return;
    }

    if (diagnostic) diagnostic.textContent = '✓ V43: WebGL und Gravurflächen werden initialisiert.';

    // ------------------------------------------------------------
    // 1) PRODUCT SHADER
    // ------------------------------------------------------------
    const productVertexSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;

      uniform mat4 uMVP;
      uniform mat4 uModel;

      varying vec3 vNormal;

      void main() {
        vNormal = normalize(mat3(uModel) * aNormal);
        gl_Position = uMVP * vec4(aPosition, 1.0);
      }
    `;

    const productFragmentSource = `
      precision mediump float;

      varying vec3 vNormal;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 light1 = normalize(vec3(0.5, 0.8, 1.0));
        vec3 light2 = normalize(vec3(-0.7, 0.25, 0.5));

        float diffuse1 = max(dot(N, light1), 0.0);
        float diffuse2 = max(dot(N, light2), 0.0);

        // Heller, hochwertiger Eichenholz-Look.
        vec3 oakLight = vec3(0.78, 0.57, 0.34);
        vec3 oakMid   = vec3(0.67, 0.43, 0.22);
        vec3 oakDark  = vec3(0.48, 0.28, 0.12);

        float grainA = 0.5 + 0.5 * sin(vNormal.x * 18.0 + vNormal.y * 5.0);
        float grainB = 0.5 + 0.5 * sin(vNormal.x * 47.0 - vNormal.y * 3.0);
        float grain = clamp(0.62 + grainA * 0.12 + grainB * 0.05, 0.0, 1.0);

        vec3 wood = mix(oakDark, oakMid, grain);
        wood = mix(wood, oakLight, 0.58);

        float lighting = 0.52 + diffuse1 * 0.40 + diffuse2 * 0.15;
        gl_FragColor = vec4(wood * lighting, 1.0);
      }
    `;

    const productProgram = createProgram(
      gl,
      productVertexSource,
      productFragmentSource
    );

    const productPositionLoc =
      gl.getAttribLocation(productProgram, 'aPosition');
    const productNormalLoc =
      gl.getAttribLocation(productProgram, 'aNormal');
    const productMvpLoc =
      gl.getUniformLocation(productProgram, 'uMVP');
    const productModelLoc =
      gl.getUniformLocation(productProgram, 'uModel');

    const positions = new Float32Array(data.positions);
    const normals = new Float32Array(data.normals);
    const indices = new Uint16Array(data.indices);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    // ------------------------------------------------------------
    // 2) ENGRAVING SHADER
    // Transparent PNG-like Canvas is placed a fraction above front face.
    // ------------------------------------------------------------
    const engravingVertexSource = `
      attribute vec3 aPosition;
      attribute vec2 aUV;

      uniform mat4 uMVP;

      varying vec2 vUV;

      void main() {
        vUV = aUV;
        gl_Position = uMVP * vec4(aPosition, 1.0);
      }
    `;

    const engravingFragmentSource = `
      precision mediump float;

      uniform sampler2D uTexture;
      varying vec2 vUV;

      void main() {
        vec4 c = texture2D(uTexture, vUV);

        if (c.a < 0.02) {
          discard;
        }

        gl_FragColor = c;
      }
    `;

    const engravingProgram = createProgram(
      gl,
      engravingVertexSource,
      engravingFragmentSource
    );

    const engravingPositionLoc =
      gl.getAttribLocation(engravingProgram, 'aPosition');
    const engravingUvLoc =
      gl.getAttribLocation(engravingProgram, 'aUV');
    const engravingMvpLoc =
      gl.getUniformLocation(engravingProgram, 'uMVP');
    const engravingTextureLoc =
      gl.getUniformLocation(engravingProgram, 'uTexture');

    // V33: Gravurfläche automatisch aus der tatsächlichen Modellgeometrie ableiten.
    // Dadurch funktioniert sie auch bei 10-mm-Bauteilen und zukünftigen Modellen.
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }

    // Kleine Einrückung an den Seiten, aber nahezu volle Bauteilfläche.
    const engravingMarginX = Math.min(0.0030, (maxX - minX) * 0.045);
    const engravingMarginY = Math.min(0.0030, (maxY - minY) * 0.035);
    const frontZ = maxZ + 0.00018;
    const backZ = minZ - 0.00018;

    const engravingLeft = minX + engravingMarginX;
    const engravingRight = maxX - engravingMarginX;
    const engravingBottom = minY + engravingMarginY;
    const engravingTop = maxY - engravingMarginY;

    const engravingVertices = new Float32Array([
      engravingLeft,  engravingBottom, frontZ,
      engravingRight, engravingBottom, frontZ,
      engravingRight, engravingTop,    frontZ,
      engravingLeft,  engravingTop,    frontZ
    ]);

    const engravingUVs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]);

    const engravingIndices = new Uint16Array([
      0, 1, 2,
      0, 2, 3
    ]);

    const engravingPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, engravingPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, engravingVertices, gl.STATIC_DRAW);

    const engravingUvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, engravingUvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, engravingUVs, gl.STATIC_DRAW);

    const engravingIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, engravingIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, engravingIndices, gl.STATIC_DRAW);

    // Rückseiten-Quad: automatisch knapp hinter der tatsächlichen Rückfläche.
    // Reihenfolge bleibt gespiegelt, damit die Beschriftung von hinten korrekt lesbar ist.
    const backVertices = new Float32Array([
      engravingRight, engravingBottom, backZ,
      engravingLeft,  engravingBottom, backZ,
      engravingLeft,  engravingTop,    backZ,
      engravingRight, engravingTop,    backZ
    ]);

    const backUVs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]);

    const backIndices = new Uint16Array([
      0, 1, 2,
      0, 2, 3
    ]);

    const backPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backVertices, gl.STATIC_DRAW);

    const backUvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backUvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backUVs, gl.STATIC_DRAW);

    const backIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, backIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, backIndices, gl.STATIC_DRAW);

    engravingCanvas = document.createElement('canvas');
    engravingCanvas.width = 1024;
    engravingCanvas.height = 1100;
    engravingCtx = engravingCanvas.getContext('2d');

    engravingTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, engravingTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    updateEngravingTexture();

    backCanvas = document.createElement('canvas');
    backCanvas.width = 1024;
    backCanvas.height = 1100;
    backCtx = backCanvas.getContext('2d');

    backTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, backTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    updateBackTexture();

    // Public hook used by app.js after a GPX is read.
    window.update3DEngraving = function (newState) {
      engravingState = {
        ...engravingState,
        ...newState
      };
      updateEngravingTexture();
    };

    window.update3DBackEngraving = function (newState) {
      backState = {
        ...backState,
        ...newState
      };
      updateBackTexture();
    };

    window.setZoneGuidesVisible = function (visible) {
      showZones = Boolean(visible);
      updateEngravingTexture();
      updateBackTexture();
    };


    window.getMasterEngravingFrame = function (side) {
      const frame = ACTIVE_FRAME[side];
      return frame ? { ...frame } : null;
    };

    window.setMasterEngravingFrame = function (side, patch) {
      const frame = ACTIVE_FRAME[side];
      if (!frame) return;

      const next = { ...frame, ...patch };

      // Mindestgröße und Texturgrenzen
      next.width = Math.max(360, Math.min(950, next.width));
      next.height = Math.max(440, Math.min(1010, next.height));
      next.x = Math.max(55, Math.min(1024 - next.width - 55, next.x));
      next.y = Math.max(70, Math.min(1100 - next.height - 16, next.y));

      ACTIVE_FRAME[side] = next;
      applyMasterFrame(side);

      updateEngravingTexture();
      updateBackTexture();
    };

    window.resetMasterEngravingFrame = function (side) {
      if (side === 'front' || side === 'back') {
        ACTIVE_FRAME[side] = { ...MASTER_FRAME[side] };
        applyMasterFrame(side);
      } else {
        ACTIVE_FRAME.front = { ...MASTER_FRAME.front };
        ACTIVE_FRAME.back = { ...MASTER_FRAME.back };
        applyMasterFrame('front');
        applyMasterFrame('back');
      }

      updateEngravingTexture();
      updateBackTexture();
    };

    window.setEngravingVisibility = function (values) {
      EDITOR_HIDDEN = { ...(values || {}) };
      updateEngravingTexture();
      updateBackTexture();
    };

    window.getEngravingZone = function (side, key) {
      const layout = side === 'front' ? FRONT_LAYOUT : BACK_LAYOUT;
      const z = layout[key];
      return z ? JSON.parse(JSON.stringify(z)) : null;
    };

    window.getEditorGeometry = function () {
      return {
        texture: { width: 1024, height: 1100 },
        productMM: { width: 60, height: 80 },
        safePolygon: JSON.parse(JSON.stringify(SAFE_POLYGON))
      };
    };

    window.updateEngravingZone = function (side, key, patch) {
      normalizeEditableZone(side, key, patch);
      updateEngravingTexture();
      updateBackTexture();
    };

    window.resetEngravingZones = function () {
      FRONT_LAYOUT = JSON.parse(JSON.stringify(DEFAULT_FRONT_LAYOUT));
      BACK_LAYOUT = JSON.parse(JSON.stringify(DEFAULT_BACK_LAYOUT));
      updateEngravingTexture();
      updateBackTexture();
    };

    window.exportEngravingZones = function () {
      return {
        front: JSON.parse(JSON.stringify(FRONT_LAYOUT)),
        back: JSON.parse(JSON.stringify(BACK_LAYOUT))
      };
    };

    window.importEngravingZones = function (data) {
      if (data && data.front) {
        FRONT_LAYOUT = JSON.parse(JSON.stringify(data.front));
      }
      if (data && data.back) {
        BACK_LAYOUT = JSON.parse(JSON.stringify(data.back));
      }
      updateEngravingTexture();
      updateBackTexture();
    };

    // ------------------------------------------------------------
    // Viewer interaction
    // ------------------------------------------------------------
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.95, 0.96, 0.97, 0.0);

    let rotX = -0.05;
    let rotY = 0.0;
    let zoom = 2.35;
    let autoRotate = false;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function drawScene(angleY, angleX, viewportWidth, viewportHeight, distance) {
      const aspect = viewportWidth / Math.max(1, viewportHeight);

      const projection =
        perspective(Math.PI / 4, aspect, 0.01, 10.0);

      const view =
        translate(0, 0, -distance);

      const scaleM =
        scale(18.0, 18.0, 18.0);

      const rx =
        rotateX(angleX);

      const ry =
        rotateY(angleY);

      const model =
        multiply(ry, multiply(rx, scaleM));

      const viewModel =
        multiply(view, model);

      const mvp =
        multiply(projection, viewModel);

      // Product
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);

      gl.useProgram(productProgram);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.enableVertexAttribArray(productPositionLoc);
      gl.vertexAttribPointer(
        productPositionLoc,
        3,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.enableVertexAttribArray(productNormalLoc);
      gl.vertexAttribPointer(
        productNormalLoc,
        3,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

      gl.uniformMatrix4fv(
        productMvpLoc,
        false,
        new Float32Array(mvp)
      );

      gl.uniformMatrix4fv(
        productModelLoc,
        false,
        new Float32Array(model)
      );

      gl.drawElements(
        gl.TRIANGLES,
        indices.length,
        gl.UNSIGNED_SHORT,
        0
      );

      // Engraving
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(engravingProgram);

      gl.bindBuffer(gl.ARRAY_BUFFER, engravingPosBuffer);
      gl.enableVertexAttribArray(engravingPositionLoc);
      gl.vertexAttribPointer(
        engravingPositionLoc,
        3,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, engravingUvBuffer);
      gl.enableVertexAttribArray(engravingUvLoc);
      gl.vertexAttribPointer(
        engravingUvLoc,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        engravingIndexBuffer
      );

      gl.uniformMatrix4fv(
        engravingMvpLoc,
        false,
        new Float32Array(mvp)
      );

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, engravingTexture);
      gl.uniform1i(engravingTextureLoc, 0);

      gl.drawElements(
        gl.TRIANGLES,
        engravingIndices.length,
        gl.UNSIGNED_SHORT,
        0
      );

      // Rückseiten-Gravur
      gl.bindBuffer(gl.ARRAY_BUFFER, backPosBuffer);
      gl.enableVertexAttribArray(engravingPositionLoc);
      gl.vertexAttribPointer(
        engravingPositionLoc,
        3,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, backUvBuffer);
      gl.enableVertexAttribArray(engravingUvLoc);
      gl.vertexAttribPointer(
        engravingUvLoc,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, backIndexBuffer);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, backTexture);
      gl.uniform1i(engravingTextureLoc, 0);

      gl.drawElements(
        gl.TRIANGLES,
        backIndices.length,
        gl.UNSIGNED_SHORT,
        0
      );

    }

    function render() {
      resize();
      if (autoRotate && !window.MontmoryDual3D) rotY += 0.006;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (window.MontmoryDual3D) {
        gl.enable(gl.SCISSOR_TEST);
        const leftWidth = Math.floor(canvas.width / 2);
        const rightWidth = canvas.width - leftWidth;
        // Zwei echte WebGL-Renderings des Holzmodells, mit beiden Gravurtexturen.
        // Der Kameraabstand wird für die schmaleren Viewports angepasst.
        const dualZoom = zoom * 1.24;
        gl.viewport(0, 0, leftWidth, canvas.height);
        gl.scissor(0, 0, leftWidth, canvas.height);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        drawScene(0, -0.05, leftWidth, canvas.height, dualZoom);
        gl.viewport(leftWidth, 0, rightWidth, canvas.height);
        gl.scissor(leftWidth, 0, rightWidth, canvas.height);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        drawScene(Math.PI, -0.05, rightWidth, canvas.height, dualZoom);
        gl.disable(gl.SCISSOR_TEST);
      } else {
        gl.viewport(0, 0, canvas.width, canvas.height);
        drawScene(rotY, rotX, canvas.width, canvas.height, zoom);
      }
      requestAnimationFrame(render);
    }

    canvas.addEventListener('pointerdown', (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return;

      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;

      rotY += dx * 0.01;
      rotX += dy * 0.01;

      rotX = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, rotX)
      );

      lastX = event.clientX;
      lastY = event.clientY;
    });

    canvas.addEventListener('pointerup', () => {
      dragging = false;
    });

    canvas.addEventListener('pointercancel', () => {
      dragging = false;
    });

    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();

        zoom += event.deltaY * 0.0025;
        zoom = Math.max(1.35, Math.min(4.5, zoom));
      },
      { passive: false }
    );

    document
      .getElementById('frontView')
      ?.addEventListener('click', () => {
        rotX = 0;
        rotY = 0;
        zoom = 2.35;
      });

    document
      .getElementById('sideView')
      ?.addEventListener('click', () => {
        rotX = 0;
        rotY = Math.PI / 2;
        zoom = 2.35;
      });

    document
      .getElementById('backView')
      ?.addEventListener('click', () => {
        rotX = 0;
        rotY = Math.PI;
        zoom = 2.35;
      });

    document
      .getElementById('resetCamera')
      ?.addEventListener('click', () => {
        rotX = -0.05;
        rotY = 0;
        zoom = 2.35;
      });

    document
      .getElementById('toggleRotate')
      ?.addEventListener('click', (event) => {
        autoRotate = !autoRotate;

        event.currentTarget.textContent =
          autoRotate
            ? 'Auto-Rotation aus'
            : 'Auto-Rotation an';
      });

    overlay?.classList.add('hidden');

    if (diagnostic) {
      diagnostic.textContent =
        '✓ V43 · Modell, Gravur und Produktions-Engine aktiv.';
    }

    requestAnimationFrame(render);

    // ------------------------------------------------------------
    // Canvas -> texture
    // ------------------------------------------------------------
    function updateEngravingTexture() {
      const ctx = engravingCtx;
      const W = engravingCanvas.width;
      const H = engravingCanvas.height;

      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(30, 15, 5, 0.985)';
      ctx.strokeStyle = 'rgba(30, 15, 5, 0.985)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Title
      if (isShown("front", "title")) fitText(
        ctx,
        engravingState.title || 'Meine Tour',
        FRONT_LAYOUT.title.x,
        FRONT_LAYOUT.title.y,
        FRONT_LAYOUT.title.fontSize,
        FRONT_LAYOUT.title.maxWidth,
        FRONT_LAYOUT.title.minFontSize,
        '500'
      );

      // Elevation profile
      if (isShown("front", "profile")) drawElevationProfile(
        ctx,
        engravingState.profile || [],
        FRONT_LAYOUT.profile.x,
        FRONT_LAYOUT.profile.y,
        FRONT_LAYOUT.profile.width,
        FRONT_LAYOUT.profile.height,
        engravingState.profileMode === "elevation"
      );

      // feine Trennlinie + kleines Bergsymbol wie im Referenzlayout
      if (isShown("front", "divider")) drawDividerWithMiniMountain(ctx, FRONT_LAYOUT.divider.x, FRONT_LAYOUT.divider.y, FRONT_LAYOUT.divider.width);

      // Distance
      if (isShown("front", "distance")) fitText(
        ctx,
        engravingState.distance || '–',
        FRONT_LAYOUT.distance.x,
        FRONT_LAYOUT.distance.y,
        FRONT_LAYOUT.distance.fontSize,
        FRONT_LAYOUT.distance.maxWidth,
        FRONT_LAYOUT.distance.minFontSize,
        '500'
      );

      // Bottom row
      if (isShown("front", "gain")) fitText(
        ctx,
        engravingState.gain || '–',
        FRONT_LAYOUT.gain.x,
        FRONT_LAYOUT.gain.y,
        FRONT_LAYOUT.gain.fontSize,
        FRONT_LAYOUT.gain.maxWidth,
        FRONT_LAYOUT.gain.minFontSize,
        '500'
      );

      if (isShown("front", "duration")) fitText(
        ctx,
        engravingState.duration || '–',
        FRONT_LAYOUT.duration.x,
        FRONT_LAYOUT.duration.y,
        FRONT_LAYOUT.duration.fontSize,
        FRONT_LAYOUT.duration.maxWidth,
        FRONT_LAYOUT.duration.minFontSize,
        '500'
      );

      const destination = String(engravingState.destination || '').trim().slice(0, 30);
      const hasDestination = Boolean(engravingState.destinationEnabled && destination);
      if (isShown("front", "date")) fitText(
        ctx,
        engravingState.date || '–',
        FRONT_LAYOUT.date.x,
        hasDestination ? 1008 : FRONT_LAYOUT.date.y,
        hasDestination ? 49 : FRONT_LAYOUT.date.fontSize,
        FRONT_LAYOUT.date.maxWidth,
        hasDestination ? 32 : FRONT_LAYOUT.date.minFontSize,
        '500'
      );
      if (hasDestination) fitText(
        ctx, destination, 512, 1072, 39, 660, 25, '500'
      );

      if (showZones) {
        drawZoneGuides(ctx, 'VORDERSEITE', [
          ['1 Titel', FRONT_LAYOUT.title.x - FRONT_LAYOUT.title.maxWidth / 2, FRONT_LAYOUT.title.y - 45, FRONT_LAYOUT.title.maxWidth, 90],
          ['2 Höhenprofil', FRONT_LAYOUT.profile.x, FRONT_LAYOUT.profile.y, FRONT_LAYOUT.profile.width, FRONT_LAYOUT.profile.height],
          ['3 Distanz', FRONT_LAYOUT.distance.x - FRONT_LAYOUT.distance.maxWidth / 2, FRONT_LAYOUT.distance.y - 66, FRONT_LAYOUT.distance.maxWidth, 132],
          ['4 Höhenmeter', FRONT_LAYOUT.gain.x - FRONT_LAYOUT.gain.maxWidth / 2, FRONT_LAYOUT.gain.y - 44, FRONT_LAYOUT.gain.maxWidth, 88],
          ['5 Dauer', FRONT_LAYOUT.duration.x - FRONT_LAYOUT.duration.maxWidth / 2, FRONT_LAYOUT.duration.y - 44, FRONT_LAYOUT.duration.maxWidth, 88],
          ['6 Datum', FRONT_LAYOUT.date.x - FRONT_LAYOUT.date.maxWidth / 2, FRONT_LAYOUT.date.y - 40, FRONT_LAYOUT.date.maxWidth, 80]
        ]);
      }

      gl.bindTexture(gl.TEXTURE_2D, engravingTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        engravingCanvas
      );
    }

    function updateBackTexture() {
      const ctx = backCtx;
      const W = backCanvas.width;
      const H = backCanvas.height;

      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(30, 15, 5, 0.99)';
      ctx.strokeStyle = 'rgba(30, 15, 5, 0.99)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1) Tourtitel
      if (isShown("back", "title")) fitText(
        ctx,
        backState.title || 'Meine Tour',
        BACK_LAYOUT.title.x,
        BACK_LAYOUT.title.y,
        BACK_LAYOUT.title.fontSize,
        BACK_LAYOUT.title.maxWidth,
        BACK_LAYOUT.title.minFontSize,
        '500'
      );

      // Komplementäre Tourgrafik auf der freien Rückseitenfläche.
      // Wenn vorne das Höhenprofil steht, erscheint hier die Strecke – und umgekehrt.
      if (isShown("back", "profile") && Array.isArray(backState.graphic) && backState.graphic.length >= 2) {
        drawElevationProfile(
          ctx,
          backState.graphic,
          BACK_LAYOUT.profile.x,
          BACK_LAYOUT.profile.y,
          BACK_LAYOUT.profile.width,
          BACK_LAYOUT.profile.height,
          backState.graphicMode === "elevation"
        );
      }

      // feine Trennlinie + kleines Bergsymbol wie im Referenzlayout
      if (isShown("back", "divider")) drawDividerWithMiniMountain(ctx, BACK_LAYOUT.divider.x, BACK_LAYOUT.divider.y, BACK_LAYOUT.divider.width);

      // MONTMORY: reduzierte Markenbeschriftung unterhalb der Tourgrafik.
      // Die bisherige Adventure-Board-Grafik wird nicht mehr angezeigt.
      if (isShown('back', 'brand1')) fitText(ctx, 'MONTMORY',
        BACK_LAYOUT.brand1.x, BACK_LAYOUT.brand1.y,
        BACK_LAYOUT.brand1.fontSize, BACK_LAYOUT.brand1.maxWidth,
        BACK_LAYOUT.brand1.minFontSize || 30, '600');
      if (isShown('back', 'slogan')) fitText(ctx, 'From Mountains to Memories.',
        BACK_LAYOUT.slogan.x, BACK_LAYOUT.slogan.y,
        BACK_LAYOUT.slogan.fontSize, BACK_LAYOUT.slogan.maxWidth,
        BACK_LAYOUT.slogan.minFontSize || 14, '400');

      // 6) Optionale Widmung; ohne Eingabe bleibt die Fläche frei
      if (isShown('back', 'country')) fitText(ctx,
        window.MontmoryGift?.text() || '',
        BACK_LAYOUT.country.x, BACK_LAYOUT.country.y,
        BACK_LAYOUT.country.fontSize, BACK_LAYOUT.country.maxWidth,
        26, '400');

      if (showZones) {
        drawZoneGuides(ctx, 'RÜCKSEITE', [
          ['1 Titel', BACK_LAYOUT.title.x - BACK_LAYOUT.title.maxWidth / 2, BACK_LAYOUT.title.y - 42, BACK_LAYOUT.title.maxWidth, 84],
          ['2 Tourgrafik', 150, 345, 724, 220],
          ['3 MONTMORY', BACK_LAYOUT.brand1.x - BACK_LAYOUT.brand1.maxWidth / 2, BACK_LAYOUT.brand1.y - 45, BACK_LAYOUT.brand1.maxWidth, 90],
          ['4 Slogan', BACK_LAYOUT.slogan.x - BACK_LAYOUT.slogan.maxWidth / 2, BACK_LAYOUT.slogan.y - 28, BACK_LAYOUT.slogan.maxWidth, 56],
          ['4 Widmung', BACK_LAYOUT.country.x - 280, BACK_LAYOUT.country.y - 34, 560, 68]
        ]);
      }

      gl.bindTexture(gl.TEXTURE_2D, backTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        backCanvas
      );
    }

    function drawPseudoQR(ctx, text, x, y, size) {
      const modules = 29;
      const cell = size / modules;

      // simple deterministic hash from text
      let seed = 2166136261 >>> 0;
      for (let i = 0; i < text.length; i++) {
        seed ^= text.charCodeAt(i);
        seed = Math.imul(seed, 16777619) >>> 0;
      }

      const grid = Array.from({ length: modules }, () =>
        Array(modules).fill(false)
      );

      function finder(gx, gy) {
        for (let yy = 0; yy < 7; yy++) {
          for (let xx = 0; xx < 7; xx++) {
            const edge = xx === 0 || yy === 0 || xx === 6 || yy === 6;
            const inner = xx >= 2 && xx <= 4 && yy >= 2 && yy <= 4;
            grid[gy + yy][gx + xx] = edge || inner;
          }
        }
      }

      finder(0, 0);
      finder(modules - 7, 0);
      finder(0, modules - 7);

      function inFinder(xx, yy) {
        return (
          (xx < 7 && yy < 7) ||
          (xx >= modules - 7 && yy < 7) ||
          (xx < 7 && yy >= modules - 7)
        );
      }

      for (let yy = 0; yy < modules; yy++) {
        for (let xx = 0; xx < modules; xx++) {
          if (inFinder(xx, yy)) continue;

          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          seed >>>= 0;

          grid[yy][xx] = (seed & 1) === 1;
        }
      }

      ctx.save();
      ctx.fillStyle = 'rgba(22, 13, 6, 0.98)';

      for (let yy = 0; yy < modules; yy++) {
        for (let xx = 0; xx < modules; xx++) {
          if (!grid[yy][xx]) continue;

          ctx.fillRect(
            x + xx * cell,
            y + yy * cell,
            Math.ceil(cell),
            Math.ceil(cell)
          );
        }
      }

      ctx.restore();
    }

    function drawDividerWithMiniMountain(ctx, centerX, y, totalWidth) {
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 18, 7, 0.94)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const gap = 88;
      const half = totalWidth / 2;

      ctx.beginPath();
      ctx.moveTo(centerX - half, y);
      ctx.lineTo(centerX - gap / 2, y);
      ctx.moveTo(centerX + gap / 2, y);
      ctx.lineTo(centerX + half, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - 32, y + 6);
      ctx.lineTo(centerX - 8, y - 22);
      ctx.lineTo(centerX + 4, y - 8);
      ctx.lineTo(centerX + 20, y - 30);
      ctx.lineTo(centerX + 34, y + 6);
      ctx.stroke();

      ctx.restore();
    }

    function drawAdventureLogo(ctx, centerX, centerY, width, height) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.strokeStyle = 'rgba(22, 13, 6, 0.98)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const w = width / 2;
      const h = height / 2;

      // linke Bergsilhouette
      ctx.beginPath();
      ctx.moveTo(-w, h * 0.72);
      ctx.lineTo(-w * 0.45, -h * 0.05);
      ctx.lineTo(-w * 0.25, h * 0.10);
      ctx.lineTo(0, -h * 0.82);
      ctx.stroke();

      // rechte Bergsilhouette
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.82);
      ctx.lineTo(w * 0.42, h * 0.03);
      ctx.lineTo(w * 0.58, -h * 0.04);
      ctx.lineTo(w, h * 0.72);
      ctx.stroke();

      // Trail-Linie
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.62);
      ctx.quadraticCurveTo(-w * 0.02, -h * 0.02, w * 0.22, h * 0.18);
      ctx.quadraticCurveTo(-w * 0.05, h * 0.38, -w * 0.17, h * 0.40);
      ctx.quadraticCurveTo(w * 0.18, h * 0.50, 0, h * 0.82);
      ctx.stroke();

      // kleine Sonne
      ctx.beginPath();
      ctx.arc(w * 0.58, -h * 0.62, 20, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    function drawElevationProfile(ctx, points, x, y, width, height, showAxis = false) {
      if (!Array.isArray(points) || points.length < 2) return;
      const axis = showAxis ? window.MontmoryElevationAxis?.get(points) : null;
      const values = points.map(p => Number(p.elevation));
      const distances = points.map(p => Number(p.distance));
      const minE = axis ? axis.bottom : Math.min(...values);
      const maxE = axis ? axis.top : Math.max(...values);
      const minD = Math.min(...distances);
      const maxD = Math.max(...distances);
      const chartX = x + (axis ? Math.min(155, width * 0.24) : 0);
      const chartW = width - (chartX - x);
      const rangeE = Math.max(1e-9, maxE-minE);
      const rangeD = Math.max(1e-9, maxD-minD);
      ctx.save();
      if (axis) {
        ctx.font = '600 29px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        axis.ticks.forEach(tick => {
          const py = y + height - (tick - minE) / rangeE * height;
          ctx.fillStyle = '#181818';
          ctx.fillText(window.MontmoryElevationAxis.format(tick), chartX-12, py);
          ctx.beginPath();
          ctx.setLineDash([8, 7]);
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = 'rgba(40, 35, 30, 0.65)';
          ctx.moveTo(chartX, py);
          ctx.lineTo(chartX+chartW, py);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }
      if (!showAxis && window.MontmoryRouteGeometry) {
        const routePoints=window.MontmoryRouteGeometry.fit(points,x,y,width,height,60,80);
        if(routePoints.length>=2) {
          ctx.beginPath();
          ctx.lineWidth=9;
          ctx.lineCap='round';
          ctx.lineJoin='round';
          ctx.strokeStyle='#151515';
          routePoints.forEach((p,i)=>i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      ctx.beginPath();
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#151515';
      points.forEach((point, index) => {
        const px = chartX + (Number(point.distance)-minD) / rangeD * chartW;
        const py = y + height - (Number(point.elevation)-minE) / rangeE * height;
        if (index === 0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      });
      ctx.stroke();
      ctx.restore();
    }

    function drawZoneGuides(ctx, side, zones) {
      ctx.save();

      // 6-mm-Sicherheitskontur entlang der echten Bauteilform.
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(75, 134, 224, 0.92)';
      ctx.beginPath();
      SAFE_POLYGON.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point[0], point[1]);
        else ctx.lineTo(point[0], point[1]);
      });
      ctx.closePath();
      ctx.stroke();

      // Gravurzonen.
      ctx.strokeStyle = 'rgba(145, 70, 210, 0.90)';
      ctx.fillStyle = 'rgba(145, 70, 210, 0.96)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '500 18px Arial, Helvetica, sans-serif';

      zones.forEach(([name, x, y, w, h]) => {
        ctx.strokeRect(x, y, w, h);
        ctx.fillText(name, x + 7, y + 6);
      });

      // Rückseite: mechanische Sperrzonen.
      if (side === 'RÜCKSEITE') {
        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = 'rgba(219, 91, 65, 0.96)';
        ctx.fillStyle = 'rgba(219, 91, 65, 0.14)';

        BACK_EXCLUSION_ZONES.forEach(zone => {
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }

      ctx.restore();
    }

    function fitText(
      ctx,
      text,
      x,
      y,
      initialSize,
      maxWidth,
      minSize,
      weight
    ) {
      let size = initialSize;

      while (size > minSize) {
        ctx.font =
          `${weight} ${size}px Arial, Helvetica, sans-serif`;

        if (ctx.measureText(text).width <= maxWidth) {
          break;
        }

        size -= 2;
      }

      ctx.font =
        `${weight} ${size}px Arial, Helvetica, sans-serif`;

      ctx.fillText(text, x, y);
    }

  } catch (error) {
    console.error(error);
    fail(error.message || String(error));
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader-Fehler: ' + message);
    }

    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader =
      createShader(gl, gl.VERTEX_SHADER, vertexSource);

    const fragmentShader =
      createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      throw new Error('WebGL-Programmfehler: ' + message);
    }

    return program;
  }

  function multiply(a, b) {
    const out = new Array(16).fill(0);

    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        for (let k = 0; k < 4; k++) {
          out[col * 4 + row] +=
            a[k * 4 + row] *
            b[col * 4 + k];
        }
      }
    }

    return out;
  }

  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);

    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0
    ];
  }

  function translate(x, y, z) {
    return [
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      x,y,z,1
    ];
  }

  function scale(x, y, z) {
    return [
      x,0,0,0,
      0,y,0,0,
      0,0,z,0,
      0,0,0,1
    ];
  }

  function rotateX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return [
      1,0,0,0,
      0,c,s,0,
      0,-s,c,0,
      0,0,0,1
    ];
  }

  function rotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return [
      c,0,-s,0,
      0,1,0,0,
      s,0,c,0,
      0,0,0,1
    ];
  }
})();
