'use strict';
// A két túra adatai: a térkép és az időjárás ugyanebből a listából dolgozik.
const routes = [
  {name:'Megyer-hegyi tengerszem', image:'https://upload.wikimedia.org/wikipedia/commons/f/fd/Megyerhegyi_tengerszem_uj.jpg', alt:'A Megyer-hegyi tengerszem sziklafalai és zöld vize', lat:48.358, lon:21.568, origin:'Sárospatak', path:'Sárospatak → Malomkő tanösvény → Tengerszem → Sárospatak'},
  {name:'Füzér vára', image:'https://upload.wikimedia.org/wikipedia/commons/2/28/F%C3%BCz%C3%A9ri_v%C3%A1r_2020_02.jpg', alt:'Füzér vára egy erdős vulkáni hegy tetején', lat:48.544, lon:21.456, origin:'Füzéri vár parkoló', path:'Füzéri várparkoló → Alsó vár → Felső vár → vissza a parkolóhoz'}
];
const $ = (id) => document.getElementById(id);
// Fekete-fehér mód; az adott böngészőben megjegyezzük a választást.
function setMode(enabled) {
  document.body.classList.toggle('bw', enabled);
  $('mode').setAttribute('aria-pressed', String(enabled));
  try { localStorage.setItem('osveny-bw', String(enabled)); } catch (_) {}
}
try { setMode(localStorage.getItem('osveny-bw') === 'true'); } catch (_) {}
$('mode').addEventListener('click', () => setMode(!document.body.classList.contains('bw')));
// Automatikus és kézzel léptethető diavetítés.
let slide = 0;
let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function showSlide(index) {
  slide = (index + routes.length) % routes.length;
  $('hero-image').src = routes[slide].image;
  $('hero-image').alt = routes[slide].alt;
  $('slide-title').textContent = `0${slide + 1} / ${routes[slide].name}`;
  $('slide-count').innerHTML = `0${slide + 1} <span>/ 02</span>`;
}
function updatePause() {
  $('pause').textContent = paused ? '▷' : 'Ⅱ';
  $('pause').setAttribute('aria-label', paused ? 'Diavetítés indítása' : 'Diavetítés szüneteltetése');
}
$('next').addEventListener('click', () => showSlide(slide + 1));
$('previous').addEventListener('click', () => showSlide(slide - 1));
$('pause').addEventListener('click', () => { paused = !paused; updatePause(); });
updatePause();
setInterval(() => { if (!paused && !document.hidden && !$('fooldal').matches(':focus-within')) showSlide(slide + 1); }, 6500);
// Google Maps: célpontváltás és külön gyalogos útvonaltervező.
function selectRoute(index, scroll = false) {
  const route = routes[index];
  $('map').src = `https://maps.google.com/maps?q=${encodeURIComponent(route.name)}&z=14&output=embed`;
  $('map').title = `Google Térkép – ${route.name}`;
  $('map-route').textContent = route.path;
  $('directions').href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(route.origin)}&destination=${encodeURIComponent(route.name)}&travelmode=walking`;
  document.querySelectorAll('.map-choice').forEach((button) => {
    const active = Number(button.dataset.route) === index;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('weather-location').value = index;
  loadWeather();
  if (scroll) $('terkep').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
}
document.querySelectorAll('[data-route]').forEach((button) => button.addEventListener('click', () => selectRoute(Number(button.dataset.route), button.classList.contains('select-route'))));
// Friss, 5 napos előrejelzés. Hiba esetén nem mutatunk kitalált adatokat.
function weatherType(code) {
  if (code === 0) return ['☀', 'Derült'];
  if (code <= 2) return ['⛅', 'Változóan felhős'];
  if (code === 3) return ['☁', 'Borult'];
  if (code === 45 || code === 48) return ['≋', 'Ködös'];
  if (code >= 95) return ['⛈', 'Zivatar'];
  if ([71,73,75,77,85,86].includes(code)) return ['❄', 'Havazás'];
  if (code >= 51) return ['☂', 'Eső, csapadék'];
  return ['☁', 'Változékony'];
}
let request = null;
async function loadWeather() {
  if (request) request.abort();
  const controller = new AbortController();
  request = controller;
  const timeout = setTimeout(() => controller.abort(), 14000);
  const route = routes[Number($('weather-location').value)];
  $('weather').innerHTML = '<p>Az előrejelzés betöltése…</p>';
  $('weather-status').textContent = `${route.name} · 5 napos előrejelzés`;
  $('refresh').disabled = true;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${route.lat}&longitude=${route.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBudapest&forecast_days=5`;
    const response = await fetch(url, {signal:controller.signal});
    if (!response.ok) throw new Error('Időjárási szolgáltatás nem elérhető');
    const {daily} = await response.json();
    if (!daily || daily.time.length !== 5) throw new Error('Hiányos adatok');
    if (request !== controller) return;
    $('weather').replaceChildren();
    daily.time.forEach((day, index) => {
      const date = new Date(day + 'T12:00:00');
      const [icon, condition] = weatherType(daily.weather_code[index]);
      const card = document.createElement('article');
      card.className = 'weather-day';
      const temperature = (value) => Number.isFinite(value) ? `${Math.round(value)}°` : '—';
      const chance = daily.precipitation_probability_max[index];
      card.innerHTML = `<h3>${index === 0 ? 'Ma' : date.toLocaleDateString('hu-HU', {weekday:'long'})}</h3><span class="weather-date">${date.toLocaleDateString('hu-HU', {month:'short',day:'numeric'})}</span><span class="weather-icon" aria-hidden="true">${icon}</span><div class="temperature" aria-label="Maximum és minimum hőmérséklet">${temperature(daily.temperature_2m_max[index])}<small>${temperature(daily.temperature_2m_min[index])}</small></div><div class="condition">${condition}</div><p class="rain">Eső esélye: ${Number.isFinite(chance) ? chance + '%' : '—'}</p>`;
      $('weather').append(card);
    });
    $('weather-status').textContent = `Frissítve: ${new Date().toLocaleTimeString('hu-HU', {hour:'2-digit',minute:'2-digit',timeZone:'Europe/Budapest'})} · Magyarországi idő · Max. / min. °C`;
  } catch (error) {
    if (request !== controller) return;
    $('weather').innerHTML = '<div class="weather-error">Az előrejelzés most nem érhető el. Ellenőrizd az internetkapcsolatot, majd nyomd meg a Frissítés gombot.</div>';
    $('weather-status').textContent = 'Nincs betöltött időjárási adat.';
  } finally {
    clearTimeout(timeout);
    if (request === controller) $('refresh').disabled = false;
  }
}
$('weather-location').addEventListener('change', loadWeather);
$('refresh').addEventListener('click', loadWeather);
loadWeather();
