'use strict';

// Extras: lluvia inminente, próximas horas, sol, aire, polen, oleaje,
// ciudades favoritas, enlace compartible y PWA.
// Independiente de app.js: reacciona al evento "tiempo:lugar".
(() => {
  const $ = id => document.getElementById(id);
  const API = {
    tiempo: 'https://api.open-meteo.com/v1/forecast',
    aire: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    mar: 'https://marine-api.open-meteo.com/v1/marine'
  };
  const NIVELES = ['Bajo', 'Moderado', 'Alto', 'Extremo'];
  const POLEN = { alder: 'Aliso', birch: 'Abedul', grass: 'Gramíneas', mugwort: 'Artemisa', olive: 'Olivo', ragweed: 'Ambrosía' };
  let token = 0, ex = null, aire = null, mar = null, pendiente = null;

  const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
  const fmt = n => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const el = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  };
  const leer = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  // ---------- lluvia inminente, horas y sol ----------
  const ahora = () => new Date(Date.now() + ex.utc_offset_seconds * 1000).toISOString().slice(0, 16);

  function textoLluvia() {
    const m = ex.minutely_15;
    if (!m?.precipitation) return 'Sin datos de lluvia a corto plazo.';
    const now = ahora();
    let i0 = m.time.findIndex(t => t > now);
    i0 = i0 < 0 ? m.time.length - 1 : Math.max(0, i0 - 1);
    const p = m.precipitation.slice(i0), t = m.time.slice(i0);
    const llueve = v => v >= 0.1;
    const mins = i => Math.max(0, Math.round((new Date(t[i]) - new Date(now)) / 60000));
    if (llueve(p[0])) {
      const fin = p.findIndex(v => !llueve(v));
      return fin < 0 ? 'Está lloviendo y seguirá al menos 2 horas.' : `Está lloviendo y para en unos ${mins(fin)} min.`;
    }
    const ini = p.findIndex(llueve);
    return ini < 0 ? 'No se espera lluvia en las próximas 2 horas.' : `Empieza a llover en unos ${mins(ini)} min.`;
  }

  function pintarExtras() {
    if (!ex) { $('extras').hidden = true; return; }
    $('lluvia').textContent = textoLluvia();
    const h = ex.hourly;
    let i = h.time.findIndex(t => t.slice(0, 13) >= ahora().slice(0, 13));
    if (i < 0) i = 0;
    $('horas').replaceChildren(...h.time.slice(i, i + 24).map((t, k) => {
      const j = i + k, li = el('li');
      li.append(
        el('span', null, k === 0 ? 'Ahora' : `${t.slice(11, 13)}h`),
        el('b', null, clima(h.weather_code[j]).icon),
        el('span', null, `${deg(h.temperature_2m[j])}°`),
        el('i', null, `${h.precipitation_probability[j] ?? 0}%`)
      );
      return li;
    }));
    const d = ex.daily;
    $('sol').replaceChildren(...[
      [d.sunrise[0].slice(11), 'Amanecer'],
      [d.sunset[0].slice(11), 'Atardecer'],
      [`${d.precipitation_probability_max[0] ?? 0}%`, 'Lluvia hoy']
    ].map(([v, etiqueta]) => {
      const div = el('div');
      div.append(el('b', null, v), el('small', null, etiqueta));
      return div;
    }));
    $('extras').hidden = false;
  }

  // ---------- aire, polen y mar ----------
  function fila(icono, nombre, nivel, texto) {
    const li = el('li', 'riesgo');
    li.dataset.nivel = nivel;
    const ico = el('span', 'r-ico', icono);
    ico.setAttribute('aria-hidden', 'true');
    const cuerpo = el('div');
    cuerpo.append(el('b', null, nombre), el('p', null, texto));
    const badge = el('span', 'r-nivel', NIVELES[nivel]);
    badge.dataset.nivel = nivel;
    li.append(ico, cuerpo, badge);
    return li;
  }

  function pintarAire() {
    const filas = [];
    const c = aire?.current;
    if (Number.isFinite(c?.european_aqi)) {
      const v = c.european_aqi;
      const etiqueta = ['buena', 'aceptable', 'moderada', 'mala', 'muy mala', 'extremadamente mala'][v < 20 ? 0 : v < 40 ? 1 : v < 60 ? 2 : v < 80 ? 3 : v < 100 ? 4 : 5];
      filas.push(fila('🌫️', 'Calidad del aire', v < 40 ? 0 : v < 60 ? 1 : v < 80 ? 2 : 3, `Índice europeo ${Math.round(v)}: calidad ${etiqueta}.`));
    }
    const polen = Object.entries(POLEN).map(([k, n]) => [n, c?.[`${k}_pollen`]]).filter(([, v]) => Number.isFinite(v));
    if (polen.length) { // el polen solo existe para Europa
      const [nombre, v] = polen.reduce((a, b) => (b[1] > a[1] ? b : a));
      filas.push(fila('🌼', 'Polen', v >= 200 ? 3 : v >= 50 ? 2 : v >= 10 ? 1 : 0,
        v < 1 ? 'Polen bajo.' : `${nombre} es el más alto: ${Math.round(v)} granos/m³.`));
    }
    const olas = mar?.daily?.wave_height_max;
    if (olas?.some(Number.isFinite)) { // en ciudades de interior no hay datos de mar
      const i = olas.reduce((m, v, k) => (Number.isFinite(v) && (m < 0 || v > olas[m]) ? k : m), -1);
      const cuando = i === 0 ? 'hoy' : i === 1 ? 'mañana'
        : `el ${new Date(`${mar.daily.time[i]}T12:00`).toLocaleDateString('es-ES', { weekday: 'long' })}`;
      filas.push(fila('🌊', 'Oleaje', olas[i] >= 5 ? 3 : olas[i] >= 3.5 ? 2 : olas[i] >= 2 ? 1 : 0,
        `Olas de hasta ${fmt(olas[i])} m ${cuando}.`));
    }
    $('aire-lista').replaceChildren(...filas);
    $('aire').hidden = !filas.length;
  }

  async function cargarExtras(lugar) {
    const mi = ++token;
    const q = o => new URLSearchParams({ latitude: lugar.latitude, longitude: lugar.longitude, timezone: 'auto', ...o });
    const [f, a, m] = await Promise.allSettled([
      get(`${API.tiempo}?${q({
        hourly: 'temperature_2m,precipitation_probability,weather_code',
        daily: 'sunrise,sunset,precipitation_probability_max',
        minutely_15: 'precipitation', forecast_minutely_15: 8, forecast_days: 2
      })}`),
      get(`${API.aire}?${q({ current: 'european_aqi,' + Object.keys(POLEN).map(k => `${k}_pollen`).join(',') })}`),
      get(`${API.mar}?${q({ daily: 'wave_height_max', forecast_days: 5 })}`)
    ]);
    if (mi !== token) return;
    const ok = r => (r.status === 'fulfilled' ? r.value : null);
    ex = ok(f); aire = ok(a); mar = ok(m);
    pintarExtras();
    pintarAire();
  }

  // ---------- ciudades favoritas ----------
  let favs = leer('favs') ?? [];
  const igual = (a, b) => a.label === b.label && Math.abs(a.latitude - b.latitude) < 0.01;

  function pintarFavs() {
    const p = state.place;
    const esFav = !!p && favs.some(f => igual(f, p));
    $('fav').hidden = !p;
    $('fav').textContent = esFav ? '★ Quitar' : '☆ Guardar';
    $('fav').setAttribute('aria-pressed', esFav);
    $('favlist').replaceChildren(...favs.map(f => {
      const li = el('li'), b = el('button', 'ghost', f.label.split(',')[0]);
      b.type = 'button';
      b.title = f.label;
      b.addEventListener('click', () => window.cargar(f));
      li.append(b);
      return li;
    }));
  }

  $('fav').addEventListener('click', () => {
    const p = state.place;
    favs = favs.some(f => igual(f, p)) ? favs.filter(f => !igual(f, p)) : [...favs, p].slice(-8);
    guardar('favs', favs);
    pintarFavs();
  });

  // ---------- enlace compartible (#c=lat,lon|Ciudad) ----------
  function leerHash() {
    const m = /^#c=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\|(.{0,80})$/.exec(location.hash);
    if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return null;
    try { return { latitude: +m[1], longitude: +m[2], label: decodeURIComponent(m[3]) || 'Ubicación' }; } catch { return null; }
  }
  // La ubicación del usuario nunca se pone en la URL
  const ponHash = p => p.label !== 'Tu ubicación' && history.replaceState(null, '',
    `#c=${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}|${encodeURIComponent(p.label)}`);

  // ---------- arranque ----------
  document.addEventListener('tiempo:lugar', e => {
    const lugar = e.detail;
    if (pendiente) { // el enlace manda sobre la última ciudad guardada
      const p = pendiente;
      pendiente = null;
      if (!igual(p, lugar)) return window.cargar(p);
    }
    ponHash(lugar);
    pintarFavs();
    cargarExtras(lugar);
  });
  $('unit').addEventListener('click', () => { if (ex) pintarExtras(); });

  pendiente = leerHash();
  if (pendiente && !state.place) { const p = pendiente; pendiente = null; window.cargar(p); }
  pintarFavs();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* la app funciona igual sin PWA */ });
  }
})();
