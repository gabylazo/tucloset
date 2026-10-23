/* TuCloset · web 0.8 · lógica (0.8, 20/10: Hoy, Clóset, filtros y entrada cerrados por Gabriela) (0.7, 19/10: subida en lote y generador de conjuntos, encargo de Sheila) (Dirección, 18/10/2026; 0.6 la misma noche: base V5 tarjeta, maniquí del Básico, estilos nogal/verde/color, entrada con las puertas)
   Todo se guarda en el navegador (IndexedDB): perfil, prendas con su foto, conjuntos y usos. Sin servidor.
   Pantallas: inicio, alta, silueta, hoy, closet, anadir, ficha, looks, nuevo-look, look, yo. */
'use strict';
const PUBLICA = !!window.TC_PUBLICA; // la copia pública (web/): sin el clóset de ejemplo, que lleva fotos de Sheila

/* ---------- almacén (IndexedDB, clave→valor) ---------- */
let CLOSET_ACT = ''; try { CLOSET_ACT = localStorage.getItem('tc_closet') || ''; } catch (e) { } // 0.53 (Sheila, 22/10: «un genérico con las ropas de Pinterest y otro con mi ropa real»)
const BD = (() => {
  let db;
  const abrir = () => new Promise((res, rej) => {
    if (db) return res(db);
    const r = indexedDB.open('tucloset' + (CLOSET_ACT ? '-' + CLOSET_ACT : ''), 1); // 0.53: cada clóset (Mi ropa, Pruebas) en su propia base
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { db = r.result; res(db); };
    r.onerror = () => rej(r.error);
  });
  const op = (modo, f) => abrir().then(d => new Promise((res, rej) => { const tx = d.transaction('kv', modo); const q = f(tx.objectStore('kv')); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); }));
  return { get: k => op('readonly', s => s.get(k)), set: (k, v) => op('readwrite', s => s.put(v, k)), del: k => op('readwrite', s => s.delete(k)), claves: () => op('readonly', s => s.getAllKeys()) };
})();

/* ---------- estado ---------- */
const E = { perfil: null, prendas: [], conjuntos: [], pantalla: 'inicio', filtro: 'Todo', busca: '', hoyIdx: 0, propuestas: [], tiempo: null, editando: null, preseleccion: [], plan: 'Todos', subida: [], generados: [], agenda: {} };
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
  ac_crear: ['Crea tu clóset', 'Create your closet'], ac_nombre: ['Tu nombre', 'Your name'], ac_ciudad: ['Tu ciudad', 'Your city'], ac_ubic: ['Usar mi ubicación', 'Use my location'],
  ac_nota: ['La ciudad es solo para el tiempo. Tus fotos se quedan en tu móvil.', 'The city is only for the weather. Your photos stay on your phone.'],
  ac_silueta: ['Tu silueta', 'Your silhouette'], ac_sil_sub: ['Dos fotos para verte con tu ropa puesta, conocer tu tipo de cuerpo y tus colores.', 'Two photos to see yourself in your clothes and learn your body type and colours.'], ac_cuerpo: ['Tu tipo de cuerpo', 'Your body type'], ac_estilo: ['Tu estilo', 'Your style'], ac_consejo: ['Luz natural, de frente y sin filtros.', 'Natural light, facing the camera, no filters.'], ac_luego: ['Ahora no', 'Not now'],
  ac_entrar: ['Hola de nuevo', 'Welcome back'], ac_correo: ['Correo', 'Email'], ac_clave: ['Contraseña', 'Password'], ac_olvido: ['¿La has olvidado?', 'Forgot it?'], ac_entrar_bt: ['Entrar', 'Sign in'], ac_o: ['o', 'or'],
  ac_apple: ['Continuar con Apple', 'Continue with Apple'], ac_google: ['Continuar con Google', 'Continue with Google'], ac_no_tengo: ['¿Aún no tienes cuenta? Crea tu clóset', 'No account yet? Create your closet'],
  lema: ['Optimiza tu estilo', 'Make the most of your style'], crear: ['Crear mi clóset', 'Create my closet'], ya_tengo: ['Ya tengo cuenta', 'I already have one'],
  legal: ['Pruébala gratis 7 días', 'Try it free for 7 days'],
  p_cuenta: ['Cuenta', 'Account'], p_silueta: ['Silueta', 'Figure'], p_prendas: ['Prendas', 'Garments'],
  alta_titulo: ['Lo justo para empezar', 'Just enough to start'], alta_sub: ['Todo se guarda en tu móvil. Nada sale de aquí sin que tú lo pidas.', 'Everything stays on your phone. Nothing leaves unless you ask.'],
  nombre: ['Tu nombre', 'Your name'], ciudad: ['Ciudad para el tiempo', 'City for the weather'], usar_ubicacion: ['Usar mi ubicación', 'Use my location'],
  r1: ['Tus fotos se quedan en este móvil; la app no las sube a ningún sitio en esta versión.', 'Your photos stay on this phone; this version uploads nothing.'],
  r2: ['La prueba dura 7 días con 10 prendas; después, desde 1,99 € al mes.', 'The trial lasts 7 days with 10 garments; then from €1.99 a month.'],
  r3: ['Lo que decide la app (tipo, color, conjuntos) siempre lo puedes corregir.', 'Whatever the app decides (type, colour, outfits) you can always correct.'],
  seguir: ['Seguir', 'Continue'], saltar: ['Saltar', 'Skip'], sil_titulo: ['Dos fotos y ya', 'Two photos and done'], sil_sub: ['Con ellas te verás con tu ropa puesta.', 'With them you will see yourself wearing your clothes.'],
  selfie: ['Selfie', 'Selfie'], selfie_et: ['luz natural, sin filtros', 'natural light, no filters'], cuerpo: ['Cuerpo entero', 'Full body'], cuerpo_et: ['de pie, ropa ajustada', 'standing, fitted clothes'],
  s1: ['Luz natural, sin filtros ni gafas de sol.', 'Natural light, no filters or sunglasses.'], s2: ['De frente y con el cuerpo entero dentro.', 'Facing the camera, whole body in frame.'], s3: ['Puedes cambiarlas cuando quieras desde «Yo».', 'You can change them any time from “Me”.'],
  privado: ['Las fotos se quedan en tu móvil. Solo tu silueta, sin tu cara, se usará para probarte la ropa.', 'Photos stay on your phone. Only your figure, without your face, will be used to try clothes on.'],
  buscar: ['Buscar en mi clóset', 'Search my closet'], nueva: ['Nueva prenda', 'New garment'], editar_prenda: ['Editar prenda', 'Edit garment'], borrar: ['Borrar', 'Delete'],
  hacer_foto: ['Haz una foto o elige una de la galería', 'Take a photo or pick one from the gallery'], foto_et: ['sobre fondo liso, la prenda entera', 'plain background, whole garment'],
  nombre_prenda: ['Nombre', 'Name'], tipo: ['Tipo', 'Type'], categoria: ['Categoría', 'Category'], estacion: ['Estación', 'Season'], color: ['Color', 'Colour'], notas: ['Notas (talla, tienda, cuidado…)', 'Notes (size, shop, care…)'],
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
async function guardar() { await BD.set('perfil', E.perfil); await BD.set('prendas', E.prendas); await BD.set('conjuntos', E.conjuntos); await BD.set('agenda', E.agenda); }

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
const MEDIDA = { Arriba: [60, 58], Abrigo: [72, 88], Abajo: [58, 100], Vestidos: [72, 100], Calzado: [34, 30], Bolsos: [36, 36], Accesorios: [22, 22] };
// 0.31 (Sheila, 22/10: «este resultado también es bastante feo»): cada foto se mide una vez (dónde está la prenda dentro de su foto blanca) y el
// conjunto se compone con la silueta real de cada prenda, recortada a su caja: sin huecos blancos entre piezas, más junto y más grande.
const tam = p => { const M = MEDIDA[p.tipo] || [40, 40]; if (!p.caja) return M; let w = M[0], h = w * p.caja[4]; const tope = M[1] * 1.25; if (h > tope) { h = tope; w = h / p.caja[4]; } return [w, h]; };
async function medirFoto(p) {
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = urlFoto(p); });
  const S = 140, k = S / Math.max(im.naturalWidth, im.naturalHeight), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0, q = 0; i < d.length; i += 4, q++) { if (d[i + 3] < 30 || Math.min(d[i], d[i + 1], d[i + 2]) > 236) continue; const px = q % w, py = (q / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
  if (x1 < 0) return [0, 0, 1, 1, h / w];
  const c0 = [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h]; return [...c0.map(v => +v.toFixed(4)), +(((c0[3] - c0[1]) * h) / ((c0[2] - c0[0]) * w)).toFixed(4)];
}
let midiendo = null;
function medirTodas() {
  if (midiendo) return midiendo;
  midiendo = (async () => {
    const pend = E.prendas.filter(p => !p.caja && (p.foto || p.src)); let n = 0;
    for (const p of pend) { try { p.caja = await medirFoto(p); n++; } catch (e) { p.caja = null; } }
    if (n) { if (E.prendas.some(p => !p.src)) await guardar(); E.propuestas = []; if (E.pantalla === 'hoy') pintarHoy(); else if (E.pantalla === 'looks') pintarLooks(); }
    midiendo = null;
  })();
  return midiendo;
}
const pieza = (p, x, y, w, h, W, H) => { const pos = `left:${x / W * 100}%;top:${y / H * 100}%;width:${w / W * 100}%;height:${h / H * 100}%`;
  if (!p.caja) return `<img src="${urlFoto(p)}" alt="" style="${pos}">`;
  const [a, b, c, d] = p.caja, cw = c - a, ch = d - b;
  return `<i class="pz" style="${pos};background-image:url('${urlFoto(p)}');background-size:${100 / cw}% ${100 / ch}%;background-position:${cw < 1 ? a / (1 - cw) * 100 : 0}% ${ch < 1 ? b / (1 - ch) * 100 : 0}%"></i>`; };
// 0.32 · presentación «collage» (Sheila, 22/10: «inspírate en esto para presentar los looks», dos referencias tipo Pinterest):
// el look en una columna (arriba tocando la pieza de abajo), y a un lado el bolso arriba, los accesorios en medio y el calzado abajo.
// Se activa con ?comp=collage (queda guardado); la simétrica (Eje/Cruz, cerrada por Gabriela el 20/10) sigue por defecto hasta que ella decida.
const COMP = (() => { try { const q = new URLSearchParams(location.search).get('comp'); if (q) localStorage.setItem('tc_comp', q); return localStorage.getItem('tc_comp') || 'sim'; } catch (e) { return 'sim'; } })();
function collage(ps) {
  const m = tam, rol = r => ps.filter(p => r.includes(p.tipo)), G = 6;
  const arriba = rol(['Arriba', 'Abrigo']).slice(0, 2), grande = rol(['Abajo', 'Vestidos'])[0], bolso = rol(['Bolsos'])[0], calzado = rol(['Calzado'])[0], acc = rol(['Accesorios']).slice(0, 3);
  const col = [arriba[0], grande].filter(Boolean); if (!col.length) return null;
  const colW = Math.max(...col.map(p => m(p)[0])), out = []; let y = 0;
  col.forEach((p, k) => { const [w, h] = m(p); if (k) y -= Math.min(6, m(col[0])[1] * .06); out.push([p, 0, y, w, h, col.length > 1 ? (k ? 1 : -1) * colW * .05 : 0]); y += h; }); // un poco en diagonal
  const H = y, esc = .9;
  // izquierda: segunda prenda de arriba y accesorios, de arriba abajo, y el calzado abajo pisando un poco el look; derecha: el bolso, a un tercio
  const izq = [arriba[1], ...acc].filter(Boolean), szI = izq.map(p => m(p).map(v => v * esc)), szZ = calzado ? m(calzado).map(v => v * esc) : [0, 0], szB = bolso ? m(bolso).map(v => v * esc) : [0, 0];
  const lw = Math.max(0, ...szI.map(s => s[0]), szZ[0] * .7, szB[0] * .8); // los dos lados igual de anchos: el look queda siempre en el centro (Gabriela, 22/10: «¿todo sale descentrado?»)
  const x0 = lw + (lw ? G : 0), W = 2 * x0 + colW * 1.1;
  out.forEach(o => o[1] = x0 + colW * .05 + (colW - o[3]) / 2 + o[5]);
  let ly = 0; izq.forEach((p, k) => { const [w, h] = szI[k]; out.push([p, (izW - w) / 2, ly, w, h]); ly += h + G; });
  if (calzado) { const [w, h] = szZ; out.push([calzado, Math.max(0, x0 - w * .55), H - h * .85, w, h]); }
  if (bolso) { const [w, h] = szB; out.push([bolso, W - w, H * .3 - h / 2, w, h]); }
  const Ht = Math.max(H + (calzado ? szZ[1] * .15 : 0), ly - G);
  return { out, W, H: Ht };
}
function composicion(ps) {
  if (ps.some(p => !p.caja && (p.foto || p.src))) setTimeout(medirTodas, 0);
  if (COMP === 'collage') { const c = collage(ps); if (c) return c.out.sort((a, b) => ['Bolsos', 'Calzado'].includes(a[0].tipo) - ['Bolsos', 'Calzado'].includes(b[0].tipo)).map(([p, x, y, w, h]) => pieza(p, x, y, w, h, c.W, c.H)).join('') + `<!--${c.W}x${c.H}-->`; }
  const G = 5, m = tam, rol = r => ps.filter(p => r.includes(p.tipo));
  const arriba = rol(['Arriba', 'Abrigo']).slice(0, 3), grande = rol(['Abajo', 'Vestidos'])[0], bolso = rol(['Bolsos'])[0], calzado = rol(['Calzado'])[0];
  const ancho = f => f.reduce((t, p) => t + m(p)[0], 0) + G * (f.length - 1), out = [];
  const fila = (f, y, W) => { const h = Math.max(...f.map(p => m(p)[1])); let x = (W - ancho(f)) / 2; f.forEach(p => { out.push([p, x, y + (h - m(p)[1]) / 2]); x += m(p)[0] + G; }); return h; };
  let W, y = 0;
  if (grande && bolso && calzado) { // Cruz
    const col = Math.max(m(bolso)[0], m(calzado)[0]), cw = m(grande)[0];
    W = Math.max(2 * (col + G) + cw, arriba.length ? ancho(arriba) : 0);
    if (arriba.length) y = fila(arriba, 0, W) + G;
    out.push([grande, (W - cw) / 2, y]); const yb = y + m(grande)[1] * .55;
    out.push([bolso, (W - cw) / 2 - G - col + (col - m(bolso)[0]) / 2, yb - m(bolso)[1] / 2]);
    out.push([calzado, (W + cw) / 2 + G + (col - m(calzado)[0]) / 2, yb - m(calzado)[1] / 2]);
    y += m(grande)[1];
  } else { // Eje
    const filas = [arriba, grande ? [grande] : [], [bolso, calzado].filter(Boolean)].filter(f => f.length);
    if (!filas.length) return '';
    W = Math.max(...filas.map(ancho)); filas.forEach(f => { y += fila(f, y, W) + G; }); y -= G;
  }
  return out.map(([p, x, yy]) => pieza(p, x, yy, m(p)[0], m(p)[1], W, y)).join('') + `<!--${W}x${y}-->`;
}
function maniqui(ps, mini) { // nombre heredado: ahora devuelve la composición simétrica
  const html = composicion(ps); const r = html.match(/<!--([\d.]+)x([\d.]+)-->/);
  return `<div class="lienzo${mini ? ' mini' : ''}" style="aspect-ratio:${r ? r[1] + '/' + r[2] : '1/1'}">${html}</div>`;
}
const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
/* ---------- tiempo (Open-Meteo) ---------- */
// nombre del sitio a partir de las coordenadas (BigDataCloud, sin clave); se guarda en el perfil para no repetirlo
async function nombreLugar(lat, lon) {
  if (E.perfil?.lat === lat && E.perfil?.lugar) return E.perfil.lugar;
  try { const d = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${idioma()}`)).json(); const n = d.city || d.locality || ''; if (n && E.perfil?.lat === lat) { E.perfil.lugar = n; await guardar(); } return n; } catch (e) { return ''; }
}
// la ubicación del móvil; solo se pide una vez si nunca se ha preguntado (tc_ubic_pedida)
function ubicacionMovil(siempre) {
  if (!navigator.geolocation) return Promise.resolve(null);
  try { if (!siempre && localStorage.getItem('tc_ubic_pedida')) return Promise.resolve(null); localStorage.setItem('tc_ubic_pedida', '1'); } catch (e) { }
  return new Promise(res => navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude, lugar: '' }), () => res(null), { timeout: 10000, maximumAge: 3600000 }));
}
async function cargarTiempo(forzar) {
  const cache = JSON.parse(localStorage.getItem('tc_tiempo') || 'null');
  if (!forzar && cache && cache.v && cache.k === 38 && 'lluviaH' in cache.v && Date.now() - cache.ts < 30 * 60000) { E.tiempo = cache.v; return E.tiempo; }
  try {
    let lat = E.perfil?.lat, lon = E.perfil?.lon, nombre = E.perfil?.ciudad || E.perfil?.lugar || '';
    // 0.38 (Sheila, 22/10: «me sale Madrid y yo estoy en Huelva»): sin ciudad ni ubicación ya no se da Madrid por hecho;
    // se pide la ubicación del móvil (una vez) y, si no la da, la aproximada por la conexión
    if (!lat && !E.perfil?.ciudad) { const g = await ubicacionMovil(); if (g) { lat = g.lat; lon = g.lon; E.perfil = Object.assign(E.perfil || {}, g); await guardar(); } }
    if (!lat && !E.perfil?.ciudad) { try { const ip = await (await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=' + idioma())).json(); if (ip.latitude) { lat = ip.latitude; lon = ip.longitude; nombre = ip.city || ip.locality || ''; } } catch (e) { } }
    if (lat && !nombre) nombre = await nombreLugar(lat, lon);
    if (!lat && E.perfil?.ciudad) { const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(E.perfil.ciudad)}&count=1&language=es`)).json(); if (g.results?.length) { lat = g.results[0].latitude; lon = g.results[0].longitude; nombre = g.results[0].name; } }
    if (!lat) { lat = 40.4168; lon = -3.7038; nombre = E.perfil?.ciudad || 'Madrid'; } // último recurso: sin red de ubicación ni ciudad encontrada
    const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=precipitation_probability&timezone=auto&forecast_days=1`)).json();
    const cod = r.current.weather_code; const txt = cod === 0 ? ['despejado', 'clear'] : cod <= 2 ? ['nubes y claros', 'partly cloudy'] : cod === 3 ? ['nublado', 'cloudy'] : cod < 50 ? ['niebla', 'fog'] : cod < 70 ? ['lluvia', 'rain'] : cod < 80 ? ['nieve', 'snow'] : cod < 90 ? ['chubascos', 'showers'] : ['tormenta', 'storm'];
    const ahora = new Date().getHours(); const probs = r.hourly?.precipitation_probability || []; let lluviaH = null; for (let h = ahora; h < Math.min(24, probs.length); h++) if (probs[h] >= 50) { lluviaH = h; break; }
    E.tiempo = { t: Math.round(r.current.temperature_2m), max: Math.round(r.daily.temperature_2m_max[0]), min: Math.round(r.daily.temperature_2m_min[0]), lluvia: r.daily.precipitation_probability_max?.[0] ?? 0, txt, nombre, cod, clave: claveTiempo(cod), lluviaH };
    localStorage.setItem('tc_tiempo', JSON.stringify({ ts: Date.now(), k: 38, v: E.tiempo }));
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

/* ---------- generador de conjuntos (Sheila, 19/10: «la función estrella»; 0.29, 21/10: «optimiza las combinaciones») ----------
   Reglas de estilista: (1) colores: neutros con todo, como mucho un color fuerte o dos que casen, nunca dos estampados;
   (2) estilo: no mezclar deportivo con noche (zapatillas con vestido de fiesta); (3) el calzado y el bolso se eligen para cada conjunto
   (neutros, del mismo tono o del color del conjunto); (4) abrigo si hace frío; (5) que salga lo que menos te pones;
   (6) en el Pro, con tu tipo de cuerpo, se ordenan primero los que te favorecen. */
const NEUTROS = new Set(['Negro', 'Blanco', 'Gris', 'Beige', 'Camel', 'Marrón', 'Azul claro', 'Azul']);
const CASAN = new Set(['Rosa|Azul claro', 'Rosa|Gris', 'Rojo|Azul', 'Rojo|Azul claro', 'Amarillo|Azul', 'Amarillo|Azul claro', 'Naranja|Azul', 'Verde|Camel', 'Verde|Beige', 'Morado|Gris', 'Rosa|Rojo', 'Verde|Azul claro', 'Rosa|Verde']);
const CHOCAN = new Set(['Rojo|Naranja', 'Rojo|Verde', 'Morado|Amarillo', 'Morado|Naranja', 'Naranja|Rosa', 'Amarillo|Rosa', 'Rojo|Morado', 'Naranja|Verde']);
const par = (a, b) => [a, b].sort().join('|');
// estilo de cada prenda: 0 deportivo, 1 diario, 2 arreglado, 3 noche
function estilo(p) {
  const n = (p.nombre || '').toLowerCase();
  if (/zapatilla|deport|sudadera|ch[aá]ndal|legging|mallas|mochila|sneaker|hoodie/.test(n)) return 0;
  if (/tac[oó]n|sat[eé]n|lentejuela|fiesta|heel|sequin/.test(n) || (p.tipo === 'Vestidos' && p.color === 'Negro')) return 3;
  if (/camisa|blusa|americana|blazer|gabardina|cartera|vestir|traje|chaleco|lazo|cruzado|shirt|blouse/.test(n) || p.tipo === 'Vestidos' || p.tipo === 'Bolsos') return 2;
  return 1;
}
const esFormal = p => estilo(p) >= 2;
const ropaDe = ps => ps.filter(p => !['Bolsos', 'Calzado', 'Accesorios'].includes(p.tipo));
const nivelRopa = ps => { const r = ropaDe(ps).map(estilo); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 1; };
// un look sirve para un plan si es de esa ocasión o, para salir de noche, si es arreglado y lleva tacones (0.41)
function sirvePara(ps, oc, plan) {
  if (oc === plan) return true;
  const zap = ps.find(p => p.tipo === 'Calzado');
  if (plan === 'Noche') return !!zap && estilo(zap) === 3 && nivelRopa(ps) >= 1.5;
  if (plan === 'Evento') return oc === 'Oficina' && !!zap && estilo(zap) === 3;
  return false;
}
function ocasionDe(ps) { // la ocasión la marca la ropa; el calzado solo la sube (tacones) o la baja (zapatillas)
  const r = ropaDe(ps).map(estilo), zap = ps.find(p => p.tipo === 'Calzado'), z = zap ? estilo(zap) : 1, m = nivelRopa(ps);
  // 0.39 (Sheila, 22/10: «no entiendo por qué sale directamente noche», un vestido azul claro de manga corta con tacones):
  // Noche solo si la ropa es de noche (satén, lentejuelas, vestido negro…); los tacones ya no la convierten en Noche:
  // un vestido de día con tacones es Evento (comida, boda de día) y unos pantalones y blusa con tacones, Oficina
  if (Math.max(...r) === 3) return 'Noche';
  if (ps.some(p => p.tipo === 'Vestidos')) return z >= 2 ? 'Evento' : 'Diario';
  if (m >= 1.5 && z >= 1) return 'Oficina';
  return 'Diario';
}
function puntuar(ps) {
  let s = 0; const col = ps.filter(p => p.tipo !== 'Bolsos' && p.tipo !== 'Calzado'), fuertes = [...new Set(col.filter(p => !NEUTROS.has(p.color) && p.color !== 'Estampado').map(p => p.color))];
  const estamp = col.filter(p => p.color === 'Estampado').length;
  // colores
  if (estamp > 1) s -= 4; else if (estamp === 1) s += fuertes.length ? -1.5 : 1.6;
  if (!fuertes.length && !estamp) s += 1;
  else if (fuertes.length === 1) s += 2.2;
  else if (fuertes.length === 2) s += CASAN.has(par(...fuertes)) ? 1.8 : CHOCAN.has(par(...fuertes)) ? -3 : -1;
  else if (fuertes.length > 2) s -= 3;
  const ar = ps.find(p => p.tipo === 'Arriba'), ab = ps.find(p => p.tipo === 'Abajo');
  if (ar && ab && ar.color === ab.color && !['Negro', 'Azul claro', 'Blanco', 'Beige'].includes(ar.color)) s -= .6;
  if (ar && ab && ar.color === 'Negro' && ab.color === 'Azul') s -= .5;           // negro con marino, solo si se busca
  // estilo: no mezclar deportivo con arreglado o noche
  const es = ps.filter(p => p.tipo !== 'Bolsos').map(estilo), salto = Math.max(...es) - Math.min(...es);
  s -= salto >= 3 ? 4 : salto === 2 ? 1.5 : 0;
  // calzado y bolso: neutros o del color del conjunto; bolso y calzado del mismo color, mejor
  const zap = ps.find(p => p.tipo === 'Calzado'), bol = ps.find(p => p.tipo === 'Bolsos');
  for (const x of [zap, bol]) if (x) s += NEUTROS.has(x.color) || fuertes.includes(x.color) ? .4 : -.8;
  if (zap) s -= 1.2 * Math.max(0, Math.abs(estilo(zap) - nivelRopa(ps)) - .5);        // zapatillas con lo informal, tacones con lo arreglado
  if (zap && bol && zap.color === bol.color) s += .3;
  // tipo de cuerpo (Pro): primero lo que favorece
  const tc = planDemo() === 'pro' && E.perfil?.tipoCuerpo, fz = p => p && (!NEUTROS.has(p.color) || p.color === 'Estampado');
  const vest = ps.some(p => p.tipo === 'Vestidos'), falda = ab && /falda|skirt/i.test(ab.nombre);
  if (tc === 'triangulo') s += (fz(ar) ? .8 : 0) - (fz(ab) ? .6 : 0) + (falda ? .3 : 0);
  if (tc === 'invertido') s += (fz(ab) ? .8 : 0) - (fz(ar) ? .6 : 0) + (falda ? .4 : 0);
  if (tc === 'reloj') s += (vest ? .7 : 0) + (falda ? .3 : 0);
  if (tc === 'rectangulo') s += (ps.some(p => p.tipo === 'Abrigo') ? .4 : 0) + (falda ? .3 : 0) + (vest ? .3 : 0);
  if (tc === 'ovalo') s += (ar && ab && ar.color === ab.color ? .8 : 0) + (vest ? .4 : 0) - (fz(ab) ? .4 : 0);
  s += puntosEstilo(ps, fuertes, estamp);
  s += puntosGusto(ps);
  // que salga lo que menos te pones
  const usos = ps.reduce((a, p) => a + (p.usos || []).length, 0) / ps.length; s += Math.max(0, 2 - usos / 4);
  return s + Math.random() * .6;
}
// 0.57 (Sheila, 23/10: «debería haber una opción para decir no me gusta o sí me gusta (que debe ser la de me lo pongo); esto permite saber más
// sobre los gustos de la usuaria»): cada pareja de prendas de un look rechazado resta y cada pareja de un look puesto suma; se guarda en el perfil
const parejas = ps => { const ids = ps.map(p => p.id).sort(), o = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) o.push(ids[i] + '|' + ids[j]); return o; };
function puntosGusto(ps) {
  const g = E.perfil?.gustos; if (!g) return 0;
  return parejas(ps).reduce((a, k) => a - 2.5 * (g.no?.[k] || 0) + .6 * Math.min(3, g.si?.[k] || 0), 0);
}
function anotarGusto(ids, clave) {
  if (!E.perfil) return; const g = E.perfil.gustos = E.perfil.gustos || { si: {}, no: {} }; g[clave] = g[clave] || {};
  parejas(ids.map(P).filter(Boolean)).forEach(k => { g[clave][k] = (g[clave][k] || 0) + 1; });
}
function mejorAcompanante(lista, base) { // calzado o bolso que mejor puntúa con la base
  let mejor = null, mp = -Infinity;
  for (const x of lista) { const v = puntuar([...base, x]) - Math.random() * .6; if (v > mp) { mp = v; mejor = x; } }
  return mejor;
}
const sinMangas = p => (p.tipo === 'Arriba' || p.tipo === 'Vestidos') && /^top\b|chaleco|tirantes|body|sin mangas|halter|crop|tank|vest\b|bodysuit/i.test(p.nombre || '');
const esCapa = p => p.tipo === 'Arriba' && /chaqueta|c[aá]rdigan|americana|blazer|cazadora|jacket|cardigan/i.test(p.nombre || '');
function generarLooks(n, plan) {
  const aptas = estacionesAptas(); const act = activas().filter(p => aptas.includes(p.estacion));
  const de = tp => act.filter(p => p.tipo === tp);
  const arriba = de('Arriba'), abajo = de('Abajo'), vestidos = de('Vestidos'), calzado = de('Calzado'), abrigos = de('Abrigo'), bolsos = de('Bolsos');
  // 0.43 (Sheila, 22/10: «demasiado descubierta para 17 grados»): con 19° o menos, lo que no tiene mangas (chaleco, top, body, tirantes)
  // pide una capa encima (abrigo, chaqueta, americana o chaqueta de punto); si no hay ninguna, ese look baja al final
  const temp = E.tiempo?.t ?? 18, frio = temp <= 14, fresco = temp <= 19;
  const capas = [...abrigos, ...arriba.filter(esCapa)];
  const bases = [...vestidos.map(v => [v]), ...arriba.filter(a => !esCapa(a)).flatMap(a => abajo.map(b => [a, b]))];
  const cands = bases.map(base => {
    let ps = [...base]; const desc = fresco && base.some(sinMangas);
    const ab = frio || desc ? mejorAcompanante(capas.filter(c => !base.includes(c)), ps) : null; if (ab) ps.push(ab);
    const zap = mejorAcompanante(calzado, ps); if (zap) ps.push(zap);
    const bol = ocasionDe(ps) !== 'Deporte' ? mejorAcompanante(bolsos, ps) : null; if (bol) ps.push(bol);
    return { ps, puntos: puntuar(ps) - (desc && !ab ? 3 : 0) };
  }).sort((a, b) => b.puntos - a.puntos);
  const vistos = new Set(), usados = new Map(), out = [];
  for (const c of cands) {
    if (c.puntos < -1.5 && out.length) break;                                      // mejor menos ideas que ideas malas
    const clave = c.ps.map(p => p.id).sort().join(); if (vistos.has(clave)) continue;
    const prin = c.ps[0]; if ((usados.get(prin.id) || 0) >= 2) continue;       // variedad: la misma prenda principal, como mucho dos veces
    const oc = ocasionDe(c.ps); if (plan && plan !== 'Todos' && !sirvePara(c.ps, oc, plan)) continue;
    vistos.add(clave); usados.set(prin.id, (usados.get(prin.id) || 0) + 1);
    out.push({ ids: c.ps.map(p => p.id), ocasion: oc, nombre: `${ocNombre(oc)} ${t('con', 'with')} ${prin.nombre.charAt(0).toLowerCase() + prin.nombre.slice(1)}` });
    if (out.length >= n) break;
  }
  return out;
}

/* ---------- navegación ---------- */
const SIN_TABS = ['inicio', 'alta', 'entrar', 'planes', 'silueta', 'cuerpo', 'estilo', 'anadir', 'nuevo-look', 'subir'];
function ir(nombre, datos) {
  if (nombre === 'inicio' && !$('intro')) $('p-inicio').classList.add('aparece');
  if (nombre === 'anadir') prepararAnadir(datos);
  if (nombre === 'subir' && !datos) prepararSubir();
  if (nombre === 'nuevo-look') prepararNuevoLook(datos);
  if (nombre === 'hoy') pintarHoy();
  if (nombre === 'cuerpo') pintarCuerpo();
  if (nombre === 'estilo') pintarEstilo();
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
  const dia = E.agenda[diaISO(new Date())]; if (dia?.look?.length && dia.look.every(P)) props.unshift({ tipo: 'agenda', ids: dia.look, ocasion: dia.planes?.[0]?.oc });
  for (const g of generarLooks(4, E.plan)) if (!props.some(x => x.ids.join() === g.ids.join())) props.push({ tipo: 'propuesta', ids: g.ids, nombre: g.nombre, ocasion: g.ocasion });
  // «No me gusta»: un look propuesto no vuelve; uno guardado por ella o el del calendario solo se aparta por hoy
  const g = E.perfil?.gustos, clave = ids => [...ids].sort().join();
  const fuera = x => x.tipo !== 'agenda' && (g?.fuera?.includes(clave(x.ids)) || (g?.hoy?.d === hoyISO() && g.hoy.k.includes(clave(x.ids))));
  E.propuestas = props.filter(x => !fuera(x)); if (E.hoyIdx >= E.propuestas.length) E.hoyIdx = 0;
}
// 0.42 (Sheila, 22/10: «si no lo hace la usuaria, la asistente virtual le debe preguntar a dónde vamos hoy y sugerirle»):
// sin plan en el calendario para hoy, Hoy pregunta «¿A dónde vas hoy?»; la respuesta se guarda como plan del día y los looks se rehacen
function preguntaHoy(planHoy) {
  if (planHoy) return `<button class="hz-plan" data-hzpreg>${t('Hoy', 'Today')}: ${ocNombre(planHoy).toLowerCase()}</button>${E.hzPreg ? opcionesHoy(planHoy) : ''}`;
  return `<button class="hz-preg" data-hzpreg>${t('¿A dónde vas hoy?', 'Where are you going today?')}</button>${E.hzPreg ? opcionesHoy() : ''}`;
}
const opcionesHoy = sel => `<div class="hz-ops">${OCASIONES.map(o => `<button class="${o === sel ? 'on' : ''}" data-hzoc="${o}">${ocNombre(o)}</button>`).join('')}</div>`;
document.addEventListener('click', async e => {
  const b = e.target.closest('#p-hoy [data-hzpreg],#p-hoy [data-hzoc]'); if (!b) return;
  if (b.dataset.hzoc) {
    const k = diaISO(new Date()), h = new Date().getHours(), fr = h < 14 ? 'Mañana' : h < 20 ? 'Tarde' : 'Noche';
    E.agenda[k] = E.agenda[k] || { planes: [] }; E.agenda[k].planes = [{ oc: b.dataset.hzoc, fr }, ...E.agenda[k].planes.filter(p => p.oc !== b.dataset.hzoc)];
    E.hzPreg = false; E.propuestas = []; E.hoyIdx = 0; await guardar();
  } else E.hzPreg = !E.hzPreg;
  pintarHoy();
});
function pintarHoy() { // 0.8 · cerrada por Gabriela el 20/10: centrada, sin menú arriba, el tiempo una vez junto a la fecha, debajo solo la ocasión
  const pant = $('p-hoy'); const w = E.tiempo; const l = idioma();
  // 0.40 (Sheila, 22/10: «si ella pone de lunes 23 a viernes 27 oficina en la mañana ya sabes que eso tienes que sugerirle»): el plan del calendario manda
  const planHoy = E.agenda[diaISO(new Date())]?.planes?.[0]?.oc;
  if (!E.propuestas.length) { E.plan = planHoy || 'Todos'; proponer(); if (!E.propuestas.length && E.plan !== 'Todos') { E.plan = 'Todos'; proponer(); } }
  const lista = E.propuestas; const pr = lista[E.hoyIdx];
  const hoyD = new Date(); const dia = cap(hoyD.toLocaleDateString(l === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric' }));
  const ico = k => ICO_T[k] || ICO_T.nube;
  const cieloAhora = w ? (w.clave === 'solnube' ? 'sol' : ['lluvia', 'tormenta'].includes(w.clave) ? 'nube' : w.clave) : null; // el icono del cielo: sol si hay sol, aunque haga frío
  const avisoLluvia = !w ? '' : ['lluvia', 'tormenta'].includes(w.clave) ? ` · ${ico('lluvia')}${t('ahora', 'now')}` : w.lluviaH != null ? ` · ${ico('lluvia')}${w.lluviaH}:00` : '';
  const cab = `<header class="hz-cab"><span class="marca"><svg viewBox="0 0 100 100"><use href="#i129"/></svg><span>Tu<span class="oro">Closet</span></span></span>
    <div class="hz-dia mini-et">${dia}${w ? `${ico(cieloAhora)}${w.t}°${avisoLluvia}` : ''}</div>${preguntaHoy(planHoy)}</header>`;
  if (!pr) {
    const hay = activas().length;
    const rechazos = E.perfil?.gustos?.fuera?.length || (E.perfil?.gustos?.hoy?.d === hoyISO() && E.perfil.gustos.hoy.k.length);
    pant.innerHTML = cab + `<div class="hz-vacio">${hay && rechazos ? t('Por hoy no me quedan combinaciones nuevas con tu ropa. Sube más prendas y te propongo otras.', 'No new combinations left for today. Upload more garments and I’ll suggest others.') : hay ? t('Me falta una parte de arriba y una de abajo, o un vestido, para este tiempo.', 'I need a top and a bottom, or a dress, for this weather.') : t('Tu conjunto de hoy aparecerá aquí en cuanto tengas tres prendas: una de arriba, una de abajo y unos zapatos.', 'Your outfit of the day will appear here once you have three garments: a top, a bottom and shoes.')}
      <button class="hz-bt" data-ir="subir">${t('Subir mis prendas', 'Upload my garments')}</button>${hay || PUBLICA ? '' : `<button class="hz-bt" id="hoy-ejemplo" style="border:0;margin-top:4px">${t('Ver un ejemplo', 'See an example')}</button>`}</div>`;
    const ej = $('hoy-ejemplo'); if (ej) ej.onclick = cargarEjemplo;
    return;
  }
  const ps = pr.ids.map(P).filter(Boolean); const c = pr.c;
  const avatar = planDemo() === 'pro' ? c?.img : null;
  const figura = avatar ? `<img src="${avatar}" alt="${t('Tú con el conjunto', 'You wearing the outfit')}">` : maniqui(ps);
  const oc = (c && c.ocasion) || pr.ocasion || ocasionDe(ps);
  const flechas = lista.length > 1 ? `<div class="hz-flechas"><button id="hoy-ant" aria-label="${t('Anterior', 'Previous')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><button id="hoy-sig" aria-label="${t('Otro', 'Next')}"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div>` : '';
  pant.innerHTML = cab + `<div class="hz-escena"><div class="hz-fig">${figura}</div>${flechas}<div class="hz-pie"><div class="hz-oc mini-et">${ocNombre(oc)}</div><button class="hz-bt" id="hoy-pongo">${t('Me lo pongo', 'I’ll wear it')}</button><button class="hz-no" id="hoy-no">${t('No me gusta', 'Not for me')}</button></div></div>`;
  if ($('hoy-sig')) $('hoy-sig').onclick = () => { E.hoyIdx = (E.hoyIdx + 1) % lista.length; pintarHoy(); };
  if ($('hoy-ant')) $('hoy-ant').onclick = () => { E.hoyIdx = (E.hoyIdx + lista.length - 1) % lista.length; pintarHoy(); };
  $('hoy-pongo').onclick = async () => { await ponerse(pr.ids, c); };
  $('hoy-no').onclick = async () => {
    anotarGusto(pr.ids, 'no'); const g = E.perfil.gustos, k = [...pr.ids].sort().join();
    if (pr.tipo === 'propuesta') g.fuera = [...(g.fuera || []), k].slice(-300);
    else { if (g.hoy?.d !== hoyISO()) g.hoy = { d: hoyISO(), k: [] }; g.hoy.k.push(k); }
    await guardar();
    lista.splice(E.hoyIdx, 1); if (E.hoyIdx >= lista.length) E.hoyIdx = 0;
    if (!lista.length) { E.propuestas = []; E.hoyIdx = 0; }
    pintarHoy(); toast(t('Anotado. Te propondré otras combinaciones', 'Noted. I’ll suggest other combinations'));
  };
}
async function ponerse(ids, conj) {
  const d = hoyISO(); let n = 0; anotarGusto(ids, 'si');
  ids.forEach(id => { const p = P(id); if (!p) return; p.usos = p.usos || []; if (!p.usos.includes(d)) { p.usos.push(d); n++; } });
  if (conj) { conj.usos = conj.usos || []; if (!conj.usos.includes(d)) conj.usos.push(d); }
  else if (ids.length >= 2 && !E.conjuntos.some(c => c.ids.join() === ids.join())) { E.conjuntos.unshift({ id: uid(), nombre: t('Hoy', 'Today') + ' ' + fecha(d, true), ocasion: ocasionDe(ids.map(P).filter(Boolean)), ids, creada: d, usos: [d] }); }
  await guardar(); toast(n ? t(`Apuntado: ${n} prendas puestas hoy`, `Noted: ${n} garments worn today`) : t('Ya lo tenías apuntado hoy', 'Already noted today'));
}

/* ---------- CALENDARIO (0.40, 22/10; Sheila: «que la consumidora pueda ir guardando qué tiene cada día si quiere»; «si pone de lunes 23 a viernes 27
   oficina en la mañana ya sabes que eso tienes que sugerirle»). Cada día: sus planes (ocasión y franja), el look elegido para ese día y, en los días
   pasados, lo que se puso (sale de los «Me lo pongo», que se guardan con fecha). E.agenda = { 'aaaa-mm-dd': { planes: [{ oc, fr }], look: [ids] } } ---------- */
const diaISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const FRANJAS = [['Mañana', 'Morning'], ['Tarde', 'Afternoon'], ['Noche', 'Evening']];
E.cal = { mes: null, dia: null, oc: 'Oficina', fr: 'Mañana', idea: 0 };
function pintarCalendario(raiz) {
  const en = idioma() === 'en', loc = en ? 'en-GB' : 'es-ES', hoy = diaISO(new Date());
  if (!E.cal.dia) E.cal.dia = hoy;
  const sel = new Date(E.cal.dia + 'T12:00'); if (!E.cal.mes) E.cal.mes = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const m = E.cal.mes, pri = (m.getDay() + 6) % 7, dias = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const puesto = d => E.prendas.filter(p => (p.usos || []).includes(d));
  let celdas = ''; for (let i = 0; i < pri; i++) celdas += '<i></i>';
  for (let n = 1; n <= dias; n++) {
    const d = diaISO(new Date(m.getFullYear(), m.getMonth(), n)), a = E.agenda[d], pl = a?.planes?.[0];
    const marca = a?.look?.length || puesto(d).length;
    celdas += `<button class="${d === E.cal.dia ? 'on' : ''}${d === hoy ? ' hoy' : ''}${d < hoy ? ' pasado' : ''}" data-cdia="${d}"><b>${n}</b>${pl ? `<small>${ocNombre(pl.oc)}</small>` : ''}${marca ? '<em></em>' : ''}</button>`;
  }
  const sem = (en ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D']).map(x => `<span>${x}</span>`).join('');
  const a = E.agenda[E.cal.dia] || {}, planes = a.planes || [], futuro = E.cal.dia >= hoy, ps = puesto(E.cal.dia);
  const ocs = OCASIONES.map(o => `<button class="${o === E.cal.oc ? 'on' : ''}" data-coc="${o}">${ocNombre(o)}</button>`).join('');
  const frs = FRANJAS.map(([es, i]) => `<button class="${es === E.cal.fr ? 'on' : ''}" data-cfr="${es}">${en ? i : es}</button>`).join('');
  let look = '';
  if (a.look?.length && a.look.every(P)) look = `<div class="cal-look"><p class="mini-et">${t('Tu look para este día', 'Your look for this day')}</p><div class="lk-fig">${figLook({ ids: a.look }, true)}</div><button class="txt sub-l" data-cquitalook>${t('Quitar el look', 'Remove the look')}</button></div>`;
  else if (futuro) {
    // 0.41 (Sheila, 22/10: «no algo para la noche»): si el clóset no tiene nada de esa ocasión, se dice y se enseña lo más cercano
    // (para Noche y Evento, lo más arreglado; para Deporte y Diario, lo más cómodo), en vez de sugerir un look cualquiera
    // 0.60 (Sheila, 23/10: «por qué me sugieres esto para un evento por la noche… no es elegante»): la idea sigue la ocasión que acaba de marcar,
    // aunque aún no haya guardado el plan; antes, sin plan guardado, salía una idea cualquiera
    const oc = planes[0]?.oc || (E.cal.ocSel ? E.cal.oc : 'Todos'); let ideas = generarLooks(6, oc), falta = false;
    if (!ideas.length) { falta = oc !== 'Todos'; const sube = ['Noche', 'Evento', 'Oficina'].includes(oc) ? 1 : -1, nv = l => { const ps = l.ids.map(P).filter(Boolean), z = ps.find(p => p.tipo === 'Calzado'); return nivelRopa(ps) + (z ? estilo(z) : 1) * .5; }; ideas = generarLooks(12, 'Todos').sort((x, y) => sube * (nv(y) - nv(x))).slice(0, 6); }
    const g = ideas[E.cal.idea % Math.max(1, ideas.length)];
    look = g ? `<div class="cal-look">${falta ? `<p class="cal-falta">${t(`Aún no tienes nada de ${ocNombre(oc).toLowerCase()} en tu clóset. Te enseño lo que más se acerca; si subes algo de ${ocNombre(oc).toLowerCase()}, te lo propondré.`, `You have nothing for ${ocNombre(oc).toLowerCase()} in your closet yet. Here is the closest; upload something for ${ocNombre(oc).toLowerCase()} and I will suggest it.`)}</p>` : ''}<p class="mini-et">${falta ? t('Lo más cercano', 'The closest') : oc !== 'Todos' ? t(`Te sugiero para ${ocNombre(oc).toLowerCase()}`, `My pick for ${ocNombre(oc).toLowerCase()}`) : t('Una idea para este día', 'An idea for this day')}</p><div class="lk-fig">${figLook(g, true)}</div><div class="cal-bts"><button class="hz-bt" data-cguarda="${g.ids.join(',')}">${t('Guardar para este día', 'Save for this day')}</button><button class="txt sub-l" data-cotra>${t('Otra idea', 'Another idea')}</button></div></div>` : '';
  }
  const pasado = ps.length ? `<div class="cal-look"><p class="mini-et">${t('Te pusiste', 'You wore')}</p><div class="lk-fig">${maniqui(ps, true)}</div></div>`
    : !futuro && E.conjuntos.length ? `<div class="cal-look"><p class="mini-et">${t('Apunta lo que te pusiste', 'Note what you wore')}</p><div class="cal-mios">${E.conjuntos.slice(0, 12).map(c => `<button data-cpuse="${c.id}"><div class="lk-fig">${maniqui(c.ids.map(P).filter(Boolean), true)}</div></button>`).join('')}</div></div>` : '';
  raiz.innerHTML = `<div class="mc-cab lk-cab"><h1>${t('Looks', 'Looks')}</h1><button class="lk-mas" data-ir="nuevo-look" aria-label="${t('Crear un look', 'Create a look')}"><svg viewBox="0 0 20 20"><path d="M10 3v14M3 10h14"/></svg></button></div>
    <div class="mc-cats lk-tabs"><button data-lktab="mios">${t('Mis looks', 'My looks')}</button><button data-lktab="ideas">${t('Ideas para hoy', 'Ideas for today')}</button><button class="activo" data-lktab="cal">${t('Calendario', 'Calendar')}</button></div>
    <div class="cal"><div class="cal-mes"><button data-cmes="-1" aria-label="${t('Mes anterior', 'Previous month')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><h2>${cap(m.toLocaleDateString(loc, { month: 'long', year: 'numeric' }))}</h2><button data-cmes="1" aria-label="${t('Mes siguiente', 'Next month')}"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div>
    <div class="cal-sem">${sem}</div><div class="cal-rej">${celdas}</div>
    <div class="cal-dia"><h3>${cap(sel.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
      ${planes.length ? `<ul class="cal-planes">${planes.map((p, i) => `<li><span>${ocNombre(p.oc)}</span><small>${en ? (FRANJAS.find(f => f[0] === p.fr) || [p.fr, p.fr])[1] : p.fr}</small><button data-cquita="${i}" aria-label="${t('Quitar', 'Remove')}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></li>`).join('')}</ul>` : `<p class="cal-vacio">${futuro ? t('¿Qué tienes este día? Apúntalo y te sugiero qué ponerte.', 'What do you have on this day? Note it and I’ll suggest what to wear.') : t('Sin planes apuntados.', 'No plans noted.')}</p>`}
      ${futuro && (E.cal.add || !planes.length) ? `<div class="cal-add"><p class="mini-et">${t('Añadir un plan', 'Add a plan')}</p><div class="cal-ops">${ocs}</div><div class="cal-ops fr">${frs}</div><label class="cal-hasta">${t('Repetir hasta el', 'Repeat until')} <input type="date" id="cal-hasta" min="${E.cal.dia}"></label><button class="boton" data-cadd>${t('Guardar el plan', 'Save the plan')}</button></div>` : futuro ? `<button class="txt sub-l cal-otro" data-cmas>${t('Añadir otro plan', 'Add another plan')}</button>` : ''}
      ${look}${pasado}</div></div>`;
  raiz.onclick = async e => {
    const b = e.target.closest('[data-lktab],[data-cmas],[data-cdia],[data-cmes],[data-coc],[data-cfr],[data-cadd],[data-cquita],[data-cguarda],[data-cotra],[data-cquitalook],[data-cpuse]'); if (!b) return;
    const d = b.dataset, ag = () => (E.agenda[E.cal.dia] = E.agenda[E.cal.dia] || { planes: [] });
    if (d.lktab) { E.lkTab = d.lktab; E.lkI = 0; return pintarLooks(); }
    if (d.cmas !== undefined) E.cal.add = true;
    else if (d.cdia) { E.cal.dia = d.cdia; E.cal.idea = 0; E.cal.add = false; E.cal.ocSel = false; }
    else if (d.cmes) E.cal.mes = new Date(E.cal.mes.getFullYear(), E.cal.mes.getMonth() + +d.cmes, 1);
    else if (d.coc) { E.cal.oc = d.coc; E.cal.ocSel = true; E.cal.idea = 0; e.preventDefault(); }
    else if (d.cfr) { E.cal.fr = d.cfr; e.preventDefault(); }
    else if (d.cadd !== undefined) {
      const hasta = $('cal-hasta').value || E.cal.dia; let n = 0;
      for (let x = new Date(E.cal.dia + 'T12:00'); diaISO(x) <= hasta && n < 366; x.setDate(x.getDate() + 1), n++) {
        const k = diaISO(x); if (hasta !== E.cal.dia && [0, 6].includes(x.getDay()) && E.cal.oc === 'Oficina') continue; // la oficina se repite de lunes a viernes
        const a2 = E.agenda[k] = E.agenda[k] || { planes: [] }; if (!a2.planes.some(p => p.oc === E.cal.oc && p.fr === E.cal.fr)) a2.planes.push({ oc: E.cal.oc, fr: E.cal.fr });
      }
      E.cal.add = false; await guardar(); E.propuestas = []; toast(hasta === E.cal.dia ? t('Plan guardado', 'Plan saved') : t('Plan guardado en varios días', 'Plan saved on several days'));
    }
    else if (d.cquita) { ag().planes.splice(+d.cquita, 1); await guardar(); E.propuestas = []; }
    else if (d.cguarda) { ag().look = d.cguarda.split(','); await guardar(); E.propuestas = []; toast(t('Look guardado para ese día', 'Look saved for that day')); }
    else if (d.cotra !== undefined) E.cal.idea++;
    else if (d.cquitalook !== undefined) { delete ag().look; await guardar(); E.propuestas = []; }
    else if (d.cpuse) { const c = E.conjuntos.find(x => x.id === d.cpuse); if (c) { c.ids.forEach(id => { const p = P(id); if (p) { p.usos = p.usos || []; if (!p.usos.includes(E.cal.dia)) p.usos.push(E.cal.dia); } }); c.usos = c.usos || []; if (!c.usos.includes(E.cal.dia)) c.usos.push(E.cal.dia); await guardar(); toast(t('Apuntado', 'Noted')); } }
    pintarCalendario(raiz);
  };
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
// 0.44 (Sheila, 22/10: el filtro «Oficina» daba 0 prendas): la ocasión salía solo de los looks guardados; ahora cada prenda tiene
// también las suyas por su nivel (deportivo, diario, arreglado, noche); el bolso y los accesorios valen para todo menos deporte
function ocasionesPrenda(p) {
  if (['Bolsos', 'Accesorios'].includes(p.tipo)) return ['Diario', 'Oficina', 'Noche', 'Evento', 'Viaje'];
  if (p.tipo === 'Calzado' && estilo(p) === 3) return ['Noche', 'Evento', 'Oficina'];
  return [['Deporte', 'Diario', 'Viaje'], ['Diario', 'Viaje', 'Oficina'], ['Oficina', 'Evento', 'Diario', 'Noche'], ['Noche', 'Evento']][estilo(p)];
}
function pasaFiltros(p) {
  const f = E.f, hace3 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), u = p.usos || [];
  const ocs = [...ocasionesPrenda(p), ...E.conjuntos.filter(c => c.ids.includes(p.id)).map(c => c.ocasion || 'Diario')];
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
    : `<button class="${E.f[k].includes(v) ? 'on' : ''}" data-fil="${k}|${v}">${txt}</button>`).join('')}</div>${k === 'ocasion' ? `<small>${t('según el tipo de prenda y tus looks', 'from the garment type and your looks')}</small>` : ''}</div>`).join('');
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
  const al = new Uint8ClampedArray(S * S); for (let p = 0; p < S * S; p++) { const a = (m[p] - lo) / ((hi - lo) || 1); al[p] = Math.round(Math.max(0, Math.min(1, (a - .2) / .6)) * 255); }
  piezaMayor(al, S, S); for (let p = 0; p < S * S; p++) md.data[p * 4 + 3] = al[p];
  mxc.putImageData(md, 0, 0); return mc;
}
// 0.56 (Sheila, 22/10: «no me toma bien las prendas»): se queda solo con la pieza más grande de la máscara y un borde de 2 px;
// quita las manchas sueltas de sábana, pared o lámpara que el modelo deja alrededor
function piezaMayor(a, W, H) {
  const et = new Int32Array(W * H), pila = []; let n = 0, mejor = 0, tam = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 128 || et[i]) continue; n++; let t = 0; pila.push(i); et[i] = n;
    while (pila.length) { const j = pila.pop(); t++; const x = j % W; for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) if (k >= 0 && k < a.length && !et[k] && a[k] >= 128) { et[k] = n; pila.push(k); } }
    if (t > tam) { tam = t; mejor = n; }
  }
  if (!mejor) return;
  let cerca = new Uint8Array(W * H); for (let i = 0; i < a.length; i++) cerca[i] = et[i] === mejor ? 1 : 0;
  for (let r = 0; r < 2; r++) { const c2 = cerca.slice(); for (let i = 0; i < a.length; i++) if (!cerca[i]) { const x = i % W; if ((x > 0 && cerca[i - 1]) || (x < W - 1 && cerca[i + 1]) || cerca[i - W] || cerca[i + W]) c2[i] = 1; } cerca = c2; }
  for (let i = 0; i < a.length; i++) if (!cerca[i]) a[i] = 0;
}
// 0.56: si la foto ya llega sin fondo (en el iPhone, «Levantar el sujeto» en Fotos y guardar; en Android, «Recortar»), se usa su transparencia tal cual
function yaSinFondo(img) {
  const S = 120, c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, S, S); const d = x.getImageData(0, 0, S, S).data; let tr = 0;
  for (let k = 3; k < d.length; k += 4) if (d[k] < 20) tr++;
  return tr > S * S * .05;
}
// reconocimiento de prendas (0.29, Sheila: «entrena reconocimiento de prendas»): MobileCLIP-S0 en el propio móvil (45 MB, se descarga una vez)
// compara la foto con 48 descripciones de prendas calculadas antes (modelos/ropa-textos.json); con las 24 fotos de Sheila acierta 23
let SES_ROPA = null, TXT_ROPA = null;
async function reconocerPrenda(cv) {
  if (!SES_ROPA) { await modeloRecorte(); [SES_ROPA, TXT_ROPA] = await Promise.all([ort.InferenceSession.create('modelos/ropa-mobileclip-s0.onnx', { executionProviders: ['wasm'] }), fetch('modelos/ropa-textos.json').then(r => r.json())]); }
  const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); const e = Math.min(S / cv.width, S / cv.height); x.drawImage(cv, (S - cv.width * e) / 2, (S - cv.height * e) / 2, cv.width * e, cv.height * e);
  const d = x.getImageData(0, 0, S, S).data, ent = new Float32Array(3 * S * S);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) for (let ch = 0; ch < 3; ch++) ent[ch * S * S + p] = d[i + ch] / 255;
  const sal = await SES_ROPA.run({ [SES_ROPA.inputNames[0]]: new ort.Tensor('float32', ent, [1, 3, S, S]) });
  const v = sal[SES_ROPA.outputNames[0]].data; let n = 0; for (const a of v) n += a * a; n = Math.sqrt(n);
  const pc = {}, px = {}; for (const p of TXT_ROPA.prompts) { let s = 0; for (let i = 0; i < p.e.length; i++) s += p.e[i] * v[i]; s /= n; if (!(s <= pc[p.cat])) { pc[p.cat] = s; px[p.cat] = p.x; } }
  // 0.37 (Sheila, 22/10: una captura de Vinted entró como top): «NoPrenda» son 13 descripciones de lo que no es ropa (capturas, textos, caras, paisajes…)
  const no = pc.NoPrenda ?? -1; delete pc.NoPrenda;
  const [cat, sc] = Object.entries(pc).sort((a, b) => b[1] - a[1])[0]; return { cat, x: px[cat], noPrenda: no > sc - .005 };
}
// 0.30 (Sheila, 21/10: su falda salía como top y una sandalia como pantalón): las prendas subidas antes del reconocimiento se revisan solas una vez;
// cambia el tipo y, si el nombre era el automático, también el nombre. Lo que ella haya escrito a mano no se toca.
const NOMBRE_AUTO = { test: n => /^(Tops|Arriba|Abajo|Calzado)$/.test(n) || ['Top', 'Pantalón', 'Zapatos', 'Vestido', 'Abrigo', 'Bolso', 'Accesorio', 'Falda', ...Object.values(NOM_X).map(v => v[0])].some(b => n === b || (n.startsWith(b + ' ') && /^[a-zéóíáú ]+$/.test(n.slice(b.length + 1)))) };
async function reconocerGuardadas() {
  // 0.46 (Sheila, 22/10: un top peplum salió como vestido y Hoy lo proponía sin pantalón): los vestidos ya guardados se revisan una vez más con las descripciones nuevas
  const pend = E.prendas.filter(p => ((p.rec || 0) < 2 || (p.tipo === 'Vestidos' && (p.rec || 0) < 3)) && !p.src && p.foto); if (!pend.length) return;
  let cambios = 0;
  for (const p of pend) {
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = urlFoto(p); });
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
      const { cat, x } = await reconocerPrenda(c), tipo = TIPO_DE_CAT[cat];
      const nom = NOMBRE_AUTO.test(p.nombre) ? (nombreReconocido(x, p.color) || nombreSubida(Object.assign({}, p, { tipo }), cat)) : p.nombre;
      if (tipo !== p.tipo || nom !== p.nombre) { if (tipo !== p.tipo) cambios++; p.tipo = tipo; p.nombre = nom; }
      p.rec = 3;
    } catch (e) { return; } // sin red o sin modelo: se reintenta en la próxima apertura
  }
  await guardar();
  if (cambios) { E.propuestas = []; E.generados = []; if (E.pantalla === 'hoy') pintarHoy(); toast(t(`He revisado tus prendas: ${cambios} con el tipo corregido`, `I checked your garments: ${cambios} type${cambios > 1 ? 's' : ''} fixed`)); }
}
// 0.37 (Sheila, 22/10: «o al menos un mensaje de alerta al cliente que lo debe hacer en un fondo uniforme»): desviación media de color
// en una franja del 5 % alrededor de la foto; un fondo liso da menos de 20; las fotos de Sheila sobre pared, lámpara y sofá, de 33 a 66
function fondoIrregular(cv) {
  const S = 200, b = 10, c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(cv, 0, 0, S, S); const d = x.getImageData(0, 0, S, S).data, px = [];
  for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) if (i < b || y < b || i >= S - b || y >= S - b) { const k = (y * S + i) * 4; px.push([d[k], d[k + 1], d[k + 2]]); }
  const m = [0, 1, 2].map(ch => px.reduce((a, p) => a + p[ch], 0) / px.length);
  return px.reduce((a, p) => a + Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]), 0) / px.length > 28;
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
      if (yaSinFondo(img)) cx.drawImage(img, 0, 0, w, h);
      else { const masc = await mascaraU2(img); cx.drawImage(img, 0, 0, w, h); cx.globalCompositeOperation = 'destination-in'; cx.drawImage(masc, 0, 0, w, h); cx.globalCompositeOperation = 'source-over'; }
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
    let tipo = prop < .75 ? 'Calzado' : prop < 1.55 ? 'Arriba' : 'Abajo', cat = null;
    const W = 900, H = 1200, out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d');
    o.fillStyle = '#fff'; o.fillRect(0, 0, W, H); const e = Math.min(W * .84 / bw, H * .84 / bh), dw = bw * e, dh = bh * e;
    o.drawImage(capa, x0, y0, bw, bh, (W - dw) / 2, (H - dh) / 2, dw, dh);
    let x = null, noPrenda = false; try { ({ cat, x } = await reconocerPrenda(out)); tipo = TIPO_DE_CAT[cat]; noPrenda = (await reconocerPrenda(orig)).noPrenda; } catch (e) { /* sin modelo: por la forma */ }
    const fondo = fondoIrregular(orig);
    const aBlob = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    return { blob: await aBlob(out, .88), original: await aBlob(orig, .86), color, tipo, cat, x, rec: cat ? 1 : 0, recortada, noPrenda, fondo };
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
// 0.31: nombre concreto según lo reconocido («Zapatillas blancas», «Blusa rosa», «Vaqueros»); de él salen también el estilo y la ocasión
const NOM_X = { 'a t-shirt': ['Camiseta', 'T-shirt', 'f'], 'a blouse': ['Blusa', 'Blouse', 'f'], 'a crop top': ['Top corto', 'Crop top', 'm'], 'a shirt': ['Camisa', 'Shirt', 'f'], 'a knitted vest': ['Chaleco', 'Vest', 'm'], 'a sweater': ['Jersey', 'Sweater', 'm'], 'a halter bodysuit': ['Body', 'Bodysuit', 'm'], 'a tank top': ['Top', 'Tank top', 'm'], 'a cardigan': ['Chaqueta de punto', 'Cardigan', 'f'], 'a peplum top': ['Top peplum', 'Peplum top', 'm'], 'a sleeveless top': ['Top sin mangas', 'Sleeveless top', 'm'],
  trousers: ['Pantalón', 'Trousers', 'm'], jeans: ['Vaqueros', 'Jeans', 'm', 1], 'wide leg pants': ['Pantalón ancho', 'Wide-leg trousers', 'm'], shorts: ['Shorts', 'Shorts', 'm', 1], leggings: ['Mallas', 'Leggings', 'f', 1],
  'a skirt': ['Falda', 'Skirt', 'f'], 'a mini skirt': ['Minifalda', 'Mini skirt', 'f'], 'a long skirt': ['Falda larga', 'Long skirt', 'f'], 'a pleated skirt': ['Falda plisada', 'Pleated skirt', 'f'], 'a lace skirt': ['Falda de encaje', 'Lace skirt', 'f'], 'a flared skirt': ['Falda de vuelo', 'Flared skirt', 'f'],
  'a dress': ['Vestido', 'Dress', 'm'], 'a wrap dress': ['Vestido cruzado', 'Wrap dress', 'm'], 'a long dress': ['Vestido largo', 'Long dress', 'm'],
  'a coat': ['Abrigo', 'Coat', 'm'], 'a jacket': ['Chaqueta', 'Jacket', 'f'], 'a blazer': ['Americana', 'Blazer', 'f'], 'a trench coat': ['Gabardina', 'Trench coat', 'f'], 'a puffer jacket': ['Plumífero', 'Puffer jacket', 'm'],
  'a pair of shoes': ['Zapatos', 'Shoes', 'm', 1], 'a pair of sneakers': ['Zapatillas', 'Sneakers', 'f', 1], 'a pair of high heels': ['Tacones', 'Heels', 'm', 1], 'a pair of boots': ['Botas', 'Boots', 'f', 1], 'a pair of sandals': ['Sandalias', 'Sandals', 'f', 1], 'a pair of ballet flats': ['Bailarinas', 'Flats', 'f', 1], 'a pair of stiletto heels': ['Tacones', 'Heels', 'm', 1], 'a pair of pointed toe pumps': ['Tacones', 'Heels', 'm', 1],
  'a handbag': ['Bolso', 'Bag', 'm'], 'a shoulder bag': ['Bolso de hombro', 'Shoulder bag', 'm'], 'a tote bag': ['Bolso tote', 'Tote bag', 'm'], 'a clutch bag': ['Cartera de mano', 'Clutch', 'f'], 'a backpack': ['Mochila', 'Backpack', 'f'],
  'a polo shirt': ['Polo', 'Polo shirt', 'm'], 'a hoodie': ['Sudadera', 'Hoodie', 'f'], 'a midi skirt': ['Falda midi', 'Midi skirt', 'f'], 'a mini dress': ['Vestido corto', 'Mini dress', 'm'], 'a midi dress': ['Vestido midi', 'Midi dress', 'm'], 'a jumpsuit': ['Mono', 'Jumpsuit', 'm'],
  'a parka': ['Parka', 'Parka', 'f'], 'a denim jacket': ['Cazadora vaquera', 'Denim jacket', 'f'], 'a bomber jacket': ['Bomber', 'Bomber jacket', 'f'], 'a pair of ankle boots': ['Botines', 'Ankle boots', 'm', 1], 'a pair of knee high boots': ['Botas altas', 'Knee-high boots', 'f', 1], 'a pair of loafers': ['Mocasines', 'Loafers', 'm', 1],
  'a crossbody bag': ['Bandolera', 'Crossbody bag', 'f'], 'a cap': ['Gorra', 'Cap', 'f'], 'a bracelet': ['Pulsera', 'Bracelet', 'f'], gloves: ['Guantes', 'Gloves', 'm', 1],
  'a hat': ['Sombrero', 'Hat', 'm'], 'a scarf': ['Pañuelo', 'Scarf', 'm'], 'a belt': ['Cinturón', 'Belt', 'm'], sunglasses: ['Gafas de sol', 'Sunglasses', 'f', 1], 'a necklace': ['Collar', 'Necklace', 'm'], earrings: ['Pendientes', 'Earrings', 'm', 1], 'a watch': ['Reloj', 'Watch', 'm'] };
// 0.58 (Sheila, 23/10: «para hacerlo manualmente tienes que dejar un menú desplegable de categoría… apóyate en el menú de clasificación de las app de ropa o de Vinted»):
// dos desplegables, categoría y tipo, como en Vinted; el tipo pone el nombre («Botas negras») y de él salen el estilo y la ocasión
const SUBCATS = {
  Tops: ['a t-shirt', 'a blouse', 'a shirt', 'a polo shirt', 'a crop top', 'a tank top', 'a sleeveless top', 'a halter bodysuit', 'a peplum top', 'a sweater', 'a hoodie', 'a cardigan', 'a knitted vest'],
  Pantalones: ['trousers', 'jeans', 'wide leg pants', 'shorts', 'leggings'],
  Faldas: ['a skirt', 'a mini skirt', 'a midi skirt', 'a long skirt', 'a pleated skirt', 'a flared skirt', 'a lace skirt'],
  Vestidos: ['a dress', 'a mini dress', 'a midi dress', 'a long dress', 'a wrap dress', 'a jumpsuit'],
  Abrigos: ['a coat', 'a trench coat', 'a puffer jacket', 'a parka', 'a jacket', 'a denim jacket', 'a bomber jacket', 'a blazer'],
  Zapatos: ['a pair of shoes', 'a pair of sneakers', 'a pair of boots', 'a pair of knee high boots', 'a pair of ankle boots', 'a pair of high heels', 'a pair of sandals', 'a pair of ballet flats', 'a pair of loafers'],
  Bolsos: ['a handbag', 'a shoulder bag', 'a crossbody bag', 'a tote bag', 'a clutch bag', 'a backpack'],
  Accesorios: ['a belt', 'a scarf', 'a hat', 'a cap', 'a sunglasses', 'sunglasses', 'a necklace', 'earrings', 'a bracelet', 'a watch', 'gloves'].filter(x => NOM_X[x])
};
const subDe = (cat, x, nombre) => SUBCATS[cat]?.includes(x) ? x : SUBCATS[cat]?.find(k => (nombre || '').toLowerCase().startsWith(NOM_X[k][0].toLowerCase() + ' ')) || '';
const opsCat = sel => CATS_ORDEN.map(c => `<option value="${c}"${c === sel ? ' selected' : ''}>${catTxt(c)}</option>`).join('');
const opsSub = (cat, sel) => `<option value="">${t('Elige…', 'Choose…')}</option>` + (SUBCATS[cat] || []).map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${NOM_X[k][idioma() === 'en' ? 1 : 0]}</option>`).join('');
function adjColor(c, f, pl) {
  if (['Beige', 'Camel', 'Azul claro'].includes(c)) return c.toLowerCase();
  let a = c.toLowerCase(); if (f && /o$/.test(a)) a = a.slice(0, -1) + 'a';
  if (pl) a = /[aeo]$/.test(a) ? a + 's' : a === 'marrón' ? 'marrones' : a + 'es';
  return a;
}
function nombreReconocido(x, color) {
  const N = NOM_X[x]; if (!N) return null; const en = idioma() === 'en';
  if (en) return `${color} ${N[1].toLowerCase()}`.replace(/^./, c => c.toUpperCase());
  if (color === 'Estampado') return `${N[0]} estampad${N[2] === 'f' ? 'a' : 'o'}${N[3] ? 's' : ''}`;
  return `${N[0]} ${adjColor(color, N[2] === 'f', N[3])}`;
}
const FEM = c => ({ Negro: 'negra', Blanco: 'blanca', Rojo: 'roja', Amarillo: 'amarilla', Morado: 'morada', Estampado: 'estampada' }[c] || c.toLowerCase());
const nombreSubida = (it, cat) => cat === 'Faldas' ? (idioma() === 'en' ? `${it.color} skirt` : `Falda ${FEM(it.color)}`) : nombreAuto(it.tipo, it.color);
// 0.61 (Sheila, 23/10: «debería dar unas reglas básicas para que los usuarios obtengan buenas fotos»)
const REGLAS_FOTO = [
  ['Fondo liso y que contraste', 'una sábana, el suelo o una pared de un solo color; prenda clara sobre fondo oscuro, y al revés', 'Plain, contrasting background', 'a sheet, the floor or a single-colour wall; light garments on dark, dark on light'],
  ['Una prenda por foto, entera', 'estirada y sin nada alrededor: ni otras prendas, ni cojines, ni bolsas', 'One garment per photo, whole', 'laid flat with nothing around it: no other clothes, cushions or bags'],
  ['Desde arriba o colgada', 'en el suelo o la cama, con el móvil paralelo a la prenda; o colgada de una puerta lisa', 'From above or hanging', 'on the floor or bed with the phone parallel to it, or hanging on a plain door'],
  ['Luz de día, sin flash', 'junto a una ventana y sin sombras fuertes encima', 'Daylight, no flash', 'near a window, without strong shadows'],
  ['Que llene la foto', 'acércate hasta que ocupe casi todo, dejando un poco de margen', 'Fill the frame', 'get close until it fills most of the photo, with a little margin'],
  ['Zapatos y accesorios', 'los zapatos, el par junto y de lado; cinturones y pañuelos, estirados', 'Shoes and accessories', 'shoes as a pair, side on; belts and scarves laid out straight']
];
const reglasFoto = () => `<details class="s-reglas"><summary>${t('Cómo hacer una buena foto', 'How to take a good photo')}</summary><ol>${REGLAS_FOTO.map(r => `<li><b>${t(r[0], r[2])}</b>${t(r[1], r[3])}</li>`).join('')}</ol></details>`;
function prepararSubir() { E.subida = []; E.sDet = null; pintarSubida(); }
// Subir (Gabriela, 20/10): una sola prenda → su ficha (3B); varias → rejilla (3A) con lo general a la vista y, al tocar una, su ficha
function pintarSubida() {
  const n = E.subida.length, raiz = $('s-raiz'), X = `<button class="x" data-ir="closet" aria-label="${t('Cerrar', 'Close')}"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></svg></button>`;
  const mas = (txt, cls) => `<label class="${cls}">${txt}<input type="file" accept="image/*" multiple data-sfotos></label>`;
  const det = n === 1 ? E.subida[0] : E.subida.find(i => i.id === E.sDet);
  if (!n) raiz.innerHTML = `<div class="sb">${X}<div class="tit"><h1>${t('Sube tu ropa', 'Upload your clothes')}</h1><div class="mini-et">${t('Una prenda por foto', 'One garment per photo')}</div></div><div class="guia"><svg viewBox="0 0 24 24"><use href="#ic-camara"/></svg><i></i><i></i><i></i><i></i></div><p class="consejo">${t('La app quita el fondo y te propone tipo y color.', 'The app removes the background and suggests type and colour.')}</p>${reglasFoto()}<div class="bts"><label class="boton">${t('Hacer una foto', 'Take a photo')}<input type="file" accept="image/*" capture="environment" data-sfotos></label>${mas(t('Elegir de la galería', 'Choose from gallery'), 'boton no')}<span class="txt">${t('Hasta 20 a la vez', 'Up to 20 at a time')}</span></div></div>`;
  else if (det) {
    const i = E.subida.indexOf(det), listo = det.estado === 'listo';
    const ops = (lista, sel, k, nom) => `<div class="ops">${lista.map(x => `<button type="button" class="${x === sel ? 'on' : ''}" data-s${k}="${x}">${nom(x)}</button>`).join('')}</div>`;
    raiz.innerHTML = `<div class="sb uno">${n === 1 ? X : `<button class="x" data-svolver aria-label="${t('Volver', 'Back')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>`}<div class="tit"><h1>${t('Revisa tu prenda', 'Check your garment')}</h1>${n > 1 ? `<div class="mini-et">${i + 1} ${t('de', 'of')} ${n}</div>` : ''}</div>
      <div class="foto">${det.url ? `<img src="${det.url}" alt="">` : `<p class="s-procesando">${t('Quitando el fondo y reconociendo la prenda…', 'Removing the background and recognising the garment…')}</p>`}</div>
      ${listo && det.noPrenda && !det.siPrenda ? `<div class="s-aviso"><b>${t('Esta foto no parece una prenda', 'This photo does not look like a garment')}</b><span>${t('No coincide con ninguna categoría de ropa. Si es una captura, un texto u otra cosa, quítala.', 'It does not match any clothing category. If it is a screenshot, text or something else, remove it.')}</span><div><button class="boton" data-squita>${t('Quitarla', 'Remove it')}</button><button class="txt sub-l" data-ssi>${t('Sí es una prenda', 'It is a garment')}</button></div></div>` : ''}
      ${listo && det.fondo && !(det.noPrenda && !det.siPrenda) ? `<p class="s-fondo">${t('El fondo no es liso y el recorte puede salir con restos. Para un recorte limpio, haz la foto sobre un fondo de un solo color.', 'The background is not plain, so the cut-out may keep bits of it. For a clean cut-out, shoot on a single-colour background.')}</p>${reglasFoto()}` : ''}
      ${listo ? `<input class="nom" value="${det.nombre}" data-snom aria-label="${t('Nombre', 'Name')}">
      <div class="fila2 s-cat"><label class="campo"><span>${t('Categoría', 'Category')}</span><select data-scat>${opsCat(catDe(det))}</select></label><label class="campo"><span>${t('Tipo', 'Type')}</span><select data-ssub>${opsSub(catDe(det), subDe(catDe(det), det.x, det.nombre))}</select></label></div>
      <div class="gr"><p class="mini-et">${t('Color', 'Colour')}</p><div class="ops col">${COLORES.map(([c, h]) => `<button type="button" class="${c === det.color ? 'on' : ''}" data-scolor="${c}" title="${c}" aria-label="${c}" style="background:${h}"></button>`).join('')}</div></div>
      <div class="gr"><p class="mini-et">${t('Estación', 'Season')}</p>${ops(ESTACIONES, det.estacion, 'est', estNombre)}</div>
      ${det.recortada ? `<button class="txt sub-l" data-sorig>${det.usaOriginal ? t('Usar el fondo blanco', 'Use white background') : t('Usar la foto original', 'Use the original photo')}</button>` : ''}` : ''}
      <div class="bts">${n === 1 ? `<button class="boton" data-sguardar ${listo && !(det.noPrenda && !det.siPrenda) ? '' : 'disabled'}>${t('Guardar en mi clóset', 'Save to my closet')}</button>${mas(t('Añadir más prendas', 'Add more garments'), 'txt sub-l')}` : `<button class="boton" data-svolver>${t('Listo', 'Done')}</button><button class="txt sub-l" data-squita>${t('Quitar esta prenda', 'Remove this garment')}</button>`}</div></div>`;
  } else {
    const listos = E.subida.filter(i => i.estado === 'listo' && !(i.noPrenda && !i.siPrenda)).length, nop = E.subida.filter(i => i.noPrenda && !i.siPrenda).length;
    raiz.innerHTML = `<div class="sb rv">${X}<div class="tit"><h1>${n} ${t('prendas', 'garments')}</h1><div class="mini-et">${E.subida.some(i => i.estado !== 'listo') ? t('Quitando los fondos…', 'Removing backgrounds…') : t('Revisa y guarda', 'Check and save')}</div></div>
      <div class="rej">${E.subida.map(it => `<button type="button" data-sdet="${it.id}">${it.url ? `<img src="${it.url}" alt="">` : ''}${it.estado === 'listo' && it.noPrenda && !it.siPrenda ? `<p class="no">${t('No es una prenda', 'Not a garment')}<small>${t('Toca para revisarla', 'Tap to check')}</small></p>` : it.estado === 'listo' ? `<em></em><p>${it.nombre}<small>${catTxt(catDe(it))} · ${it.color}</small></p>` : `<p><small>${t('Quitando el fondo…', 'Removing the background…')}</small></p>`}</button>`).join('')}${n < 20 ? mas(`<svg viewBox="0 0 20 20"><path d="M10 3v14M3 10h14"/></svg><small>${t('Añadir más', 'Add more')}</small>`, 'mas') : ''}</div>
      ${nop ? `<p class="s-aviso-l">${nop === 1 ? t('Hay 1 foto que no coincide con ninguna categoría de prenda: no se guardará.', '1 photo does not match any clothing category: it will not be saved.') : t(`Hay ${nop} fotos que no coinciden con ninguna categoría de prenda: no se guardarán.`, `${nop} photos do not match any clothing category: they will not be saved.`)}</p>` : ''}
      <div class="bts"><button class="boton" data-sguardar ${listos ? '' : 'disabled'}>${listos === 1 ? t('Guardar 1 prenda', 'Save 1 garment') : t(`Guardar ${listos} prendas`, `Save ${listos} garments`)}</button><span class="txt">${t('Toca una prenda para ver su ficha y cambiar nombre, tipo, color o estación', 'Tap a garment to open its card and change name, type, colour or season')}</span></div></div>`;
  }
  raiz.querySelectorAll('[data-sfotos]').forEach(inp => inp.onchange = e => { anadirFotos([...e.target.files]); e.target.value = ''; });
  raiz.onclick = ev => {
    const b = ev.target.closest('[data-sdet],[data-svolver],[data-squita],[data-ssi],[data-sguardar],[data-stipo],[data-scolor],[data-sest],[data-sorig]'); if (!b || b.disabled) return;
    const d = b.dataset, auto = det && det.nombre === nombreAuto(det.tipo, det.color), prev = det?.color;
    if (d.sdet) { E.sDet = d.sdet; pintarSubida(); raiz.scrollTop = 0; }
    else if (d.svolver !== undefined) { E.sDet = null; pintarSubida(); }
    else if (d.squita !== undefined) { E.subida = E.subida.filter(i => i !== det); E.sDet = null; pintarSubida(); }
    else if (d.ssi !== undefined) { det.siPrenda = true; pintarSubida(); }
    else if (d.sguardar !== undefined) guardarSubida();
    else if (d.scolor) { const c = catDe(det); det.color = d.scolor; if (det.x && NOMBRE_AUTO.test(det.nombre) && SUBCATS[c]?.includes(det.x)) det.nombre = nombreReconocido(det.x, det.color); else if (auto || (c === 'Faldas' && det.nombre === nombreSubida(Object.assign({}, det, { color: prev }), c))) det.nombre = nombreSubida(det, c); pintarSubida(); }
    else if (d.sest) { det.estacion = d.sest; pintarSubida(); }
    else if (d.sorig !== undefined) { det.usaOriginal = !det.usaOriginal; URL.revokeObjectURL(det.url); det.url = URL.createObjectURL(det.usaOriginal ? det.original : det.blob); pintarSubida(); }
  };
  const nom = raiz.querySelector('[data-snom]'); if (nom) nom.oninput = e => { det.nombre = e.target.value; };
  const sc = raiz.querySelector('[data-scat]'), ss = raiz.querySelector('[data-ssub]');
  if (sc) sc.onchange = e => { const c = e.target.value, propio = !NOMBRE_AUTO.test(det.nombre) && det.nombre !== nombreAuto(det.tipo, det.color); det.tipo = TIPO_DE_CAT[c]; det.x = null; if (!propio) det.nombre = nombreSubida(det, c); pintarSubida(); };
  if (ss) ss.onchange = e => { const k = e.target.value; if (!k) return; const propio = !NOMBRE_AUTO.test(det.nombre) && det.nombre !== nombreAuto(det.tipo, det.color); det.x = k; if (!propio) det.nombre = nombreReconocido(k, det.color); pintarSubida(); };
}
async function anadirFotos(files) {
  const nuevos = files.slice(0, Math.max(0, 20 - E.subida.length)).map(f => ({ id: uid(), estado: 'procesando', file: f }));
  if (!nuevos.length) return toast(t('Como mucho 20 fotos cada vez', 'At most 20 photos at a time'));
  E.subida.push(...nuevos); pintarSubida();
  for (const it of nuevos) {
    try { const r = await procesarPrenda(it.file); Object.assign(it, r, { estado: 'listo', estacion: 'Todo el año', url: URL.createObjectURL(r.blob), nombre: nombreReconocido(r.x, r.color) || (r.cat ? nombreSubida(r, r.cat) : nombreAuto(r.tipo, r.color)) }); delete it.file; }
    catch (e) { E.subida = E.subida.filter(x => x !== it); toast(t('No he podido leer una de las fotos', 'Could not read one of the photos')); }
    pintarSubida();
  }
}
async function guardarSubida() {
  const listos = E.subida.filter(i => i.estado === 'listo' && !(i.noPrenda && !i.siPrenda)); if (!listos.length) return;
  listos.forEach(it => E.prendas.unshift({ id: uid(), rec: it.rec ? 3 : 0, nombre: it.nombre.trim() || tipoNombre(it.tipo), color: it.color, tipo: it.tipo, estacion: it.estacion || 'Todo el año', notas: '', foto: it.usaOriginal ? it.original : it.blob, creada: hoyISO(), usos: [], estado: '', x: it.x || null, original: it.original || undefined }));
  await guardar(); E.propuestas = []; E.generados = []; E.subida = []; E.sDet = null;
  toast(t(`${listos.length} ${listos.length === 1 ? 'prenda guardada' : 'prendas guardadas'} en tu clóset`, `${listos.length} saved to your closet`)); ir('closet');
}

/* ---------- AÑADIR / EDITAR ---------- */
let fotoNueva = null, fotoOriginal = null;
// 0.59 (Sheila, 23/10: «cuando edito la foto debe tener la opción de recortarla»): en la ficha, «Recortar» (marco a mano) y «Quitar el fondo»;
// la foto sin tocar se guarda aparte para poder volver a ella
async function fotoActual() { const p = E.editando; if (fotoNueva) return fotoNueva; if (p?.foto) return p.foto; if (p?.src) return (await fetch(p.src)).blob(); return null; }
function pintarHerr() {
  const h = $('an-herr'); if (!h) return; const hay = !!(fotoNueva || E.editando?.foto || E.editando?.src), orig = fotoOriginal || E.editando?.original;
  h.innerHTML = hay ? `<button type="button" class="txt sub-l" id="an-recortar">${t('Recortar', 'Crop')}</button><button type="button" class="txt sub-l" id="an-fondo">${t('Quitar el fondo', 'Remove background')}</button>${orig ? `<button type="button" class="txt sub-l" id="an-orig">${t('Volver a la original', 'Back to original')}</button>` : ''}` : '';
  if (!hay) return;
  $('an-recortar').onclick = async () => { const b = await fotoActual(); if (!b) return; const r = await recortarAMano(b); if (!r) return; if (!fotoOriginal && !E.editando?.original) fotoOriginal = b; fotoNueva = r; pintarPrevia(URL.createObjectURL(r)); };
  $('an-fondo').onclick = async () => {
    const b = await fotoActual(); if (!b) return; const bt = $('an-fondo'); bt.disabled = true; bt.textContent = t('Quitando el fondo…', 'Removing background…');
    try { const r = await procesarPrenda(b); if (!fotoOriginal && !E.editando?.original) fotoOriginal = b; fotoNueva = r.blob; pintarPrevia(URL.createObjectURL(r.blob)); toast(t('Fondo quitado. Guarda para conservarlo', 'Background removed. Save to keep it')); }
    catch (e) { toast(t('No he podido quitar el fondo', 'Could not remove the background')); pintarHerr(); }
  };
  if ($('an-orig')) $('an-orig').onclick = () => { fotoNueva = orig; pintarPrevia(URL.createObjectURL(orig)); };
}
// marco con cuatro esquinas sobre la foto; devuelve el trozo elegido como JPEG
function recortarAMano(blob) {
  return new Promise(res => {
    const u = URL.createObjectURL(blob), cap = document.createElement('div'); cap.className = 'rc-capa';
    cap.innerHTML = `<p class="mini-et">${t('Ajusta el marco a la prenda', 'Fit the frame to the garment')}</p><div class="rc-zona"><img src="${u}" alt=""><div class="rc-marco"><i data-c="tl"></i><i data-c="tr"></i><i data-c="bl"></i><i data-c="br"></i></div></div><div class="rc-bts"><button class="boton" data-rc="ok">${t('Recortar', 'Crop')}</button><button class="txt sub-l" data-rc="no">${t('Cancelar', 'Cancel')}</button></div>`;
    document.body.appendChild(cap);
    const img = cap.querySelector('img'), m = cap.querySelector('.rc-marco'); let r = null;
    const pinta = () => Object.assign(m.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    img.onload = () => { r = { x: img.offsetLeft + img.width * .08, y: img.offsetTop + img.height * .08, w: img.width * .84, h: img.height * .84 }; pinta(); };
    let arr = null;
    m.onpointerdown = e => { e.preventDefault(); m.setPointerCapture(e.pointerId); arr = { c: e.target.dataset.c || 'mover', x: e.clientX, y: e.clientY, r: { ...r } }; };
    m.onpointermove = e => {
      if (!arr) return; const dx = e.clientX - arr.x, dy = e.clientY - arr.y, o = arr.r, L = img.offsetLeft, T = img.offsetTop, R = L + img.width, B = T + img.height, min = 40;
      let { x, y, w, h } = o;
      if (arr.c === 'mover') { x = Math.min(Math.max(L, o.x + dx), R - o.w); y = Math.min(Math.max(T, o.y + dy), B - o.h); }
      else {
        if (arr.c[1] === 'l') { x = Math.min(Math.max(L, o.x + dx), o.x + o.w - min); w = o.x + o.w - x; } else w = Math.min(Math.max(min, o.w + dx), R - o.x);
        if (arr.c[0] === 't') { y = Math.min(Math.max(T, o.y + dy), o.y + o.h - min); h = o.y + o.h - y; } else h = Math.min(Math.max(min, o.h + dy), B - o.y);
      }
      r = { x, y, w, h }; pinta();
    };
    m.onpointerup = () => { arr = null; };
    cap.onclick = e => {
      const b = e.target.closest('[data-rc]'); if (!b) return;
      if (b.dataset.rc === 'no') { cap.remove(); URL.revokeObjectURL(u); return res(null); }
      const k = img.naturalWidth / img.width, c = document.createElement('canvas'); c.width = Math.round(r.w * k); c.height = Math.round(r.h * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, (r.x - img.offsetLeft) * k, (r.y - img.offsetTop) * k, c.width, c.height, 0, 0, c.width, c.height);
      c.toBlob(bl => { cap.remove(); URL.revokeObjectURL(u); res(bl); }, 'image/jpeg', .9);
    };
  });
}
function prepararAnadir(id) {
  E.editando = id ? P(id) : null; fotoNueva = null; fotoOriginal = null;
  const p = E.editando;
  $('an-titulo').textContent = p ? t('Editar prenda', 'Edit garment') : t('Nueva prenda', 'New garment');
  $('an-borrar').classList.toggle('oculto', !p);
  $('an-guardar').textContent = p ? t('Guardar cambios', 'Save changes') : t('Guardar en mi clóset', 'Save to my closet');
  $('an-otra').classList.toggle('oculto', !!p);
  const cat0 = p ? catDe(p) : 'Tops'; $('an-tipo').innerHTML = opsCat(cat0); $('an-sub').innerHTML = opsSub(cat0, p ? subDe(cat0, p.x, p.nombre) : '');
  $('an-tipo').onchange = () => { $('an-sub').innerHTML = opsSub($('an-tipo').value, ''); };
  $('an-sub').onchange = () => { const k = $('an-sub').value, n = $('an-nombre').value.trim(); if (k && (!n || NOMBRE_AUTO.test(n))) $('an-nombre').value = nombreReconocido(k, $('an-colores').dataset.sel || 'Negro'); };
  $('an-estacion').innerHTML = ESTACIONES.map(x => `<option value="${x}">${estNombre(x)}</option>`).join('');
  $('an-nombre').value = p?.nombre || ''; $('an-estacion').value = p?.estacion || 'Todo el año'; $('an-notas').value = p?.notas || '';
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
    try { const r = await procesarPrenda(f); fotoNueva = r.blob; fotoOriginal = r.original; pintarPrevia(URL.createObjectURL(r.blob)); if (!$('an-colores').dataset.sel) pintarColores(r.color); if (!$('an-nombre').value) $('an-nombre').value = $('an-sub').value ? nombreReconocido($('an-sub').value, r.color) : nombreAuto(TIPO_DE_CAT[$('an-tipo').value], r.color); }
    catch (err) { toast(t('No he podido leer esa foto', 'Could not read that photo')); }
  };
  pintarHerr();
}
async function guardarPrenda(otra) {
  const p = E.editando; const nombre = $('an-nombre').value.trim(); const color = $('an-colores').dataset.sel || 'Gris';
  if (!p && !fotoNueva) return toast(t('Falta la foto de la prenda', 'The garment photo is missing'));
  if (!nombre) return toast(t('Ponle un nombre', 'Give it a name'));
  const tipo = TIPO_DE_CAT[$('an-tipo').value], x = $('an-sub').value || null;
  if (p) { if (fotoOriginal && !p.original) p.original = fotoOriginal; Object.assign(p, { rec: 3, nombre, color, tipo, x, estacion: $('an-estacion').value, notas: $('an-notas').value.trim() }); if (fotoNueva) { p.foto = fotoNueva; delete p.src; delete p.caja; urls.delete(p.id); } }
  else E.prendas.unshift({ id: uid(), rec: 3, original: fotoOriginal || undefined, nombre, color, tipo, x, estacion: $('an-estacion').value, notas: $('an-notas').value.trim(), foto: fotoNueva, creada: hoyISO(), usos: [], estado: '' });
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
// 0.10 · Looks con el diseño cerrado (21/10): título centrado, «Mis looks» e «Ideas para hoy» en letras con el botón de dos agujeros,
// filtro por ocasión y tres formas de verlos a prueba (?looks=1 rejilla de 2 · 2 uno a uno · 3 lista)
E.lkTab = ({ ideas: 'ideas', cal: 'cal' })[new URLSearchParams(location.search).get('lk')] || 'mios'; E.lkOc = 'Todo'; E.lkI = 0;
const lkVista = () => { const v = new URLSearchParams(location.search).get('looks') || localStorage.getItem('tc_looks'); return ['1', '2', '3', '4', '5'].includes(v) ? v : '1'; }; // 0.49 (Gabriela, 22/10: «aplica el mismo estilo a todas las nuevas… y corregimos sobre esa base»): rejilla como el Clóset cerrado; // 4 y 5 (21/10, «adapta la interfaz a mi estilo»): sobre blanco, sin cajas
const figLook = (c, mini) => c.img && planDemo() === 'pro' ? `<img class="av" src="${c.img}" alt="">` : maniqui(c.ids.map(P).filter(Boolean), mini);
const usosTxt = c => c.usos?.length ? veces(c.usos.length) : t('sin estrenar', 'not worn yet');
function pintarLooks() {
  const v = lkVista(), raiz = $('lk-raiz'); document.documentElement.dataset.looks = v;
  if (E.lkTab === 'cal') return pintarCalendario(raiz);
  if (E.lkTab === 'ideas' && !E.generados.length) E.generados = generarLooks(6, 'Todos');
  const ocs = ['Todo', ...OCASIONES.filter(o => E.conjuntos.some(c => (c.ocasion || 'Diario') === o))];
  if (!ocs.includes(E.lkOc)) E.lkOc = 'Todo';
  const ideas = E.lkTab === 'ideas';
  const lista = ideas ? E.generados.map((g, i) => ({ ...g, i })) : E.conjuntos.filter(c => E.lkOc === 'Todo' || (c.ocasion || 'Diario') === E.lkOc);
  const cab = `<div class="mc-cab lk-cab"><h1>${t('Looks', 'Looks')}</h1><button class="lk-mas" data-ir="nuevo-look" aria-label="${t('Crear un look', 'Create a look')}"><svg viewBox="0 0 20 20"><path d="M10 3v14M3 10h14"/></svg></button></div>
    <div class="mc-cats lk-tabs"><button class="${ideas || E.lkTab === 'cal' ? '' : 'activo'}" data-lktab="mios">${t('Mis looks', 'My looks')}</button><button class="${ideas ? 'activo' : ''}" data-lktab="ideas">${t('Ideas para hoy', 'Ideas for today')}</button><button class="${E.lkTab === 'cal' ? 'activo' : ''}" data-lktab="cal">${t('Calendario', 'Calendar')}</button></div>
    ${ideas || ocs.length < 3 ? '' : `<div class="lk-ocs">${ocs.map(o => `<button class="${o === E.lkOc ? 'on' : ''}" data-lkoc="${o}">${o === 'Todo' ? t('Todo', 'All') : ocNombre(o)}</button>`).join('')}</div>`}`;
  const pie = c => ideas ? `<span class="lk-oc">${ocNombre(c.ocasion || 'Diario')}</span><span class="lk-acc"><button data-gguardar="${c.i}">${t('Guardar', 'Save')}</button><button data-ghoy="${c.i}">${t('Me lo pongo', 'Wear it')}</button></span>`
    : `<span class="lk-oc">${ocNombre(c.ocasion || 'Diario')}</span><span class="lk-us">${usosTxt(c)}</span>`;
  const abre = c => ideas ? '' : ` data-look="${c.id}"`;
  let cuerpo;
  if (!lista.length) cuerpo = ideas ? `<div class="hz-vacio lk-vacio">${t('Para proponerte looks necesito una parte de arriba y una de abajo, o un vestido, de esta estación.', 'To suggest looks I need a top and a bottom, or a dress, for this season.')}<button class="hz-bt" data-ir="subir">${t('Subir mis prendas', 'Upload my garments')}</button></div>`
    : `<div class="hz-vacio lk-vacio">${t('Aún no tienes looks guardados. Mira las ideas para hoy o crea uno con tu ropa.', 'No saved looks yet. See today’s ideas or create one with your clothes.')}<button class="hz-bt" data-lktab="ideas">${t('Ideas para hoy', 'Ideas for today')}</button></div>`;
  else if (v === '2') { E.lkI = Math.min(E.lkI, lista.length - 1); const c = lista[E.lkI];
    cuerpo = `<div class="lk-uno"><div class="lk-fig"${abre(c)}>${figLook(c)}</div><div class="lk-nav"><button data-lkmov="-1" aria-label="${t('Anterior', 'Previous')}" ${E.lkI ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><span>${E.lkI + 1} / ${lista.length}</span><button data-lkmov="1" aria-label="${t('Siguiente', 'Next')}" ${E.lkI < lista.length - 1 ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div>${pie(c)}</div>`; }
  else if (v === '3') cuerpo = `<div class="lk-lista">${lista.map(c => `<div class="lk-fila"${abre(c)}><span class="lk-mini">${figLook(c, true)}</span><span class="lk-txt">${pie(c)}</span>${ideas ? '' : '<svg class="fl" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>'}</div>`).join('')}</div>`;
  else if (v === '4') cuerpo = `<div class="lk-libro">${lista.map(c => `<div class="lk-pag"><div class="lk-fig"${abre(c)}>${figLook(c, true)}</div>${ideas ? pie(c) : `<span class="lk-oc">${ocNombre(c.ocasion || 'Diario')}</span>`}</div>`).join('<i class="lk-hilo"></i>')}</div>`;
  else if (v === '5') cuerpo = `<div class="lk-blanca">${lista.map(c => `<div class="lk-t"><div class="lk-fig"${abre(c)}>${figLook(c, true)}</div>${ideas ? pie(c) : `<span class="lk-oc">${ocNombre(c.ocasion || 'Diario')}</span>`}</div>`).join('')}</div>`;
  else cuerpo = `<div class="lk-rejilla">${lista.map(c => `<div class="lk-t"><div class="lk-fig"${abre(c)}>${figLook(c, true)}</div>${pie(c)}</div>`).join('')}</div>`;
  raiz.innerHTML = cab + cuerpo + (ideas && lista.length ? `<button class="hz-bt lk-otras" data-lkotras>${t('Otras ideas', 'Other ideas')}</button>` : '');
  raiz.onclick = e => {
    const b = e.target.closest('[data-lktab],[data-lkoc],[data-lkmov],[data-lkotras]'); if (!b || b.disabled) return;
    if (b.dataset.lktab) { E.lkTab = b.dataset.lktab; E.lkI = 0; }
    else if (b.dataset.lkoc) { E.lkOc = b.dataset.lkoc; E.lkI = 0; }
    else if (b.dataset.lkmov) E.lkI += +b.dataset.lkmov;
    else { E.generados = generarLooks(6, 'Todos'); E.lkI = 0; }
    pintarLooks();
  };
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
  $('yo-sub').textContent = [CLOSET_ACT ? t('Clóset de pruebas', 'Test closet') : '', E.tiempo?.nombre || pf.ciudad || pf.lugar, estNombre(estacionDelDia()), `${E.prendas.length} ${t('prendas', 'garments')}`].filter(Boolean).join(' · ');
  $('yo-estad').innerHTML = `<div><b>${E.prendas.length}</b><span>${t('prendas', 'garments')}</span></div><div><b>${usosMes}</b><span>${t('usos este mes', 'uses this month')}</span></div><div><b>${E.conjuntos.length}</b><span>${t('conjuntos', 'outfits')}</span></div>`;
  const sil = pf.selfie && pf.cuerpo ? t('Fotos listas', 'Photos ready') : pf.selfie || pf.cuerpo ? t('Falta una foto', 'One photo missing') : t('Sin fotos', 'No photos');
  $('yo-lista').innerHTML = `<button class="item" data-ir="silueta">${t('Mi silueta', 'My figure')}<span class="valor ${pf.selfie && pf.cuerpo ? 'oro' : ''}">${sil}</span></button>
    <button class="item" data-ir="estilo">${t('Mi estilo', 'My style')}<span class="valor ${(pf.estilos || []).length ? 'oro' : ''}">${(pf.estilos || []).map(k => ESTILOS.find(x => x.k === k)?.n[idioma() === 'en' ? 1 : 0]).filter(Boolean).join(' · ') || t('Sin elegir', 'Not set')}</span></button>
    <button class="item" id="yo-colores">${t('Mis colores', 'My colours')}<span class="valor">${t('Próximamente', 'Coming soon')}</span></button>
    <button class="item" id="yo-top">${t('La que más te pones', 'Most worn')}<span class="valor">${top && (top.usos || []).length ? `${top.nombre} · ${top.usos.length}` : '—'}</span></button>`;
  $('yo-ajustes').innerHTML = `<button class="item" id="yo-idioma">${t('Idioma', 'Language')}<span class="valor">${idioma() === 'en' ? 'English' : 'Español'}</span></button>
    <button class="item" data-ir="diseno">${t('Diseño (para decidir)', 'Design (to decide)')}<span class="valor">${DIS.letra.nom[dis('letra')]} · ${DIS.tema.nom[dis('tema')]}</span></button>
    <button class="item" id="yo-plan">${t('Plan (para enseñarlo)', 'Plan (demo)')}<span class="valor">${planDemo() === 'pro' ? t('Pro · tu avatar', 'Pro · your avatar') : t('Básico · maniquí', 'Basic · mannequin')}</span></button>
    <button class="item" id="yo-ciudad">${t('Ciudad para el tiempo', 'City for the weather')}<span class="valor">${pf.ciudad || E.tiempo?.nombre || pf.lugar || t('tu ubicación', 'your location')}</span></button>
    <button class="item" id="yo-closet">${t('Clóset', 'Closet')}<span class="valor oro">${CLOSET_ACT ? t('Pruebas', 'Test') : t('Mi ropa', 'My clothes')} · ${t('cambiar', 'switch')}</span></button>
    <button class="item" id="yo-exportar">${t('Guardar una copia de mis datos', 'Save a copy of my data')}<span class="valor">JSON</span></button>
    <label class="item" id="yo-importar">${t('Recuperar una copia', 'Restore a copy')}<span class="valor">JSON</span><input type="file" accept="application/json,.json" hidden></label>
    ${PUBLICA ? '' : `<button class="item" id="yo-ejemplo">${E.prendas.some(p => p.ejemplo) ? t('Quitar el clóset de ejemplo', 'Remove the sample closet') : t('Cargar un clóset de ejemplo', 'Load a sample closet')}<span class="valor"></span></button>`}
    <button class="item" id="yo-borrar">${t('Borrar todo de este móvil', 'Delete everything from this phone')}<span class="valor"></span></button>
    <div class="item">${t('Suscripción', 'Subscription')}<span class="valor">${t('Prueba · versión web', 'Trial · web version')}</span></div>`;
  $('yo-idioma').onclick = async () => { E.perfil = E.perfil || {}; E.perfil.idioma = idioma() === 'en' ? 'es' : 'en'; localStorage.setItem('tc_idioma', E.perfil.idioma); await guardar(); traducir(); pintarYo(); };
  $('yo-ciudad').onclick = async () => { const c = prompt(t('Ciudad para el tiempo (déjalo vacío para usar tu ubicación)', 'City for the weather (leave empty to use your location)'), pf.ciudad || ''); if (c === null) return; E.perfil = E.perfil || {}; E.perfil.ciudad = c.trim(); E.perfil.lat = E.perfil.lon = null; E.perfil.lugar = '';
    if (!E.perfil.ciudad) { const g = await ubicacionMovil(true); if (g) Object.assign(E.perfil, g); else toast(t('Sin permiso de ubicación: escribe la ciudad', 'No location permission: type the city')); }
    await guardar(); await cargarTiempo(true); E.propuestas = []; pintarYo(); };
  $('yo-closet').onclick = () => { const otro = CLOSET_ACT ? '' : 'pruebas'; try { localStorage.setItem('tc_closet', otro); } catch (e) { } location.href = location.pathname + '?repaso=0&pantalla=closet'; };
  $('yo-plan').onclick = () => { PLAN_URL = null; localStorage.setItem('tc_plan', planDemo() === 'pro' ? 'basico' : 'pro'); pintarYo(); toast(planDemo() === 'pro' ? t('Pro: tu avatar con el conjunto', 'Pro: your avatar') : t('Básico: el conjunto en el maniquí', 'Basic: the outfit on the mannequin')); };
  $('yo-exportar').onclick = exportar;
  $('yo-importar').querySelector('input').onchange = e => e.target.files[0] && importar(e.target.files[0]);
  if ($('yo-ejemplo')) $('yo-ejemplo').onclick = () => E.prendas.some(p => p.ejemplo) ? quitarEjemplo() : cargarEjemplo();
  $('yo-borrar').onclick = async () => { if (await confirmar(t('¿Borrar todo?', 'Delete everything?'), t('Prendas, fotos, conjuntos y usos de este navegador. No se puede deshacer.', 'Garments, photos, outfits and uses in this browser. Cannot be undone.'), t('Borrar todo', 'Delete all'))) { for (const k of await BD.claves()) await BD.del(k); localStorage.removeItem('tc_tiempo'); location.reload(); } };
  $('yo-colores').onclick = () => toast(t('Los colores que te favorecen llegan en la próxima versión', 'Your best colours arrive in the next version'));
}
// 0.45 (Sheila, 22/10: «necesito seguir trabajando con mi misma base de datos… que cada vez que actualizas la versión guarde mi base de datos»):
// recuperar la copia en otro navegador o móvil; se suma a lo que haya, sin duplicar (por id), y no toca lo que ya existe
async function importar(file) {
  try {
    const d = JSON.parse(await file.text()); if (!Array.isArray(d.prendas)) throw 0;
    const aBlob = async u => u ? await (await fetch(u)).blob() : null; let n = 0;
    for (const p of d.prendas) if (!E.prendas.some(x => x.id === p.id)) { E.prendas.push({ ...p, foto: await aBlob(p.foto) }); n++; }
    for (const c of d.conjuntos || []) if (!E.conjuntos.some(x => x.id === c.id)) E.conjuntos.push(c);
    for (const [k, v] of Object.entries(d.agenda || {})) if (!E.agenda[k]) E.agenda[k] = v;
    if (!E.perfil && d.perfil) E.perfil = d.perfil;
    await guardar(); E.propuestas = []; E.generados = []; toast(t(`Recuperadas ${n} prendas`, `${n} garments restored`)); pintarYo();
  } catch (e) { toast(t('Ese fichero no es una copia de TuCloset', 'That file is not a TuCloset copy')); }
}
async function exportar() {
  const aB64 = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  const prendas = []; for (const p of E.prendas) prendas.push({ ...p, foto: p.foto ? await aB64(p.foto) : null });
  const datos = { version: 'tucloset-web-0.5', fecha: new Date().toISOString(), perfil: { ...E.perfil, selfie: null, cuerpo: null }, prendas, conjuntos: E.conjuntos, agenda: E.agenda };
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
  const pf = E.perfil || {}; E.perfil = Object.assign(pf, { nombre: $('a-nombre').value.trim() || pf.nombre || '', ciudad: $('a-ciudad').value.trim() || pf.ciudad || '', idioma: idioma(), alta: pf.alta || hoyISO() });
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
// «Ya tengo cuenta» (0.11): en esta versión el clóset vive en el móvil, así que entrar te lleva a él; las cuentas llegarán con la versión en la nube
const entrarYa = async () => { if (!E.perfil?.alta) { E.perfil = Object.assign(E.perfil || {}, { alta: hoyISO(), idioma: idioma() }); await guardar(); } ir('hoy'); };
$('e-entrar').onclick = entrarYa;
// planes (0.12): se elige plan y periodo; el cobro irá por App Store y Google Play, aquí solo se guarda la elección
E.pl = { plan: 'basico', per: 'mes' };
$('p-planes').addEventListener('click', e => {
  const b = e.target.closest('[data-pplan],[data-pper]'); if (!b) return;
  if (b.dataset.pplan) E.pl.plan = b.dataset.pplan; else E.pl.per = b.dataset.pper;
  $('p-planes').querySelectorAll('[data-pplan]').forEach(x => x.classList.toggle('on', x.dataset.pplan === E.pl.plan));
  $('p-planes').querySelectorAll('[data-pper]').forEach(x => x.classList.toggle('on', x.dataset.pper === E.pl.per));
  $('p-planes').querySelectorAll('[data-pdet]').forEach(x => x.classList.toggle('on', x.dataset.pdet === E.pl.plan));
  $('p-planes').querySelectorAll('.pl-pre[data-mes]').forEach(x => x.textContent = x.dataset[E.pl.per]);
  $('p-planes').querySelectorAll('.pl-per[data-mes]').forEach(x => x.textContent = x.dataset[E.pl.per]);
  $('p-planes').classList.toggle('anual', E.pl.per === 'anual');
});
if (new URLSearchParams(location.search).get('planes') !== 'a') $('p-planes').classList.add('pl-b'); // diseño B por defecto desde la 0.16 (Gabriela: «me gusta la opción B»); ?planes=a, el de dos columnas
$('pl-empezar').addEventListener('click', async () => { E.perfil = Object.assign(E.perfil || {}, { alta: E.perfil?.alta || hoyISO(), idioma: idioma(), planElegido: E.pl.plan, periodo: E.pl.per }); await guardar(); ir('hoy'); toast(t('Tu prueba de 7 días ha empezado', 'Your 7-day trial has started')); });
document.querySelectorAll('[data-social]').forEach(b => b.onclick = () => toast(t(`Entrar con ${b.dataset.social} llegará con las cuentas en la nube. Ahora tu clóset vive en este móvil.`, `${b.dataset.social} sign-in comes with cloud accounts. For now your closet lives on this phone.`)));
$('e-olvido').onclick = () => toast(t('Llegará con las cuentas en la nube.', 'Coming with cloud accounts.'));
$('a-ubicacion').onclick = () => { if (!navigator.geolocation) return toast(t('Tu navegador no da la ubicación', 'Your browser gives no location')); navigator.geolocation.getCurrentPosition(async p => { E.perfil = Object.assign(E.perfil || {}, { lat: p.coords.latitude, lon: p.coords.longitude, ciudad: '', lugar: '' }); $('a-ciudad').value = ''; await guardar(); await cargarTiempo(true); toast(E.tiempo ? `${E.tiempo.nombre || t('Ubicación', 'Location')} · ${E.tiempo.t}°` : t('Ubicación guardada', 'Location saved')); }, () => toast(t('Sin permiso de ubicación: escribe la ciudad', 'No location permission: type the city'))); };
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
  { const m = q.get('marco'); document.documentElement.dataset.marco = /^([1-6]|[abc][12])$/.test(m || '') ? m : 'c2'; } // arco c2 elegido por Gabriela el 21/10 («me quedo con c2»); ?marco= para comparar
  const el = $('intro'); if (!el) return;
  if (q.get('intro') !== '1' && (q.get('intro') === '0' || q.get('pantalla') || q.get('ficha'))) { el.remove(); $('p-inicio').classList.add('aparece'); return; }
  const v = q.get('entrada') === 'c' ? 'c' : 'b'; // B cerrada por Gabriela (20–21/10); las puertas A ya no existen // B por defecto (Gabriela, 20/10: «me gusta la B») if (q.get('entrada')) localStorage.setItem('tc_entrada', v);
  const nom = '<span class="nom">Tu<span>Closet</span></span>';
  const dibujoB = `<div class="x"><svg class="arco" viewBox="0 0 302 400" aria-hidden="true"><path class="o" pathLength="1" d="M151 .6A150.4 150.4 0 0 0 .6 151V400"/><path class="o" pathLength="1" d="M151 .6A150.4 150.4 0 0 1 301.4 151V400"/><path class="d" pathLength="1" d="M151 7.5A143.5 143.5 0 0 0 7.5 151V400"/><path class="d" pathLength="1" d="M151 7.5A143.5 143.5 0 0 1 294.5 151V400"/></svg><svg viewBox="0 0 100 100"><path d="M34 30A16 16 0 0 1 66 30"/><path d="M21 30H79"/><path d="M25 30V82H75V30"/><path d="M50 30V82"/><path d="M31 37h13v38H31zM56 37h13v38H56z"/><path d="M28 82v5M72 82v5"/></svg>${nom}</div>`;
  if (v === 'b') el.className = 'intro eb'; // B: el contenido se pone cuando se sabe a qué pantalla se entra
  if (v === 'c') { el.className = 'intro ec'; el.innerHTML = `<div class="fondo"></div><div class="barra"></div><div class="anillas"></div><div class="tela">${nom}</div>`; }
  el.classList.add('activa');
  let hecho = false; el.addEventListener('click', () => { if (hecho) return; hecho = true; el.classList.add('fuera'); $('p-inicio').classList.add('aparece'); setTimeout(() => el.remove(), 220); });
  if (v === 'b' && !matchMedia('(prefers-reduced-motion: reduce)').matches) { // B (Gabriela, 21/10: «todo aparezca a la vez y solo de último la frase»)
    let n = 0;
    const decide = () => {
      const pant = document.querySelector('.pantalla.activa');
      if (!pant && n++ < 60) return setTimeout(decide, 25);
      if (pant && pant.id === 'p-inicio') { el.remove(); pant.classList.add('aparece', 'dibuja'); return; } // la bienvenida lo hace todo: arco, armario, nombre y botones a la vez; la frase al final
      el.innerHTML = dibujoB; el.classList.add('con-nombre'); // en el resto: arco, armario y nombre a la vez, y se desvanece dejando ver la app
      if (q.get('fin') !== '0') setTimeout(() => { el.classList.add('suave'); setTimeout(() => el.remove(), 750); }, 3600);
    };
    decide();
  } else if (q.get('fin') !== '0') setTimeout(() => { el.remove(); if ($('p-inicio').classList.contains('activa')) $('p-inicio').classList.add('aparece'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 2250);
}
(async () => {
  entrada(new URLSearchParams(location.search));
  E.perfil = (await BD.get('perfil')) || null; E.prendas = (await BD.get('prendas')) || []; E.conjuntos = (await BD.get('conjuntos')) || []; E.agenda = (await BD.get('agenda')) || {};
  try { navigator.storage?.persist?.(); } catch (e) { }
  if (E.perfil?.estilos?.some(k => ESTILO_VIEJO[k])) E.perfil.estilos = [...new Set(E.perfil.estilos.map(k => ESTILO_VIEJO[k] || k))]; // 0.52: los 6 estilos viejos pasan a los 13 // 0.45: que el navegador no borre el clóset para hacer sitio
  let migra = false; E.conjuntos.forEach(c => { if (c.ejemplo && c.img && !c.img.includes('-recorte')) { c.img = c.img.replace('.webp', '-recorte.webp'); migra = true; } }); if (migra) await guardar();
  traducir(); pintarSilueta();
  document.querySelector('#p-closet .mc-cab')?.insertAdjacentHTML('beforeend', `<div class="cl-cambio">${['', 'pruebas'].map(k => `<button class="${k === CLOSET_ACT ? 'on' : ''}" data-cambio="${k}">${k ? t('Pruebas', 'Test') : t('Mi ropa', 'My clothes')}</button>`).join('')}</div>`); // 0.54 botón provisional (Sheila, 22/10: «me puedes crear un botón provisional»)
  document.addEventListener('click', e => { const b = e.target.closest('[data-cambio]'); if (!b || b.dataset.cambio === CLOSET_ACT) return; try { localStorage.setItem('tc_closet', b.dataset.cambio); } catch (er) { } location.href = location.pathname + '?repaso=0&pantalla=closet'; });
  { const l = +new URLSearchParams(location.search).get('lema'); const t = LEMAS[l - 1]; if (t) $('p-inicio').querySelector('.lema .t').textContent = t; bordar(); }
  const q = new URLSearchParams(location.search);
  for (const k of Object.keys(DIS)) if (DIS[k].vals.includes(q.get(k))) DIS_URL[k] = q.get(k);
  if (PROTOS[q.get('proto')]) Object.assign(DIS_URL, PROTOS[q.get('proto')]);
  if (['pro', 'basico'].includes(q.get('plan'))) PLAN_URL = q.get('plan');
  aplicarDiseno();
  if (q.get('ejemplo') && !E.prendas.length && !PUBLICA) await cargarEjemplo();
  const REPASO = q.get('repaso') !== '0'; // 0.48 (Gabriela, 22/10: «cada vez que abra la app, salgan todos los pasos con posibilidad de siguiente página»): mientras diseñamos, se entra siempre por la bienvenida y los pasos del alta; ?repaso=0 vuelve a lo de una usuaria real (directo a Hoy)
  const destino = q.get('pantalla') || (REPASO || !(E.perfil?.alta || E.prendas.length) ? 'inicio' : 'hoy');
  if (E.perfil) { if (E.perfil.nombre) $('a-nombre').value = E.perfil.nombre; if (E.perfil.ciudad) $('a-ciudad').value = E.perfil.ciudad; } // en el repaso no se pierde lo ya puesto
  if (destino !== 'inicio') await Promise.race([cargarTiempo(), new Promise(r => setTimeout(r, 4000))]);
  ir(destino);
  if (q.get('ficha')) abrirFicha(q.get('ficha'));
  setTimeout(() => reconocerGuardadas().then(medirTodas), 1500);
  document.querySelectorAll('#pl-empezar').forEach(b => b.addEventListener('click', () => { if (!E.perfil?.alta) { E.perfil = Object.assign(E.perfil || {}, { alta: hoyISO(), idioma: idioma() }); guardar(); } }));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

/* ---------- tipo de cuerpo (0.14): cinco siluetas, la elige ella; con la foto se le propondrá una (función 24). Siempre en positivo. ---------- */
const CUERPOS = [ // anchos de hombros, cintura y cadera (de 60)
  { k: 'reloj', n: ['Reloj de arena', 'Hourglass'], a: [37, 18, 37], d: ['Hombros y cadera parejos, cintura marcada.', 'Balanced shoulders and hips, defined waist.'], f: [['Cintura marcada y cinturones', 'Vestidos cruzados', 'Tejidos que caen', 'Pantalón de tiro alto'], ['Defined waist and belts', 'Wrap dresses', 'Fluid fabrics', 'High-waisted trousers']] },
  { k: 'triangulo', n: ['Triángulo', 'Pear'], a: [25, 20, 41], d: ['La cadera es lo más ancho.', 'Hips are the widest part.'], f: [['Detalles y color arriba', 'Escote barco o cuadrado', 'Faldas en A', 'Pantalón recto o ancho'], ['Details and colour on top', 'Boat or square neckline', 'A-line skirts', 'Straight or wide trousers']] },
  { k: 'invertido', n: ['Triángulo invertido', 'Inverted triangle'], a: [41, 22, 25], d: ['Los hombros son lo más ancho.', 'Shoulders are the widest part.'], f: [['Escote en V', 'Volumen abajo', 'Faldas con vuelo', 'Pantalón ancho o palazzo'], ['V-neck', 'Volume below', 'Flared skirts', 'Wide or palazzo trousers']] },
  { k: 'rectangulo', n: ['Rectángulo', 'Rectangle'], a: [31, 29, 31], d: ['Hombros, cintura y cadera en línea.', 'Shoulders, waist and hips in line.'], f: [['Crear cintura con cinturón', 'Capas y prendas con estructura', 'Peplum y volantes', 'Vestidos con forma'], ['Create a waist with a belt', 'Layers and structured pieces', 'Peplum and ruffles', 'Shaped dresses']] },
  { k: 'ovalo', n: ['Óvalo', 'Round'], a: [30, 39, 31], d: ['El volumen está en el centro.', 'Volume sits in the middle.'], f: [['Escote en V', 'Líneas verticales', 'Prendas fluidas', 'Chaquetas abiertas y corte imperio'], ['V-neck', 'Vertical lines', 'Fluid pieces', 'Open jackets and empire cut']] },
];
function siluetaSVG([s, w, h]) {
  const L = x => 30 - x / 2, R = x => 30 + x / 2;
  const d = `M${L(s)} 27Q${L(s) - 1} 40 ${L(w)} 58Q${L(h) - 1} 70 ${L(h)} 80L${L(h) + 6} 116M${R(s)} 27Q${R(s) + 1} 40 ${R(w)} 58Q${R(h) + 1} 70 ${R(h)} 80L${R(h) - 6} 116M27 21V25Q${L(s) + 4} 25 ${L(s)} 27M33 21V25Q${R(s) - 4} 25 ${R(s)} 27M30 88V116`;
  return `<svg viewBox="0 0 60 120"><circle cx="30" cy="12" r="7"/><path d="${d}"/></svg>`;
}
function pintarCuerpo() {
  const el = E.perfil?.tipoCuerpo, c = CUERPOS.find(x => x.k === el), es = idioma() === 'en' ? 1 : 0;
  $('tc-sub').textContent = E.perfil?.cuerpo ? t('Elige el que más se parezca a ti. Puedes cambiarlo cuando quieras.', 'Pick the one closest to you. You can change it any time.') : t('Elige el que más se parezca a ti. Puedes cambiarlo cuando quieras.', 'Pick the one closest to you. You can change it any time.');
  $('tc-siluetas').innerHTML = CUERPOS.map(x => `<button class="${x.k === el ? 'on' : ''}" data-tcuerpo="${x.k}">${siluetaSVG(x.a)}<span>${x.n[es]}</span></button>`).join('');
  $('tc-favorece').innerHTML = c ? `<p class="tc-d">${c.d[es]}</p><p class="tc-t">${t('Te favorece', 'Flatters you')}</p><ul class="tc-l">${c.f[es].map(x => `<li>${x}</li>`).join('')}</ul>` : '';
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-tcuerpo]'); if (!b) return;
  E.perfil = E.perfil || {}; E.perfil.tipoCuerpo = b.dataset.tcuerpo; await guardar(); pintarCuerpo();
});

/* ---------- tu estilo (0.36, 22/10, Sheila): el perfil lleva uno o dos estilos y los looks se ordenan según ellos.
   Los seis nombres son los de Sheila. Cada estilo suma o resta a la puntuación de puntuar(); no quita looks, los ordena. ---------- */
const ESTILOS = [ // 0.52 (22/10): los 13 estilos de la Dirección de Moda, aprobados por Gabriela («sí a todos»); diseño C, muestras de color («me gusta con las paletas de colores»). b = reglas de puntos que usa mientras se programan las suyas (orden de Moda: los estilos van al final)
  { k: 'oldmoney', f: 0, n: ['Old money', 'Old money'], d: ['camel, tejidos nobles, sin logos', 'camel, fine fabrics, no logos'], c: ['#f4ecdf', '#c8a77c', '#ffffff', '#24324d'], b: ['basico', 'formal'] },
  { k: 'clasico', f: 0, n: ['Clásico', 'Classic'], d: ['americana, camisa, bien cortado', 'blazer, shirt, well cut'], c: ['#24324d', '#ffffff', '#8d8f93', '#1f1f1f'], b: ['formal'] },
  { k: 'minimalista', f: 0, n: ['Minimalista', 'Minimalist'], d: ['neutros, líneas limpias, poco', 'neutrals, clean lines, less'], c: ['#ffffff', '#e8e2d8', '#9a9a96', '#1f1f1f'], b: ['basico'] },
  { k: 'frances', f: 0, n: ['Francés', 'French'], d: ['rayas, vaquero, sin esfuerzo', 'stripes, denim, effortless'], c: ['#ffffff', '#24324d', '#b3202a', '#6f8fb5'], b: ['basico', 'normal'] },
  { k: 'casual', f: 1, n: ['Casual', 'Casual'], d: ['vaqueros, punto, zapatillas', 'jeans, knits, trainers'], c: ['#6f8fb5', '#efe6d6', '#9a9a96', '#ffffff'], b: ['normal'] },
  { k: 'deportivo', f: 1, n: ['Deportivo chic', 'Athleisure'], d: ['mallas, sudadera, americana', 'leggings, sweatshirt, blazer'], c: ['#1f1f1f', '#e8e2d8', '#9a9a96', '#ffffff'], b: ['normal'] },
  { k: 'urbano', f: 1, n: ['Urbano', 'Streetwear'], d: ['holgado, sudadera, actitud', 'loose, hoodie, attitude'], c: ['#1f1f1f', '#3e5a3a', '#6f8fb5', '#c0c0c8'], b: ['normal'] },
  { k: 'rock', f: 2, n: ['Rock', 'Rock'], d: ['negro, cuero, botas', 'black, leather, boots'], c: ['#1f1f1f', '#3a3a3a', '#c0c0c8', '#7a1f24'], b: ['atrevido'] },
  { k: 'glam', f: 2, n: ['Glam', 'Glam'], d: ['brillo, tacón, noche', 'shine, heels, night'], c: ['#1f1f1f', '#c9a24b', '#b3202a', '#c0c0c8'], b: ['atrevido'] },
  { k: 'retro', f: 2, n: ['Retro', 'Retro'], d: ['años 2000, color, top corto', 'the 2000s, colour, crop top'], c: ['#e3a6a8', '#6f8fb5', '#f2c230', '#ffffff'], b: ['extravagante'] },
  { k: 'eclectico', f: 2, n: ['Ecléctico', 'Eclectic'], d: ['mezcla, estampado, color', 'mix, print, colour'], c: ['#e94b3c', '#f2c230', '#3b7dd8', '#6e8b5e'], b: ['extravagante'] },
  { k: 'romantico', f: 3, n: ['Romántico', 'Romantic'], d: ['vestidos, flores, tonos suaves', 'dresses, florals, soft tones'], c: ['#f3d9dc', '#efe3cc', '#ffffff', '#b9a3c9'], b: ['romantico'] },
  { k: 'boho', f: 3, n: ['Boho', 'Boho'], d: ['tierra, capas, botines', 'earth tones, layers, boots'], c: ['#c99a6b', '#8a5a3b', '#e9dcc5', '#6d7a4f'], b: ['romantico'] },
];
const FAMILIAS = [['Elegante', 'Elegant'], ['De diario', 'Everyday'], ['Con carácter', 'Bold'], ['Suave y libre', 'Soft and free']];
const ESTILO_VIEJO = { basico: 'minimalista', formal: 'clasico', atrevido: 'glam', extravagante: 'eclectico', normal: 'casual' }; // los 6 de la 0.36 pasan a los 13 (Moda, punto 2)
const SUAVES = new Set(['Rosa', 'Blanco', 'Beige', 'Azul claro']);
function puntosEstilo(ps, fuertes, estamp) {
  const el = [...new Set((E.perfil?.estilos || []).flatMap(k => ESTILOS.find(x => x.k === k)?.b || [k]))]; if (!el.length) return 0;
  const ropa = ropaDe(ps), n = nivelRopa(ps), zap = ps.find(p => p.tipo === 'Calzado'), z = zap ? estilo(zap) : 1;
  const nom = ropa.map(p => (p.nombre || '').toLowerCase()).join(' '), vest = ps.some(p => p.tipo === 'Vestidos'), falda = /falda|skirt/.test(nom);
  const neutros = ropa.every(p => NEUTROS.has(p.color));
  let s = 0;
  for (const k of el) {
    if (k === 'romantico') s += (vest ? 1.2 : 0) + (falda ? .8 : 0) + (/blusa|lazo|volante|encaje|blouse/.test(nom) ? .6 : 0) + ropa.filter(p => SUAVES.has(p.color)).length * .4 - (z === 0 ? .8 : 0);
    if (k === 'basico') s += (neutros ? 1.4 : 0) - estamp * 1.2 - (fuertes.length > 1 ? 1 : 0);
    if (k === 'formal') s += Math.max(0, n - 1) * 1.2 + (z >= 2 ? .6 : 0) - (z === 0 ? 1.5 : 0) - (/vaquer|jean/.test(nom) ? .6 : 0);
    if (k === 'atrevido') s += (fuertes.length ? 1.2 : -.6) + (ps.some(p => p.color === 'Rojo') ? .5 : 0) + (z === 3 ? .6 : 0);
    if (k === 'extravagante') s += estamp * 1.2 + (fuertes.length >= 2 ? 1.5 : 0) - (neutros ? 1 : 0);
    if (k === 'normal') s += (n <= 1.3 ? 1 : 0) + (/vaquer|jean/.test(nom) ? .6 : 0) + (z <= 1 ? .5 : 0) - (z === 3 ? .8 : 0);
  }
  return s / el.length;
}
function pintarEstilo() {
  const es = idioma() === 'en' ? 1 : 0;
  if (E.perfil?.estilos?.some(k => ESTILO_VIEJO[k])) { E.perfil.estilos = [...new Set(E.perfil.estilos.map(k => ESTILO_VIEJO[k] || k))]; guardar(); }
  const el = E.perfil?.estilos || [];
  if (E.esFam == null) { const pri = ESTILOS.find(x => x.k === el[0]); E.esFam = pri ? pri.f : 0; }
  $('es-sub').textContent = t('¿Con cuál te identificas? Elige uno o dos.', 'Which one feels like you? Pick one or two.');
  $('es-lista').innerHTML = `<div class="es-fam">${FAMILIAS.map((f, i) => `<button class="${i === E.esFam ? 'on' : ''}" data-esfam="${i}">${f[es]}</button>`).join('')}</div>`
    + `<div class="es-rej">${ESTILOS.filter(x => x.f === E.esFam).map(x => `<button class="${el.includes(x.k) ? 'on' : ''}" data-estilo="${x.k}"><span class="es-tela">${x.c.map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${x.n[es]}</b><span class="es-d">${x.d[es]}</span></button>`).join('')}</div>`
    + `<p class="es-cuenta">${el.map(k => ESTILOS.find(x => x.k === k)?.n[es]).filter(Boolean).join(t(' y ', ' and ')) || '&nbsp;'}</p>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-esfam]'); if (!b) return; E.esFam = +b.dataset.esfam; pintarEstilo(); });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-estilo]'); if (!b) return;
  E.perfil = E.perfil || {}; let el = E.perfil.estilos || []; const k = b.dataset.estilo;
  el = el.includes(k) ? el.filter(x => x !== k) : [...el, k].slice(-2);   // como mucho dos: el tercero sustituye al más antiguo
  E.perfil.estilos = el; await guardar(); pintarEstilo();
});

// 0.25: las funciones de cada plan se marcan con el botón dorado solo al tocarlas (Gabriela: «cuando las selecciones sí salga, pero como predeterminada no»)
document.addEventListener('click', e => { const li = e.target.closest('.plb-fun li'); if (li) li.classList.toggle('on'); });
