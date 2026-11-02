'use strict';

// Riesgos meteorológicos: inundación fluvial, lluvia torrencial, tormentas,
// viento, nieve, calor, frío y radiación UV.
// Módulo independiente: app.js solo le avisa con el evento "tiempo:lugar"
// cada vez que carga una ciudad. Si este archivo falla, la app sigue igual.
(() => {
  const $ = id => document.getElementById(id);
  const API = {
    tiempo: 'https://api.open-meteo.com/v1/forecast',
    rio: 'https://flood-api.open-meteo.com/v1/flood'
  };
  const DIAS_PASADOS = 30; // referencia para saber qué caudal es "lo habitual"
  const NIVELES = ['Bajo', 'Moderado', 'Alto', 'Extremo'];

  // Umbrales orientativos: [moderado, alto, extremo].
  // Los avisos oficiales varían según la zona; esto es una estimación.
  const UMBRAL = {
    lluvia1h: [20, 40, 60],     // mm en 1 hora
    lluvia12h: [40, 80, 180],   // mm acumulados en 12 horas
    rachas: [70, 90, 120],      // km/h
    nieve: [2, 10, 30],         // cm en un día
    calor: [36, 40, 44],        // °C máxima
    frio: [-5, -10, -15],       // °C mínima
    uv: [8, 11, 14],            // índice UV
    caudal: [1.5, 2.5, 4]       // veces el caudal habitual
  };

  let datos = null;
  let token = 0;

  // ---------- utilidades ----------
  const fmt = n => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const imperial = () => typeof state !== 'undefined' && state.unit === 'f';
  const mm = v => (imperial() ? `${(v / 25.4).toFixed(2)} in` : `${fmt(v)} mm`);
  const cm = v => (imperial() ? `${fmt(v / 2.54)} in` : `${fmt(v)} cm`);
  const vel = v => (imperial() ? `${Math.round(v * 0.621)} mph` : `${Math.round(v)} km/h`);
  const grados = c => `${Math.round(imperial() ? c * 9 / 5 + 32 : c)}°`;

  const subeA = (v, t) => (Number.isFinite(v) ? t.filter(x => v >= x).length : 0);
  const bajaA = (v, t) => (Number.isFinite(v) ? t.filter(x => v <= x).length : 0);

  const pico = (arr, menor = false) => arr.reduce((m, v, i) => (
    Number.isFinite(v) && (m.i < 0 || (menor ? v < m.v : v > m.v)) ? { v, i } : m
  ), { v: NaN, i: -1 });

  const mediana = arr => {
    const o = [...arr].sort((a, b) => a - b);
    const m = o.length >> 1;
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  };

  // Mayor acumulado en una ventana de n horas
  function ventana(horas, n) {
    let mejor = { v: 0, i: 0 };
    let suma = 0;
    horas.forEach((h, i) => {
      suma += h ?? 0;
      if (i >= n) suma -= horas[i - n] ?? 0;
      if (i >= n - 1 && suma > mejor.v) mejor = { v: suma, i: i - n + 1 };
    });
    return mejor;
  }

  const cuando = i => {
    const f = datos.meteo.daily.time[i];
    if (i === 0) return 'hoy';
    if (i === 1) return 'mañana';
    return `el ${new Date(`${f}T12:00`).toLocaleDateString('es-ES', { weekday: 'long' })}`;
  };
  const diaDeHora = i => datos.meteo.daily.time.indexOf(datos.meteo.hourly.time[i].slice(0, 10));

  // ---------- cálculo de cada riesgo ----------
  function riesgoRio() {
    const base = { icono: '🌊', nombre: 'Inundación fluvial', siempre: true };
    if (!datos.rio?.daily) {
      return { ...base, nivel: 0, texto: 'No se pudo consultar el caudal de los ríos.' };
    }
    const t = datos.rio.daily;
    let i0 = t.time.indexOf(datos.meteo.daily.time[0]);
    if (i0 < 0) i0 = DIAS_PASADOS;
    const pasado = t.river_discharge.slice(0, i0).filter(Number.isFinite);
    const futuro = (t.river_discharge_max ?? t.river_discharge).slice(i0, i0 + 5);
    const p = pico(futuro);
    if (!pasado.length || p.i < 0 || p.v < 5) {
      return { ...base, nivel: 0, texto: 'Sin ríos de caudal relevante cerca según el modelo.' };
    }
    const ratio = p.v / Math.max(mediana(pasado), 1);
    const nivel = subeA(ratio, UMBRAL.caudal);
    return {
      ...base,
      nivel,
      texto: nivel
        ? `Caudal previsto de ${fmt(ratio)}× lo habitual en las últimas semanas, con el máximo ${cuando(p.i)}.`
        : 'Caudal estable: no se esperan subidas relevantes en los próximos 5 días.'
    };
  }

  function riesgoLluvia() {
    const base = { icono: '🌧️', nombre: 'Lluvia torrencial', siempre: true };
    const h = datos.meteo.hourly.precipitation;
    const m1 = pico(h);
    const w = ventana(h, 12);
    const nivel = Math.max(subeA(m1.v, UMBRAL.lluvia1h), subeA(w.v, UMBRAL.lluvia12h));
    if (nivel) {
      return {
        ...base,
        nivel,
        texto: `Hasta ${mm(m1.v)}/h y ${mm(w.v)} en 12 horas, con el pico ${cuando(diaDeHora(w.i))}. Posible inundación repentina.`
      };
    }
    return {
      ...base,
      nivel: 0,
      texto: w.v < 1
        ? 'Sin lluvias relevantes previstas.'
        : `Máximo previsto: ${mm(w.v)} en 12 horas (${cuando(diaDeHora(w.i))}).`
    };
  }

  function riesgoTormenta() {
    const codigos = datos.meteo.daily.weather_code;
    const nivelDe = c => (c === 99 ? 3 : c === 96 ? 2 : c === 95 ? 1 : 0);
    const p = pico(codigos.map(nivelDe));
    return {
      icono: '⛈️',
      nombre: 'Tormentas',
      nivel: Math.max(p.v, 0),
      texto: p.v > 0
        ? `Tormenta${p.v >= 2 ? ' con granizo' : ''} prevista ${cuando(p.i)}.`
        : ''
    };
  }

  function riesgoViento() {
    const p = pico(datos.meteo.daily.wind_gusts_10m_max);
    return {
      icono: '💨',
      nombre: 'Viento fuerte',
      nivel: subeA(p.v, UMBRAL.rachas),
      texto: `Rachas de hasta ${vel(p.v)} ${cuando(p.i)}.`
    };
  }

  function riesgoNieve() {
    const p = pico(datos.meteo.daily.snowfall_sum);
    return {
      icono: '❄️',
      nombre: 'Nevadas',
      nivel: subeA(p.v, UMBRAL.nieve),
      texto: `Hasta ${cm(p.v)} de nieve ${cuando(p.i)}.`
    };
  }

  function riesgoCalor() {
    const p = pico(datos.meteo.daily.temperature_2m_max);
    return {
      icono: '🥵',
      nombre: 'Calor extremo',
      nivel: subeA(p.v, UMBRAL.calor),
      texto: `Máxima de ${grados(p.v)} ${cuando(p.i)}.`
    };
  }

  function riesgoFrio() {
    const p = pico(datos.meteo.daily.temperature_2m_min, true);
    return {
      icono: '🥶',
      nombre: 'Frío extremo',
      nivel: bajaA(p.v, UMBRAL.frio),
      texto: `Mínima de ${grados(p.v)} ${cuando(p.i)}.`
    };
  }

  function riesgoUV() {
    const p = pico(datos.meteo.daily.uv_index_max);
    return {
      icono: '☀️',
      nombre: 'Radiación UV',
      nivel: subeA(p.v, UMBRAL.uv),
      texto: `Índice UV de ${fmt(p.v)} ${cuando(p.i)}. Usa protección solar.`
    };
  }

  const calcular = () => [
    riesgoRio(), riesgoLluvia(), riesgoTormenta(), riesgoViento(),
    riesgoNieve(), riesgoCalor(), riesgoFrio(), riesgoUV()
  ];

  // ---------- pintado ----------
  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function render() {
    if (!datos) return;
    const filas = calcular()
      .filter(f => f.siempre || f.nivel > 0)
      .sort((a, b) => b.nivel - a.nivel);
    const max = Math.max(...filas.map(f => f.nivel));

    const resumen = $('riesgos-resumen');
    resumen.textContent = NIVELES[max];
    resumen.dataset.nivel = max;
    $('riesgos-estado').textContent = max === 0
      ? 'Sin riesgos destacables en los próximos 5 días.'
      : `Riesgo máximo en los próximos 5 días: ${NIVELES[max].toLowerCase()}.`;

    $('riesgos-lista').replaceChildren(...filas.map(f => {
      const li = el('li', 'riesgo');
      li.dataset.nivel = f.nivel;
      const ico = el('span', 'r-ico', f.icono);
      ico.setAttribute('aria-hidden', 'true');
      const cuerpo = el('div');
      cuerpo.append(el('b', null, f.nombre), el('p', null, f.texto));
      const badge = el('span', 'r-nivel', NIVELES[f.nivel]);
      badge.dataset.nivel = f.nivel;
      li.append(ico, cuerpo, badge);
      return li;
    }));
    $('riesgos').hidden = false;
  }

  // ---------- datos ----------
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }

  async function cargarRiesgos(lugar) {
    const mi = ++token;
    $('riesgos').hidden = false;
    $('riesgos-resumen').textContent = '';
    $('riesgos-lista').replaceChildren();
    $('riesgos-estado').textContent = 'Calculando riesgos…';

    const pos = { latitude: lugar.latitude, longitude: lugar.longitude };
    const tiempo = new URLSearchParams({
      ...pos,
      daily: 'weather_code,wind_gusts_10m_max,snowfall_sum,temperature_2m_max,temperature_2m_min,uv_index_max',
      hourly: 'precipitation',
      timezone: 'auto',
      forecast_days: 5
    });
    const rio = new URLSearchParams({
      ...pos,
      daily: 'river_discharge,river_discharge_max',
      past_days: DIAS_PASADOS,
      forecast_days: 5
    });

    // El caudal de ríos es opcional: si falla, el resto de riesgos se muestra igual.
    const [m, r] = await Promise.allSettled([
      getJSON(`${API.tiempo}?${tiempo}`),
      getJSON(`${API.rio}?${rio}`)
    ]);
    if (mi !== token) return; // el usuario ya ha cambiado de ciudad
    if (m.status !== 'fulfilled') {
      datos = null;
      $('riesgos-estado').textContent = 'No se pudieron calcular los riesgos en este momento.';
      return;
    }
    datos = { meteo: m.value, rio: r.status === 'fulfilled' ? r.value : null };
    render();
  }

  document.addEventListener('tiempo:lugar', e => cargarRiesgos(e.detail));
  $('unit').addEventListener('click', render); // cambia mm/in, km/h/mph, °C/°F

  // Por si app.js ya terminó de cargar la ciudad antes de que este módulo arrancara
  if (typeof state !== 'undefined' && state.data && state.place) cargarRiesgos(state.place);
})();
