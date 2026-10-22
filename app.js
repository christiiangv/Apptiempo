'use strict';

const $ = id => document.getElementById(id);
const API = {
  buscar: 'https://geocoding-api.open-meteo.com/v1/search',
  tiempo: 'https://api.open-meteo.com/v1/forecast'
};

// Códigos de tiempo de la OMM → texto, icono y ambiente de color
const WMO = [
  [[0], 'Despejado', '☀️', 'clear'],
  [[1], 'Casi despejado', '🌤️', 'clear'],
  [[2], 'Parcialmente nublado', '⛅', 'cloud'],
  [[3], 'Nublado', '☁️', 'cloud'],
  [[45, 48], 'Niebla', '🌫️', 'cloud'],
  [[51, 53, 55, 56, 57], 'Llovizna', '🌦️', 'rain'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Lluvia', '🌧️', 'rain'],
  [[71, 73, 75, 77, 85, 86], 'Nieve', '❄️', 'snow'],
  [[95, 96, 99], 'Tormenta', '⛈️', 'storm']
];
const clima = code => {
  const [, text, icon, mood] = WMO.find(([codes]) => codes.includes(code)) ?? [0, 'Sin datos', '🌡️', 'cloud'];
  return { text, icon, mood };
};

// Estado y preferencias guardadas en el navegador
const leer = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const state = { unit: leer('unit') ?? 'c', place: leer('place'), data: null };

const say = (texto = '') => { $('status').textContent = texto; };
const deg = c => Math.round(state.unit === 'c' ? c : c * 9 / 5 + 32);

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

async function buscar(nombre) {
  const q = new URLSearchParams({ name: nombre, count: 5, language: 'es' });
  const { results = [] } = await getJSON(`${API.buscar}?${q}`);
  return results.map(r => ({
    latitude: r.latitude,
    longitude: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', ')
  }));
}

async function cargar(lugar) {
  say('Cargando…');
  $('suggest').hidden = true;
  try {
    const q = new URLSearchParams({
      latitude: lugar.latitude,
      longitude: lugar.longitude,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      timezone: 'auto',
      forecast_days: 5
    });
    state.data = await getJSON(`${API.tiempo}?${q}`);
    state.place = lugar;
    guardar('place', lugar);
    pintar();
    say();
  } catch {
    say('No se pudo cargar el tiempo. Comprueba tu conexión e inténtalo de nuevo.');
  }
}

function pintar() {
  const { current: c, daily: d } = state.data;
  const ahora = clima(c.weather_code);
  document.body.dataset.mood = ahora.mood;
  $('city').textContent = state.place.label;
  $('icon').textContent = ahora.icon;
  $('temp').textContent = `${deg(c.temperature_2m)}°`;
  $('desc').textContent = ahora.text;
  $('feels').textContent = `${deg(c.apparent_temperature)}°`;
  $('hum').textContent = `${c.relative_humidity_2m}%`;
  $('wind').textContent = state.unit === 'c'
    ? `${Math.round(c.wind_speed_10m)} km/h`
    : `${Math.round(c.wind_speed_10m * 0.621)} mph`;

  $('days').innerHTML = d.time.map((fecha, i) => {
    const dia = i === 0 ? 'Hoy' : new Date(`${fecha}T12:00`).toLocaleDateString('es-ES', { weekday: 'short' });
    return `<li><span>${dia}</span><b>${clima(d.weather_code[i]).icon}</b>` +
           `${deg(d.temperature_2m_max[i])}° <i>${deg(d.temperature_2m_min[i])}°</i></li>`;
  }).join('');

  $('unit').textContent = state.unit === 'c' ? '°C' : '°F';
  $('now').hidden = $('forecast').hidden = false;
}

function sugerir(lugares) {
  $('suggest').replaceChildren(...lugares.map(l => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ghost';
    b.textContent = l.label;
    b.addEventListener('click', () => cargar(l));
    li.append(b);
    return li;
  }));
  $('suggest').hidden = false;
}

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = $('q').value.trim();
  if (!nombre) return;
  say('Buscando…');
  try {
    const lugares = await buscar(nombre);
    if (!lugares.length) return say('No encontré esa ciudad. Prueba con otro nombre.');
    if (lugares.length === 1) return cargar(lugares[0]);
    sugerir(lugares);
    say('Elige la ciudad que buscas:');
  } catch {
    say('No se pudo buscar. Comprueba tu conexión.');
  }
});

$('geo').addEventListener('click', () => {
  if (!navigator.geolocation) return say('Tu navegador no permite usar la ubicación.');
  say('Buscando tu ubicación…');
  navigator.geolocation.getCurrentPosition(
    p => cargar({ latitude: p.coords.latitude, longitude: p.coords.longitude, label: 'Tu ubicación' }),
    () => say('No pude obtener tu ubicación. Busca una ciudad a mano.')
  );
});

$('unit').addEventListener('click', () => {
  state.unit = state.unit === 'c' ? 'f' : 'c';
  guardar('unit', state.unit);
  $('unit').textContent = state.unit === 'c' ? '°C' : '°F';
  if (state.data) pintar();
});

// Al abrir, recupera la última ciudad consultada
$('unit').textContent = state.unit === 'c' ? '°C' : '°F';
if (state.place) cargar(state.place);
