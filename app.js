/* TuCloset · web 0.8 · lógica (0.8, 20/10: Hoy, Clóset, filtros y entrada cerrados por Gabriela) (0.7, 19/10: subida en lote y generador de conjuntos, encargo de Sheila) (Dirección, 18/10/2026; 0.6 la misma noche: base V5 tarjeta, maniquí del Básico, estilos nogal/verde/color, entrada con las puertas)
   Todo se guarda en el navegador (IndexedDB): perfil, prendas con su foto, conjuntos y usos. Sin servidor.
   Pantallas: inicio, alta, silueta, hoy, closet, anadir, ficha, looks, nuevo-look, look, yo. */
'use strict';
const PUBLICA = !!window.TC_PUBLICA; // la copia pública (web/): sin el clóset de ejemplo, que lleva fotos de Sheila

/* ---------- almacén (IndexedDB, clave→valor) ---------- */
const BD = (() => {
  let db;
  const abrir = () => new Promise((res, rej) => {
    if (db) return res(db);
    const r = indexedDB.open('tucloset', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { db = r.result; res(db); };
    r.onerror = () => rej(r.error);
  });
  const op = (modo, f) => abrir().then(d => new Promise((res, rej) => { const tx = d.transaction('kv', modo); const q = f(tx.objectStore('kv')); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); }));
  return { get: k => op('readonly', s => s.get(k)), set: (k, v) => op('readwrite', s => s.put(v, k)), del: k => op('readwrite', s => s.delete(k)), claves: () => op('readonly', s => s.getAllKeys()) };
})();

/* ---------- estado ---------- */
const E = { perfil: null, prendas: [], conjuntos: [], pantalla: 'inicio', filtro: 'Todo', busca: '', hoyIdx: 0, propuestas: [], tiempo: null, editando: null, preseleccion: [], plan: 'Todos', subida: [], generados: [] };
const PLANES = ['Todos', 'Diario', 'Oficina', 'Noche', 'Deporte'];
const urls = new Map();           // id → URL de la foto (objeto)
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const hoyISO = () => new Date().toISOString().slice(0, 10);
const TIPOS = ['Arriba', 'Abajo', 'Vestidos', 'Abrigo', 'Calzado', 'Bolsos', 'Accesorios'];
const ESTACIONES = ['Todo el año', 'Verano', 'Entretiempo', 'Invierno'];
const OCASIONES = ['Diario', 'Oficina', 'Noche', 'Deporte', 'Evento', 'Viaje'];
const COLORES = [['Negro', '#1B1B1B'], ['Blanco', '#F4F4F4'], ['Gris', '#8E8E8E'], ['Beige', '#D8C7A8'], ['Camel', '#B98A4F'], ['Marrón', '#6B4A2B'], ['Rojo', '#B4332E'], ['Rosa', '#E6B4BC'], ['Naranja', '#D97B3A'], ['Amarillo', '#E1C04A'], ['Verde', '#4E7A4A'], ['Azul claro', '#8FB2CC'], ['Azul', '#2F4E7A'], ['Morado', '#6E4C86'], ['Estampado', 'repeating-linear-gradient(45deg,#C9A24B 0 6px,#fff 6px 12px)']];

/* ---------- idioma ---------- */
const T = {
  lema: ['Optimiza tu estilo', 'Make the most of your style'], crear: ['Crear mi clóset', 'Create my closet'], ya_tengo: ['Ya tengo cuenta', 'I already have one'],
  legal: ['Pruébala gratis 7 días', 'Try it free for 7 days'],
  p_cuenta: ['Cuenta', 'Account'], p_silueta: ['Silueta', 'Figure'], p_prendas: ['Prendas', 'Garments'],
  alta_titulo: ['Lo justo para empezar', 'Just enough to start'], alta_sub: ['Todo se guarda en tu móvil. Nada sale de aquí sin que tú lo pidas.', 'Everything stays on your phone. Nothing leaves unless you ask.'],
  nombre: ['Tu nombre', 'Your name'], ciudad: ['Ciudad para el tiempo', 'City for the weather'], usar_ubicacion: ['Usar mi ubicación', 'Use my location'],
  r1: ['Tus fotos se quedan en este móvil; la app no las sube a ningún sitio en esta versión.', 'Your photos stay on this phone; this version uploads nothing.'],
  r2: ['La prueba dura 7 días con 10 prendas; después, desde 2,99 € al mes.', 'The trial lasts 7 days with 10 garments; then from €2.99 a month.'],
  r3: ['Lo que decide la app (tipo, color, conjuntos) siempre lo puedes corregir.', 'Whatever the app decides (type, colour, outfits) you can always correct.'],
  seguir: ['Seguir', 'Continue'], saltar: ['Saltar', 'Skip'], sil_titulo: ['Dos fotos y ya', 'Two photos and done'], sil_sub: ['Con ellas te verás con tu ropa puesta.', 'With them you will see yourself wearing your clothes.'],
  selfie: ['Selfie', 'Selfie'], selfie_et: ['luz natural, sin filtros', 'natural light, no filters'], cuerpo: ['Cuerpo entero', 'Full body'], cuerpo_et: ['de pie, ropa ajustada', 'standing, fitted clothes'],
  s1: ['Luz natural, sin filtros ni gafas de sol.', 'Natural light, no filters or sunglasses.'], s2: ['De frente y con el cuerpo entero dentro.', 'Facing the camera, whole body in frame.'], s3: ['Puedes cambiarlas cuando quieras desde «Yo».', 'You can change them any time from “Me”.'],
  privado: ['Las fotos se quedan en tu móvil. Solo tu silueta, sin tu cara, se usará para probarte la ropa.', 'Photos stay on your phone. Only your figure, without your face, will be used to try clothes on.'],
  buscar: ['Buscar en mi clóset', 'Search my closet'], nueva: ['Nueva prenda', 'New garment'], editar_prenda: ['Editar prenda', 'Edit garment'], borrar: ['Borrar', 'Delete'],
  hacer_foto: ['Haz una foto o elige una de la galería', 'Take a photo or pick one from the gallery'], foto_et: ['sobre fondo liso, la prenda entera', 'plain background, whole garment'],
  nombre_prenda: ['Nombre', 'Name'], tipo: ['Tipo', 'Type'], estacion: ['Estación', 'Season'], color: ['Color', 'Colour'], notas: ['Notas (talla, tienda, cuidado…)', 'Notes (size, shop, care…)'],
  guardar_closet: ['Guardar en mi clóset', 'Save to my closet'], guardar_otra: ['Guardar y añadir otra', 'Save and add another'], guardar_cambios: ['Guardar cambios', 'Save changes'],
  editar: ['Editar', 'Edit'], veces: ['veces puesta', 'times worn'], ultima: ['última vez', 'last worn'], conjuntos_min: ['conjuntos', 'outfits'], hoy_llevo: ['Hoy llevo esto', 'Wearing this today'],
  asi: ['Así te queda', 'How it looks on you'], ver_conjuntos: ['Ver conjuntos', 'See outfits'], conjuntos: ['Conjuntos', 'Outfits'], nuevo_conjunto: ['Nuevo conjunto', 'New outfit'],
  nombre_conjunto: ['Nombre', 'Name'], ocasion: ['Ocasión', 'Occasion'], elige_prendas: ['Elige las prendas', 'Pick the garments'], guardar_conjunto: ['Guardar conjunto', 'Save outfit'], me_lo_pongo: ['Me lo pongo', 'I’ll wear it'],
  yo: ['Yo', 'Me'], t_hoy: ['Hoy', 'Today'], t_closet: ['Clóset', 'Closet'], t_anadir: ['Subir', 'Upload'], subir_titulo: ['Subir prendas', 'Upload garments'], subir_h1: ['Tu ropa, como en un catálogo', 'Your clothes, like a catalogue'], subir_sub: ['Hasta 20 fotos: una prenda por foto, sobre un fondo liso. La app pone el fondo en blanco y te propone tipo y color.', 'Up to 20 photos: one garment per photo, on a plain background. The app whitens the background and suggests type and colour.'], t_conjuntos: ['Looks', 'Looks'], t_yo: ['Yo', 'Me'],
};
const idioma = () => (E.perfil?.idioma) || localStorage.getItem('tc_idioma') || 'es';
const t = (es, en) => idioma() === 'en' ? en : es;
function traducir() {
  const l = idioma(); document.documentElement.lang = l;
  document.querySelectorAll('[data-t]').forEach(el => { const v = T[el.dataset.t]; if (v) el.innerHTML = l === 'en' ? v[1] : v[0]; });
  document.querySelectorAll('[data-ph]').forEach(el => { const v = T[el.dataset.ph]; if (v) el.placeholder = l === 'en' ? v[1] : v[0]; });
  document.querySelectorAll('[data-idioma]').forEach(b => b.classList.toggle('activo', b.dataset.idioma === l));
}
const tipoNombre = tp => ({ Arriba: ['Arriba', 'Tops'], Abajo: ['Abajo', 'Bottoms'], Vestidos: ['Vestidos', 'Dresses'], Abrigo: ['Abrigo', 'Outerwear'], Calzado: ['Calzado', 'Shoes'], Bolsos: ['Bolsos', 'Bags'], Accesorios: ['Accesorios', 'Accessories'], Todo: ['Todo', 'All'] }[tp] || [tp, tp])[idioma() === 'en' ? 1 : 0];
const estNombre = e => ({ 'Todo el año': ['Todo el año', 'All year'], Verano: ['Verano', 'Summer'], Entretiempo: ['Entretiempo', 'In-between'], Invierno: ['Invierno', 'Winter'] }[e] || [e, e])[idioma() === 'en' ? 1 : 0];
const ocNombre = o => ({ Diario: ['Diario', 'Everyday'], Oficina: ['Oficina', 'Office'], Noche: ['Noche', 'Night'], Deporte: ['Deporte', 'Sport'], Evento: ['Evento', 'Event'], Viaje: ['Viaje', 'Travel'] }[o] || [o, o])[idioma() === 'en' ? 1 : 0];
const veces = n => `${n} ${n === 1 ? t('vez', 'time') : t('veces', 'times')}`;
const fecha = (iso, corta) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString(idioma() === 'en' ? 'en-GB' : 'es-ES', corta ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long' }); };

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
let toastT; function toast(m) { const e = $('toast'); e.textContent = m; e.classList.add('visible'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('visible'), 2200); }
function confirmar(titulo, texto, si, no) { return new Promise(res => { $('dlg-t').textContent = titulo; $('dlg-p').textContent = texto; $('dlg-si').textContent = si || t('Sí', 'Yes'); $('dlg-no').textContent = no || t('Cancelar', 'Cancel'); const d = $('dlg'); d.showModal(); $('dlg-si').onclick = () => { d.close(); res(true); }; $('dlg-no').onclick = () => { d.close(); res(false); }; }); }
function urlFoto(p) { if (!p) return ''; if (p.src) return p.src; if (!p.foto) return ''; if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.foto)); return urls.get(p.id); }
const P = id => E.prendas.find(p => p.id === id);
const activas = () => E.prendas.filter(p => !['guardada', 'donar'].includes(p.estado));
async function guardar() { await BD.set('perfil', E.perfil); await BD.set('prendas', E.prendas); await BD.set('conjuntos', E.conjuntos); }

// reduce la foto a 1200 px de lado mayor y la devuelve como Blob JPEG; también el color dominante
function procesarFoto(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const esc = Math.min(1, 1200 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      // color dominante: muestrea el centro y descarta casi blancos (fondo)
      const d = x.getImageData(c.width * .25, c.height * .25, c.width * .5, c.height * .5).data; let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) { const R = d[i], G = d[i + 1], B = d[i + 2]; if (R > 235 && G > 235 && B > 235) continue; r += R; g += G; b += B; n++; }
      const color = n ? colorCercano(r / n, g / n, b / n) : 'Blanco';
      c.toBlob(bl => { URL.revokeObjectURL(u); res({ blob: bl, color }); }, 'image/jpeg', .86);
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('foto')); };
    img.src = u;
  });
}
function colorCercano(r, g, b) { // nombre del color por tono, saturación y luz (aguanta la luz de interior, que agrisa los claros)
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
  const sat = dd === 0 ? 0 : dd / (1 - Math.abs(2 * l - 1)); let h = 0;
  if (dd) h = (mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4) * 60; if (h < 0) h += 360;
  if (l < .28 && sat < .4) return 'Negro';
  if (sat < .13 || (l > .86 && sat < .3)) return l < .45 ? 'Gris' : 'Blanco';
  if (h < 15 || h >= 335) return l > .62 ? 'Rosa' : l < .3 ? 'Marrón' : 'Rojo';
  if (h < 42) return sat > .55 && l > .35 && l < .7 ? 'Naranja' : l < .32 ? 'Marrón' : l > .6 ? 'Beige' : 'Camel';
  if (h < 68) return sat > .45 && l < .8 ? 'Amarillo' : 'Beige';
  if (h < 170) return 'Verde';
  if (h < 255) return l > .55 || sat < .35 ? 'Azul claro' : 'Azul';
  return l < .6 ? 'Morado' : 'Rosa';
}

/* ---------- estilo de la app, plan de demostración, color del conjunto y maniquí ---------- */
let PLAN_URL = null;
// ejes del diseño (pantalla «Diseño»): letra de dentro, color, forma del tiempo y simetría
const DIS = {
  letra: { vals: ['inter', 'atkinson', 'jost', 'source', 'playfair'], def: 'inter', nom: { inter: 'Inter', atkinson: 'Atkinson', jost: 'Jost', source: 'Source Serif', playfair: 'Playfair' } },
  tema: { vals: ['categorias', 'nogal', 'verde', 'color'], def: 'categorias', nom: { categorias: 'Por tipo de prenda', nogal: 'Nogal', verde: 'Nogal y verde', color: 'Color de tu ropa' } },
  tiempo: { vals: ['medallon', 'franja', 'linea', 'emoji'], def: 'medallon', nom: { medallon: 'Arriba, junto a la fecha', franja: 'Franja de color', linea: 'Frase', emoji: 'Con emoji' } },
  sim: { vals: ['1', '0'], def: '1', nom: { '1': 'Simétrica', '0': 'Libre' } }
};
const PROTOS = { P1: { letra: 'inter', tema: 'categorias', tiempo: 'medallon', sim: '1' }, P2: { letra: 'atkinson', tema: 'verde', tiempo: 'franja', sim: '1' }, P3: { letra: 'jost', tema: 'color', tiempo: 'medallon', sim: '1' }, P4: { letra: 'source', tema: 'categorias', tiempo: 'franja', sim: '1' }, P5: { letra: 'inter', tema: 'nogal', tiempo: 'emoji', sim: '1' }, P6: { letra: 'atkinson', tema: 'categorias', tiempo: 'linea', sim: '0' } };
const DIS_URL = {};
const dis = k => DIS_URL[k] || localStorage.getItem('tc_' + k) || DIS[k].def;
const TEMAS = DIS.tema.vals;
const tema = () => dis('tema');
const planDemo = () => PLAN_URL || localStorage.getItem('tc_plan') || 'pro';
const temaNombre = x => DIS.tema.nom[x];
function aplicarDiseno() { const r = document.documentElement; for (const k of Object.keys(DIS)) r.dataset[k] = dis(k); }
const aplicarTema = aplicarDiseno;
const CAT = { Arriba: 'arriba', Abajo: 'abajo', Vestidos: 'vestidos', Abrigo: 'abrigo', Calzado: 'calzado', Bolsos: 'bolsos' };
const catVar = tp => `var(--c-${CAT[tp] || 'otro'})`;
const EMO_T = { sol: '☀️', solnube: '⛅', nube: '☁️', lluvia: '🌧️', nieve: '❄️', tormenta: '⛈️', niebla: '🌫️' };
function colorTemp(tmp) { return tmp <= 8 ? ['#3E5F80', '#E8EFF6'] : tmp <= 15 ? ['#4E6B5A', '#ECF2EC'] : tmp <= 22 ? ['#8C6A1F', '#F8EFDC'] : ['#A4502E', '#F8E5DA']; }
function avisoCorto(w) { if (['lluvia', 'tormenta'].includes(w.clave)) return { txt: t('lloviendo', 'raining'), lluvia: true }; if (w.lluviaH != null) return { txt: t(`lluvia ${w.lluviaH}:00`, `rain ${w.lluviaH}:00`), lluvia: true }; if (w.lluvia >= 30) return { txt: t('quizá llueva', 'may rain'), lluvia: true }; return { txt: t('sin lluvia', 'no rain'), lluvia: false }; }
const HEX = Object.fromEntries(COLORES.filter(([, c]) => c.startsWith('#')));
function hsl(hex) { const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let H = 0, S = 0; const L = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; S = L > .5 ? d / (2 - mx - mn) : d / (mx + mn); H = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; } return [Math.round(H), Math.round(S * 100), Math.round(L * 100)]; }
function aplicarTono(ps) { // estilo «color»: el tono de la prenda principal, muy claro detrás y oscuro en los botones (siempre con contraste ≥ 7:1 con el blanco)
  const raiz = document.documentElement; if (raiz.dataset.tema !== 'color') return;
  const principal = ['Vestidos', 'Arriba', 'Abrigo', 'Abajo'].map(tp => ps.find(p => p.tipo === tp)).find(Boolean) || ps[0];
  let [h, sat] = principal && HEX[principal.color] ? hsl(HEX[principal.color]) : [25, 32];
  if (sat < 14) { h = 25; sat = 32; }
  raiz.style.setProperty('--tono-suave', `hsl(${h} ${Math.min(sat, 45)}% 94%)`);
  raiz.style.setProperty('--tono-osc', `hsl(${h} ${Math.min(sat, 55)}% 27%)`);
}
// maniquí de sastre (plan Básico): el conjunto compuesto en el móvil, sin coste por conjunto
const BUSTO = '<svg class="busto" viewBox="0 0 100 200" aria-hidden="true"><circle cx="50" cy="8" r="3.5"/><path d="M46 11.5h8v9h-8z"/><path d="M46 20.5C34 22 23 24.5 19.5 30C16.5 35 19 46 23 56C26.5 65 27.5 72 26 80C24.5 88 21.5 94 21.5 100C21.5 104 30 106 50 106C70 106 78.5 104 78.5 100C78.5 94 75.5 88 74 80C72.5 72 73.5 65 77 56C81 46 83.5 35 80.5 30C77 24.5 66 22 54 20.5"/><path d="M43 110h14M50 106v70M50 176l-15 16M50 176l15 16M50 176v17"/></svg>';
// 0.8: sin maniquí (Gabriela 20/10: «está bastante feo»). El conjunto se compone con las prendas sueltas, a su tamaño
// aproximado en cm y simétrico: A · Eje (arriba / pieza grande / bolso y calzado); con bolso y calzado, B · Cruz.
const MEDIDA = { Arriba: [60, 58], Abrigo: [72, 88], Abajo: [58, 100], Vestidos: [72, 100], Calzado: [30, 28], Bolsos: [30, 32], Accesorios: [22, 22] };
function composicion(ps) {
  const G = 7, m = p => MEDIDA[p.tipo] || [40, 40], rol = r => ps.filter(p => r.includes(p.tipo));
  const arriba = rol(['Arriba', 'Abrigo']).slice(0, 3), grande = rol(['Abajo', 'Vestidos'])[0], bolso = rol(['Bolsos'])[0], calzado = rol(['Calzado'])[0];
  const ancho = f => f.reduce((t, p) => t + m(p)[0], 0) + G * (f.length - 1), out = [];
  const fila = (f, y, W) => { const h = Math.max(...f.map(p => m(p)[1])); let x = (W - ancho(f)) / 2; f.forEach(p => { out.push([p, x, y + (h - m(p)[1]) / 2]); x += m(p)[0] + G; }); return h; };
  let W, y = 0;
  if (grande && bolso && calzado) { // Cruz
    const col = Math.max(m(bolso)[0], m(calzado)[0]), cw = m(grande)[0];
    W = Math.max(2 * (col + G) + cw, arriba.length ? ancho(arriba) : 0);
    if (arriba.length) y = fila(arriba, 0, W) + G;
    out.push([grande, (W - cw) / 2, y]); const yb = y + m(grande)[1] * .62;
    out.push([bolso, (W - cw) / 2 - G - col + (col - m(bolso)[0]) / 2, yb - m(bolso)[1] / 2]);
    out.push([calzado, (W + cw) / 2 + G + (col - m(calzado)[0]) / 2, yb - m(calzado)[1] / 2]);
    y += m(grande)[1];
  } else { // Eje
    const filas = [arriba, grande ? [grande] : [], [bolso, calzado].filter(Boolean)].filter(f => f.length);
    if (!filas.length) return '';
    W = Math.max(...filas.map(ancho)); filas.forEach(f => { y += fila(f, y, W) + G; }); y -= G;
  }
  return out.map(([p, x, yy]) => `<img src="${urlFoto(p)}" alt="" style="left:${x / W * 100}%;top:${yy / y * 100}%;width:${m(p)[0] / W * 100}%;height:${m(p)[1] / y * 100}%">`).join('') + `<!--${W}x${y}-->`;
}
function maniqui(ps, mini) { // nombre heredado: ahora devuelve la composición simétrica
  const html = composicion(ps); const r = html.match(/<!--([\d.]+)x([\d.]+)-->/);
  return `<div class="lienzo${mini ? ' mini' : ''}" style="aspect-ratio:${r ? r[1] + '/' + r[2] : '1/1'}">${html}</div>`;
}
const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
/* ---------- tiempo (Open-Meteo) ---------- */
async function cargarTiempo(forzar) {
  const cache = JSON.parse(localStorage.getItem('tc_tiempo') || 'null');
  if (!forzar && cache && cache.v && 'lluviaH' in cache.v && Date.now() - cache.ts < 30 * 60000) { E.tiempo = cache.v; return E.tiempo; }
  try {
    let lat = E.perfil?.lat, lon = E.perfil?.lon, nombre = E.perfil?.ciudad || 'Madrid';
    if (!lat && E.perfil?.ciudad) { const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(E.perfil.ciudad)}&count=1&language=es`)).json(); if (g.results?.length) { lat = g.results[0].latitude; lon = g.results[0].longitude; nombre = g.results[0].name; } }
    if (!lat) { lat = 40.4168; lon = -3.7038; nombre = E.perfil?.ciudad || 'Madrid'; }
    const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=precipitation_probability&timezone=auto&forecast_days=1`)).json();
    const cod = r.current.weather_code; const txt = cod === 0 ? ['despejado', 'clear'] : cod <= 2 ? ['nubes y claros', 'partly cloudy'] : cod === 3 ? ['nublado', 'cloudy'] : cod < 50 ? ['niebla', 'fog'] : cod < 70 ? ['lluvia', 'rain'] : cod < 80 ? ['nieve', 'snow'] : cod < 90 ? ['chubascos', 'showers'] : ['tormenta', 'storm'];
    const ahora = new Date().getHours(); const probs = r.hourly?.precipitation_probability || []; let lluviaH = null; for (let h = ahora; h < Math.min(24, probs.length); h++) if (probs[h] >= 50) { lluviaH = h; break; }
    E.tiempo = { t: Math.round(r.current.temperature_2m), max: Math.round(r.daily.temperature_2m_max[0]), min: Math.round(r.daily.temperature_2m_min[0]), lluvia: r.daily.precipitation_probability_max?.[0] ?? 0, txt, nombre, cod, clave: claveTiempo(cod), lluviaH };
    localStorage.setItem('tc_tiempo', JSON.stringify({ ts: Date.now(), v: E.tiempo }));
  } catch (e) { E.tiempo = null; }
  return E.tiempo;
}
// icono y aviso de lluvia: códigos WMO de Open-Meteo
const ICO_T = {
  sol: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/></svg>',
  solnube: '<svg viewBox="0 0 24 24"><circle cx="8.5" cy="9" r="3.2"/><path d="M8.5 2.6v1.6M2.1 9h1.6M3.9 4.4l1.1 1.1M3.9 13.6l1.1-1.1"/><path d="M10 19.5h8.2a3.2 3.2 0 0 0 .4-6.4 4.6 4.6 0 0 0-8.8-1.2A3.8 3.8 0 0 0 10 19.5Z"/></svg>',
  nube: '<svg viewBox="0 0 24 24"><path d="M7.5 18.5h9.7a3.6 3.6 0 0 0 .5-7.2 5.2 5.2 0 0 0-10-1.4 4.3 4.3 0 0 0-.2 8.6Z"/></svg>',
  lluvia: '<svg viewBox="0 0 24 24"><path d="M7.5 15.5h9.7a3.6 3.6 0 0 0 .5-7.2 5.2 5.2 0 0 0-10-1.4 4.3 4.3 0 0 0-.2 8.6Z"/><path d="M9 18.2l-1 2.6M13 18.2l-1 2.6M17 18.2l-1 2.6"/></svg>',
  nieve: '<svg viewBox="0 0 24 24"><path d="M7.5 15h9.7a3.6 3.6 0 0 0 .5-7.2 5.2 5.2 0 0 0-10-1.4A4.3 4.3 0 0 0 7.5 15Z"/><path d="M9 18.5v.01M12.5 20.5v.01M16 18.5v.01" stroke-width="2"/></svg>',
  tormenta: '<svg viewBox="0 0 24 24"><path d="M7.5 14.5h9.7a3.6 3.6 0 0 0 .5-7.2 5.2 5.2 0 0 0-10-1.4 4.3 4.3 0 0 0-.2 8.6Z"/><path d="m12.5 15-2 3.5h3l-2 3.5"/></svg>',
  niebla: '<svg viewBox="0 0 24 24"><path d="M4 10h16M6 13.5h12M4 17h16"/></svg>'
};
function claveTiempo(cod) { return cod === 0 ? 'sol' : cod <= 2 ? 'solnube' : cod === 3 ? 'nube' : cod < 50 ? 'niebla' : cod < 70 ? 'lluvia' : cod < 80 ? 'nieve' : cod < 90 ? 'lluvia' : 'tormenta'; }
function fraseTiempo(w) { // una sola frase: grados, cielo y qué hacer con la lluvia
  const l = idioma() === 'en' ? 1 : 0; const ico = ICO_T[w.clave].replace('<svg', `<svg class="ico-${w.clave}"`);
  let aviso, lluvia = true;
  if (['lluvia', 'tormenta'].includes(w.clave)) aviso = t('Está lloviendo: lleva paraguas.', 'It is raining: take an umbrella.');
  else if (w.lluviaH != null) aviso = t(`Lluvia desde las ${w.lluviaH}:00: lleva paraguas.`, `Rain from ${w.lluviaH}:00: take an umbrella.`);
  else if (w.lluvia >= 30) aviso = t('Quizá llueva: un paraguas pequeño.', 'It might rain: a small umbrella.');
  else if (w.clave === 'nieve') aviso = t('Nieva: abrígate.', 'Snow: wrap up.');
  else { aviso = t('Sin lluvia.', 'No rain.'); lluvia = false; }
  return { lluvia, html: `${ico}<span><b>${w.t}°</b>, ${w.txt[l]} (${w.min}–${w.max}°). <em>${aviso}</em></span>` };
}
const estacionDelDia = () => { const m = new Date().getMonth() + 1; return m >= 6 && m <= 8 ? 'Verano' : (m === 12 || m <= 2) ? 'Invierno' : 'Entretiempo'; };
const estacionesAptas = () => { const tmp = E.tiempo?.t; if (tmp == null) return ['Todo el año', estacionDelDia()]; return tmp >= 24 ? ['Verano', 'Todo el año'] : tmp <= 12 ? ['Invierno', 'Todo el año', 'Entretiempo'] : ['Entretiempo', 'Todo el año', 'Verano']; };

/* ---------- generador de conjuntos (Sheila, 19/10: «la función estrella») ---------- */
const NEUTROS = new Set(['Negro', 'Blanco', 'Gris', 'Beige', 'Camel', 'Marrón', 'Azul claro', 'Azul']);
const esFormal = p => /tac[oó]n|vestido|americana|blazer|camisa/i.test(p.nombre) || (p.tipo === 'Vestidos');
function ocasionDe(ps) { return ps.some(p => /tac[oó]n/i.test(p.nombre) || (p.tipo === 'Vestidos' && p.color === 'Negro')) ? 'Noche' : ps.some(p => /zapatilla|deport/i.test(p.nombre)) ? 'Diario' : 'Diario'; }
function puntuar(ps) {
  const fuertes = ps.filter(p => !NEUTROS.has(p.color)); let s = 0;
  if (fuertes.length === 0) s += 1; else if (fuertes.length === 1) s += 2.2; else s += new Set(fuertes.map(p => p.color)).size === 1 ? 1 : -2;
  if (ps.filter(p => p.color === 'Estampado').length > 1) s -= 3;
  const ar = ps.find(p => p.tipo === 'Arriba'), ab = ps.find(p => p.tipo === 'Abajo');
  if (ar && ab && ar.color === ab.color && !['Negro', 'Azul claro'].includes(ar.color)) s -= .6;
  const usos = ps.reduce((a, p) => a + (p.usos || []).length, 0) / ps.length; s += Math.max(0, 2 - usos / 4);   // que salga lo que menos te pones
  return s + Math.random() * .7;
}
function generarLooks(n, plan) {
  const aptas = estacionesAptas(); const act = activas().filter(p => aptas.includes(p.estacion));
  const de = tp => act.filter(p => p.tipo === tp);
  const arriba = de('Arriba'), abajo = de('Abajo'), vestidos = de('Vestidos'), calzado = de('Calzado'), abrigos = de('Abrigo'), bolsos = de('Bolsos');
  const frio = (E.tiempo?.t ?? 18) <= 14;
  const bases = [...vestidos.map(v => [v]), ...arriba.flatMap(a => abajo.map(b => [a, b]))];
  const cands = bases.map(base => {
    const formal = base.some(esFormal) || base.some(p => p.tipo === 'Abajo' && p.color === 'Negro');
    const zap = calzado.slice().sort((x, y) => (formal ? (/tac[oó]n/i.test(y.nombre) - /tac[oó]n/i.test(x.nombre)) : (/tac[oó]n/i.test(x.nombre) - /tac[oó]n/i.test(y.nombre))) || ((x.usos || []).length - (y.usos || []).length))[0];
    const ps = [...base, zap, frio ? abrigos[0] : null, formal && bolsos[0] ? bolsos[0] : null].filter(Boolean);
    return { ps, puntos: puntuar(ps) };
  }).sort((a, b) => b.puntos - a.puntos);
  const vistos = new Set(), usados = new Map(), out = [];
  for (const c of cands) {
    const clave = c.ps.map(p => p.id).join(); if (vistos.has(clave)) continue;
    const prin = c.ps[0]; if ((usados.get(prin.id) || 0) >= 2) continue;       // variedad: la misma prenda principal, como mucho dos veces
    const oc = ocasionDe(c.ps); if (plan && plan !== 'Todos' && oc !== plan) continue;
    vistos.add(clave); usados.set(prin.id, (usados.get(prin.id) || 0) + 1);
    out.push({ ids: c.ps.map(p => p.id), ocasion: oc, nombre: `${ocNombre(oc)} ${t('con', 'with')} ${prin.nombre.charAt(0).toLowerCase() + prin.nombre.slice(1)}` });
    if (out.length >= n) break;
  }
  return out;
}

/* ---------- navegación ---------- */
const SIN_TABS = ['inicio', 'alta', 'silueta', 'anadir', 'nuevo-look', 'subir'];
function ir(nombre, datos) {
  if (nombre === 'inicio' && !$('intro')) $('p-inicio').classList.add('aparece');
  if (nombre === 'anadir') prepararAnadir(datos);
  if (nombre === 'subir' && !datos) prepararSubir();
  if (nombre === 'nuevo-look') prepararNuevoLook(datos);
  if (nombre === 'hoy') pintarHoy();
  if (nombre === 'closet') pintarCloset();
  if (nombre === 'looks') pintarLooks();
  if (nombre === 'yo') pintarYo();
  if (nombre === 'diseno') pintarDiseno();
  E.pantalla = nombre;
  document.querySelectorAll('.pantalla').forEach(p => p.classList.toggle('activa', p.id === 'p-' + nombre));
  const tab = { ficha: 'closet', look: 'looks', diseno: 'yo' }[nombre] || nombre;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('activo', b.dataset.ir === tab));
  $('tabs').classList.toggle('oculta', SIN_TABS.includes(nombre));
  const el = $('p-' + nombre); if (el) el.scrollTop = 0;
  if (nombre === 'hoy' && !E.tiempo) cargarTiempo().then(() => E.pantalla === 'hoy' && pintarHoy());
}

/* ---------- HOY ---------- */
function proponer() {
  // 1) conjuntos guardados aptos para el tiempo; 2) si no, combinaciones con las prendas
  const aptas = estacionesAptas(); const act = activas().filter(p => aptas.includes(p.estacion));
  const conj = E.conjuntos.filter(c => c.ids.every(id => act.some(p => p.id === id)) && (E.plan === 'Todos' || (c.ocasion || 'Diario') === E.plan));
  const props = conj.map(c => ({ tipo: 'conjunto', c, ids: c.ids }));
  for (const g of generarLooks(4, E.plan)) if (!props.some(x => x.ids.join() === g.ids.join())) props.push({ tipo: 'propuesta', ids: g.ids, nombre: g.nombre, ocasion: g.ocasion });
  E.propuestas = props; if (E.hoyIdx >= props.length) E.hoyIdx = 0;
}
function pintarHoy() { // 0.8 · cerrada por Gabriela el 20/10: centrada, sin menú arriba, el tiempo una vez junto a la fecha, debajo solo la ocasión
  const pant = $('p-hoy'); const w = E.tiempo; const l = idioma();
  E.plan = 'Todos'; if (!E.propuestas.length) proponer();
  const lista = E.propuestas; const pr = lista[E.hoyIdx];
  const hoyD = new Date(); const dia = cap(hoyD.toLocaleDateString(l === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric' }));
  const ico = k => ICO_T[k] || ICO_T.nube;
  const cieloAhora = w ? (w.clave === 'solnube' ? 'sol' : ['lluvia', 'tormenta'].includes(w.clave) ? 'nube' : w.clave) : null; // el icono del cielo: sol si hay sol, aunque haga frío
  const avisoLluvia = !w ? '' : ['lluvia', 'tormenta'].includes(w.clave) ? ` · ${ico('lluvia')}${t('ahora', 'now')}` : w.lluviaH != null ? ` · ${ico('lluvia')}${w.lluviaH}:00` : '';
  const cab = `<header class="hz-cab"><span class="marca"><svg viewBox="0 0 100 100"><use href="#i129"/></svg><span>Tu<span class="oro">Closet</span></span></span>
    <div class="hz-dia mini-et">${dia}${w ? `${ico(cieloAhora)}${w.t}°${avisoLluvia}` : ''}</div></header>`;
  if (!pr) {
    const hay = activas().length;
    pant.innerHTML = cab + `<div class="hz-vacio">${hay ? t('Me falta una parte de arriba y una de abajo, o un vestido, para este tiempo.', 'I need a top and a bottom, or a dress, for this weather.') : t('Tu conjunto de hoy aparecerá aquí en cuanto tengas tres prendas: una de arriba, una de abajo y unos zapatos.', 'Your outfit of the day will appear here once you have three garments: a top, a bottom and shoes.')}
      <button class="hz-bt" data-ir="subir">${t('Subir mis prendas', 'Upload my garments')}</button>${hay || PUBLICA ? '' : `<button class="hz-bt" id="hoy-ejemplo" style="border:0;margin-top:4px">${t('Ver un ejemplo', 'See an example')}</button>`}</div>`;
    const ej = $('hoy-ejemplo'); if (ej) ej.onclick = cargarEjemplo;
    return;
  }
  const ps = pr.ids.map(P).filter(Boolean); const c = pr.c;
  const avatar = planDemo() === 'pro' ? c?.img : null;
  const figura = avatar ? `<img src="${avatar}" alt="${t('Tú con el conjunto', 'You wearing the outfit')}">` : maniqui(ps);
  const oc = (c && c.ocasion) || pr.ocasion || ocasionDe(ps);
  const flechas = lista.length > 1 ? `<div class="hz-flechas"><button id="hoy-ant" aria-label="${t('Anterior', 'Previous')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><button id="hoy-sig" aria-label="${t('Otro', 'Next')}"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div>` : '';
  pant.innerHTML = cab + `<div class="hz-escena"><div class="hz-fig">${figura}</div>${flechas}<div class="hz-pie"><div class="hz-oc mini-et">${ocNombre(oc)}</div><button class="hz-bt" id="hoy-pongo">${t('Me lo pongo', 'I’ll wear it')}</button></div></div>`;
  if ($('hoy-sig')) $('hoy-sig').onclick = () => { E.hoyIdx = (E.hoyIdx + 1) % lista.length; pintarHoy(); };
  if ($('hoy-ant')) $('hoy-ant').onclick = () => { E.hoyIdx = (E.hoyIdx + lista.length - 1) % lista.length; pintarHoy(); };
  $('hoy-pongo').onclick = async () => { await ponerse(pr.ids, c); };
}
async function ponerse(ids, conj) {
  const d = hoyISO(); let n = 0;
  ids.forEach(id => { const p = P(id); if (!p) return; p.usos = p.usos || []; if (!p.usos.includes(d)) { p.usos.push(d); n++; } });
  if (conj) { conj.usos = conj.usos || []; if (!conj.usos.includes(d)) conj.usos.push(d); }
  else if (ids.length >= 2 && !E.conjuntos.some(c => c.ids.join() === ids.join())) { E.conjuntos.unshift({ id: uid(), nombre: t('Hoy', 'Today') + ' ' + fecha(d, true), ocasion: 'Diario', ids, creada: d, usos: [d] }); }
  await guardar(); toast(n ? t(`Apuntado: ${n} prendas puestas hoy`, `Noted: ${n} garments worn today`) : t('Ya lo tenías apuntado hoy', 'Already noted today'));
}

/* ---------- CLÓSET ---------- */
// 0.8 · categorías de tienda: lo de abajo se separa en pantalones y faldas por el nombre
const catDe = p => p.tipo === 'Abajo' ? (/falda|skirt/i.test(p.nombre) ? 'Faldas' : 'Pantalones') : ({ Arriba: 'Tops', Abrigo: 'Abrigos', Vestidos: 'Vestidos', Calzado: 'Zapatos', Bolsos: 'Bolsos', Accesorios: 'Accesorios' }[p.tipo] || p.tipo);
const CATS_ORDEN = ['Tops', 'Pantalones', 'Faldas', 'Vestidos', 'Abrigos', 'Zapatos', 'Bolsos', 'Accesorios'];
const catTxt = c => idioma() === 'en' ? ({ Todo: 'All', Tops: 'Tops', Pantalones: 'Trousers', Faldas: 'Skirts', Vestidos: 'Dresses', Abrigos: 'Outerwear', Zapatos: 'Shoes', Bolsos: 'Bags', Accesorios: 'Accessories' }[c] || c) : c;
E.f = { ocasion: [], estacion: [], color: [], uso: [], estado: [] };
const FILTROS = () => [
  ['ocasion', t('Ocasión', 'Occasion'), OCASIONES.map(o => [o, ocNombre(o)])],
  ['estacion', t('Estación', 'Season'), ESTACIONES.map(x => [x, x])],
  ['color', 'Color', COLORES.map(([n, c]) => [n, c])],
  ['uso', t('Uso', 'Use'), [['nueva', t('Sin estrenar', 'Never worn')], ['olvidada', t('Sin poner en 3 meses', 'Not worn in 3 months')], ['mas', t('Las que más uso', 'Most worn')]]],
  ['estado', t('Estado', 'Status'), [['', t('Lista para poner', 'Ready to wear')], ['lavar', t('Para lavar', 'To wash')], ['guardada', t('Guardada', 'Stored')]]]
];
function pasaFiltros(p) {
  const f = E.f, hace3 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), u = p.usos || [];
  const ocs = E.conjuntos.filter(c => c.ids.includes(p.id)).map(c => c.ocasion || 'Diario');
  const maxUsos = Math.max(1, ...E.prendas.map(x => (x.usos || []).length));
  return (!f.ocasion.length || f.ocasion.some(o => ocs.includes(o)))
    && (!f.estacion.length || f.estacion.includes(p.estacion) || p.estacion === 'Todo el año')
    && (!f.color.length || f.color.includes(p.color))
    && (!f.uso.length || f.uso.some(k => k === 'nueva' ? !u.length : k === 'olvidada' ? (u.length && u[u.length - 1] < hace3) : u.length >= maxUsos * .6))
    && (!f.estado.length || f.estado.includes(p.estado || ''));
}
function pintarCloset() {
  const todas = E.prendas;
  const cats = ['Todo', ...CATS_ORDEN.filter(c => todas.some(p => catDe(p) === c))];
  if (!cats.includes(E.filtro)) E.filtro = 'Todo';
  $('cats').innerHTML = cats.map(c => `<button class="${c === E.filtro ? 'activo' : ''}" data-filtro="${c}">${catTxt(c)}</button>`).join('');
  const q = E.busca.trim().toLowerCase();
  const lista = todas.filter(p => (E.filtro === 'Todo' || catDe(p) === E.filtro) && pasaFiltros(p) && (!q || [p.nombre, p.color, catDe(p), p.notas].join(' ').toLowerCase().includes(q)));
  const nf = Object.values(E.f).reduce((t, v) => t + v.length, 0); $('mc-nf').textContent = nf || '';
  $('pared').innerHTML = lista.map(p => `<button data-ficha="${p.id}" aria-label="${p.nombre}"><img src="${urlFoto(p)}" alt="">${p.estado ? `<i>${estadoTxt(p.estado)}</i>` : ''}</button>`).join('');
  $('closet-vacio').innerHTML = todas.length ? (lista.length ? '' : `<div class="vacio">${t('Nada con ese filtro.', 'Nothing matches.')}</div>`) : `<div class="vacio">${t('Haz una foto a cada prenda sobre un fondo liso. Con tres ya hay conjunto de hoy.', 'Photograph each garment on a plain background. With three there is already an outfit of the day.')}<button class="hz-bt" data-ir="subir">${t('Subir mis prendas', 'Upload my garments')}</button>${PUBLICA ? '' : `<button class="hz-bt" style="border:0" id="cl-ejemplo">${t('Cargar un clóset de ejemplo', 'Load a sample closet')}</button>`}</div>`;
  const ej = $('cl-ejemplo'); if (ej) ej.onclick = cargarEjemplo;
  if (!$('mc-hoja').hidden) pintarFiltros();
}
function pintarFiltros() {
  $('mc-grupos').innerHTML = FILTROS().map(([k, tit, ops]) => `<div class="mc-gr"><p class="mini-et">${tit}</p><div class="mc-ops">${ops.map(([v, txt]) => k === 'color'
    ? `<button class="sw ${E.f.color.includes(v) ? 'on' : ''}" data-fil="${k}|${v}" title="${v}" style="background:${txt}"></button>`
    : `<button class="${E.f[k].includes(v) ? 'on' : ''}" data-fil="${k}|${v}">${txt}</button>`).join('')}</div>${k === 'ocasion' ? `<small>${t('según los conjuntos en los que está cada prenda', 'from the outfits each garment is in')}</small>` : ''}</div>`).join('');
  const n = E.prendas.filter(p => (E.filtro === 'Todo' || catDe(p) === E.filtro) && pasaFiltros(p)).length;
  $('mc-ver').textContent = t(`Ver ${n} prendas`, `See ${n} garments`);
}
function hojaFiltros(abrir) { $('mc-hoja').hidden = !abrir; $('mc-velo').hidden = !abrir; if (abrir) pintarFiltros(); }
const estadoTxt = e => ({ lavar: t('A lavar', 'To wash'), guardada: t('Guardada', 'Stored'), donar: t('Para donar', 'To donate') }[e] || '');

/* ---------- SUBIR: varias prendas de golpe (patrón de Vinted) ---------- */
function fondoABlanco(x, w, h) { // relleno desde los bordes: lo que es fondo liso pasa a blanco; devuelve la caja de la prenda y su color
  const im = x.getImageData(0, 0, w, h), d = im.data, N = w * h;
  const borde = []; for (let i = 0; i < w; i++) borde.push(i, (h - 1) * w + i); for (let j = 1; j < h - 1; j++) borde.push(j * w, j * w + w - 1);
  let r = 0, g = 0, b = 0; for (const p of borde) { r += d[p * 4]; g += d[p * 4 + 1]; b += d[p * 4 + 2]; } r /= borde.length; g /= borde.length; b /= borde.length;
  const fondo = new Uint8Array(N), cola = new Int32Array(N); let ini = 0, fin = 0;
  const lejos = (q) => Math.abs(d[q * 4] - r) + Math.abs(d[q * 4 + 1] - g) + Math.abs(d[q * 4 + 2] - b);
  for (const p of borde) if (!fondo[p] && lejos(p) < 95) { fondo[p] = 1; cola[fin++] = p; }
  while (ini < fin) {
    const p = cola[ini++], px = p % w, k = p * 4;
    for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, p - w, p + w]) {
      if (q < 0 || q >= N || fondo[q]) continue; const kq = q * 4;
      if (Math.abs(d[kq] - d[k]) + Math.abs(d[kq + 1] - d[k + 1]) + Math.abs(d[kq + 2] - d[k + 2]) < 20 && lejos(q) < 130) { fondo[q] = 1; cola[fin++] = q; }
    }
  }
  let x0 = w, y0 = h, x1 = 0, y1 = 0, R = 0, G = 0, B = 0, m = 0;
  for (let p = 0; p < N; p++) {
    const k = p * 4; if (fondo[p]) { d[k] = d[k + 1] = d[k + 2] = 255; continue; }
    const px = p % w, py = (p / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    if ((p & 7) === 0) { R += d[k]; G += d[k + 1]; B += d[k + 2]; m++; }
  }
  for (let p = w; p < N - w; p++) { if (fondo[p]) continue; if (fondo[p - 1] || fondo[p + 1] || fondo[p - w] || fondo[p + w]) { const k = p * 4; d[k] = (d[k] + 255) >> 1; d[k + 1] = (d[k + 1] + 255) >> 1; d[k + 2] = (d[k + 2] + 255) >> 1; } }
  const ok = m > 60 && (x1 - x0) > w * .1 && (y1 - y0) > h * .1 && fin > N * .05;
  if (ok) x.putImageData(im, 0, 0);
  return { ok, caja: ok ? [x0, y0, x1, y1] : [0, 0, w - 1, h - 1], color: m ? colorCercano(R / m, G / m, B / m) : 'Blanco' };
}
// recorte con U²-Net pequeño (Apache 2.0) en el propio navegador; si no carga, el relleno desde los bordes
let SES = null;
const cargarScript = src => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el); });
async function modeloRecorte() {
  if (SES) return SES;
  const base = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  if (!window.ort) await cargarScript(base + 'ort.min.js');
  ort.env.wasm.wasmPaths = base; ort.env.wasm.numThreads = 1;
  SES = await ort.InferenceSession.create('modelos/u2netp.onnx', { executionProviders: ['wasm'] });
  return SES;
}
async function mascaraU2(img) { // máscara 320×320 en el canal alfa de un lienzo
  const ses = await modeloRecorte(); const S = 320;
  const c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, S, S); const d = x.getImageData(0, 0, S, S).data;
  let mx = 1; for (let i = 0; i < d.length; i += 4) mx = Math.max(mx, d[i], d[i + 1], d[i + 2]);
  const media = [.485, .456, .406], desv = [.229, .224, .225], ent = new Float32Array(3 * S * S);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) for (let ch = 0; ch < 3; ch++) ent[ch * S * S + p] = (d[i + ch] / mx - media[ch]) / desv[ch];
  const sal = await ses.run({ [ses.inputNames[0]]: new ort.Tensor('float32', ent, [1, 3, S, S]) });
  const m = sal[ses.outputNames[0]].data; let lo = Infinity, hi = -Infinity; for (let i = 0; i < m.length; i++) { if (m[i] < lo) lo = m[i]; if (m[i] > hi) hi = m[i]; }
  const mc = document.createElement('canvas'); mc.width = S; mc.height = S; const mxc = mc.getContext('2d'); const md = mxc.createImageData(S, S);
  for (let p = 0; p < S * S; p++) { const a = (m[p] - lo) / ((hi - lo) || 1); md.data[p * 4 + 3] = Math.round(Math.max(0, Math.min(1, (a - .2) / .6)) * 255); }
  mxc.putImageData(md, 0, 0); return mc;
}
async function procesarPrenda(file) {
  const u = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
    const esc = Math.min(1, 1000 / Math.max(img.width, img.height)), w = Math.round(img.width * esc), h = Math.round(img.height * esc);
    const orig = document.createElement('canvas'); orig.width = w; orig.height = h; const ox = orig.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, w, h); ox.drawImage(img, 0, 0, w, h);
    const capa = document.createElement('canvas'); capa.width = w; capa.height = h; const cx = capa.getContext('2d', { willReadFrequently: true });
    let caja = null, color = 'Gris', recortada = false;
    try {
      const masc = await mascaraU2(img);
      cx.drawImage(img, 0, 0, w, h); cx.globalCompositeOperation = 'destination-in'; cx.drawImage(masc, 0, 0, w, h); cx.globalCompositeOperation = 'source-over';
      const d = cx.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0, R = 0, G = 0, B = 0, n = 0, opacos = 0;
      for (let p = 0, k = 0; p < w * h; p++, k += 4) { const a = d[k + 3]; if (a < 128) continue; opacos++; const px = p % w, py = (p / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; if (a > 220 && (p & 3) === 0) { R += d[k]; G += d[k + 1]; B += d[k + 2]; n++; } }
      if (opacos > w * h * .03) {
        caja = [x0, y0, x1, y1]; recortada = true;
        // color: el más repetido en el cuerpo de la prenda, sin el 22 % de arriba (percha, lámpara)
        const cuenta = {}; const corte = y0 + (y1 - y0) * .22;
        for (let p = 0, k = 0; p < w * h; p += 3, k += 12) { if (d[k + 3] < 220 || ((p / w) | 0) < corte) continue; const nom = colorCercano(d[k], d[k + 1], d[k + 2]); cuenta[nom] = (cuenta[nom] || 0) + 1; }
        const orden = Object.entries(cuenta).sort((a, b) => b[1] - a[1]); if (orden.length) color = orden[0][0];
      }
    } catch (e) { /* sin modelo: relleno desde los bordes */ }
    if (!recortada) { cx.globalCompositeOperation = 'source-over'; cx.clearRect(0, 0, w, h); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h); const f = fondoABlanco(cx, w, h); caja = f.caja; color = f.color; recortada = f.ok; }
    const [x0, y0, x1, y1] = caja; const bw = x1 - x0 + 1, bh = y1 - y0 + 1; const prop = bh / bw;
    const tipo = prop < .75 ? 'Calzado' : prop < 1.55 ? 'Arriba' : 'Abajo';
    const W = 900, H = 1200, out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d');
    o.fillStyle = '#fff'; o.fillRect(0, 0, W, H); const e = Math.min(W * .84 / bw, H * .84 / bh), dw = bw * e, dh = bh * e;
    o.drawImage(capa, x0, y0, bw, bh, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const aBlob = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    return { blob: await aBlob(out, .88), original: await aBlob(orig, .86), color, tipo, recortada };
  } finally { URL.revokeObjectURL(u); }
}
// nombre automático legible: «Top negro», «Pantalón azul claro», «Zapatos blancos»
const NOMBRE_TIPO = { Arriba: ['Top', 'Top'], Abajo: ['Pantalón', 'Trousers'], Vestidos: ['Vestido', 'Dress'], Abrigo: ['Abrigo', 'Coat'], Calzado: ['Zapatos', 'Shoes'], Bolsos: ['Bolso', 'Bag'], Accesorios: ['Accesorio', 'Accessory'] };
const PLURAL_COLOR = { Negro: 'negros', Blanco: 'blancos', Gris: 'grises', Marrón: 'marrones', Rojo: 'rojos', Amarillo: 'amarillos', Verde: 'verdes', Azul: 'azules', Morado: 'morados', Estampado: 'estampados' };
function nombreAuto(tipo, color) {
  const en = idioma() === 'en'; const n = (NOMBRE_TIPO[tipo] || [tipo, tipo])[en ? 1 : 0];
  if (en) return `${color} ${n.toLowerCase()}`.replace(/^./, c => c.toUpperCase());
  const c = tipo === 'Calzado' ? (PLURAL_COLOR[color] || color.toLowerCase()) : color.toLowerCase();
  return `${n} ${c}`;
}
const TIPO_DE_CAT = { Tops: 'Arriba', Pantalones: 'Abajo', Faldas: 'Abajo', Vestidos: 'Vestidos', Abrigos: 'Abrigo', Zapatos: 'Calzado', Bolsos: 'Bolsos', Accesorios: 'Accesorios' };
const nombreSubida = (it, cat) => cat === 'Faldas' ? (idioma() === 'en' ? `${it.color} skirt` : `Falda ${it.color.toLowerCase()}`) : nombreAuto(it.tipo, it.color);
function prepararSubir() { E.subida = []; E.sDet = null; pintarSubida(); }
// Subir (Gabriela, 20/10): una sola prenda → su ficha (3B); varias → rejilla (3A) con lo general a la vista y, al tocar una, su ficha
function pintarSubida() {
  const n = E.subida.length, raiz = $('s-raiz'), X = `<button class="x" data-ir="closet" aria-label="${t('Cerrar', 'Close')}"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></svg></button>`;
  const mas = (txt, cls) => `<label class="${cls}">${txt}<input type="file" accept="image/*" multiple data-sfotos></label>`;
  const det = n === 1 ? E.subida[0] : E.subida.find(i => i.id === E.sDet);
  if (!n) raiz.innerHTML = `<div class="sb">${X}<div class="tit"><h1>${t('Sube tu ropa', 'Upload your clothes')}</h1><div class="mini-et">${t('Una prenda por foto', 'One garment per photo')}</div></div><div class="guia"><svg viewBox="0 0 24 24"><use href="#ic-camara"/></svg><i></i><i></i><i></i><i></i></div><p class="consejo">${t('Extiéndela sobre una superficie lisa, con buena luz.<br>La app quita el fondo y te propone tipo y color.', 'Lay it on a plain surface, in good light.<br>The app removes the background and suggests type and colour.')}</p><div class="bts"><label class="boton">${t('Hacer una foto', 'Take a photo')}<input type="file" accept="image/*" capture="environment" data-sfotos></label>${mas(t('Elegir de la galería', 'Choose from gallery'), 'boton no')}<span class="txt">${t('Hasta 20 a la vez', 'Up to 20 at a time')}</span></div></div>`;
  else if (det) {
    const i = E.subida.indexOf(det), listo = det.estado === 'listo';
    const ops = (lista, sel, k, nom) => `<div class="ops">${lista.map(x => `<button type="button" class="${x === sel ? 'on' : ''}" data-s${k}="${x}">${nom(x)}</button>`).join('')}</div>`;
    raiz.innerHTML = `<div class="sb uno">${n === 1 ? X : `<button class="x" data-svolver aria-label="${t('Volver', 'Back')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>`}<div class="tit"><h1>${t('Revisa tu prenda', 'Check your garment')}</h1>${n > 1 ? `<div class="mini-et">${i + 1} ${t('de', 'of')} ${n}</div>` : ''}</div>
      <div class="foto">${det.url ? `<img src="${det.url}" alt="">` : `<p class="s-procesando">${t('Quitando el fondo…', 'Removing the background…')}</p>`}</div>
      ${listo ? `<input class="nom" value="${det.nombre}" data-snom aria-label="${t('Nombre', 'Name')}">
      <div class="gr"><p class="mini-et">${t('Tipo', 'Type')}</p>${ops(CATS_ORDEN, catDe(det), 'tipo', catTxt)}</div>
      <div class="gr"><p class="mini-et">${t('Color', 'Colour')}</p><div class="ops col">${COLORES.map(([c, h]) => `<button type="button" class="${c === det.color ? 'on' : ''}" data-scolor="${c}" title="${c}" aria-label="${c}" style="background:${h}"></button>`).join('')}</div></div>
      <div class="gr"><p class="mini-et">${t('Estación', 'Season')}</p>${ops(ESTACIONES, det.estacion, 'est', estNombre)}</div>
      ${det.recortada ? `<button class="txt sub-l" data-sorig>${det.usaOriginal ? t('Usar el fondo blanco', 'Use white background') : t('Usar la foto original', 'Use the original photo')}</button>` : ''}` : ''}
      <div class="bts">${n === 1 ? `<button class="boton" data-sguardar ${listo ? '' : 'disabled'}>${t('Guardar en mi clóset', 'Save to my closet')}</button>${mas(t('Añadir más prendas', 'Add more garments'), 'txt sub-l')}` : `<button class="boton" data-svolver>${t('Listo', 'Done')}</button><button class="txt sub-l" data-squita>${t('Quitar esta prenda', 'Remove this garment')}</button>`}</div></div>`;
  } else {
    const listos = E.subida.filter(i => i.estado === 'listo').length;
    raiz.innerHTML = `<div class="sb rv">${X}<div class="tit"><h1>${n} ${t('prendas', 'garments')}</h1><div class="mini-et">${listos < n ? t('Quitando los fondos…', 'Removing backgrounds…') : t('Revisa y guarda', 'Check and save')}</div></div>
      <div class="rej">${E.subida.map(it => `<button type="button" data-sdet="${it.id}">${it.url ? `<img src="${it.url}" alt="">` : ''}${it.estado === 'listo' ? `<em></em><p>${it.nombre}<small>${catTxt(catDe(it))} · ${it.color}</small></p>` : `<p><small>${t('Quitando el fondo…', 'Removing the background…')}</small></p>`}</button>`).join('')}${n < 20 ? mas(`<svg viewBox="0 0 20 20"><path d="M10 3v14M3 10h14"/></svg><small>${t('Añadir más', 'Add more')}</small>`, 'mas') : ''}</div>
      <div class="bts"><button class="boton" data-sguardar ${listos ? '' : 'disabled'}>${t(`Guardar ${listos} prendas`, `Save ${listos} garments`)}</button><span class="txt">${t('Toca una prenda para ver su ficha y cambiar nombre, tipo, color o estación', 'Tap a garment to open its card and change name, type, colour or season')}</span></div></div>`;
  }
  raiz.querySelectorAll('[data-sfotos]').forEach(inp => inp.onchange = e => { anadirFotos([...e.target.files]); e.target.value = ''; });
  raiz.onclick = ev => {
    const b = ev.target.closest('[data-sdet],[data-svolver],[data-squita],[data-sguardar],[data-stipo],[data-scolor],[data-sest],[data-sorig]'); if (!b || b.disabled) return;
    const d = b.dataset, auto = det && det.nombre === nombreAuto(det.tipo, det.color), prev = det?.color;
    if (d.sdet) { E.sDet = d.sdet; pintarSubida(); raiz.scrollTop = 0; }
    else if (d.svolver !== undefined) { E.sDet = null; pintarSubida(); }
    else if (d.squita !== undefined) { E.subida = E.subida.filter(i => i !== det); E.sDet = null; pintarSubida(); }
    else if (d.sguardar !== undefined) guardarSubida();
    else if (d.stipo) { const falda = /falda|skirt/i.test(det.nombre); det.tipo = TIPO_DE_CAT[d.stipo]; if (auto || falda !== (d.stipo === 'Faldas')) det.nombre = nombreSubida(det, d.stipo); pintarSubida(); }
    else if (d.scolor) { const c = catDe(det); det.color = d.scolor; if (auto || (c === 'Faldas' && det.nombre === nombreSubida(Object.assign({}, det, { color: prev }), c))) det.nombre = nombreSubida(det, c); pintarSubida(); }
    else if (d.sest) { det.estacion = d.sest; pintarSubida(); }
    else if (d.sorig !== undefined) { det.usaOriginal = !det.usaOriginal; URL.revokeObjectURL(det.url); det.url = URL.createObjectURL(det.usaOriginal ? det.original : det.blob); pintarSubida(); }
  };
  const nom = raiz.querySelector('[data-snom]'); if (nom) nom.oninput = e => { det.nombre = e.target.value; };
}
async function anadirFotos(files) {
  const nuevos = files.slice(0, Math.max(0, 20 - E.subida.length)).map(f => ({ id: uid(), estado: 'procesando', file: f }));
  if (!nuevos.length) return toast(t('Como mucho 20 fotos cada vez', 'At most 20 photos at a time'));
  E.subida.push(...nuevos); pintarSubida();
  for (const it of nuevos) {
    try { const r = await procesarPrenda(it.file); Object.assign(it, r, { estado: 'listo', estacion: 'Todo el año', url: URL.createObjectURL(r.blob), nombre: nombreAuto(r.tipo, r.color) }); delete it.file; }
    catch (e) { E.subida = E.subida.filter(x => x !== it); toast(t('No he podido leer una de las fotos', 'Could not read one of the photos')); }
    pintarSubida();
  }
}
async function guardarSubida() {
  const listos = E.subida.filter(i => i.estado === 'listo'); if (!listos.length) return;
  listos.forEach(it => E.prendas.unshift({ id: uid(), nombre: it.nombre.trim() || tipoNombre(it.tipo), color: it.color, tipo: it.tipo, estacion: it.estacion || 'Todo el año', notas: '', foto: it.usaOriginal ? it.original : it.blob, creada: hoyISO(), usos: [], estado: '' }));
  await guardar(); E.propuestas = []; E.generados = []; E.subida = []; E.sDet = null;
  toast(t(`${listos.length} ${listos.length === 1 ? 'prenda guardada' : 'prendas guardadas'} en tu clóset`, `${listos.length} saved to your closet`)); ir('closet');
}

/* ---------- AÑADIR / EDITAR ---------- */
let fotoNueva = null;
function prepararAnadir(id) {
  E.editando = id ? P(id) : null; fotoNueva = null;
  const p = E.editando;
  $('an-titulo').textContent = p ? t('Editar prenda', 'Edit garment') : t('Nueva prenda', 'New garment');
  $('an-borrar').classList.toggle('oculto', !p);
  $('an-guardar').textContent = p ? t('Guardar cambios', 'Save changes') : t('Guardar en mi clóset', 'Save to my closet');
  $('an-otra').classList.toggle('oculto', !!p);
  $('an-tipo').innerHTML = TIPOS.map(x => `<option value="${x}">${tipoNombre(x)}</option>`).join('');
  $('an-estacion').innerHTML = ESTACIONES.map(x => `<option value="${x}">${estNombre(x)}</option>`).join('');
  $('an-nombre').value = p?.nombre || ''; $('an-tipo').value = p?.tipo || 'Arriba'; $('an-estacion').value = p?.estacion || 'Todo el año'; $('an-notas').value = p?.notas || '';
  pintarColores(p?.color || '');
  pintarPrevia(p ? urlFoto(p) : '');
}
function pintarColores(sel) {
  $('an-colores').innerHTML = COLORES.map(([n, c]) => `<button type="button" data-color="${n}" class="${n === sel ? 'sel' : ''}" title="${n}" style="background:${c}"></button>`).join('');
  $('an-colores').dataset.sel = sel;
}
function pintarPrevia(url) {
  const pv = $('previa');
  pv.innerHTML = url ? `<img src="${url}" alt=""><span class="cambiar">${t('Cambiar foto', 'Change photo')}<input type="file" accept="image/*" id="f-prenda"></span>`
    : `<label><svg><use href="#ic-camara"/></svg><span>${t('Haz una foto o elige una de la galería', 'Take a photo or pick one from the gallery')}</span><span class="et">${t('sobre fondo liso, la prenda entera', 'plain background, whole garment')}</span><input type="file" accept="image/*" id="f-prenda"></label>`;
  $('f-prenda').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = await procesarFoto(f); fotoNueva = r.blob; pintarPrevia(URL.createObjectURL(r.blob)); if (!$('an-colores').dataset.sel) pintarColores(r.color); if (!$('an-nombre').value) $('an-nombre').value = `${tipoNombre($('an-tipo').value)} ${r.color.toLowerCase()}`; }
    catch (err) { toast(t('No he podido leer esa foto', 'Could not read that photo')); }
  };
}
async function guardarPrenda(otra) {
  const p = E.editando; const nombre = $('an-nombre').value.trim(); const color = $('an-colores').dataset.sel || 'Gris';
  if (!p && !fotoNueva) return toast(t('Falta la foto de la prenda', 'The garment photo is missing'));
  if (!nombre) return toast(t('Ponle un nombre', 'Give it a name'));
  if (p) { Object.assign(p, { nombre, color, tipo: $('an-tipo').value, estacion: $('an-estacion').value, notas: $('an-notas').value.trim() }); if (fotoNueva) { p.foto = fotoNueva; delete p.src; urls.delete(p.id); } }
  else E.prendas.unshift({ id: uid(), nombre, color, tipo: $('an-tipo').value, estacion: $('an-estacion').value, notas: $('an-notas').value.trim(), foto: fotoNueva, creada: hoyISO(), usos: [], estado: '' });
  await guardar(); E.propuestas = [];
  toast(p ? t('Cambios guardados', 'Changes saved') : t('Guardada en tu clóset', 'Saved to your closet'));
  if (otra) prepararAnadir(null); else ir(p ? 'ficha' : 'closet', p?.id), p && abrirFicha(p.id);
}

/* ---------- FICHA ---------- */
function abrirFicha(id) {
  const p = P(id); if (!p) return;
  $('f-cat').textContent = tipoNombre(p.tipo); $('f-img').src = urlFoto(p); $('f-nombre').textContent = p.nombre;
  $('f-sub').textContent = [p.color, estNombre(p.estacion), p.notas].filter(Boolean).join(' · ');
  const usos = p.usos || []; $('f-usos').textContent = usos.length; $('f-ultima').textContent = usos.length ? fecha(usos[usos.length - 1], true) : '—';
  const conj = E.conjuntos.filter(c => c.ids.includes(id)); $('f-conj').textContent = conj.length;
  $('f-estado').classList.toggle('oculto', !p.estado); $('f-estado').textContent = estadoTxt(p.estado);
  const conAvatar = planDemo() === 'pro' ? conj.find(c => c.img) : null; const primero = conj[0];
  $('f-asi').innerHTML = conAvatar ? `<div class="puesta"><img src="${conAvatar.img}" alt=""><div class="pie">${conAvatar.nombre}</div></div>` : primero ? `<div class="puesta">${maniqui(primero.ids.map(P).filter(Boolean))}<div class="pie">${primero.nombre}</div></div>` : `<div class="vacio">${t('Aún no está en ningún conjunto. Añádela a uno o pulsa «Hoy llevo esto».', 'Not in any outfit yet. Add it to one or tap “Wearing this today”.')}</div>`;
  const acc = [['conjunto', t('Añadir a un conjunto', 'Add to an outfit')], ['lavar', p.estado === 'lavar' ? t('Ya está limpia', 'Clean again') : t('Enviar a lavar', 'Send to wash')], ['guardada', p.estado === 'guardada' ? t('Volver a sacarla', 'Bring it back out') : t('Guardar hasta la próxima estación', 'Store until next season')], ['donar', p.estado === 'donar' ? t('Me la quedo', 'Keeping it') : t('Donar o vender', 'Donate or sell')]];
  $('f-acciones').innerHTML = acc.map(([k, v]) => `<button class="item" data-accion="${k}">${v}<svg><use href="#ic-flecha"/></svg></button>`).join('');
  $('f-acciones').querySelectorAll('[data-accion]').forEach(b => b.onclick = async () => {
    const k = b.dataset.accion;
    if (k === 'conjunto') return ir('nuevo-look', [id]);
    p.estado = p.estado === k ? '' : k; await guardar(); E.propuestas = []; abrirFicha(id); toast(p.estado ? estadoTxt(p.estado) : t('De vuelta al clóset', 'Back in the closet'));
  });
  $('f-hoy').onclick = () => ponerse([id]).then(() => abrirFicha(id));
  $('f-editar').onclick = () => ir('anadir', id);
  $('f-nota').textContent = `${t('Añadida el', 'Added on')} ${fecha(p.creada)}${p.ejemplo ? ' · ' + t('prenda de ejemplo', 'sample garment') : ''}`;
  ir('ficha');
}

/* ---------- CONJUNTOS ---------- */
function pintarLooks() {
  const cs = E.conjuntos;
  $('looks-sub').textContent = '';
  const gen = E.generados;
  $('looks-gen').innerHTML = `<div class="g-cab"><b>${t('Generador de conjuntos', 'Outfit generator')}</b><p>${t('Combina tu ropa y te propone looks completos para el tiempo de hoy, empezando por lo que menos te pones.', 'Combines your clothes into complete looks for today’s weather, starting with what you wear least.')}</p><button class="boton" id="g-generar">${gen.length ? t('Generar otros', 'Generate others') : t('Generar conjuntos', 'Generate outfits')}</button></div>`
    + (gen.length ? `<div class="g-lista">${gen.map((g, i) => `<div class="g-look"><span class="img">${maniqui(g.ids.map(P).filter(Boolean), true)}</span><b>${g.nombre}</b><span>${g.ids.length} ${t('prendas', 'garments')}</span><div class="acc"><button class="si" data-gguardar="${i}">${t('Guardar', 'Save')}</button><button data-ghoy="${i}">${t('Hoy', 'Today')}</button></div></div>`).join('')}</div>` : '')
    + `<div class="g-titulo"><h2>${t('Guardados', 'Saved')}</h2><span>${cs.length}</span></div>`;
  $('g-generar').onclick = () => { E.generados = generarLooks(6, 'Todos'); if (!E.generados.length) toast(t('Necesito una parte de arriba y una de abajo, o un vestido, de esta estación.', 'I need a top and a bottom, or a dress, for this season.')); pintarLooks(); };
  $('galeria').innerHTML = cs.map(c => `<button class="look" data-look="${c.id}"><span class="img">${c.img && planDemo() === 'pro' ? `<img src="${c.img}" alt="">` : maniqui(c.ids.map(P).filter(Boolean), true)}</span><b>${c.nombre}</b><span>${c.usos?.length ? `${veces(c.usos.length)} · ${fecha(c.usos[c.usos.length - 1], true)}` : t('nunca puesto', 'never worn')}</span></button>`).join('');
  $('looks-vacio').innerHTML = cs.length ? '' : `<div class="vacio"><b>${t('Tus conjuntos, guardados', 'Your outfits, saved')}</b>${t('Combina prendas de tu clóset y guárdalas con nombre. Cada «Me lo pongo» cuenta un uso.', 'Combine garments from your closet and save them with a name. Every “I’ll wear it” counts as a use.')}<button class="boton" data-ir="nuevo-look">${t('Crear un conjunto', 'Create an outfit')}</button></div>`;
}
function prepararNuevoLook(pre) {
  E.preseleccion = Array.isArray(pre) ? pre.slice() : [];
  $('nl-nombre').value = ''; $('nl-ocasiones').innerHTML = OCASIONES.map(o => `<button type="button" class="chip ${o === 'Diario' ? 'sel' : ''}" data-oc="${o}">${ocNombre(o)}</button>`).join('');
  $('nl-ocasiones').dataset.sel = 'Diario';
  const act = activas();
  $('nl-prendas').innerHTML = act.length ? TIPOS.filter(tp => act.some(p => p.tipo === tp)).map(tp => `<span class="et">${tipoNombre(tp)}</span>` + act.filter(p => p.tipo === tp).map(p => `<button type="button" data-sel="${p.id}" class="${E.preseleccion.includes(p.id) ? 'sel' : ''}" title="${p.nombre}"><img src="${urlFoto(p)}" alt=""></button>`).join('')).join('') : `<div class="vacio" style="grid-column:1/-1">${t('Primero añade prendas al clóset.', 'Add garments to the closet first.')}</div>`;
}
async function guardarLook() {
  const ids = E.preseleccion; if (ids.length < 2) return toast(t('Elige al menos dos prendas', 'Pick at least two garments'));
  const nombre = $('nl-nombre').value.trim() || `${ocNombre($('nl-ocasiones').dataset.sel)} ${E.conjuntos.length + 1}`;
  E.conjuntos.unshift({ id: uid(), nombre, ocasion: $('nl-ocasiones').dataset.sel, ids, creada: hoyISO(), usos: [] });
  await guardar(); E.propuestas = []; toast(t('Conjunto guardado', 'Outfit saved')); ir('looks');
}
function abrirLook(id) {
  const c = E.conjuntos.find(x => x.id === id); if (!c) return;
  const ps = c.ids.map(P).filter(Boolean);
  $('lk-ocasion').textContent = ocNombre(c.ocasion || 'Diario'); $('lk-nombre').textContent = c.nombre;
  $('lk-sub').textContent = c.usos?.length ? `${veces(c.usos.length)} · ${t('última', 'last')} ${fecha(c.usos[c.usos.length - 1], true)}` : t('nunca puesto', 'never worn');
  $('lk-foto').innerHTML = c.img && planDemo() === 'pro' ? `<img src="${c.img}" alt="">` : maniqui(ps);
  $('lk-piezas').innerHTML = ps.map(p => `<button data-ficha="${p.id}"><img src="${urlFoto(p)}" alt=""><span>${p.nombre}</span></button>`).join('');
  $('lk-pongo').onclick = () => ponerse(c.ids, c).then(() => abrirLook(id));
  $('lk-borrar').onclick = async () => { if (await confirmar(t('¿Borrar este conjunto?', 'Delete this outfit?'), t('Las prendas se quedan en tu clóset.', 'The garments stay in your closet.'), t('Borrar', 'Delete'))) { E.conjuntos = E.conjuntos.filter(x => x.id !== id); await guardar(); E.propuestas = []; ir('looks'); } };
  ir('look');
}

/* ---------- DISEÑO: para decidir (letra, color, tiempo, simetría) ---------- */
function pintarDiseno() {
  const grupo = k => DIS[k].vals.map(v => `<button class="chip ${dis(k) === v ? 'sel' : ''}" data-dis="${k}|${v}">${DIS[k].nom[v]}</button>`).join('');
  $('d-proto').innerHTML = Object.keys(PROTOS).map(pn => `<button class="chip ${Object.entries(PROTOS[pn]).every(([k, v]) => dis(k) === v) ? 'sel' : ''}" data-proto="${pn}">${pn}</button>`).join('');
  for (const k of Object.keys(DIS)) $('d-' + k).innerHTML = grupo(k);
  $('d-muestra').innerHTML = `<b>${t('Viernes de oficina', 'Office Friday')}</b>${t('12°, nublado. Lluvia desde las 17:00: lleva paraguas. Pantalón negro con lazo · 5 usos. Il1 O0 rn m', '12°, cloudy. Rain from 17:00: take an umbrella. Black trousers with bow · 5 uses. Il1 O0 rn m')}`;
}

/* ---------- YO ---------- */
function pintarYo() {
  const pf = E.perfil || {}; const mes = hoyISO().slice(0, 7);
  const usosMes = E.prendas.reduce((n, p) => n + (p.usos || []).filter(u => u.startsWith(mes)).length, 0);
  const top = E.prendas.slice().sort((a, b) => (b.usos || []).length - (a.usos || []).length)[0];
  $('yo-cara').innerHTML = pf.selfie ? `<img src="${URL.createObjectURL(pf.selfie)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:50% 20%">` : (pf.nombre || '?').slice(0, 1).toUpperCase();
  $('yo-nombre').textContent = pf.nombre || t('Tú', 'You');
  $('yo-sub').textContent = [E.tiempo?.nombre || pf.ciudad || 'Madrid', estNombre(estacionDelDia()), `${E.prendas.length} ${t('prendas', 'garments')}`].join(' · ');
  $('yo-estad').innerHTML = `<div><b>${E.prendas.length}</b><span>${t('prendas', 'garments')}</span></div><div><b>${usosMes}</b><span>${t('usos este mes', 'uses this month')}</span></div><div><b>${E.conjuntos.length}</b><span>${t('conjuntos', 'outfits')}</span></div>`;
  const sil = pf.selfie && pf.cuerpo ? t('Fotos listas', 'Photos ready') : pf.selfie || pf.cuerpo ? t('Falta una foto', 'One photo missing') : t('Sin fotos', 'No photos');
  $('yo-lista').innerHTML = `<button class="item" data-ir="silueta">${t('Mi silueta', 'My figure')}<span class="valor ${pf.selfie && pf.cuerpo ? 'oro' : ''}">${sil}</span></button>
    <button class="item" id="yo-colores">${t('Mis colores', 'My colours')}<span class="valor">${t('Próximamente', 'Coming soon')}</span></button>
    <button class="item" id="yo-top">${t('La que más te pones', 'Most worn')}<span class="valor">${top && (top.usos || []).length ? `${top.nombre} · ${top.usos.length}` : '—'}</span></button>`;
  $('yo-ajustes').innerHTML = `<button class="item" id="yo-idioma">${t('Idioma', 'Language')}<span class="valor">${idioma() === 'en' ? 'English' : 'Español'}</span></button>
    <button class="item" data-ir="diseno">${t('Diseño (para decidir)', 'Design (to decide)')}<span class="valor">${DIS.letra.nom[dis('letra')]} · ${DIS.tema.nom[dis('tema')]}</span></button>
    <button class="item" id="yo-plan">${t('Plan (para enseñarlo)', 'Plan (demo)')}<span class="valor">${planDemo() === 'pro' ? t('Pro · tu avatar', 'Pro · your avatar') : t('Básico · maniquí', 'Basic · mannequin')}</span></button>
    <button class="item" id="yo-ciudad">${t('Ciudad para el tiempo', 'City for the weather')}<span class="valor">${pf.lat ? t('tu ubicación', 'your location') : pf.ciudad || 'Madrid'}</span></button>
    <button class="item" id="yo-exportar">${t('Guardar una copia de mis datos', 'Save a copy of my data')}<span class="valor">JSON</span></button>
    ${PUBLICA ? '' : `<button class="item" id="yo-ejemplo">${E.prendas.some(p => p.ejemplo) ? t('Quitar el clóset de ejemplo', 'Remove the sample closet') : t('Cargar un clóset de ejemplo', 'Load a sample closet')}<span class="valor"></span></button>`}
    <button class="item" id="yo-borrar">${t('Borrar todo de este móvil', 'Delete everything from this phone')}<span class="valor"></span></button>
    <div class="item">${t('Suscripción', 'Subscription')}<span class="valor">${t('Prueba · versión web', 'Trial · web version')}</span></div>`;
  $('yo-idioma').onclick = async () => { E.perfil = E.perfil || {}; E.perfil.idioma = idioma() === 'en' ? 'es' : 'en'; localStorage.setItem('tc_idioma', E.perfil.idioma); await guardar(); traducir(); pintarYo(); };
  $('yo-ciudad').onclick = async () => { const c = prompt(t('Ciudad para el tiempo', 'City for the weather'), pf.ciudad || ''); if (c === null) return; E.perfil = E.perfil || {}; E.perfil.ciudad = c.trim(); E.perfil.lat = E.perfil.lon = null; await guardar(); await cargarTiempo(true); E.propuestas = []; pintarYo(); };
  $('yo-plan').onclick = () => { PLAN_URL = null; localStorage.setItem('tc_plan', planDemo() === 'pro' ? 'basico' : 'pro'); pintarYo(); toast(planDemo() === 'pro' ? t('Pro: tu avatar con el conjunto', 'Pro: your avatar') : t('Básico: el conjunto en el maniquí', 'Basic: the outfit on the mannequin')); };
  $('yo-exportar').onclick = exportar;
  if ($('yo-ejemplo')) $('yo-ejemplo').onclick = () => E.prendas.some(p => p.ejemplo) ? quitarEjemplo() : cargarEjemplo();
  $('yo-borrar').onclick = async () => { if (await confirmar(t('¿Borrar todo?', 'Delete everything?'), t('Prendas, fotos, conjuntos y usos de este navegador. No se puede deshacer.', 'Garments, photos, outfits and uses in this browser. Cannot be undone.'), t('Borrar todo', 'Delete all'))) { for (const k of await BD.claves()) await BD.del(k); localStorage.removeItem('tc_tiempo'); location.reload(); } };
  $('yo-colores').onclick = () => toast(t('Los colores que te favorecen llegan en la próxima versión', 'Your best colours arrive in the next version'));
}
async function exportar() {
  const aB64 = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  const prendas = []; for (const p of E.prendas) prendas.push({ ...p, foto: p.foto ? await aB64(p.foto) : null });
  const datos = { version: 'tucloset-web-0.5', fecha: new Date().toISOString(), perfil: { ...E.perfil, selfie: null, cuerpo: null }, prendas, conjuntos: E.conjuntos };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: 'application/json' })); a.download = `tucloset-${hoyISO()}.json`; a.click();
  toast(t('Copia guardada', 'Copy saved'));
}

/* ---------- clóset de ejemplo (las fotos de producto y los looks de Sheila, solo en local) ---------- */
const EJ_PRENDAS = [['01_chaleco-rayas-camel', 'Chaleco de rayas', 'Arriba', 'Camel', 'Entretiempo', 3], ['02_pantalon-negro-lazo', 'Pantalón negro con lazo', 'Abajo', 'Negro', 'Todo el año', 5], ['03_top-corto-beige', 'Top corto beige', 'Arriba', 'Beige', 'Verano', 2], ['04_camiseta-blanca', 'Camiseta blanca', 'Arriba', 'Blanco', 'Todo el año', 8], ['05_top-rosa-lazo', 'Top rosa con lazo', 'Arriba', 'Rosa', 'Verano', 1], ['06_vaqueros-anchos-claros', 'Vaqueros anchos', 'Abajo', 'Azul claro', 'Todo el año', 6], ['07_bolso-negro', 'Bolso negro', 'Bolsos', 'Negro', 'Todo el año', 9], ['08_camisa-estampada-amarilla', 'Camisa estampada', 'Arriba', 'Amarillo', 'Entretiempo', 2], ['09_falda-azul-claro', 'Falda azul claro', 'Abajo', 'Azul claro', 'Verano', 1], ['10_vestido-negro-cruzado', 'Vestido negro cruzado', 'Vestidos', 'Negro', 'Todo el año', 2], ['11_tacones-negros', 'Tacones negros', 'Calzado', 'Negro', 'Todo el año', 3], ['12_zapatillas-blancas', 'Zapatillas blancas', 'Calzado', 'Blanco', 'Todo el año', 11]];
const EJ_LOOKS = [['Viernes de oficina', 'Oficina', 'oficina', [4, 1, 10, 6]], ['Domingo de paseo', 'Diario', 'paseo', [0, 3, 5, 11]], ['Cena del sábado', 'Noche', 'noche', [9, 10, 6]], ['Sol de otoño', 'Diario', 'casual', [7, 5, 11]]];
async function cargarEjemplo() {
  if (E.prendas.some(p => p.ejemplo)) { toast(t('El ejemplo ya está cargado', 'Sample already loaded')); return ir('closet'); }
  const ids = EJ_PRENDAS.map((x, i) => 'ej' + i);
  EJ_PRENDAS.forEach(([f, nombre, tipo, color, estacion, n], i) => { const usos = []; for (let k = 0; k < n; k++) { const d = new Date(); d.setDate(d.getDate() - 2 - k * 4); usos.unshift(d.toISOString().slice(0, 10)); } E.prendas.push({ id: ids[i], nombre, tipo, color, estacion, notas: 'Talla M', src: `../prendas/${f}.webp`, creada: '2026-10-12', usos, estado: '', ejemplo: true }); });
  EJ_LOOKS.forEach(([nombre, ocasion, img, idx], i) => E.conjuntos.push({ id: 'ejl' + i, nombre, ocasion, ids: idx.map(k => ids[k]), img: `../avatar/${img}-recorte.webp`, creada: '2026-10-14', usos: i === 0 ? ['2026-10-16'] : [], ejemplo: true }));
  E.perfil = Object.assign(E.perfil || {}, { alta: E.perfil?.alta || hoyISO(), idioma: idioma(), nombre: E.perfil?.nombre || 'Sheila' });
  await guardar(); E.propuestas = []; toast(t('12 prendas y 4 conjuntos de ejemplo', '12 sample garments and 4 outfits')); ir('hoy');
}
async function quitarEjemplo() { E.prendas = E.prendas.filter(p => !p.ejemplo); E.conjuntos = E.conjuntos.filter(c => !c.ejemplo); await guardar(); E.propuestas = []; pintarYo(); toast(t('Ejemplo quitado', 'Sample removed')); }

/* ---------- alta ---------- */
async function guardarAlta() {
  E.perfil = Object.assign(E.perfil || {}, { nombre: $('a-nombre').value.trim(), ciudad: $('a-ciudad').value.trim(), idioma: idioma(), alta: hoyISO() });
  await guardar(); cargarTiempo(true); ir('silueta');
}
function pintarSilueta() {
  const pf = E.perfil || {};
  [['selfie', 'l-selfie'], ['cuerpo', 'l-cuerpo']].forEach(([k, id]) => { const l = $(id); const bl = pf[k]; l.classList.toggle('hecho', !!bl); l.querySelectorAll('img,i').forEach(x => x.remove()); if (bl) { const im = document.createElement('img'); im.src = URL.createObjectURL(bl); l.prepend(im); const i = document.createElement('i'); i.textContent = '✓'; l.append(i); } });
}
async function guardarFotoPerfil(k, file) {
  try { const r = await procesarFoto(file); E.perfil = E.perfil || {}; E.perfil[k] = r.blob; await guardar(); pintarSilueta(); toast(k === 'selfie' ? t('Selfie guardada', 'Selfie saved') : t('Foto de cuerpo guardada', 'Body photo saved')); }
  catch (e) { toast(t('No he podido leer esa foto', 'Could not read that photo')); }
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ir],[data-ficha],[data-filtro],[data-look],[data-idioma],[data-color],[data-oc],[data-sel],[data-plan],[data-gguardar],[data-ghoy],[data-dis],[data-proto]'); if (!b) return;
  if (b.dataset.ir) { e.preventDefault(); if (b.dataset.ir === 'hoy' && E.pantalla === 'inicio' && !E.perfil?.alta) { E.perfil = Object.assign(E.perfil || {}, { alta: hoyISO(), idioma: idioma() }); guardar(); } ir(b.dataset.ir); }
  else if (b.dataset.ficha) abrirFicha(b.dataset.ficha);
  else if (b.dataset.filtro) { E.filtro = b.dataset.filtro; pintarCloset(); }
  else if (b.dataset.look) abrirLook(b.dataset.look);
  else if (b.dataset.idioma) { localStorage.setItem('tc_idioma', b.dataset.idioma); if (E.perfil) { E.perfil.idioma = b.dataset.idioma; guardar(); } traducir(); }
  else if (b.dataset.color) { pintarColores(b.dataset.color); }
  else if (b.dataset.oc) { $('nl-ocasiones').dataset.sel = b.dataset.oc; $('nl-ocasiones').querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', c.dataset.oc === b.dataset.oc)); }
  else if (b.dataset.dis) { const [k, v] = b.dataset.dis.split('|'); delete DIS_URL[k]; localStorage.setItem('tc_' + k, v); aplicarDiseno(); pintarDiseno(); }
  else if (b.dataset.proto) { for (const [k, v] of Object.entries(PROTOS[b.dataset.proto])) { delete DIS_URL[k]; localStorage.setItem('tc_' + k, v); } aplicarDiseno(); pintarDiseno(); toast(`${b.dataset.proto}: ${DIS.letra.nom[dis('letra')]} · ${DIS.tema.nom[dis('tema')]}`); }
  else if (b.dataset.gguardar !== undefined) { const g = E.generados[+b.dataset.gguardar]; if (g) { E.conjuntos.unshift({ id: uid(), nombre: g.nombre, ocasion: g.ocasion, ids: g.ids, creada: hoyISO(), usos: [] }); E.generados.splice(+b.dataset.gguardar, 1); guardar(); E.propuestas = []; toast(t('Conjunto guardado', 'Outfit saved')); pintarLooks(); } }
  else if (b.dataset.ghoy !== undefined) { const g = E.generados[+b.dataset.ghoy]; if (g) ponerse(g.ids); }
  else if (b.dataset.plan) { E.plan = b.dataset.plan; E.hoyIdx = 0; E.propuestas = []; pintarHoy(); }
  else if (b.dataset.sel) { const id = b.dataset.sel; const i = E.preseleccion.indexOf(id); i >= 0 ? E.preseleccion.splice(i, 1) : E.preseleccion.push(id); b.classList.toggle('sel', i < 0); }
});
$('busca').oninput = e => { E.busca = e.target.value; pintarCloset(); };
$('mc-filtrar').onclick = () => hojaFiltros(true); $('mc-velo').onclick = () => hojaFiltros(false); $('mc-ver').onclick = () => hojaFiltros(false);
$('mc-borrar').onclick = () => { for (const k in E.f) E.f[k] = []; pintarCloset(); };
$('mc-grupos').onclick = e => { const b = e.target.closest('[data-fil]'); if (!b) return; const [k, v] = b.dataset.fil.split('|'); const a = E.f[k]; const i = a.indexOf(v); i >= 0 ? a.splice(i, 1) : a.push(v); pintarCloset(); };
if ($('c-buscar')) $('c-buscar').onclick = () => { const c = $('busca-caja'); c.classList.toggle('oculto'); if (!c.classList.contains('oculto')) $('busca').focus(); else { E.busca = ''; $('busca').value = ''; pintarCloset(); } };
$('a-seguir').onclick = guardarAlta;
$('a-ubicacion').onclick = () => { if (!navigator.geolocation) return toast(t('Tu navegador no da la ubicación', 'Your browser gives no location')); navigator.geolocation.getCurrentPosition(async p => { E.perfil = Object.assign(E.perfil || {}, { lat: p.coords.latitude, lon: p.coords.longitude, ciudad: '' }); $('a-ciudad').value = ''; await guardar(); await cargarTiempo(true); toast(E.tiempo ? `${E.tiempo.nombre || t('Ubicación', 'Location')} · ${E.tiempo.t}°` : t('Ubicación guardada', 'Location saved')); }, () => toast(t('Sin permiso de ubicación: escribe la ciudad', 'No location permission: type the city'))); };
$('f-selfie').onchange = e => e.target.files[0] && guardarFotoPerfil('selfie', e.target.files[0]);
$('f-cuerpo').onchange = e => e.target.files[0] && guardarFotoPerfil('cuerpo', e.target.files[0]);
$('an-guardar').onclick = () => guardarPrenda(false);
$('an-otra').onclick = () => guardarPrenda(true);
$('an-borrar').onclick = async () => { const p = E.editando; if (!p) return; if (await confirmar(t('¿Borrar esta prenda?', 'Delete this garment?'), t('Se quita del clóset y de sus conjuntos.', 'It is removed from the closet and its outfits.'), t('Borrar', 'Delete'))) { E.prendas = E.prendas.filter(x => x.id !== p.id); E.conjuntos.forEach(c => c.ids = c.ids.filter(id => id !== p.id)); E.conjuntos = E.conjuntos.filter(c => c.ids.length >= 1); await guardar(); E.propuestas = []; ir('closet'); } };
$('nl-guardar').onclick = guardarLook;

/* ---------- arranque ---------- */
// lemas a prueba (?lema=1…9), Gabriela 20/10: «optimiza tu tiempo, y vive tus outfits / optimiza tus outfits / optimiza tu estilo…»
const LEMAS = ['Optimiza tu tiempo, vive tus outfits', 'Optimiza tu tiempo, vive tus looks', 'Optimiza tu tiempo, luce tu estilo', 'Optimiza tus outfits', 'Optimiza tu estilo', 'Optimiza tu estilo, vive tus looks', 'Optimiza tus mañanas, vive tu estilo', 'Menos tiempo eligiendo, más tiempo luciendo', 'Optimiza tu tiempo. Tu estilo, cada día'];
// cómo aparece el lema (Gabriela, 20/10: «no me gusta lo de bordar, ¿qué otras opciones?»): a fundido · b se escribe · c hilo y sube · d letra a letra · e las letras se juntan
function bordar() {
  const l = $('p-inicio').querySelector('.lema'); if (!l) return;
  const v = new URLSearchParams(location.search).get('anim'); l.dataset.anim = 'abcde'.includes(v) && v ? v : 'b'; // B elegida por Gabriela el 20/10
  if (l.dataset.anim === 'd') { const t = l.querySelector('.t'); t.innerHTML = [...t.textContent].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join(''); }
}
function entrada(q) { // las puertas del 129 se abren al entrar; un toque la salta
  { const m = q.get('marco'); if (/^[1-6]$/.test(m || '')) document.documentElement.dataset.marco = m; } // marcos a prueba (20/10)
  const el = $('intro'); if (!el) return;
  if (q.get('intro') !== '1' && (q.get('intro') === '0' || q.get('pantalla') || q.get('ficha'))) { el.remove(); $('p-inicio').classList.add('aparece'); return; }
  const v = q.get('entrada') || localStorage.getItem('tc_entrada') || 'b'; // B por defecto (Gabriela, 20/10: «me gusta la B») if (q.get('entrada')) localStorage.setItem('tc_entrada', v);
  const nom = '<span class="nom">Tu<span>Closet</span></span>';
  if (v === 'b') { el.className = 'intro eb'; el.innerHTML = `<div class="x"><svg viewBox="0 0 100 100"><path d="M34 30A16 16 0 0 1 66 30"/><path d="M21 30H79"/><path d="M25 30V82H75V30"/><path d="M50 30V82"/><path d="M31 37h13v38H31zM56 37h13v38H56z"/><path d="M28 82v5M72 82v5"/></svg>${nom}</div>`; }
  if (v === 'c') { el.className = 'intro ec'; el.innerHTML = `<div class="fondo"></div><div class="barra"></div><div class="anillas"></div><div class="tela">${nom}</div>`; }
  el.classList.add('activa');
  let hecho = false; el.addEventListener('click', () => { if (hecho) return; hecho = true; el.classList.add('fuera'); $('p-inicio').classList.add('aparece'); setTimeout(() => el.remove(), 220); });
  if (v === 'b' && !matchMedia('(prefers-reduced-motion: reduce)').matches) { // B (Gabriela, 20/10): se dibuja en el centro y ahí se queda; no sube a la cabecera
    if (q.get('fin') !== '0') setTimeout(() => {
      const pant = document.querySelector('.pantalla.activa');
      if (pant && pant.id === 'p-inicio') { el.remove(); pant.classList.add('aparece'); return; } // la bienvenida tiene el icono y el nombre en el mismo sitio: solo aparece lo demás
      el.classList.add('con-nombre'); setTimeout(() => { el.classList.add('suave'); setTimeout(() => el.remove(), 750); }, 1500); // en el resto, se escribe el nombre y el dibujo se desvanece en su sitio
    }, 1350);
  } else if (q.get('fin') !== '0') setTimeout(() => { el.remove(); if ($('p-inicio').classList.contains('activa')) $('p-inicio').classList.add('aparece'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 2250);
}
(async () => {
  entrada(new URLSearchParams(location.search));
  E.perfil = (await BD.get('perfil')) || null; E.prendas = (await BD.get('prendas')) || []; E.conjuntos = (await BD.get('conjuntos')) || [];
  let migra = false; E.conjuntos.forEach(c => { if (c.ejemplo && c.img && !c.img.includes('-recorte')) { c.img = c.img.replace('.webp', '-recorte.webp'); migra = true; } }); if (migra) await guardar();
  traducir(); pintarSilueta();
  { const l = +new URLSearchParams(location.search).get('lema'); const t = LEMAS[l - 1]; if (t) $('p-inicio').querySelector('.lema .t').textContent = t; bordar(); }
  const q = new URLSearchParams(location.search);
  for (const k of Object.keys(DIS)) if (DIS[k].vals.includes(q.get(k))) DIS_URL[k] = q.get(k);
  if (PROTOS[q.get('proto')]) Object.assign(DIS_URL, PROTOS[q.get('proto')]);
  if (['pro', 'basico'].includes(q.get('plan'))) PLAN_URL = q.get('plan');
  aplicarDiseno();
  if (q.get('ejemplo') && !E.prendas.length && !PUBLICA) await cargarEjemplo();
  const destino = q.get('pantalla') || (E.perfil?.alta || E.prendas.length ? 'hoy' : 'inicio');
  if (destino !== 'inicio') await Promise.race([cargarTiempo(), new Promise(r => setTimeout(r, 4000))]);
  ir(destino);
  if (q.get('ficha')) abrirFicha(q.get('ficha'));
  document.querySelectorAll('#p-silueta [data-ir="hoy"], #p-inicio [data-ir="hoy"]').forEach(b => b.addEventListener('click', () => { if (!E.perfil?.alta) { E.perfil = Object.assign(E.perfil || {}, { alta: hoyISO(), idioma: idioma() }); guardar(); } }));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
