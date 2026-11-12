/* V54: Achsenwerte aus echten GPX-Höhen, nicht aus der Routengrafik. */
window.MontmoryElevationAxis = (() => {
  function get(points) {
    const values = (points || []).map(p => Number(p.elevation)).filter(Number.isFinite);
    if (values.length < 2) return null;
    const low = Math.min(...values), high = Math.max(...values);
    const span = Math.max(1, high - low);
    const target = span / 4;
    const magnitude = 10 ** Math.floor(Math.log10(target));
    const candidates = [1, 2, 2.5, 5, 10].map(n => n * magnitude);
    const step = candidates.find(s => s >= target) || 10 * magnitude;
    let bottom = Math.floor(low / step) * step;
    let top = Math.ceil(high / step) * step;
    if (top <= bottom) top = bottom + step;
    const ticks = [];
    for (let t = bottom; t <= top + step * 1e-7 && ticks.length < 9; t += step)
      ticks.push(Math.round(t * 1000) / 1000);
    return {bottom, top, ticks, min:low, max:high};
  }
  function format(m) { return `${Math.round(m).toLocaleString("de-DE")} m`; }
  return {get, format};
})();
