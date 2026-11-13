const $ = (id) => document.getElementById(id);

const gpxFile = $("gpxFile");
const statusEl = $("status");

const profileModeInputs = [...document.querySelectorAll('input[name="profileMode"]')];
let currentTrackPoints = [];

function getProfileMode() {
  return profileModeInputs.find(input => input.checked)?.value === "route"
    ? "route"
    : "elevation";
}

function buildRouteGraphic(points) {
  return window.MontmoryRouteGeometry?.fromGPX(points) || [];
}

function applyProfileMode() {
  const mode = getProfileMode();
  if (!window.__trailMarkLastResult) return;

  const result = window.__trailMarkLastResult;
  const routeGraphic = buildRouteGraphic(currentTrackPoints);
  const elevationGraphic = result.profile || [];

  // Vorderseite = Auswahl des Kunden.
  // Rückseite = automatisch die jeweils andere Grafik.
  const frontGraphic = mode === "route" ? routeGraphic : elevationGraphic;
  const backMode = mode === "route" ? "elevation" : "route";
  const backGraphic = mode === "route" ? elevationGraphic : routeGraphic;

  renderGraphicPreview(frontGraphic, mode);

  window.update3DEngraving?.({
    profile: frontGraphic,
    profileMode: mode
  });

  window.update3DBackEngraving?.({
    graphic: backGraphic,
    graphicMode: backMode
  });

  window.TrailMarkProjectState?.setTour({
    profile: frontGraphic,
    profileMode: mode,
    backGraphic,
    backGraphicMode: backMode
  });
}

profileModeInputs.forEach(input => {
  input.addEventListener("change", applyProfileMode);
});

let currentTitle = "Meine Tour";

const titleInput = $("titleInput");

const distanceInput = $("distanceInput");
const gainInput = $("gainInput");

function formatManualDistance(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function formatManualGain(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${Math.round(n).toLocaleString("de-DE")} hm`;
}

function applyManualMetrics() {
  const distanceText = formatManualDistance(distanceInput?.value);
  const gainText = formatManualGain(gainInput?.value);
  if (!distanceText || !gainText) return;

  $("distanceValue").textContent = distanceText;
  $("gainValue").textContent = gainText;
  $("previewDistance").textContent = distanceText;
  $("previewGain").textContent = gainText;

  window.update3DEngraving?.({ distance: distanceText, gain: gainText });
  window.TrailMarkProjectState?.setTour({ distance: distanceText, gain: gainText });
}

[distanceInput, gainInput].forEach((input) => {
  input?.addEventListener("input", applyManualMetrics);
  input?.addEventListener("change", applyManualMetrics);
});

function applyManualTitle() {
  if (!titleInput) return;

  currentTitle = cleanTitle(titleInput.value);
  const previewTitle = $("previewTitle");
  if (previewTitle) previewTitle.textContent = currentTitle;

  if (window.update3DEngraving) {
    window.update3DEngraving({ title: currentTitle });
  }

  if (window.update3DBackEngraving) {
    window.update3DBackEngraving({ title: currentTitle });
  }

  window.TrailMarkProjectState?.setTour({
    title: currentTitle
  });
}

if (titleInput) {
  titleInput.addEventListener("input", applyManualTitle);
  titleInput.addEventListener("change", applyManualTitle);
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/\.gpx$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32) || "Meine Tour";
}

function readGpxTitle(xml, fileName) {
  const metadataName = xml.querySelector("metadata > name");
  if (metadataName && metadataName.textContent.trim()) {
    return cleanTitle(metadataName.textContent);
  }

  const trackName = xml.querySelector("trk > name");
  if (trackName && trackName.textContent.trim()) {
    return cleanTitle(trackName.textContent);
  }

  return cleanTitle(fileName);
}

gpxFile.addEventListener("change", async () => {
  const file = gpxFile.files?.[0];
  if (!file) return;

  statusEl.textContent = "GPX wird analysiert …";

  try {
    if (file.size > 40 * 1024 * 1024) throw new Error("Die Datei ist größer als 40 MB. Bitte eine kleinere GPX-Datei exportieren.");
    const text = await file.text();
    const xml = new DOMParser().parseFromString(text, "application/xml");

    if (xml.querySelector("parsererror")) {
      throw new Error("Die Datei ist kein gültiges GPX/XML.");
    }

    // Manche Smartphone-Exporte enthalten Routenpunkte statt Trackpunkte.
    const trackNodes = [...xml.getElementsByTagNameNS("*", "trkpt")];
    const routeNodes = [...xml.getElementsByTagNameNS("*", "rtept")];
    const nodes = trackNodes.length >= 2 ? trackNodes : routeNodes;

    if (nodes.length < 2) {
      throw new Error("Keine GPX-Strecke gefunden. Bitte eine Tour mit mindestens zwei Track- oder Routenpunkten exportieren.");
    }

    const points = nodes
      .map((node) => {
        const eleNode = node.getElementsByTagNameNS("*", "ele")[0];
        const timeNode = node.getElementsByTagNameNS("*", "time")[0];

        return {
          lat: Number(node.getAttribute("lat")),
          lon: Number(node.getAttribute("lon")),
          ele: eleNode ? Number(eleNode.textContent) : null,
          time: timeNode ? new Date(timeNode.textContent) : null
        };
      })
      .filter((point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lon)
      );

    if (points.length < 2) {
      throw new Error("Keine verwertbaren Trackpunkte gefunden.");
    }

    const result = analyseTrack(points);
    currentTrackPoints = points;
    window.__trailMarkLastResult = result;
    renderResult(result);
    applyProfileMode();
    window.dispatchEvent(new Event("trailmark:gpx-ready"));

    statusEl.textContent =
      `${file.name} erfolgreich geladen · Gravur automatisch aktualisiert.`;
  } catch (error) {
    statusEl.textContent = `Fehler beim Import: ${error.message}`;
  } finally {
    // Dieselbe Datei kann auf iOS/Android erneut ausgewählt werden.
    gpxFile.value = "";
  }
});

function analyseTrack(points) {
  // Aktueller Testwert aus unserer Kalibrierung:
  // Mini-Bewegungen unter 1 m werden ignoriert.
  const minMoveMeters = 1.0;

  let rawDistance = 0;
  let filteredDistance = 0;

  const cumulative = [0];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    const segment = haversine(a, b);

    rawDistance += segment;

    let valid = segment >= minMoveMeters;

    // Grobe GPS-Sprünge entfernen,
    // sofern Zeitstempel vorhanden sind.
    if (
      valid &&
      validDate(a.time) &&
      validDate(b.time)
    ) {
      const seconds =
        (b.time - a.time) / 1000;

      if (seconds > 0) {
        const speedKmh =
          (segment / seconds) * 3.6;

        if (speedKmh > 200) {
          valid = false;
        }
      }
    }

    if (valid) {
      filteredDistance += segment;
    }

    cumulative.push(filteredDistance);
  }

  const elevationData = points
    .map((point, index) => ({
      distance: cumulative[index],
      elevation: point.ele,
    }))
    .filter((point) =>
      Number.isFinite(point.elevation)
    );

  let profile = [];
  let gain = 0;

  if (elevationData.length >= 2) {
    const resampled =
      resampleElevation(elevationData, 10);

    profile =
      smoothByDistance(resampled, 20);

    gain =
      hysteresisGain(
        profile.map(
          (point) => point.elevation
        ),
        2
      );
  }

  const times = points
    .map((point) => point.time)
    .filter(validDate);

  const start = times[0] || null;
  const end =
    times[times.length - 1] || null;

  const duration =
    start && end
      ? Math.max(0, end - start)
      : null;

  return {
    distance:
      filteredDistance || rawDistance,
    gain,
    start,
    duration,
    profile,
  };
}

function renderResult(result) {
  const distanceText =
    `${(result.distance / 1000).toLocaleString(
      "de-DE",
      { minimumFractionDigits: 1, maximumFractionDigits: 1 }
    )} km`;

  const gainText =
    `${Math.round(result.gain).toLocaleString("de-DE")} hm`;

  if (distanceInput) distanceInput.value = (result.distance / 1000).toFixed(1);
  if (gainInput) gainInput.value = String(Math.round(result.gain));

  const durationText =
    result.duration !== null
      ? `${formatDuration(result.duration)} h`
      : "–";

  const dateText =
    result.start
      ? new Intl.DateTimeFormat("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }).format(result.start)
      : "–";

  $("distanceValue").textContent = distanceText;
  $("gainValue").textContent = gainText;
  $("durationValue").textContent = durationText;
  $("dateValue").textContent = dateText;

  $("previewTitle").textContent = currentTitle;
  $("previewDistance").textContent = distanceText;
  $("previewGain").textContent = gainText;
  $("previewDuration").textContent = durationText;
  $("previewDate").textContent = dateText;

  drawProfile(result.profile);

  if (window.update3DEngraving) {
    window.update3DEngraving({
      title: currentTitle,
      distance: distanceText,
      gain: gainText,
      duration: durationText,
      date: dateText,
      profile: result.profile
    });
  }

  // Rückseitentitel folgt automatisch der GPX.
  // Der QR-Testinhalt wird ebenfalls deterministisch aus der Tour erzeugt.
  if (window.update3DBackEngraving) {
    window.update3DBackEngraving({
      title: currentTitle
    });
  }

  window.TrailMarkProjectState?.setTour({
    title: currentTitle,
    distance: distanceText,
    gain: gainText,
    duration: durationText,
    date: dateText,
    profile: result.profile || []
  });
}

function drawProfile(data) {
  const path = $("profilePath");

  if (!data || data.length < 2) {
    path.setAttribute("d", "");
    return;
  }

  const W = 700;
  const H = 240;
  const padX = 12;
  const padY = 14;

  const maxD =
    data[data.length - 1].distance || 1;

  const elevations =
    data.map(
      (point) => point.elevation
    );

  const minE =
    Math.min(...elevations);

  const maxE =
    Math.max(...elevations);

  const range =
    Math.max(1, maxE - minE);

  const x = (distance) =>
    padX +
    (distance / maxD) *
      (W - padX * 2);

  const y = (elevation) =>
    padY +
    ((maxE - elevation) / range) *
      (H - padY * 2);

  const pathData = data
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ` +
        `${x(point.distance).toFixed(2)} ` +
        `${y(point.elevation).toFixed(2)}`
    )
    .join(" ");

  path.setAttribute("d", pathData);
}

function haversine(a, b) {
  const R = 6371000;

  const toRad = (value) =>
    (value * Math.PI) / 180;

  const dLat =
    toRad(b.lat - a.lat);

  const dLon =
    toRad(b.lon - a.lon);

  const lat1 =
    toRad(a.lat);

  const lat2 =
    toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    R *
    Math.asin(Math.sqrt(h))
  );
}

function resampleElevation(
  data,
  step
) {
  const result = [];

  const maxD =
    data[data.length - 1].distance;

  let index = 1;

  for (
    let distance = 0;
    distance <= maxD;
    distance += step
  ) {
    while (
      index < data.length &&
      data[index].distance < distance
    ) {
      index++;
    }

    if (index >= data.length) {
      break;
    }

    const a =
      data[index - 1];

    const b =
      data[index];

    const span =
      b.distance - a.distance;

    const ratio =
      span > 0
        ? (distance - a.distance) /
          span
        : 0;

    result.push({
      distance,
      elevation:
        a.elevation +
        (b.elevation -
          a.elevation) *
          ratio,
    });
  }

  return result;
}

function smoothByDistance(
  data,
  windowMeters
) {
  const radius =
    windowMeters / 2;

  return data.map(
    (point, index) => {
      let sum = 0;
      let count = 0;

      for (
        let j = index;
        j >= 0 &&
        point.distance -
          data[j].distance <=
          radius;
        j--
      ) {
        sum +=
          data[j].elevation;

        count++;
      }

      for (
        let j = index + 1;
        j < data.length &&
        data[j].distance -
          point.distance <=
          radius;
        j++
      ) {
        sum +=
          data[j].elevation;

        count++;
      }

      return {
        distance: point.distance,
        elevation: sum / count,
      };
    }
  );
}

function hysteresisGain(
  values,
  threshold
) {
  if (values.length < 2) {
    return 0;
  }

  let gain = 0;
  let valley = values[0];
  let peak = values[0];
  let climbing = null;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const value = values[i];

    if (climbing === null) {
      if (
        value >=
        valley + threshold
      ) {
        climbing = true;
        peak = value;
      } else if (
        value < valley
      ) {
        valley = value;
      }

      continue;
    }

    if (climbing) {
      if (value > peak) {
        peak = value;
      } else if (
        peak - value >=
        threshold
      ) {
        gain +=
          Math.max(
            0,
            peak - valley
          );

        climbing = false;
        valley = value;
      }
    } else {
      if (value < valley) {
        valley = value;
      } else if (
        value - valley >=
        threshold
      ) {
        climbing = true;
        peak = value;
      }
    }
  }

  if (climbing) {
    gain +=
      Math.max(
        0,
        peak - valley
      );
  }

  return gain;
}

function validDate(value) {
  return (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  );
}

function formatDuration(ms) {
  const total =
    Math.max(
      0,
      Math.round(ms / 1000)
    );

  const hours =
    Math.floor(total / 3600);

  const minutes =
    Math.floor(
      (total % 3600) / 60
    );

  const seconds =
    total % 60;

  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`
  );
}

// Demo-Höhenprofil für die Startansicht.
drawProfile([
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
  { distance: 114, elevation: 780 },
]);

window.addEventListener("load", () => setTimeout(applyManualTitle, 120));


function renderGraphicPreview(graphic, mode) {
  const path = $("profilePath");
  if (!path) return;
  if (!graphic || graphic.length < 2) {
    path.setAttribute("d", "");
    return;
  }

  if (mode === "route") {
    // Auch die kleine 2D-Vorschau verwendet einen einheitlichen Maßstab.
    const coords=window.MontmoryRouteGeometry?.fit(graphic,18,18,664,204,1024,1152) || [];
    path.setAttribute("d",coords.map((pt,i)=>
      `${i ? "L" : "M"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(" "));
  } else {
    drawProfile(graphic);
  }
}


// V43 – E-Mail-Versand der Konfiguration
// HIER deine Empfängeradresse eintragen.
// Beispiel: const CONFIG_RECIPIENT_EMAIL = "bestellung@deinedomain.de";
const CONFIG_RECIPIENT_EMAIL = "florianmachoczek@t-online.de";

function textOf(id, fallback = "") {
  return ($(id)?.textContent || fallback).trim();
}

function buildConfigurationPayload() {
  const profileMode = getProfileMode();
  const result = window.__trailMarkLastResult || null;

  return {
    version: "Trail Mark V43",
    createdAt: new Date().toISOString(),
    title: currentTitle,
    manualInputs: {
      distanceKm: distanceInput?.value ?? "",
      gainMeters: gainInput?.value ?? ""
    },
    displayedValues: {
      distance: textOf("summaryDistance", textOf("distanceValue")),
      gain: textOf("summaryGain", textOf("gainValue")),
      duration: textOf("summaryDuration"),
      date: textOf("summaryDate")
    },
    graphics: {
      front: profileMode === "route" ? "Strecke" : "Höhenprofil",
      back: profileMode === "route" ? "Höhenprofil" : "Strecke"
    },
    gpx: {
      fileName: gpxFile?.files?.[0]?.name || "",
      trackPointCount: currentTrackPoints.length
    },
    analysis: result ? {
      distanceMeters: result.distance ?? null,
      gainMeters: result.gain ?? null,
      durationSeconds: result.duration ?? null,
      date: result.date ?? null
    } : null
  };
}

// Der zweistufige Versandablauf ist in order-review.js implementiert.

// V44: SVG-Export erst nach erfolgreich analysierter GPX aktivieren.
window.addEventListener("trailmark:gpx-ready", () => {
  ["downloadFrontSvg", "downloadBackSvg"].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = false;
  });
});
