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
    r.onsuccess = () => { db = r.result; db.onclose = () => { db = null; }; db.onversionchange = () => { db.close(); db = null; }; res(db); }; // 07/11: Safari cierra a veces la conexión
    r.onerror = () => rej(r.error);
  });
  // 07/11: una transacción que se aborta sin error («datos|null» en los avisos) dice ahora por qué; si la conexión estaba cerrada, se abre otra y se repite una vez
  const enTx = (modo, f, alFinal) => abrir().then(d => { let tx; try { tx = d.transaction('kv', modo); } catch (e) { db = null; return abrir().then(d2 => enTxCon(d2.transaction('kv', modo), f, alFinal)); } return enTxCon(tx, f, alFinal); });
  const enTxCon = (tx, f, alFinal) => new Promise((res, rej) => { const q = f(tx.objectStore('kv')); tx.oncomplete = () => res(alFinal(q)); tx.onerror = () => rej(tx.error || new Error('idb error')); tx.onabort = () => rej(tx.error || new Error('idb abortada')); });
  const op = (modo, f) => enTx(modo, f, q => q.result);
  // 07/11 (Gabriela: «en el móvil las fotos no se cargan, las del diagnóstico»): Safari pierde los ficheros (Blob) guardados en IndexedDB («The object can not be
  // found here»; su móvil rehízo 107 fotos de prendas dos veces en 40 min). Las prendas se recuperan de la nube, pero la selfie, la foto de cuerpo, el avatar y los
  // looks puestos solo viven aquí: se guardan como bytes dentro del registro, que Safari no pierde. Al leer, una foto que ya no se puede abrir se quita (se pide otra vez)
  const CRUDO = new Set(['perfil', 'puestos']);
  const aBytes = async o => { if (!o || typeof o !== 'object') return o; const r = { ...o };
    for (const [k, v] of Object.entries(o)) if (v instanceof Blob) { try { r[k] = { __bytes: await v.arrayBuffer(), t: v.type }; } catch (e) { delete r[k]; } } return r; };
  const deBytes = async o => { if (!o || typeof o !== 'object') return o; const r = { ...o };
    for (const [k, v] of Object.entries(o)) {
      if (v && v.__bytes instanceof ArrayBuffer) r[k] = new Blob([v.__bytes], { type: v.t || 'image/jpeg' });
      else if (v instanceof Blob) { try { await v.slice(0, 16).arrayBuffer(); } catch (e) { delete r[k]; } } // guardada a la antigua y ya perdida
    } return r; };
  // 07/11 (Gabriela: «las fotos siguen sin cargar en el móvil; la app debería guardarlas, no depender de nada»): las fotos de las prendas, igual. Cada foto va a su propia
  // clave («f:<prenda>:<campo>») como bytes, y solo cuando cambia (las ya guardadas se recuerdan en GUARDADAS); la lista de prendas lleva solo la referencia. Las que se
  // guardaron a la antigua y Safari perdió las sigue arreglando repararFotos (las baja de la nube) y, desde ahí, se guardan ya como bytes
  const GUARDADAS = new WeakMap(), CAMPOS_FOTO = new Set(); let cola = Promise.resolve();
  const opMuchas = (modo, f) => enTx(modo, f, r => r);
  async function ponerPrendas(lista) {
    const nuevas = [], fuera = [], arr = [];
    for (const p of lista || []) { const q = { ...p };
      for (const [c, v] of Object.entries(p)) if (v instanceof Blob) { const k = `f:${p.id}:${c}`; CAMPOS_FOTO.add(c);
        if (GUARDADAS.get(v) !== k) { try { nuevas.push([k, { __bytes: await v.arrayBuffer(), t: v.type }, v]); } catch (e) { q[c] = v; continue; } } // perdida: se queda como estaba
        q[c] = { __ref: k }; }
      arr.push(q); }
    const usadas = new Set(arr.flatMap(q => Object.values(q).filter(v => v && v.__ref).map(v => v.__ref)));
    // 07/11 (Gabriela: «1. sí», como Instagram: la cuenta es la dueña de las fotos y el móvil solo guarda una copia): las fotos van de 8 en 8, cada tanda en su
    // transacción (antes, las 107 en una sola, unos 20 MB, y si Safari la abortaba no se guardaba nada). Si una tanda falla, esas fotos siguen en la memoria y en
    // la cuenta: al volver a abrir se bajan otra vez (bajarNube) y se reintenta guardarlas
    let fallo = null;
    for (let i = 0; i < nuevas.length; i += 8) { const tanda = nuevas.slice(i, i + 8);
      try { await opMuchas('readwrite', st => { for (const [k, v] of tanda) st.put(v, k); }); for (const [k, , b] of tanda) GUARDADAS.set(b, k); } catch (e) { fallo = fallo || e; } }
    await opMuchas('readwrite', st => { st.put(arr, 'prendas'); const q = st.getAllKeys(); q.onsuccess = () => { for (const k of q.result) if (typeof k === 'string' && k.startsWith('f:') && !usadas.has(k)) st.delete(k); }; });
    if (fallo) try { avisarFallo('copia', fallo); } catch (e) { }
  }
  async function leerPrendas(arr) {
    if (!Array.isArray(arr)) return arr;
    const refs = arr.flatMap(p => Object.values(p).filter(v => v && v.__ref).map(v => v.__ref)), bytes = {};
    if (refs.length) await opMuchas('readonly', st => { for (const k of refs) { const q = st.get(k); q.onsuccess = () => { bytes[k] = q.result; }; } });
    return arr.map(p => { const q = { ...p };
      for (const [c, v] of Object.entries(p)) if (v && v.__ref) { const b = bytes[v.__ref]; if (b && b.__bytes instanceof ArrayBuffer) { q[c] = new Blob([b.__bytes], { type: b.t || 'image/jpeg' }); GUARDADAS.set(q[c], v.__ref); } else delete q[c]; }
      return q; });
  }
  let parado = false; // 10/11: mientras se intercambian los clósets, nada escribe la ropa (un guardado viejo pisaría el cambio)
  return { parar: v => { parado = v; }, cerrar: () => { if (db) db.close(); db = null; }, get: k => op('readonly', s => s.get(k)).then(v => k === 'prendas' ? leerPrendas(v) : CRUDO.has(k) ? deBytes(v) : v),
    // en cola: pasar fotos a bytes lleva su tiempo y un guardado viejo no puede pisar a uno más nuevo
    set: (k, v) => parado && ['prendas', 'conjuntos', 'agenda', 'alfas'].includes(k) ? Promise.resolve() : (cola = cola.catch(() => { }).then(async () => { if (k === 'prendas') return ponerPrendas(v); if (CRUDO.has(k)) v = await aBytes(v); return op('readwrite', s => s.put(v, k)); })), del: k => op('readwrite', s => s.delete(k)), claves: () => op('readonly', s => s.getAllKeys()) };
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
const COLORES = [['Negro', '#1B1B1B'], ['Antracita', '#3B3D42'], ['Gris', '#8E8E8E'], ['Gris claro', '#C8C8C6'], ['Blanco', '#F4F4F4'], ['Crema', '#F1E8D6'], ['Beige', '#D8C7A8'], ['Nude', '#E2C2A6'], ['Camel', '#B98A4F'], ['Marrón', '#6B4A2B'], ['Chocolate', '#4A2E1F'],
  ['Rojo', '#B4332E'], ['Burdeos', '#6E1F2B'], ['Rosa', '#E6B4BC'], ['Fucsia', '#C8217A'], ['Coral', '#EE7766'], ['Melocotón', '#F3BE9E'], ['Naranja', '#D97B3A'], ['Terracota', '#B8603F'], ['Mostaza', '#C9962B'], ['Amarillo', '#E1C04A'], ['Mantequilla', '#F2E3A2'],
  ['Verde menta', '#A9DCC3'], ['Verde salvia', '#9DAE8C'], ['Verde', '#4E7A4A'], ['Verde oliva', '#5F6436'], ['Caqui', '#8A8358'], ['Verde botella', '#1E4A34'], ['Azul claro', '#8FB2CC'], ['Turquesa', '#26A69A'], ['Azul eléctrico', '#2B54D6'], ['Azul', '#2F4E7A'], ['Azul petróleo', '#1D5260'], ['Azul marino', '#1F2B47'],
  ['Lila', '#B9A3CF'], ['Morado', '#6E4C86'], ['Dorado', '#C6A24E'], ['Plateado', '#BFC1C6'], ['Estampado', 'repeating-linear-gradient(45deg,#C9A24B 0 6px,#fff 6px 12px)']];
// 11/11 (Sheila, mensaje 1996: «una gama de colores más actual… quiero actualizar la prenda con verde menta y no me deja»): de 21 a 39, por familias; el nombre sale al elegir
const COLOR_EN = { Negro: 'Black', Antracita: 'Charcoal', Gris: 'Grey', 'Gris claro': 'Light grey', Blanco: 'White', Crema: 'Cream', Beige: 'Beige', Nude: 'Nude', Camel: 'Camel', Marrón: 'Brown', Chocolate: 'Chocolate', Rojo: 'Red', Burdeos: 'Burgundy', Rosa: 'Pink', Fucsia: 'Fuchsia', Coral: 'Coral', Melocotón: 'Peach', Naranja: 'Orange', Terracota: 'Terracotta', Mostaza: 'Mustard', Amarillo: 'Yellow', Mantequilla: 'Butter yellow', 'Verde menta': 'Mint green', 'Verde salvia': 'Sage green', Verde: 'Green', 'Verde oliva': 'Olive green', Caqui: 'Khaki', 'Verde botella': 'Bottle green', 'Azul claro': 'Light blue', Turquesa: 'Turquoise', 'Azul eléctrico': 'Electric blue', Azul: 'Blue', 'Azul petróleo': 'Teal', 'Azul marino': 'Navy', Lila: 'Lilac', Morado: 'Purple', Dorado: 'Gold', Plateado: 'Silver', Estampado: 'Print' };
const nomColor = c => idioma() === 'en' ? COLOR_EN[c] || c : c;

/* ---------- idioma ---------- */
const T = {
  ac_crear: ['Crea tu clóset', 'Create your closet'], ac_nombre: ['Tu nombre', 'Your name'], ac_ciudad: ['Tu ciudad', 'Your city'], ac_ubic: ['Usar mi ubicación', 'Use my location'],
  ac_nota: ['La ciudad es solo para el tiempo. Con correo, tu clóset se guarda en tu cuenta. Tu selfie y tu foto de cuerpo se quedan en tu móvil, salvo que elijas guardarlas también en tu cuenta.', 'The city is only for the weather. With an email your closet is saved to your account. Your selfie and body photo stay on your phone unless you choose to keep them in your account too.'], ac_clave_pista: ['mínimo 8 caracteres', 'at least 8 characters'],
  ac_silueta: ['Tu silueta', 'Your silhouette'], ac_sil_sub: ['Con estas dos fotos la app saca tu tipo de cuerpo y tus colores. Sirven para todo: no te las volverá a pedir.', 'With these two photos the app works out your body type and colours. They are used for everything: you will not be asked again.'], ac_cuerpo: ['Tu tipo de cuerpo', 'Your body type'], ac_estilo: ['Tu estilo', 'Your style'], ac_consejo: ['Luz natural, de frente y sin filtros.', 'Natural light, facing the camera, no filters.'], ac_luego: ['Ahora no', 'Not now'],
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
  nombre_prenda: ['Nombre', 'Name'], tipo: ['Tipo', 'Type'], categoria: ['Categoría', 'Category'], estacion: ['Estación', 'Season'], tiro_q: ['¿Dónde te llega la cinturilla?', 'Where does the waistband sit?'], tiro_ay: ['El punto dorado es el ombligo. Si no lo sabes, déjalo sin marcar.', 'The gold dot is your navel. If unsure, leave it blank.'], largo_q: ['¿Hasta dónde te llega?', 'Where does it end?'], largo_ay: ['El punto dorado es el ombligo. Con esto sé si va por dentro o por fuera y qué pantalones le van.', 'The gold dot is your navel. It tells me whether to tuck it in and which trousers suit it.'], precio: ['Precio (si quieres)', 'Price (optional)'], color: ['Color', 'Colour'], notas: ['Notas (talla, tienda, cuidado…)', 'Notes (size, shop, care…)'],
  guardar_closet: ['Guardar en mi clóset', 'Save to my closet'], guardar_otra: ['Guardar y añadir otra', 'Save and add another'], guardar_cambios: ['Guardar cambios', 'Save changes'],
  editar: ['Editar', 'Edit'], veces: ['veces puesta', 'times worn'], ultima: ['última vez', 'last worn'], conjuntos_min: ['conjuntos', 'outfits'], hoy_llevo: ['Hoy llevo esto', 'Wearing this today'],
  asi: ['Así te queda', 'How it looks on you'], ver_conjuntos: ['Ver conjuntos', 'See outfits'], conjuntos: ['Conjuntos', 'Outfits'], nuevo_conjunto: ['Nuevo conjunto', 'New outfit'],
  nombre_conjunto: ['Nombre', 'Name'], ocasion: ['Ocasión', 'Occasion'], elige_prendas: ['Elige las prendas', 'Pick the garments'], guardar_conjunto: ['Guardar conjunto', 'Save outfit'], me_lo_pongo: ['Me lo pongo', 'I’ll wear it'],
  yo: ['Yo', 'Me'], yo_tu: ['Mi clóset da para', 'My closet makes'], yo_aj: ['Ajustes', 'Settings'], t_hoy: ['Hoy', 'Today'], t_closet: ['Clóset', 'Closet'], t_anadir: ['Subir', 'Upload'], subir_titulo: ['Subir prendas', 'Upload garments'], subir_h1: ['Tu ropa, como en un catálogo', 'Your clothes, like a catalogue'], subir_sub: ['Hasta 20 fotos: una prenda por foto, sobre un fondo liso. La app pone el fondo en blanco y te propone tipo y color.', 'Up to 20 photos: one garment per photo, on a plain background. The app whitens the background and suggests type and colour.'], t_conjuntos: ['Looks', 'Looks'], t_yo: ['Yo', 'Me'],
};
const idioma = () => (E.perfil?.idioma) || localStorage.getItem('tc_idioma') || 'es';
const t = (es, en) => idioma() === 'en' ? en : es;
function traducir() {
  const l = idioma(); document.documentElement.lang = l;
  document.querySelectorAll('[data-t]').forEach(el => { const v = T[el.dataset.t]; if (v) el.innerHTML = l === 'en' ? v[1] : v[0]; });
  document.querySelectorAll('[data-ph]').forEach(el => { const v = T[el.dataset.ph]; if (v) el.placeholder = l === 'en' ? v[1] : v[0]; });
  document.querySelectorAll('[data-idioma]').forEach(b => b.classList.toggle('activo', b.dataset.idioma === l));
}
const tipoNombre = tp => ({ Arriba: ['Tops', 'Tops'], Abajo: ['Pantalones y faldas', 'Trousers and skirts'], // 0.77 (Gabriela: «una de arriba, una de abajo: esto es feo decirlo así»)
  Vestidos: ['Vestidos', 'Dresses'], Abrigo: ['Abrigo', 'Outerwear'], Calzado: ['Calzado', 'Shoes'], Bolsos: ['Bolsos', 'Bags'], Accesorios: ['Accesorios', 'Accessories'], Todo: ['Todo', 'All'] }[tp] || [tp, tp])[idioma() === 'en' ? 1 : 0];
const estNombre = e => ({ 'Todo el año': ['Todo el año', 'All year'], Verano: ['Verano', 'Summer'], Entretiempo: ['Entretiempo', 'In-between'], Invierno: ['Invierno', 'Winter'] }[e] || [e, e])[idioma() === 'en' ? 1 : 0];
const ocNombre = o => ({ Diario: ['Diario', 'Everyday'], Oficina: ['Oficina', 'Office'], Noche: ['Noche', 'Night'], Deporte: ['Deporte', 'Sport'], Evento: ['Evento', 'Event'], Viaje: ['Viaje', 'Travel'] }[o] || [o, o])[idioma() === 'en' ? 1 : 0];
const veces = n => `${n} ${n === 1 ? t('vez', 'time') : t('veces', 'times')}`;
const fecha = (iso, corta) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString(idioma() === 'en' ? 'en-GB' : 'es-ES', corta ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long' }); };

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
// 08/11 (estudio de diseño, cambio 16): sin la barra de abajo (alta, editar, nuevo look) o con una capa encima, el aviso sale arriba: abajo tapaba el botón de seguir
// 11/11 (análisis de la app, puntos 31, 46, 59 y 95): un aviso puede llevar una acción («Deshacer», 8 s) y el que no la lleva se quita al cambiar de pantalla (ir), para que no salga en otra
let toastT, toastAt = 0; function toast(m, accion) { const e = $('toast'); e.textContent = m; if (accion) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-acc'; b.textContent = accion[0]; b.onclick = () => { clearTimeout(toastT); e.classList.remove('visible', 'con-acc'); accion[1](); }; e.append(' ', b); } e.classList.toggle('con-acc', !!accion); e.classList.toggle('arriba', $('tabs').classList.contains('oculta') || !!document.querySelector('.ay-capa, .pn-capa, .sp-capa')); e.classList.add('visible'); clearTimeout(toastT); toastAt = Date.now(); toastT = setTimeout(() => e.classList.remove('visible', 'con-acc'), accion ? 8000 : 2200); }
function quitarToast() { const e = $('toast'); if (!e.classList.contains('visible') || e.classList.contains('con-acc') || Date.now() - toastAt < 400) return; clearTimeout(toastT); e.classList.remove('visible'); }
function confirmar(titulo, texto, si, no) { return new Promise(res => { $('dlg-t').textContent = titulo; $('dlg-p').textContent = texto; $('dlg-si').textContent = si || t('Sí', 'Yes'); $('dlg-no').textContent = no || t('Cancelar', 'Cancel'); const d = $('dlg'); d.showModal(); $('dlg-si').onclick = () => { d.close(); res(true); }; $('dlg-no').onclick = () => { d.close(); res(false); }; }); }
// 06/11: si se cambia la foto de una prenda, la de catálogo ya no es de esa foto: se quita (también de la nube) y la nueva vuelve a ser la suya
function quitarCat(p) { if (!p || !(p.cat || p.conCat)) return; if (p.conCat) api('/api/foto/' + p.id + '-c', { method: 'DELETE' }).catch(() => { }); p.cat = null; urlsCat.delete(p.id); for (const k of ['conCat', 'nubeC', 'catAR', 'fCat']) delete p[k]; }
const urlsCat = new Map(); function urlCat(p) { if (!p) return ''; if (!p.cat) return urlFoto(p); if (!urlsCat.has(p.id)) urlsCat.set(p.id, URL.createObjectURL(p.cat)); return urlsCat.get(p.id); } // 0.121
function urlFoto(p) { if (!p) return ''; if (p.src) return p.src; if (!p.foto) return ''; if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.foto)); return urls.get(p.id); }
const P = id => E.prendas.find(p => p.id === id);
const activas = () => verPrendas().filter(p => !['guardada', 'donar'].includes(p.estado));
async function guardar() { await BD.set('perfil', E.perfil); await BD.set('prendas', E.prendas); await BD.set('conjuntos', E.conjuntos); await BD.set('agenda', E.agenda); programarNube(); }

/* ---------- mis colores (0.73): colorimetría ligera de la primera versión, sin foto ---------- */
// Decidido por las dos (18/10, «el punto 3 sí»): colorimetría ligera en la 1.0. Cuatro preguntas y una de las cuatro estaciones clásicas;
// es una orientación, no un diagnóstico (R6): se cambia cuando quiera. Con foto (selfie) llegará en el Pro.
const PREG_COLOR = [
  ['venas', ['Las venas de tu muñeca, a la luz del día', 'The veins on your wrist, in daylight'], [['c', 'Verdosas', 'Greenish'], ['f', 'Azuladas o moradas', 'Bluish or purple'], ['n', 'No lo tengo claro', 'Not sure']]],
  ['metal', ['¿Qué te queda mejor cerca de la cara?', 'What suits you best near your face?'], [['c', 'Oro', 'Gold'], ['f', 'Plata', 'Silver'], ['n', 'Los dos', 'Both']]],
  ['tono', ['Tu piel y tu pelo, en conjunto', 'Your skin and hair, overall'], [['cl', 'Claros', 'Light'], ['me', 'Medios', 'Medium'], ['os', 'Oscuros', 'Deep']]],
  ['contraste', ['Entre tu piel, tu pelo y tus ojos hay…', 'Between your skin, hair and eyes there is…'], [['al', 'Mucho contraste', 'High contrast'], ['ba', 'Poco contraste', 'Low contrast']]]];
const EST_COLOR = {
  primavera: { n: ['Primavera', 'Spring'], d: ['Cálida y luminosa: colores vivos y claros, con un punto dorado.', 'Warm and bright: clear, light colours with a golden touch.'], si: ['Camel', 'Beige', 'Crema', 'Amarillo', 'Naranja', 'Verde', 'Azul claro', 'Rosa'], no: ['Negro', 'Gris', 'Morado', 'Burdeos'], hex: ['#F2C9A0', '#F4A582', '#E8C547', '#8DBF6A', '#7FB8D6', '#F28C8C', '#C9A24B'] },
  verano: { n: ['Verano', 'Summer'], d: ['Fría y suave: tonos empolvados, grises azulados y pasteles.', 'Cool and soft: dusty shades, blue greys and pastels.'], si: ['Rosa', 'Azul claro', 'Gris', 'Morado', 'Lila', 'Azul', 'Blanco'], no: ['Naranja', 'Amarillo', 'Mostaza', 'Terracota', 'Camel'], hex: ['#D9A6B5', '#9DB4CF', '#A7A9B8', '#9C89B8', '#5F7FA8', '#E8E4EA', '#7A8C99'] },
  otono: { n: ['Otoño', 'Autumn'], d: ['Cálida y profunda: tierras, mostaza, verde oliva y teja.', 'Warm and deep: earth tones, mustard, olive and rust.'], si: ['Camel', 'Marrón', 'Verde', 'Caqui', 'Naranja', 'Terracota', 'Mostaza', 'Burdeos', 'Beige', 'Crema', 'Amarillo', 'Rojo'], no: ['Rosa', 'Gris', 'Azul claro', 'Lila'], hex: ['#B98A4F', '#6B4A2B', '#6B7A3A', '#C2662D', '#D8C7A8', '#C9A227', '#9C3A2A'] },
  invierno: { n: ['Invierno', 'Winter'], d: ['Fría e intensa: blanco y negro, colores puros y contraste.', 'Cool and intense: black and white, pure colours and contrast.'], si: ['Negro', 'Blanco', 'Rojo', 'Burdeos', 'Azul', 'Morado', 'Gris', 'Rosa'], no: ['Beige', 'Crema', 'Camel', 'Naranja', 'Terracota', 'Mostaza', 'Caqui', 'Marrón'], hex: ['#1B1B1B', '#F7F7F7', '#B4122E', '#1F3F8A', '#5B2A86', '#C2185B', '#8E8E8E'] } };
function estacionColor(r) {
  const temp = ['venas', 'metal'].reduce((a, k) => a + (r[k] === 'c' ? 1 : r[k] === 'f' ? -1 : 0), 0);
  const fuerte = r.contraste === 'al' || r.tono === 'os', claro = r.tono === 'cl' || r.contraste === 'ba';
  if (temp > 0) return fuerte && !claro ? 'otono' : r.tono === 'os' ? 'otono' : 'primavera';
  if (temp < 0) return fuerte ? 'invierno' : 'verano';
  return fuerte ? (r.tono === 'os' ? 'otono' : 'invierno') : 'verano';
}
// en Hoy: la prenda que va junto a la cara (arriba, vestido o abrigo) suma si es de tus colores y resta un poco si es de los de lejos de la cara
function puntosColores(ps) {
  const dc = E.perfil?.diag?.color, e = dc?.si ? dc : EST_COLOR[E.perfil?.colores?.est]; if (!e) return 0; // 0.12: con diagnóstico, la paleta de su estación (de las 12)
  const cara = ps.find(p => p.tipo === 'Arriba') || ps.find(p => p.tipo === 'Vestidos') || ps.find(p => p.tipo === 'Abrigo'); if (!cara) return 0;
  return e.si.includes(cara.color) ? .7 : e.no.includes(cara.color) ? -.5 : 0;
}
function pintarMisColores() {
  const es = idioma() === 'en' ? 1 : 0, c = E.perfil?.colores || {}, r = c.r || {}, listo = PREG_COLOR.every(([k]) => r[k]);
  const est = listo ? estacionColor(r) : null, e = EST_COLOR[est];
  const mios = e ? [...new Set(E.prendas.filter(p => e.si.includes(p.color) && ['Arriba', 'Vestidos', 'Abrigo'].includes(p.tipo)).map(p => p.id))].slice(0, 6) : [];
  $('co-raiz').innerHTML = `<p class="co-sub">${t('Cuatro preguntas para saber qué colores te favorecen cerca de la cara. Mírate a la luz del día, sin maquillaje fuerte.', 'Four questions to find the colours that suit you near your face. Look in daylight, without heavy make-up.')}</p>`
    + PREG_COLOR.map(([k, q, ops]) => `<div class="co-preg"><b>${q[es]}</b><div class="co-ops">${ops.map(([v, a, b]) => `<button class="${r[k] === v ? 'on' : ''}" aria-pressed="${r[k] === v}" data-copreg="${k}" data-coval="${v}">${es ? b : a}</button>`).join('')}</div></div>`).join('')
    // 06/11: con la foto de la cara, las respuestas afinan el diagnóstico (no dan otra estación aparte)
    + (E.perfil?.selfie && E.perfil?.diag?.color ? (listo ? `<div class="co-res dx-volver"><p>${t('Tus respuestas ya cuentan en tu diagnóstico.', 'Your answers now count in your analysis.')}</p><button class="boton" data-diag="ver-color">${t('Ver mis colores', 'See my colours')}</button></div>` : '') : e ? `<div class="co-res"><span class="mini-et">${t('Tu estación', 'Your season')}</span><h2>${e.n[es]}</h2><p>${e.d[es]}</p>
      <div class="co-tela">${e.hex.map(h => `<i style="background:${h}"></i>`).join('')}</div>
      <div class="co-dos"><div><span class="mini-et">${t('Te favorecen', 'Suit you')}</span><p>${e.si.map(x => colNom(x)).join(', ')}</p></div><div><span class="mini-et">${t('Mejor lejos de la cara', 'Better away from your face')}</span><p>${e.no.map(x => colNom(x)).join(', ')}</p></div></div>
      ${mios.length ? `<span class="mini-et">${t('De tu clóset, para la cara', 'From your closet, for your face')}</span><div class="co-mias">${mios.map(id => `<button data-ficha="${id}" aria-label="${escH(P(id)?.nombre || '')}"><img src="${urlCat(P(id))}" alt=""></button>`).join('')}</div>` : ''}
      <p class="co-nota">${t('Es una orientación, no una regla: si un color te hace feliz, póntelo. Hoy ya tiene en cuenta tus colores.', 'A guide, not a rule: if a colour makes you happy, wear it. Today already takes your colours into account.')}</p></div>` : '');
}
const colNom = c => idioma() === 'en' ? ({ Negro: 'black', Blanco: 'white', Gris: 'grey', Beige: 'beige', Camel: 'camel', Marrón: 'brown', Rojo: 'red', Rosa: 'pink', Naranja: 'orange', Amarillo: 'yellow', Verde: 'green', 'Azul claro': 'light blue', Azul: 'blue', Morado: 'purple' }[c] || c) : c.toLowerCase();
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-copreg]'); if (!b) return;
  E.perfil = E.perfil || {}; const c = E.perfil.colores = E.perfil.colores || { r: {} }; c.r = c.r || {}; c.r[b.dataset.copreg] = b.dataset.coval;
  c.est = PREG_COLOR.every(([k]) => c.r[k]) ? estacionColor(c.r) : null; E.propuestas = []; await guardar(); pintarMisColores();
  if (c.est && b.dataset.copreg === 'contraste') $('p-colores').scrollTo({ top: 9999, behavior: 'smooth' });
});

/* ---------- cuenta y nube (0.73) ---------- */
// Gabriela, 23/10: «crea la opción de las cuentas, para desde la mía empezar a subir mi ropa e ir haciendo pruebas reales».
// Con cuenta, el clóset «Mi ropa» se guarda también en el servidor (Cloudflare) y se recupera en cualquier móvil; el de «Pruebas» no.
// Las fotos de la selfie y del cuerpo no se suben nunca (R4): se quedan en el móvil.
const API = (() => { try { const q = localStorage.getItem('tc_api'); if (q) return q; } catch (e) { } return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8787' : 'https://tucloset-api.apptucloset.workers.dev'; })();
// mientras el servidor no esté publicado, la web pública no enseña las cuentas (en local, sí, con el servidor de pruebas)
const NUBE = true; // 0.76: servidor publicado en Cloudflare (tucloset-api.apptucloset.workers.dev)
const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } } };
let ORIGEN = ''; // 09/11: la red desde la que llegó esta visita (?o=ig|tt|pin…); vive solo mientras la página está abierta
const cuenta = () => { if (CLOSET_ACT || !NUBE) return null; try { return JSON.parse(LS.get('tc_cuenta') || 'null'); } catch (e) { return null; } };
// 09/11 (Gabriela: «acabo de abrir el perfil de Sheila desde mi móvil… se ha unido al mío y ha sumado sus prendas a mi clóset; una cuenta enlazada a un clóset, no
// mezclar, Instagram no funciona así»): al cerrar sesión el móvil se quedaba con el clóset y, al entrar en otra cuenta, bajarNube lo juntaba con el de esa cuenta y
// subía la mezcla. Ahora el clóset de este móvil es de una sola cuenta (tc_dueno): al cerrar sesión se quita del móvil y, al entrar en otra cuenta, se vacía antes
const LS_CUENTA = ['tc_cuenta', 'tc_dueno', 'tc_catf', 'tc_reinicio', 'tc_nube_ver', 'tc_nube_ids', 'tc_nube_borradas', 'tc_nube_cuando', 'tc_cuenta_creada', 'tc_encuesta_hecha', 'tc_encuesta_luego', 'tc_uso_dia', 'tc_puestos_orden', 'tc_avatar_fijo', 'tc_ver_avatar', 'tc_bajada_selfie', 'tc_bajada_cuerpo', 'tc_bajada_avatar', 'tc_sinc_v', 'tc_pu_f', 'tc_pu_v', 'tc_diag_caras', 'tc_diag_medidas', 'tc_cintura', 'tc_looks', 'tc_plan', 'tc_ropa_vista', 'tc_tiempo', 'tc_admin', 'tc_intercambio', 'tc_pareja'];
const dueno = () => (LS.get('tc_dueno') || '').toLowerCase();
try { const c0 = JSON.parse(LS.get('tc_cuenta') || 'null'); if (c0?.correo && !LS.get('tc_dueno')) LS.set('tc_dueno', c0.correo.toLowerCase()); } catch (e) { } // móviles de antes: el clóset es de la cuenta abierta
const deCuenta = p => !p.ejemplo && !!(p.nube || p.nubeC || p.fotoSub); // la prenda ya estuvo en alguna cuenta
async function vaciarMovil() {
  for (const k of await BD.claves()) await BD.del(k);
  LS_CUENTA.forEach(k => LS.set(k, null));
  E.prendas = []; E.conjuntos = []; E.agenda = {}; E.perfil = {}; E.puestos = {}; E.propuestas = []; E.generados = []; urls.clear(); urlsCat.clear(); alfa.clear();
}
async function api(ruta, op = {}) {
  const c = cuenta(), h = { ...(op.headers || {}) }; if (c?.token) h.Authorization = 'Bearer ' + c.token;
  if (op.json !== undefined) { h['Content-Type'] = 'application/json'; op.body = JSON.stringify(op.json); }
  // 0.146 (Gabriela, 03/11: «entro y no se carga, se queda ahí pensando»): cada llamada tiene un tiempo máximo; una foto colgada ya no deja la app esperando
  const ac = op.tiempo && typeof AbortController === 'function' ? new AbortController() : null, tm = ac && setTimeout(() => ac.abort(), op.tiempo);
  let r; try { r = await fetch(API + ruta, { method: op.method || 'GET', headers: h, body: op.body, signal: ac?.signal }); } catch (e) { throw ac?.signal.aborted ? new Error('tiempo ' + Math.round(op.tiempo / 1000) + ' s') : e; } finally { clearTimeout(tm); }
  if (r.status === 401 && c && !/alta|entrar/.test(ruta)) { LS.set('tc_cuenta', null); toast(t('Tu sesión ha caducado: vuelve a entrar', 'Your session expired: sign in again')); }
  return r;
}
async function subirFoto(ruta, b) {
  const fb = await aptaNube(b); let cuerpo;
  try { cuerpo = await fb.arrayBuffer(); } catch (e) { throw new Error('leer ' + (e?.message || e)); }
  const r = await api(ruta, { method: 'PUT', body: cuerpo, headers: { 'Content-Type': fb.type || 'image/jpeg' }, tiempo: 45000 }); if (!r.ok) throw new Error('http ' + r.status);
}
const sinBlobs = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => !(v instanceof Blob)));
const firma = b => b ? b.size + ':' + (b.type || '') : '';
// el servidor admite fotos de hasta 1,9 MB: las más grandes se rehacen en WebP (conserva el fondo transparente)
// 0.113 (Gabriela, 28/10: en su iPhone tenía 29 prendas y en la cuenta 25; el iPhone entraba en la cuenta pero no subía nada): Safari no siempre
// abre con createImageBitmap las fotos de la cámara y no sabe hacer WebP (devuelve PNG, más pesado); ahora se abre también con <img> y,
// si el WebP no sale, se hace JPEG sobre blanco
async function abrirImagen(b) {
  try { return await createImageBitmap(b); } catch (e) { }
  const u = URL.createObjectURL(b); try { const im = new Image(); im.src = u; await im.decode(); return im; } finally { setTimeout(() => URL.revokeObjectURL(u), 1000); }
}
async function aptaNube(b) {
  if (b.size <= 1.8e6) return b;
  const bm = await abrirImagen(b), W = bm.naturalWidth || bm.width, H = bm.naturalHeight || bm.height; let k = Math.min(1, 1400 / Math.max(W, H)), out = b;
  for (let i = 0; i < 5 && out.size > 1.8e6; i++, k *= .8) {
    const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const x = c.getContext('2d');
    x.drawImage(bm, 0, 0, c.width, c.height); let o = await new Promise(r => c.toBlob(r, 'image/webp', .85));
    if (!o || o.type !== 'image/webp') { x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); o = await new Promise(r => c.toBlob(r, 'image/jpeg', .85)); }
    if (o) out = o;
  }
  return out;
}
// si algo falla al guardar en la nube, se avisa al servidor con el paso y el error (sin datos de la prenda), para poder arreglarlo
const avisarFallo = (paso, e, b) => { try { fetch(API + '/api/aviso?d=' + encodeURIComponent(`${paso}|${String(e?.message || e).slice(0, 160)}|${b ? (b.type || '?') + ':' + b.size : ''}`)).catch(() => { }); } catch (x) { } };
function docLocal() {
  // 06/11 (Gabriela: «no se guardan las medidas»): las medidas solo vivían en el móvil donde se apuntaban; entraba desde tres sitios (Safari, la app del inicio
  // y el ordenador) y en los otros no estaban. Ahora van con la cuenta, como el diagnóstico; las fotos siguen solo en el móvil
  return { perfil: sinBlobs({ ...E.perfil }), conjuntos: E.conjuntos, agenda: E.agenda, borradas: JSON.parse(LS.get('tc_nube_borradas') || '[]'), reinicio: LS.get('tc_reinicio') || undefined,
    prendas: E.prendas.filter(p => !p.ejemplo).map(p => ({ ...sinBlobs(p), conFoto: !!p.foto, conOriginal: !!p.original })) };
}
E.nube = { estado: '', cuando: LS.get('tc_nube_cuando') || '' };
let nubeT, nubeEnCurso = null, INTERCAMBIO = false;
function programarNube() { if (!cuenta() || INTERCAMBIO) return; clearTimeout(nubeT); nubeT = setTimeout(() => subirNube().catch(() => { }), 2500); }
async function subirNube(reintento) {
  if (!cuenta()) return; if (nubeEnCurso) { await nubeEnCurso; return programarNube(); }
  nubeEnCurso = (async () => {
    E.nube.estado = 'subiendo'; pintarCuentaSiToca();
    try {
      // borradas desde la última subida: se apuntan para que los otros móviles también las quiten, y su foto se borra del servidor
      const antes = JSON.parse(LS.get('tc_nube_ids') || '[]'), ahora = E.prendas.filter(p => !p.ejemplo).map(p => p.id);
      const fuera = antes.filter(id => !ahora.includes(id)); if (fuera.length) { const b = new Set(JSON.parse(LS.get('tc_nube_borradas') || '[]')); fuera.forEach(id => b.add(id)); LS.set('tc_nube_borradas', JSON.stringify([...b].slice(-2000))); for (const id of fuera) { api('/api/foto/' + id, { method: 'DELETE' }).catch(() => { }); api('/api/foto/' + id + '-o', { method: 'DELETE' }).catch(() => { }); api('/api/foto/' + id + '-c', { method: 'DELETE' }).catch(() => { }); } }
      // 0.146: los datos van primero, para que las prendas lleguen a la cuenta aunque una foto tarde o falle; después, las fotos y, si sube alguna, otra vez los datos con su marca
      const ponerDatos = async () => {
        const r = await api('/api/datos', { method: 'PUT', json: { doc: docLocal(), version: +(LS.get('tc_nube_ver') || 0) }, tiempo: 40000 });
        if (r.status === 409) return null; if (!r.ok) throw new Error('datos ' + r.status);
        const d = await r.json(); LS.set('tc_nube_ver', d.version); LS.set('tc_nube_ids', JSON.stringify(ahora)); LS.set('tc_nube_cuando', d.actualizado); LS.set('tc_intercambio', null); return d;
      };
      let d = await ponerDatos();
      if (!d) { if (reintento) throw new Error('datos 409'); await bajarNube(); nubeEnCurso = null; return subirNube(true); }
      E.nube = { estado: 'subiendo', cuando: d.actualizado }; pintarCuentaSiToca();
      let cambio = false, fallos = 0;
      for (const p of E.prendas) {
        if (p.ejemplo) continue;
        // 0.113: una foto que no sube ya no frena las demás ni los datos; se reintenta en la próxima subida
        // 04/11: el iPhone de Gabriela perdió las fotos de 4 prendas («leer … The object can not be found here»): se marcan, no se reintentan y la ficha pide rehacerla; si la nube la tiene, se vuelve a bajar
        if (p.foto && !p.fotoRota && !p.fCat && p.fotoSub !== firma(p.foto)) { try { await subirFoto('/api/foto/' + p.id, p.foto); p.fotoSub = firma(p.foto); p.nube = Date.now().toString(36); cambio = true; } catch (e) { if (/^leer /.test(e?.message || '')) { p.fotoRota = 1; cambio = true; } fallos++; avisarFallo('foto', e, p.foto); } } // nube = marca de la versión subida; fotoSub = qué foto local se subió
        if (p.original && !p.originalRota && !p.fCat && p.fotoSubO !== firma(p.original)) { try { await subirFoto('/api/foto/' + p.id + '-o', p.original); p.fotoSubO = firma(p.original); p.nubeO = Date.now().toString(36); cambio = true; } catch (e) { if (/^leer /.test(e?.message || '')) { p.originalRota = 1; cambio = true; } avisarFallo('original', e, p.original); } }
      }
      // 07/11 (Gabriela: «la app debería guardarlas, no depender de nada»; «en el Mac tampoco aparece ninguna foto del análisis»): con «Guardar mis fotos en mi cuenta»,
      // la selfie, la foto de cuerpo y el avatar van también a su cuenta (privadas: solo se piden con su sesión) y vuelven a cualquier móvil u ordenador donde entre
      { const pf = E.perfil || {}; if (pf.fotosCuenta) for (const k of FOTOS_DIAG) if (pf[k] instanceof Blob && pf[k + 'Sub'] !== firma(pf[k]) && LS.get('tc_bajada_' + k) !== firma(pf[k])) {
        try { await subirFoto('/api/foto/diag-' + k, pf[k]); pf[k + 'Sub'] = firma(pf[k]); LS.set('tc_bajada_' + k, pf[k + 'Sub']); cambio = true; await BD.set('perfil', E.perfil); } catch (e) { fallos++; } } }
      // 10/11: lo que te pruebas con el avatar, también a la cuenta; y fuera de la cuenta lo que ya no está (lo borra el primer móvil que suba)
      { const pf = E.perfil || {}, fl = fLocales(); let pc = false;
        if (pf.fotosCuenta) for (const x of pf.probados || []) { const b = E.puestos?.[x.k]; if (b instanceof Blob && fl[x.k] === x.f && x.s !== firma(b)) {
          try { await subirFoto('/api/foto/' + x.f, b); x.s = firma(b); pc = true; } catch (e) { fallos++; } } }
        for (const f of [...(pf.probadosFuera || [])]) { try { const r = await api('/api/foto/' + f, { method: 'DELETE' }); if (r.ok) { pf.probadosFuera = pf.probadosFuera.filter(q => q !== f); pc = true; } } catch (e) { } }
        if (pc) { cambio = true; await BD.set('perfil', E.perfil); } }
      if (cambio) { await BD.set('prendas', E.prendas); d = await ponerDatos(); if (!d) { if (reintento) throw new Error('datos 409'); await bajarNube(); nubeEnCurso = null; return subirNube(true); } }
      E.nube = { estado: fallos ? 'error' : 'ok', cuando: d.actualizado };
    } catch (e) { E.nube.estado = 'error'; avisarFallo('datos', e); }
    pintarCuentaSiToca();
  })();
  try { await nubeEnCurso; } finally { nubeEnCurso = null; }
}
// trae lo del servidor y lo junta con lo de este móvil: lo del servidor manda; lo que solo está aquí se queda (y se subirá)
/* ---------- 04/11 · encuesta de las pruebas: 8 preguntas de tocar, al séptimo día desde que se creó la cuenta (solo cuentas de las pruebas, desde el 10/11) ---------- */
const ENCUESTA = [
  ['¿Cuántos días la has abierto?', 'How many days did you open it?', [['1–2', '1–2'], ['3–4', '3–4'], ['5 o más', '5 or more']]],
  ['¿Te has puesto algún look de la app?', 'Did you wear any look from the app?', [['Ninguno', 'None'], ['1–2', '1–2'], ['3 o más', '3 or more']]],
  ['Subir tu ropa fue…', 'Adding your clothes was…', [['Fácil', 'Easy'], ['Normal', 'OK'], ['Pesado', 'A chore']]],
  ['Los looks te parecieron…', 'The looks felt…', [['Me los pondría', 'I would wear them'], ['Algunos sí', 'Some of them'], ['No van conmigo', 'Not for me']]],
  ['¿Qué te ha servido más?', 'What helped you most?', [['Hoy', 'Today'], ['El clóset', 'The closet'], ['Ideas y cápsula', 'Ideas and capsule'], ['Nada todavía', 'Nothing yet']]],
  ['¿Ha fallado algo?', 'Did anything fail?', [['Nada', 'Nothing'], ['Alguna vez', 'Once or twice'], ['Bastante', 'Quite a lot']]],
  ['¿Seguirías usándola?', 'Would you keep using it?', [['Sí', 'Yes'], ['Puede', 'Maybe'], ['No', 'No']]],
  ['¿Pagarías 1,99 € al mes por ella?', 'Would you pay €1.99 a month for it?', [['Sí', 'Yes'], ['Con algo más', 'With something more'], ['No', 'No']]]];
async function preguntarEncuesta(forzar) {
  try {
    if (!forzar) {
      if (!cuenta() || window.top !== window || LS.get('tc_encuesta_hecha') || LS.get('tc_encuesta_luego') === new Date().toISOString().slice(0, 10)) return;
      let creada = LS.get('tc_cuenta_creada');
      if (!creada) { const r = await api('/api/yo', { tiempo: 10000 }); if (!r.ok) return; creada = (await r.json()).creada; if (creada) LS.set('tc_cuenta_creada', creada); }
      if (!creada || creada < '2026-11-10' || Date.now() - new Date(creada) < 7 * 864e5) return;
      const r = await api('/api/encuesta', { tiempo: 10000 }); if (!r.ok) return; if ((await r.json()).hecha) { LS.set('tc_encuesta_hecha', '1'); return; }
    }
    abrirEncuesta(forzar);
  } catch (e) { }
}
function abrirEncuesta(previa) { // previa (?encuesta=1): para que la vean las socias; no envía nada
  const es = idioma() === 'en' ? 1 : 0, res = {};
  const html = `<p class="pn-lema">${t('Ocho preguntas, solo tocar. Menos de un minuto.', 'Eight questions, just tap. Under a minute.')}</p>
    ${ENCUESTA.map((q, i) => `<fieldset class="en-q"><legend>${q[es]}</legend><div class="at-fila at-vj-ops">${q[2].map((o, j) => `<button type="button" data-enq="${i}" data-eno="${j}" aria-pressed="false">${o[es]}<span class="at-dos" aria-hidden="true"></span></button>`).join('')}</div></fieldset>`).join('')}
    <button class="boton" id="en-enviar" disabled>${t('Enviar', 'Send')}</button>
    <button class="boton linea" id="en-luego">${t('Ahora no', 'Not now')}</button>
    <p class="pn-nota">${t('Solo se guardan tus respuestas, con tu cuenta. Nos sirven para mejorar la app.', 'Only your answers are saved, with your account. They help us improve the app.')}</p>`;
  abrirPanel(t('¿Qué tal la semana?', 'How was your week?'), html, cap => {
    cap.addEventListener('click', async e => {
      const b = e.target.closest('[data-enq]');
      if (b) { const i = +b.dataset.enq; res[i] = +b.dataset.eno; cap.querySelectorAll(`[data-enq="${i}"]`).forEach(x => { const on = +x.dataset.eno === res[i]; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); $('en-enviar').disabled = Object.keys(res).length < ENCUESTA.length; return; }
      if (e.target.closest('#en-luego')) { LS.set('tc_encuesta_luego', new Date().toISOString().slice(0, 10)); cap.remove(); return; }
      if (e.target.closest('#en-enviar')) {
        if (previa) { cap.remove(); toast(t('Vista previa: no se ha enviado nada.', 'Preview: nothing was sent.')); return; }
        const env = $('en-enviar'); env.disabled = true;
        const r = Object.fromEntries(ENCUESTA.map((q, i) => [q[0], q[2][res[i]][0]]));
        try { const x = await api('/api/encuesta', { method: 'POST', json: { r }, tiempo: 15000 }); if (!x.ok) throw new Error('http ' + x.status); LS.set('tc_encuesta_hecha', '1'); cap.remove(); toast(t('Gracias. Lo leemos todo.', 'Thank you. We read every answer.')); }
        catch (er) { env.disabled = false; toast(cuenta() ? t('No se ha podido enviar. Prueba otra vez.', 'Could not send. Try again.') : t('Entra en tu cuenta para enviarla.', 'Sign in to send it.')); }
      }
    });
  });
}
// 06/11 noche (Gabriela: «las fotos no me cargan en mi móvil»): Safari a veces pierde el fichero de una foto guardada en el móvil (su iPhone avisó «The object can not be
// found here»); la prenda seguía apuntando a una foto que ya no existe, bajarNube no la volvía a pedir (ya «tenía» foto) y se veía en blanco. Ahora, al abrir y cada
// vez que una foto no carga, se comprueba si se puede leer y, si no, se baja otra vez de la nube; sin copia en la nube, la prenda queda como «Sin foto».
const fotoLegible = async b => { if (!(b instanceof Blob)) return true; try { await b.slice(0, 16).arrayBuffer(); return true; } catch (e) { return false; } };
let reparando = null;
function repararFotos(soloIds) {
  if (reparando) return reparando;
  reparando = (async () => {
    const tareas = [];
    for (const p of E.prendas) {
      if (p.ejemplo || p.muestra || (soloIds && !soloIds.has(p.id))) continue;
      const catMal = p.cat instanceof Blob && !(await fotoLegible(p.cat)), fotoMal = p.foto instanceof Blob && p.foto !== p.cat && !(await fotoLegible(p.foto)), origMal = p.original instanceof Blob && !(await fotoLegible(p.original));
      if (origMal) { p.original = null; p.originalRota = true; }
      if (!catMal && !fotoMal) continue;
      tareas.push(async () => {
        const bajar = async suf => { if (!cuenta()) return null; try { const r = await api('/api/foto/' + p.id + suf, { tiempo: 30000 }); return r.ok ? await r.blob() : null; } catch (e) { return null; } };
        if (catMal) { const b = p.conCat || p.nubeC ? await bajar('-c?v=' + (p.nubeC || '')) : null; p.cat = b; if (p.fCat) p.foto = b; if (!b && p.fCat) p.fotoRota = true; }
        if (fotoMal) { const b = !p.fCat && p.nube ? await bajar('?v=' + p.nube) : null; if (b) { p.foto = b; delete p.fotoRota; } else { p.foto = p.cat || null; if (!p.cat) p.fotoRota = true; } }
        urls.delete(p.id); urlsCat.delete(p.id); alfa.delete(p.id);
      });
    }
    let i = 0; await Promise.all(Array.from({ length: Math.min(4, tareas.length) }, async () => { while (i < tareas.length) await tareas[i++](); }));
    if (tareas.length) { await BD.set('prendas', E.prendas).catch(() => { }); avisarFallo('reparadas', new Error(tareas.length + ' fotos')); cuandoQuieto(() => { if (typeof stRepintar === 'function') stRepintar(); else if (E.pantalla === 'closet') pintarCloset(); }); }
    return tareas.length;
  })().finally(() => { reparando = null; });
  return reparando;
}
// una foto del clóset que no carga (blob: de una prenda): se repara esa prenda
let fotosMal = new Set(), fotosMalT = 0;
document.addEventListener('error', e => {
  const im = e.target; if (!(im instanceof HTMLImageElement) || !im.src.startsWith('blob:')) return;
  for (const [id, u] of [...urls, ...urlsCat]) if (u === im.src) fotosMal.add(id);
  if (!fotosMal.size) return; clearTimeout(fotosMalT); fotosMalT = setTimeout(() => { const ids = fotosMal; fotosMal = new Set(); repararFotos(ids).catch(() => { }); }, 800);
}, true);
const FOTOS_DIAG = ['selfie', 'cuerpo', 'avatar'];
/* ---------- permisos (10/11, Legal T3 y T4; privacidad, apdo. 5) ----------
   Tres casillas, nunca marcadas de antemano: diag (analizar en el móvil tus fotos y tus medidas), avatar (mandar tus fotos a Google para el avatar y «Verlo puesto»;
   solo Pro) y fotos (guardar las fotos del diagnóstico en tu cuenta). Cada sí o no queda con su fecha y la versión del texto: en perfil.permisos, que viaja con la
   cuenta, y en el servidor (POST /api/permiso; el del avatar lo mira el servidor antes de llamar a Google). Con un permiso retirado no puede quedar nada de lo que
   salió de él, aquí ni en los otros móviles de la cuenta (aplicarRetiradas, al arrancar y al bajar de la cuenta: sin el permiso no se pueden añadir fotos ni medidas,
   así que lo que aparezca es viejo). Lo que ya salió de las fotos antes de que existiera el permiso queda aparte (diagEspera) hasta que lo den. */
const PERMISO_V = 'privacidad-2026-11-10b'; // 10/11 tarde (Gabriela: «hay un texto grandísimo… eso se quita; a la vez que se sube una foto de cara y del cuerpo se tiene que entender ambas cosas»): un solo permiso corto
const PERMISOS = {
  diag: ['Acepto que TuCloset use mis fotos y mis medidas para sacar mis colores y mi silueta, crear mi avatar en el Pro (con Google, que puede tratarlas fuera de la UE) y guardarlas, privadas, en mi cuenta. Puedo retirarlo cuando quiera.',
    'I agree that TuCloset uses my photos and measurements to work out my colours and figure, create my avatar on Pro (with Google, which may process them outside the EU) and keep them, private, in my account. I can withdraw this at any time.'],
  avatar: ['Acepto que mis fotos se envíen a Google (puede tratarlas fuera de la UE) para crear mi avatar y probarme los looks.',
    'I agree that my photos are sent to Google (it may process them outside the EU) to create my avatar and try on looks.'],
  fotos: ['Guardar mis fotos en mi cuenta, privadas, para verlas en otros móviles. Si no la marco, se quedan solo en este móvil.',
    'Keep my photos in my account, private, to see them on other phones. If I leave it unticked, they stay only on this phone.']
};
const permiso = k => E.perfil?.permisos?.[k]?.si === true;
const casillaPermiso = (k, id) => `<label class="pm-cas"><input type="checkbox" ${id ? `id="${id}"` : `data-permiso="${k}"`} ${permiso(k) ? 'checked' : ''}><span>${t(...PERMISOS[k])}</span></label>`;
async function permisoAlServidor(k) {
  const p = E.perfil?.permisos?.[k]; if (!cuenta() || !p) return false;
  try { return (await api('/api/permiso', { method: 'POST', json: { que: k, si: !!p.si, v: p.v }, tiempo: 15000 })).ok; } catch (e) { return false; }
}
async function ponerPermiso(k, si) {
  E.perfil = E.perfil || {}; E.perfil.permisos = { ...(E.perfil.permisos || {}), [k]: { si: !!si, fecha: new Date().toISOString(), v: PERMISO_V } };
  if (k === 'diag' && si) sacarDeEspera();
  await guardar(); programarNube(); return permisoAlServidor(k);
}
// de cada permiso manda el último sí o no, venga del móvil o de la cuenta
const juntarPermisos = (a, b) => { const r = { ...(a || {}) }; for (const [k, v] of Object.entries(b || {})) if (v && (!r[k] || (v.fecha || '') > (r[k].fecha || ''))) r[k] = v; return r; };
function borrarDe(k) { // lo que salió de cada permiso: las fotos, las medidas y el análisis (diag); el avatar y lo que te has visto puesto (diag y avatar)
  const pf = E.perfil || {};
  if (k === 'diag') {
    for (const f of ['selfie', 'cuerpo']) { if (pf[f + 'Sub']) api('/api/foto/diag-' + f, { method: 'DELETE' }).catch(() => { }); delete pf[f]; delete pf[f + 'Sub']; LS.set('tc_bajada_' + f, null); }
    ['medidas', 'medidasT', 'diag', 'diagEspera', 'tipoCuerpo', 'caras'].forEach(x => delete pf[x]);
    if (pf.colores?.fuente === 'foto') { delete pf.colores.est; delete pf.colores.sub; delete pf.colores.fuente; }
    ['tc_diag_medidas', 'tc_diag_caras'].forEach(x => { try { localStorage.removeItem(x); } catch (e) { } });
  }
  if (pf.avatarSub) api('/api/foto/diag-avatar', { method: 'DELETE' }).catch(() => { });
  ['avatar', 'avatarAR', 'avatarDe', 'avatarF', 'avatarSub'].forEach(x => delete pf[x]); LS.set('tc_bajada_avatar', null);
  vaciarProbados();
  E.propuestas = []; E.generados = [];
}
async function retirarPermiso(k) {
  const txt = k === 'diag' ? t('Borramos tus fotos de cara y de cuerpo, tus medidas, tu análisis y tu avatar, en este móvil y en tu cuenta. Tu ropa y tus looks se quedan.', 'We delete your face and body photos, your measurements, your analysis and your avatar, on this phone and in your account. Your clothes and looks stay.')
    : t('Borramos tu avatar y los looks que te has visto puestos, en este móvil y en tu cuenta. Para crear otro tendrás que volver a dar el permiso.', 'We delete your avatar and the looks you tried on, on this phone and in your account. To create another one you will need to give your permission again.');
  if (!await confirmar(k === 'diag' ? t('¿Retiras el permiso?', 'Withdraw your permission?') : t('¿Borrar tu avatar?', 'Delete your avatar?'), txt, k === 'diag' ? t('Retirar y borrar', 'Withdraw and delete') : t('Borrar', 'Delete'))) return false;
  borrarDe(k); await ponerPermiso(k, false);
  if (k === 'diag' && E.perfil.permisos.avatar?.si) await ponerPermiso('avatar', false);
  return true;
}
function aplicarRetiradas() { // lo retirado aquí o en otro móvil: si algo vuelve (una subida que choca y se junta con la cuenta, un móvil atrasado), se borra otra vez
  const pm = E.perfil?.permisos || {}, pf = E.perfil || {}; let hay = false;
  if (pm.diag && !pm.diag.si && (pf.selfie || pf.cuerpo || pf.selfieSub || pf.cuerpoSub || pf.medidas || pf.diag || pf.diagEspera || pf.tipoCuerpo || pf.colores?.fuente === 'foto')) { borrarDe('diag'); hay = true; }
  if (pm.avatar && !pm.avatar.si && (pf.avatar || pf.avatarSub || pf.avatarF || Object.keys(E.puestos || {}).length || (pf.probados || []).length)) { borrarDe('avatar'); hay = true; }
  return hay;
}
function diagAEspera() { // las cuentas de antes del 10/11: lo que salió de las fotos no se usa hasta que den el permiso
  const pf = E.perfil; if (!pf || permiso('diag')) return false;
  const col = pf.colores?.fuente === 'foto'; if (!pf.diag && !pf.tipoCuerpo && !col) return false;
  const x = pf.diagEspera || {}; pf.diagEspera = { diag: pf.diag || x.diag || null, tipoCuerpo: pf.tipoCuerpo || x.tipoCuerpo || null, col: col ? { est: pf.colores.est, sub: pf.colores.sub } : x.col || null };
  delete pf.diag; delete pf.tipoCuerpo; if (col) { delete pf.colores.est; delete pf.colores.sub; delete pf.colores.fuente; }
  E.propuestas = []; E.generados = []; return true;
}
function sacarDeEspera() {
  const pf = E.perfil, x = pf?.diagEspera; if (!x) return;
  if (x.diag && !pf.diag) pf.diag = x.diag; if (x.tipoCuerpo && !pf.tipoCuerpo) pf.tipoCuerpo = x.tipoCuerpo;
  if (x.col?.est && !pf.colores?.est) pf.colores = { ...(pf.colores || { r: {} }), est: x.col.est, sub: x.col.sub, fuente: 'foto' };
  delete pf.diagEspera; E.propuestas = []; E.generados = [];
}
// el permiso del diagnóstico, desde Medidas y fotos o desde el alta: al quitarlo, si hay algo que borrar, se pregunta y se borra
async function cambiarPermisoDiag(ck) {
  const pf = E.perfil || {};
  if (ck.checked) { await ponerPermiso('diag', true); await ponerPermiso('avatar', true); pf.fotosCuentaVista = 2; await fotosEnCuenta(true); } // 10/11: un solo sí vale para el análisis, el avatar y guardarlas en la cuenta
  else if (pf.selfie || pf.cuerpo || pf.medidas || pf.diag || pf.diagEspera || pf.avatar) { if (!await retirarPermiso('diag')) { ck.checked = true; return false; } toast(t('Permiso retirado: hemos borrado tus fotos, tus medidas y tu análisis', 'Permission withdrawn: we deleted your photos, measurements and analysis')); }
  else await ponerPermiso('diag', false);
  return true;
}
async function bajarFotosDiag() { // las que faltan en este móvil u ordenador y están en su cuenta; lo bajado no se vuelve a subir (tc_bajada_*)
  const pf = E.perfil || {}; if (!pf.fotosCuenta || !cuenta()) return; let hay = false;
  for (const k of FOTOS_DIAG) if (!(pf[k] instanceof Blob) && pf[k + 'Sub']) {
    try { const r = await api('/api/foto/diag-' + k, { tiempo: 30000 }); if (r.ok) { const b = await r.blob(); if (b.size > 1000) { pf[k] = b; LS.set('tc_bajada_' + k, firma(b)); hay = true; } } } catch (e) { } }
  if (hay) { await BD.set('perfil', E.perfil); if (E.pantalla === 'yo') pintarYo(); }
}
// 10/11 (Gabriela: «sí, pásalo también a la cuenta; la cuenta es la que manda, se abra donde se abra»): lo que te pruebas con el avatar va con la cuenta.
// perfil.probados = [{ k, f, t, u, s }]: k la clave del look puesto, f su foto en la cuenta (pu-…, una por cada vez que se hace), t cuándo se hizo, u la última vez que
// se puso en Yo, s lo subido. perfil.probadosFuera: fotos que hay que borrar de la cuenta. perfil.avatarFijo/avatarFijoT: lo que llevas puesto ahora en Yo.
// En este móvil, la copia (BD «puestos») y qué foto de la cuenta es cada una (tc_pu_f).
const MAX_PUESTOS = 30;
const hashTxt = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const fLocales = () => { try { return JSON.parse(LS.get('tc_pu_f') || '{}') || {}; } catch (e) { return {}; } };
const ponerFLocales = m => LS.set('tc_pu_f', JSON.stringify(m));
const probados = () => (E.perfil?.probados || []).slice().sort((a, b) => (b.u || '').localeCompare(a.u || ''));
function nuevoProbado(k, blob) {
  const pf = E.perfil = E.perfil || {}, t = new Date().toISOString(), f = 'pu-' + hashTxt(k + '|' + t) + hashTxt(t + '|' + k), fl = fLocales();
  const fuera = (pf.probados || []).filter(x => x.k === k); pf.probados = (pf.probados || []).filter(x => x.k !== k).concat({ k, f, t, u: t });
  for (const x of probados().slice(MAX_PUESTOS)) { fuera.push(x); delete E.puestos[x.k]; delete fl[x.k]; } // fuera el que hace más que no te pruebas
  pf.probados = pf.probados.filter(x => !fuera.includes(x)); pf.probadosFuera = [...new Set([...(pf.probadosFuera || []), ...fuera.map(x => x.f)])];
  E.puestos[k] = blob; fl[k] = f; ponerFLocales(fl);
}
function vaciarProbados() { // avatar nuevo o borrado: lo probado ya no vale, aquí ni en la cuenta
  const pf = E.perfil = E.perfil || {};
  pf.probadosFuera = [...new Set([...(pf.probadosFuera || []), ...(pf.probados || []).map(x => x.f)])]; pf.probados = [];
  // probadosDesde: lo probado antes ya no vale en ningún móvil (la lista de fotos que borrar se vacía en cuanto se borran, así que no basta)
  pf.avatarFijo = ''; pf.avatarFijoT = pf.probadosDesde = new Date().toISOString(); E.puestos = {}; LS.set('tc_pu_f', null); BD.set('puestos', {}).catch(() => { });
}
function juntarProbados(dp, pl) { // los dos lados: misma clave con otra foto → la más nueva; lo echado en cualquiera de los dos, fuera
  const fuera = new Set([...(dp.probadosFuera || []), ...(pl.probadosFuera || [])]), m = new Map(), desde = [dp.probadosDesde || '', pl.probadosDesde || ''].sort().pop();
  for (const x of [...(dp.probados || []), ...(pl.probados || [])]) {
    if (fuera.has(x.f)) continue; if ((x.t || '') < desde) { fuera.add(x.f); continue; } const y = m.get(x.k); // lo de antes de desde es de un avatar de antes
    if (!y) { m.set(x.k, { ...x }); continue; }
    if (y.f === x.f) { if ((x.u || '') > (y.u || '')) y.u = x.u; y.s = y.s || x.s; continue; }
    const [gana, pierde] = (x.t || '') > (y.t || '') ? [{ ...x }, y] : [y, x]; fuera.add(pierde.f); if ((pierde.u || '') > (gana.u || '')) gana.u = pierde.u; m.set(x.k, gana);
  }
  const l = [...m.values()].sort((a, b) => (b.u || '').localeCompare(a.u || '')); l.slice(MAX_PUESTOS).forEach(x => fuera.add(x.f));
  const r = { probados: l.slice(0, MAX_PUESTOS), probadosFuera: [...fuera] }; if (desde) r.probadosDesde = desde;
  const fijo = (pl.avatarFijoT || '') > (dp.avatarFijoT || '') ? pl : dp; if (fijo.avatarFijoT) { r.avatarFijo = fijo.avatarFijo || ''; r.avatarFijoT = fijo.avatarFijoT; }
  return r;
}
function limpiarPuestosLocales() { // la copia de este móvil: fuera lo que ya no está en la cuenta o es otra versión (se baja la buena)
  const pr = new Map((E.perfil?.probados || []).map(x => [x.k, x.f])), fl = fLocales(); let hay = false;
  for (const k of Object.keys(E.puestos || {})) if (pr.get(k) !== fl[k]) { delete E.puestos[k]; delete fl[k]; hay = true; }
  for (const k of Object.keys(fl)) if (!(E.puestos?.[k] instanceof Blob)) { delete fl[k]; hay = true; }
  if (hay) { ponerFLocales(fl); BD.set('puestos', E.puestos).catch(() => { }); } return hay;
}
function migrarProbados() { // una vez por móvil: lo que ya había aquí (antes del 10/11) pasa a la lista de la cuenta
  if (LS.get('tc_pu_v')) return; const pf = E.perfil; if (!pf) return;
  const ks = Object.keys(E.puestos || {}).filter(k => E.puestos[k] instanceof Blob);
  if (ks.length) {
    let ord = []; try { ord = JSON.parse(LS.get('tc_puestos_orden') || '[]'); } catch (e) { }
    const ya = new Set((pf.probados || []).map(x => x.k)), fl = fLocales(), ahora = Date.now(), t = new Date(ahora).toISOString(); pf.probados = pf.probados || [];
    ks.sort((a, b) => (ord.indexOf(a) + 1 || 999) - (ord.indexOf(b) + 1 || 999)).forEach((k, i) => {
      if (ya.has(k)) return; const f = 'pu-' + hashTxt(k + '|' + t) + hashTxt(t + '|' + k); pf.probados.push({ k, f, t, u: new Date(ahora - (i + 1) * 1000).toISOString() }); fl[k] = f; });
    ponerFLocales(fl);
    const fijo = LS.get('tc_avatar_fijo'); if (!pf.avatarFijoT) { pf.avatarFijo = fijo && E.puestos[fijo] instanceof Blob ? fijo : ''; pf.avatarFijoT = t; }
  }
  LS.set('tc_pu_v', '1'); LS.set('tc_puestos_orden', null); LS.set('tc_avatar_fijo', null);
}
let bajandoPuestos = null;
async function bajarPuestos() { // lo probado que está en la cuenta y no en este móvil
  if (bajandoPuestos || !cuenta()) return bajandoPuestos;
  bajandoPuestos = (async () => {
    E.puestos = E.puestos || {}; const fl = fLocales(); let hay = false;
    for (const x of probados()) { if (!x.s || (E.puestos[x.k] instanceof Blob && fl[x.k] === x.f)) continue;
      try { const r = await api('/api/foto/' + x.f, { tiempo: 30000 }); if (r.ok) { const b = await r.blob(); if (b.size > 1000) { E.puestos[x.k] = b; fl[x.k] = x.f; hay = true; } } } catch (e) { } }
    if (hay) { ponerFLocales(fl); await BD.set('puestos', E.puestos).catch(() => { }); if (E.pantalla === 'yo') pintarYo(); }
  })();
  try { await bajandoPuestos; } finally { bajandoPuestos = null; }
}
// 07/11 (Gabriela: «2. sí»): la primera vez que alguien con cuenta tiene fotos del diagnóstico, se le pregunta una vez si se guardan en su cuenta, sin nada elegido
// de antemano; la respuesta se cambia en Medidas y fotos
async function preguntarFotosCuenta() {
  const pf = E.perfil || {}; if (!cuenta() || pf.permisos?.fotos || pf.fotosCuentaVista >= 2 || !(permiso('diag') || tieneAvatar()) || !(pf.selfie instanceof Blob || pf.cuerpo instanceof Blob || pf.avatar instanceof Blob)) return;
  pf.fotosCuentaVista = 2; await guardar(); programarNube();
  const si = await confirmar(t('¿Guardamos tus fotos en tu cuenta?', 'Keep your photos in your account?'),
    t('Privadas, para verlas en otros móviles y en el ordenador. Si no, se quedan solo en este móvil. Puedes cambiarlo en Tus medidas y fotos.', 'Private, to see them on other phones and on your computer. If not, they stay only on this phone. You can change it in Your measurements and photos.'),
    t('Guardarlas', 'Keep them'), t('Solo en este móvil', 'Only on this phone'));
  if (!si) { await fotosEnCuenta(false); const ck = $('dg-cuenta'); if (ck) ck.checked = false; return; }
  await fotosEnCuenta(true); toast(t('Tus fotos se guardan en tu cuenta', 'Your photos are kept in your account'));
  const ck = $('dg-cuenta'), pv = $('dg-priv'); if (ck) ck.checked = true; if (pv) pv.innerHTML = IC_CANDADO + t('Privadas: solo tú las ves, en tu móvil y en tu ordenador', 'Private: only you see them, on your phone and computer');
  if (E.pantalla === 'yo') pintarYo();
}
async function fotosEnCuenta(si) {
  const pf = E.perfil = E.perfil || {}; pf.fotosCuenta = !!si;
  if (!si) { for (const k of FOTOS_DIAG) { if (pf[k + 'Sub']) api('/api/foto/diag-' + k, { method: 'DELETE' }).catch(() => { }); delete pf[k + 'Sub']; }
    for (const x of pf.probados || []) if (x.s) { api('/api/foto/' + x.f, { method: 'DELETE' }).catch(() => { }); delete x.s; } }
  await ponerPermiso('fotos', !!si); if (si) { bajarFotosDiag(); bajarPuestos(); } // 10/11: es la casilla 3 de la privacidad (guarda fecha y versión)
}
async function bajarNube() {
  if (!cuenta()) return false;
  const r = await api('/api/datos', { tiempo: 30000 }); if (!r.ok) return false;
  const { doc, version } = await r.json(); if (!doc) return false;
  // 10/11: si un intercambio de clósets no llegó a subir, lo que salió de Mi ropa no vuelve desde la nube
  let ic = {}; try { ic = JSON.parse(LS.get('tc_intercambio') || '{}') || {}; } catch (e) { }
  const fI = new Set(ic.fuera || []), dI = new Set(ic.dentro || []); // lo que entró no cuenta como borrado aunque la nube aún lo diga
  const borr = new Set([...(doc.borradas || []), ...fI].filter(id => !dI.has(id))); LS.set('tc_nube_borradas', JSON.stringify([...borr]));
  // 09/11: un clóset que la Dirección ha limpiado («reinicio») se baja tal cual una vez: lo que este móvil tenía de más (prendas, looks y agenda de otra cuenta) se quita
  const rein = !!doc.reinicio && doc.reinicio !== LS.get('tc_reinicio');
  const locales = new Map(E.prendas.map(p => [p.id, p]));
  // 0.94 (Gabriela, 24/10: «se demora mucho y no me deja entrar»): las fotos bajaban de una en una (50 con las originales) antes de dejarte entrar;
  // ahora bajan 6 a la vez, solo las recortadas antes de entrar, y las originales después, por detrás
  const nuevas = [], fotos = [], originales = [];
  for (const q of doc.prendas || []) {
    if (fI.has(q.id)) continue;
    // 06/11 (Gabriela: «una vez se estilice la foto, esa foto es la que prevalece y se elimina la original; libera memoria y ganamos en eficiencia»): con fCat, la foto de catálogo
    // es la única foto de la prenda; en el móvil no se guardan ni la original ni la recortada, y la nube ya no las tiene
    const l = locales.get(q.id), solo = !!(q.fCat && q.conCat); const p = { ...q, foto: (solo && l?.cat) || l?.foto || null, original: solo ? null : l?.original || null, cat: l?.cat || null }; if (l?.fotoTorcida && !solo) p.fotoTorcida = l.fotoTorcida; if (l?.catProp && !q.conCat) { p.catProp = l.catProp; p.catPropAR = l.catPropAR; } // 06/11: la foto de catálogo propuesta, hasta que elija delete p.conFoto; delete p.conOriginal;
    if (solo && l?.cat && l.foto !== l.cat) { urls.delete(q.id); alfa.delete(q.id); p.caja = null; }
    // 11/11: la foto de antes del móvil no se pierde al bajar; y si otro móvil la estilizó, la foto que tenía este móvil pasa a ser la de antes (7 días)
    if (solo && l?.fotoPrev instanceof Blob) p.fotoPrev = l.fotoPrev;
    else if (solo && !q.nubeConserva && l && !l.fCat && l.foto instanceof Blob && l.foto !== l.cat) { p.fotoPrev = l.foto; p.fotoPrevT = q.fotoPrevT || Date.now(); }
    if (q.conCat && (!p.cat || l?.nubeC !== q.nubeC)) (AT ? fotos : originales).push(async () => { try { const f = await api('/api/foto/' + q.id + '-c?v=' + (q.nubeC || ''), { tiempo: 30000 }); if (f.ok) { p.cat = await f.blob(); urlsCat.delete(q.id); if (solo) { p.foto = p.cat; urls.delete(q.id); alfa.delete(q.id); p.caja = null; } if (typeof stRepintar === 'function') stRepintar(); } } catch (e) { } }); // 0.121: foto de catálogo (Gemini)
    if (q.conFoto && !solo && (!l?.foto || l.fotoRota || l.nube !== q.nube)) fotos.push(async () => { try { const f = await api('/api/foto/' + q.id + '?v=' + (q.nube || ''), { tiempo: 30000 }); if (f.ok) { p.foto = await f.blob(); p.fotoSub = firma(p.foto); p.nube = q.nube; delete p.fotoRota; urls.delete(q.id), alfa.delete(q.id); } } catch (e) { } });
    if (q.conOriginal && !solo && (!p.original || l?.originalRota || l?.nubeO !== q.nubeO)) originales.push(async () => { try { const f = await api('/api/foto/' + q.id + '-o?v=' + (q.nubeO || ''), { tiempo: 30000 }); if (f.ok) { p.original = await f.blob(); p.fotoSubO = firma(p.original); p.nubeO = q.nubeO; delete p.originalRota; } } catch (e) { } });
    nuevas.push(p); locales.delete(q.id);
  }
  const aLaVez = async (tareas, n) => { let i = 0; await Promise.all(Array.from({ length: Math.min(n, tareas.length) }, async () => { while (i < tareas.length) await tareas[i++](); })); };
  await aLaVez(fotos, 6);
  if (originales.length) setTimeout(async () => { await aLaVez(originales, 3); await BD.set('prendas', E.prendas).catch(() => { }); }, 2000);
  if (!rein) for (const [id, l] of locales) if (!borr.has(id)) nuevas.push(l);
  E.prendas = nuevas;
  const cj = new Map((doc.conjuntos || []).map(c => [c.id, c])); if (!rein) E.conjuntos.forEach(c => { if (!cj.has(c.id)) cj.set(c.id, c); }); E.conjuntos = [...cj.values()].filter(c => !fI.size || !(c.ids || []).some(id => fI.has(id)));
  E.agenda = rein ? { ...(doc.agenda || {}) } : fI.size ? { ...E.agenda } : { ...E.agenda, ...(doc.agenda || {}) };
  if (doc.reinicio) LS.set('tc_reinicio', doc.reinicio);
  // 10/11 (Gabriela: «no hay sincronización entre mi cuenta del móvil y la del Mac, mi avatar cambia»; «igual que la colorimetría, porque hay diferentes fotos de la cara»;
  // «¿no se supone que la cuenta es única?»): LA CUENTA MANDA. Antes cada móvil se quedaba con sus fotos y su análisis: el que tenía una foto vieja la volvía a subir
  // encima de la nueva y el avatar y los colores cambiaban de un sitio a otro. Ahora: una foto de este móvil que no se ha cambiado aquí desde la última vez que se subió
  // o se bajó (tc_bajada_*) se cambia por la de la cuenta; medidas y análisis, los más nuevos (medidasT, diag.t). La primera vez (sin tc_sinc_v), manda la cuenta.
  const pl = E.perfil || {}, dp = doc.perfil || {}, migr = !LS.get('tc_sinc_v');
  const vieja = k => FOTOS_DIAG.includes(k) && dp.fotosCuenta && dp[k + 'Sub'] && firma(pl[k]) !== dp[k + 'Sub'] && (migr || LS.get('tc_bajada_' + k) === firma(pl[k]));
  const medMia = pl.medidas && Object.keys(pl.medidas).length && (!dp.medidas || (pl.medidasT || '') > (dp.medidasT || ''));
  const mio = pl.diag && (pl.diag.t || '') > (dp.diag?.t || '');
  const avAqui = pl.avatar instanceof Blob && !vieja('avatar') && firma(pl.avatar) !== dp.avatarSub; // un avatar hecho aquí y aún sin subir: con su fecha y su firma
  E.perfil = { ...dp, ...Object.fromEntries(Object.entries(pl).filter(([k, v]) => (v instanceof Blob && !vieja(k)) || (medMia && ['medidas', 'medidasT'].includes(k)) || (mio && ['diag', 'tipoCuerpo', 'caras'].includes(k)) || (avAqui && ['avatarAR', 'avatarF', 'avatarDe'].includes(k)))) };
  Object.assign(E.perfil, juntarProbados(dp, pl)); limpiarPuestosLocales();
  if (mio && pl.colores?.fuente === 'foto') E.perfil.colores = { ...(E.perfil.colores || {}), est: pl.colores.est, sub: pl.colores.sub, fuente: 'foto' };
  LS.set('tc_sinc_v', '1');
  E.perfil.permisos = juntarPermisos(doc.perfil?.permisos, pl.permisos); if (aplicarRetiradas() | diagAEspera()) programarNube(); // 10/11: permisos
  LS.set('tc_nube_ver', version); LS.set('tc_nube_ids', JSON.stringify((doc.prendas || []).map(p => p.id)));
  await BD.set('perfil', E.perfil); await BD.set('prendas', E.prendas); await BD.set('conjuntos', E.conjuntos); await BD.set('agenda', E.agenda); bajarFotosDiag(); bajarPuestos();
  if (estacionesAuto()) await guardar(); // 0.101: estación por tipo, también para lo que llega de otros móviles
  E.propuestas = []; E.generados = []; E.nubeBajada = true; return true;
}
const ERR_CUENTA = { correo: ['Escribe un correo válido', 'Enter a valid email'], clave_corta: ['La contraseña necesita al menos 8 caracteres', 'Password needs at least 8 characters'], ya_existe: ['Ese correo ya tiene cuenta: entra con él', 'That email already has an account: sign in'], credenciales: ['Correo o contraseña incorrectos', 'Wrong email or password'], frenado: ['Demasiados intentos: espera 15 minutos', 'Too many attempts: wait 15 minutes'],
  actualiza: ['Hay una versión nueva de la app: ciérrala y vuelve a abrirla', 'There is a new version of the app: close it and open it again'], envio: ['No he podido mandarte el código. Revisa el correo y prueba otra vez.', 'I could not send you the code. Check the email and try again.'] };
// 09/11 (Gabriela: «aparte de la contraseña, agrega un paso de verificación por correo»): al crear la cuenta y al entrar desde un móvil nuevo, el servidor manda
// un código de 6 cifras desde app@tucloset.app y la sesión se abre al escribirlo. Cada móvil lleva un número al azar (tc_disp) que no se borra al cerrar sesión,
// para que el servidor sepa si ya entró antes desde aquí. Mientras el correo no esté en marcha, el servidor abre la sesión como antes y esto no sale.
const dispId = () => { let d = LS.get('tc_disp'); if (!/^[0-9a-f]{32}$/.test(d || '')) { d = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); LS.set('tc_disp', d); } return d; };
const ERR_CODIGO = { caducado: ['El código ha caducado: vuelve a empezar', 'The code has expired: start again'], intentos: ['Demasiados intentos: vuelve a empezar', 'Too many attempts: start again'],
  espera: ['Espera un minuto antes de pedir otro', 'Wait a minute before asking for another'], envio: ['No he podido mandarlo. Prueba otra vez.', 'I could not send it. Try again.'] };
function pedirCodigo(d) {
  return new Promise(res => {
    const dlg = document.createElement('dialog'); dlg.className = 'dlg-cod'; dlg.setAttribute('aria-labelledby', 'cod-t');
    dlg.innerHTML = `<h2 id="cod-t">${t('Mira tu correo', 'Check your email')}</h2><p>${t('Te he mandado un código de 6 cifras a', 'I have sent a 6-digit code to')} <b>${escH(d.correo || '')}</b>${t('Escríbelo aquí.', 'Type it here.')}</p>
      <label class="cod-campo"><span class="vh">${t('Código', 'Code')}</span><input id="cod-n" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" aria-describedby="cod-e"></label>
      <p id="cod-e" class="cod-e" role="alert"></p><div class="botones"><button class="boton" id="cod-ok" disabled>${t('Confirmar', 'Confirm')}</button><button class="boton linea" id="cod-no">${t('Cancelar', 'Cancel')}</button></div>
      <p class="cod-pie">${t('¿No llega? Mira en correo no deseado.', 'Not there? Check your spam folder.')}</p><button class="at-enlace" id="cod-otra">${t('Mandar otro código', 'Send another code')}</button>`;
    document.body.appendChild(dlg); dlg.showModal(); const inp = dlg.querySelector('#cod-n'), ok = dlg.querySelector('#cod-ok'), err = dlg.querySelector('#cod-e'); inp.focus();
    const fin = v => { dlg.close(); dlg.remove(); res(v); };
    const mal = e => { err.textContent = e; };
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); ok.disabled = inp.value.length !== 6; mal(''); if (inp.value.length === 6) ok.click(); };
    dlg.addEventListener('cancel', e => { e.preventDefault(); fin(null); }); dlg.querySelector('#cod-no').onclick = () => fin(null);
    ok.onclick = async () => { if (ok.disabled) return; ok.disabled = true;
      let r, j; try { r = await api('/api/codigo', { method: 'POST', json: { reto: d.reto, codigo: inp.value, disp: dispId() }, tiempo: 20000 }); j = await r.json().catch(() => ({})); } catch (e) { ok.disabled = false; return mal(t('Sin conexión: prueba otra vez', 'No connection: try again')); }
      if (r.ok && j.token) return fin(j);
      if (j.error === 'codigo') { inp.value = ''; inp.focus(); return mal(t(`Ese no es el código${j.quedan > 0 ? `: te quedan ${j.quedan} intentos` : ''}`, `That is not the code${j.quedan > 0 ? `: ${j.quedan} tries left` : ''}`)); }
      const m = ERR_CODIGO[j.error]; mal(m ? t(m[0], m[1]) : t('No se ha podido. Prueba otra vez.', 'It did not work. Try again.')); if (['caducado', 'intentos'].includes(j.error)) setTimeout(() => fin(null), 2500); else ok.disabled = false; };
    dlg.querySelector('#cod-otra').onclick = async () => { let r, j; try { r = await api('/api/codigo', { method: 'POST', json: { reto: d.reto, otra: 1, en: idioma() === 'en' }, tiempo: 20000 }); j = await r.json().catch(() => ({})); } catch (e) { return mal(t('Sin conexión: prueba otra vez', 'No connection: try again')); }
      if (r.ok) { inp.value = ''; inp.focus(); return mal(t('Te he mandado otro código', 'I have sent you another code')); } const m = ERR_CODIGO[j.error]; mal(m ? t(m[0], m[1]) : t('No se ha podido. Prueba otra vez.', 'It did not work. Try again.')); };
  });
}
async function abrirCuenta(modo, correo, clave, nombre) {
  // 0.93 (Sheila, 24/10: «tengo mucho problema para entrar a mi cuenta»: con el clóset de pruebas abierto, entrar se bloqueaba): se pasa sola a «Mi ropa»
  if (CLOSET_ACT) { CLOSET_ACT = ''; try { localStorage.setItem('tc_closet', ''); } catch (e) { } BD.cerrar(); E.perfil = (await BD.get('perfil')) || null; E.prendas = (await BD.get('prendas')) || []; E.conjuntos = (await BD.get('conjuntos')) || []; E.agenda = (await BD.get('agenda')) || {}; E.propuestas = []; E.generados = []; urls.clear(); alfa.clear(); }
  let r; try { r = await api('/api/' + modo, { method: 'POST', json: { correo, clave, nombre, o: modo === 'alta' && ORIGEN || undefined, disp: dispId(), en: idioma() === 'en' } }); } catch (e) { toast(t('Sin conexión con el servidor. Inténtalo en un momento.', 'Cannot reach the server. Try again shortly.')); return false; }
  let d = await r.json().catch(() => ({}));
  if (!r.ok) { const m = ERR_CUENTA[d.error]; toast(m ? t(m[0], m[1]) : t('No se ha podido. Inténtalo de nuevo.', 'It did not work. Try again.')); return false; }
  if (d.codigo) { d = await pedirCodigo(d); if (!d) return false; } // 09/11: el código del correo
  const nuevo = String(d.correo || correo || '').toLowerCase();
  if (dueno() && dueno() !== nuevo) await vaciarMovil(); // el clóset de este móvil era de otra cuenta: se quita antes de bajar el suyo
  LS.set('tc_cuenta', JSON.stringify({ token: d.token, correo: d.correo, nombre: d.nombre })); LS.set('tc_nube_ver', '0'); LS.set('tc_nube_ids', '[]');
  if (!dueno() && E.prendas.some(p => !p.ejemplo)) {
    // un móvil sin dueño con ropa: si esa ropa ya estuvo en otra cuenta (móviles de antes que cerraron sesión), se quita; si no, se pregunta si se añade
    let enNube = new Set(); if (modo === 'entrar') { try { const r2 = await api('/api/datos', { tiempo: 30000 }); if (r2.ok) enNube = new Set(((await r2.json()).doc?.prendas || []).map(p => p.id)); } catch (e) { } }
    const mias = E.prendas.filter(p => !p.ejemplo);
    if (mias.some(p => deCuenta(p) && !enNube.has(p.id))) { const c = LS.get('tc_cuenta'); await vaciarMovil(); LS.set('tc_cuenta', c); LS.set('tc_nube_ver', '0'); LS.set('tc_nube_ids', '[]'); }
    else if (modo === 'entrar' && mias.some(p => !enNube.has(p.id)) && !await confirmar(t('¿Añadimos la ropa de este móvil?', 'Add the clothes on this phone?'),
      t(`En este móvil hay ${mias.length} prendas que no están en ninguna cuenta. Si dices que no, se quitan de este móvil y entras solo con lo de tu cuenta.`, `This phone has ${mias.length} garments that are not in any account. If you say no, they are removed from this phone and you get only what is in your account.`),
      t('Añadirlas a mi cuenta', 'Add them to my account'), t('No, solo mi cuenta', 'No, only my account'))) { const c = LS.get('tc_cuenta'); await vaciarMovil(); LS.set('tc_cuenta', c); LS.set('tc_nube_ver', '0'); LS.set('tc_nube_ids', '[]'); }
  }
  LS.set('tc_dueno', nuevo);
  if (modo === 'entrar') { E.nube.estado = 'bajando'; try { await bajarNube(); } catch (e) { avisarFallo('bajar', e); } setTimeout(medirTodas, 1500); } // 0.95 (Gabriela, 24/10: «se demora demasiado»): al entrar ya no se repasan las prendas con el reconocedor (45 MB y varios minutos en el móvil)
  subirNube().catch(() => { }); return true; // 0.146: lo de este móvil sube por detrás; entrar ya no espera a las fotos
}
async function cerrarSesion() {
  if (!await confirmar(t('¿Cerrar sesión?', 'Sign out?'), t('Tu clóset sigue guardado en tu cuenta. De este móvil se quita hasta que vuelvas a entrar.', 'Your closet stays saved in your account. It is removed from this phone until you sign in again.'), t('Cerrar sesión', 'Sign out'))) return;
  await subirNube().catch(() => { });
  if (E.nube.estado === 'error' && !await confirmar(t('Hay cambios sin guardar', 'Unsaved changes'), t('No se han podido subir a tu cuenta. Si cierras sesión ahora, se pierden.', 'They could not be uploaded to your account. If you sign out now, they are lost.'), t('Cerrar igualmente', 'Sign out anyway'), t('Esperar', 'Wait'))) return;
  await api('/api/salir', { method: 'POST', tiempo: 8000 }).catch(() => { }); await vaciarMovil(); location.reload();
}
async function borrarCuenta() {
  if (!await confirmar(t('¿Borrar tu cuenta?', 'Delete your account?'), t('Se borran del servidor tu clóset, tus fotos y tus looks. En este móvil se queda una copia. No se puede deshacer.', 'Your closet, photos and looks are deleted from the server. This phone keeps a copy. Cannot be undone.'), t('Borrar cuenta', 'Delete account'))) return;
  const r = await api('/api/cuenta', { method: 'DELETE' }).catch(() => null);
  if (!r?.ok) return toast(t('No se ha podido borrar. Inténtalo de nuevo.', 'Could not delete. Try again.'));
  ['tc_cuenta', 'tc_nube_ver', 'tc_nube_ids', 'tc_nube_borradas', 'tc_nube_cuando'].forEach(k => LS.set(k, null)); E.prendas.forEach(p => { delete p.nube; delete p.nubeO; delete p.nubeC; delete p.conCat; delete p.fotoSub; delete p.fotoSubO; }); ['tc_dueno', 'tc_reinicio'].forEach(k => LS.set(k, null)); await BD.set('prendas', E.prendas); pintarCuenta(); toast(t('Cuenta borrada', 'Account deleted'));
}
const haceRato = iso => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? t('ahora mismo', 'just now') : m < 60 ? t(`hace ${m} min`, `${m} min ago`) : m < 1440 ? t(`hace ${Math.round(m / 60)} h`, `${Math.round(m / 60)} h ago`) : new Date(iso).toLocaleDateString(idioma()); };
function estadoNube() { const e = E.nube.estado; return e === 'subiendo' ? t('Guardando…', 'Saving…') : e === 'bajando' ? t('Trayendo tu clóset…', 'Bringing your closet…') : e === 'error' ? t('Sin conexión: se guardará al volver', 'Offline: will save when back') : E.nube.cuando ? t(`Guardado ${haceRato(E.nube.cuando)}`, `Saved ${haceRato(E.nube.cuando)}`) : t('Pendiente de guardar', 'Not saved yet'); }
function pintarCuentaSiToca() { if (E.pantalla === 'cuenta') pintarCuenta(); }
function pintarCuenta() {
  const c = cuenta(), r = $('cu-raiz'); if (!r) return;
  if (CLOSET_ACT) { r.innerHTML = `<p class="cu-txt">${t('Estás en el clóset de pruebas. Las cuentas guardan «Mi ropa»: cámbialo en Yo → Clóset.', 'You are in the test closet. Accounts keep «My clothes»: switch in Me → Closet.')}</p>`; return; }
  if (c) {
    const n = E.prendas.filter(p => !p.ejemplo).length;
    const nomC = c.nombre || E.perfil?.nombre || '', nomV = nomC && nomC === nomC.toUpperCase() ? nomC.charAt(0) + nomC.slice(1).toLowerCase() : nomC;
    // 0.114: con el panel de Yo (iconos, grupos, letra más oscura)
    r.innerHTML = `<div class="cu-cab"><i class="cu-ini">${(nomV || c.correo || '?').charAt(0).toUpperCase()}</i><b>${nomV}</b><span>${c.correo}</span></div>`
      + grupoP(t('Tu clóset en la nube', 'Your closet in the cloud'), filaP({ tag: 'div', ic: 'nube', tit: t('Estado', 'Status'), val: estadoNube(), oro: true, flecha: false })
        + filaP({ tag: 'div', ic: 'percha', tit: t('Prendas guardadas', 'Saved garments'), val: String(n), flecha: false })
        + filaP({ id: 'cu-ya', ic: 'subir', tit: t('Guardar ahora', 'Save now'), flecha: false })
        + filaP({ id: 'cu-traer', ic: 'bajar', tit: t('Traer lo de otros móviles', 'Bring from other phones'), flecha: false }),
        t('Tu selfie y tu foto de cuerpo no se suben: se quedan en este móvil.', 'Your selfie and body photo are never uploaded: they stay on this phone.'))
      + grupoP('', filaP({ id: 'cu-salir', ic: 'salir', tit: t('Cerrar sesión', 'Sign out'), flecha: false }) + filaP({ id: 'cu-borrar', ic: 'borrar', tit: t('Borrar mi cuenta', 'Delete my account'), rojo: true, flecha: false }));
    $('cu-ya').onclick = () => subirNube(); $('cu-traer').onclick = async () => { E.nube.estado = 'bajando'; pintarCuenta(); await bajarNube(); E.nube.estado = 'ok'; pintarCuenta(); toast(t('Clóset al día', 'Closet up to date')); };
    $('cu-salir').onclick = cerrarSesion; $('cu-borrar').onclick = borrarCuenta;
  } else {
    r.innerHTML = `<p class="cu-txt">${t('Crea tu cuenta para guardar tu clóset y verlo en cualquier móvil.', 'Create your account to keep your closet and see it on any phone.')}</p>
      <div class="ac-campos"><label class="ac-campo"><span class="mini-et">${t('Correo', 'Email')}</span><input type="email" id="cu-correo" autocomplete="email"></label>
      <label class="ac-campo"><span class="mini-et">${t('Contraseña', 'Password')}</span> <small class="ac-pista">${t('mínimo 8 caracteres', 'at least 8 characters')}</small><input type="password" id="cu-clave" autocomplete="new-password"></label></div>
      <div class="cu-bts"><button class="boton" id="cu-crear">${t('Crear mi cuenta', 'Create my account')}</button><button class="boton linea" id="cu-entrar">${t('Ya tengo cuenta', 'I have an account')}</button></div>`;
    ojos();
    const go = async modo => { const b = $(modo === 'alta' ? 'cu-crear' : 'cu-entrar'); b.disabled = true; const ok = await abrirCuenta(modo, $('cu-correo').value.trim(), $('cu-clave').value, E.perfil?.nombre); b.disabled = false; if (ok) { pintarCuenta(); toast(modo === 'alta' ? t('Cuenta creada: tu clóset ya se guarda', 'Account created: your closet is being saved') : t('Dentro: tu clóset está al día', 'Signed in: your closet is up to date')); } };
    $('cu-crear').onclick = () => go('alta'); $('cu-entrar').onclick = () => go('entrar');
  }
}

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
  // 0.89: con sus fotos, un rojo granate muy saturado salía marrón, un rosa empolvado salía rojo y un mostaza salía marrón
  // 0.108 (Gabriela, 28/10: «13. sí sí claro»): seis colores más del estilista: burdeos, terracota, mostaza, crema, caqui y lila
  if (l > .84 && sat >= .13 && h >= 25 && h < 65) return 'Crema';
  if (h >= 8 && h < 28 && sat > .35 && sat < .75 && l >= .3 && l < .52) return 'Terracota';
  if (h < 15 || h >= 335) return l > .62 || (sat < .35 && l > .35) ? 'Rosa' : l < .3 && sat < .6 ? 'Marrón' : l < .36 ? 'Burdeos' : 'Rojo';
  if (h >= 30 && h < 42 && sat > .75 && l > .18 && l < .6) return l < .5 ? 'Mostaza' : 'Amarillo';
  if (h < 42) return sat > .55 && l > .35 && l < .7 ? 'Naranja' : l < .32 ? 'Marrón' : l > .6 ? 'Beige' : 'Camel';
  if (h < 68) return sat > .45 && l < .8 ? (l < .47 ? 'Mostaza' : 'Amarillo') : l < .5 ? 'Caqui' : 'Beige';
  if (h < 170) return h < 110 && sat < .35 && l < .55 ? 'Caqui' : l > .7 && h > 120 ? 'Verde menta' : l < .25 ? 'Verde botella' : 'Verde'; // 11/11: colores nuevos
  if (h < 255) return l > .55 || sat < .35 ? 'Azul claro' : l < .25 ? 'Azul marino' : 'Azul';
  return l < .55 ? (h >= 300 && sat > .5 && l > .3 ? 'Fucsia' : 'Morado') : h < 300 ? 'Lila' : 'Rosa';
}

/* ---------- estilo de la app, plan de demostración, color del conjunto y maniquí ---------- */
let PLAN_URL = null;
// ejes del diseño de antes (?ver=clasico): letra, color, tiempo y simetría; la pantalla «Diseño» se quitó el 06/11 (el diseño de todas no los usa)
const DIS = {
  letra: { vals: ['inter', 'atkinson', 'jost', 'source', 'playfair'], def: 'inter', nom: { inter: 'Inter', atkinson: 'Atkinson', jost: 'Jost', source: 'Source Serif', playfair: 'Playfair' } },
  tema: { vals: ['categorias', 'nogal', 'verde', 'color'], def: 'categorias', nom: { categorias: 'Por tipo de prenda', nogal: 'Nogal', verde: 'Nogal y verde', color: 'Color de tu ropa' } },
  tiempo: { vals: ['medallon', 'franja', 'linea', 'emoji'], def: 'medallon', nom: { medallon: 'Arriba, junto a la fecha', franja: 'Franja de color', linea: 'Frase', emoji: 'Con emoji' } },
  sim: { vals: ['1', '0'], def: '1', nom: { '1': 'Simétrica', '0': 'Libre' } }
};
const DIS_URL = {};
const dis = k => { if (DIS_URL[k]) return DIS_URL[k]; let v = null; try { v = localStorage.getItem('tc_' + k); } catch (e) { } return DIS[k].vals.includes(v) ? v : DIS[k].def; }; // tc_tiempo es también la caché del tiempo
const TEMAS = DIS.tema.vals;
const tema = () => dis('tema');
// 04/11 (Gabriela: «danos la opción de elegir la versión gratis, básica y luego la pro… desde nuestras cuentas… de una versión a otra no se puede perder nada»):
// la versión elegida va en la cuenta (perfil.verComo); cambiarla no toca la ropa ni los looks. En la gratis se usan las 10 primeras prendas que subió; las demás siguen guardadas
const VERSIONES = ['gratis', 'basico', 'pro'], TOPE_GRATIS = 10;
const planDemo = () => PLAN_URL || (VERSIONES.includes(E.perfil?.verComo) && E.perfil.verComo) || localStorage.getItem('tc_plan') || 'pro';
const enGratis = () => planDemo() === 'gratis';
const verPrendas = () => enGratis() ? E.prendas.slice(-TOPE_GRATIS) : E.prendas;
const nomPlan = k => k === 'pro' ? 'Pro' : k === 'basico' ? t('Básico', 'Basic') : t('Gratis', 'Free');
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
// 0.72 (Gabriela, 23/10: «se desperdician muchos espacios… es importante el problema de las escalas, que tengan sentido lógico»):
// cada prenda a su tamaño real en cm. Ropa: por su largo (el ancho cambia según cómo se extiendan las mangas); calzado, bolsos y
// accesorios: por su lado mayor. El largo sale del tipo (desplegable) o, si no hay, del nombre; sin foto medida, las medidas de antes.
const LARGO = { 'a t-shirt': 66, 'a blouse': 64, 'a shirt': 72, 'a polo shirt': 66, 'a crop top': 42, 'a tank top': 58, 'a sleeveless top': 58, 'a halter bodysuit': 62, 'a peplum top': 60, 'a sweater': 64, 'a hoodie': 68, 'a cardigan': 66, 'a knitted vest': 56,
  trousers: 102, jeans: 102, 'wide leg pants': 104, shorts: 38, leggings: 92,
  'a skirt': 62, 'a mini skirt': 40, 'a midi skirt': 78, 'a long skirt': 95, 'a pleated skirt': 70, 'a flared skirt': 62, 'a lace skirt': 62,
  'a dress': 95, 'a mini dress': 80, 'a midi dress': 112, 'a long dress': 140, 'a wrap dress': 105, 'a jumpsuit': 140,
  'a coat': 100, 'a trench coat': 105, 'a puffer jacket': 68, 'a parka': 85, 'a jacket': 68, 'a denim jacket': 60, 'a bomber jacket': 60, 'a blazer': 72,
  'a pair of shoes': 26, 'a pair of sneakers': 28, 'a pair of boots': 32, 'a pair of knee high boots': 46, 'a pair of ankle boots': 27, 'a pair of high heels': 25, 'a pair of sandals': 25, 'a pair of ballet flats': 24, 'a pair of loafers': 26,
  'a handbag': 28, 'a shoulder bag': 30, 'a crossbody bag': 24, 'a tote bag': 42, 'a clutch bag': 25, 'a backpack': 42,
  'a belt': 30, 'a scarf': 40, 'a hat': 36, 'a cap': 26, 'a sunglasses': 15, sunglasses: 15, 'a necklace': 22, earrings: 9, 'a bracelet': 10, 'a watch': 10, gloves: 22 };
// 10/11 (Sheila: «el top es súper grande con respecto a la falda»): manda el nombre; lo reconocido en la foto (p.x) solo afina cuando el nombre es genérico («Falda corta deportiva» con «a skirt» medía 62 cm, y «Vestido midi» caía en el largo de las faldas midi)
const LARGO_NOMBRE = [[/vestido largo|maxivestido|mono/, 140], [/vestido midi/, 112], [/vestido corto|minivestido|vestido mini/, 85], [/minifalda|falda corta|falda mini/, 40], [/falda (larga|maxi)|maxifalda/, 95], [/falda midi/, 78], [/short|bermuda/, 38], [/malla|legging/, 92],
  [/abrigo|gabardina|trench/, 102], [/parka/, 85], [/americana|blazer/, 72], [/chaqueta|cazadora|plumas/, 66], [/top corto|crop/, 42], [/bota alta|mosquetera/, 46], [/bot[ií]n/, 27], [/tote|shopper|mochila/, 42], [/cartera|clutch|de mano/, 25], [/bandolera/, 24]];
const LARGO_GENERICO = [[/vestido/, 100], [/falda/, 62], [/pantal|vaquer|jean|jogger/, 102], [/camisa/, 72], [/sudadera/, 68], [/bota/, 32]];
const LARGO_TIPO = { Arriba: 62, Abrigo: 72, Abajo: 100, Vestidos: 100, Calzado: 26, Bolsos: 30, Accesorios: 20 };
const largoDe = p => { const n = (p.nombre || '').toLowerCase(), f = l => (l.find(([r]) => r.test(n)) || [])[1]; return f(LARGO_NOMBRE) || LARGO[p.x] || f(LARGO_GENERICO) || LARGO_TIPO[p.tipo] || 40; };
const tamAntiguo = p => { const M = MEDIDA[p.tipo] || [40, 40]; if (!p.caja) return M; let w = M[0], h = w * p.caja[4]; const tope = M[1] * 1.25; if (h > tope) { h = tope; w = h / p.caja[4]; } return [w, h]; };
// 0.87 (Gabriela, 24/10: «la escala de las prendas en el básico me sigue pareciendo desproporcionada»): tres maneras de escalar para que elijan.
// real = medidas de verdad; revista = como los bodegones de moda (calzado y bolso más grandes, la parte de arriba algo menor); equilibrada = todo más parecido de tamaño
const ESCALA = (() => { try { const q = new URLSearchParams(location.search).get('escala'); if (q) localStorage.setItem('tc_escala', q); return localStorage.getItem('tc_escala') || 'revista'; } catch (e) { return 'revista'; } })();
const AJUSTE = { revista: { Calzado: 1.4, Bolsos: 1.3, Accesorios: 1.4, Arriba: .9, Abrigo: .92 } };
function largoEsc(p) { const L = largoDe(p); if (ESCALA === 'equilibrada') return 45 + (L - 45) * .55; return L * ((AJUSTE[ESCALA] || {})[p.tipo] || 1); }
function tam(p) {
  if (!p.caja) return tamAntiguo(p);
  const L = largoEsc(p), r = p.caja[4] || 1; // r = alto / ancho de la prenda en su foto
  if (['Calzado', 'Bolsos', 'Accesorios'].includes(p.tipo)) return r >= 1 ? [L / r, L] : [L, L * r];
  return [L / r, L]; // sin deformar: el ancho sale de la foto (mangas abiertas = más ancho, como en la realidad)
}
async function medirFoto(p) {
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = urlFoto(p); });
  const S = 140, k = S / Math.max(im.naturalWidth, im.naturalHeight), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1; const fi = new Map(); // fila → [izquierda, derecha]
  for (let i = 0, q = 0; i < d.length; i += 4, q++) { if (d[i + 3] < 30 || Math.min(d[i], d[i + 1], d[i + 2]) > 248) continue; /* 0.87: antes 236 y las prendas blancas se medían recortadas */ const px = q % w, py = (q / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; const f = fi.get(py); if (!f) fi.set(py, [px, px]); else if (px > f[1]) f[1] = px; }
  if (x1 < 0) return [0, 0, 1, 1, h / w, .5];
  // 0.111 (Gabriela, 28/10: «no hay simetría»): el eje del cuerpo es la mediana de los centros de cada fila; con una manga más abierta que
  // la otra, el centro de la caja se desplaza y la prenda salía torcida respecto a la de abajo
  const cen = [...fi.values()].map(([a, b]) => (a + b + 1) / 2).sort((a, b) => a - b), ejeX = cen[cen.length >> 1];
  const c0 = [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h]; return [...c0.map(v => +v.toFixed(4)), +(((c0[3] - c0[1]) * h) / ((c0[2] - c0[0]) * w)).toFixed(4), +((ejeX - x0) / (x1 + 1 - x0)).toFixed(4)];
}
// 0.112 (Gabriela, 28/10: «las fotos, por ejemplo las del pantalón, salen como con un ángulo inclinado, hay que ponerlas en un plano recto…
// hacerlo homogéneo para todas las prendas»): cada prenda se endereza sola una vez (p.recta = el giro aplicado) al giro de ±8° que la deja más
// simétrica respecto a un eje vertical. Probado con sus 25 fotos: endereza las que estaban torcidas (pantalón ancho, tirantes, manga larga roja)
// y no toca las rectas. (Antes se probó el giro que deja la caja más pequeña: torcía los tops rectos.) Una pierna más abierta que la otra
// no se arregla girando. La foto de antes se queda en el móvil (fotoTorcida); la nueva sube a la cuenta como cualquier cambio de foto
const SE_ENDEREZA = ['Arriba', 'Abajo', 'Vestidos', 'Abrigo'];
const cajaClara = (x, w, h) => { const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let i = 0, q = 0; q < d.length; i++, q += 4) if (d[q] + d[q + 1] + d[q + 2] < 735) { const px = i % w, py = (i / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; } return x1 < 0 ? null : [x0, y0, x1, y1]; };
async function anguloRecto(b) { // 0.114 (Gabriela, 28/10: «la app en el móvil sigue teniendo problemas para abrir… se demora una eternidad»): 4 veces más ligero
  const bm = await createImageBitmap(b), S = 80, k = S / Math.max(bm.width, bm.height), w = Math.round(bm.width * k), h = Math.round(bm.height * k), L = Math.ceil(Math.hypot(w, h)) + 2;
  const c = document.createElement('canvas'); c.width = c.height = L; const x = c.getContext('2d', { willReadFrequently: true });
  const masc = g => { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#fff'; x.fillRect(0, 0, L, L); x.translate(L / 2, L / 2); x.rotate(g * Math.PI / 180); x.drawImage(bm, -w / 2, -h / 2, w, h);
    const d = x.getImageData(0, 0, L, L).data, m = new Uint8Array(L * L); for (let i = 0, q = 0; i < d.length; i += 4, q++) m[q] = Math.min(d[i], d[i + 1], d[i + 2]) <= 246 ? 1 : 0; return m; };
  // parecido entre la prenda y su reflejo (intersección / unión), con el eje en su centro de masas, desplazado hasta ±2 px
  const sim = m => { let n = 0, sx = 0; for (let q = 0; q < m.length; q++) if (m[q]) { n++; sx += q % L; } if (!n) return 0; const cx = sx / n; let best = 0;
    for (let dd = -2; dd <= 2; dd++) { const e = Math.round(2 * cx) + dd; let ni = 0, nu = 0;
      for (let y = 0; y < L; y++) { const r = y * L; for (let xx = 0; xx < L; xx++) { const a = m[r + xx], j = e - xx, bb = j >= 0 && j < L ? m[r + j] : 0; ni += a & bb; nu += a | bb; } }
      if (nu && ni / nu > best) best = ni / nu; } return best; };
  const s0 = sim(masc(0)); let g0 = 0, s1 = s0;
  for (let g = -8; g <= 8; g += 2) { if (!g) continue; const v = sim(masc(g)); if (v > s1) { s1 = v; g0 = g; } }
  for (const paso of [1, .5]) { const c0 = g0; for (const g of [c0 - paso, c0 + paso]) { const v = sim(masc(g)); if (v > s1) { s1 = v; g0 = g; } } }
  return Math.abs(g0) >= 1 && s1 - s0 >= .01 ? g0 : 0;
}
// se endereza en segundo plano: una prenda cada vez, dejando respirar al móvil, y nunca mientras trae el clóset de la cuenta
// (si no, enderezaba las copias viejas antes de recibir las que ya llegaban rectas de otro móvil)
let enderezando = null;
function enderezarTodas() {
  if (enderezando || E.nube.estado === 'bajando' || (cuenta() && !E.nubeBajada)) return enderezando;
  enderezando = (async () => {
    try {
      let n = 0;
      for (const p of E.prendas.filter(p => p.foto && !p.src && !p.ejemplo && !p.fCat && p.recta == null && SE_ENDEREZA.includes(p.tipo))) {
        await new Promise(r => setTimeout(r, 120)); if (E.nube.estado === 'bajando') return;
        try { const g = await anguloRecto(p.foto); if (g) { const b = await fotoRecta(p.foto, g); if (b) { p.fotoTorcida = p.foto; p.foto = b; urls.delete(p.id); alfa.delete(p.id); p.caja = null; n++; } } p.recta = g; } catch (e) { p.recta = 0; }
      }
      await guardar(); if (n) { E.propuestas = []; medirTodas(); }
    } finally { enderezando = null; }
  })();
  return enderezando;
}
// la foto girada, del mismo tamaño que la original y con la prenda centrada; solo se reduce si girada no cabe
async function fotoRecta(b, g) {
  const bm = await createImageBitmap(b), W = bm.width, H = bm.height, a = g * Math.PI / 180, cw = Math.ceil(Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a))), ch = Math.ceil(Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a)));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch); x.translate(cw / 2, ch / 2); x.rotate(a); x.drawImage(bm, -W / 2, -H / 2); x.setTransform(1, 0, 0, 1, 0, 0);
  const q = cajaClara(x, cw, ch); if (!q) return null;
  const m = Math.round(Math.min(W, H) * .04), bw = q[2] - q[0] + 1, bh = q[3] - q[1] + 1, s = Math.min(1, (W - 2 * m) / bw, (H - 2 * m) / bh);
  const o = document.createElement('canvas'); o.width = W; o.height = H; const ox = o.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, W, H);
  ox.drawImage(c, q[0], q[1], bw, bh, (W - bw * s) / 2, (H - bh * s) / 2, bw * s, bh * s);
  return new Promise(r => o.toBlob(r, 'image/jpeg', .9));
}
/* ---------- PRENDAS REPETIDAS (Gabriela, 05/11: «si cree que hay alguna que puede estar repetida me lo pregunta dentro de la app, es válido para todos»;
   «que el sistema detecte si se sube una pieza más de una vez»). Cada prenda guarda la huella de su foto (dHash de 64 bits del recorte, sobre blanco, y su color medio);
   si una se parece mucho a otra más antigua, queda con `duda` y el clóset pregunta «¿Es la misma prenda?». «Son distintas» se recuerda en `noRep`. ---------- */
async function huellaDe(blob) {
  const bm = await createImageBitmap(blob), a = document.createElement('canvas'); a.width = a.height = 64;
  const xa = a.getContext('2d', { willReadFrequently: true }); xa.drawImage(bm, 0, 0, 64, 64); bm.close?.();
  const px = xa.getImageData(0, 0, 64, 64).data; let x0 = 64, y0 = 64, x1 = -1, y1 = -1, r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const k = (y * 64 + x) * 4; if (px[k + 3] < 40) continue; const blanco = px[k] > 238 && px[k + 1] > 238 && px[k + 2] > 238; if (blanco && px[k + 3] === 255) continue;
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; r += px[k]; g += px[k + 1]; b += px[k + 2]; n++; }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 63; }
  const c = document.createElement('canvas'); c.width = 9; c.height = 8; const xc = c.getContext('2d', { willReadFrequently: true });
  xc.fillStyle = '#fff'; xc.fillRect(0, 0, 9, 8); xc.drawImage(a, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, 9, 8);
  const d = xc.getImageData(0, 0, 9, 8).data, luz = k => d[k] * .299 + d[k + 1] * .587 + d[k + 2] * .114; let hu = '';
  for (let y = 0; y < 8; y++) { let v = 0; for (let x = 0; x < 8; x++) { const k = (y * 9 + x) * 4; v = v * 2 + (luz(k) > luz(k + 4) ? 1 : 0); } hu += v.toString(16).padStart(2, '0'); }
  return { hu, huC: n ? [r / n, g / n, b / n].map(Math.round) : [255, 255, 255] };
}
const distHuella = (a, b) => { let n = 0; for (let i = 0; i < 16; i += 2) { let v = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16); while (v) { n += v & 1; v >>= 1; } } return n; };
// misma foto o casi (≤ 8 de 64), o muy parecida con el mismo color y la misma categoría (≤ 12 y color a menos de 30; el 05/11, entre las 25 prendas distintas de Gabriela, lo más cercano fue 14)
function pareceRepetida(p, q) { if (!p.hu || !q.hu) return false; const h = distHuella(p.hu, q.hu), dc = Math.hypot(...p.huC.map((v, i) => v - q.huC[i])); return h <= 8 || (h <= 12 && dc < 30 && catDe(p) === catDe(q)); }
const dudasRepetidas = () => E.prendas.filter(p => p.duda && E.prendas.some(q => q.id === p.duda));
let revisando = null;
function revisarRepetidas() {
  if (revisando) return revisando;
  revisando = (async () => {
    await 0; // como en medirTodas: sin esto, sin nada que revisar, el finally corría antes de guardarse la promesa y «revisando» no volvía a null
    try {
      if (window.top !== window) return dudasRepetidas().length;
      let cambio = false;
      for (const p of E.prendas) if (!p.hu && p.foto instanceof Blob && !p.fotoRota) { try { Object.assign(p, await huellaDe(p.foto)); cambio = true; } catch (e) { } }
      // E.prendas va de la más nueva a la más antigua: la nueva es la que se pregunta
      E.prendas.forEach((p, i) => { if (p.duda || !p.hu) return; const q = E.prendas.slice(i + 1).find(q => q.hu && !(p.noRep || []).includes(q.id) && !(q.noRep || []).includes(p.id) && pareceRepetida(p, q)); if (q) { p.duda = q.id; cambio = true; } });
      if (cambio) await guardar();
      return dudasRepetidas().length;
    } finally { revisando = null; }
  })();
  return revisando;
}
function abrirRepetidas() {
  const lista = dudasRepetidas(); $('rep-capa')?.remove(); if (!lista.length) { if (E.pantalla === 'closet') pintarCloset(); return; }
  const p = lista[0], q = E.prendas.find(x => x.id === p.duda), dia = f => f ? new Date(f).toLocaleDateString(idioma() === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' }) : '';
  const cap = document.createElement('div'); cap.id = 'rep-capa'; cap.className = 'ay-capa at-vj at-rep'; cap.setAttribute('role', 'dialog'); cap.setAttribute('aria-modal', 'true'); cap.setAttribute('aria-labelledby', 'rep-t');
  cap.innerHTML = `<h1 id="rep-t" tabindex="-1">${t('¿Es la misma prenda?', 'Is it the same garment?')}</h1><p class="at-vj-sub">${t('Se parecen mucho. Si es la misma, quito la que subiste después.', 'They look very alike. If it is the same, I remove the one you added later.')}</p>
    <div class="rep-par">${[q, p].map(x => `<figure><img src="${urlCat(x)}" alt=""><figcaption>${String(x.nombre || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])}<small>${dia(x.creada)}</small></figcaption></figure>`).join('')}</div>
    <div class="at-ropa-ops"><button class="at-btn" data-rep="si">${t('Sí, es la misma', 'Yes, same one')}</button><button class="at-btn" data-rep="no">${t('No, son distintas', 'No, they differ')}</button></div>
    <button class="at-enlace" data-rep="">${lista.length > 1 ? t(`Ahora no · quedan ${lista.length - 1} más`, `Not now · ${lista.length - 1} more`) : t('Ahora no', 'Not now')}</button>`;
  document.body.append(cap); $('rep-t').focus({ preventScroll: true });
  cap.onclick = async e => { const b = e.target.closest('[data-rep]'); if (!b) return;
    if (b.dataset.rep === 'si') { borrarFotosNube(p); E.prendas = E.prendas.filter(x => x.id !== p.id); E.conjuntos.forEach(c => c.ids = c.ids.map(id => id === p.id ? q.id : id)); E.propuestas = []; await guardar(); toast(t('Quitada la repetida', 'Duplicate removed')); }
    else if (b.dataset.rep === 'no') { p.noRep = [...(p.noRep || []), q.id]; delete p.duda; await guardar(); }
    else { cap.remove(); return; }
    abrirRepetidas(); };
}

// 06/11 (Gabriela, 17:3x: «SÍ» a que cada prenda se estilice sola al subirla, para todas, con «Usar esta / Dejar la mía»): al guardar una prenda nueva con cuenta,
// el servidor hace su foto de catálogo (Gemini con el recorte de referencia, como en el experimento B del 06/11; ≈ 15 s) y la app la deja propuesta.
// Con «Usar esta», la de catálogo pasa a ser la única foto de la prenda (fCat, 06/11): se sube como <id>-c y la recortada y la original se borran de la nube.
// «Otra vez» la repite una vez con el modelo Pro. Sin cuenta, sin red o con el tope del día o del mes, la prenda se queda con su recorte.
const tipoCat = p => p.tipo === 'Calzado' ? 'calzado' : ['Bolsos', 'Accesorios'].includes(p.tipo) ? 'accesorio' : 'prenda';
const catPend = () => E.prendas.filter(p => p.catProp instanceof Blob && (!p.cat || p.catColor)); // catColor: la de catálogo en otro color (recolorCat)
const cargaImg = u => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
let estilizando = null, catParado = false;
function estilizarNuevas() {
  if (estilizando) return estilizando;
  if (catParado || !cuenta()?.token || window.top !== window) return Promise.resolve(0);
  estilizando = (async () => {
    await 0; let hechas = 0;
    try {
      for (;;) {
        // 07/11 (Gabriela: «a medida que uno vaya subiendo una pieza, pues se estiliza directamente y se elimina la foto original»; «lo de Sheila es exactamente
        // todo igual a lo que hicimos con lo mío… es un usuario más»): ya no se pregunta «Usar esta / Dejar la mía»; la foto de catálogo se pone sola, y no solo
        // en las prendas nuevas: también en las que se subieron antes de esto (las de Sheila). En esas, la recortada y la original se quedan en la nube hasta
        // que su dueña diga que le gustan (decisión del 06/11); en las nuevas se borran, como pidió Gabriela.
        const p = E.prendas.find(p => !p.cat && !p.conCat && !p.catNo && !p.ejemplo && (p.catProp instanceof Blob || (p.foto instanceof Blob && !p.fotoRota && (p.catFallos || 0) < 2)));
        if (!p) break;
        const r = p.catProp instanceof Blob ? true : await pedirCatalogo(p); if (r === 'parar') break;
        if (r && await usarCat(p, !p.catAuto)) hechas++;
        await BD.set('prendas', E.prendas).catch(() => { });
      }
    } finally { estilizando = null; }
    if (hechas) { await guardar(); if (E.pantalla === 'closet') cuandoQuieto(() => pintarCloset()); if (!$('rep-capa') && !$('cat-capa')) toast(hechas === 1 ? t('Tu prenda ya tiene foto de catálogo: míralo en el Clóset', 'Your garment has a catalogue photo: see it in the Closet') : t(`${hechas} prendas tienen ya foto de catálogo: míralas en el Clóset`, `${hechas} garments have a catalogue photo: see them in the Closet`)); }
    return hechas;
  })();
  return estilizando;
}
async function pedirCatalogo(p, otra, fuente = p.foto, pista) {
  const u = URL.createObjectURL(fuente);
  try {
    const im = await cargaImg(u), e = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * e), h = Math.round(im.naturalHeight * e);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .9)); if (!b) return null;
    const q = new URLSearchParams({ tipo: tipoCat(p), nombre: p.nombre || '' }); if (otra) q.set('otra', '1'); if (pista) q.set('pista', pista);
    const r = await api('/api/catalogo?' + q, { method: 'POST', body: b, headers: { 'Content-Type': 'image/jpeg' }, tiempo: 90000 });
    if (r.status === 429 || r.status === 503) { catParado = true; return 'parar'; } // tope del día o del mes, o sin clave: se vuelve a probar al abrir la app otro día
    if (r.status === 401) return 'parar';
    if (!r.ok) { p.catFallos = (p.catFallos || 0) + 1; return null; }
    const fin = await afinarCat(await r.blob()); if (!fin) { p.catFallos = (p.catFallos || 0) + 1; return null; }
    if (otra) p.catOtra = 1;
    p.catProp = fin.blob; p.catPropAR = fin.ar; return true;
  } catch (e) { p.catFallos = (p.catFallos || 0) + 1; return null; } finally { URL.revokeObjectURL(u); }
}
// como afinar.py de las fotos de catálogo hechas a mano: al borde de la prenda, 900 px de alto (o 1100 de ancho), con transparencia
async function afinarCat(b) {
  const u = URL.createObjectURL(b);
  try {
    const im = await cargaImg(u), W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let p = 0, k = 3; p < W * H; p++, k += 4) if (d[k] >= 24) { const px = p % W, py = (p / W) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    if (x1 < 0 || (x1 - x0) * (y1 - y0) < W * H * .03) return null;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1; let k = 900 / ch; if (cw * k > 1100) k = 1100 / cw;
    const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(cw * k)); o.height = Math.max(1, Math.round(ch * k)); const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, x0, y0, cw, ch, 0, 0, o.width, o.height);
    const blob = await new Promise(r => o.toBlob(r, 'image/webp', .86)); // Safari no hace WebP: da PNG, también con transparencia
    return blob && { blob, ar: Math.round(o.width / o.height * 1e4) / 1e4 };
  } finally { URL.revokeObjectURL(u); }
}
async function usarCat(p, conservarNube) {
  const b = p.catProp; if (!b) return false;
  try { await subirFoto('/api/foto/' + p.id + '-c', b); } catch (e) { return false; } // sin conexión: se vuelve a intentar la próxima vez
  // la foto de antes se queda 7 días solo en este móvil, por si la de catálogo no se parece («No se parece» en la ficha); después se borra sola
  if (p.foto instanceof Blob && !p.fCat && !p.fotoPrev) { p.fotoPrev = p.foto; p.fotoPrevT = Date.now(); }
  Object.assign(p, { cat: b, foto: b, conCat: 1, nubeC: Date.now().toString(36), catAR: p.catPropAR, fCat: 1, caja: null });
  for (const k of ['catProp', 'catPropAR', 'catColor', 'original', 'fotoSub', 'fotoSubO', 'cajaV', 'dudoso', 'recMano']) delete p[k];
  urls.delete(p.id); alfa.delete(p.id); urlsCat.delete(p.id);
  // 11/11 (Sheila: «si una prenda no coincide con la original después de plancharla, ¿qué hago?»): la foto de antes se queda 7 días también en la cuenta (prevNube), no solo
  // en el móvil que la estilizó; así «No se parece» sale se abra donde se abra. Pasados los 7 días, limpiarFotoPrev la borra del servidor. La original sin recortar, fuera ya
  if (conservarNube) p.nubeConserva = 1;
  else { api('/api/foto/' + p.id + '-o', { method: 'DELETE' }).catch(() => { }); if (p.nube || p.prevNube) { p.prevNube = 1; p.fotoPrevT = p.fotoPrevT || Date.now(); } else api('/api/foto/' + p.id, { method: 'DELETE' }).catch(() => { }); }
  E.propuestas = []; await guardar(); medirTodas(); return true;
}
// 10/11 (Sheila: «si una prenda no coincide con la original después de plancharla, ¿qué hago?»): la foto de antes solo estaba en el móvil que la estilizó; las prendas
// de antes guardan su foto en la cuenta (nubeConserva), así que «No se parece» sale en cualquier móvil y la trae de la cuenta al abrirlo
const DIAS_PREV = 7 * 864e5, puedeDeshacerCat = p => !!p.fCat && (!!p.nubeConserva || ((p.fotoPrev instanceof Blob || !!p.prevNube) && Date.now() - (p.fotoPrevT || 0) < DIAS_PREV));
async function limpiarFotoPrev() { let n = 0, nube = 0;
  for (const p of E.prendas) { if ((!p.fotoPrev && !p.prevNube) || Date.now() - (p.fotoPrevT || 0) < DIAS_PREV) continue;
    if (p.prevNube && !p.nubeConserva) { if (!cuenta()) continue; try { const r = await api('/api/foto/' + p.id, { method: 'DELETE' }); if (!r.ok) continue; } catch (e) { continue; } nube++; } // sin conexión, la próxima vez
    delete p.fotoPrev; delete p.fotoPrevT; delete p.prevNube; n++; }
  if (n) { await BD.set('prendas', E.prendas).catch(() => { }); if (nube) programarNube(); } }
// «No se parece» (ficha, hasta 7 días después): probar otra vez con el modelo bueno, desde la foto de antes, o volver a la foto de antes
async function noSeParece(p) {
  $('cat-capa')?.remove(); if (!puedeDeshacerCat(p)) return;
  if (!(p.fotoPrev instanceof Blob)) { // de la cuenta (prendas de antes): la foto que tenía antes de la de catálogo
    try { const r = await api('/api/foto/' + p.id, { tiempo: 30000 }); if (r.ok) { const b = await r.blob(); if (b.size > 1000) { p.fotoPrev = b; p.fotoPrevT = Date.now(); } } } catch (e) { }
    if (!(p.fotoPrev instanceof Blob)) return toast(t('Hace falta conexión para traer tu foto', 'You need a connection to fetch your photo')); }
  const u0 = URL.createObjectURL(p.fotoPrev), nom = String(p.nombre || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const cap = document.createElement('div'); cap.id = 'cat-capa'; cap.className = 'ay-capa at-vj at-rep'; cap.setAttribute('role', 'dialog'); cap.setAttribute('aria-modal', 'true'); cap.setAttribute('aria-labelledby', 'cat-t');
  cap.innerHTML = `<h1 id="cat-t" tabindex="-1">${nom}</h1><p class="at-vj-sub">${t('¿La foto de catálogo no se parece a tu prenda?', 'Doesn’t the catalogue photo look like your garment?')}</p>
    <div class="rep-par">${[[u0, t('Tu foto', 'Your photo')], [urlCat(p), t('Catálogo', 'Catalogue')]].map(([u, et]) => `<figure><img src="${u}" alt=""><figcaption>${et}</figcaption></figure>`).join('')}</div>
    <div class="at-ropa-ops">${p.catOtra ? '' : `<button class="at-btn" data-catu="otra">${t('Probar otra vez', 'Try again')}</button>`}<button class="at-btn" data-catu="mia">${t('Volver a mi foto', 'Back to my photo')}</button></div>
    <button class="at-enlace" data-catu="">${t('Dejarla así', 'Leave it')}</button>`;
  document.body.append(cap); $('cat-t').focus({ preventScroll: true });
  const fin = () => { URL.revokeObjectURL(u0); cap.remove(); if (E.pantalla === 'ficha' && $('at-ficha')?.dataset.id === p.id) abrirFicha(p.id); };
  cap.onclick = async e => { const b = e.target.closest('[data-catu]'); if (!b || cap.dataset.ocupado) return; const k = b.dataset.catu; if (k === '') return fin();
    cap.dataset.ocupado = 1; cap.querySelectorAll('button').forEach(x => x.disabled = true);
    if (k === 'otra') { b.textContent = t('Haciendo otra… unos 20 segundos', 'Making another… about 20 seconds');
      const r = await pedirCatalogo(p, true, p.fotoPrev); const ok = r === true && await usarCat(p, !!p.nubeConserva);
      toast(ok ? t('Foto de catálogo nueva puesta', 'New catalogue photo set') : r === 'parar' ? t('Ahora no puedo hacer fotos de catálogo. Prueba más tarde', 'I can’t make catalogue photos right now. Try again later') : t('No ha salido. Puedes volver a tu foto', 'It did not work. You can go back to your photo'));
      return fin(); }
    if (k === 'mia') { const prev = p.fotoPrev;
      try { await subirFoto('/api/foto/' + p.id, prev); } catch (e2) { toast(t('Hace falta conexión para volver a tu foto', 'You need a connection to go back to your photo')); delete cap.dataset.ocupado; cap.querySelectorAll('button').forEach(x => x.disabled = false); return; }
      for (const k2 of ['cat', 'conCat', 'nubeC', 'catAR', 'fCat', 'fotoPrev', 'fotoPrevT', 'prevNube', 'catOtra']) delete p[k2];
      Object.assign(p, { foto: prev, catNo: 1, nube: Date.now().toString(36), fotoSub: firma(prev) }); urls.delete(p.id); alfa.delete(p.id); urlsCat.delete(p.id);
      api('/api/foto/' + p.id + '-c', { method: 'DELETE' }).catch(() => { }); E.propuestas = []; await guardar(); medirTodas(); toast(t('Vuelve a tener tu foto', 'Your photo is back')); return fin(); }
  };
}
function abrirCatalogo(id) {
  const lista = catPend(), p = (id && lista.find(x => x.id === id)) || lista[0]; $('cat-capa')?.remove();
  if (!p) { if (E.pantalla === 'closet') pintarCloset(); else if (E.pantalla === 'ficha' && $('at-ficha')?.dataset.id) abrirFicha($('at-ficha').dataset.id); return; }
  const uC = URL.createObjectURL(p.catProp), nom = String(p.nombre || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const cap = document.createElement('div'); cap.id = 'cat-capa'; cap.className = 'ay-capa at-vj at-rep'; cap.setAttribute('role', 'dialog'); cap.setAttribute('aria-modal', 'true'); cap.setAttribute('aria-labelledby', 'cat-t');
  const rc = !!(p.catColor && p.cat), enCol = rc ? t('En ' + adjColor(p.catColor, /as?$/.test(String(p.nombre || '').split(/\s+/)[0].toLowerCase())), 'In ' + nomColor(p.catColor).toLowerCase()) : '';
  cap.innerHTML = `<h1 id="cat-t" tabindex="-1">${nom}</h1><p class="at-vj-sub">${rc ? t('La misma foto en el color nuevo. Si la usas, sustituye a la de ahora.', 'The same photo in the new colour. If you use it, it replaces the current one.') : t('Tu prenda, en foto de catálogo. Si la usas, será su única foto.', 'Your garment as a catalogue photo. If you use it, it becomes its only photo.')}</p>
    <div class="rep-par">${[[urlFoto(p), rc ? t('Ahora', 'Now') : t('Tu foto', 'Your photo')], [uC, rc ? enCol : t('Catálogo', 'Catalogue')]].map(([u, et]) => `<figure><img src="${u}" alt=""><figcaption>${et}</figcaption></figure>`).join('')}</div>
    <div class="at-ropa-ops"><button class="at-btn" data-catu="si">${t('Usar esta', 'Use this one')}</button><button class="at-btn" data-catu="no">${rc ? t('Dejar la de ahora', 'Keep the current one') : t('Dejar la mía', 'Keep mine')}</button></div>
    ${p.catOtra || rc ? '' : `<button class="at-enlace" data-catu="otra">${t('No se parece: probar otra vez', 'Not alike: try again')}</button>`}
    <button class="at-enlace" data-catu="">${lista.length > 1 ? t(`Ahora no · quedan ${lista.length - 1} más`, `Not now · ${lista.length - 1} more`) : t('Ahora no', 'Not now')}</button>`;
  document.body.append(cap); $('cat-t').focus({ preventScroll: true });
  const fin = () => { URL.revokeObjectURL(uC); cap.remove(); };
  cap.onclick = async e => { const b = e.target.closest('[data-catu]'); if (!b || cap.dataset.ocupado) return; const k = b.dataset.catu;
    if (k === '') { fin(); if (E.pantalla === 'closet') pintarCloset(); return; }
    cap.dataset.ocupado = 1; cap.querySelectorAll('button').forEach(x => x.disabled = true);
    if (k === 'si') { if (!(await usarCat(p, rc && !!p.nubeConserva))) { delete cap.dataset.ocupado; cap.querySelectorAll('button').forEach(x => x.disabled = false); return; } toast(t('Foto de catálogo puesta', 'Catalogue photo set')); }
    else if (k === 'no') { delete p.catProp; delete p.catPropAR; if (p.catColor) delete p.catColor; else p.catNo = 1; await guardar(); }
    else if (k === 'otra') { b.textContent = t('Haciendo otra… unos 20 segundos', 'Making another… about 20 seconds'); const r = await pedirCatalogo(p, true); await BD.set('prendas', E.prendas).catch(() => { });
      if (r !== true) toast(r === 'parar' ? t('Ahora no puedo hacer fotos de catálogo. Prueba más tarde', 'I can’t make catalogue photos right now. Try again later') : t('No ha salido: puedes usar esta o dejar la tuya', 'It did not work: use this one or keep yours'));
      fin(); return abrirCatalogo(p.id); }
    fin(); if (E.pantalla === 'ficha' && $('at-ficha')?.dataset.id === p.id) { abrirFicha(p.id); if (catPend().length) abrirCatalogo(); } else abrirCatalogo(); };
}
// 11/11 (Sheila, mensaje 2013: «la idea es que cambie el color del vestido y no lo hace»): al guardar otro color en una prenda con foto de catálogo, la misma foto
// en el color nuevo (Gemini, con la foto de catálogo de referencia y el color como corrección); se enseña junto a la de ahora antes de usarla, como cualquier foto de catálogo
async function recolorCat(p) {
  if (!(p.cat instanceof Blob)) return;
  if (!cuenta()?.token) return toast(t('Entra en tu cuenta para cambiar la foto', 'Sign in to change the photo'));
  toast(t('Cambiando el color de la foto… unos 20 segundos', 'Changing the photo colour… about 20 seconds'));
  const r = await pedirCatalogo(p, false, p.cat, `El color real es ${p.color.toLowerCase()}, la misma prenda, solo cambia el color`);
  await BD.set('prendas', E.prendas).catch(() => { });
  if (r === true) { p.catColor = p.color; return abrirCatalogo(p.id); }
  toast(r === 'parar' ? t('Ahora no puedo cambiar la foto. Prueba más tarde', 'I can’t change the photo right now. Try again later') : t('No ha salido. Prueba otra vez', 'It did not work. Try again'));
}
let midiendo = null;
function medirTodas() {
  if (midiendo) return midiendo;
  midiendo = (async () => {
    await 0; // 0.97: sin esto, cuando no había nada que medir, la función acababa antes de guardarse la promesa y «midiendo» no volvía a null nunca: ya no se medía nada más en toda la sesión
    // 0.97 (Gabriela, 24/10: «las combinaciones están horrendas en cuanto a la distribución espacial»): si algo fallaba aquí una vez, la medición
    // se quedaba bloqueada toda la sesión y las prendas salían sin recortar a su silueta (pequeñas y separadas). Ahora siempre se libera.
    try {
      const pend = E.prendas.filter(p => (!p.caja || p.cajaV !== 3) && (p.foto || p.src)); let n = 0;
      for (const p of pend) { try { p.caja = await medirFoto(p); p.cajaV = 3; n++; } catch (e) { p.caja = null; } }
      if (n) { if (E.prendas.some(p => !p.src)) await Promise.race([guardar(), new Promise(r => setTimeout(r, 3000))]).catch(() => { }); E.propuestas = []; cuandoQuieto(() => { try { if (E.pantalla === 'hoy') pintarHoy(); else if (E.pantalla === 'looks') pintarLooks(); } catch (e) { } }); }
    } finally { midiendo = null; }
  })();
  return midiendo;
}
// 0.86 (Gabriela, 24/10: «no se ve superpuesto como el estilo revista… se ve superpuesto transparente y queda feo»):
// las fotos guardadas llevan fondo blanco y se pintaban en «multiply», así que al pisarse se transparentaban.
// Se saca una versión con el fondo transparente (relleno desde los bordes de lo casi blanco) y esas piezas se pintan opacas, con sombra fina.
// 0.115 (Gabriela, 28/10: «la app en el móvil sigue teniendo problemas para abrir… no me entero si le doy a un botón o no… se demora una eternidad»):
// medido con la CPU 6 veces más lenta, esto se rehacía con las 25 fotos en cada apertura (más de 8 s de cálculo). Ahora se guarda en el móvil
// (almacén «alfas»: id → firma de la foto y resultado, aparte de las prendas, que se rehacen al juntarlas con la nube) y solo se rehace si cambia
// la foto; primero las piezas que hay en pantalla y dejando respirar entre una y otra
// 0.117 (Gabriela, 28/10: «no sé si le di a un botón o no»): un repintado que llega solo (tiempo, nube, medidas) mientras el dedo está
// apoyado cambiaba el botón bajo el dedo y el toque se perdía; ahora espera a que termine el toque (como mucho 1,5 s)
let dedo = 0;
addEventListener('pointerdown', () => { dedo = Date.now(); }, true);
for (const ev of ['click', 'pointercancel']) addEventListener(ev, () => setTimeout(() => { dedo = 0; }, 0));
const cuandoQuieto = f => { if (!dedo || Date.now() - dedo > 1500) return f(); setTimeout(() => cuandoQuieto(f), 80); };
const alfa = new Map(), alfaPide = new Set(); let alfando = null, alfaSucio = false, alfaCache = null;
async function hacerAlfa(p) {
  const f = p.foto ? firma(p.foto) : '', g = f && alfaCache?.get(p.id);
  if (g && g.f === f && g.b instanceof Blob) return URL.createObjectURL(g.b);
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = urlFoto(p); });
  const k = Math.min(1, 720 / Math.max(im.naturalWidth, im.naturalHeight)), W = Math.max(1, Math.round(im.naturalWidth * k)), H = Math.max(1, Math.round(im.naturalHeight * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H), px = d.data;
  let transp = 0; for (let i = 0; i < W; i++) if (px[i * 4 + 3] < 20) transp++; if (transp > W * .3) { if (f && alfaCache) { alfaCache.set(p.id, { f, b: p.foto }); alfaSucio = true; } return urlFoto(p); } // ya trae transparencia
  const claro = i => { const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; return Math.min(r, g, b) > 248 && Math.max(r, g, b) - Math.min(r, g, b) < 7; };
  const fuera = new Uint8Array(W * H), pila = [];
  const sem = i => { if (!fuera[i] && claro(i)) { fuera[i] = 1; pila.push(i); } };
  for (let i = 0; i < W; i++) { sem(i); sem((H - 1) * W + i); } for (let j = 0; j < H; j++) { sem(j * W); sem(j * W + W - 1); }
  while (pila.length) { const i = pila.pop(), cx = i % W; if (cx > 0) sem(i - 1); if (cx < W - 1) sem(i + 1); if (i >= W) sem(i - W); if (i < W * (H - 1)) sem(i + W); }
  for (let i = 0; i < W * H; i++) {
    if (fuera[i]) { px[i * 4 + 3] = 0; continue; }
    const cx = i % W; const borde = (cx > 0 && fuera[i - 1]) || (cx < W - 1 && fuera[i + 1]) || (i >= W && fuera[i - W]) || (i < W * (H - 1) && fuera[i + W]);
    if (borde) { const l = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); px[i * 4 + 3] = Math.max(60, Math.min(255, (255 - l) * 6)); } // borde suave
  }
  x.putImageData(d, 0, 0);
  const bl = await new Promise(r => c.toBlob(r, 'image/png')); if (f && bl && alfaCache) { alfaCache.set(p.id, { f, b: bl }); alfaSucio = true; } return URL.createObjectURL(bl);
}
async function guardarAlfas() { alfaSucio = false; const vivas = new Set(E.prendas.map(p => p.id)); await BD.set('alfas', Object.fromEntries([...alfaCache].filter(([id]) => vivas.has(id)))).catch(() => { }); }
function alfasTodas() {
  if (alfando) return alfando;
  alfando = (async () => {
    await 0; // 0.97: el mismo fallo que en medirTodas (con nada pendiente, «alfando» se quedaba ocupado para siempre)
    // 0.117 (Gabriela, 28/10: «no sé si le di a un botón o no»): antes se redibujaba la pantalla entera y, si coincidía con un toque, el toque se perdía;
    // ahora solo se cambia la foto de cada pieza que ya está en pantalla
    const repinta = () => { for (const el of document.querySelectorAll('.pz[data-pz]:not(.op)')) { const u = alfa.get(el.dataset.pz); if (u) { el.style.backgroundImage = `url('${u}')`; el.classList.add('op'); } }
      for (const el of document.querySelectorAll('img[data-pzi]:not(.op)')) { const u = alfa.get(el.dataset.pzi); if (u) { el.src = u; el.classList.add('op'); } } };
    try {
      if (!alfaCache) { let o = null; try { o = await BD.get('alfas'); } catch (e) { } alfaCache = new Map(Object.entries(o || {})); }
      const pend = E.prendas.filter(p => !alfa.has(p.id) && (p.foto || p.src)).sort((a, b) => alfaPide.has(b.id) - alfaPide.has(a.id));
      let n = 0, pintado = false;
      for (const p of pend) {
        try { alfa.set(p.id, await hacerAlfa(p)); n++; } catch (e) { alfa.set(p.id, null); }
        alfaPide.delete(p.id); repinta(); pintado = true;
        if (alfaSucio && n % 4 === 0) await guardarAlfas(); // por el camino: si se cierra la app a medias, lo hecho no se pierde
        await new Promise(r => setTimeout(r, 0));
      }
      if (alfaSucio) await guardarAlfas();
      if (n && !pintado) repinta();
    } finally { alfando = null; }
  })();
  return alfando;
}
const pieza = (p, x, y, w, h, W, H) => { const pos = `left:${x / W * 100}%;top:${y / H * 100}%;width:${w / W * 100}%;height:${h / H * 100}%`;
  if (!p.caja) { const u0 = alfa.get(p.id); if (!alfa.has(p.id)) { alfaPide.add(p.id); setTimeout(alfasTodas, 0); } return `<img${u0 ? ' class="op"' : ''} data-pzi="${p.id}" src="${u0 || urlFoto(p)}" alt="" style="${pos}">`; } // 06/11 (Gabriela: «hay piezas que tienen un cuadrado blanco detrás cuando se crean outfits»): sin caja, también sin el blanco
  const [a, b, c, d] = p.caja, cw = c - a, ch = d - b;
  const u = alfa.get(p.id); if (!alfa.has(p.id)) { alfaPide.add(p.id); setTimeout(alfasTodas, 0); }
  return `<i class="pz${u ? ' op' : ''}" data-pz="${p.id}" style="${pos};background-image:url('${u || urlFoto(p)}');background-size:${100 / cw}% ${100 / ch}%;background-position:${cw < 1 ? a / (1 - cw) * 100 : 0}% ${ch < 1 ? b / (1 - ch) * 100 : 0}%"></i>`; };
// 0.32 · presentación «collage» (Sheila, 22/10: «inspírate en esto para presentar los looks», dos referencias tipo Pinterest):
// el look en una columna (arriba tocando la pieza de abajo), y a un lado el bolso arriba, los accesorios en medio y el calzado abajo.
// Se activa con ?comp=collage (queda guardado); la simétrica (Eje/Cruz, cerrada por Gabriela el 20/10) sigue por defecto hasta que ella decida.
// 0.107 (Gabriela, 28/10: «5. me gustan simétrica y collage»): Hoy, el calendario y la ficha, simétrica; Looks, collage. ?comp= solo para pruebas
// 0.111 (Gabriela, 28/10: «la confección de los outfits es horrible, no hay simetría, muchos espacios entre prendas»): «conjunto» en todas partes
// 0.12 · propuesta completa (Gabriela, 28/10: «cuando tengas una solución y una propuesta homogénea y general… me notificas»): con ?propuesta=012 se ve
// la app nueva (tarjeta 4:5, Hoy dentro de Looks, barra de cuatro) con su propia ropa; ?propuesta=0 vuelve a la de siempre. Se aplica a todas con su sí
// 03/11 (Gabriela: «sí, para todas»; Sheila dijo sí el 30/10): el diseño A «Atelier» es el de todas. Las propuestas 012, 013 y 014 solo se ven con ?ver= una vez;
// ?ver=clasico enseña el diseño de antes (lo usa comparar.html). Lo que hubiera guardado de las pruebas en tc_prop se olvida.
const VER = (() => { try { const v = new URLSearchParams(location.search).get('ver') || ''; if (localStorage.getItem('tc_prop')) localStorage.removeItem('tc_prop'); return v; } catch (e) { return ''; } })();
// 06/11 (revisión de toda la app): las propuestas 012, 013 y 014, descartadas, ya no se cargan; ?ver=012|013|014 enseña el diseño de todas
const AT = VER !== 'clasico';
const COMP = (() => { try { return new URLSearchParams(location.search).get('comp') || 'conjunto'; } catch (e) { return 'conjunto'; } })();
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
  let ly = 0; izq.forEach((p, k) => { const [w, h] = szI[k]; out.push([p, (lw - w) / 2, ly, w, h]); ly += h + G; });
  if (calzado) { const [w, h] = szZ; out.push([calzado, Math.max(0, x0 - w * .55), H - h * .85, w, h]); }
  if (bolso) { const [w, h] = szB; out.push([bolso, W - w, H * .3 - h / 2, w, h]); }
  const Ht = Math.max(H + (calzado ? szZ[1] * .15 : 0), ly - G);
  return { out, W, H: Ht };
}
// 0.72 · presentación «capas» (Gabriela, 23/10: «se desperdician muchos espacios… las escalas, que tengan sentido lógico»): todo a su
// tamaño real y junto, como un flat lay: la chaqueta asoma por detrás de la parte de arriba, que pisa la cintura de la de abajo; el
// calzado, al pie, como puesto; el bolso a la altura de la cadera y los accesorios junto a los hombros. El marco se ajusta al conjunto.
// 0.91 · «abierto» (Sheila, 24/10: «mira qué mal la distribución»: la de arriba tapaba media chaqueta y el bolso se metía en el conjunto):
// la capa y la de arriba casi lado a lado, el bolso fuera del conjunto y por debajo de la de arriba. Se prueba con ?comp=abierto
function capas(ps, abierto) {
  const m = tam, rol = r => ps.filter(p => r.includes(p.tipo));
  const tops = rol(['Arriba']), abrigos = rol(['Abrigo']);
  const top = tops[0], capa = abrigos[0] || tops[1], grande = rol(['Abajo', 'Vestidos'])[0], bolso = rol(['Bolsos'])[0], calzado = rol(['Calzado'])[0], acc = rol(['Accesorios']).slice(0, 2);
  const out = []; // [p, x, y, w, h] con x centrado en 0 para la columna
  let y = 0, cIzq = 0, cDer = 0;
  const arriba = top || (grande ? null : capa); const conCapa = capa && capa !== arriba;
  if (arriba || conCapa) {
    const [tw, th] = arriba ? m(arriba) : [0, 0], [cw, ch] = conCapa ? m(capa) : [0, 0];
    if (arriba && conCapa) { // la capa detrás, a la izquierda; la de arriba delante, pisándola
      const pisa = abierto ? .9 : .55, ancho = cw * pisa + tw, x0 = -ancho / 2;
      out.push([capa, x0, 0, cw, ch]); out.push([arriba, x0 + cw * pisa, Math.max(0, (ch - th) * .15), tw, th]);
      cIzq = x0; cDer = x0 + ancho; y = Math.max(ch * .8, th * .82);
    } else if (arriba) { out.push([arriba, -tw / 2, 0, tw, th]); cIzq = -tw / 2; cDer = tw / 2; y = th * .82; }
    else { out.push([capa, -cw / 2, 0, cw, ch]); cIzq = -cw / 2; cDer = cw / 2; y = ch * .8; }
  }
  let yG = y, gIzq = cIzq, gDer = cDer, fin = y;
  if (grande) {
    const [gw, gh] = m(grande);
    if (!out.length) yG = 0;
    out.unshift([grande, -gw / 2, yG, gw, gh]); // debajo de la parte de arriba
    gIzq = -gw / 2; gDer = gw / 2; fin = yG + gh;
  } else if (out.length) fin = Math.max(...out.map(o => o[2] + o[4]));
  // con vestido y capa sin parte de arriba: la capa detrás del vestido, a la izquierda
  if (grande && conCapa && !top) { const [cw, ch] = m(capa); out.unshift([capa, gIzq - cw * .45, 0, cw, ch]); }
  if (calzado) { const [w, h] = m(calzado), pisa = grande?.tipo === 'Abajo' && !/falda|skirt|short/i.test((grande.nombre || '') + (grande.x || '')) ? h * .3 : -h * .08; out.push([calzado, -w / 2, fin - pisa, w, h]); fin += h - pisa; } // con pantalón, al pie como puesto; con falda o vestido, un poco por debajo
  if (bolso) { const [w, h] = m(bolso); if (abierto) { const finArriba = Math.max(0, ...out.filter(o => o[0] !== grande && o[0] !== calzado).map(o => o[2] + o[4])); const yb = Math.max(grande ? yG + m(grande)[1] * .12 : fin * .45, finArriba + 3); out.push([bolso, gDer + 4, yb, w, h]); } else { const yb = grande ? yG + m(grande)[1] * .12 : fin * .45; out.push([bolso, Math.max(gDer, cDer * .6) - w * .2, yb, w, h]); } }
  let ya = 0; acc.forEach(p => { const [w, h] = m(p); out.push([p, Math.min(cIzq, gIzq) - w * .7, ya, w, h]); ya += h + 3; });
  if (!out.length) return null;
  const x0 = Math.min(...out.map(o => o[1])), x1 = Math.max(...out.map(o => o[1] + o[3])), y0 = Math.min(...out.map(o => o[2])), y1 = Math.max(...out.map(o => o[2] + o[4]));
  // el marco se ciñe al conjunto entero y se centra en pantalla: sin franjas vacías a los lados
  const W = x1 - x0, H = y1 - y0;
  return { out: out.map(([p, x, yy, w, h]) => [p, x - x0, yy - y0, w, h]), W, H };
}
// 0.111 · «conjunto» (Gabriela, 28/10: «no hay simetría, muchos espacios entre prendas»): un flat lay de revista sobre un solo eje.
// Cada prenda se centra por el eje de su cuerpo (caja[5]); la de arriba pisa la cinturilla (por dentro: la de abajo la pisa a ella);
// la capa asoma por detrás; los zapatos, al pie, pisan el bajo del pantalón; bolso a la derecha y accesorios a la izquierda, a la
// altura de la cadera y de los hombros. El marco es simétrico respecto al eje: el conjunto queda siempre en el centro y sin huecos.
function conjunto(ps) {
  const m = tam, rol = r => ps.filter(p => r.includes(p.tipo)), G = 3;
  const tops = rol(['Arriba']), top = tops[0], capa = rol(['Abrigo'])[0] || tops[1], grande = rol(['Abajo', 'Vestidos'])[0];
  const calzado = rol(['Calzado'])[0], bolso = rol(['Bolsos'])[0], acc = rol(['Accesorios']).slice(0, 2);
  const pon = (p, y, centro) => { const [w, h] = m(p); return [p, -w * (centro ? .5 : (p.caja?.[5] ?? .5)), y, w, h]; };
  const arriba = top || (grande ? null : capa), conCapa = capa && capa !== arriba;
  let oCapa = null, oArr = null, oG = null, oZ = null, yA = 0;
  if (conCapa && (arriba || grande)) { oCapa = pon(capa, 0); yA = oCapa[4] * .07; }
  if (arriba) oArr = pon(arriba, yA);
  let fin = oArr ? yA + oArr[4] : oCapa ? oCapa[4] : 0;
  if (grande) { const yG = oArr ? yA + oArr[4] * (grande.tipo === 'Vestidos' ? .55 : .88) : 0; oG = pon(grande, yG); fin = yG + oG[4]; } // la de arriba pisa un 12 % la cinturilla
  if (calzado) { const [w, h] = m(calzado), pantalon = grande?.tipo === 'Abajo' && !/falda|skirt|short|bermuda/i.test(`${grande.nombre || ''} ${grande.x || ''}`); const y = pantalon ? fin - h * .32 : fin + h * .08; oZ = [calzado, -w / 2, y, w, h]; fin = y + h; }
  const cuerpo = [oCapa, oArr, oG].filter(Boolean); if (!cuerpo.length && !oZ) return null;
  const der = Math.max(0, ...cuerpo.map(o => o[1] + o[3])), izq = Math.min(0, ...cuerpo.map(o => o[1]));
  const extra = [];
  if (bolso) { const [w, h] = m(bolso), y = oG ? oG[2] + oG[4] * .08 : fin * .45; extra.push([bolso, (oG ? oG[1] + oG[3] : der) + G, y, w, h]); }
  let ya = oArr ? oArr[2] : 0; acc.forEach(p => { const [w, h] = m(p); extra.push([p, (oArr ? oArr[1] : izq) - w - G, ya, w, h]); ya += h + G; });
  // orden de dibujo: la capa detrás; por dentro, la de abajo encima de la de arriba; los zapatos pisan el bajo
  const dentro = ps.como === 'por dentro' && oArr && oG && grande.tipo === 'Abajo';
  const out = [oCapa, ...(dentro ? [oArr, oG] : [oG, oArr]), oZ, ...extra].filter(Boolean);
  const x0 = Math.min(...out.map(o => o[1])), x1 = Math.max(...out.map(o => o[1] + o[3])), R = Math.max(-x0, x1);
  const y0 = Math.min(...out.map(o => o[2])), y1 = Math.max(...out.map(o => o[2] + o[4]));
  return { out: out.map(([p, x, y, w, h]) => [p, x + R, y - y0, w, h]), W: 2 * R, H: y1 - y0 };
}
/* 0.12 · «tarjeta» (Dirección de Producto, 28/10, composicion-looks.md §2): lienzo fijo 100 × 125 (4:5), blanco, línea fina; cada pieza cabe en su
   tope sin deformarse (no en centímetros); cuatro plantillas: arriba+abajo+calzado, con capa en dos columnas, vestido y flancos para bolso y
   accesorios; solape 7 % arriba/abajo y 22 % del calzado sobre el pantalón; sin giros; el grupo se centra y, si no cabe en 84 × 109, se reduce entero */
const TOPE = { Abrigo: [40, 40], Arriba: [40, 38], pantalon: [32, 58], falda: [36, 46], corta: [36, 26], vlargo: [40, 80], vcorto: [42, 60], Calzado: [28, 15], bota: [24, 26], Bolsos: [24, 24], Accesorios: [14, 14] };
function tarjeta(ps) {
  const rol = r => ps.filter(p => r.includes(p.tipo)), nom = p => `${p.nombre || ''} ${p.x || ''}`.toLowerCase();
  const tops = rol(['Arriba']), capa = rol(['Abrigo'])[0] || (tops[1] && esCapa(tops[1]) ? tops[1] : tops[0] && esCapa(tops[0]) && tops[1] ? tops[0] : null);
  const top = tops.find(p => p !== capa), grande = rol(['Abajo', 'Vestidos'])[0], zap = rol(['Calzado'])[0], bolso = rol(['Bolsos'])[0], acc = rol(['Accesorios']).slice(0, 2);
  if (!top && !grande) return null;
  const cabe = (p, [tw, th]) => { const r = p.caja?.[4] || 1; let w = tw, h = tw * r; if (h > th) { h = th; w = th / r; } return [w, h]; };
  const tope = p => p.tipo === 'Abajo' ? (/falda|skirt/.test(nom(p)) ? (/mini|corta|short/.test(nom(p)) ? TOPE.corta : TOPE.falda) : /short|bermuda/.test(nom(p)) ? TOPE.corta : TOPE.pantalon)
    : p.tipo === 'Vestidos' ? (/corto|mini/.test(nom(p)) ? TOPE.vcorto : TOPE.vlargo) : p.tipo === 'Calzado' && /bota alta|mosquetera|over the knee/.test(nom(p)) ? TOPE.bota : TOPE[p.tipo] || [30, 30];
  const pantalon = grande?.tipo === 'Abajo' && !/falda|skirt|short|bermuda/.test(nom(grande));
  const out = []; // [p, x, y, w, h, z]
  const pon = (p, cx, y, t, z) => { const [w, h] = cabe(p, t); const e = p.caja?.[5] ?? .5; out.push([p, cx - w * e, y, w, h, z]); return out[out.length - 1]; };
  const col = (cx, y0, piezas) => { let y = y0, ant = null; for (const [p, t, z] of piezas) { if (!p) continue;
      let yy = y; if (ant && p.tipo === 'Abajo' && ant[0].tipo === 'Arriba') yy = ant[2] + ant[4] - ant[4] * .07; else if (ant && p.tipo === 'Calzado' && ant[0].tipo === 'Abajo' && pantalon) yy = ant[2] + ant[4] - cabe(p, t)[1] * .22; else if (ant && p.tipo === 'Calzado') yy = ant[2] + ant[4] + 3; else if (ant) yy = ant[2] + ant[4] + 5;
      ant = pon(p, cx, yy, t, z); y = ant[2] + ant[4]; } };
  const dentro = ps.como === 'por dentro';
  if (capa) { // plantilla 2: capa, bolso, calzado y un accesorio a la izquierda; arriba y abajo (o vestido) a la derecha
    col(28, 8, [[capa, TOPE.Abrigo, 1], [bolso, TOPE.Bolsos, 1], [zap, [Math.min(28, 30), 15], 1], [acc[0], TOPE.Accesorios, 1]]);
    col(72, 8, [[top, [36, 34], dentro ? 1 : 2], [grande, grande?.tipo === 'Vestidos' ? tope(grande) : [28, 58], dentro ? 2 : 1]]);
  } else { // plantillas 1 y 3, con los flancos de la 4
    const anchoAb = grande ? cabe(grande, tope(grande))[0] : 28;
    col(50, 8, [[top, TOPE.Arriba, dentro ? 1 : 2], [grande, tope(grande || {}), dentro ? 2 : 1], [zap, [Math.max(24, Math.min(30, anchoAb * 1.1)), 15], 3]]);
    const oT = out.find(o => o[0] === top), oG = out.find(o => o[0] === grande);
    if (bolso) { const [w, h] = cabe(bolso, TOPE.Bolsos), ref = oG || oT; out.push([bolso, ref[1] + ref[3] - 2, ref[2] + ref[4] * .12 - h / 2 + (oG ? 0 : ref[4] * .4), w, h, 3]); }
    acc.forEach((p, i) => { const [w, h] = cabe(p, TOPE.Accesorios), ref = oT || oG; out.push([p, i ? ref[1] + ref[3] + 3 : ref[1] - 3 - w, ref[2] + 4, w, h, 3]); });
  }
  // cierre: si no cabe en la zona útil (84 × 109), se reduce todo; después se centra el grupo (en x, por su centro de masa, como mucho 6 u)
  let x0 = Math.min(...out.map(o => o[1])), x1 = Math.max(...out.map(o => o[1] + o[3])), y0 = Math.min(...out.map(o => o[2])), y1 = Math.max(...out.map(o => o[2] + o[4]));
  const k = Math.min(1, 84 / (x1 - x0), 109 / (y1 - y0)), ejeX = capa ? 50 : 50;
  for (const o of out) { o[1] = ejeX + (o[1] - ejeX) * k; o[2] = y0 + (o[2] - y0) * k; o[3] *= k; o[4] *= k; }
  x0 = Math.min(...out.map(o => o[1])); x1 = Math.max(...out.map(o => o[1] + o[3])); y0 = Math.min(...out.map(o => o[2])); y1 = Math.max(...out.map(o => o[2] + o[4]));
  const masa = out.reduce((a, o) => a + (o[1] + o[3] / 2) * o[3] * o[4], 0) / out.reduce((a, o) => a + o[3] * o[4], 0);
  let dx = capa ? 50 - (x0 + x1) / 2 : Math.max(-6, Math.min(6, 50 - masa)); dx = Math.max(8 - x0, Math.min(92 - x1, dx));
  const dy = (8 + 117) / 2 - (y0 + y1) / 2;
  return { out: out.sort((a, b) => a[5] - b[5]).map(([p, x, y, w, h]) => [p, x + dx, y + dy, w, h]), W: 100, H: 125 };
}
function composicion(ps, COMP) {
  if (ps.some(p => (!p.caja || p.cajaV !== 3) && (p.foto || p.src))) setTimeout(medirTodas, 0);
  if (COMP === 'tarjeta') { const c = tarjeta(ps); if (c) return c.out.map(([p, x, y, w, h]) => pieza(p, x, y, w, h, c.W, c.H)).join('') + `<!--${c.W}x${c.H}-->`; }
  if (COMP === 'conjunto' || COMP === 'tarjeta') { const c = conjunto(ps); if (c) return c.out.map(([p, x, y, w, h]) => pieza(p, x, y, w, h, c.W, c.H)).join('') + `<!--${c.W}x${c.H}-->`; }
  if (COMP === 'capas' || COMP === 'abierto') { const c = capas(ps, COMP === 'abierto'); if (c) return c.out.map(([p, x, y, w, h]) => pieza(p, x, y, w, h, c.W, c.H)).join('') + `<!--${c.W}x${c.H}-->`; }
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
function maniqui(ps, mini, modo) { // nombre heredado: devuelve la composición (simétrica salvo que se pida otra)
  const html = composicion(ps, modo || COMP); const r = html.match(/<!--([\d.]+)x([\d.]+)-->/);
  return `<div class="lienzo${mini ? ' mini' : ''}${(modo || COMP) === 'tarjeta' ? ' tarjeta' : ''}" style="aspect-ratio:${(modo || COMP) === 'tarjeta' ? '4/5' : r ? r[1] + '/' + r[2] : '1/1'}">${html}</div>`;
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
  let cache = null; try { cache = JSON.parse(localStorage.getItem('tc_tiempo') || 'null'); } catch (e) { } // 06/11: la pantalla «Diseño» guardaba ahí su eje «tiempo» ("emoji"…) y rompía el tiempo
  if (!forzar && cache && cache.v && cache.k === 40 && 'lluviaH' in cache.v && Date.now() - cache.ts < 30 * 60000) { E.tiempo = cache.v; return E.tiempo; }
  try {
    let lat = E.perfil?.lat, lon = E.perfil?.lon, nombre = E.perfil?.ciudad || E.perfil?.lugar || '';
    // 0.38 (Sheila, 22/10: «me sale Madrid y yo estoy en Huelva»): sin ciudad ni ubicación ya no se da Madrid por hecho;
    // se pide la ubicación del móvil (una vez) y, si no la da, la aproximada por la conexión
    if (!lat && !E.perfil?.ciudad) { const g = await ubicacionMovil(); if (g) { lat = g.lat; lon = g.lon; E.perfil = Object.assign(E.perfil || {}, g); await guardar(); } }
    if (!lat && !E.perfil?.ciudad) { try { const ip = await (await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=' + idioma())).json(); if (ip.latitude) { lat = ip.latitude; lon = ip.longitude; nombre = ip.city || ip.locality || ''; } } catch (e) { } }
    if (lat && !nombre) nombre = await nombreLugar(lat, lon);
    if (!lat && E.perfil?.ciudad) { const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(E.perfil.ciudad)}&count=1&language=es`)).json(); if (g.results?.length) { lat = g.results[0].latitude; lon = g.results[0].longitude; nombre = g.results[0].name; } }
    if (!lat) { lat = 40.4168; lon = -3.7038; nombre = E.perfil?.ciudad || 'Madrid'; } // último recurso: sin red de ubicación ni ciudad encontrada
    const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,apparent_temperature,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&hourly=precipitation_probability&timezone=auto&forecast_days=1`)).json();
    const cod = r.current.weather_code; const txt = cod === 0 ? ['despejado', 'clear'] : cod <= 2 ? ['nubes y claros', 'partly cloudy'] : cod === 3 ? ['nublado', 'cloudy'] : cod < 50 ? ['niebla', 'fog'] : cod < 70 ? ['lluvia', 'rain'] : cod < 80 ? ['nieve', 'snow'] : cod < 90 ? ['chubascos', 'showers'] : ['tormenta', 'storm'];
    const ahora = new Date().getHours(); const probs = r.hourly?.precipitation_probability || []; let lluviaH = null; for (let h = ahora; h < Math.min(24, probs.length); h++) if (probs[h] >= 50) { lluviaH = h; break; }
    E.tiempo = { sens: r.current.apparent_temperature, viento: r.current.wind_speed_10m, hum: r.current.relative_humidity_2m, uv: r.daily.uv_index_max?.[0], t: Math.round(r.current.temperature_2m), max: Math.round(r.daily.temperature_2m_max[0]), min: Math.round(r.daily.temperature_2m_min[0]), lluvia: r.daily.precipitation_probability_max?.[0] ?? 0, txt, nombre, cod, clave: claveTiempo(cod), lluviaH, lat, lon };
    localStorage.setItem('tc_tiempo', JSON.stringify({ ts: Date.now(), k: 40, v: E.tiempo }));
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
const NEUTROS = new Set(['Negro', 'Blanco', 'Gris', 'Beige', 'Crema', 'Camel', 'Marrón', 'Caqui', 'Azul claro', 'Azul', 'Antracita', 'Gris claro', 'Nude', 'Chocolate', 'Azul marino', 'Verde oliva', 'Dorado', 'Plateado']);
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
// 0.62 (Sheila, 23/10: «eso me gusta… que avise que no tienes una prenda para determinadas cosas… puedes incluir sugerencias»):
// qué le falta al clóset para cada ocasión; se sugiere el tipo de prenda, nunca una tienda ni una compra concreta
const NECESIDADES = {
  Noche: [[p => p.tipo === 'Calzado' && estilo(p) === 3, 'unos tacones o unas sandalias de tacón', 'heels or heeled sandals'],
    [p => !['Calzado', 'Bolsos', 'Accesorios'].includes(p.tipo) && estilo(p) === 3, 'una prenda de noche: un vestido negro, algo de satén o de lentejuelas', 'an evening piece: a black dress, something satin or sequinned'],
    [p => p.tipo === 'Bolsos' && /cartera|clutch|de mano|pequeñ/i.test(p.nombre || ''), 'un bolso pequeño o de mano', 'a small bag or clutch']],
  Evento: [[p => p.tipo === 'Vestidos' || /falda|vestir/i.test(p.nombre || ''), 'un vestido o una falda midi', 'a dress or a midi skirt'],
    [p => p.tipo === 'Calzado' && (estilo(p) === 3 || /mocas|bailarin|zapatos/i.test(p.nombre || '')), 'unos tacones o unos zapatos de vestir', 'heels or dress shoes'],
    [p => p.tipo === 'Bolsos' && !/mochila|backpack/i.test(p.nombre || ''), 'un bolso que no sea mochila', 'a bag that is not a backpack']],
  Oficina: [[p => p.tipo === 'Arriba' && /camisa|blusa|shirt|blouse/i.test(p.nombre || ''), 'una camisa o una blusa', 'a shirt or blouse'],
    [p => p.tipo === 'Abajo' && !/vaquero|jean|short|malla|legging|cargo/i.test(p.nombre || ''), 'un pantalón recto o una falda midi', 'straight trousers or a midi skirt'],
    [p => /americana|blazer|gabardina|trench/i.test(p.nombre || ''), 'una americana', 'a blazer'],
    [p => p.tipo === 'Calzado' && estilo(p) >= 1, 'unos zapatos, mocasines o botines', 'shoes, loafers or ankle boots']],
  Deporte: [[p => p.tipo === 'Calzado' && estilo(p) === 0, 'unas zapatillas', 'trainers'],
    [p => !['Calzado', 'Bolsos', 'Accesorios'].includes(p.tipo) && estilo(p) === 0, 'mallas, una sudadera o ropa deportiva', 'leggings, a hoodie or sportswear']]
};
// 03/11 (Gabriela: «hay cosas que cambian si eres masculino»): con ropa de hombre, otras palabras; null = no se sugiere
const NEC_HOMBRE = { Noche: [['unos zapatos de vestir o unos botines', 'dress shoes or boots'], ['una prenda de noche: una camisa negra o una americana oscura', 'an evening piece: a black shirt or a dark blazer'], null],
  Evento: [['un pantalón de vestir o un traje', 'dress trousers or a suit'], ['unos zapatos de vestir', 'dress shoes'], null],
  Oficina: [['una camisa', 'a shirt'], ['un pantalón recto o un chino', 'straight trousers or chinos']],
  Deporte: [null, ['un pantalón de chándal, una sudadera o ropa deportiva', 'joggers, a hoodie or sportswear']] };
function faltaPara(oc) {
  const act = activas(), h = E.perfil?.ropa === 'hombre' && NEC_HOMBRE[oc];
  return (NECESIDADES[oc] || []).map((n, i) => !h || h[i] === undefined ? n : h[i] && [n[0], h[i][0], h[i][1]]).filter(n => n && !act.some(n[0])).map(n => t(n[1], n[2]));
}
// 0.68 (Sheila, 23/10: «creo que el texto es largo y agobiante»): una línea corta; lo que falta, plegado
const avisoFalta = (oc, hay) => { const f = faltaPara(oc); if (!f.length && hay) return ''; const o = ocNombre(oc).toLowerCase();
  return `<div class="cal-falta">${hay ? '' : `<p>${t(`Sin ropa de ${o}: te enseño lo más parecido.`, `Nothing for ${o}: here is the closest.`)}</p>`}${f.length ? `<details><summary>${t('Qué te vendría bien', 'What would help')}</summary><p>${cap(lista(f))}.</p></details>` : ''}</div>`; };
// 0.68 (Sheila, 23/10: «cuando pongo deporte me dice que no hay nada… puedes al menos poner las zapatillas»): sin ropa de esa ocasión,
// lo más parecido: lo más arreglado para noche, evento y oficina; lo más cómodo para el resto; y para deporte, con zapatillas y sin bolso
// 0.71 (Sheila, 23/10: «cómo voy a hacer deporte con una saya si hay pantalones… y una chaqueta es súper incómoda»): para deporte
// sin ropa deportiva, el look se monta aparte: lo más cómodo de arriba (nada de camisas ni blusas), siempre pantalón (mallas, shorts,
// jogger antes que vaquero; nunca falda ni vestido), zapatillas, sin bolso y sin abrigo salvo sudadera o chaqueta deportiva
function lookDeporte() {
  const act = activas(), nom = p => (p.nombre || '').toLowerCase() + ' ' + (p.x || '');
  const comodo = p => /legging|malla|short|jogger|ch[aá]ndal|deport|sudadera|hoodie|camiseta|t-shirt|top|tirantes|tank/.test(nom(p)) ? 0 : /vaquero|jean|cuero|piel|leather/.test(nom(p)) ? 2 : 1;
  const arriba = act.filter(p => p.tipo === 'Arriba' && estilo(p) <= 1 && !/camisa|blusa|shirt|blouse|body|cuero|piel|leather|encaje|lace/.test(nom(p)) || p.tipo === 'Arriba' && estilo(p) === 0);
  const abajo = act.filter(p => p.tipo === 'Abajo' && !/falda|saya|skirt/.test(nom(p)) && estilo(p) <= 1);
  const zapas = act.filter(p => p.tipo === 'Calzado' && estilo(p) === 0).sort((a, b) => (a.usos || []).length - (b.usos || []).length);
  const zap = zapas[0] || act.filter(p => p.tipo === 'Calzado' && estilo(p) <= 1 && !/bot[ií]n|bota|boot|tac/.test(nom(p)))[0];
  const capa = act.find(p => p.tipo === 'Abrigo' && estilo(p) === 0);
  const out = [];
  for (const a of arriba) for (const b of abajo) {
    if (CHOCAN.has(par(a.color, b.color))) continue;
    const ps = [a, b, ...(zap ? [zap] : []), ...(capa && (E.tiempo?.t ?? 20) < 15 ? [capa] : [])];
    out.push({ tipo: 'propuesta', ids: ps.map(p => p.id), ocasion: 'Deporte', _c: comodo(a) + comodo(b) });
  }
  return out.sort((x, y) => x._c - y._c).slice(0, 6);
}
function masCercanos(oc, lista) {
  if (oc === 'Deporte') { const d = lookDeporte(); if (d.length) return d; }
  const sube = ['Noche', 'Evento', 'Oficina'].includes(oc) ? 1 : -1, act = activas();
  const zapas = act.filter(p => p.tipo === 'Calzado' && estilo(p) === 0).sort((a, b) => (a.usos || []).length - (b.usos || []).length);
  const vistos = new Set(), out = [];
  for (const l of lista) {
    let ids = l.ids;
    if (oc === 'Deporte') { const ps = ids.map(P).filter(Boolean).filter(p => p.tipo !== 'Bolsos' && !(p.tipo === 'Calzado' && zapas.length)); if (zapas.length) ps.push(zapas[0]); ids = ps.map(p => p.id); }
    const k = [...ids].sort().join(); if (vistos.has(k)) continue; vistos.add(k);
    out.push(ids === l.ids ? l : { tipo: 'propuesta', ids, ocasion: ocasionDe(ids.map(P).filter(Boolean)) });
  }
  const nv = l => { const ps = l.ids.map(P).filter(Boolean), z = ps.find(p => p.tipo === 'Calzado'); return nivelRopa(ps) + (z ? estilo(z) : 1) * .5; };
  return out.sort((x, y) => sube * (nv(y) - nv(x)));
}
const lista = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + t(' y ', ' and ') + a[a.length - 1];
function sirvePara(ps, oc, plan) {
  if (oc === plan) return true;
  const zap = ps.find(p => p.tipo === 'Calzado');
  if (plan === 'Noche') return !!zap && estilo(zap) === 3 && nivelRopa(ps) >= 1.5;
  if (plan === 'Evento') return oc === 'Oficina' && !!zap && estilo(zap) === 3;
  // 0.66 (Sheila, 23/10, captura de Hoy con plan Viaje: «aún no tienes nada de viaje»): para viajar vale lo de diario sin tacones; no hace falta ropa «de viaje»
  if (plan === 'Viaje') return oc === 'Diario' && (!zap || estilo(zap) < 3);
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
const claveLook = ids => [...ids].sort().join();
const esFav = ids => !!E.perfil?.gustos?.fav?.includes(claveLook(ids));
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
  const tc = planDemo() === 'pro' && !E.perfil?.diag?.cuerpo?.puntos && E.perfil?.tipoCuerpo, fz = p => p && (!NEUTROS.has(p.color) || p.color === 'Estampado');
  const vest = ps.some(p => p.tipo === 'Vestidos'), falda = ab && /falda|skirt/i.test(ab.nombre);
  if (tc === 'triangulo') s += (fz(ar) ? .8 : 0) - (fz(ab) ? .6 : 0) + (falda ? .3 : 0);
  if (tc === 'invertido') s += (fz(ab) ? .8 : 0) - (fz(ar) ? .6 : 0) + (falda ? .4 : 0);
  if (tc === 'reloj') s += (vest ? .7 : 0) + (falda ? .3 : 0);
  if (tc === 'rectangulo') s += (ps.some(p => p.tipo === 'Abrigo') ? .4 : 0) + (falda ? .3 : 0) + (vest ? .3 : 0);
  if (tc === 'ovalo') s += (ar && ab && ar.color === ab.color ? .8 : 0) + (vest ? .4 : 0) - (fz(ab) ? .4 : 0);
  s += puntosEstilo(ps, fuertes, estamp) + puntosDiag(ps);
  s += puntosColores(ps);
  s += puntosGusto(ps);
  // que salga lo que menos te pones
  if (SIN_HISTORIAL) return s + .5; // para contar lo que da el clóset, sin premiar ni castigar lo que te has puesto
  const usos = ps.reduce((a, p) => a + (p.usos || []).length, 0) / ps.length; s += Math.max(0, 2 - usos / 4);
  // 0.69 (Sheila, 23/10: «a mí como usuaria me interesa no repetir prendas»; regla 1 de Moda, aprobada por Gabriela): lo que te pusiste
  // en los últimos 6 días (sin contar hoy) baja mucho; zapatos, bolso, abrigo y accesorios se pueden repetir
  const hoy = hoyISO(), dias = d => (new Date(hoy) - new Date(d)) / 864e5;
  // 0.70 (Sheila: «añade un botón de favorito por si le gustó mucho un look, lo puedo repetir el día que quiera y no se vaya tan abajo como el resto»)
  const fav = esFav(ps.map(p => p.id)); if (fav) s += 1;
  for (const p of ps) if (!['Calzado', 'Bolsos', 'Accesorios', 'Abrigo'].includes(p.tipo) && (p.usos || []).some(d => dias(d) > 0 && dias(d) <= 6)) s -= fav ? .5 : 2.5;
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
function mejorAcompanante(lista, base, extra) { // calzado o bolso que mejor puntúa con la base
  let mejor = null, mp = -Infinity;
  for (const x of lista) { const v = puntuar([...base, x]) + (extra ? extra(x) : 0) - Math.random() * .6; if (v > mp) { mp = v; mejor = x; } }
  return mejor;
}
const sinMangas = p => (p.tipo === 'Arriba' || p.tipo === 'Vestidos') && /^top\b|chaleco|tirantes|body|sin mangas|halter|crop|tank|vest\b|bodysuit/i.test(p.nombre || '');
// 0.101 (Gabriela, 27/10: «sí, arregla las dos»): la estación sale del tipo de prenda (tirantes y manga corta, verano; jerseys y botas, fuera del verano;
// plumíferos, invierno); se pone una vez por prenda y lo que ella cambie en la ficha («Editar») ya no se toca
function estacionPorPrenda(p) {
  const n = (p.nombre || '').toLowerCase(), x = (p.x || '').toLowerCase();
  if (/chaleco|americana|blazer|camisa\b/.test(n)) return 'Todo el año';
  if (p.tipo === 'Abrigo') return /plum[ií]fero|parka|anorak|borreg/.test(n) ? 'Invierno' : 'Entretiempo';
  // 06/11 (Gabriela: «un vestido corto no puede ser para todo el año si no tengo medias térmicas»): vestidos y faldas cortas, verano; con manga larga, entretiempo
  if ((p.tipo === 'Vestidos' || /falda/.test(n)) && (/\bcort[oa]|\bmini\b/.test(n) || /mini/.test(x))) return /manga larga/.test(n) ? 'Entretiempo' : 'Verano';
  if (sinMangas(p) || /manga corta|\bshorts?\b|bermuda|sandalia|chancla|bikini|ba[nñ]ador/.test(n) || /tank|camisole|shorts|sandal/.test(x)) return 'Verano';
  if (/jersey|su[eé]ter|sudadera|cuello alto|forro polar|\bbota/.test(n) || /sweater|hoodie|sweatshirt|boot/.test(x)) return 'Entretiempo';
  return 'Todo el año';
}
function estacionesAuto() { let n = 0; for (const p of E.prendas) if (!p.estAuto && !p.ejemplo) { if (p.estacion === 'Todo el año' || !p.estacion) { const e = estacionPorPrenda(p); if (e !== p.estacion) n++; p.estacion = e; } p.estAuto = 1; } return n; }
const esCapa = p => p.tipo === 'Arriba' && /chaqueta|c[aá]rdigan|americana|blazer|cazadora|jacket|cardigan/i.test(p.nombre || '');
/* ---------- estilista (0.103, Gabriela, 27/10: «necesito que quien confeccione los outfit sea un experto en moda… combinaciones con sentido,
   y sea siempre zapatos, pantalón y algo para arriba»). Reglas de la Dirección de Moda (equipo/moda/estilista/reglas-estilista.md): cada prenda lleva
   su ficha de estilista (p.est: tiro, largo, ajuste, corte, estampado, formalidad, grosor, temperaturas); si no la tiene, se deduce del nombre.
   Aquí van los vetos duros (G1 dos estampados, B1/G2 dos volúmenes, G12 tiro bajo con top corto, E1–E3 temperatura, G11 formalidad, A5 chaleco solo)
   y los puntos de proporción (B2–B11); el zapato sugerido (F10) cuando no hay calzado subido. ---------- */
const VOL_ARR = { 'ceñido': 0, regular: 1, holgado: 2, oversize: 3 }, VOL_AB = { pitillo: 0, recto: 1, acampanado: 1, ancho: 2, barril: 3, palazzo: 2 };
function estDe(p) {
  if (p.est && p.est.form != null) return p.est; // ficha completa de la estilista; si solo hay lo que contestó ella (el tiro), se completa abajo
  const n = (p.nombre || '').toLowerCase(), x = (p.x || '').toLowerCase(), sm = sinMangas(p);
  const e = { estampado: p.color === 'Estampado' || /raya|cuadro|flor|estampad|diplom|lunar/.test(n) ? 'estampado' : 'liso', grosor: /grueso|cuello alto/.test(n) && /jersey/.test(n) ? 'grueso' : sm ? 'fino' : 'medio' };
  if (p.tipo === 'Abajo') {
    e.corte = /barril|barrel/.test(n) ? 'barril' : /palazzo/.test(n) ? 'palazzo' : /acampanad|campana|flare/.test(n + x) ? 'acampanado' : /ancho|wide|pinzas/.test(n + x) ? 'ancho' : /pitillo|skinny|ceñid/.test(n + x) ? 'pitillo' : 'recto';
    e.tiro = /tiro bajo/.test(n) ? 'bajo' : /tiro alto|pinzas|paperbag/.test(n) ? 'alto' : 'medio';
    e.form = /pinzas|vestir|traje|sastre/.test(n) ? 4 : /vaquer|jean|chándal|chandal|jogger/.test(n + x) ? 2 : 3;
    e.tmin = /corto|short|bermuda/.test(n) ? 20 : 6; e.tmax = /lana|pana/.test(n) ? 20 : 30;
  } else {
    e.largo = /corto|crop|top\b/.test(n) && !/manga corta/.test(n) ? 'crop' : /largo|túnica|tunica/.test(n) ? 'largo' : /jersey|sudadera|henley|camisa/.test(n) ? 'cadera' : 'cintura';
    e.ajuste = /oversize|ancho|amplio/.test(n) ? 'oversize' : /holgad|grueso/.test(n) ? 'holgado' : /ceñid|ajustad|canal|tirantes|body|sin mangas/.test(n) ? 'ceñido' : 'regular';
    e.form = /chaleco de traje|americana|blazer|blusa|camisa/.test(n) ? 4 : /camiseta|sudadera|tirantes/.test(n) ? 2 : 3;
    e.rol = /chaleco de traje|americana|blazer|c[aá]rdigan/.test(n) ? 'capa_ligera' : 'base';
    e.tmin = sm ? 20 : /manga corta/.test(n) ? 18 : e.grosor === 'grueso' ? 6 : 10; e.tmax = e.grosor === 'grueso' ? 16 : /jersey|sudadera/.test(n) ? 20 : sm ? 34 : 26;
  }
  return p.est ? Object.assign(e, p.est) : e;
}
// devuelve null si el look vale, o el motivo del veto; y los puntos de proporción en .puntos
function estilista(ps, T) {
  const arr = ps.filter(p => p.tipo === 'Arriba'), ab = ps.find(p => p.tipo === 'Abajo'), base = arr.find(p => estDe(p).rol !== 'capa_ligera'), capa = ps.some(p => p.tipo === 'Abrigo' || (p.tipo === 'Arriba' && estDe(p).rol === 'capa_ligera' && !/chaleco/i.test(p.nombre)));
  const r = { veto: null, puntos: 0 }, ropa = ps.filter(p => !['Calzado', 'Bolsos', 'Accesorios'].includes(p.tipo));
  if (arr.length && !base) return (r.veto = 'Necesita algo debajo', r);                                              // A5 / G3
  const estp = ropa.filter(p => estDe(p).estampado !== 'liso'); // 0.117 (Gabriela, 28/10: «1. a»): un conjunto del mismo tejido cuenta como uno
  if (estp.length > 1 && !(estp.length === 2 && estDe(estp[0]).conjunto === estp[1].id)) return (r.veto = 'Dos estampados juntos', r);       // G1
  const forms = ropa.map(p => estDe(p).form || 3); if (Math.max(...forms) - Math.min(...forms) >= 3) return (r.veto = 'No son del mismo plan', r); // G11
  if (T != null) for (const p of ropa) {                                                                              // E1–E3
    const e = estDe(p), tmin = (e.tmin ?? -50) - (capa ? 6 : 0), tmax = e.tmax ?? 50;
    if (T < tmin - 2 || T > tmax + 2) return (r.veto = T < tmin ? 'Hace fresco para esa prenda' : 'Con este calor abriga de más', r);
    if (T < tmin || T > tmax) r.puntos -= 1;
    if (e.grosor === 'grueso' && T >= 18) return (r.veto = 'Con este calor abriga de más', r);
  }
  if (base && ab) {
    const t = estDe(base), b = estDe(ab), vt = VOL_ARR[t.ajuste] ?? 1, vb = VOL_AB[b.corte] ?? 1;
    if (vt >= 2 && vb >= 2) return (r.veto = 'Dos volúmenes', r);                                                    // B1 / G2
    if ((vt >= 2 && vb <= 1) || (vt <= 1 && vb >= 2)) r.puntos += vt === 3 ? .8 : .6;                                 // B2
    const tiro = b.tiro || 'medio', largo = t.largo || 'cintura', body = /body/i.test(base.nombre);
    if (largo === 'crop' && !body && (tiro === 'bajo' && cinturaPref() !== '1' || tiro === 'medio' && cinturaPref() === '0')) return (r.veto = 'Deja la cintura al aire', r); // G12 (blando: lo quita «me gusta enseñar la cintura»)
    r.puntos += ({ alto: { crop: 1, cintura: .8, cadera: vt <= 1 ? .4 : 0, largo: -1 }, medio: { crop: .4, cintura: .6, cadera: .4, largo: -.6 }, bajo: { crop: 0, cintura: -1.5, cadera: .8, largo: .8 } }[tiro] || {})[largo] || 0; // B3–B10
    if (b.corte === 'acampanado' && vt <= 1) r.puntos += .4;                                                          // B11
  }
  return r;
}
// F10: zapato sugerido (solo tipo y color, sin tiendas) mientras no haya calzado subido
function zapatoIdeal(ps, T) {
  const ab = ps.find(p => p.tipo === 'Abajo'), b = ab ? estDe(ab) : {}, f = Math.max(...ps.map(p => estDe(p).form || 2));
  const oscuro = ps.some(p => /Negro|Gris|Azul/.test(p.color || '')) || f >= 3, vaquero = /vaquer|jean/i.test(ab?.nombre || '');
  let k = b.corte === 'acampanado' ? (taconBajo() ? 'botines' : 'botines_tacon') : T != null && T <= 14 ? 'botines' : f >= 3 ? 'mocasines' : 'zapatillas';
  if (T != null && T >= 26 && k === 'botines') k = 'mocasines';
  const col = k === 'zapatillas' ? (vaquero && f <= 2 ? ['blancas', 'white'] : oscuro ? ['negras', 'black'] : ['blancas', 'white']) : oscuro ? ['negros', 'black'] : ['marrones', 'brown'];
  return { k, col };
}
// 0.106 (Gabriela, 28/10: «me ponen con letra los zapatos que debo llevar en lugar de los que ya tengo»): con zapatos subidos, el estilista
// elige entre los suyos el que más se parece al ideal (familia, tacón y color) y nunca sandalias con frío ni botas con calor
function afinZapato(z, ps, T) {
  const { k, col } = zapatoIdeal(ps, T), n = `${z.nombre || ''} ${z.x || ''}`.toLowerCase();
  const fam = /bot[ií]n|bota|boot/.test(n) ? 'botines' : /mocas|loafer|oxford|bailarin|ballet|derby|sal[oó]n|stiletto|pump/.test(n) ? 'mocasines' : /zapatilla|deportiv|sneaker|trainer|tenis/.test(n) ? 'zapatillas' : /sandal|chancl|flip|mule|zueco/.test(n) ? 'sandalias' : '';
  let s = 0;
  if (fam && fam === k.replace('_tacon', '')) s += 1.2;
  if (k === 'botines_tacon' && /tac[oó]n|heel/.test(n)) s += .6;
  if (k === 'botines_tacon' && /sal[oó]n|stiletto|pump|tac[oó]n/.test(n) && fam !== 'zapatillas') s += .8; // con acampanado vale cualquier zapato de tacón
  if ({ negros: /Negro/, negras: /Negro/, blancas: /Blanco|Crudo|Beige/, marrones: /Marr[oó]n|Camel|Beige/ }[col[0]]?.test(z.color || '')) s += .4;
  if (T != null && fam === 'sandalias' && T < 20) s -= 3;
  if (T != null && fam === 'botines' && T >= 26) s -= 2;
  if (taconBajo() && /stiletto|tac[oó]n alto|high heel/.test(n)) s -= 2;
  return s;
}
function zapatoSugerido(ps, T) {
  const en = idioma() === 'en', { k, col } = zapatoIdeal(ps, T);
  const nom = { botines_tacon: ['botines de tacón', 'heeled ankle boots'], botines: ['botines de tacón bajo', 'low-heeled ankle boots'], mocasines: ['mocasines', 'loafers'], zapatillas: ['zapatillas', 'trainers'] }[k];
  return en ? `${col[1]} ${nom[1]}` : `${nom[0]} ${col[0]}`.replace('botines de tacón bajo negros', 'botines negros de tacón bajo').replace('botines de tacón negros', 'botines negros de tacón');
}
// 0.111 · zapatos de muestra (Gabriela, 28/10: «siguen sin poner zapatos y los pones con letras»): mientras no haya calzado subido, el
// conjunto lleva al pie una foto de muestra del zapato que elige la estilista (tipo, tacón y color), como en una revista; no es suya y se dice
// una vez debajo («Zapatos de muestra»). Fotos de producto generadas para TuCloset, sin marcas. [nombre, color, alto/ancho]
const ZAP_MUESTRA = {
  'zapatillas-blancas': ['Zapatillas blancas', '#F4F4F4', 0.445], 'zapatillas-negras': ['Zapatillas negras', '#1B1B1B', .452],
  'botines-negros-tacon': ['Botines negros de tacón', '#1B1B1B', 0.809], 'botines-negros-planos': ['Botines negros planos', '#1B1B1B', 0.606],
  'botines-negros-plataforma': ['Botines negros de plataforma', '#1B1B1B', 0.855], 'botines-camel-plataforma': ['Botines camel de plataforma', '#B98A4F', 0.734],
  'mocasines-negros': ['Mocasines negros', '#1B1B1B', 0.422], 'bailarinas-negras': ['Bailarinas negras', '#1B1B1B', 0.339],
  'sandalias-negras-tacon': ['Sandalias negras de tacón', '#1B1B1B', 0.633], 'sandalias-negras-planas': ['Sandalias negras planas', '#1B1B1B', 0.389],
  'sandalias-beige-plataforma': ['Sandalias beige de plataforma', '#D8C7A8', 0.469], 'sandalias-marrones-planas': ['Sandalias marrones planas', '#6B4A2B', 0.383],
};
function claveMuestra(ps, spec) {
  if (spec?.muestra) return spec.muestra; // el motor de looks ya sabe cuál
  if (spec?.tipo) {
    const c = (spec.color || '').toLowerCase(), tx = (spec.texto || '').toLowerCase(), ta = spec.tacon;
    if (spec.tipo === 'zapatillas') return /blanc/.test(c) ? 'zapatillas-blancas' : 'zapatillas-negras';
    if (spec.tipo === 'botines') return /camel|marr/.test(c) ? 'botines-camel-plataforma' : /plataforma/.test(tx) ? 'botines-negros-plataforma' : ta === 'plano' || ta === 'bajo' || taconBajo() ? 'botines-negros-planos' : 'botines-negros-tacon';
    if (spec.tipo === 'mocasines') return 'mocasines-negros';
    if (spec.tipo === 'bailarinas') return 'bailarinas-negras';
    if (spec.tipo === 'sandalias') return /beige/.test(c) ? 'sandalias-beige-plataforma' : /marr/.test(c) ? 'sandalias-marrones-planas' : ['medio', 'alto'].includes(ta) && !/plataforma/.test(tx) ? 'sandalias-negras-tacon' : 'sandalias-negras-planas';
  }
  const { k, col } = zapatoIdeal(ps, E.tiempo?.t);
  if (k === 'zapatillas') return col[0] === 'blancas' ? 'zapatillas-blancas' : 'zapatillas-negras';
  if (k === 'mocasines') return 'mocasines-negros';
  if (col[0] === 'marrones') return 'botines-camel-plataforma';
  return k === 'botines_tacon' ? 'botines-negros-tacon' : 'botines-negros-planos';
}
// 08/11: un look de deporte sin calzado lleva zapatillas (suyas de deporte o de muestra), nunca unos tacones
const specLook = c => c.zspec || (c.ocasion === 'Deporte' ? { tipo: 'zapatillas', deporte: 1 } : null);
function conZapato(ps, spec, como) {
  let r = ps;
  if (ps.length && !ps.some(p => p.tipo === 'Calzado') && ps.some(p => ['Abajo', 'Vestidos'].includes(p.tipo))) {
    // 0.112 (Gabriela, 28/10: «no sé de dónde sacas esos zapatos, míos no son»): si tiene zapatos subidos, siempre uno suyo; los de muestra, solo sin ninguno
    const suyo = zapatoPara(spec || {}, ps), k = suyo ? null : claveMuestra(ps, spec), z = k && ZAP_MUESTRA[k];
    if (suyo) r = [...ps, suyo];
    else if (z) { const id = 'zm-' + k, src = `zapatos/${k}.webp`; if (!alfa.has(id)) alfa.set(id, src); r = [...ps, { id, tipo: 'Calzado', nombre: z[0], src, caja: [0, 0, 1, 1, z[2], .5], cajaV: 3, est: { pal: [z[1]] }, muestra: k }]; }
  }
  if (como) { r = r === ps ? [...ps] : r; r.como = como; }
  return r;
}
// 0.111 (Gabriela, 28/10: «no tienes que describir las prendas, es crear un outfit y quizás poner la paleta de colores o el estilo que
// representa»): debajo del conjunto, su paleta (los colores de cada prenda, sin repetir) y el estilo al que pertenece
const hexA = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const distHex = (a, b) => { const x = hexA(a), y = hexA(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
function paletaLook(ps) {
  const out = [];
  for (const p of ps) { const c = p.est?.pal || [COLORES.find(x => x[0] === p.color)?.[1]]; for (const h of c) if (h && h[0] === '#' && !out.some(o => distHex(o, h) < 34)) out.push(h); }
  return out.slice(0, 5);
}
function estiloLook(ps) {
  const ropa = ps.filter(p => !['Calzado', 'Bolsos', 'Accesorios'].includes(p.tipo)), s = {}, suma = (k, v) => s[k] = (s[k] || 0) + v;
  ropa.forEach(p => (p.est?.estilos || []).forEach((k, j) => suma(k, j ? .7 : 1)));
  const zn = ps.filter(p => p.tipo === 'Calzado').map(p => `${p.nombre || ''} ${p.muestra || ''}`).join(' ').toLowerCase();
  if (Object.keys(s).length) { if (/zapatilla/.test(zn)) suma('casual', .6); if (/tac[oó]n/.test(zn)) suma('glam', .3); if (/mocas|bailarin/.test(zn)) suma('frances', .4); }
  let k = Object.entries(s).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!k) { // sin la ficha de la estilista: por formalidad, color y tejido
    const nom = ropa.map(p => (p.nombre || '').toLowerCase()).join(' '), f = Math.max(0, ...ropa.map(p => estDe(p).form || 2));
    k = ropa.some(p => p.tipo === 'Vestidos') && ropa.some(p => SUAVES.has(p.color)) ? 'romantico' : f >= 3 ? 'clasico' : /raya|stripe/.test(nom) ? 'frances' : /vaquer|jean/.test(nom) ? 'casual' : ropa.every(p => NEUTROS.has(p.color)) ? 'minimalista' : 'casual';
  }
  return ESTILOS.find(x => x.k === k) || null;
}
function pieLook(ps) {
  const pal = paletaLook(ps), est = estiloLook(ps); if (!pal.length && !est) return '';
  return `<span class="lk-pal">${pal.length ? `<span class="tela">${pal.map(c => `<i style="background:${c}"></i>`).join('')}</span>` : ''}${est ? `<b>${est.n[idioma() === 'en' ? 1 : 0]}</b>` : ''}</span>`;
}
// 0.109 · Looks de la estilista (Gabriela, 28/10: «quiero a un agente experto experto experto en moda, que sea quien arme y diseñe los outfits»;
// «que haya ciencia detrás de cada outfit»). Los diseña la Dirección de Moda para cada clóset (perfil.estilista.looks: arriba, capa, abajo, zapato,
// temperatura, ocasión y el porqué) y salen primero; el generador automático solo rellena lo que falte
function zapatoPara(spec, ps) {
  if (!spec) return null; let mejor = null, mp = -Infinity; // 0.112: con zapatos subidos siempre devuelve uno suyo, aunque ninguno sea del tipo pedido
  // 08/11: en un look de deporte sin calzado, solo zapatillas de deporte suyas; si no tiene, las de muestra (antes salían unos tacones)
  const zs = activas().filter(p => p.tipo === 'Calzado' && (!spec.deporte || (typeof Motor !== 'undefined' && Motor.aptoDeporte({ p, _f: Motor.ficha(p) }))));
  for (const z of zs) {
    const n = `${z.nombre || ''} ${z.x || ''}`.toLowerCase(), tipo = (spec.tipo || '').toLowerCase().replace(/s$/, '').replace(/e$/, '');
    let s = (tipo && n.includes(tipo.slice(0, 5)) ? 1.2 : 0) + (spec.color && (z.color || '').toLowerCase().startsWith(spec.color.slice(0, 4)) ? .5 : 0) + afinZapato(z, ps, E.tiempo?.t) * .3;
    if (s > mp) { mp = s; mejor = z; }
  }
  return mejor;
}
function looksEstilista(n, plan) {
  const L = E.perfil?.estilista?.looks || [], T = E.tiempo?.t, act = new Set(activas().map(p => p.id)), usados = new Map(), out = [];
  const cands = L.filter(l => !l.duda && !(l.ensena && cinturaPref() !== '1') && [l.arriba, l.capa, l.abajo].filter(Boolean).every(id => act.has(id)) && (T == null || (T >= l.tmin - 1 && T <= l.tmax + 1)))
    .map(l => { const ps = [l.arriba, l.capa, l.abajo].filter(Boolean).map(P); const z = zapatoPara(l.zapato, ps); if (z) ps.push(z); return { l, ps, nota: puntuar(ps) - Math.random() * .8 }; })
    .filter(c => !plan || plan === 'Todos' || c.l.ocasion === plan || sirvePara(c.ps, c.l.ocasion, plan)).sort((a, b) => b.nota - a.nota);
  for (const tope of [1, 2]) for (const c of cands) {
    if (out.length >= n) break; if (out.some(o => o.idE === c.l.id) || (usados.get(c.l.arriba) || 0) >= tope) continue;
    usados.set(c.l.arriba, (usados.get(c.l.arriba) || 0) + 1);
    out.push({ prin: c.l.arriba, ids: c.ps.map(p => p.id), ocasion: c.l.ocasion, nombre: `${ocNombre(c.l.ocasion)} ${t('con', 'with')} ${P(c.l.arriba).nombre.charAt(0).toLowerCase() + P(c.l.arriba).nombre.slice(1)}`, zapato: c.ps.some(p => p.tipo === 'Calzado') ? null : c.l.zapato?.texto, zspec: c.l.zapato, como: c.l.como, porque: c.l.porque, estilista: true, idE: c.l.id }); // 0.111: ensena = top corto con tiro bajo (cintura al aire), solo si le gusta
  }
  return out;
}
function generarLooks(n, plan) {
  const est = looksEstilista(n, plan); if (est.length >= n) return est;
  const claves = new Set(est.map(l => [...l.ids].sort().join()));
  return [...est, ...generarLooksAuto(n, plan).filter(l => !claves.has([...l.ids].sort().join()))].slice(0, n);
}
function generarLooksAuto(n, plan) {
  const aptas = estacionesAptas(); const act = activas().filter(p => aptas.includes(p.estacion));
  const de = tp => act.filter(p => p.tipo === tp);
  const arriba = de('Arriba'), abajo = de('Abajo'), vestidos = de('Vestidos'), calzado = de('Calzado'), abrigos = de('Abrigo'), bolsos = de('Bolsos');
  // 0.43 (Sheila, 22/10: «demasiado descubierta para 17 grados»): con 19° o menos, lo que no tiene mangas (chaleco, top, body, tirantes)
  // pide una capa encima (abrigo, chaqueta, americana o chaqueta de punto); si no hay ninguna, ese look baja al final
  const temp = E.tiempo?.t ?? 18, frio = temp <= 14, fresco = temp <= 19;
  // 0.112 (Gabriela, 28/10: «¿me pones un outfit sin chaqueta ni nada de frío con una temperatura de 17 grados?»): con mañana fresca (12° o menos), también capa
  const manana = fresco && (E.tiempo?.min ?? temp) <= 12;
  const capas = [...abrigos, ...arriba.filter(esCapa)];
  const bases = [...vestidos.map(v => [v]), ...arriba.filter(a => !esCapa(a) && estDe(a).rol !== 'capa_ligera').flatMap(a => abajo.map(b => [a, b]))];
  const cands = bases.map(base => {
    let ps = [...base]; const desc = fresco && base.some(sinMangas);
    const ab = frio || desc || manana ? mejorAcompanante(capas.filter(c => !base.includes(c)), ps) : null; if (ab) ps.push(ab);
    const zap = mejorAcompanante(calzado, ps, z => afinZapato(z, ps, E.tiempo?.t)); if (zap) ps.push(zap);
    const bol = ocasionDe(ps) !== 'Deporte' ? mejorAcompanante(bolsos, ps) : null; if (bol) ps.push(bol);
    const est = estilista(ps, E.tiempo?.t);
    return { ps, veto: est.veto, puntos: puntuar(ps) + est.puntos - (desc && !ab ? 3 : 0) };
  }).filter(c => !c.veto).sort((a, b) => b.puntos - a.puntos);
  // 0.101 (Gabriela, 27/10: «sí, arregla las dos»): primero, cada idea con una prenda de arriba distinta (y la de abajo, como mucho dos veces);
  // solo si no salen bastantes se repite la de arriba, como mucho dos veces, y nunca en dos ideas seguidas
  const vistos = new Set(), usados = new Map(), usadosAb = new Map(), lista = [];
  for (const tope of [1, 2]) for (const c of cands) {
    if (lista.length >= n) break;
    if (c.puntos < -1.5 && lista.length) break;                                    // mejor menos ideas que ideas malas
    const clave = c.ps.map(p => p.id).sort().join(); if (vistos.has(clave)) continue;
    const prin = c.ps[0], ab = c.ps.find((p, i) => i && p.tipo === 'Abajo');
    if ((usados.get(prin.id) || 0) >= tope || (tope === 1 && ab && (usadosAb.get(ab.id) || 0) >= 2)) continue;
    const oc = ocasionDe(c.ps); if (plan && plan !== 'Todos' && !sirvePara(c.ps, oc, plan)) continue;
    vistos.add(clave); usados.set(prin.id, (usados.get(prin.id) || 0) + 1); if (ab) usadosAb.set(ab.id, (usadosAb.get(ab.id) || 0) + 1);
    lista.push({ prin: prin.id, ids: c.ps.map(p => p.id), ocasion: oc, nombre: `${ocNombre(oc)} ${t('con', 'with')} ${prin.nombre.charAt(0).toLowerCase() + prin.nombre.slice(1)}` });
  }
  const out = []; while (lista.length) { const i = Math.max(0, lista.findIndex(l => l.prin !== out[out.length - 1]?.prin)); out.push(lista.splice(i, 1)[0]); }
  return out;
}

/* ---------- navegación ---------- */
const SIN_TABS = ['inicio', 'alta', 'entrar', 'planes', 'silueta', 'cuerpo', 'estilo', 'anadir', 'nuevo-look', 'subir'];
function ir(nombre, datos) {
  quitarToast();
  if (nombre === 'inicio' && !$('intro')) $('p-inicio').classList.add('aparece');
  if (nombre === 'anadir') prepararAnadir(datos);
  if (nombre === 'subir' && !datos) prepararSubir();
  if (nombre === 'nuevo-look') prepararNuevoLook(datos);
  if (nombre === 'hoy') pintarHoy();
  if (nombre === 'cuerpo') pintarCuerpo();
  if (nombre === 'silueta') pintarSilueta(); // 10/11: la casilla del permiso, al día
  if (nombre === 'estilo') pintarEstilo();
  if (nombre === 'closet') pintarCloset();
  if (nombre === 'looks') pintarLooks();
  if (nombre === 'yo') pintarYo();
  if (nombre === 'cuenta') pintarCuenta();
  if (nombre === 'colores') pintarMisColores();
  document.querySelectorAll('.pn-base, .vf-capa').forEach(c => c.remove()); // Ajustes y el visor de fotos no tapan la pantalla a la que se va
  if (nombre !== 'closet' && $('mc-hoja') && !$('mc-hoja').hidden) hojaFiltros(false); // la hoja de filtros no se queda abierta en otra pantalla
  E.pantalla = nombre;
  document.querySelectorAll('.pantalla').forEach(p => p.classList.toggle('activa', p.id === 'p-' + nombre));
  const tab = { ficha: 'closet', look: 'looks', cuenta: 'yo', colores: 'yo' }[nombre] || nombre;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('activo', b.dataset.ir === tab));
  $('tabs').classList.toggle('oculta', SIN_TABS.includes(nombre));
  const el = $('p-' + nombre); if (el) el.scrollTop = 0;
  if (nombre === 'hoy') !E.tiempo ? cargarTiempo().then(() => cuandoQuieto(() => E.pantalla === 'hoy' && pintarHoy())) : refrescarTiempo();
}
// 0.131 (Sheila, 03/11: «¿la temperatura se va actualizando durante el día?»): con la app abierta se quedaba la del arranque. Ahora, al volver a la app o a Hoy, y cada
// 15 min con la app delante, si la que hay tiene más de 30 min se pide otra vez y se repinta la fecha con el tiempo. Los looks del día no cambian.
function refrescarTiempo() {
  let ts = 0; try { ts = JSON.parse(localStorage.getItem('tc_tiempo') || 'null')?.ts || 0; } catch (e) { }
  if (!E.tiempo || Date.now() - ts < 30 * 60000) return;
  const antes = E.tiempo; cargarTiempo(true).then(w => { if (!w) E.tiempo = antes; cuandoQuieto(() => E.pantalla === 'hoy' && pintarHoy()); });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refrescarTiempo(); });
setInterval(() => { if (document.visibilityState === 'visible') refrescarTiempo(); }, 15 * 60000);

/* ---------- HOY ---------- */
function proponer() {
  // 1) conjuntos guardados aptos para el tiempo; 2) si no, combinaciones con las prendas
  const aptas = estacionesAptas(); const act = activas().filter(p => aptas.includes(p.estacion));
  const conj = E.conjuntos.filter(c => c.ids.every(id => act.some(p => p.id === id)) && (E.plan === 'Todos' || (c.ocasion || 'Diario') === E.plan));
  const props = conj.map(c => ({ tipo: 'conjunto', c, ids: c.ids }));
  const dia = E.agenda[diaISO(new Date())], evA = eventoAhora(), lkA = evA ? lookDe(diaISO(new Date()), evA) : null; // 0.111: el look planificado para el evento que toca
  if (lkA) props.unshift({ tipo: 'agenda', ids: lkA, ocasion: evA.oc }); else if (dia?.look?.length && dia.look.every(P)) props.unshift({ tipo: 'agenda', ids: dia.look, ocasion: dia.planes?.[0]?.oc });
  for (const g of generarLooks(4, E.plan)) if (!props.some(x => x.ids.join() === g.ids.join())) props.push({ tipo: 'propuesta', ids: g.ids, nombre: g.nombre, ocasion: g.ocasion, zapato: g.zapato, zspec: g.zspec, como: g.como, porque: g.porque, est: g.estilista });
  // «No me gusta»: un look propuesto no vuelve; uno guardado por ella o el del calendario solo se aparta por hoy
  const g = E.perfil?.gustos, clave = ids => [...ids].sort().join();
  const fuera = x => x.tipo !== 'agenda' && (g?.fuera?.includes(clave(x.ids)) || (g?.hoy?.d === hoyISO() && g.hoy.k.includes(clave(x.ids))));
  // 0.70: con la regla de no repetir, también los looks guardados se ordenan por puntos (lo puesto hace poco baja; los favoritos, mucho menos)
  const nota = x => x.tipo === 'agenda' ? 99 : puntuar(x.ids.map(P).filter(Boolean)) + (x.tipo === 'conjunto' ? 1 : 0) + (x.est ? 2 : 0);
  E.propuestas = props.filter(x => !fuera(x)).map(x => [nota(x), x]).sort((a, b) => b[0] - a[0]).map(e => e[1]); if (E.hoyIdx >= E.propuestas.length) E.hoyIdx = 0;
}
// 0.42 (Sheila, 22/10: «si no lo hace la usuaria, la asistente virtual le debe preguntar a dónde vamos hoy y sugerirle»):
// sin plan en el calendario para hoy, Hoy pregunta «¿A dónde vas hoy?»; la respuesta se guarda como plan del día y los looks se rehacen
function preguntaHoy(planHoy) {
  if (planHoy) return `<button class="hz-plan" data-hzpreg>${t('Hoy', 'Today')}: ${ocNombre(planHoy).toLowerCase()}</button>${E.hzPreg ? opcionesHoy(planHoy) : ''}`;
  return `<button class="hz-preg" data-hzpreg>${t('¿Qué planes tienes hoy?', 'What are your plans today?')}</button>${E.hzPreg ? opcionesHoy() : ''}`;
}
const opcionesHoy = sel => `<div class="hz-ops">${OCASIONES.map(o => `<button class="${o === sel ? 'on' : ''}" data-hzoc="${o}">${ocNombre(o)}</button>`).join('')}</div>`;
document.addEventListener('click', async e => {
  const b = e.target.closest('#p-hoy [data-hzpreg],#p-hoy [data-hzoc],#p-looks [data-hzpreg],#p-looks [data-hzoc]'); if (!b) return;
  if (b.dataset.hzoc) {
    const k = diaISO(new Date()), h = new Date().getHours(), fr = h < 14 ? 'Mañana' : h < 20 ? 'Tarde' : 'Noche';
    E.agenda[k] = E.agenda[k] || { planes: [] }; E.agenda[k].planes = [{ id: uid(), oc: b.dataset.hzoc, fr, deHoy: 1 }, ...E.agenda[k].planes.filter(p => p.oc !== b.dataset.hzoc)];
    E.hzPreg = false; E.hoyDiario = false; E.propuestas = []; E.hoyIdx = 0; await guardar();
  } else E.hzPreg = !E.hzPreg;
  if (E.pantalla === 'looks') pintarLooks(); else pintarHoy();
});
function pintarHoy() { // 0.8 · cerrada por Gabriela el 20/10: centrada, sin menú arriba, el tiempo una vez junto a la fecha, debajo solo la ocasión
  const pant = $('p-hoy'); const w = E.tiempo; const l = idioma();
  // 0.40 (Sheila, 22/10: «si ella pone de lunes 23 a viernes 27 oficina en la mañana ya sabes que eso tienes que sugerirle»): el plan del calendario manda
  const planHoy = eventoAhora()?.oc; // 0.111: el evento de la agenda que toca ahora (fijo o suelto)
  if (!E.propuestas.length) { E.hoyFalta = null; E.plan = planHoy || 'Todos'; proponer(); if (!E.propuestas.length && E.plan !== 'Todos') { E.hoyFalta = E.plan; E.plan = 'Todos'; proponer(); E.propuestas = masCercanos(E.hoyFalta, E.propuestas); } }
  const lista = E.propuestas; const pr = lista[E.hoyIdx];
  const hoyD = new Date(); const dia = cap(hoyD.toLocaleDateString(l === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric' }));
  const ico = k => ICO_T[k] || ICO_T.nube;
  const cieloAhora = w ? (w.clave === 'solnube' ? 'sol' : ['lluvia', 'tormenta'].includes(w.clave) ? 'nube' : w.clave) : null; // el icono del cielo: sol si hay sol, aunque haga frío
  const avisoLluvia = !w ? '' : ['lluvia', 'tormenta'].includes(w.clave) ? ` · ${ico('lluvia')}${t('ahora', 'now')}` : w.lluviaH != null ? ` · ${ico('lluvia')}${w.lluviaH}:00` : '';
  const cab = `<header class="hz-cab"><span class="marca"><svg viewBox="0 0 100 100"><use href="#i129"/></svg><span>Tu<span class="oro">Closet</span></span></span>
    <div class="hz-dia mini-et">${dia}${w ? `${ico(cieloAhora)}${w.t}°${avisoLluvia}` : ''}</div>${preguntaHoy(planHoy)}${E.hoyFalta ? avisoFalta(E.hoyFalta, false) : ''}</header>`;
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
  const psZ = conZapato(ps, pr.zspec, pr.como), muestra = psZ.some(p => p.muestra);
  // 0.112: si a primera hora hace fresco y el conjunto no lleva nada encima porque no hay chaquetas subidas, se dice
  const minimo = w ? (w.min ?? w.t) : null, sinCapa = w && w.t <= 19 && minimo <= 12 && !ps.some(p => p.tipo === 'Abrigo' || esCapa(p)) && !activas().some(p => p.tipo === 'Abrigo' || esCapa(p));
  const figura = avatar ? `<img src="${avatar}" alt="${t('Tú con el conjunto', 'You wearing the outfit')}">` : maniqui(psZ);
  const oc = planHoy && !E.hoyFalta && pr.tipo !== 'conjunto' ? planHoy : (c && c.ocasion) || pr.ocasion || ocasionDe(ps); // 0.117 (Gabriela, 28/10: «no me deja seleccionar ninguna más allá de diario»): manda el plan elegido
  const flechas = lista.length > 1 ? `<div class="hz-flechas"><button id="hoy-ant" aria-label="${t('Anterior', 'Previous')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><button id="hoy-sig" aria-label="${t('Otro', 'Next')}"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div>` : '';
  pant.innerHTML = cab + `<div class="hz-escena"><div class="hz-fig">${figura}</div>${flechas}<div class="hz-pie"><div class="hz-oc mini-et">${ocNombre(oc)}<button class="hz-fav${esFav(pr.ids) ? ' on' : ''}" id="hoy-fav" aria-label="${t('Favorito', 'Favourite')}" aria-pressed="${esFav(pr.ids)}"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button></div>${pieLook(psZ)}<button class="hz-bt" id="hoy-pongo">${t('Me lo pongo', 'I’ll wear it')}</button><button class="hz-no" id="hoy-no">${t('No me gusta', 'Not for me')}</button>${sinCapa ? `<button class="hz-zap" data-ir="subir">${t(`A primera hora, ${minimo}°: llévate una chaqueta. Sube las tuyas y te las combino`, `Early on, ${minimo}°: take a jacket. Upload yours and I’ll match them`)}</button>` : ''}${muestra && !avatar ? `<button class="hz-zap" data-ir="subir">${t('Zapatos de muestra: sube los tuyos', 'Sample shoes: upload yours')}</button>` : ''}</div></div>`; // 0.103: siempre zapatos (sugeridos si no hay) // 0.97 (Gabriela, 24/10: «no ha recomendado zapatos»: no tenía ninguno subido)
  // 0.66 (Sheila, 23/10: «cuida que no sucedan estas cosas»: el aviso quedaba debajo del abrigo): la escena empieza donde acaba la cabecera
  const cabH = pant.querySelector('.hz-cab'), escH = pant.querySelector('.hz-escena');
  if (escH && cabH) { const fija = () => { if (cabH.offsetHeight) escH.style.top = Math.max(118, cabH.offsetHeight + 12) + 'px'; }; fija(); setTimeout(fija, 300); new ResizeObserver(fija).observe(cabH); } // también cuando la pantalla se hace visible // 0.67 (Sheila: «se superpone la prenda a la letra»): siempre bajo la cabecera, mida lo que mida
  if ($('hoy-sig')) $('hoy-sig').onclick = () => { E.hoyIdx = (E.hoyIdx + 1) % lista.length; pintarHoy(); };
  if ($('hoy-ant')) $('hoy-ant').onclick = () => { E.hoyIdx = (E.hoyIdx + lista.length - 1) % lista.length; pintarHoy(); };
  $('hoy-pongo').onclick = async () => { await ponerse(pr.ids, c); };
  $('hoy-fav').onclick = async () => {
    if (!E.perfil) return; const g = E.perfil.gustos = E.perfil.gustos || { si: {}, no: {} }, k = claveLook(pr.ids); g.fav = g.fav || [];
    const ya = g.fav.includes(k); g.fav = ya ? g.fav.filter(x => x !== k) : [...g.fav, k];
    let cj = E.conjuntos.find(x => claveLook(x.ids) === k);
    if (!ya && !cj) { cj = { id: uid(), nombre: t('Favorito', 'Favourite') + ' · ' + ocNombre(oc).toLowerCase(), ocasion: oc, ids: [...pr.ids], creada: hoyISO(), usos: [] }; E.conjuntos.unshift(cj); }
    if (cj) cj.fav = !ya;
    await guardar(); pintarHoy(); toast(ya ? t('Quitado de favoritos', 'Removed from favourites') : t('En favoritos: lo tienes en Looks y podrás repetirlo cuando quieras', 'Saved to favourites: find it in Looks and repeat it any time'));
  };
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
E.cal = { mes: null, dia: null, oc: 'Oficina', fr: 'Mañana', idea: 0 };
// 0.111 · Agenda (Gabriela, 28/10: «en el calendario pueden los usuarios poner tipo su agenda con eventos fijos e ir planificando los outfits»).
// Eventos fijos (perfil.fijos: nombre, ocasión, hora y días de la semana) y sueltos (agenda[día].planes); cada evento lleva su look
// (agenda[día].looks[id del evento]). La vista por defecto es la semana, como una agenda; el mes sirve para saltar a otra semana.
const HORA_FR = { Mañana: '09:00', Tarde: '16:00', Noche: '21:00' };
const frDe = h => !h ? 'Mañana' : h < '14:00' ? 'Mañana' : h < '20:00' ? 'Tarde' : 'Noche';
const OC_POR_NOMBRE = [[/gym|gimnas|pilates|yoga|correr|running|p[aá]del|tenis|deporte|entren|crossfit|spinning|nata|piscina|baile/i, 'Deporte'], [/oficina|trabaj|reuni|clase|universidad|facultad|cliente|curro|cole/i, 'Oficina'], [/cena|copas|fiesta|discoteca|concierto|teatro|cine|noche/i, 'Noche'], [/boda|bautiz|comuni|graduaci|gala|evento|cumple/i, 'Evento'], [/viaje|vuelo|avi[oó]n|tren|escapada|aeropuerto/i, 'Viaje']];
function eventosDe(d) {
  const a = E.agenda[d] || {}, dow = new Date(d + 'T12:00').getDay(), sin = a.sin || [];
  const fijos = (E.perfil?.fijos || []).filter(f => f.dias.includes(dow) && !sin.includes(f.id) && (!f.desde || d >= f.desde)).map(f => ({ id: f.id, nombre: f.nombre, oc: f.oc, hora: f.hora || '', fijo: true, url: f.url, desc: f.desc, lugar: f.lugar, ref: f }));
  const sueltos = (a.planes || []).map((p, i) => ({ id: p.id || 'p' + i, i, nombre: p.nombre || '', oc: p.oc, hora: p.hora || HORA_FR[p.fr] || '', deHoy: p.deHoy, url: p.url, desc: p.desc, lugar: p.lugar, ref: p }));
  return [...fijos, ...sueltos].sort((x, y) => (x.hora || '99').localeCompare(y.hora || '99'));
}
function lookDe(d, ev) { const a = E.agenda[d] || {}, ids = a.looks?.[ev.id] || (a.look && eventosDe(d)[0]?.id === ev.id ? a.look : null); return ids?.length && ids.every(P) ? ids : null; }
function eventoAhora() { // el evento de hoy que toca: el próximo (o el que acaba de empezar); si ya pasaron todos, el último
  const d = diaISO(new Date()), evs = eventosDe(d); if (!evs.length) return null;
  const n = new Date(), ya = `${String(Math.max(0, n.getHours() - 1)).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  return evs.find(e => e.deHoy) || evs.find(e => !e.hora || e.hora >= ya) || evs[evs.length - 1]; // lo que eligió en Hoy manda
}
const nomEv = ev => ev.nombre || ocNombre(ev.oc);
function diasTxt(ds) {
  const o = [1, 2, 3, 4, 5, 6, 0].filter(x => ds.includes(x)), en = idioma() === 'en';
  if (o.join() === '1,2,3,4,5') return t('de lunes a viernes', 'Monday to Friday'); if (o.length === 7) return t('todos los días', 'every day'); if (o.join() === '6,0') return t('los fines de semana', 'weekends');
  return o.map(x => (en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])[x]).join(', ');
}
// el formulario, como el de Google Calendar: título, hora, ocasión (se deduce del título) y si se repite
const REPITE = [['una', 'No se repite', 'Does not repeat'], ['semana', 'Cada semana', 'Weekly'], ['laborables', 'De lunes a viernes', 'Weekdays'], ['diario', 'Todos los días', 'Every day'], ['dias', 'Elegir días', 'Pick days']];
const escH = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function formEvento() {
  const f = E.cal.form, en = idioma() === 'en', L = en ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return `<div class="ag-form"><input id="ag-nom" type="text" maxlength="40" placeholder="${t('Añade un título: oficina, pilates, cena…', 'Add a title: office, pilates, dinner…')}" value="${(f.nombre || '').replace(/"/g, '&quot;')}" autocomplete="off">
    <label class="ag-hora">${t('Hora', 'Time')}<input id="ag-hora" type="time" value="${f.hora || ''}"></label>
    <input id="ag-url" class="ag-url" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="${t('Enlace del sitio: Google Maps, su web o Instagram', 'Link to the place: Google Maps, website or Instagram')}" value="${escH(f.url || '')}">
    <textarea id="ag-desc" class="ag-desc" rows="2" maxlength="240" placeholder="${t('Cuéntame el plan: qué haréis, si es dentro o fuera, si hay que ir arreglada…', 'Tell me the plan: what you’ll do, indoors or out, dressy or not…')}">${escH(f.desc || '')}</textarea>
    <div class="cal-ops">${OCASIONES.map(o => `<button class="${o === f.oc ? 'on' : ''}" data-agoc="${o}">${ocNombre(o)}</button>`).join('')}</div>
    ${f.edita ? '' : `<div class="cal-ops ag-rep">${REPITE.map(([k, es, i]) => `<button class="${k === f.rep ? 'on' : ''}" data-agrep="${k}">${k === 'semana' ? (en ? `Every ${new Date(f.dia + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long' })}` : `Cada ${new Date(f.dia + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long' })}`) : en ? i : es}</button>`).join('')}</div>`}
    ${f.rep === 'dias' ? `<div class="ag-dias">${[1, 2, 3, 4, 5, 6, 0].map((x, i) => `<button class="${f.dias.includes(x) ? 'on' : ''}" data-agdow="${x}" aria-label="${diasTxt([x])}">${L[i]}</button>`).join('')}</div>` : ''}
    <div class="cal-bts"><button class="hz-bt" data-agguarda>${f.edita ? t('Guardar los cambios', 'Save changes') : t('Guardar', 'Save')}</button><button class="txt sub-l" data-agcancela>${t('Cancelar', 'Cancel')}</button></div></div>`;
}
function panelEvento(d, ev, hoy) {
  const lk = lookDe(d, ev), fut = d >= hoy;
  if (lk && !E.cal.cambia) return `<div class="ag-panel"><div class="lk-fig">${figLook({ ids: lk }, true)}</div><div class="cal-bts">${fut ? `<button class="txt sub-l" data-agcambia>${t('Cambiar el look', 'Change the look')}</button>` : ''}<button class="txt sub-l" data-agquitalook>${t('Quitar el look', 'Remove the look')}</button>${quitarEv(ev)}</div></div>`;
  if (!fut) return `<div class="ag-panel"><div class="cal-bts">${quitarEv(ev)}</div></div>`;
  let ideas, falta = false, info = '';
  if (typeof looksEvento === 'function') {
    const r = looksEvento(d, ev); if (!r) return `<div class="ag-panel">${datosPlan(ev)}<p class="cal-vacio">${t('Mirando el tiempo de ese día en ese sitio…', 'Checking the weather there that day…')}</p><div class="cal-bts">${editarEv}${quitarEv(ev)}</div></div>`;
    ideas = r.ideas; info = r.info;
  } else ideas = generarLooks(6, ev.oc);
  if (!ideas.length) { falta = true; ideas = masCercanos(ev.oc, generarLooks(12, 'Todos')).slice(0, 6); }
  const g = ideas[E.cal.idea % Math.max(1, ideas.length)];
  if (g) { const k = `${d}|${ev.id}|${E.cal.idea}`; if (E.cal.reg !== k) { E.cal.reg = k; registrar('propuesta', { dia: d, ev: ev.id, oc: ev.oc, idea: E.cal.idea, ids: g.ids, info }); } }
  const mios = E.cal.mios && E.conjuntos.length ? `<div class="cal-mios">${E.conjuntos.slice(0, 12).map(c => `<button data-agmio="${c.id}"><div class="lk-fig">${figLook(c, true)}</div></button>`).join('')}</div>` : '';
  return `<div class="ag-panel">${datosPlan(ev, info)}${falta ? avisoFalta(ev.oc, false) : ''}${g ? `<div class="lk-fig">${figLook(g, true)}</div>${pieLook(conZapato(g.ids.map(P).filter(Boolean), g.zspec))}` : ''}
    <div class="cal-bts">${g ? `<button class="hz-bt" data-agpon="${g.ids.join(',')}">${t('Guardar para este evento', 'Save for this event')}</button><button class="txt sub-l" data-cotra>${t('Otra idea', 'Another idea')}</button>` : ''}${E.conjuntos.length ? `<button class="txt sub-l" data-agmios>${t('Elegir de mis looks', 'Pick from my looks')}</button>` : ''}${editarEv}${quitarEv(ev)}</div>${mios}</div>`;
}
const editarEv = `<button class="txt sub-l" data-agedita>${t('Editar el plan', 'Edit the plan')}</button>`;
// el sitio (con su enlace), la descripción y el tiempo de ese día a esa hora
function datosPlan(ev, info) {
  const sitio = ev.lugar?.nombre || (ev.url ? t('el sitio', 'the place') : ''), url = ev.lugar?.url || ev.url;
  if (!sitio && !ev.desc && !info) return '';
  return `<div class="ag-plan">${sitio ? `<p class="ag-sitio">${url ? `<a href="${escH(url)}" target="_blank" rel="noopener">${escH(sitio)}</a>` : escH(sitio)}${ev.lugar?.sitio ? `<small>${escH(ev.lugar.sitio)}</small>` : ''}</p>` : ''}${ev.desc ? `<p class="ag-desc-t">${escH(ev.desc)}</p>` : ''}${info ? `<p class="ag-info">${escH(info)}</p>` : ''}</div>`;
}
// el enlace → nombre, sitio y coordenadas (lo lee el servidor); se guarda en el evento para el tiempo de ese sitio
async function leerEnlace(obj, d) {
  if (!cuenta()) return;
  try { const r = await api('/api/enlace?u=' + encodeURIComponent(obj.url), { tiempo: 20000 }); if (!r.ok) return; const j = await r.json();
    if (j.nombre || j.lat != null) { obj.lugar = { nombre: j.nombre, lat: j.lat, lon: j.lon, tipo: j.tipo, sitio: j.sitio, url: obj.url }; await guardar(); registrar('lugar', { dia: d, url: obj.url, ...obj.lugar }); if (E.pantalla === 'looks' && E.lkTab === 'cal') pintarLooks(); }
  } catch (e) { }
}
// 06/11 (Gabriela: «todo esto son experimentos que tienes que ir registrando para analizar y establecer patrones de comportamiento de la app»):
// cada plan, look propuesto, elegido u «otra idea» se apunta en el servidor (solo de las cuentas de las socias, mientras no haya política de privacidad)
function registrar(tipo, d) { if (!cuenta() || window.top !== window) return; api('/api/registro', { method: 'POST', json: { tipo, d }, tiempo: 15000 }).catch(() => { }); }
const quitarEv = ev => `<button class="txt sub-l ag-quita" data-agquita>${ev.fijo ? t('Borrar solo este día', 'Delete this day only') : t('Borrar el evento', 'Delete the event')}</button>${ev.fijo ? `<button class="txt sub-l ag-quita" data-agbfijo="${ev.id}">${t('Borrar en todas las semanas', 'Delete from every week')}</button>` : ''}`;
// 0.111 (Gabriela, 28/10, al ver la agenda por semanas: «quizás el calendario debe ser más pequeño, abarca mucho espacio, con la opción de
// poner eventos en algún día como lo hace Google Calendar»): un mes pequeño arriba (un punto en los días con eventos) y, debajo, los eventos
// del día elegido con su look; «Añadir evento» en ese día, con la opción de repetirlo
function pintarAgenda(raiz) {
  const en = idioma() === 'en', loc = en ? 'en-GB' : 'es-ES', hoy = diaISO(new Date());
  if (!E.cal.dia) E.cal.dia = hoy;
  const sel = new Date(E.cal.dia + 'T12:00'); if (!E.cal.mes) E.cal.mes = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const m = E.cal.mes, pri = (m.getDay() + 6) % 7, nd = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), f = E.cal.form, d = E.cal.dia;
  let celdas = ''; for (let i = 0; i < pri; i++) celdas += '<i></i>';
  for (let n = 1; n <= nd; n++) {
    const k = diaISO(new Date(m.getFullYear(), m.getMonth(), n)), evs = eventosDe(k), conLook = evs.some(ev => lookDe(k, ev)) || E.prendas.some(p => (p.usos || []).includes(k));
    celdas += `<button class="${k === d ? 'on' : ''}${k === hoy ? ' hoy' : ''}${k < hoy ? ' pasado' : ''}" data-agdia="${k}"${evs.length || conLook ? ` aria-label="${n}, ${evs.length ? t('con planes', 'with plans') : t('con un look', 'with an outfit')}"` : ''}><b>${n}</b>${evs.length || conLook ? `<em class="${conLook ? 'lleno' : ''}"></em>` : ''}</button>`;
  }
  const sem = (en ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D']).map(x => `<span>${x}</span>`).join('');
  const evs = eventosDe(d), fijos = E.perfil?.fijos || [];
  const filas = evs.map(ev => { const k = `${d}|${ev.id}`, lk = lookDe(d, ev), ab = E.cal.ev === k;
    return `<div class="ag-ev${ab ? ' ab' : ''}"><button class="ag-fila" data-agev="${k}"><span class="ag-h">${ev.hora || ''}</span><span class="ag-txt"><b>${nomEv(ev)}</b><small>${[ev.nombre && ev.nombre.toLowerCase() !== ocNombre(ev.oc).toLowerCase() ? ocNombre(ev.oc) : '', ev.fijo ? diasTxt((fijos.find(x => x.id === ev.id) || {}).dias || []) : '', ev.lugar?.nombre || ''].filter(Boolean).join(' · ')}</small></span>${lk ? `<span class="ag-mini"><span class="lk-fig">${figLook({ ids: lk }, true)}</span></span>` : d >= hoy ? `<span class="ag-elegir">${t('Elegir look', 'Pick a look')}</span>` : ''}</button>${ab ? panelEvento(d, ev, hoy) : ''}</div>`; }).join('');
  const puesto = E.prendas.filter(p => (p.usos || []).includes(d));
  raiz.innerHTML = `<div class="mc-cab lk-cab"><h1>${t('Looks', 'Looks')}</h1><button class="lk-mas" data-ir="nuevo-look" aria-label="${t('Crear un look', 'Create a look')}"><svg viewBox="0 0 20 20"><path d="M10 3v14M3 10h14"/></svg></button></div>
    ${lkTabs('cal')}
    <div class="cal ag"><div class="ag-mes"><button data-agmes="-1" aria-label="${t('Mes anterior', 'Previous month')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><h2>${cap(m.toLocaleDateString(loc, { month: 'long', year: 'numeric' }))}</h2><button data-agmes="1" aria-label="${t('Mes siguiente', 'Next month')}"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div>
    <div class="ag-sem7">${sem}</div><div class="ag-rej">${celdas}</div>
    <section class="ag-dia"><h3>${cap(sel.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
      ${filas || (f ? '' : `<p class="cal-vacio">${d >= hoy ? t('Nada apuntado este día.', 'Nothing planned this day.') : t('Sin eventos.', 'No events.')}</p>`)}
      ${f ? formEvento() : d >= hoy ? `<button class="ag-mas" data-agnuevo><svg viewBox="0 0 12 12"><path d="M6 1v10M1 6h10"/></svg>${t('Añadir evento', 'Add event')}</button>` : ''}
      ${puesto.length ? `<div class="cal-look"><p class="mini-et">${t('Te pusiste', 'You wore')}</p><div class="lk-fig">${maniqui(puesto, true)}</div></div>` : ''}</section></div>`;
  const nom = $('ag-nom'); if (nom) { nom.oninput = () => { f.nombre = nom.value; const o = OC_POR_NOMBRE.find(([r]) => r.test(nom.value)); if (o && !f.ocTocada && o[1] !== f.oc) { f.oc = o[1]; raiz.querySelectorAll('[data-agoc]').forEach(b => b.classList.toggle('on', b.dataset.agoc === f.oc)); } }; if (!f.nombre) nom.focus(); }
  const hr = $('ag-hora'); if (hr) hr.onchange = () => { f.hora = hr.value; };
  raiz.onclick = async e => {
    const b = e.target.closest('[data-lktab],[data-agmes],[data-agdia],[data-agnuevo],[data-agoc],[data-agrep],[data-agdow],[data-agguarda],[data-agcancela],[data-agev],[data-agpon],[data-cotra],[data-agmios],[data-agmio],[data-agcambia],[data-agedita],[data-agquitalook],[data-agquita],[data-agbfijo]'); if (!b) return;
    const q = b.dataset, [dia, evId] = (E.cal.ev || '|').split('|'), ag = k => (E.agenda[k] = E.agenda[k] || { planes: [] });
    if (q.lktab) { E.lkTab = q.lktab; E.lkTocado = true; E.lkI = 0; return pintarLooks(); }
    if (q.agmes) E.cal.mes = new Date(m.getFullYear(), m.getMonth() + +q.agmes, 1);
    else if (q.agdia) { E.cal.dia = q.agdia; E.cal.ev = null; E.cal.form = null; E.cal.idea = 0; }
    else if (q.agnuevo !== undefined) { E.cal.form = { dia: d, oc: 'Diario', hora: '', rep: 'una', dias: [sel.getDay()], nombre: '' }; E.cal.ev = null; }
    else if (q.agoc) { f.oc = q.agoc; f.ocTocada = true; raiz.querySelectorAll('[data-agoc]').forEach(x => x.classList.toggle('on', x.dataset.agoc === f.oc)); return; }
    else if (q.agrep) { f.nombre = $('ag-nom')?.value || f.nombre; f.hora = $('ag-hora')?.value || f.hora; f.url = $('ag-url')?.value ?? f.url; f.desc = $('ag-desc')?.value ?? f.desc; f.rep = q.agrep; } // el enlace y la descripción tampoco se pierden al elegir cómo se repite
    else if (q.agdow) { const x = +q.agdow; f.dias = f.dias.includes(x) ? f.dias.filter(y => y !== x) : [...f.dias, x]; b.classList.toggle('on'); return; }
    else if (q.agcancela !== undefined) E.cal.form = null;
    else if (q.agguarda !== undefined) {
      // 07/11 (Gabriela: «no me deja guardar, el botón no funciona»): al compartir desde Google Maps, el iPhone pega el nombre del sitio y después el enlace,
      // y a veces el enlace llega sin https://. Antes eso paraba el guardado con un aviso; ahora se saca el enlace de donde esté y lo demás es el nombre del sitio
      const crudo = ($('ag-url')?.value || '').trim(), mu = crudo.match(/https?:\/\/[^\s"<>]+/i) || crudo.match(/(?:^|\s)((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/[^\s"<>]*)/i);
      const url = mu ? (mu[1] ? 'https://' + mu[1] : mu[0]).replace(/[).,;]+$/, '') : '', sitioTxt = (mu ? crudo.replace(mu[0], ' ') : crudo).replace(/\s+/g, ' ').trim();
      const nombre = ($('ag-nom')?.value || '').trim(), hora = $('ag-hora')?.value || '', desc0 = ($('ag-desc')?.value || '').trim();
      const desc = sitioTxt && !desc0.toLowerCase().includes(sitioTxt.toLowerCase()) ? [sitioTxt, desc0].filter(Boolean).join(' · ') : desc0;
      if (!f.ocTocada && !OC_POR_NOMBRE.some(([r]) => r.test(nombre))) { const o = OC_POR_NOMBRE.find(([r]) => r.test(desc)); if (o) f.oc = o[1]; }
      const extra = { url: url || undefined, desc: desc || undefined }, dias = f.edita ? null : { semana: [sel.getDay()], laborables: [1, 2, 3, 4, 5], diario: [0, 1, 2, 3, 4, 5, 6], dias: f.dias }[f.rep];
      let obj;
      if (f.edita) { obj = f.edita; if (obj.url !== extra.url) delete obj.lugar; Object.assign(obj, { nombre, oc: f.oc, hora, ...extra }); if (!obj.dias) obj.fr = frDe(hora); }
      else if (dias) { if (!dias.length) { toast(t('Marca los días en que se repite', 'Pick the days it repeats')); return; } obj = { id: uid(), nombre, oc: f.oc, hora, dias: [...dias].sort(), desde: d, ...extra }; E.perfil.fijos = [...(E.perfil.fijos || []), obj]; }
      else { obj = { id: uid(), nombre, oc: f.oc, hora, fr: frDe(hora), ...extra }; ag(d).planes.push(obj); }
      E.cal.form = null; await guardar(); E.propuestas = []; toast(f.edita ? t('Cambios guardados', 'Changes saved') : dias ? t('Evento guardado: se repite ', 'Event saved: repeats ') + diasTxt(dias) : t('Evento guardado', 'Event saved'));
      registrar('plan', { dia: d, hora, oc: f.oc, nombre, desc, url, repite: dias ? diasTxt(dias) : '' });
      if (url && !obj.lugar) leerEnlace(obj, d);
    }
    else if (q.agev) { E.cal.ev = E.cal.ev === q.agev ? null : q.agev; E.cal.idea = 0; E.cal.mios = false; E.cal.cambia = false; E.cal.form = null; }
    else if (q.agpon) { const a = ag(dia); a.looks = { ...(a.looks || {}), [evId]: q.agpon.split(',') }; registrar('elegido', { dia, ev: evId, ids: q.agpon.split(','), idea: E.cal.idea }); E.cal.cambia = false; await guardar(); E.propuestas = []; toast(t('Look guardado para este evento', 'Look saved for this event')); }
    else if (q.agmio) { const c = E.conjuntos.find(x => x.id === q.agmio); if (c) { const a = ag(dia); a.looks = { ...(a.looks || {}), [evId]: [...c.ids] }; E.cal.mios = false; E.cal.cambia = false; await guardar(); E.propuestas = []; toast(t('Look guardado para este evento', 'Look saved for this event')); } }
    else if (q.cotra !== undefined) { registrar('otra', { dia: E.cal.dia, ev: (E.cal.ev || '').split('|')[1], idea: E.cal.idea }); E.cal.idea++; }
    else if (q.agmios !== undefined) E.cal.mios = !E.cal.mios;
    else if (q.agcambia !== undefined) { E.cal.cambia = true; E.cal.idea = 0; }
    else if (q.agedita !== undefined) { const ev = eventosDe(dia).find(x => x.id === evId); if (ev) { E.cal.form = { dia, oc: ev.oc, hora: ev.hora, rep: 'una', dias: [], nombre: ev.nombre, url: ev.url, desc: ev.desc, edita: ev.ref, ocTocada: true }; E.cal.ev = null; } }
    else if (q.agquitalook !== undefined) { const a = ag(dia); if (a.looks) delete a.looks[evId]; if (a.look && eventosDe(dia)[0]?.id === evId) delete a.look; await guardar(); E.propuestas = []; }
    else if (q.agquita !== undefined) { const ev = eventosDe(dia).find(x => x.id === evId); if (ev) { const a = ag(dia); if (ev.fijo) a.sin = [...(a.sin || []), ev.id]; else a.planes.splice(ev.i, 1); if (a.looks) delete a.looks[ev.id]; E.cal.ev = null; await guardar(); E.propuestas = []; toast(ev.fijo ? t('Quitado de este día', 'Removed from this day') : t('Evento borrado', 'Event deleted')); } }
    else if (q.agbfijo) { E.perfil.fijos = (E.perfil.fijos || []).filter(x => x.id !== q.agbfijo); E.cal.ev = null; await guardar(); E.propuestas = []; toast(t('Borrado en todas las semanas', 'Deleted from every week')); }
    pintarAgenda(raiz);
  };
}
function pintarCalendario(raiz) { return pintarAgenda(raiz); } // la vista de mes (0.40–0.110) se quitó el 06/11: desde la 0.111 el calendario es la agenda

/* ---------- CLÓSET ---------- */
// 0.8 · categorías de tienda: lo de abajo se separa en pantalones y faldas por el nombre
let catArriba = () => 'Tops'; // el diseño nuevo (at.js) separa las prendas de arriba
let catPor = () => null; // y desde el 03/11 clasifica todo como las tiendas (Sheila: «estudia en Zara, Lefties, H&M, Pull and Bear las clasificaciones»)
const CAT_ES = {}; // los nombres en español que cambia el diseño nuevo (Tops → Tops y bodies…)
const catDe = p => catPor(p) || (p.tipo === 'Abajo' ? (/falda|skirt/i.test(p.nombre) ? 'Faldas' : 'Pantalones') : p.tipo === 'Arriba' ? catArriba(p) : ({ Abrigo: 'Abrigos', Vestidos: 'Vestidos', Calzado: 'Zapatos', Bolsos: 'Bolsos', Accesorios: 'Accesorios' }[p.tipo] || p.tipo));
const CATS_ORDEN = ['Tops', 'Pantalones', 'Faldas', 'Vestidos', 'Abrigos', 'Zapatos', 'Bolsos', 'Accesorios'];
const catTxt = c => idioma() === 'en' ? ({ Todo: 'All', Tops: 'Tops', Camisetas: 'T-shirts', 'Camisas y blusas': 'Shirts & blouses', Punto: 'Knitwear', Pantalones: 'Trousers', Faldas: 'Skirts', Vestidos: 'Dresses', Abrigos: 'Outerwear', Zapatos: 'Shoes', Bolsos: 'Bags', Accesorios: 'Accessories', Sudaderas: 'Sweatshirts', Vaqueros: 'Jeans', Shorts: 'Shorts' }[c] || c) : (CAT_ES[c] || c);
E.f = { ocasion: [], estacion: [], color: [], uso: [], estado: [] };
const FILTROS = () => [
  ['ocasion', t('Ocasión', 'Occasion'), OCASIONES.map(o => [o, ocNombre(o)])],
  ['estacion', t('Estación', 'Season'), ESTACIONES.map(x => [x, x])],
  ['color', 'Color', COLORES.filter(([n]) => E.f.color.includes(n) || E.prendas.some(p => p.color === n)).map(([n, c]) => [n, c])], // 11/11: solo los colores de tu ropa (con 39, todos eran demasiados)
  ['uso', t('Uso', 'Use'), [['nueva', t('Sin estrenar', 'Never worn')], ['olvidada', t('Sin poner en 3 meses', 'Not worn in 3 months')], ['mas', t('Las que más uso', 'Most worn')]]],
  ['estado', t('Estado', 'Status'), [['', t('Lista para poner', 'Ready to wear')], ['lavar', t('Sucia', 'In the wash')], ['guardada', t('Guardada', 'Stored')]]]
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
    ? `<button class="sw ${E.f.color.includes(v) ? 'on' : ''}" data-fil="${k}|${v}" title="${nomColor(v)}" aria-label="${nomColor(v)}" aria-pressed="${E.f.color.includes(v)}" style="background:${txt}"></button>`
    : `<button class="${E.f[k].includes(v) ? 'on' : ''}" data-fil="${k}|${v}">${txt}</button>`).join('')}</div>${k === 'ocasion' ? `<small>${t('según el tipo de prenda y tus looks', 'from the garment type and your looks')}</small>` : ''}</div>`).join('');
  const n = E.prendas.filter(p => (E.filtro === 'Todo' || catDe(p) === E.filtro) && pasaFiltros(p)).length;
  $('mc-ver').textContent = n === 1 ? t('Ver 1 prenda', 'See 1 garment') : t(`Ver ${n} prendas`, `See ${n} garments`);
}
function hojaFiltros(abrir) { $('mc-hoja').hidden = !abrir; $('mc-velo').hidden = !abrir; if (abrir) pintarFiltros(); }
const estadoTxt = e => ({ lavar: t('Sucia', 'In the wash'), guardada: t('Guardada', 'Stored'), donar: t('Para donar', 'To donate') }[e] || '');

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
  // 0.156 (Gabriela, 05/11: «los recortes de fondo han sido un desastre»): cuánto duda el modelo, antes de quitar las manchas sueltas
  let vivos = 0, dudas = 0; for (let p = 0; p < S * S; p++) { const a = (m[p] - lo) / ((hi - lo) || 1); if (a > .1) { vivos++; if (a < .9) dudas++; } }
  piezaMayor(al, S, S); const crece = crecerPorColor(al, d, S); for (let p = 0; p < S * S; p++) md.data[p * 4 + 3] = al[p];
  // y cuánto ocupa la prenda y cuántos bordes de la foto toca (una prenda bien separada casi nunca llena la foto ni toca tres bordes)
  let area = 0; const borde = [0, 0, 0, 0]; for (let p = 0; p < S * S; p++) { if (al[p] < 128) continue; area++; const x = p % S, y = (p / S) | 0; if (y < 3) borde[0]++; if (x >= S - 3) borde[1]++; if (y >= S - 3) borde[2]++; if (x < 3) borde[3]++; }
  const q = { area: area / (S * S), bordes: borde.filter(b => b > S * 3 * .15).length, duda: vivos ? dudas / vivos : 1, crece };
  // dudoso: el modelo duda en más de una cuarta parte de la máscara y el color no lo ha completado, o la máscara se come la foto.
  // Con sus 45 fotos de la cama y las 12 de Sheila avisa de la blusa beige sin mangas, la falda blanca sobre la sábana blanca y el jersey de rayas cortado; una falsa alarma (el chaleco negro)
  q.dudoso = (q.duda > .25 && crece < .05) || q.area > .8 || q.bordes >= 3; mc.calidad = q;
  mxc.putImageData(md, 0, 0); return mc;
}
// 0.56 (Sheila, 22/10: «no me toma bien las prendas»): se queda con la pieza más grande de la máscara y un borde de 2 px;
// quita las manchas sueltas de sábana, pared o lámpara que el modelo deja alrededor.
// 0.156 (Gabriela, 05/11: «los recortes de fondo han sido un desastre»): quedarse solo con la mayor tiraba las mangas que el modelo
// separa del cuerpo y uno de los dos zapatos del par. Ahora también se quedan las piezas pegadas (a 6 px o menos) y las grandes
// (un 25 % de la mayor, a 40 px o menos), salvo las que entran cortadas por el borde de la foto (unos vaqueros, una lámpara)
const ensanchar = (m, W, r) => { let c = m.slice(); for (let k = 0; k < r; k++) { const c2 = c.slice(); for (let i = 0; i < c.length; i++) if (!c[i]) { const x = i % W; if ((x > 0 && c[i - 1]) || (x < W - 1 && c[i + 1]) || c[i - W] || c[i + W]) c2[i] = 1; } c = c2; } return c; };
function piezaMayor(a, W, H) {
  const et = new Int32Array(W * H), pila = [], tams = [0]; let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 64 || et[i]) continue; n++; let t = 0; pila.push(i); et[i] = n;
    while (pila.length) { const j = pila.pop(); t++; const x = j % W; for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) if (k >= 0 && k < a.length && !et[k] && a[k] >= 64) { et[k] = n; pila.push(k); } }
    tams.push(t);
  }
  if (!n) return;
  let mejor = 1; for (let c = 2; c <= n; c++) if (tams[c] > tams[mejor]) mejor = c;
  const mayor = new Uint8Array(W * H); for (let i = 0; i < a.length; i++) mayor[i] = et[i] === mejor ? 1 : 0;
  const c6 = ensanchar(mayor, W, 6), c40 = ensanchar(mayor, W, 40), borde = new Uint8Array(n + 1), a6 = new Uint8Array(n + 1), a40 = new Uint8Array(n + 1);
  for (let i = 0; i < a.length; i++) { const c = et[i]; if (!c) continue; const x = i % W, y = (i / W) | 0; if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) borde[c] = 1; if (c6[i]) a6[c] = 1; if (c40[i]) a40[c] = 1; }
  const vale = new Uint8Array(n + 1); vale[mejor] = 1;
  for (let c = 1; c <= n; c++) if (c !== mejor && !borde[c] && ((a40[c] && tams[c] >= tams[mejor] * .25) || (a6[c] && tams[c] >= tams[mejor] * .005))) vale[c] = 1;
  let k = new Uint8Array(W * H); for (let i = 0; i < a.length; i++) k[i] = vale[et[i]] ? 1 : 0;
  k = ensanchar(k, W, 2);
  for (let i = 0; i < a.length; i++) if (!k[i]) a[i] = 0; else if (vale[et[i]]) a[i] = Math.max(a[i], Math.min(255, a[i] * 2));
}
// 0.156: las mangas finas y oscuras sobre la sábana el modelo casi no las ve; la máscara crece por color desde la prenda:
// entra lo que está pegado, a 48 px o menos, y se parece a la prenda y no a la sábana. Solo con un fondo liso y una prenda
// que se distinga bien de él (con la prenda beige sobre la cama beige se llevaba el cabecero)
function crecerPorColor(al, d, S) {
  const K = new Uint8Array(S * S); let nK = 0; for (let p = 0; p < S * S; p++) if (al[p] >= 128) { K[p] = 1; nK++; }
  if (nK < S * S * .01) return 0;
  const lejos = ensanchar(K, S, 14), cerca = ensanchar(K, S, 3), anillo = []; let g = [0, 0, 0], ng = 0;
  for (let p = 0; p < S * S; p++) { const k = p * 4; if (K[p] && al[p] > 220) { g[0] += d[k]; g[1] += d[k + 1]; g[2] += d[k + 2]; ng++; } else if (lejos[p] && !cerca[p]) anillo.push(p); }
  if (!ng || anillo.length < 50) return 0; g = g.map(v => v / ng);
  // la sábana, por la mediana del anillo de alrededor: las mangas que faltan caen en él y no deben contar
  const med = v => { v.sort((x, y) => x - y); return v[v.length >> 1]; };
  const f = [0, 1, 2].map(ch => med(anillo.map(p => d[p * 4 + ch]))), df = med(anillo.map(p => Math.hypot(d[p * 4] - f[0], d[p * 4 + 1] - f[1], d[p * 4 + 2] - f[2]))), sep = Math.hypot(g[0] - f[0], g[1] - f[1], g[2] - f[2]);
  if (df > 25 || sep < 120) return 0;
  const banda = ensanchar(K, S, 48), pila = []; let mas = 0;
  const parece = p => { const k = p * 4, x = Math.hypot(d[k] - g[0], d[k + 1] - g[1], d[k + 2] - g[2]), y = Math.hypot(d[k] - f[0], d[k + 1] - f[1], d[k + 2] - f[2]); return y > Math.max(45, df * 3) && x < y * .8 && x < sep * .45; };
  for (let p = 0; p < S * S; p++) if (K[p]) pila.push(p);
  while (pila.length) { const j = pila.pop(), x = j % S; for (const k of [x > 0 ? j - 1 : -1, x < S - 1 ? j + 1 : -1, j - S, j + S]) if (k >= 0 && k < S * S && !K[k] && banda[k] && parece(k)) { K[k] = 1; al[k] = 255; mas++; pila.push(k); } }
  return mas / nK;
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
  const pc = {}, px = {}, todos = []; for (const p of TXT_ROPA.prompts) { let s = 0; for (let i = 0; i < p.e.length; i++) s += p.e[i] * v[i]; s /= n; todos.push([p.cat, p.x, s]); if (!(s <= pc[p.cat])) { pc[p.cat] = s; px[p.cat] = p.x; } }
  // 0.37 (Sheila, 22/10: una captura de Vinted entró como top): «NoPrenda» son 13 descripciones de lo que no es ropa (capturas, textos, caras, paisajes…)
  const no = pc.NoPrenda ?? -1; delete pc.NoPrenda;
  const [cat, sc] = Object.entries(pc).sort((a, b) => b[1] - a[1])[0]; return { cat, x: px[cat], sc, noPrenda: no > sc - .005, todos };
}
// 0.30 (Sheila, 21/10: su falda salía como top y una sandalia como pantalón): las prendas subidas antes del reconocimiento se revisan solas una vez;
// cambia el tipo y, si el nombre era el automático, también el nombre. Lo que ella haya escrito a mano no se toca.
const NOMBRE_AUTO = { test: n => /^(Tops|Arriba|Abajo|Calzado)$/.test(n) || ['Top', 'Pantalón', 'Zapatos', 'Vestido', 'Abrigo', 'Bolso', 'Accesorio', 'Falda', 'Chaleco', ...Object.values(NOM_X).map(v => v[0])].some(b => n === b || (n.startsWith(b + ' ') && /^[a-zéóíáú ]+$/.test(n.slice(b.length + 1)))) };
// 0.89 (Gabriela, 24/10, con 25 prendas subidas): las prendas guardadas antes del giro automático y del color corregido se revisan una vez, solas.
// Si la foto estaba tumbada o del revés, se endereza. Si el nombre era el automático, se corrigen también tipo, color y nombre; lo escrito a mano no se toca.
async function revisarGuardadas() {
  const pend = E.prendas.filter(p => !p.src && !p.ejemplo && p.original && (p.rev || 0) < 1); if (!pend.length) return;
  let giradas = 0, corregidas = 0;
  for (const p of pend) {
    await new Promise(r => (window.requestIdleCallback || setTimeout)(r, { timeout: 800 })); // una prenda cada vez, dejando respirar al móvil
    try {
      const r = await procesarPrenda(p.original), usaOrig = p.foto && p.foto.size === p.original.size;
      if (r.giro) { p.original = r.original; p.foto = usaOrig ? r.original : r.blob; urls.delete(p.id); alfa.delete(p.id); p.caja = null; giradas++; }
      if (NOMBRE_AUTO.test(p.nombre) && r.cat) { const nom = nombreReconocido(r.x, r.color) || nombreSubida(r, r.cat); if (nom !== p.nombre || r.color !== p.color || r.tipo !== p.tipo) corregidas++; Object.assign(p, { tipo: r.tipo, color: r.color, x: r.x, nombre: nom }); }
      p.rev = 1;
    } catch (e) { return; } // sin modelo o sin red: se reintenta en la próxima apertura
  }
  await guardar(); E.propuestas = []; E.generados = [];
  if (E.pantalla === 'hoy') pintarHoy(); else if (E.pantalla === 'closet') pintarCloset();
  if (giradas || corregidas) toast(t(`He revisado tus prendas: ${giradas} enderezadas y ${corregidas} con tipo o color corregido`, `I checked your garments: ${giradas} straightened, ${corregidas} fixed`));
}
// 0.156 (Gabriela, 05/11: «los recortes de fondo han sido un desastre»): las prendas subidas desde el 04/11 con el recorte de antes
// (el que tiraba las mangas y un zapato del par) se recortan otra vez, una vez y solas, solo con el modelo de recorte (4,5 MB, sin el reconocedor).
// Solo cambia la foto recortada: el nombre, el tipo y lo que ella haya escrito se quedan. Si había elegido la foto original, no se toca.
async function recortarOtraVez() {
  if (window.top !== window) return;
  const pend = E.prendas.filter(p => !p.src && !p.ejemplo && p.original instanceof Blob && !p.originalRota && !p.recMano && (p.cv || 1) < 5 && (p.creada || '') >= '2026-11-04').slice(0, 120); if (!pend.length) return;
  let hechas = 0;
  for (const p of pend) {
    await new Promise(r => (window.requestIdleCallback || setTimeout)(r, { timeout: 800 }));
    try {
      if (p.foto && p.foto.size === p.original.size) { p.cv = 5; continue; } // usaba la foto original
      const r = await procesarPrenda(p.original, { sinReconocer: true });
      if (r.cv !== 5) break; // 0.157: solo se cambia por el recorte del servidor; sin cuenta o sin red, otra vez en la próxima apertura (0.159: cv 4, sin pies ni trozos sueltos; 0.162: cv 5, sin perder tirantes; lo recortado a mano, recMano, no se toca)
      if (r.recortada) { p.foto = r.blob; urls.delete(p.id); alfa.delete(p.id); p.caja = null; hechas++; }
      if (r.dudoso) p.dudoso = 1; else delete p.dudoso;
      p.cv = 5;
    } catch (e) { break; } // sin modelo o sin red: se reintenta en la próxima apertura
  }
  await guardar(); programarNube();
  if (hechas) { medirTodas(); E.propuestas = []; E.generados = []; cuandoQuieto(() => { if (E.pantalla === 'closet') pintarCloset(); else if (E.pantalla === 'hoy') pintarHoy(); }); toast(t(`He rehecho el recorte de ${hechas} ${hechas === 1 ? 'prenda' : 'prendas'} con el recorte nuevo`, `I redid the cut-out of ${hechas} garment${hechas === 1 ? '' : 's'}`)); }
}
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
// 0.89 (Gabriela, 24/10: «la ropa que tiene una foto virada… se queda tal cual; tiene que haber una opción de ponerla de frente»; «he subido tops y los ha clasificado como chalecos»):
// la foto se prueba en sus cuatro giros con el reconocedor y se queda el giro que mejor parece una prenda, solo si gana con margen
// (probado con sus 25 fotos: endereza los 8 tops tumbados o del revés y no toca ninguna de las que estaban bien)
function girarCanvas(cv, g) { const c = document.createElement('canvas'), r = g % 180; c.width = r ? cv.height : cv.width; c.height = r ? cv.width : cv.height; const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(g * Math.PI / 180); x.drawImage(cv, -cv.width / 2, -cv.height / 2); return c; }
async function girarBlob(b, g = 90) { const im = await createImageBitmap(b); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); const r = girarCanvas(c, g); return new Promise(res => r.toBlob(res, /png|webp/.test(b.type) ? 'image/png' : 'image/jpeg', .9)); }
// 06/11 (Gabriela: «clasifica mal los vestidos cortos, los pone como faldas»): tumbado en la cama, un vestido corto de vuelo se parece a una falda de vuelo.
// Una falda empieza por la cinturilla, ancha, y solo se ensancha. Un vestido tiene cuerpo: arriba tirantes o cuello halter, mucho más estrechos que el bajo;
// o se estrecha en la cintura y vuelve a abrirse; o (palabra de honor) va recto un buen trozo y luego se abre. Medido con sus 6 vestidos y una falda de Sheila
function formaDeVestido(pz) {
  const e = 96 / Math.max(pz.width, pz.height), w = Math.max(1, Math.round(pz.width * e)), h = Math.max(1, Math.round(pz.height * e));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(pz, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data, an = [];
  for (let y = 0; y < h; y++) { let n = 0; for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 128) n++; an.push(n); }
  const sm = an.map((_, y) => { let s = 0, k = 0; for (let j = Math.max(0, y - 2); j <= Math.min(h - 1, y + 2); j++) { s += an[j]; k++; } return s / k; });
  const a = Math.floor(h * .05), top = Math.max(...sm.slice(a, a + Math.max(1, Math.floor(h * .06)))); if (!top) return false;
  let cintura = 0; for (let y = Math.floor(h * .15); y < Math.floor(h * .6); y++) { const ab = Math.max(...sm.slice(y)); if (sm[y] > 0 && ab > sm[y] * 1.3) cintura = Math.max(cintura, Math.max(...sm.slice(a, y + 1)) / sm[y]); }
  const r = sm.findIndex((v, y) => y >= a && v > top * 1.2), recto = (r < 0 ? h : r) / h, abre = Math.max(...sm.slice(Math.floor(h * .5))) / top;
  return abre >= 4 || cintura >= 1.15 || (recto >= .25 && abre >= 1.8);
}
async function mejorGiro(pieza, lienzo) {
  const r = []; for (const g of [0, 90, 180, 270]) { const pz = g ? girarCanvas(pieza, g) : pieza; const q = await reconocerPrenda(lienzo(pz)); r.push({ ...q, giro: g, ancho: pz.width > pz.height * 1.05 }); }
  const base = r[0]; let mejor = base;
  for (const q of r.slice(1)) { if (['Pantalones', 'Faldas', 'Vestidos'].includes(q.cat) && q.ancho) continue; if (q.sc > mejor.sc && q.sc - base.sc >= .015) mejor = q; }
  // «peplum» casi nunca acierta (salía en una blusa roja y en una henley): solo si gana con claridad a la segunda
  if (mejor.x === 'a peplum top' && mejor.todos) { const r2 = mejor.todos.filter(t => t[0] === mejor.cat && t[1] !== mejor.x).sort((a, b) => b[2] - a[2])[0]; if (r2 && mejor.sc - r2[2] < .02) mejor = { ...mejor, x: r2[1] }; }
  return mejor;
}
// 0.89 (Gabriela: «tampoco detecta bien los colores»): la luz de casa tiñe la foto (rojo salía marrón, azul claro salía blanco); se toma el fondo de la foto
// como referencia de blanco y se corrigen los colores de la prenda; si dos colores ocupan cada uno más de una cuarta parte, es «Estampado» (rayas, cuadros…)
function colorPrenda(d, od, w, h, [x0, y0, x1, y1]) {
  let R = 0, G = 0, B = 0, n = 0;
  for (let p = 0, k = 0; p < w * h; p += 5, k += 20) { if (d[k + 3] > 10) continue; const r = od[k], g = od[k + 1], b = od[k + 2]; if (r + g + b < 360) continue; R += r; G += g; B += b; n++; }
  let gr = 1, gg = 1, gb = 1; if (n > 200) { const m = (R + G + B) / 3 / n; gr = Math.min(1.6, Math.max(.7, m / (R / n))); gg = Math.min(1.6, Math.max(.7, m / (G / n))); gb = Math.min(1.6, Math.max(.7, m / (B / n))); }
  const cuenta = {}; let tot = 0; const corte = y0 + (y1 - y0) * .12;
  for (let p = 0, k = 0; p < w * h; p += 3, k += 12) { if (d[k + 3] < 220 || ((p / w) | 0) < corte) continue; const nom = colorCercano(Math.min(255, d[k] * gr), Math.min(255, d[k + 1] * gg), Math.min(255, d[k + 2] * gb)); cuenta[nom] = (cuenta[nom] || 0) + 1; tot++; }
  const orden = Object.entries(cuenta).sort((a, b) => b[1] - a[1]); if (!orden.length) return 'Gris';
  const [c1, n1] = orden[0], [c2, n2] = orden[1] || ['', 0], parecidos = [['Negro', 'Gris'], ['Blanco', 'Gris'], ['Marrón', 'Negro'], ['Azul', 'Negro'], ['Beige', 'Blanco'], ['Camel', 'Marrón'], ['Beige', 'Camel'], ['Azul', 'Azul claro'], ['Rojo', 'Marrón'], ['Rosa', 'Blanco']];
  const contraste = ['Blanco', 'Beige'].includes(c2) && ['Negro', 'Azul', 'Marrón', 'Rojo', 'Verde'].includes(c1) || ['Blanco', 'Beige'].includes(c1) && ['Negro', 'Azul', 'Marrón', 'Rojo', 'Verde'].includes(c2);
  if (contraste && n2 / tot > .12) return 'Estampado'; // rayas finas: blanco sobre oscuro, aunque ocupe poco
  if (n2 / tot > .25 && n1 / tot < .7 && !parecidos.some(([a, b]) => (a === c1 && b === c2) || (a === c2 && b === c1))) return 'Estampado';
  return c1;
}
// 0.157 (Gabriela, 05/11: «la app es muy mala eliminando los fondos… de 20 piezas solo 1 salió bien»): con cuenta, el recorte lo hace
// el servidor (Cloudflare Images, modelo BiRefNet). Con sus 20 fotos de la cama salen enteras las mangas, los tirantes y la blusa blanca
// sobre la sábana blanca. Sin cuenta, sin red, si falla o si se acaba el cupo del mes, recorta el modelo pequeño del móvil, como antes.
// 06/11 (Gabriela: «en las fotos de los vestidos mira que están saliendo mis pies»): el modelo del servidor se queda también con los pies que entran
// por el borde de la foto y con trozos sueltos. Como con el del móvil (piezaMayor, a 320 px): queda la pieza mayor, lo pegado a ella y las piezas
// grandes que no tocan el borde (el otro zapato del par); lo demás se borra del recorte
function soloLaPrenda(m, w, h) {
  const e = 320 / Math.max(w, h), sw = Math.max(1, Math.round(w * e)), sh = Math.max(1, Math.round(h * e));
  const pc = document.createElement('canvas'); pc.width = sw; pc.height = sh; const px = pc.getContext('2d', { willReadFrequently: true }); px.drawImage(m, 0, 0, sw, sh);
  const pd = px.getImageData(0, 0, sw, sh), al = new Uint8Array(sw * sh); for (let q = 0; q < sw * sh; q++) al[q] = pd.data[q * 4 + 3];
  const antes = al.slice(); piezaMayor(al, sw, sh);
  // solo se borran las piezas que se quitan (los pies), no lo que queda fuera: un tirante fino casi desaparece al reducir la foto y se perdía (Gabriela, 06/11: «un top corto de volantes, que quitó un tirante»)
  const fuera = new Uint8Array(sw * sh); let quitado = 0; for (let q = 0; q < sw * sh; q++) if (antes[q] >= 64 && !al[q]) { fuera[q] = 1; quitado++; }
  if (!quitado) return 0;
  const k = ensanchar(fuera, sw, 2);
  for (let q = 0; q < sw * sh; q++) { pd.data[q * 4] = pd.data[q * 4 + 1] = pd.data[q * 4 + 2] = 0; pd.data[q * 4 + 3] = k[q] ? 255 : 0; }
  px.putImageData(pd, 0, 0);
  const mx = m.getContext('2d'); mx.globalCompositeOperation = 'destination-out'; mx.drawImage(pc, 0, 0, w, h); mx.globalCompositeOperation = 'source-over';
  return quitado;
}
async function recorteNube(img) {
  if (!cuenta()?.token) return null;
  const esc = Math.min(1, 1024 / Math.max(img.width, img.height)), w = Math.round(img.width * esc), h = Math.round(img.height * esc);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .9)); if (!b) return null;
  const r = await api('/api/recorte', { method: 'POST', body: b, headers: { 'Content-Type': 'image/jpeg' }, tiempo: 30000 });
  if (!r.ok || !/png/.test(r.headers.get('Content-Type') || '')) return null;
  const u = URL.createObjectURL(await r.blob());
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const m = document.createElement('canvas'); m.width = w; m.height = h; const mx = m.getContext('2d', { willReadFrequently: true }); mx.drawImage(im, 0, 0, w, h); soloLaPrenda(m, w, h);
    // 06/11 (Gabriela: «hay piezas que tienen una sombra, también hay que quitarla»): la sombra suave queda como un halo medio transparente;
    // por debajo de 96 de opacidad se borra y por encima de 200 queda entera (el borde de la prenda sigue suave entre medias)
    const id = mx.getImageData(0, 0, w, h), d = id.data;
    for (let k = 3; k < d.length; k += 4) { const a = d[k]; d[k] = a < 96 ? 0 : a > 200 ? 255 : Math.round((a - 96) * 255 / 104); }
    mx.putImageData(id, 0, 0); let area = 0; const borde = [0, 0, 0, 0];
    for (let p = 0, k = 3; p < w * h; p++, k += 4) { if (d[k] < 128) continue; area++; const x = p % w, y = (p / w) | 0; if (y < 3) borde[0]++; if (x >= w - 3) borde[1]++; if (y >= h - 3) borde[2]++; if (x < 3) borde[3]++; }
    area /= w * h; if (area < .02) return null; // no ha encontrado nada: mejor el recorte del móvil
    m.dudoso = area > .85 || borde.filter((n, i) => n > (i % 2 ? h : w) * 3 * .15).length >= 3; return m;
  } finally { URL.revokeObjectURL(u); }
}
async function procesarPrenda(file, op = {}) {
  const u = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
    const esc = Math.min(1, 1000 / Math.max(img.width, img.height)), w = Math.round(img.width * esc), h = Math.round(img.height * esc);
    let orig = document.createElement('canvas'); orig.width = w; orig.height = h; const ox = orig.getContext('2d', { willReadFrequently: true }); ox.fillStyle = '#fff'; ox.fillRect(0, 0, w, h); ox.drawImage(img, 0, 0, w, h);
    const capa = document.createElement('canvas'); capa.width = w; capa.height = h; const cx = capa.getContext('2d', { willReadFrequently: true });
    let caja = null, color = 'Gris', recortada = false, dudoso = false, nube = null;
    try {
      if (yaSinFondo(img)) cx.drawImage(img, 0, 0, w, h);
      else if (!op.sinNube && (nube = await recorteNube(img).catch(() => null))) { cx.drawImage(nube, 0, 0, w, h); dudoso = nube.dudoso; }
      else { const masc = await mascaraU2(img); dudoso = !!masc.calidad?.dudoso; cx.drawImage(img, 0, 0, w, h); cx.globalCompositeOperation = 'destination-in'; cx.drawImage(masc, 0, 0, w, h); cx.globalCompositeOperation = 'source-over'; }
      const d = cx.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0, R = 0, G = 0, B = 0, n = 0, opacos = 0;
      for (let p = 0, k = 0; p < w * h; p++, k += 4) { const a = d[k + 3]; if (a < 128) continue; opacos++; const px = p % w, py = (p / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; if (a > 220 && (p & 3) === 0) { R += d[k]; G += d[k + 1]; B += d[k + 2]; n++; } }
      if (opacos > w * h * .03) {
        caja = [x0, y0, x1, y1]; recortada = true;
        // color: el más repetido en el cuerpo de la prenda, sin el 22 % de arriba (percha, lámpara)
        color = colorPrenda(d, ox.getImageData(0, 0, w, h).data, w, h, [x0, y0, x1, y1]);
      }
    } catch (e) { /* sin modelo: relleno desde los bordes */ }
    if (!recortada) { cx.globalCompositeOperation = 'source-over'; cx.clearRect(0, 0, w, h); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h); const f = fondoABlanco(cx, w, h); caja = f.caja; color = f.color; recortada = f.ok; }
    const [x0, y0, x1, y1] = caja; let pieza = document.createElement('canvas'); pieza.width = x1 - x0 + 1; pieza.height = y1 - y0 + 1; pieza.getContext('2d').drawImage(capa, x0, y0, pieza.width, pieza.height, 0, 0, pieza.width, pieza.height);
    // 06/11 (Gabriela: «prenda pequeña, mucho blanco»): la prenda ocupa el 94 % del ancho o el 90 % del alto (antes, el 84 %)
    const lienzo = pz => { const W = 900, H = 1200, out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d'); o.fillStyle = '#fff'; o.fillRect(0, 0, W, H); const e = Math.min(W * .94 / pz.width, H * .9 / pz.height), dw = pz.width * e, dh = pz.height * e; o.drawImage(pz, (W - dw) / 2, (H - dh) / 2, dw, dh); return out; };
    let out = lienzo(pieza), giro = 0;
    let tipo = pieza.height / pieza.width < .75 ? 'Calzado' : pieza.height / pieza.width < 1.55 ? 'Arriba' : 'Abajo', cat = null;
    let x = null, noPrenda = false;
    if (!op.sinReconocer) try {
      let todos; ({ cat, x, giro, todos } = await mejorGiro(pieza, lienzo));
      if (giro) { pieza = girarCanvas(pieza, giro); out = lienzo(pieza); orig = girarCanvas(orig, giro); }
      if (cat === 'Faldas' && formaDeVestido(pieza)) { cat = 'Vestidos'; x = (todos || []).filter(q => q[0] === 'Vestidos').sort((a, b) => b[2] - a[2])[0]?.[1] || 'a mini dress'; }
      tipo = TIPO_DE_CAT[cat]; noPrenda = (await reconocerPrenda(orig)).noPrenda;
    } catch (e) { /* sin modelo: por la forma */ }
    const fondo = fondoIrregular(orig);
    const aBlob = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    // 08/11, «¿Me lo compro?»: la prenda sin fondo (PNG transparente, ajustado a ella) para pintarla en los looks sin guardarla
    const alfa = op.alfa && recortada ? await new Promise(r => pieza.toBlob(r, 'image/png')) : null;
    return { blob: await aBlob(out, .88), original: await aBlob(orig, .86), color, tipo, cat, x, rec: cat ? 1 : 0, recortada, noPrenda, fondo, giro, dudoso: !recortada || dudoso, cv: nube && recortada ? 5 : 2, ...(alfa ? { alfa, alfaAR: pieza.width / pieza.height } : {}) };
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
const NOM_X = { 'a t-shirt': ['Camiseta', 'T-shirt', 'f'], 'a blouse': ['Blusa', 'Blouse', 'f'], 'a crop top': ['Top corto', 'Crop top', 'm'], 'a shirt': ['Camisa', 'Shirt', 'f'], 'a knitted vest': ['Top de punto sin mangas', 'Sleeveless knit top', 'm'] /* 0.89: «he subido tops y los ha clasificado como chalecos» */, 'a sweater': ['Jersey', 'Sweater', 'm'], 'a halter bodysuit': ['Body', 'Bodysuit', 'm'], 'a tank top': ['Top', 'Tank top', 'm'], 'a cardigan': ['Chaqueta de punto', 'Cardigan', 'f'], 'a peplum top': ['Top peplum', 'Peplum top', 'm'], 'a sleeveless top': ['Top sin mangas', 'Sleeveless top', 'm'],
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
  if (INVARIABLE.test(c)) return c.toLowerCase(); // «falda crema», «vestidos verde menta» (antes «cremas», «burdeoses»)
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
const FEM = c => adjColor(c, true);
// 11/11 (Sheila, mensaje 2013): al cambiar el color en Editar el nombre seguía con el de antes («Vestido largo sin mangas beige» en Verde salvia).
// Cambia la palabra del color viejo por la del nuevo, con su género y número, solo si va al final o antes de «con», «de», «y» o «sin» (así «azul» no toca «azul marino»)
function nombreConColor(n, de, a) {
  if (!n || !a || de === a || a === 'Estampado' || idioma() === 'en' || /rayas|cuadros|lunares|flores|estampad|animal|cebra|leopardo/i.test(n)) return n;
  // género y número, de la primera palabra («Botines» → plural, «Falda» → femenino); el color nuevo va con ellos
  const w = n.split(/\s+/)[0].toLowerCase(), pl = /s$/.test(w), f = /as?$/.test(w);
  // primero el color que tenía; si el nombre dice otro (el de Sheila decía «beige» guardado como Verde), el que lleve escrito, del más largo al más corto
  for (const c of [de, ...COLORES.map(x => x[0]).sort((x, y) => y.length - x.length)]) if (c && c !== 'Estampado' && c !== a) for (const [cf, cp] of [[1, 1], [0, 1], [1, 0], [0, 0]]) {
    const v = adjColor(c, !!cf, !!cp).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(`(^|\\s)${v}(?=$|\\s+(?:con|de|y|sin)\\b)`, 'i');
    if (re.test(n)) return n.replace(re, (m, sp) => sp + adjColor(a, f, pl));
  }
  return n;
}
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
// 03/11 (Gabriela: «tengo 29» en el móvil y 25 en la cuenta; va a subir toda su ropa): sin cuenta abierta, o en el clóset de pruebas, lo subido se queda solo en este móvil; se avisa antes de subir
function avisoSinNube() {
  if (enGratis() && E.prendas.length >= TOPE_GRATIS) return `<div class="s-aviso s-nube"><b>${t(`En la versión gratis caben ${TOPE_GRATIS} prendas`, `The free version holds ${TOPE_GRATIS} garments`)}</b><span>${t('Tu ropa sigue guardada en tu cuenta. Con Básico o Pro no hay tope.', 'Your clothes stay saved in your account. Basic and Pro have no limit.')}</span><div><button class="boton" data-ir="yo">${t('Ver las versiones', 'See the versions')}</button></div></div>`;
  if (!NUBE) return '';
  if (CLOSET_ACT) return `<div class="s-aviso s-nube"><b>${t('Estás en el clóset de pruebas', 'You are in the test closet')}</b><span>${t('Lo que subas aquí no se guarda en tu cuenta.', 'What you upload here is not saved to your account.')}</span><div><button class="boton" data-cambio="">${t('Pasar a mi ropa', 'Switch to my clothes')}</button></div></div>`;
  if (!cuenta()) return `<div class="s-aviso s-nube"><b>${t('Entra en tu cuenta antes de subir', 'Sign in before uploading')}</b><span>${t('Sin cuenta, tu ropa se queda solo en este móvil y no la verás en otros.', 'Without an account your clothes stay only on this phone.')}</span><div><button class="boton" data-ir="entrar">${t('Entrar', 'Sign in')}</button></div></div>`;
  return '';
}
// 06/11 (Gabriela: «cómo me va a poner estampado solo, hay tantos estampados»): con el color «Estampado», al subir se elige cuál; va al nombre, que es lo que lee el motor
const ESTAMPADOS = { Rayas: ['de rayas', 'Stripes'], Cuadros: ['de cuadros', 'Checks'], Lunares: ['de lunares', 'Polka dots'], Flores: ['de flores', 'Floral'], Animal: ['animal print', 'Animal print'], Otro: ['estampado', 'Other'] };
// y de qué color (Gabriela: «además vienen con colores… dos son de rayas azules y rosas»; «un top negro corto de puntos, hay que ser más específico»): «Camisa de rayas azules»
const INVARIABLE = /^(Beige|Crema|Camel|Burdeos|Mostaza|Caqui|Nude|Terracota|Fucsia|Coral|Turquesa|Chocolate|Antracita|Mantequilla|Melocotón|Lila)$|\s/; // «rayas azul claro», «cuadros burdeos»
const plColor = (c, fem) => { let pl = PLURAL_COLOR[c] || (INVARIABLE.test(c) ? c.toLowerCase() : /[aeo]$/i.test(c) ? c.toLowerCase() + 's' : c.toLowerCase()); return fem ? pl.replace(/os$/, 'as') : pl; };
const nomEstampado = (x, e, c2) => `${NOM_X[x][0]} ${ESTAMPADOS[e][0]}${c2 && ['Rayas', 'Cuadros', 'Lunares', 'Flores'].includes(e) ? ' ' + plColor(c2, e === 'Rayas' || e === 'Flores') : ''}`;
// 06/11 (Gabriela: «hay también piezas de encaje, transparentes… hay que tener ese tipo de detalles»): se marcan al subir; van a la ficha y a las notas (los cuidados las leen)
const DETALLES = { Deporte: 'Sport', Vaquero: 'Denim', Encaje: 'Lace', Transparente: 'Sheer', Volantes: 'Ruffles', Satén: 'Satin', Lentejuelas: 'Sequins', Terciopelo: 'Velvet', Piel: 'Leather', Punto: 'Knit', 'Hombros al aire': 'Off-shoulder' }; // Vaquero (Gabriela: «¿qué hacemos con la mezclilla, una falda de mezclilla larga?»)
function prepararSubir() { E.subida = []; E.sDet = null; pintarSubida(); }
// Subir (Gabriela, 20/10): una sola prenda → su ficha (3B); varias → rejilla (3A) con lo general a la vista y, al tocar una, su ficha
function pintarSubida() {
  const n = E.subida.length, raiz = $('s-raiz'), X = `<button class="x" data-ir="closet" aria-label="${t('Cerrar', 'Close')}"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></svg></button>`;
  const mas = (txt, cls) => `<label class="${cls}">${txt}<input type="file" accept="image/*" multiple data-sfotos></label>`;
  const det = n === 1 ? E.subida[0] : E.subida.find(i => i.id === E.sDet);
  if (!n) raiz.innerHTML = `<div class="sb">${X}<div class="tit"><h1>${t('Sube tu ropa', 'Upload your clothes')}</h1><div class="mini-et">${t('Hasta 20 fotos a la vez, una prenda en cada una', 'Up to 20 photos at once, one garment in each')}</div></div>${avisoSinNube()}<div class="guia"><svg viewBox="0 0 24 24"><use href="#ic-camara"/></svg><i></i><i></i><i></i><i></i></div><p class="consejo">${t('La app quita el fondo y te propone tipo y color.', 'The app removes the background and suggests type and colour.')}</p>${reglasFoto()}<div class="bts"><label class="boton">${t('Hacer una foto', 'Take a photo')}<input type="file" accept="image/*" capture="environment" data-sfotos></label>${mas(t('Elegir de la galería', 'Choose from gallery'), 'boton no')}<span class="txt">${t('Hasta 20 a la vez', 'Up to 20 at a time')}</span></div></div>`;
  else if (det) {
    const i = E.subida.indexOf(det), listo = det.estado === 'listo';
    const ops = (lista, sel, k, nom) => `<div class="ops">${lista.map(x => `<button type="button" class="${x === sel ? 'on' : ''}" data-s${k}="${x}">${nom(x)}</button>`).join('')}</div>`;
    raiz.innerHTML = `<div class="sb uno">${n === 1 ? X : `<button class="x" data-svolver aria-label="${t('Volver', 'Back')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>`}<div class="tit"><h1>${t('Revisa tu prenda', 'Check your garment')}</h1>${n > 1 ? `<div class="mini-et">${i + 1} ${t('de', 'of')} ${n}</div>` : ''}</div>
      <div class="foto">${det.url && listo ? `<button type="button" class="s-recortar" data-srecortar aria-label="${t('Arreglar la foto: marca la prenda y le quito el fondo otra vez', 'Fix the photo: frame the garment and I remove the background again')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5V17h13.5"/><path d="M3.5 7H17v13.5"/></svg><span aria-hidden="true">${t('Arreglar foto', 'Fix photo')}</span></button>` : ''}${det.url ? `<img src="${det.url}" alt="">` : `<p class="s-procesando">${t('Quitando el fondo y reconociendo la prenda…', 'Removing the background and recognising the garment…')}</p>`}</div>
      ${listo && det.noPrenda && !det.siPrenda ? `<div class="s-aviso"><b>${t('Esta foto no parece una prenda', 'This photo does not look like a garment')}</b><span>${t('No coincide con ninguna categoría de ropa. Si es una captura, un texto u otra cosa, quítala.', 'It does not match any clothing category. If it is a screenshot, text or something else, remove it.')}</span><div><button class="boton" data-squita>${t('Quitarla', 'Remove it')}</button><button class="txt sub-l" data-ssi>${t('Sí es una prenda', 'It is a garment')}</button></div></div>` : ''}
      ${listo && det.dudoso && !(det.noPrenda && !det.siPrenda) ? `<div class="s-aviso"><b>${t('Revisa el recorte', 'Check the cut-out')}</b><span>${t('Si le falta un trozo o le sobra fondo, toca «Arreglar foto».', 'If a piece is missing or there is background left, tap “Fix photo”.')}</span></div>` : ''}
      ${listo && det.fondo && !det.dudoso && !(det.cv >= 3) && !(det.noPrenda && !det.siPrenda) ? `<p class="s-fondo">${t('El fondo no es liso: si el recorte sale con restos, toca «Arreglar foto».', 'The background is not plain: if the cut-out keeps bits of it, tap “Fix photo”.')}</p>${reglasFoto()}` : ''}
      ${listo ? `<input class="nom" value="${det.nombre}" data-snom aria-label="${t('Nombre', 'Name')}">${det.clasP ? `<p class="s-clas" role="status">${t('Afinando el nombre y los detalles…', 'Refining the name and details…')}</p>` : ''}
      <div class="fila2 s-cat"><label class="campo"><span>${t('Categoría', 'Category')}</span><select data-scat>${opsCat(catDe(det))}</select></label><label class="campo"><span>${t('Tipo', 'Type')}</span><select data-ssub>${opsSub(catDe(det), subDe(catDe(det), det.x, det.nombre))}</select></label></div>
      <div class="gr"><p class="mini-et">${t('Color', 'Colour')}</p><div class="ops col">${COLORES.map(([c, h]) => `<button type="button" class="${c === det.color ? 'on' : ''}" data-scolor="${c}" title="${nomColor(c)}" aria-label="${nomColor(c)}" aria-pressed="${c === det.color}" style="background:${h}"></button>`).join('')}</div><p class="col-nom">${det.color ? nomColor(det.color) : t('Elige su color', 'Pick its colour')}</p></div>
      ${det.color === 'Estampado' ? `<div class="gr"><p class="mini-et">${t('Estampado', 'Pattern')}</p>${ops(Object.keys(ESTAMPADOS), det.estampado, 'estp', k => t(k, ESTAMPADOS[k][1]))}</div>` : ''}
      ${det.color === 'Estampado' && ['Rayas', 'Cuadros', 'Lunares', 'Flores'].includes(det.estampado) ? `<div class="gr"><p class="mini-et">${t('Color del estampado', 'Pattern colour')}</p><div class="ops col">${COLORES.filter(([c]) => c !== 'Estampado').map(([c, h]) => `<button type="button" class="${c === det.color2 ? 'on' : ''}" data-scolor2="${c}" title="${nomColor(c)}" aria-label="${nomColor(c)}" aria-pressed="${c === det.color2}" style="background:${h}"></button>`).join('')}</div>${det.color2 ? `<p class="col-nom">${nomColor(det.color2)}</p>` : ''}</div>` : ''}
      ${(() => { // 09/11 (decisión 31): si la app ya ha encontrado detalles, plegados con su lista a la vista; si no, abiertos
        const bts = `<div class="ops">${Object.keys(DETALLES).map(k => `<button type="button" class="${(det.detalles || []).includes(k) ? 'on' : ''}" data-sdeta="${k}" aria-pressed="${(det.detalles || []).includes(k)}">${t(k, DETALLES[k])}</button>`).join('')}</div>`;
        if (!det.detalles?.length && !det.detaAbierto) return `<div class="gr"><p class="mini-et">${t('Detalles', 'Details')}</p>${bts}</div>`;
        return `<details class="gr s-deta" data-sdetabre${det.detaAbierto ? ' open' : ''}><summary><span class="mini-et">${t('Detalles', 'Details')}</span><span class="s-deta-l">${(det.detalles || []).map(k => t(k, DETALLES[k])).join(', ') || t('Ninguno', 'None')}</span></summary>${bts}</details>`; })()}
      <div class="gr"><p class="mini-et">${t('Estación', 'Season')}</p>${ops(ESTACIONES, det.estacion, 'est', estNombre)}</div>
      ${det.recortada ? `<button class="txt sub-l" data-sorig>${det.usaOriginal ? t('Usar el fondo blanco', 'Use white background') : t('Usar la foto original', 'Use the original photo')}</button>` : ''}` : ''}
      <div class="bts">${n === 1 ? `<button class="boton" data-sguardar ${listo && !(det.noPrenda && !det.siPrenda) ? '' : 'disabled'}>${t('Guardar en mi clóset', 'Save to my closet')}</button>${mas(t('Añadir más prendas', 'Add more garments'), 'txt sub-l')}` : `<button class="boton" data-svolver>${t('Listo', 'Done')}</button><button class="txt sub-l" data-squita>${t('Quitar esta prenda', 'Remove this garment')}</button>`}</div></div>`;
  } else {
    const listos = E.subida.filter(i => i.estado === 'listo' && !(i.noPrenda && !i.siPrenda)).length, nop = E.subida.filter(i => i.noPrenda && !i.siPrenda).length;
    raiz.innerHTML = `<div class="sb rv">${X}<div class="tit"><h1>${n} ${t('prendas', 'garments')}</h1><div class="mini-et">${E.subida.some(i => i.estado !== 'listo') ? t('Quitando los fondos…', 'Removing backgrounds…') : E.subida.some(i => i.clasP) ? t('Afinando nombres y detalles…', 'Refining names and details…') : t('Revisa y guarda', 'Check and save')}</div></div>
      <div class="rej">${E.subida.map(it => `<button type="button" data-sdet="${it.id}">${it.url ? `<img src="${it.url}" alt="">` : ''}${it.estado === 'listo' && it.noPrenda && !it.siPrenda ? `<p class="no">${t('No es una prenda', 'Not a garment')}<small>${t('Toca para revisarla', 'Tap to check')}</small></p>` : it.estado === 'listo' ? `<em></em><p>${it.nombre}<small>${it.dudoso ? t('Revisa el recorte', 'Check the cut-out') : `${catTxt(catDe(it))} · ${it.color}`}</small></p>` : `<p><small>${t('Quitando el fondo…', 'Removing the background…')}</small></p>`}</button>`).join('')}${n < 20 ? mas(`<svg viewBox="0 0 20 20"><path d="M10 3v14M3 10h14"/></svg><small>${t('Añadir más', 'Add more')}</small>`, 'mas') : ''}</div>
      ${E.subida.some(i => i.estado === 'listo' && i.dudoso && !(i.noPrenda && !i.siPrenda)) ? `<p class="s-aviso-l">${t('Las que dicen «Revisa el recorte» pueden haber salido mal: tócalas para verlas.', 'The ones that say «Check the cut-out» may have come out wrong: tap them to see.')}</p>` : ''}
      ${nop ? `<p class="s-aviso-l">${nop === 1 ? t('Hay 1 foto que no coincide con ninguna categoría de prenda: no se guardará.', '1 photo does not match any clothing category: it will not be saved.') : t(`Hay ${nop} fotos que no coinciden con ninguna categoría de prenda: no se guardarán.`, `${nop} photos do not match any clothing category: they will not be saved.`)}</p>` : ''}
      <div class="bts"><button class="boton" data-sguardar ${listos ? '' : 'disabled'}>${listos === 1 ? t('Guardar 1 prenda', 'Save 1 garment') : t(`Guardar ${listos} prendas`, `Save ${listos} garments`)}</button><span class="txt">${t('Toca una prenda para ver su ficha y cambiar nombre, tipo, color o estación', 'Tap a garment to open its card and change name, type, colour or season')}</span></div></div>`;
  }
  raiz.querySelectorAll('[data-sfotos]').forEach(inp => inp.onchange = e => { anadirFotos([...e.target.files]); e.target.value = ''; });
  raiz.onclick = async ev => {
    const b = ev.target.closest('[data-sdet],[data-svolver],[data-squita],[data-ssi],[data-sguardar],[data-stipo],[data-scolor],[data-sest],[data-sorig],[data-sgirar],[data-srecortar],[data-sestp],[data-scolor2],[data-sdeta]'); if (!b || b.disabled) return;
    const d = b.dataset, auto = det && det.nombre === nombreAuto(det.tipo, det.color), prev = det?.color;
    if (d.sdet) { E.sDet = d.sdet; pintarSubida(); raiz.scrollTop = 0; }
    else if (d.svolver !== undefined) { E.sDet = null; pintarSubida(); }
    else if (d.squita !== undefined) { E.subida = E.subida.filter(i => i !== det); E.sDet = null; pintarSubida(); }
    else if (d.ssi !== undefined) { det.siPrenda = true; pintarSubida(); }
    else if (d.sguardar !== undefined) guardarSubida();
    else if (d.scolor) { const c = catDe(det); det.color = d.scolor; if (det.x && NOMBRE_AUTO.test(det.nombre) && SUBCATS[c]?.includes(det.x)) det.nombre = nombreReconocido(det.x, det.color); else if (auto || (c === 'Faldas' && det.nombre === nombreSubida(Object.assign({}, det, { color: prev }), c))) det.nombre = nombreSubida(det, c); pintarSubida(); }
    else if (d.sest) { det.estacion = d.sest; pintarSubida(); }
    else if (d.sdeta) { const l = new Set(det.detalles || []); l.has(d.sdeta) ? l.delete(d.sdeta) : l.add(d.sdeta); det.detalles = [...l]; det.detaAbierto = true; pintarSubida(); }
    else if (d.sestp) { const propio = !NOMBRE_AUTO.test(det.nombre) && !/ (de rayas|de cuadros|de lunares|de flores|animal print|estampad[oa])$/.test(det.nombre); det.estampado = d.sestp; if (!propio && det.x && NOM_X[det.x]) det.nombre = nomEstampado(det.x, d.sestp, det.color2); pintarSubida(); }
    else if (d.scolor2) { const propio = !NOMBRE_AUTO.test(det.nombre) && !/ (de rayas|de cuadros|de lunares|de flores)( [a-záéíóú ]+)?$/.test(det.nombre); det.color2 = d.scolor2; if (!propio && det.x && NOM_X[det.x]) det.nombre = nomEstampado(det.x, det.estampado, det.color2); pintarSubida(); }
    // 06/11 (Gabriela: «el icono de recortar tiene que ser mientras estás subiendo, no después, porque me siguen saliendo los pies en un vestido negro corto»)
    else if (d.srecortar !== undefined) { if (det.usaOriginal) { const r = await recortarAMano(det.original); if (!r) return; det.original = r; det.recMano = 1; URL.revokeObjectURL(det.url); det.url = URL.createObjectURL(r); return pintarSubida(); }
      const q = await arreglarFoto(det.original, det.blob); if (!q) return; det.blob = q.blob; det.cv = q.cv; det.recMano = 1; if (q.dudoso) det.dudoso = 1; else delete det.dudoso; URL.revokeObjectURL(det.url); det.url = URL.createObjectURL(q.blob); pintarSubida(); }
    else if (d.sgirar !== undefined) { b.disabled = true; det.blob = await girarBlob(det.blob); if (det.original) det.original = await girarBlob(det.original); URL.revokeObjectURL(det.url); det.url = URL.createObjectURL(det.usaOriginal ? det.original : det.blob); pintarSubida(); }
    else if (d.sorig !== undefined) { det.usaOriginal = !det.usaOriginal; URL.revokeObjectURL(det.url); det.url = URL.createObjectURL(det.usaOriginal ? det.original : det.blob); pintarSubida(); }
  };
  const nom = raiz.querySelector('[data-snom]'); if (nom) nom.oninput = e => { det.nombre = e.target.value; };
  const dta = raiz.querySelector('[data-sdetabre]'); if (dta && det) dta.ontoggle = () => { det.detaAbierto = dta.open; };
  const sc = raiz.querySelector('[data-scat]'), ss = raiz.querySelector('[data-ssub]');
  // 06/11 (Gabriela: «una camisa rosa que no me deja cambiarle la clasificación y lo pone como tops rosa»): al elegir «Camisas y blusas» el nombre pasaba
  // a «Top rosa» y la categoría, que sale del nombre, volvía a Tops. Ahora la elegida se guarda (catM) y manda; el nombre automático toma el primer tipo de esa categoría
  if (sc) sc.onchange = e => { const c = e.target.value, propio = !NOMBRE_AUTO.test(det.nombre) && det.nombre !== nombreAuto(det.tipo, det.color), k0 = (SUBCATS[c] || []).find(k => NOM_X[k]); det.tipo = TIPO_DE_CAT[c]; det.catM = c; det.x = k0 || null; if (!propio) det.nombre = k0 ? nombreReconocido(k0, det.color) : nombreSubida(det, c); pintarSubida(); };
  if (ss) ss.onchange = e => { const k = e.target.value; if (!k) return; const propio = !NOMBRE_AUTO.test(det.nombre) && det.nombre !== nombreAuto(det.tipo, det.color); det.x = k; if (sc) det.catM = sc.value; if (!propio) det.nombre = nombreReconocido(k, det.color); pintarSubida(); };
}
// 09/11 (Gabriela: «recuerda todas las instrucciones que aprobamos con mi cuenta y deben cumplirse para el resto de cuentas que se abran»; en la cuenta de Sheila
// los bolsos marrones se llamaban «Bolso negro» y unos mocasines, «Bailarinas negras»): lo que la revisión de Moda corrigió a mano en sus prendas (nombre concreto,
// tipo, color, estampado, detalles, estación, tiro y largo) lo hace ahora el servidor con cada prenda (/api/clasificar, Gemini Flash, ≈ 0,002 $). Se pide mientras
// ella revisa la subida; lo que haya cambiado a mano no se toca. Sin cuenta o sin red se queda lo del reconocedor del móvil.
let clasParado = false;
const CLAS_LIBRES = ['nombre', 'tipo', 'color', 'estampado', 'color2', 'detalles', 'estacion', 'catM'];
const fotoClas = p => Object.fromEntries(CLAS_LIBRES.map(k => [k, JSON.stringify(p[k] ?? null)]));
const pon = (p, k, v) => { if (v == null || v === '') delete p[k]; else p[k] = v; };
const xDeNombre = (nom, cat) => { const n = nom.toLowerCase(); let x = null, l = 0; for (const k of SUBCATS[cat] || []) { const b = NOM_X[k]?.[0].toLowerCase(); if (b && b.length > l && (n === b || n.startsWith(b + ' '))) { x = k; l = b.length; } } return x; };
async function clasificarIA(fuente) {
  if (clasParado || !cuenta()?.token || !(fuente instanceof Blob)) return null;
  const u = URL.createObjectURL(fuente);
  try {
    const im = await cargaImg(u), e = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * e), h = Math.round(im.naturalHeight * e);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .88)); if (!b) return null;
    const r = await api('/api/clasificar', { method: 'POST', body: b, headers: { 'Content-Type': 'image/jpeg' }, tiempo: 30000 });
    if (r.status === 429 || r.status === 503 || r.status === 401) { clasParado = true; return null; } // tope del día o sin clave: otra vez en la próxima apertura
    if (!r.ok) return null;
    const o = await r.json(); return o && typeof o.nombre === 'string' && o.nombre && TIPO_DE_CAT[o.categoria] ? o : null;
  } catch (e) { return null; } finally { URL.revokeObjectURL(u); }
}
function aplicarClas(p, o, antes, subida) {
  const libre = k => !antes || JSON.stringify(p[k] ?? null) === antes[k];
  const tocado = ['nombre', 'tipo', 'color', 'estampado', 'color2', 'catM'].some(k => !libre(k)); // si cambió algo de esto a mano, el nombre y el tipo se quedan como los dejó
  const estp = ESTAMPADOS[o.estampado] ? o.estampado : null, color = estp ? 'Estampado' : COLORES.some(c => c[0] === o.color) ? o.color : null;
  if (!tocado) {
    p.tipo = TIPO_DE_CAT[o.categoria]; delete p.catM; if (subida) p.cat = o.categoria; // en la subida, «cat» es la categoría; en una prenda guardada es la foto de catálogo
    if (color) p.color = color;
    pon(p, 'estampado', estp); pon(p, 'color2', estp && COLORES.some(c => c[0] === o.color2) ? o.color2 : null);
    const x = xDeNombre(o.nombre, o.categoria); p.x = x;
    p.nombre = idioma() === 'en' ? (nombreReconocido(x, p.color) || nombreAuto(p.tipo, p.color)) : o.nombre;
  }
  if (libre('detalles')) pon(p, 'detalles', (o.detalles || []).filter(k => k in DETALLES).length ? o.detalles.filter(k => k in DETALLES) : null);
  if (libre('estacion') && ESTACIONES.includes(o.estacion)) p.estacion = o.estacion;
  const est = { ...(p.est || {}) };
  if (p.tipo === 'Abajo' && o.categoria === 'Pantalones' && ['alto', 'medio', 'bajo'].includes(o.tiro) && !est.tiro) est.tiro = o.tiro;
  if (p.tipo === 'Arriba' && ['crop', 'cintura', 'cadera', 'largo'].includes(o.largo) && !est.largo) est.largo = o.largo;
  if (Object.keys(est).length) p.est = est;
  if (subida) { if (o.es_prenda) p.noPrenda = false; else if (!p.siPrenda) p.noPrenda = true; p.rec = 1; }
  else { p.rec = 3; p.rev = 1; p.estAuto = 1; } // que los repasos viejos del reconocedor del móvil no lo deshagan
  p.clas = 1;
}
function clasificarSubida(it) {
  if (clasParado || !cuenta()?.token) return;
  const antes = fotoClas(it);
  it.clasP = clasificarIA(it.blob).then(o => {
    if (o && E.subida.includes(it)) aplicarClas(it, o, antes, true);
  }).finally(() => {
    delete it.clasP; if (E.pantalla !== 'subir' || !E.subida.includes(it)) return;
    const ae = document.activeElement; // si está escribiendo en la ficha, se repinta al salir del campo
    if (ae && $('s-raiz')?.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) ae.addEventListener('blur', () => setTimeout(pintarSubida, 0), { once: true }); else pintarSubida();
  });
}
// y una vez, solas, las prendas que se subieron antes de esto con el nombre que puso el reconocedor del móvil («Bolso negro»). Las que tienen un nombre propio,
// las revisadas por la estilista (est.sub) y las que ya pasaron por aquí (clas) no se tocan; en la cuenta de Gabriela, la revisión de Moda del 06/11 cuenta como hecha.
const BASES_AUTO = () => [...new Set(['Top', 'Pantalón', 'Zapatos', 'Vestido', 'Abrigo', 'Bolso', 'Accesorio', 'Falda', 'Chaleco', ...Object.values(NOM_X).map(v => v[0])])];
const formasColor = c => c === 'Estampado' ? ['estampado', 'estampada', 'estampados', 'estampadas'] : [0, 1].flatMap(f => [0, 1].map(pl => adjColor(c, f, pl)));
const nombreDeMaquina = p => /^(Tops|Arriba|Abajo|Calzado)$/.test(p.nombre || '') || p.nombre === nombreAuto(p.tipo, p.color) || BASES_AUTO().some(b => formasColor(p.color || 'Negro').some(a => p.nombre === b + ' ' + a));
// 11/11 (Sheila, mensaje 1996): con los colores nuevos, lo que ya dice el nombre («Top azul marino» guardado como Azul) pasa al color fino, en todas las cuentas;
// solo desde el color general que le corresponde y una vez por prenda (colAf), así se puede volver a cambiar a mano
const COLOR_AFINAR = [['Azul marino', ['Azul'], /azul marino|\bmarino\b|\bnavy\b|azul oscuro/], ['Azul eléctrico', ['Azul'], /electrico|\bklein\b|azulon|cobalto/],
  ['Azul petróleo', ['Azul', 'Verde'], /petroleo|\bteal\b/], ['Turquesa', ['Azul claro', 'Azul', 'Verde'], /turquesa|aguamarina/], ['Verde menta', ['Verde', 'Azul claro'], /\bmenta\b|\bmint\b|verde agua/],
  ['Verde salvia', ['Verde', 'Gris'], /salvia|\bsage\b/], ['Verde oliva', ['Verde', 'Caqui'], /\boliva\b|\bolive\b/], ['Verde botella', ['Verde'], /botella|esmeralda|verde oscuro/],
  ['Antracita', ['Gris', 'Negro'], /antracita|grafito|marengo|gris oscuro/], ['Gris claro', ['Gris', 'Blanco'], /gris claro|gris perla/], ['Chocolate', ['Marrón'], /chocolate/],
  ['Nude', ['Beige', 'Rosa', 'Crema'], /\bnude\b/], ['Fucsia', ['Rosa', 'Morado', 'Rojo'], /fucsia|magenta|buganvilla/], ['Coral', ['Rosa', 'Naranja', 'Rojo'], /\bcoral/],
  ['Melocotón', ['Rosa', 'Naranja', 'Beige'], /melocoton|\bpeach\b|albaricoque/], ['Mantequilla', ['Amarillo', 'Crema'], /mantequilla|\bbutter\b|amarillo pastel|vainilla/],
  ['Dorado', ['Amarillo', 'Mostaza', 'Beige'], /dorad|\bgold\b/], ['Plateado', ['Gris', 'Blanco'], /platead|\bplata\b|\bsilver\b/]];
async function afinarColores() {
  if (cuenta() && !E.nubeBajada) return 0;
  let n = 0;
  for (const p of E.prendas) {
    if (p.colAf || p.ejemplo || !p.color) continue;
    const nom = (p.nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const f = COLOR_AFINAR.find(([, de, re]) => de.includes(p.color) && re.test(nom)); if (!f) continue;
    p.color = f[0]; p.colAf = 1; n++;
  }
  if (n) { await guardar(); programarNube(); E.propuestas = []; E.generados = []; }
  return n;
}
// 11/11: la noche del 10 al 11 Google cortó la API por el tope de gasto y cada prenda sin foto de catálogo sumó dos fallos (catFallos), con lo que
// estilizarNuevas ya no las volvía a intentar nunca. Una vez por móvil se borran esos fallos; desde ahora un corte así responde 503 «pausa» y no cuenta.
async function soltarFallosCatalogo() {
  if (cuenta() && !E.nubeBajada) return 0;
  if (LS.get('tc_catf') === '1111') return 0;
  let n = 0;
  for (const p of E.prendas) if (p.catFallos && !p.cat && !p.conCat) { delete p.catFallos; n++; }
  LS.set('tc_catf', '1111');
  if (n) { await guardar(); programarNube(); }
  return n;
}
let clasificando = null;
function clasificarViejas() {
  if (clasificando) return clasificando;
  if (clasParado || !cuenta()?.token || window.top !== window || !E.nubeBajada) return Promise.resolve(0);
  clasificando = (async () => {
    let n = 0;
    try {
      for (const p of E.prendas.filter(p => !p.clas && !p.ejemplo && !p.src && !p.est?.sub && p.foto instanceof Blob && !p.fotoRota && nombreDeMaquina(p))) {
        await new Promise(r => (window.requestIdleCallback || setTimeout)(r, { timeout: 800 }));
        const o = await clasificarIA(p.foto); if (clasParado) break; if (!o) continue;
        if (o.es_prenda) { aplicarClas(p, o, null, false); n++; } else p.clas = 1;
      }
    } finally { clasificando = null; }
    if (n) { await guardar(); programarNube(); E.propuestas = []; E.generados = []; cuandoQuieto(() => { if (E.pantalla === 'closet') pintarCloset(); else if (E.pantalla === 'hoy') pintarHoy(); }); toast(t(`He revisado ${n} ${n === 1 ? 'prenda' : 'prendas'}: nombre, color y detalles al día`, `I checked ${n} garment${n === 1 ? '' : 's'}: name, colour and details updated`)); }
    return n;
  })();
  return clasificando;
}
async function anadirFotos(files) {
  const nuevos = files.slice(0, Math.max(0, 20 - E.subida.length)).map(f => ({ id: uid(), estado: 'procesando', file: f }));
  if (!nuevos.length) return toast(t('Como mucho 20 fotos cada vez', 'At most 20 photos at a time'));
  E.subida.push(...nuevos); pintarSubida();
  for (const it of nuevos) {
    try { const r = await procesarPrenda(it.file); Object.assign(it, r, { estado: 'listo', url: URL.createObjectURL(r.blob), nombre: nombreReconocido(r.x, r.color) || (r.cat ? nombreSubida(r, r.cat) : nombreAuto(r.tipo, r.color)) }); it.estacion = estacionPorPrenda(it); delete it.file; clasificarSubida(it); }
    catch (e) { E.subida = E.subida.filter(x => x !== it); toast(t('No he podido leer una de las fotos', 'Could not read one of the photos')); }
    pintarSubida();
  }
}
async function guardarSubida() {
  const pend = E.subida.map(i => i.clasP).filter(Boolean);
  if (pend.length) { if (E.guardandoSub) return; E.guardandoSub = 1; toast(t('Un momento: termino de revisar tus prendas', 'One moment: finishing checking your garments')); try { await Promise.race([Promise.all(pend), new Promise(r => setTimeout(r, 25000))]); } finally { E.guardandoSub = 0; } }
  const listos = E.subida.filter(i => i.estado === 'listo' && !(i.noPrenda && !i.siPrenda)); if (!listos.length) return;
  if (enGratis() && E.prendas.length + listos.length > TOPE_GRATIS) return toast(t(`En la versión gratis caben ${TOPE_GRATIS} prendas: te quedan ${Math.max(0, TOPE_GRATIS - E.prendas.length)}.`, `The free version holds ${TOPE_GRATIS} garments: ${Math.max(0, TOPE_GRATIS - E.prendas.length)} left.`));
  listos.forEach(it => { if (it.detalles?.length) it.notas = it.detalles.join(', ').toLowerCase().replace(/^./, c => c.toUpperCase()); });
  listos.forEach(it => E.prendas.unshift({ id: uid(), rec: it.rec ? 3 : 0, nombre: it.nombre.trim() || tipoNombre(it.tipo), color: it.color, tipo: it.tipo, estacion: it.estacion || 'Todo el año', estAuto: 1, catAuto: 1, notas: it.notas || '', foto: it.usaOriginal ? it.original : it.blob, creada: hoyISO(), usos: [], estado: '', x: it.x || null, original: it.original || undefined, rev: 1, cv: it.usaOriginal ? 5 : it.cv || 1, recMano: it.recMano || undefined, detalles: it.detalles?.length ? it.detalles : undefined, catM: it.catM || undefined, estampado: it.estampado || undefined, color2: it.color2 || undefined, dudoso: it.dudoso && !it.usaOriginal ? 1 : undefined, clas: it.clas || undefined, est: it.est && Object.keys(it.est).length ? { ...it.est } : undefined })); // est: tiro o largo marcados en «¿Me lo compro?»
  await guardar(); E.propuestas = []; E.generados = []; E.subida = []; E.sDet = null;
  revisarRepetidas().then(n => { if (n) setTimeout(abrirRepetidas, 600); }).catch(() => { }); setTimeout(estilizarNuevas, 1500);
  toast(t(`${listos.length} ${listos.length === 1 ? 'prenda guardada' : 'prendas guardadas'} en tu clóset`, `${listos.length} saved to your closet`)); ir('closet'); setTimeout(enderezarTodas, 2500);
}

/* ---------- AÑADIR / EDITAR ---------- */
let fotoNueva = null, fotoOriginal = null;
// 0.59 (Sheila, 23/10: «cuando edito la foto debe tener la opción de recortarla»): en la ficha, «Recortar» (marco a mano) y «Quitar el fondo»;
// la foto sin tocar se guarda aparte para poder volver a ella
async function fotoActual() { const p = E.editando; if (fotoNueva) return fotoNueva; if (p?.foto) return p.foto; if (p?.src) return (await fetch(p.src)).blob(); return null; }
function pintarHerr() {
  const h = $('an-herr'); if (!h) return; const hay = !!(fotoNueva || E.editando?.foto || E.editando?.src), orig = fotoOriginal || E.editando?.original;
  h.innerHTML = hay ? `<button type="button" class="txt sub-l" id="an-recortar">${t('Recortar', 'Crop')}</button><button type="button" class="txt sub-l" id="an-enderezar">${t('Enderezar', 'Straighten')}</button><button type="button" class="txt sub-l" id="an-fondo">${t('Quitar el fondo', 'Remove background')}</button>${orig ? `<button type="button" class="txt sub-l" id="an-orig">${t('Volver a la original', 'Back to original')}</button>` : ''}` : '';
  if (!hay) return;
  $('an-recortar').onclick = async () => { const b = await fotoActual(); if (!b) return; const r = await recortarAMano(b); if (!r) return; E.recManoEdit = 1; if (!fotoOriginal && !E.editando?.original) fotoOriginal = b; fotoNueva = r; pintarPrevia(URL.createObjectURL(r)); };
  $('an-enderezar').onclick = async () => { const b = await fotoActual(); if (!b) return; const r = await enderezar(b); if (!r) return; if (!fotoOriginal && !E.editando?.original) fotoOriginal = b; fotoNueva = r; pintarPrevia(URL.createObjectURL(r)); };
  $('an-fondo').onclick = async () => {
    const b = await fotoActual(); if (!b) return; const bt = $('an-fondo'); bt.disabled = true; bt.textContent = t('Quitando el fondo…', 'Removing background…');
    try { const r = await procesarPrenda(b); if (!fotoOriginal && !E.editando?.original) fotoOriginal = b; fotoNueva = r.blob; pintarPrevia(URL.createObjectURL(r.blob)); toast(t('Fondo quitado. Guarda para conservarlo', 'Background removed. Save to keep it')); }
    catch (e) { toast(t('No he podido quitar el fondo', 'Could not remove the background')); pintarHerr(); }
  };
  if ($('an-orig')) $('an-orig').onclick = () => { fotoNueva = orig; pintarPrevia(URL.createObjectURL(orig)); };
}
// 0.64 (Sheila, 23/10: «debería haber una función para enderezar prenda»): propone el giro solo (eje principal de la prenda sobre el fondo claro)
// y se ajusta con una barra, de -45° a 45°, más «Girar 90°»; el resultado se recorta a la prenda sobre blanco
function anguloPrenda(img) {
  const S = 160, c = document.createElement('canvas'), e = S / Math.max(img.naturalWidth, img.naturalHeight); c.width = Math.round(img.naturalWidth * e); c.height = Math.round(img.naturalHeight * e);
  const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0, mx = 0, my = 0; const pts = [];
  for (let i = 0, k = 0; k < d.length; i++, k += 4) if (d[k] + d[k + 1] + d[k + 2] < 690) { const px = i % c.width, py = (i / c.width) | 0; pts.push(px, py); mx += px; my += py; n++; }
  if (n < 50) return 0; mx /= n; my /= n; let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < pts.length; i += 2) { const a = pts[i] - mx, b = pts[i + 1] - my; sxx += a * a; syy += b * b; sxy += a * b; }
  const tr = sxx + syy, di = Math.sqrt((sxx - syy) ** 2 + 4 * sxy * sxy); if ((tr + di) / Math.max(1, tr - di) < 1.35) return 0; // casi cuadrada: no hay eje claro, mejor no adivinar
  let ang = .5 * Math.atan2(2 * sxy, sxx - syy) * 180 / Math.PI; // eje principal respecto a la horizontal
  ang = syy >= sxx ? ang - Math.sign(ang || 1) * 90 : ang;           // prenda alargada: se lleva a vertical; ancha: a horizontal
  return Math.abs(ang) > 30 || Math.abs(ang) < 2 ? 0 : -ang;
}
function enderezar(blob) {
  return new Promise(res => {
    const u = URL.createObjectURL(blob), cap = document.createElement('div'); cap.className = 'rc-capa';
    cap.innerHTML = `<p class="mini-et">${t('Gira hasta que la prenda quede recta', 'Rotate until the garment is straight')}</p><div class="rc-zona en-zona"><img src="${u}" alt=""><i class="en-guia"></i></div>
      <div class="en-ctrl"><input type="range" min="-45" max="45" step="0.5" value="0" aria-label="${t('Giro', 'Rotation')}"><span class="en-grados">0°</span><button class="txt sub-l" data-en="90">${t('Girar 90°', 'Rotate 90°')}</button></div>
      <div class="rc-bts"><button class="boton" data-en="ok">${t('Enderezar', 'Straighten')}</button><button class="txt sub-l" data-en="no">${t('Cancelar', 'Cancel')}</button></div>`;
    document.body.appendChild(cap);
    const img = cap.querySelector('img'), rg = cap.querySelector('input'), gr = cap.querySelector('.en-grados'); let base = 0;
    const pinta = () => { img.style.transform = `rotate(${base + +rg.value}deg)`; gr.textContent = `${(+rg.value).toLocaleString()}°`; };
    img.onload = () => { rg.value = anguloPrenda(img); pinta(); };
    rg.oninput = pinta;
    cap.onclick = e => {
      const b = e.target.closest('[data-en]'); if (!b) return; const k = b.dataset.en;
      if (k === '90') { base = (base + 90) % 360; return pinta(); }
      if (k === 'no') { cap.remove(); URL.revokeObjectURL(u); return res(null); }
      const a = (base + +rg.value) * Math.PI / 180, W = img.naturalWidth, H = img.naturalHeight, cw = Math.ceil(Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a))), ch = Math.ceil(Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a)));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch); x.translate(cw / 2, ch / 2); x.rotate(a); x.drawImage(img, -W / 2, -H / 2); x.setTransform(1, 0, 0, 1, 0, 0);
      // se recorta a la prenda (lo que no es casi blanco) con un margen
      const d = x.getImageData(0, 0, cw, ch).data; let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
      for (let i = 0, q = 0; q < d.length; i++, q += 4) if (d[q] + d[q + 1] + d[q + 2] < 735) { const px = i % cw, py = (i / cw) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
      let o = c; if (x1 > x0 && y1 > y0) { const m = Math.round(Math.max(x1 - x0, y1 - y0) * .06); x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(cw - 1, x1 + m); y1 = Math.min(ch - 1, y1 + m);
        o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; const ox = o.getContext('2d'); ox.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); }
      o.toBlob(bl => { cap.remove(); URL.revokeObjectURL(u); res(bl); }, 'image/jpeg', .9);
    };
  });
}
// marco con cuatro esquinas sobre la foto; devuelve el trozo elegido como JPEG
// 06/11 (Gabriela: «el botón girar y recortar en las prendas que aún no se han estilizado no lo entiendo, funciona mal»): «Recortar» cortaba un rectángulo de la foto
// ya sin fondo y la guardaba con fondo blanco (de ahí el cuadrado blanco en los looks). Ahora es un solo paso: se marca la prenda sobre la foto ORIGINAL y se le vuelve a
// quitar el fondo (servidor). Devuelve lo de procesarPrenda, o null si se cancela.
async function arreglarFoto(original, actual) {
  const r = await recortarAMano(original instanceof Blob ? original : actual, t('Marca solo la prenda: deja fuera los pies, la cama y lo demás', 'Frame only the garment: leave out feet, bed and everything else')); if (!r) return null;
  toast(t('Quitando el fondo…', 'Removing the background…'));
  return procesarPrenda(r, { sinReconocer: true });
}
function recortarAMano(blob, titulo) {
  return new Promise(res => {
    const u = URL.createObjectURL(blob), cap = document.createElement('div'); cap.className = 'rc-capa';
    cap.innerHTML = `<p class="mini-et">${titulo || t('Ajusta el marco a la prenda', 'Fit the frame to the garment')}</p><div class="rc-zona"><img src="${u}" alt=""><div class="rc-marco"><i data-c="tl"></i><i data-c="tr"></i><i data-c="bl"></i><i data-c="br"></i></div></div><div class="rc-bts"><button class="boton" data-rc="ok">${t('Recortar', 'Crop')}</button><button class="txt sub-l" data-rc="no">${t('Cancelar', 'Cancel')}</button></div>`;
    document.body.appendChild(cap);
    const img = cap.querySelector('img'), m = cap.querySelector('.rc-marco'); let r = null;
    const pinta = () => Object.assign(m.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    img.onload = () => { r = { x: img.offsetLeft, y: img.offsetTop, w: img.width, h: img.height }; pinta(); }; // 06/11: empieza con la foto entera (antes un 8 % hacia dentro: si se aceptaba sin tocar, cortaba la prenda)
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
// 0.110 · Tiro con dibujos al subir o editar un pantalón o una falda (Gabriela, 28/10: «11. sí, pero un dibujo mejor, eso parece prehistórico»).
// Saltable: si no se marca, la app lo deduce del nombre
const TIRO_SVG = {"alto": "<svg viewBox=\"0 30 160 216\" role=\"img\" aria-label=\"Tiro alto\"> <path d=\"M47 10 C50 35 58 50 58 62 C58 82 41 100 41 120 C41 160 45 200 47 240 M113 10 C110 35 102 50 102 62 C102 82 119 100 119 120 C119 160 115 200 113 240\" fill=\"none\" stroke=\"#CDBFB0\" stroke-width=\"1\" stroke-linecap=\"round\"/> <path d=\"M55.6 58 C54.1 88.6 38.5 98.8 38.5 126 C38.5 165 41 205 42.5 240 L77.5 240 L80 152 L82.5 240 L117.5 240 C119 205 121.5 165 121.5 126 C121.5 98.8 105.9 88.6 104.4 58 Z\" fill=\"#FBF8F3\" stroke=\"#4A3526\" stroke-width=\"1.15\" stroke-linejoin=\"round\"/> <path d=\"M56.0 65 L104.0 65M64.6 58 V66.5M65.0 58 V66.5M95.0 58 V66.5M95.4 58 V66.5M80 65 V91 Q80 97 73.5 99M63.1 65 Q70.6 78 58.1 90 M96.9 65 Q89.4 78 101.9 90\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".85\" stroke-linecap=\"round\"/> <path d=\"M59.5 168 L60.5 238 M100.5 168 L99.5 238\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".5\" stroke-opacity=\".3\"/> <circle cx=\"80\" cy=\"61.5\" r=\"1.5\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".75\"/> <circle cx=\"80\" cy=\"68\" r=\"2.2\" fill=\"#C9A24B\"/> </svg>", "medio": "<svg viewBox=\"0 30 160 216\" role=\"img\" aria-label=\"Tiro medio\"> <path d=\"M47 10 C50 35 58 50 58 62 C58 82 41 100 41 120 C41 160 45 200 47 240 M113 10 C110 35 102 50 102 62 C102 82 119 100 119 120 C119 160 115 200 113 240\" fill=\"none\" stroke=\"#CDBFB0\" stroke-width=\"1\" stroke-linecap=\"round\"/> <path d=\"M51.5 80 C50.0 100.7 38.5 107.6 38.5 126 C38.5 165 41 205 42.5 240 L77.5 240 L80 152 L82.5 240 L117.5 240 C119 205 121.5 165 121.5 126 C121.5 107.6 110.0 100.7 108.5 80 Z\" fill=\"#FBF8F3\" stroke=\"#4A3526\" stroke-width=\"1.15\" stroke-linejoin=\"round\"/> <path d=\"M51.9 87 L108.1 87M60.5 80 V88.5M65.0 80 V88.5M95.0 80 V88.5M99.5 80 V88.5M80 87 V113 Q80 119 73.5 121M59.0 87 Q66.5 100 54.0 112 M101.0 87 Q93.5 100 106.0 112\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".85\" stroke-linecap=\"round\"/> <path d=\"M59.5 168 L60.5 238 M100.5 168 L99.5 238\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".5\" stroke-opacity=\".3\"/> <circle cx=\"80\" cy=\"83.5\" r=\"1.5\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".75\"/> <circle cx=\"80\" cy=\"68\" r=\"2.2\" fill=\"#C9A24B\"/> </svg>", "bajo": "<svg viewBox=\"0 30 160 216\" role=\"img\" aria-label=\"Tiro bajo\"> <path d=\"M47 10 C50 35 58 50 58 62 C58 82 41 100 41 120 C41 160 45 200 47 240 M113 10 C110 35 102 50 102 62 C102 82 119 100 119 120 C119 160 115 200 113 240\" fill=\"none\" stroke=\"#CDBFB0\" stroke-width=\"1\" stroke-linecap=\"round\"/> <path d=\"M43.5 100 C42.0 111.7 38.5 115.6 38.5 126 C38.5 165 41 205 42.5 240 L77.5 240 L80 152 L82.5 240 L117.5 240 C119 205 121.5 165 121.5 126 C121.5 115.6 118.0 111.7 116.5 100 Z\" fill=\"#FBF8F3\" stroke=\"#4A3526\" stroke-width=\"1.15\" stroke-linejoin=\"round\"/> <path d=\"M43.9 107 L116.1 107M52.5 100 V108.5M65.0 100 V108.5M95.0 100 V108.5M107.5 100 V108.5M80 107 V133 Q80 139 73.5 141M51.0 107 Q58.5 120 46.0 132 M109.0 107 Q101.5 120 114.0 132\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".85\" stroke-linecap=\"round\"/> <path d=\"M59.5 168 L60.5 238 M100.5 168 L99.5 238\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".5\" stroke-opacity=\".3\"/> <circle cx=\"80\" cy=\"103.5\" r=\"1.5\" fill=\"none\" stroke=\"#4A3526\" stroke-width=\".75\"/> <circle cx=\"80\" cy=\"68\" r=\"2.2\" fill=\"#C9A24B\"/> </svg>"};
function pintarTiro(sel) {
  const c = $('an-tiro'); c.dataset.sel = sel || '';
  c.innerHTML = [['alto', t('Alto', 'High')], ['medio', t('Medio', 'Mid')], ['bajo', t('Bajo', 'Low')]].map(([k, n]) => `<button type="button" data-tiro="${k}" class="${k === sel ? 'sel' : ''}">${TIRO_SVG[k]}<span>${n}</span></button>`).join('');
  $('an-tiro-c').classList.toggle('oculto', TIPO_DE_CAT[$('an-tipo').value] !== 'Abajo');
}
// detalles también al editar (06/11: las prendas ya subidas se marcan de deporte, vaqueras, de encaje…)
const detaEd = () => { const l = JSON.parse($('an-deta')?.dataset.sel || '[]'); return l.length ? l : undefined; };
function pintarDetaEd(sel) {
  const c = $('an-deta'); if (!c) return; c.dataset.sel = JSON.stringify(sel || []); $('an-deta-t').textContent = t('Detalles', 'Details');
  c.innerHTML = Object.keys(DETALLES).map(k => `<button type="button" data-adeta="${k}" class="${(sel || []).includes(k) ? 'on' : ''}" aria-pressed="${(sel || []).includes(k)}">${t(k, DETALLES[k])}</button>`).join('');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-adeta]'); if (!b) return; const l = new Set(JSON.parse($('an-deta').dataset.sel || '[]')); l.has(b.dataset.adeta) ? l.delete(b.dataset.adeta) : l.add(b.dataset.adeta); pintarDetaEd([...l]); });
document.addEventListener('click', e => { const b = e.target.closest('[data-tiro]'); if (!b) return; pintarTiro($('an-tiro').dataset.sel === b.dataset.tiro ? '' : b.dataset.tiro); });
// el largo de lo de arriba (Gabriela, 03/11: «la clasificación de las prendas en plan tops por encima del ombligo»): el mismo cuerpo, el punto dorado en el ombligo y el bajo de la prenda a cuatro alturas
const LARGO_Y = { crop: 70, cintura: 92, cadera: 116, largo: 138 };
const largoSVG = k => `<svg viewBox="0 0 120 150" role="img" aria-hidden="true"><path d="M52 4v13Q40 21 29 25Q23 48 29 68Q37 79 37 86Q31 101 31 119V150M68 4v13Q80 21 91 25Q97 48 91 68Q83 79 83 86Q89 101 89 119V150" fill="none" stroke="#CDBFB0" stroke-width="1" stroke-linecap="round"/><path d="M48 19Q60 27 72 19L91 26L99 50L89 53L85 42V${LARGO_Y[k]}H35V42L31 53L21 50L29 26Z" fill="#FBF8F3" stroke="#4A3526" stroke-width="1.15" stroke-linejoin="round"/><circle cx="60" cy="84" r="2.4" fill="#C9A24B"/></svg>`;
function pintarLargo(sel) {
  const c = $('an-largo'); if (!c) return; c.dataset.sel = sel || '';
  c.innerHTML = [['crop', t('Sobre el ombligo', 'Above the navel')], ['cintura', t('A la cintura', 'At the waist')], ['cadera', t('A la cadera', 'At the hip')], ['largo', t('Más abajo', 'Longer')]].map(([k, n]) => `<button type="button" data-largo="${k}" class="${k === sel ? 'sel' : ''}">${largoSVG(k)}<span>${n}</span></button>`).join('');
  $('an-largo-c').classList.toggle('oculto', TIPO_DE_CAT[$('an-tipo').value] !== 'Arriba');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-largo]'); if (!b) return; pintarLargo($('an-largo').dataset.sel === b.dataset.largo ? '' : b.dataset.largo); });
function prepararAnadir(id) {
  E.editando = id ? P(id) : null; fotoNueva = null; fotoOriginal = null;
  const p = E.editando;
  $('an-titulo').textContent = p ? t('Editar prenda', 'Edit garment') : t('Nueva prenda', 'New garment');
  $('an-borrar').classList.toggle('oculto', !p);
  $('an-guardar').textContent = p ? t('Guardar cambios', 'Save changes') : t('Guardar en mi clóset', 'Save to my closet');
  $('an-otra').classList.toggle('oculto', !!p);
  const cat0 = p ? catDe(p) : 'Tops'; $('an-tipo').innerHTML = opsCat(cat0); $('an-sub').innerHTML = opsSub(cat0, p ? subDe(cat0, p.x, p.nombre) : '');
  $('an-tipo').onchange = () => { $('an-sub').innerHTML = opsSub($('an-tipo').value, ''); pintarTiro($('an-tiro').dataset.sel); pintarLargo($('an-largo')?.dataset.sel); };
  $('an-sub').onchange = () => { const k = $('an-sub').value, n = $('an-nombre').value.trim(); if (k && (!n || NOMBRE_AUTO.test(n))) $('an-nombre').value = nombreReconocido(k, $('an-colores').dataset.sel || 'Negro'); };
  $('an-estacion').innerHTML = ESTACIONES.map(x => `<option value="${x}">${estNombre(x)}</option>`).join('');
  pintarDetaEd(p?.detalles || []);
  $('an-nombre').value = p?.nombre || ''; $('an-estacion').value = p?.estacion || 'Todo el año'; $('an-notas').value = p?.notas || ''; $('an-precio').value = p?.precio ? dinero(p.precio) : '';
  pintarColores(p?.color || '');
  pintarPrevia(p ? urlFoto(p) : '');
  pintarTiro(p?.est?.tiro || '');
  pintarLargo(p?.est?.largo || '');
}
function pintarColores(sel) {
  $('an-colores').innerHTML = COLORES.map(([n, c]) => `<button type="button" data-color="${n}" class="${n === sel ? 'sel' : ''}" title="${nomColor(n)}" aria-label="${nomColor(n)}" aria-pressed="${n === sel}" style="background:${c}"></button>`).join('')
    + `<p class="col-nom" aria-live="polite">${sel ? nomColor(sel) : t('Elige su color', 'Pick its colour')}</p>`;
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
  const p = E.editando; const nombre = $('an-nombre').value.trim(); const color = $('an-colores').dataset.sel || 'Gris', colorAntes = p?.color, conFotoNueva = !!fotoNueva;
  if (!p && !fotoNueva) return toast(t('Falta la foto de la prenda', 'The garment photo is missing'));
  if (!nombre) return toast(t('Ponle un nombre', 'Give it a name'));
  const tipo = TIPO_DE_CAT[$('an-tipo').value], x = $('an-sub').value || null;
  if (!p && enGratis() && E.prendas.length >= TOPE_GRATIS) return toast(t(`En la versión gratis caben ${TOPE_GRATIS} prendas.`, `The free version holds ${TOPE_GRATIS} garments.`));
  if (p) { if (fotoOriginal && !p.original) p.original = fotoOriginal; Object.assign(p, { rec: 3, estAuto: 1, nombre, color, tipo, x, catM: $('an-tipo').value, estacion: $('an-estacion').value, notas: $('an-notas').value.trim(), precio: precioDe($('an-precio').value), detalles: detaEd() }); if (fotoNueva) { quitarCat(p); p.foto = fotoNueva; delete p.src; delete p.fotoRota; delete p.caja; urls.delete(p.id), alfa.delete(p.id); for (const k of ['catProp', 'catPropAR', 'catNo', 'catOtra', 'catFallos']) delete p[k]; p.catAuto = 1; } }
  else E.prendas.unshift({ id: uid(), rec: 3, estAuto: 1, catAuto: 1, original: fotoOriginal || undefined, nombre, color, tipo, x, catM: $('an-tipo').value, estacion: $('an-estacion').value, notas: $('an-notas').value.trim(), precio: precioDe($('an-precio').value), detalles: detaEd(), foto: fotoNueva, creada: hoyISO(), usos: [], estado: '' });
  const tiro = tipo === 'Abajo' && $('an-tiro').dataset.sel, pr = p || E.prendas[0]; if (tiro) pr.est = { ...(pr.est || {}), tiro };
  if (E.recManoEdit && fotoNueva) pr.recMano = 1; E.recManoEdit = 0; // recortada a mano: el repaso automático del recorte no la toca
  const largo = tipo === 'Arriba' && $('an-largo')?.dataset.sel; if (largo) pr.est = { ...(pr.est || {}), largo };
  await guardar(); E.propuestas = [];
  const recolor = p && !conFotoNueva && colorAntes && colorAntes !== color && color !== 'Estampado' && p.cat instanceof Blob;
  toast(p ? t('Cambios guardados', 'Changes saved') : t('Guardada en tu clóset', 'Saved to your closet'), recolor ? [t('Cambiar la foto', 'Change the photo'), () => recolorCat(p)] : undefined);
  if (!p) revisarRepetidas().then(n => { if (n) setTimeout(abrirRepetidas, 900); }).catch(() => { }); setTimeout(estilizarNuevas, 1500);
  if (otra) prepararAnadir(null); else ir(p ? 'ficha' : 'closet', p?.id), p && abrirFicha(p.id);
}

/* ---------- FICHA ---------- */
// 0.105 · Precio y coste por puesta (Gabriela, 18/10: «7 sí» al orden de la 0.6). Opcional; el coste baja con cada puesta.
const precioDe = s => { const n = parseFloat(String(s || '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')); return n > 0 ? Math.round(n * 100) / 100 : undefined; };
const dinero = n => n.toLocaleString(idioma() === 'en' ? 'en-GB' : 'es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
function abrirFicha(id) {
  const p = P(id); if (!p) return;
  $('f-cat').textContent = catTxt(catDe(p)); $('f-img').src = urlFoto(p); $('f-nombre').textContent = p.nombre;
  // 0.107 · Ficha F7 «Hoja de sastre» (Gabriela, 28/10: «1. F7»; «la letra donde dice 20 octubre… pon todo homogéneo»): título, cuándo te la
  // pusiste en una línea y los datos en filas con puntos guía, todo en la misma letra
  const usos = p.usos || [], conj = E.conjuntos.filter(c => c.ids.includes(id)), es = p.est || {}, ult = usos[usos.length - 1];
  $('f-uso').textContent = !usos.length ? t('aún sin estrenar', 'not worn yet') : usos.length === 1 ? `${t('puesta una vez · el', 'worn once · on')} ${fecha(ult)}` : `${t('puesta', 'worn')} ${veces(usos.length)} · ${t('la última, el', 'last on')} ${fecha(ult)}`;
  const may = s => s ? String(s).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : '';
  const filas = [[t('Prenda', 'Garment'), (NOM_X[p.x] || [])[idioma() === 'en' ? 1 : 0] || catTxt(catDe(p))], [t('Color', 'Colour'), p.color],
    p.tipo === 'Abajo' && es.tiro && [t('Tiro', 'Rise'), may(es.tiro)], p.tipo === 'Abajo' && es.corte && [t('Corte', 'Cut'), may(es.corte)],
    p.tipo !== 'Abajo' && es.largo && [t('Largo', 'Length'), may(es.largo)], [t('Estación', 'Season'), estNombre(p.estacion)], p.notas && [t('Notas', 'Notes'), p.notas],
    p.precio && [t('Precio', 'Price'), dinero(p.precio)], p.precio && usos.length && [t('Cada puesta', 'Per wear'), dinero(p.precio / usos.length)], [t('En tus looks', 'In your outfits'), conj.length]].filter(Boolean);
  $('f-datos').innerHTML = filas.map(([k, v]) => `<div><dt>${k}</dt><span class="pun"></span><dd>${String(v).replace(/</g, '&lt;')}</dd></div>`).join('');
  $('f-estado').classList.toggle('oculto', !p.estado); $('f-estado').textContent = estadoTxt(p.estado);
  const conAvatar = planDemo() === 'pro' ? conj.find(c => c.img) : null; const primero = conj[0];
  $('f-asi').innerHTML = conAvatar ? `<div class="puesta"><img src="${conAvatar.img}" alt=""><div class="pie">${conAvatar.nombre}</div></div>` : primero ? `<div class="puesta">${maniqui(primero.ids.map(P).filter(Boolean))}<div class="pie">${primero.nombre}</div></div>` : `<div class="vacio">${t('Aún no está en ningún conjunto. Añádela a uno o pulsa «Hoy llevo esto».', 'Not in any outfit yet. Add it to one or tap “Wearing this today”.')}</div>`;
  const acc = [['conjunto', t('Añadir a un conjunto', 'Add to an outfit')], ['lavar', p.estado === 'lavar' ? t('Ya está limpia', 'Clean again') : t('Está sucia: que no salga en los looks', 'In the wash: keep it out of looks')], ['guardada', p.estado === 'guardada' ? t('Volver a sacarla', 'Bring it back out') : t('Guardar hasta la próxima estación', 'Store until next season')], ['donar', p.estado === 'donar' ? t('Me la quedo', 'Keeping it') : t('Donar o vender', 'Donate or sell')]];
  acc.splice(acc.findIndex(([k]) => k === 'donar') + 1, 0, ['donde', t('Dónde donarla cerca', 'Where to donate it nearby')]);
  if (p.tipo !== 'Accesorios' && planDemo() === 'pro') acc.unshift(['partido', t('Sácale partido', 'Make the most of it')]); // 0.107: en el Pro (Gabriela, 28/10: «sácale partido, sí»)
  if (p.foto) acc.push(['girar', t('Girar la foto', 'Rotate the photo')]);
  $('f-acciones').innerHTML = acc.map(([k, v]) => `<button class="item" data-accion="${k}">${v}<svg><use href="#ic-flecha"/></svg></button>`).join('');
  $('f-acciones').querySelectorAll('[data-accion]').forEach(b => b.onclick = async () => {
    const k = b.dataset.accion;
    if (k === 'conjunto') return ir('nuevo-look', [id]);
    if (k === 'partido') return sacalePartido(p);
    if (k === 'donde') return donarCerca();
    if (k === 'girar') { p.foto = await girarBlob(p.foto); if (p.original) p.original = await girarBlob(p.original); urls.delete(p.id); alfa.delete(p.id); p.caja = null; await guardar(); E.propuestas = []; return abrirFicha(id); }
    p.estado = p.estado === k ? '' : k; await guardar(); E.propuestas = []; abrirFicha(id); toast(p.estado ? estadoTxt(p.estado) : t('De vuelta al clóset', 'Back in the closet'));
  });
  $('f-hoy').onclick = () => ponerse([id]).then(() => abrirFicha(id));
  $('f-editar').onclick = () => ir('anadir', id);
  $('f-nota').textContent = `${t('Añadida el', 'Added on')} ${fecha(p.creada)}${p.ejemplo ? ' · ' + t('prenda de ejemplo', 'sample garment') : ''}`;
  ir('ficha');
}

// 0.140 · Dónde donar cerca (Gabriela, 03/11: «para saber los puntos de donación cerca debes enlazar con Google Maps, para eso igual pides ubicación,
// siempre que el usuario pueda claro»). Cada fila abre Google Maps con esa búsqueda. La ubicación solo se pide si la usuaria pulsa «Usar mi ubicación»
// (o si ya la dio antes en el navegador); se redondea (~100 m), va solo en el enlace de Google Maps y no se guarda. Sin ella, Google Maps busca por su cuenta.
// (Se probó OpenStreetMap para listar los puntos dentro de la app: sus servidores no respondían en 20 s, el 03/11; no es fiable para esto.)
function donarCerca() {
  const cap = document.createElement('div'); cap.className = 'ay-capa dn-capa'; let pos = null;
  const QS = [[t('Contenedores de ropa', 'Clothing banks'), t('contenedor de ropa', 'clothing donation bin')], [t('Tiendas solidarias', 'Charity shops'), t('tienda solidaria de ropa', 'charity shop')], [t('Segunda mano, para venderla', 'Second-hand, to sell it'), t('tienda de ropa de segunda mano', 'second hand clothing store')]];
  const url = q => pos ? `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${pos[0]},${pos[1]},15z` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + t(' cerca de mí', ' near me'))}`;
  const pinta = aviso => {
    cap.innerHTML = `<button class="x" aria-label="${t('Cerrar', 'Close')}"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></svg></button><h1>${t('Donar cerca', 'Donate nearby')}</h1>
      <p class="dn-sub">${t('Elige qué buscar: se abre en Google Maps.', 'Choose what to look for: it opens in Google Maps.')}</p>
      <ul class="dn-lista">${QS.map(([n, q]) => `<li><a href="${url(q)}" target="_blank" rel="noopener">${n}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></a></li>`).join('')}</ul>
      ${pos ? `<p class="dn-nota">${t('Centrado en tu ubicación. No se guarda.', 'Centred on your location. It isn’t stored.')}</p>` : `<button class="dn-maps" data-dnubic>${t('Centrar en mi ubicación', 'Centre on my location')}</button>${aviso ? `<p class="dn-aviso">${aviso}</p>` : `<p class="dn-nota">${t('Opcional. Solo se usa para estos enlaces y no se guarda.', 'Optional. Only used for these links and never stored.')}</p>`}`}`;
    cap.querySelector('.x').onclick = () => cap.remove(); const u = cap.querySelector('[data-dnubic]'); if (u) u.onclick = ubicar;
  };
  const ubicar = () => {
    if (!navigator.geolocation) return pinta(t('Tu navegador no da la ubicación; Google Maps buscará por su cuenta.', 'Your browser gives no location; Google Maps will search on its own.'));
    navigator.geolocation.getCurrentPosition(c => { pos = [c.coords.latitude.toFixed(3), c.coords.longitude.toFixed(3)]; if (cap.isConnected) pinta(); },
      () => cap.isConnected && pinta(t('Sin permiso de ubicación: Google Maps buscará por su cuenta.', 'No location permission: Google Maps will search on its own.')), { timeout: 12000, maximumAge: 600000 });
  };
  document.body.appendChild(cap); pinta();
  navigator.permissions?.query({ name: 'geolocation' }).then(r => r.state === 'granted' && ubicar(), () => { });
}

// 0.65 · «Sácale partido» (Sheila, 23/10: «hay prendas que simplemente sientes que no le sacas su máximo potencial con nada de lo que hay en tu closet…
// una función muy objetiva y entrenada que te sugiera qué comprar para sacar un look top de esa prenda»; «Ok» a la propuesta):
// 1) los mejores looks que ya puedes hacer con ella; 2) la pieza que falta: se prueba cada tipo del catálogo en cada color junto a tu ropa,
// con las mismas reglas de colores, estilo y ocasión, y se cuenta cuántos looks buenos desbloquea. Solo el tipo de prenda, sin tiendas.
const LOOK_BUENO = 1.5;
const esBase = p => p.tipo === 'Vestidos' || (p.tipo === 'Arriba' && !esCapa(p)) || p.tipo === 'Abajo';
function combosCon(forz, pool) { // todos los looks que llevan las prendas forzadas
  const de = f => pool.filter(f), capas = forz.filter(x => x.tipo === 'Abrigo' || esCapa(x));
  const vest = forz.find(x => x.tipo === 'Vestidos'), ar = forz.find(x => x.tipo === 'Arriba' && !esCapa(x)), ab = forz.find(x => x.tipo === 'Abajo');
  let bases;
  if (vest) bases = ar || ab ? [] : [[vest]];
  else if (ar || ab) bases = (ar ? [ar] : de(x => x.tipo === 'Arriba' && !esCapa(x))).flatMap(a => (ab ? [ab] : de(x => x.tipo === 'Abajo')).map(b => [a, b]));
  else bases = [...de(x => x.tipo === 'Vestidos').map(v => [v]), ...de(x => x.tipo === 'Arriba' && !esCapa(x)).flatMap(a => de(x => x.tipo === 'Abajo').map(b => [a, b]))];
  const zf = forz.find(x => x.tipo === 'Calzado'), bf = forz.find(x => x.tipo === 'Bolsos');
  const zs = zf ? [zf] : de(x => x.tipo === 'Calzado'), bs = bf ? [bf] : [null, ...de(x => x.tipo === 'Bolsos')];
  const out = [];
  for (const b of bases) for (const z of (zs.length ? zs : [null])) for (const bo of bs) { const ps = [...b, ...capas, z, bo].filter(Boolean); out.push({ ps, pts: puntuar(ps), base: b.map(x => x.id).sort().join() }); }
  return out;
}
const COMPLEMENTA = { Arriba: ['Pantalones', 'Faldas', 'Zapatos', 'Bolsos', 'Abrigos'], Abajo: ['Tops', 'Zapatos', 'Bolsos', 'Abrigos'], Vestidos: ['Zapatos', 'Bolsos', 'Abrigos'],
  Abrigo: ['Tops', 'Pantalones', 'Faldas', 'Vestidos', 'Zapatos'], Calzado: ['Tops', 'Pantalones', 'Faldas', 'Vestidos', 'Bolsos'], Bolsos: ['Tops', 'Pantalones', 'Faldas', 'Vestidos', 'Zapatos'] };
// a igualdad de looks, el color que mejor casa con la prenda y con los colores que ya usas (el clóset dice lo que te gusta)
function armonia(p, c) {
  const usa = {}; E.prendas.forEach(x => { usa[x.color] = (usa[x.color] || 0) + 1 + (x.usos || []).length; });
  const fav = Object.entries(usa).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0]);
  return (CASAN.has(par(p.color, c)) ? 1 : 0) - (CHOCAN.has(par(p.color, c)) ? 2 : 0) + (fav.includes(c) ? .6 : 0) + (NEUTROS.has(c) ? .3 : 0) - (c === p.color && !NEUTROS.has(c) ? .5 : 0);
}
// cuántos looks buenos da el clóset y cuántos días seguidos puedes vestirte sin repetir ninguna prenda principal
let SIN_HISTORIAL = false;
function resumenCloset() {
  const rnd = Math.random; Math.random = () => .5; SIN_HISTORIAL = true;
  try {
    const mejor = {}; for (const l of combosCon([], activas())) if (!mejor[l.base] || l.pts > mejor[l.base].pts) mejor[l.base] = l;
    const buenos = Object.values(mejor).filter(l => l.pts >= LOOK_BUENO).sort((a, b) => b.pts - a.pts), usadas = new Set(); let dias = 0;
    for (const l of buenos) { const pr = l.ps.filter(esBase).map(x => x.id); if (pr.some(i => usadas.has(i))) continue; pr.forEach(i => usadas.add(i)); dias++; }
    return { looks: buenos.length, dias };
  } finally { Math.random = rnd; SIN_HISTORIAL = false; }
}
// 06/11 (Gabriela: «todavía sigo viendo combinaciones con ropa de deporte»; «esos looks que salen en cada prenda muchos son un horror»): «Ya puedes
// ponértela así» salía del generador viejo (combosCon), que no conoce las reglas de la estilista. Con el motor cargado salen del motor: el mejor look de cada
// ocasión en la que cabe la prenda, con el tiempo de hoy y, si la prenda no es de esta temperatura, con el de su estación; solo los que pasan todos los vetos.
function looksMotorCon(p) {
  const f = Motor.ficha(p, {}), w = E.tiempo?.t != null ? E.tiempo : { t: 18, max: 21, min: 12 }, ocs = Motor.ocasionesDe(p), min = Motor.R.puntos.umbrales.pasable;
  // con el tiempo de hoy; si así salen menos de dos, también con el de la mitad de su estación (un top de verano en noviembre)
  const m = Math.round((Math.max(f.tmin ?? 5, 5) + Math.min(f.tmax ?? 28, 28)) / 2), tiempos = [w, ...(Math.abs(m - w.t) >= 4 ? [{ t: m, max: m + 3, min: m - 6 }] : [])];
  // la prenda, fija: de su misma categoría solo entra ella (el motor solo prueba las 12 mejores parejas de cada fórmula y muchas prendas no llegaban nunca)
  const pool = activas().filter(x => x.id === p.id || Motor.ficha(x, {}).cat !== f.cat);
  const vistos = new Set(), out = [];
  for (const tiempo of tiempos) { if (out.length >= 2) break; for (const plan of ['Diario', 'Oficina', 'Noche', 'Evento', 'Viaje', 'Deporte'].filter(o => ocs.includes(o) && !out.some(x => x.plan === o))) {
    const r = Motor.looks({ prendas: pool, tiempo, plan, perfil: E.perfil, n: 6, hoy: hoyISO(), hora: plan === 'Noche' ? 20 : 13, pro: true, depurar: true, complementos: ['bolso', 'accesorio'].includes(f.cat) });
    const l = (r.todos || []).filter(l => !l.veto.duros.length && !l.casi && l.nota >= min && Motor.claveLook(l).split(',').includes(p.id) && !vistos.has(Motor.claveLook(l))).sort((a, b) => b.nota - a.nota)[0];
    if (!l) continue; vistos.add(Motor.claveLook(l));
    const ps = Motor.aPropuesta(l).ids.map(id => E.prendas.find(x => x.id === id)).filter(Boolean); if (ps.length > 1) out.push({ ps, pts: l.nota, plan });
  } }
  return out.sort((a, b) => b.pts - a.pts);
}
// 06/11 (Gabriela: «en las de deporte se combinan con todo menos entre sí»): el «por ejemplo, con» de «Te vendría bien» sale del generador viejo; con el motor cargado,
// solo valen looks sin vetos y, con una prenda de deporte, todo de deporte (o una camiseta lisa); sin ella, nada de deporte
function casaMotor(p, ps) {
  if (typeof Motor === 'undefined') return true;
  try {
    const fi = x => Motor.ficha(x), dep = f => f.uso === 'deporte' || (f.cat === 'calzado' && f.deportiva), fp = fi(p), roles = {};
    for (const x of ps) { const f = fi(x); if (x.id !== p.id && f.cat !== 'accesorio' && f.cat !== 'bolso') {
      if (dep(fp) && !dep(f) && !(['camiseta', 'camiseta_tirantes'].includes(f.subtipo) && f.estampado === 'liso')) return false;
      if (!dep(fp) && f.uso === 'deporte') return false; }
      if (roles[f.cat]) return false; roles[f.cat] = x; }
    const j = Motor.juzgar({ ...roles, tiempo: E.tiempo?.t != null ? E.tiempo : { t: 18, max: 21, min: 12 }, plan: dep(fp) ? 'Deporte' : 'Diario', perfil: E.perfil, hora: 13 });
    return !j.veto.duros.length;
  } catch (e) { return true; }
}
function calcularPartido(p) {
  const rnd = Math.random; Math.random = () => .5; // sin azar: el mismo clóset da siempre la misma respuesta
  try {
    const pool = activas().filter(x => x.id !== p.id);
    const ya = typeof Motor !== 'undefined' ? looksMotorCon(p) : combosCon([p], pool).sort((a, b) => b.pts - a.pts);
    // «look nuevo» = una base (vestido, o arriba y abajo) que con la pieza pasa a ser buena y sin ella no lo era
    const antes = {}; for (const l of ya) antes[l.base] = Math.max(antes[l.base] ?? -99, l.pts);
    const tengo = (v, cat) => E.prendas.some(x => x.color === v.color && catDe(x) === cat && estilo(x) === estilo(v)), cand = [];
    for (const cat of COMPLEMENTA[p.tipo === 'Arriba' && esCapa(p) ? 'Abrigo' : p.tipo] || []) for (const k of SUBCATS[cat] || []) for (const [c] of COLORES) {
      if (c === 'Estampado' && cat === 'Zapatos') continue;
      const v = { id: 'virtual', nombre: nombreReconocido(k, c), tipo: TIPO_DE_CAT[cat], color: c, usos: [], x: k }; if (tengo(v, cat) || Math.abs(estilo(v) - estilo(p)) >= (estilo(v) === 0 ? 2 : 3)) continue; // lo deportivo, solo con lo informal
      const mejorBase = {}; for (const l of combosCon([p, v], pool)) if (!mejorBase[l.base] || l.pts > mejorBase[l.base].pts) mejorBase[l.base] = l;
      const nuevos = Object.entries(mejorBase).filter(([b, l]) => l.pts >= LOOK_BUENO && (antes[b] ?? -99) < LOOK_BUENO && casaMotor(p, l.ps)).map(([, l]) => l).sort((a, b) => b.pts - a.pts);
      if (nuevos.length) cand.push({ v, cat, k, n: nuevos.length, mejor: nuevos[0], pts: nuevos.reduce((a, l) => a + l.pts, 0) / nuevos.length + armonia(p, c) - .4 * Math.abs(estilo(v) - estilo(p)) });
    }
        const porCat = new Map(); for (const x of cand.sort((a, b) => b.n - a.n || b.pts - a.pts)) if (!porCat.has(x.cat)) porCat.set(x.cat, x); // una por categoría
    const sug = [...porCat.values()].slice(0, 4);
    return { ya: typeof Motor !== 'undefined' ? ya.slice(0, 4) : ya.filter(l => l.pts >= LOOK_BUENO).slice(0, 2), sug };
  } finally { Math.random = rnd; }
}
function sacalePartido(p) {
  const cap = document.createElement('div'); cap.className = 'ay-capa sp-capa';
  cap.innerHTML = `<button class="x" aria-label="${t('Cerrar', 'Close')}"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></svg></button><h1>${t('Sácale partido', 'Make the most of it')}</h1><img class="sp-prenda" src="${urlFoto(p)}" alt=""><p class="sp-nombre">${p.nombre}</p><p class="ay-nada">${t('Probando combinaciones…', 'Trying combinations…')}</p>`;
  document.body.appendChild(cap); cap.querySelector('.x').onclick = () => cap.remove();
  setTimeout(() => {
    const { ya, sug } = calcularPartido(p), mini = ps => ps.filter(x => x.id !== p.id && x.id !== 'virtual').map(x => `<img src="${urlFoto(x)}" alt="${x.nombre}" title="${x.nombre}">`).join('');
    cap.querySelector('.ay-nada').outerHTML = `<p class="mini-et">${t('Ya puedes ponértela así', 'You can already wear it like this')}</p>
      ${ya.length ? `<div class="sp-ya">${ya.map(l => `<div class="lk-fig">${maniqui(l.ps, true)}</div>`).join('')}</div>` : `<p class="sp-txt">${t('Con lo que tienes ahora no sale ningún look que me convenza. Mira abajo qué le falta.', 'Nothing in your closet makes a look I am happy with yet. See below what it needs.')}</p>`}
      <p class="mini-et">${t('Lo que le falta', 'What it needs')}</p>
      ${sug.length ? `<ol class="sp-sug">${sug.map(x => `<li><b>${x.v.nombre}</b><span>${x.n === 1 ? t('1 look nuevo', '1 new look') : t(`${x.n} looks nuevos`, `${x.n} new looks`)}</span>${mini(x.mejor.ps) ? `<div class="sp-con">${t('por ejemplo, con', 'for example, with')} ${mini(x.mejor.ps)}</div>` : ''}</li>`).join('')}</ol>
        <p class="sp-txt">${t('Calculado con tus prendas y las reglas de la app: cada pieza se prueba en todos los colores y se cuenta cuántos looks buenos te abre. Solo te digo el tipo de prenda; dónde comprarla lo eliges tú.', 'Worked out from your garments and the app’s rules: each piece is tried in every colour and we count how many good looks it unlocks. Only the type of garment; where to buy it is up to you.')}</p>`
        : `<p class="sp-txt">${t('No encuentro ninguna pieza que la mejore de verdad.', 'I could not find a piece that really improves it.')}</p>`}`;
  }, 30);
}

/* ---------- CONJUNTOS ---------- */
// 0.10 · Looks con el diseño cerrado (21/10): título centrado, «Mis looks» e «Ideas para hoy» en letras con el botón de dos agujeros,
// filtro por ocasión y tres formas de verlos a prueba (?looks=1 rejilla de 2 · 2 uno a uno · 3 lista)
E.lkTab = ({ ideas: 'ideas', cal: 'cal', hoy: 'hoy', mios: 'mios' })[new URLSearchParams(location.search).get('lk')] || 'mios'; E.lkOc = 'Todo'; E.lkI = 0;
const lkVista = () => { const v = new URLSearchParams(location.search).get('looks') || localStorage.getItem('tc_looks'); return ['1', '2', '3', '4', '5'].includes(v) ? v : '1'; }; // 0.49 (Gabriela, 22/10: «aplica el mismo estilo a todas las nuevas… y corregimos sobre esa base»): rejilla como el Clóset cerrado; // 4 y 5 (21/10, «adapta la interfaz a mi estilo»): sobre blanco, sin cajas
const figLook = (c, mini) => c.img && planDemo() === 'pro' ? `<img class="av" src="${c.img}" alt="">` : maniqui(conZapato(c.ids.map(P).filter(Boolean), specLook(c), c.como), mini);
const usosTxt = c => c.usos?.length ? veces(c.usos.length) : t('sin estrenar', 'not worn yet');
// 0.12 · pestañas de Looks: en la propuesta, «Hoy · Mis looks · Calendario» («la opción de hoy puede ser una opción de looks»); «Ideas para hoy» desaparece
const lkTabs = act => `<div class="mc-cats lk-tabs"><button class="${act === 'mios' ? 'activo' : ''}" data-lktab="mios">${t('Mis looks', 'My looks')}</button><button class="${act === 'ideas' ? 'activo' : ''}" data-lktab="ideas">${t('Ideas para hoy', 'Ideas for today')}</button><button class="${act === 'cal' ? 'activo' : ''}" data-lktab="cal">${t('Calendario', 'Calendar')}</button></div>`;
const CORAZON = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
async function alternarFav(ids, oc) { // el corazón guarda el look en Mis looks como favorito (no hace falta «Guardar» aparte)
  if (!E.perfil) return; const g = E.perfil.gustos = E.perfil.gustos || { si: {}, no: {} }, k = claveLook(ids); g.fav = g.fav || [];
  const ya = g.fav.includes(k); g.fav = ya ? g.fav.filter(x => x !== k) : [...g.fav, k];
  let cj = E.conjuntos.find(x => claveLook(x.ids) === k);
  if (!ya && !cj) { cj = { id: uid(), nombre: ocNombre(oc), ocasion: oc, ids: [...ids], creada: hoyISO(), usos: [] }; E.conjuntos.unshift(cj); }
  if (cj) cj.fav = !ya;
  await guardar(); toast(ya ? t('Quitado de favoritos', 'Removed from favourites') : t('En favoritos: lo tienes en Mis looks', 'Saved to favourites: find it in My looks'));
}
function lineaTiempo() { // fecha, cielo, mínima y máxima, y la lluvia con su hora: una sola línea
  const w = E.tiempo, l = idioma(), d = new Date().toLocaleDateString(l === 'en' ? 'en-GB' : 'es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  if (!w) return `<span>${d}</span>`;
  const ico = k => ICO_T[k] || ICO_T.nube, cielo = w.clave === 'solnube' ? 'sol' : ['lluvia', 'tormenta'].includes(w.clave) ? 'nube' : w.clave;
  const lluvia = ['lluvia', 'tormenta'].includes(w.clave) ? `${ico('lluvia')}${t('ahora', 'now')}` : w.lluviaH != null ? `${ico('lluvia')}${w.lluviaH}:00` : '';
  return `<span>${d}</span><span>${ico(cielo)}${w.min != null ? `${w.min}° / ${w.max}°` : `${w.t}°`}</span>${lluvia ? `<span>${lluvia}</span>` : ''}`;
}
function pintarLooks() {
  // 0.89 (Gabriela, 24/10: «doy en looks y no me ha creado ningún look»): sin looks guardados, Looks abre en las ideas
  if (E.lkTab === 'mios' && !E.lkTocado && !E.conjuntos.length) E.lkTab = 'ideas';
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
  const zap = c => pieLook(conZapato(c.ids.map(P).filter(Boolean), specLook(c))); // 0.111: paleta y estilo en vez del zapato escrito y el porqué
  const pie = c => ideas ? `<span class="lk-oc">${ocNombre(c.ocasion || 'Diario')}</span>${zap(c)}<span class="lk-acc"><button data-gguardar="${c.i}">${t('Guardar', 'Save')}</button><button data-ghoy="${c.i}">${t('Me lo pongo', 'Wear it')}</button></span>`
    : `<span class="lk-oc">${ocNombre(c.ocasion || 'Diario')}</span>${zap(c)}<span class="lk-us">${usosTxt(c)}</span>`;
  const abre = c => ideas ? '' : ` data-look="${c.id}"`;
  let cuerpo;
  if (!lista.length) cuerpo = ideas ? `<div class="hz-vacio lk-vacio">${t('Para proponerte looks necesito más prendas de esta estación: por ejemplo, un top y un pantalón o una falda, o un vestido.', 'To suggest looks I need more garments for this season: for example a top and trousers or a skirt, or a dress.')}<button class="hz-bt" data-ir="subir">${t('Subir mis prendas', 'Upload my garments')}</button></div>`
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
    if (b.dataset.lktab) { E.lkTab = b.dataset.lktab; E.lkTocado = true; E.lkI = 0; }
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
  $('lk-foto').innerHTML = c.img && planDemo() === 'pro' ? `<img src="${c.img}" alt="">` : maniqui(ps, false, COMP === 'simetrica' ? 'collage' : COMP);
  $('lk-piezas').innerHTML = ps.map(p => `<button data-ficha="${p.id}"><img src="${urlFoto(p)}" alt=""><span>${p.nombre}</span></button>`).join('');
  $('lk-pongo').onclick = () => ponerse(c.ids, c).then(() => abrirLook(id));
  $('lk-borrar').onclick = async () => { if (await confirmar(t('¿Borrar este conjunto?', 'Delete this outfit?'), t('Las prendas se quedan en tu clóset.', 'The garments stay in your closet.'), t('Borrar', 'Delete'))) { E.conjuntos = E.conjuntos.filter(x => x.id !== id); await guardar(); E.propuestas = []; ir('looks'); } };
  ir('look');
}

/* ---------- YO ---------- */
// 0.63 · Ayuda (Sheila, 22/10: «también podemos integrar un sistema de asistente virtual por si la usuaria tiene alguna duda»; Gabriela: «Sí»):
// primera fase, preguntas frecuentes con buscador, sin servidor y sin red; el asistente con IA llegará con las cuentas
const AYUDA = [ // 06/11 (revisión de toda la app pedida por Gabriela: «que no hay funciones obsoletas»): al día con la web 0.185; 08/11: Con una prenda, ¿Me lo compro?, avatar y Ajustes
  ['Subir y fotos', 'Cómo subo mi ropa', 'Toca Subir, en el centro de la barra. Haz una foto o elige varias de la galería. La app quita el fondo y te propone nombre, categoría, color, estampado y estación; revísalo y guarda.'],
  ['Subir y fotos', 'Cómo hago una buena foto', 'Una prenda por foto y entera, sobre un fondo que contraste (una cama o el suelo valen), con luz de día y sin flash. Las mangas, mejor hacia abajo.'],
  ['Subir y fotos', 'El recorte ha dejado restos o ha cortado la prenda', 'Abre la prenda y toca «Arreglar foto»: marca la prenda sobre tu foto y la app vuelve a quitar el fondo. Tu foto original no se toca.'],
  ['Subir y fotos', 'La app se ha equivocado de tipo, color o estación', 'Abre la prenda y toca el lápiz. Cambia la categoría, el tipo, el color, el estampado, los detalles (encaje, vaquero, deporte…) o la estación. Lo que corrijas a mano la app ya no lo cambia.'],
  ['Subir y fotos', 'Me pregunta si una prenda está repetida', 'Si subes dos fotos que se parecen mucho, la app te las enseña juntas. «Sí, es la misma» borra la nueva y pasa sus looks a la otra; «No, son distintas» guarda las dos.'],
  ['Subir y fotos', 'Cómo borro una prenda', 'Abre la prenda y toca la papelera, arriba.'],
  ['Hoy y looks', 'Cómo elige la app el look de hoy', 'Mira el tiempo de tu ciudad, tu plan del día, tus estilos y lo que menos te has puesto, y combina tus prendas con reglas de estilistas: ocasión, temperatura, colores y proporciones.'],
  ['Hoy y looks', 'Quiero otro look', 'Usa las flechas a los lados del look para ver más propuestas. Con el corazón lo guardas en tus favoritos.'],
  ['Hoy y looks', 'Para qué sirve «Me lo pongo»', 'Apunta que hoy llevas ese look: cuenta un uso de cada prenda y lo guarda en el calendario.'],
  ['Hoy y looks', 'Cómo le digo a dónde voy', 'En Hoy, toca la ocasión bajo la fecha y elige otra. Para otro día, en Looks → Calendario, elige el día y toca «Añadir evento»: pon el plan, la hora y, si quieres, el enlace del sitio y una descripción. La app te propone looks con el tiempo de ese día.'],
  ['Hoy y looks', 'Me dice que me falta ropa para una ocasión', 'Si tu clóset no da para un plan (noche, evento, oficina, deporte), la app te lo dice y te propone qué tipo de prenda te vendría bien.'],
  ['Hoy y looks', 'Cómo creo y guardo un look', 'En Looks → Mis looks, toca + y elige las prendas. Los looks que te gustan de Hoy e Ideas se guardan con el corazón.'],
  ['Hoy y looks', 'Quiero un look con una prenda concreta', 'En Hoy, toca «Con una prenda» junto a la ocasión. En Looks → Ideas → «Con una prenda» puedes elegir además el estilo. Todos los looks que te propone la llevan.'],
  ['Hoy y looks', 'Para qué sirve «Antes de comprar»', 'En Looks → Ideas: hazle una foto a una prenda en la tienda y la app te dice qué parte de tu clóset combina con ella, qué looks saldrían y si ya tienes algo parecido. No entra en tu clóset hasta que tocas «La he comprado».'],
  ['Hoy y looks', 'Qué es «Mi cápsula»', 'En Looks → Mis looks: elige el plan y cuántas prendas quieres llevar, y la app busca las que más looks dan entre sí.'],
  ['Mi prenda', 'Qué significan los iconos de la ficha', 'Hoy: llevarla hoy. Look: crear un look con ella. Ideas: looks con esa prenda. Cuidar: cómo lavarla. Sucia: que no salga en los looks hasta que la marques limpia. Guardar: fuera de temporada. Donar y Cerca: puntos para donarla o venderla cerca de ti.'],
  ['Mi estilo', 'Cómo cambio mi estilo', 'En Yo → Mi estilo, elige hasta cinco estilos y toca «Guardar». Los looks que te propone la app se ordenan según ellos.'],
  ['Mi estilo', 'Cómo aprende la app lo que me gusta', 'En Yo → Mi estilo, «Looks que te encantan»: sube hasta cinco fotos de looks que te gusten (tuyos, de Pinterest o de Instagram). La app lee la ropa, sus colores y su estilo, y te propone más looks parecidos. La foto no se guarda.'],
  ['Mi estilo', 'Cómo copio el estilo de alguien', 'En el Pro, Looks → Ideas → «Inspírate en…»: elige una referencia y la app arma looks con tu ropa en ese estilo.'],
  ['Mi estilo', 'Cómo funciona mi diagnóstico', 'En Yo → Tus medidas y fotos: apunta tus medidas con la cinta (el contorno de pecho, cintura y cadera) y sube una foto de cara y una de cuerpo entero. La app calcula tu silueta y tus colores. En el Pro, los looks los tienen en cuenta.'],
  ['Mi estilo', 'Cómo me veo los looks puestos', 'En el Pro, Yo → Tu avatar: con tu foto de cara y la de cuerpo entero la app crea tu avatar. Después, en Hoy, toca la figura junto a «Me lo pongo». Lo último que te pruebas se queda en Yo, en todos los sitios donde entres con tu cuenta.'],
  ['Mi cuenta y datos', 'Dónde se guarda mi ropa', 'Con cuenta, tu ropa y tus looks se guardan en tu cuenta y los ves en cualquier móvil en el que entres. Tus fotos de cara y de cuerpo se quedan en tu móvil, salvo que elijas guardarlas en tu cuenta (privadas).'],
  ['Mi cuenta y datos', 'Dónde están los ajustes', 'En Yo, en el engranaje de arriba a la derecha: tu cuenta, tu plan, la ciudad del tiempo, el modo oscuro, el idioma, tus datos y la ayuda.'],
  ['Mi cuenta y datos', 'Cómo paso mi clóset a otro móvil', 'Entra con tu correo y tu contraseña en el otro móvil: tu clóset aparece solo. Sin cuenta, en Ajustes → Tus datos y permisos, «Descargar una copia» y, en el otro móvil, «Recuperar una copia».'],
  ['Mi cuenta y datos', 'Qué incluye cada plan', 'Gratis: 7 días con hasta 10 prendas. Básico (1,99 €/mes o 14,99 €/año): tu clóset sin tope, el look de cada día, los looks de la estilista, Mi cápsula, el calendario y los cuidados. Pro (4,99 €/mes o 39,99 €/año): todo lo del Básico y además tu diagnóstico de colores y silueta aplicado a tus looks, «Inspírate en…», Planear un viaje e ideas con cada prenda.'],
  ['Mi cuenta y datos', 'Cómo pongo la app en la pantalla de inicio', 'En iPhone, desde Safari: Compartir → «Añadir a pantalla de inicio». En Android, desde Chrome: menú ⋮ → «Añadir a pantalla de inicio».']
];
function abrirAyuda() { // 0.114: con el panel de Yo; cada grupo en su bloque y, al final, «Escríbenos»
  abrirPanel(t('Ayuda', 'Help'), `<label class="pn-busca">${icY('ayuda')}<input type="search" placeholder="${t('Busca tu duda', 'Search your question')}"></label><div class="ay-lista"></div>`
    + grupoP('', filaP({ tag: 'a', attr: 'href="mailto:app@tucloset.app"', ic: 'correo', tit: t('Escríbenos', 'Write to us'), val: 'app@tucloset.app', flecha: false })), cap => {
    const n = x => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pinta = q => { const b = n(q || ''), hay = AYUDA.filter(([, p, r]) => !b || n(p + ' ' + r).includes(b)), grupos = [...new Set(hay.map(h => h[0]))];
      cap.querySelector('.ay-lista').innerHTML = hay.length ? grupos.map(g => grupoP(g, hay.filter(h => h[0] === g).map(([, p, r]) => `<details class="pn-d"><summary>${p}<svg class="pn-fl" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></summary><p>${r}</p></details>`).join(''))).join('')
        : `<p class="ay-nada">${t('No encuentro nada con esas palabras. Prueba con otras, o escríbenos.', 'Nothing found. Try other words, or write to us.')}</p>`; };
    pinta(''); cap.querySelector('.pn-busca input').oninput = e => pinta(e.target.value);
  });
}
// 0.114 · Panel de opciones (Gabriela, 28/10: «sigo sin ver la opción de ajustes, básico en cualquier app… ubícate en un panel de opciones:
// letra un poco más oscura, iconos, intuitivo, sin redundancias; las de ayuda, cuenta, más opciones tienen el mismo diseño soso, plano, cámbialos todo»).
// Grupos con iconos: Tu cuenta, Ajustes, Privacidad y datos, Ayuda; lo que solo usamos para probar, plegado al final. Cuenta, Ayuda, Privacidad,
// Idioma y Ciudad se abren con el mismo panel
const IC_Y = {
  cuenta: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4"/>',
  pareja: '<circle cx="8.8" cy="8.5" r="2.9"/><circle cx="15.8" cy="9.3" r="2.4"/><path d="M3.5 19.5c.8-3.2 2.8-5 5.3-5s4.5 1.8 5.3 5M13.6 15c.7-.5 1.4-.7 2.2-.7 2 0 3.5 1.5 4.2 4.2"/>',
  plan: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6L12 16.6l-5 2.6.9-5.6-4-3.9 5.6-.8z"/>',
  ciudad: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  modo: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  idioma: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"/>',
  avisos: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  privacidad: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="1"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  medidas: '<path d="M3.5 9.5h17v5h-17z"/><path d="M7 9.5v2.5M10.5 9.5v1.5M14 9.5v2.5M17.5 9.5v1.5"/>',
  ayuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.8" r=".7"/>',
  correo: '<rect x="3.5" y="6" width="17" height="12" rx="1"/><path d="m4 7 8 6 8-6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="8" r=".7"/>',
  nube: '<path d="M7 18h10a4 4 0 0 0 .6-8A5.5 5.5 0 0 0 7 9.5 4.3 4.3 0 0 0 7 18z"/>',
  percha: '<path d="M12 7.5a1.8 1.8 0 1 1 1.8-1.8c0 1-.8 1.4-1.8 2.3v1.2L3.8 15.8a1 1 0 0 0 .6 1.7h15.2a1 1 0 0 0 .6-1.7L12 9.2"/>',
  subir: '<path d="M12 15V4.5M7.5 9 12 4.5 16.5 9"/><path d="M5 15.5V19h14v-3.5"/>',
  bajar: '<path d="M12 4.5V15M7.5 10.5 12 15l4.5-4.5"/><path d="M5 15.5V19h14v-3.5"/>',
  salir: '<path d="M14 5H6v14h8"/><path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5"/>',
  borrar: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>',
  camara: '<path d="M4 8h3.5l1.5-2h6l1.5 2H20v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  avatar: '<circle cx="12" cy="4.8" r="2.4"/><path d="M8.2 21.5 9 13.8 7.3 10.6c-.4-.9.2-2.1 1.2-2.4L12 7.4l3.5.8c1 .3 1.6 1.5 1.2 2.4L15 13.8l.8 7.7"/>',
  control: '<path d="M4 19.5h16M6.5 16.5V11M10.5 16.5V6.5M14.5 16.5v-4M18.5 16.5V9"/>',
  probar: '<path d="M5 7h9M18 7h1M5 17h3M12 17h7"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>'
};
const icY = k => `<svg class="pn-ic" viewBox="0 0 24 24" aria-hidden="true">${IC_Y[k] || ''}</svg>`;
// 07/11 (Gabriela: «en Yo no me sale cambiar a modo oscuro»): el interruptor del modo oscuro en Yo → Ajustes; se guarda en este móvil (tc_modo) y se aplica al momento
function cambiarModo() {
  const on = !document.documentElement.classList.contains('oscuro'); try { localStorage.setItem('tc_modo', on ? 'oscuro' : 'claro'); } catch (e) { }
  if (on && !document.querySelector('link[href^="oscuro.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'oscuro.css?v=' + (document.querySelector('script[src^="app.js"]')?.src.split('v=')[1] || ''); document.head.append(l); }
  document.documentElement.classList.toggle('oscuro', on);
  const tc = document.querySelector('meta[name="theme-color"]'), cs = document.querySelector('meta[name="color-scheme"]'); if (tc) tc.content = on ? '#1A1410' : '#FFFFFF'; if (cs) cs.content = on ? 'dark' : 'only light';
  pintarPanelYo();
}
const filaP = ({ id, attr = '', ic, tit, val = '', rojo, flecha = true, apagada, oro, tag = 'button' }) => `<${tag} class="pn-f${rojo ? ' rojo' : ''}${apagada ? ' apagada' : ''}"${id ? ` id="${id}"` : ''} ${attr}>${ic ? icY(ic) : ''}<span class="pn-t">${tit}</span>${val !== '' ? `<span class="pn-v${oro ? ' oro' : ''}">${val}</span>` : ''}${flecha ? '<svg class="pn-fl" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>' : ''}</${tag}>`;
const grupoP = (tit, filas, nota) => `<section class="pn-g${tit ? '' : ' pn-g0'}">${tit ? `<h2 class="pn-gt">${tit}</h2>` : ''}<div class="pn-c">${filas}</div>${nota ? `<p class="pn-nota">${nota}</p>` : ''}</section>`;
function abrirPanel(tit, html, enlazar) {
  document.querySelectorAll('.pn-capa:not(.pn-base)').forEach(c => c.remove()); // 08/11: la pantalla de Ajustes (pn-base) se queda debajo
  const cap = document.createElement('div'), hid = 'pn-t' + (++abrirPanel.n || (abrirPanel.n = 1)); cap.className = 'pn-capa'; // 08/11: diálogo con su título (axe pedía región)
  cap.setAttribute('role', 'dialog'); cap.setAttribute('aria-modal', 'true'); cap.setAttribute('aria-labelledby', hid);
  cap.innerHTML = `<div class="pn-cab"><button class="pn-volver" aria-label="${t('Volver', 'Back')}"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><h1 id="${hid}">${tit}</h1><span></span></div><div class="pn-cuerpo">${html}</div>`;
  document.body.appendChild(cap); cap.querySelector('.pn-volver').onclick = () => cap.remove();
  if (enlazar) enlazar(cap); return cap;
}
function pintarPanelYo() {
  if (!$('yo-panel')) return; // vive en la pantalla de Ajustes (abrirAjustes)
  const pf = E.perfil || {}, c = cuenta(), es = idioma() === 'en';
  const ciudad = pf.ciudad || E.tiempo?.nombre || pf.lugar || t('tu ubicación', 'your location');
  $('yo-panel').innerHTML =
    grupoP(t('Tu cuenta', 'Your account'),
      (NUBE ? filaP({ attr: 'data-ir="cuenta"', ic: 'cuenta', tit: t('Cuenta', 'Account'), val: c ? (c.correo || '') : t('Entrar o crear', 'Sign in or create') }) : '')
      + filaP({ id: 'yo-plan-info', ic: 'plan', tit: t('Plan', 'Plan'), val: t('Prueba gratis', 'Free trial'), oro: true })
      + (NUBE ? filaP({ id: 'yo-pareja', ic: 'pareja', tit: t('Pareja', 'Partner'), val: c && LS.get('tc_pareja') ? escH(LS.get('tc_pareja')) : '' }) : ''),
      enGratis() && E.prendas.length > TOPE_GRATIS ? t(`En la gratis se ven ${TOPE_GRATIS} prendas. Las otras ${E.prendas.length - TOPE_GRATIS} siguen guardadas en tu cuenta.`, `The free version shows ${TOPE_GRATIS} garments. The other ${E.prendas.length - TOPE_GRATIS} stay saved in your account.`) : '')
    + grupoP(t('La app', 'The app'),
      filaP({ id: 'yo-ciudad', ic: 'ciudad', tit: t('Ciudad para el tiempo', 'City for the weather'), val: ciudad })
      + filaP({ id: 'yo-modo', ic: 'modo', tit: t('Modo oscuro', 'Dark mode'), val: '<span class="pn-sw" aria-hidden="true"></span>', flecha: false, attr: `role="switch" aria-checked="${document.documentElement.classList.contains('oscuro')}"` })
      + filaP({ id: 'yo-idioma', ic: 'idioma', tit: t('Idioma', 'Language'), val: es ? 'English' : 'Español' }))
    + grupoP(t('Privacidad y datos', 'Privacy and data'),
      filaP({ id: 'yo-privacidad', ic: 'privacidad', tit: t('Tus datos y permisos', 'Your data and permissions') }))
    + grupoP(t('Ayuda', 'Help'),
      filaP({ id: 'yo-ayuda', ic: 'ayuda', tit: t('Preguntas frecuentes', 'FAQ') })
      + filaP({ tag: 'a', attr: 'href="mailto:app@tucloset.app"', ic: 'correo', tit: t('Escríbenos', 'Write to us'), val: 'app@tucloset.app', flecha: false })
      + filaP({ ic: 'info', tit: t('Versión', 'Version'), val: ($('yo-version')?.textContent || '').split(' · ')[0].replace('TuCloset web ', ''), flecha: false, tag: 'div' }))
    // 09/11 (decisión 34 y Gabriela: «un enlace al que solo podamos acceder Sheila y yo»): lo de probar y el centro de control, solo para las socias
    // (cuentas de ADMINS, que /api/yo marca como admin), al final de Ajustes. Las demás no ven «Ver la app como» ni el clóset de pruebas.
    + (socia() ? grupoP(t('Para probar', 'For testing'),
      filaP({ tag: 'a', attr: 'href="control.html"', ic: 'control', tit: t('Centro de control', 'Control centre') })
      + filaP({ id: 'yo-vercomo', ic: 'probar', tit: t('Ver la app como', 'View the app as'), val: nomPlan(planDemo()) })
      + filaP({ id: 'yo-closet', ic: 'probar', tit: t('Clóset', 'Closet'), val: CLOSET_ACT ? t('Pruebas', 'Test') : t('Mi ropa', 'My clothes'), flecha: false })
      + filaP({ id: 'yo-intercambio', ic: 'probar', tit: t('Intercambiar Mi ropa y Pruebas', 'Swap My clothes and Test'), flecha: false })
      + (PUBLICA ? '' : filaP({ id: 'yo-ejemplo', ic: 'probar', tit: E.prendas.some(p => p.ejemplo) ? t('Quitar el clóset de ejemplo', 'Remove the sample closet') : t('Cargar un clóset de ejemplo', 'Load a sample closet'), flecha: false }))) : '');
  if ($('yo-pareja')) $('yo-pareja').onclick = panelPareja;
  if ($('yo-vercomo')) $('yo-vercomo').onclick = panelVerComo; $('yo-modo').onclick = cambiarModo; $('yo-ciudad').onclick = panelCiudad; $('yo-idioma').onclick = panelIdioma; $('yo-privacidad').onclick = panelPrivacidad; $('yo-ayuda').onclick = abrirAyuda; $('yo-plan-info').onclick = panelPlan;
  if ($('yo-closet')) $('yo-closet').onclick = () => { const otro = CLOSET_ACT ? '' : 'pruebas'; try { localStorage.setItem('tc_closet', otro); } catch (e) { } location.href = location.pathname + '?repaso=0&pantalla=closet'; };
  if ($('yo-ejemplo')) $('yo-ejemplo').onclick = () => E.prendas.some(p => p.ejemplo) ? quitarEjemplo() : cargarEjemplo();
  if ($('yo-intercambio')) $('yo-intercambio').onclick = () => intercambiarClosets().catch(e => { avisarFallo('intercambio', e); toast(t('No se ha podido. No se ha cambiado nada.', 'It did not work. Nothing was changed.')); });
}
// 10/11 (Sheila: «invierte mi clóset de prueba con mi clóset normal y arma mi cuenta como la de Gaby»): las prendas, sus fotos, los looks y la agenda de «Pruebas»
// pasan a «Mi ropa» (y a la cuenta) y los de «Mi ropa», a «Pruebas». El perfil (estilos, medidas, fotos, avatar) y lo probado en el avatar se quedan donde están.
// Pulsando otra vez se deshace. En la cuenta, lo que sale se apunta como borrado, pero sus fotos no se borran del servidor, por si se vuelve a cambiar.
// Al abrir de nuevo, la app hace con lo que entra lo mismo que con cualquier prenda: nombre y detalles con IA, foto de catálogo, recorte
const MUEVE = k => ['prendas', 'conjuntos', 'agenda', 'alfas'].includes(k) || (typeof k === 'string' && k.startsWith('f:'));
const kvAbrir = nombre => new Promise((res, rej) => { const r = indexedDB.open(nombre, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const kvLeer = db => new Promise((res, rej) => { const tx = db.transaction('kv', 'readonly'), st = tx.objectStore('kv'), ks = st.getAllKeys(), vs = st.getAll();
  tx.oncomplete = () => res(new Map(ks.result.map((k, i) => [k, vs.result[i]]))); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abortada')); });
const kvCambiar = (db, quitar, poner) => new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'), st = tx.objectStore('kv');
  for (const k of quitar) st.delete(k); for (const [k, v] of poner) st.put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abortada')); });
async function intercambiarClosets() {
  await guardar(); clearTimeout(nubeT);
  const ids = m => (m.get('prendas') || []).filter(p => !p.ejemplo).map(p => p.id);
  let dA = await kvAbrir('tucloset'), dB = await kvAbrir('tucloset-pruebas'), A = await kvLeer(dA), B = await kvLeer(dB);
  if (!await confirmar(t('¿Intercambiar los clósets?', 'Swap the closets?'),
    t(`Las ${ids(B).length} prendas de Pruebas pasan a Mi ropa y a tu cuenta, con sus looks y su agenda. Las ${ids(A).length} de Mi ropa pasan a Pruebas, solo en este móvil. Tu perfil, tus medidas y tu avatar no cambian. Para deshacerlo, vuelve a pulsar aquí.`,
      `The ${ids(B).length} garments in Test move to My clothes and your account, with their looks and calendar. The ${ids(A).length} in My clothes move to Test, on this phone only. Your profile, measurements and avatar stay. To undo, tap here again.`),
    t('Intercambiar', 'Swap'))) { dA.close(); dB.close(); return; }
  // 1. Mi ropa, al día con la cuenta antes de tocar nada (si no hay conexión, no se cambia nada)
  if (CLOSET_ACT) { CLOSET_ACT = ''; LS.set('tc_closet', ''); BD.cerrar(); E.perfil = (await BD.get('perfil')) || null; E.prendas = (await BD.get('prendas')) || []; E.conjuntos = (await BD.get('conjuntos')) || []; E.agenda = (await BD.get('agenda')) || {}; }
  if (cuenta()) {
    toast(t('Guardando tu cuenta…', 'Saving your account…'));
    if (!await bajarNube().catch(() => false)) { dA.close(); dB.close(); return toast(t('Sin conexión con tu cuenta: no he cambiado nada. Prueba con internet.', 'Cannot reach your account: nothing changed. Try with internet.')); }
    await subirNube(); if (E.nube.estado === 'error') { dA.close(); dB.close(); return toast(t('Sin conexión con tu cuenta: no he cambiado nada. Prueba con internet.', 'Cannot reach your account: nothing changed. Try with internet.')); }
  }
  INTERCAMBIO = true; clearTimeout(nubeT); if (nubeEnCurso) await nubeEnCurso.catch(() => { }); await BD.set('perfil', E.perfil); BD.parar(true); BD.cerrar(); A = await kvLeer(dA); B = await kvLeer(dB);
  // 2. el cambio, base a base. Primero Mi ropa: si fallara Pruebas, lo de Pruebas sigue allí y lo de Mi ropa, en la cuenta
  const fuera = ids(A), dentro = ids(B), deA = [...A].filter(([k]) => MUEVE(k)), deB = [...B].filter(([k]) => MUEVE(k));
  await kvCambiar(dA, deA.map(([k]) => k), deB);
  await kvCambiar(dB, deB.map(([k]) => k), deA);
  dA.close(); dB.close();
  // 3. la cuenta: lo que sale, borrado (sus fotos se quedan en el servidor); lo que entra deja de estarlo
  LS.set('tc_closet', '');
  if (cuenta()) {
    const b = new Set(JSON.parse(LS.get('tc_nube_borradas') || '[]')); fuera.forEach(id => b.add(id)); dentro.forEach(id => b.delete(id));
    LS.set('tc_nube_borradas', JSON.stringify([...b].slice(-2000))); LS.set('tc_intercambio', JSON.stringify({ fuera, dentro })); LS.set('tc_nube_ids', '[]');
    E.prendas = (await BD.get('prendas')) || []; E.conjuntos = (await BD.get('conjuntos')) || []; E.agenda = (await BD.get('agenda')) || {};
    let r = await api('/api/datos', { method: 'PUT', json: { doc: docLocal(), version: +(LS.get('tc_nube_ver') || 0) }, tiempo: 40000 }).catch(() => null);
    if (r?.status === 409) { const g = await api('/api/datos', { tiempo: 30000 }).catch(() => null), v = g?.ok ? (await g.json()).version : null; if (v != null) r = await api('/api/datos', { method: 'PUT', json: { doc: docLocal(), version: v }, tiempo: 40000 }).catch(() => null); }
    if (r?.ok) { const d = await r.json(); LS.set('tc_nube_ver', d.version); LS.set('tc_nube_ids', JSON.stringify(dentro)); LS.set('tc_nube_cuando', d.actualizado); LS.set('tc_intercambio', null); }
  }
  toast(t(`Hecho: ${dentro.length} prendas en Mi ropa y ${fuera.length} en Pruebas`, `Done: ${dentro.length} garments in My clothes and ${fuera.length} in Test`));
  setTimeout(() => { location.href = location.pathname + '?repaso=0&pantalla=closet'; }, 1600);
}
// 08/11 (Gabriela: «la parte de Yo creo que tiene muchas cosas que tienen poco que ver, como mezclando ajustes de la app con cosas del usuario como medidas,
// colorimetría, avatar y esas cosas… estudia la mejor forma de distribuirlos»): Yo queda para lo tuyo (tu clóset, silueta, estilo, colores, medidas y fotos,
// avatar) y los ajustes de la app pasan a su propia pantalla, detrás del engranaje de arriba a la derecha, como en Instagram o Zara. Lo que se abre desde
// Ajustes (idioma, ciudad, plan…) se pone encima y, al volver, se vuelve a Ajustes.
const socia = () => !PUBLICA || LS.get('tc_admin') === '1';
function abrirAjustes() {
  document.querySelectorAll('.pn-capa').forEach(c => c.remove());
  const cap = abrirPanel(t('Ajustes', 'Settings'), '<div id="yo-panel"></div>'); cap.classList.add('pn-base');
  pintarPanelYo();
  // la primera vez con la cuenta abierta, el servidor dice si es una de las socias (se guarda hasta cerrar sesión)
  if (cuenta()?.token && LS.get('tc_admin') == null) api('/api/yo', { tiempo: 10000 }).then(r => r.ok ? r.json() : null).then(j => { if (!j) return; LS.set('tc_admin', j.admin ? '1' : '0'); pintarPanelYo(); }).catch(() => { });
}
document.addEventListener('click', e => { if (e.target.closest('[data-ajustes]')) abrirAjustes(); });
function panelVerComo() {
  const op = k => filaP({ attr: `data-vercomo="${k}"`, tit: nomPlan(k), val: planDemo() === k ? icY('ok') : '', flecha: false });
  abrirPanel(t('Ver la app como', 'View the app as'), grupoP('', VERSIONES.map(op).join(''), t('Tu ropa y tus looks no cambian: solo ves lo que ve cada plan.', 'Your clothes and looks stay the same: you only see what each plan sees.')),
    cap => cap.addEventListener('click', e => { if (e.target.closest('[data-vercomo]')) setTimeout(() => cap.remove(), 0); }));
}
/* 10/11, PAREJA (Gabriela, 08/11: «una opción de parejas»; eligió la 1: cada una con su cuenta y su clóset, enlazadas con un código): una crea el código en
   Ajustes → Pareja y se lo da; la otra lo escribe en su app. Enlazadas, en Looks → Ideas, «En pareja» propone a la vez un look tuyo y uno de tu pareja que
   combinan. El servidor solo le enseña a la pareja las prendas que se pueden poner y sus fotos; nada de medidas, fotos del diagnóstico ni notas. */
const PAREJA = { datos: null, cuando: 0 };
async function parejaDatos(forzar) {
  if (!cuenta()) return null;
  if (!forzar && PAREJA.datos !== null && Date.now() - PAREJA.cuando < 10 * 60000) return PAREJA.datos;
  const r = await api('/api/pareja', { tiempo: 20000 }); if (!r.ok) throw new Error('pareja ' + r.status);
  PAREJA.datos = (await r.json()).pareja || false; PAREJA.cuando = Date.now(); LS.set('tc_pareja', PAREJA.datos ? PAREJA.datos.nombre || t('Enlazada', 'Linked') : null);
  return PAREJA.datos;
}
function panelPareja() { abrirPanel(t('Pareja', 'Partner'), '<div id="pn-pareja"></div>', cap => pintarPareja(cap)); }
async function pintarPareja(cap, codigo) {
  const z = cap.querySelector('#pn-pareja'); if (!z) return;
  const intro = `<p class="pn-par-intro">${t('Enlaza tu clóset con el de tu pareja y, en Looks → Ideas, «En pareja» te propondrá a la vez un look para ti y otro para tu pareja que combinan.', 'Link your closet with your partner’s and, in Looks → Ideas, «As a couple» will suggest a look for you and one for your partner that go together.')}</p>`;
  if (!cuenta()) { z.innerHTML = intro + grupoP('', filaP({ attr: 'data-ir="cuenta"', ic: 'cuenta', tit: t('Entrar o crear tu cuenta', 'Sign in or create your account') }), t('Cada una necesita su cuenta de TuCloset.', 'Each of you needs a TuCloset account.')); z.querySelector('[data-ir]').addEventListener('click', () => cap.remove()); return; }
  if (!codigo) z.innerHTML = `<p class="pn-nota pn-par-carga">${t('Un momento…', 'One moment…')}</p>`;
  let d; try { d = await parejaDatos(true); } catch (e) { z.innerHTML = intro + `<p class="pn-error" role="alert">${t('Sin conexión. Prueba otra vez en un momento.', 'No connection. Try again in a moment.')}</p>`; return; }
  pintarPanelYo();
  if (d) {
    z.innerHTML = grupoP('', filaP({ tag: 'div', ic: 'pareja', tit: t('Enlazada con', 'Linked with'), val: escH(d.nombre || t('tu pareja', 'your partner')), flecha: false })
      + filaP({ id: 'pn-par-fuera', ic: 'borrar', tit: t('Desenlazar', 'Unlink'), rojo: true, flecha: false }),
      t('Tu pareja ve tus prendas y sus fotos para combinar looks con los suyos, y tú las suyas. Vuestras medidas, fotos del diagnóstico y notas, no.', 'Your partner sees your garments and their photos to match looks with theirs, and you see theirs. Not your measurements, analysis photos or notes.'));
    z.querySelector('#pn-par-fuera').onclick = async () => {
      if (!await confirmar(t('¿Desenlazar?', 'Unlink?'), t('Dejaréis de ver la ropa de la otra. Vuestros clósets no cambian.', 'You will stop seeing each other’s clothes. Your closets don’t change.'), t('Desenlazar', 'Unlink'))) return;
      const r = await api('/api/pareja', { method: 'DELETE', tiempo: 15000 }).catch(() => null); if (!r?.ok) return toast(t('Sin conexión: no se ha desenlazado', 'No connection: not unlinked'));
      PAREJA.datos = false; LS.set('tc_pareja', null); toast(t('Desenlazadas', 'Unlinked')); pintarPareja(cap);
    };
    return;
  }
  z.innerHTML = intro + (codigo ? `<div class="pn-par-cod"><p class="pn-par-n" aria-label="${t('Tu código', 'Your code')}: ${codigo.split('').join(' ')}">${codigo}</p>
      <p class="pn-nota">${t('Dáselo a tu pareja: lo escribe en su TuCloset, en Ajustes → Pareja. Vale 24 horas.', 'Give it to your partner: they type it in their TuCloset, in Settings → Partner. Valid for 24 hours.')}</p>
      <button class="boton linea" id="pn-par-copiar">${t('Copiar el código', 'Copy the code')}</button></div>`
      : `<button class="boton" id="pn-par-crear">${t('Crear un código', 'Create a code')}</button>`)
    + `<label class="pn-campo"><span>${t('¿Te han dado un código?', 'Have you been given a code?')}</span><input id="pn-par-in" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="8" placeholder="${t('Por ejemplo, K7M2QX', 'For example, K7M2QX')}"></label>
      <button class="boton linea pn-par-unir" id="pn-par-unir">${t('Enlazar', 'Link')}</button><p class="pn-error" id="pn-par-err" role="alert"></p>`;
  const err = z.querySelector('#pn-par-err');
  if (z.querySelector('#pn-par-crear')) z.querySelector('#pn-par-crear').onclick = async e => {
    const bt = e.currentTarget; bt.disabled = true; const r = await api('/api/pareja/codigo', { method: 'POST', tiempo: 15000 }).catch(() => null);
    if (r?.status === 409) return pintarPareja(cap);
    if (!r?.ok) { bt.disabled = false; err.textContent = t('Sin conexión. Prueba otra vez en un momento.', 'No connection. Try again in a moment.'); return; }
    pintarPareja(cap, (await r.json()).codigo);
  };
  if (z.querySelector('#pn-par-copiar')) z.querySelector('#pn-par-copiar').onclick = async () => { try { await navigator.clipboard.writeText(codigo); toast(t('Código copiado', 'Code copied')); } catch (e) { toast(codigo); } };
  z.querySelector('#pn-par-unir').onclick = async e => {
    const v = z.querySelector('#pn-par-in').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length !== 6) { err.textContent = t('El código tiene 6 letras y números.', 'The code has 6 letters and numbers.'); return; }
    const bt = e.currentTarget; bt.disabled = true; err.textContent = '';
    const r = await api('/api/pareja/unir', { method: 'POST', json: { codigo: v }, tiempo: 15000 }).catch(() => null), j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) { PAREJA.datos = null; toast(t(`Enlazadas${j.nombre ? ' con ' + j.nombre : ''}`, `Linked${j.nombre ? ' with ' + j.nombre : ''}`)); return pintarPareja(cap); }
    bt.disabled = false;
    err.textContent = !r ? t('Sin conexión. Prueba otra vez en un momento.', 'No connection. Try again in a moment.')
      : j.error === 'tuyo' ? t('Ese código lo has creado tú: dáselo a tu pareja para que lo escriba en su app.', 'You created that code: give it to your partner to type in their app.')
      : j.error === 'ocupada' ? t('Esa cuenta ya está enlazada con otra persona.', 'That account is already linked with someone else.')
      : j.error === 'frenado' ? t('Demasiados intentos. Prueba dentro de 15 minutos.', 'Too many attempts. Try again in 15 minutes.')
      : j.error === 'ya' ? t('Ya estás enlazada.', 'You are already linked.') : t('Ese código no vale o ha caducado. Pide uno nuevo.', 'That code isn’t valid or has expired. Ask for a new one.');
  };
}
// las fotos de las prendas de la pareja: la de catálogo si la tiene; si no, la recortada. Solo en memoria (no se guardan en el móvil)
async function fotosPareja(ps) {
  await Promise.all(ps.filter(p => !p.cat && !p.foto && !p.sinFotoPar && (p.conCat || p.conFoto)).map(async p => {
    const c = !!p.conCat; let r = await api('/api/pareja/foto/' + p.id + (c ? '-c' : ''), { tiempo: 30000 }).catch(() => null);
    if (!r?.ok && c && p.conFoto && !p.fCat) r = await api('/api/pareja/foto/' + p.id, { tiempo: 30000 }).catch(() => null);
    if (!r?.ok) { p.sinFotoPar = 1; return; } const b = await r.blob(); if (c && r.url.endsWith('-c')) p.cat = b; else p.foto = b;
  }));
}
function panelIdioma() {
  const op = (k, n) => filaP({ attr: `data-lng="${k}"`, tit: n, val: idioma() === k ? icY('ok') : '', flecha: false });
  abrirPanel(t('Idioma', 'Language'), grupoP('', op('es', 'Español') + op('en', 'English')), cap => cap.onclick = async e => {
    const b = e.target.closest('[data-lng]'); if (!b) return; E.perfil = E.perfil || {}; E.perfil.idioma = b.dataset.lng; try { localStorage.setItem('tc_idioma', b.dataset.lng); } catch (x) { }
    await guardar(); traducir(); pintarYo(); cap.remove(); });
}
function panelCiudad() {
  const pf = E.perfil || {};
  abrirPanel(t('Ciudad para el tiempo', 'City for the weather'), `<label class="pn-campo"><span>${t('Ciudad', 'City')}</span><input id="pn-ciudad" type="text" autocomplete="address-level2" value="${(pf.ciudad || '').replace(/"/g, '&quot;')}" placeholder="${t('Por ejemplo, Madrid', 'For example, Madrid')}"></label>
    <button class="boton" id="pn-ciudad-ok">${t('Guardar ciudad', 'Save city')}</button>${grupoP('', filaP({ id: 'pn-ubic', ic: 'ciudad', tit: t('Usar mi ubicación', 'Use my location'), flecha: false }), t('El tiempo de tu ciudad elige la ropa de cada día.', 'Your city’s weather picks each day’s clothes.'))}`, cap => {
    const fin = async () => { await guardar(); await cargarTiempo(true); E.propuestas = []; pintarYo(); cap.remove(); };
    cap.querySelector('#pn-ciudad-ok').onclick = async () => { const v = cap.querySelector('#pn-ciudad').value.trim(); if (!v) return toast(t('Escribe una ciudad', 'Type a city')); E.perfil = E.perfil || {}; Object.assign(E.perfil, { ciudad: v, lat: null, lon: null, lugar: '' }); await fin(); };
    cap.querySelector('#pn-ubic').onclick = async () => { const g = await ubicacionMovil(true); if (!g) return toast(t('Sin permiso de ubicación: escribe la ciudad', 'No location permission: type the city')); E.perfil = E.perfil || {}; Object.assign(E.perfil, { ciudad: '' }, g); await fin(); };
  });
}
function panelPlan() {
  abrirPanel(t('Plan', 'Plan'), `<p class="pn-lema">${t('Estás viendo la app como', 'You are viewing the app as')} ${({ gratis: t('Gratis', 'Free'), basico: t('Básico', 'Basic'), pro: 'Pro' })[planDemo()] || 'Pro'}.</p>`
    + grupoP('', filaP({ tag: 'div', tit: t('Gratis', 'Free'), val: t('7 días', '7 days'), flecha: false }) + `<p class="pn-txt">${t('Hasta 10 prendas, con el look de cada día y el calendario. Al acabar los 7 días, tu clóset sigue ahí. Para seguir sacándole partido, elige un plan.', 'Up to 10 garments, with the daily look and the calendar. When the 7 days end, your closet is still there. To keep making the most of it, choose a plan.')}</p>`)
    + grupoP('', filaP({ tag: 'div', tit: t('Básico', 'Basic'), val: t('1,99 € al mes', '€1.99 a month'), flecha: false }) + `<p class="pn-txt">${t('Tu clóset sin tope de prendas, el look de cada día, los looks de la estilista, Mi cápsula, el calendario y los cuidados.', 'Your closet with no garment limit, the daily look, the stylist’s looks, My capsule, the calendar and care tips.')}</p>`)
    + grupoP('', filaP({ tag: 'div', tit: 'Pro', val: t('4,99 € al mes', '€4.99 a month'), oro: true, flecha: false }) + `<p class="pn-txt">${t('Además, tu asesora de imagen: tus colores y tu silueta a partir de tus fotos, aplicados a tus looks; «Inspírate en…», Planear un viaje e ideas con cada prenda.', 'Plus your image adviser: your colours and figure from your photos, applied to your looks; “Get inspired by…”, trip planning and ideas for each garment.')}</p>`)
    + `<p class="pn-nota">${t('El pago llegará con la app del móvil. Mientras tanto, todo está abierto.', 'Payment will come with the mobile app. Until then, everything is open.')}</p>`);
}
async function panelPrivacidad() {
  let ubic = t('Sin pedir', 'Not asked');
  try { const r = await navigator.permissions.query({ name: 'geolocation' }); ubic = r.state === 'granted' ? t('Permitida', 'Allowed') : r.state === 'denied' ? t('Denegada', 'Denied') : ubic; } catch (e) { }
  const c = cuenta();
  abrirPanel(t('Tus datos y permisos', 'Your data and permissions'),
    grupoP(t('Qué se guarda', 'What is kept'), `<ul class="pn-lista">
      <li>${icY('nube')}<span>${c ? t('Tus prendas, sus fotos, tus looks y tu calendario se guardan en tu cuenta para verlos en cualquier móvil.', 'Your garments, their photos, your looks and your calendar are kept in your account so you can see them on any phone.') : t('Sin cuenta, todo se queda en este móvil.', 'Without an account, everything stays on this phone.')}</span></li>
      <li>${icY('camara')}<span>${E.perfil?.fotosCuenta ? t('Tu selfie y tu foto de cuerpo se guardan en tu cuenta, privadas, porque así lo elegiste. Lo cambias en Yo → Tus medidas y fotos.', 'Your selfie and body photo are kept in your account, private, because you chose so. Change it in Me → Your measurements and photos.') : t('Tu selfie y tu foto de cuerpo se quedan en este móvil.', 'Your selfie and body photo stay on this phone.')} ${t('Si creas tu avatar, se envían a Google (Gemini) para hacerlo, y tu avatar y tu cara, cada vez que te pruebas un look.', 'If you create your avatar, they are sent to Google (Gemini) to make it, and your avatar and face each time you try on a look.')}</span></li>
      <li>${icY('percha')}<span>${t('Para quitar el fondo de tu ropa y hacer la foto de catálogo, la foto de la prenda pasa por nuestro servidor y por la IA de imagen de Google.', 'To remove the background of your clothes and make the catalogue photo, the garment photo goes through our server and Google’s image AI.')}</span></li>
      ${c && LS.get('tc_pareja') ? `<li>${icY('pareja')}<span>${t('Tu pareja ve tus prendas y sus fotos para combinar looks con los suyos. Tus medidas, tus fotos y tu diagnóstico, no. Lo quitas en Ajustes → Pareja.', 'Your partner sees your garments and their photos to match looks with theirs. Not your measurements, photos or analysis. Turn it off in Settings → Partner.')}</span></li>` : ''}
      <li>${icY('ciudad')}<span>${t('Tu ciudad o tu ubicación solo se usan para darte el tiempo.', 'Your city or location is only used for the weather.')}</span></li>
      <li>${icY('info')}<span>${t('Si llegas desde un enlace nuestro en una red social, contamos esa visita: solo el día y la red, sin cookies ni nada tuyo.', 'If you arrive from one of our links on social media, we count that visit: only the day and the network, with no cookies and nothing about you.')}</span></li></ul>`)
    + grupoP(t('Lo que nos has permitido', 'What you have allowed'), filaP({ id: 'pv-pdiag', ic: 'camara', tit: t('Analizar tus fotos y medidas', 'Analyse your photos and measurements'), val: permiso('diag') ? t('Sí', 'Yes') : t('No', 'No') })
      + (planDemo() === 'pro' ? filaP({ id: 'pv-pavatar', ic: 'avatar', tit: t('Tu avatar', 'Your avatar'), val: permiso('avatar') ? t('Sí', 'Yes') : t('No', 'No') }) : '')
      + (c ? filaP({ id: 'pv-pfotos', ic: 'nube', tit: t('Tus fotos en tu cuenta', 'Your photos in your account'), val: E.perfil?.fotosCuenta ? t('Sí', 'Yes') : t('No', 'No') }) : ''),
      t('Se dan y se retiran en Yo → Tus medidas y fotos y en Tu avatar. Al retirarlos, borramos lo que salió de ellos.', 'You give and withdraw them in Me → Your measurements and photos and in Your avatar. When you withdraw one, we delete what came from it.'))
    + grupoP(t('Permisos del móvil', 'Phone permissions'), filaP({ tag: 'div', ic: 'ciudad', tit: t('Ubicación', 'Location'), val: ubic, flecha: false }) + filaP({ tag: 'div', ic: 'camara', tit: t('Cámara', 'Camera'), val: t('Solo al subir fotos', 'Only when uploading'), flecha: false }),
      t('Los permisos se cambian en los ajustes del navegador o del móvil.', 'Permissions are changed in your browser or phone settings.'))
    + grupoP(t('Tus datos', 'Your data'), filaP({ id: 'pv-exportar', ic: 'bajar', tit: t('Descargar una copia', 'Download a copy'), flecha: false })
      + filaP({ tag: 'label', ic: 'subir', tit: t('Recuperar una copia', 'Restore a copy'), flecha: false, attr: 'id="pv-importar"' }).replace('</label>', '<input type="file" accept="application/json,.json" hidden></label>')
      + filaP({ id: 'pv-borrar', ic: 'borrar', tit: t('Borrar todo de este móvil', 'Delete everything from this phone'), rojo: true, flecha: false })
      + (c ? filaP({ id: 'pv-cuenta', ic: 'borrar', tit: t('Borrar mi cuenta', 'Delete my account'), rojo: true, flecha: false }) : '')),
    cap => {
      cap.querySelector('#pv-exportar').onclick = exportar;
      cap.querySelector('#pv-pdiag').onclick = () => panelDiagFotos(); if (cap.querySelector('#pv-pfotos')) cap.querySelector('#pv-pfotos').onclick = () => panelDiagFotos();
      if (cap.querySelector('#pv-pavatar')) cap.querySelector('#pv-pavatar').onclick = () => { document.querySelectorAll('.pn-capa').forEach(x => x.remove()); ir('yo'); avatarAbierto = true; setTimeout(() => document.querySelector('.av-tarjeta')?.scrollIntoView({ block: 'center' }), 200); };
      cap.querySelector('#pv-importar input').onchange = e => e.target.files[0] && importar(e.target.files[0]);
      cap.querySelector('#pv-borrar').onclick = async () => { if (await confirmar(t('¿Borrar todo?', 'Delete everything?'), t('Prendas, fotos, conjuntos y usos de este móvil. Lo que esté en tu cuenta no se borra.', 'Garments, photos, outfits and uses on this phone. What is in your account is not deleted.'), t('Borrar todo', 'Delete all'))) { for (const k of await BD.claves()) await BD.del(k); localStorage.removeItem('tc_tiempo'); location.reload(); } };
      if (cap.querySelector('#pv-cuenta')) cap.querySelector('#pv-cuenta').onclick = async () => { await borrarCuenta(); cap.remove(); pintarYo(); };
    });
}
// 0.99 (Gabriela, 24/10: «rediseña el perfil de yo, muy cargado y poco estético»): nombre y una línea, una frase sobre el clóset,
// tres filas de lo mío (silueta, estilo, colores), los ajustes de diario y lo técnico plegado en «Más opciones»
/* ---------- 0.12 · tu diagnóstico (Pro). Gabriela, 28/10: «la app es quien te escanea y te da un diagnóstico de colorimetría, silueta y tipo de ropa
   que te favorece… te tiras una foto al inicio de cara y de cuerpo, o las subes… no son cosas aisladas, las fotos del inicio con las opciones que pones
   en Yo… hay que darle más protagonismo en la versión Pro». Motor en diagnostico.js (MediaPipe, en el móvil); reglas en diagnostico-reglas.json.
   En la cuenta se guarda solo el resultado (estación, silueta); los colores medidos de piel, pelo y ojos se quedan en este móvil. ---------- */
const VER_APP = (document.querySelector('script[src*="app.js"]')?.src.split('v=')[1]) || '0';
let DIAG = null; const diagMod = async () => DIAG || (DIAG = { D: await import('./diagnostico.js?v=' + VER_APP), R: await (await fetch('diagnostico-reglas.json?v=' + VER_APP)).json() });
const medidasLocales = () => { if (E.perfil?.diag?.color?.medida) return E.perfil.diag.color.medida; try { return JSON.parse(localStorage.getItem('tc_diag_medidas') || 'null'); } catch (e) { return null; } }; // 10/11: van en el análisis, con la cuenta
function puntosDiag(ps) {
  const reglas = planDemo() === 'pro' && E.perfil?.diag?.cuerpo?.puntos; if (!reglas?.length) return 0;
  const ab = ps.find(p => p.tipo === 'Abajo'), ar = ps.find(p => p.tipo === 'Arriba' && !esCapa(p)), dentro = ps.como === 'por dentro'; let s = 0;
  for (const r of reglas) {
    const vale = v => Array.isArray(r.valor) ? r.valor.includes(v) : r.valor === 'no_liso' ? v && v !== 'liso' : r.valor === v;
    if (r.donde === 'abajo' && ab && vale(estDe(ab)[r.campo])) s += r.p;
    else if (r.donde === 'arriba' && ar && vale(estDe(ar)[r.campo])) s += r.p;
    else if (r.donde === 'look' && ((r.campo === 'como' && dentro) || (r.campo === 'capa' && ps.some(p => p.tipo === 'Abrigo' || esCapa(p))) || (r.campo === 'mismo_color' && ar && ab && ar.color === ab.color))) s += r.p;
  }
  return s;
}
async function hacerDiagnostico(estado) {
  if (!permiso('diag')) throw new Error('permiso'); // 10/11 (Legal, T3)
  const pf = E.perfil || {}, { D, R } = await diagMod(), res = { fecha: hoyISO(), t: new Date().toISOString(), avisos: {}, fotos: firmaFotos(), v: DIAG_V };
  estado(t('Preparando el análisis (la primera vez tarda un poco más)…', 'Getting the analysis ready (slower the first time)…')); await D.cargar();
  if (pf.selfie) {
    estado(t('Mirando tus colores…', 'Looking at your colours…')); const c = await D.analizarCara(pf.selfie); res.avisos.cara = c.prob.map(p => ({ k: p.k, fatal: p.fatal }));
    if (c.ok) { const cm = D.mediaCaras(carasGuardadas(c)), e = D.estacion(cm, R, pf.colores?.r || {}), S = R.colorimetria.estaciones[e.k];
      res.color = { k: e.k, familia: e.familia, n: S.n, d: S.d, hex: S.hex, si: S.si, no: S.no, metal: S.metal, consejo: S.consejo, ejes: e.ejes, confianza: e.confianza, fotos: cm.n,
        medida: { piel: cm.piel.hex, pielN: cm.piel.nombre, pelo: cm.pelo?.hex, peloN: cm.pelo?.nombre, ojos: cm.ojos?.hex, ojosN: cm.ojos?.nombre, contraste: cm.contraste, fotos: cm.n } };
      try { localStorage.removeItem('tc_diag_medidas'); } catch (er) { } }
  }
  // 06/11 (Gabriela: «te debe primero preguntar características físicas… y las fotos son para clasificar tu silueta»): con pecho, cintura y cadera manda la cinta
  // (es más exacta); la foto la confirma y da el largo de las piernas si salen los pies
  const md = pf.medidas || {}, cinta = md.pecho > 0 && md.cintura > 0 && md.cadera > 0; let si = null;
  if (pf.cuerpo) {
    estado(t('Midiendo tu silueta…', 'Measuring your figure…')); const b = await D.analizarCuerpo(pf.cuerpo); res.avisos.cuerpo = b.prob.map(p => ({ k: p.k, fatal: p.fatal }));
    if (b.ok) si = { ...D.silueta(b, R), fuente: 'foto' };
  }
  if (cinta) { const sc = D.siluetaCinta(md, R); si = { ...sc, prop: si?.prop || null, ratios: { ...(si?.ratios || {}), ...sc.ratios }, fuente: 'medidas', foto: si?.k || null }; if (res.avisos.cuerpo) res.avisos.cuerpo = res.avisos.cuerpo.filter(p => !p.fatal); }
  if (si) { const T = R.silueta.tipos[si.k], Pp = si.prop ? R.silueta.proporciones[si.prop] : null;
    res.cuerpo = { k: si.k, prop: si.prop, ratios: si.ratios, confianza: si.confianza, fuente: si.fuente, foto: si.foto || null, altura: md.altura || null, n: T.n, d: T.d, favorece: T.favorece, evitar: T.evitar, propN: Pp ? Pp.n : null, propD: Pp ? Pp.d : null, puntos: [...T.puntos, ...(Pp ? Pp.puntos : [])] }; }
  E.perfil = E.perfil || {}; const ant = E.perfil.diag || {};
  E.perfil.diag = { ...ant, ...res, color: res.color || (pf.selfie ? null : ant.color), cuerpo: res.cuerpo || (pf.cuerpo || cinta ? null : ant.cuerpo) };
  if (res.color) E.perfil.colores = { ...(E.perfil.colores || { r: {} }), est: res.color.familia, sub: res.color.k, fuente: 'foto' };
  if (res.cuerpo) E.perfil.tipoCuerpo = res.cuerpo.k;
  E.propuestas = []; E.generados = []; await guardar(); return { res, R };
}
// 04/11 (Gabriela: «una foto te tiene que servir para todo… tú no puedes seleccionar tu tipo de cuerpo, lo tienes que hacer en la aplicación en función de la foto»):
// las dos fotos del alta se analizan solas, en todas las versiones, cada vez que cambia una; el Pro aplica el resultado a sus looks y a su clóset
const firmaMed = () => { const m = E.perfil?.medidas || {}; return m.pecho > 0 && m.cintura > 0 && m.cadera > 0 ? [m.pecho, m.cintura, m.cadera].join('-') : ''; };
const firmaResp = () => { const r = E.perfil?.colores?.r || {}; return ['venas', 'metal', 'tono', 'contraste'].map(k => r[k] || '-').join(''); }; // al cambiar una respuesta de Mis colores se vuelve a calcular
const firmaFotos = () => ({ selfie: E.perfil?.selfie?.size || 0, cuerpo: E.perfil?.cuerpo?.size || 0, med: firmaMed(), resp: firmaResp() });
// las últimas 5 selfies analizadas (solo sus colores medidos, nunca la foto): la estación sale de su media. 10/11: van con la cuenta (perfil.caras), no en cada móvil
function carasGuardadas(c) {
  const f = firmaFotos().selfie, x = o => o && { L: o.L, a: o.a, b: o.b }; let h = E.perfil.caras;
  if (!Array.isArray(h)) try { h = JSON.parse(localStorage.getItem('tc_diag_caras') || '[]'); } catch (e) { h = []; }
  h = h.filter(q => q.v === DIAG_V && q.f !== f).concat({ v: DIAG_V, f, piel: x(c.piel), pelo: x(c.pelo), ojos: x(c.ojos), contraste: c.contraste, calidad: c.calidad }).slice(-5);
  E.perfil.caras = h; try { localStorage.removeItem('tc_diag_caras'); } catch (e) { }
  return h;
}
// DIAG_V sube cuando cambia el análisis: las fotos guardadas en el móvil se vuelven a analizar solas, sin subirlas otra vez
// (2, 06/11: la foto de cuerpo entero ya no hace caer el análisis y el color de los ojos se mide con el blanco del ojo como referencia;
//  3, 06/11: piel y pelo con el mismo balance de blancos, las cuatro respuestas de Mis colores, media de las selfies, pies opcionales y medidas con cinta;
//  4, 06/11: en la silueta ya no cuentan el brazo que sujeta el móvil, los bolsos ni la mano en la cadera;
//  5, 06/11: con la 4 Gabriela seguía saliendo con hombros más anchos que la cadera; la cadera se mide más abajo y sin recortar las caderas anchas)
const DIAG_V = 5;
const diagPendiente = () => { if (!permiso('diag')) return false; const d = E.perfil?.diag, f = d?.fotos || {}, a = firmaFotos(); return !!((a.selfie && a.selfie !== f.selfie) || (a.cuerpo && a.cuerpo !== f.cuerpo) || (a.med && a.med !== f.med) || (a.selfie && f.resp != null && a.resp !== f.resp) || ((a.selfie || a.cuerpo || a.med) && (d?.v || 1) < DIAG_V)); };
let diagCorriendo = null, diagFallo = 0;
const diagAuto = () => diagCorriendo || (diagCorriendo = hacerDiagnostico(() => { }).catch(() => { diagFallo++; return null; }).finally(() => { diagCorriendo = null; }));
// 10/11: si tras los tres intentos sigue pendiente (el análisis terminó sin resultado y sin error), cuenta como fallo. Si no, Yo y Tu tipo de cuerpo volvían a
// pintarse y a analizar sin fin: en la prueba colgaba la página y en un móvil repetía el análisis gastando batería. Se rearma al cambiar una foto (diagFallo = 0)
async function diagHastaAlDia() { let r = null; for (let i = 0; i < 3 && diagPendiente() && !diagFallo; i++) r = await diagAuto(); if (diagPendiente() && !diagFallo) diagFallo++; return r; }
const textoProb = (R, k) => (R?.problemas?.[k] || R?.problemas?.error || ['', ''])[idioma() === 'en' ? 1 : 0];
function tarjetaDiag() { // la tarjeta de Yo: en el Básico, con la marca Pro; en el Pro, las fotos o el resultado
  const pf = E.perfil || {}, dg = pf.diag, es = idioma() === 'en' ? 1 : 0, pro = planDemo() === 'pro';
  const mini = (k, ic) => `<span class="dg-mini${pf[k] ? ' hecha' : ''}">${pf[k] ? `<img src="${URL.createObjectURL(pf[k])}" alt="">` : `<svg><use href="#${ic}"/></svg>`}</span>`;
  if (!pro) return `<section class="dg-tarjeta"><div class="dg-cab"><h2>${t('Tu asesora de imagen', 'Your image adviser')}</h2><span class="dg-pro">Pro</span></div><p>${t('Con tus mismas fotos, el Pro elige tus looks también según tu silueta y te dice qué prendas de tu clóset te favorecen.', 'With the same photos, Pro also picks your looks for your figure and shows which of your clothes suit you most.')}</p><button class="boton linea" data-diag="plan">${t('Ver el plan Pro', 'See the Pro plan')}</button></section>`;
  // 04/11 (Gabriela: «¿por qué me pide dos veces las fotos, en Mi silueta y Mis colores y otra en el diagnóstico del Pro? Debería ser solo una vez»):
  // en el Pro las fotos y el resultado viven solo en Mi silueta y Mis colores; la tarjeta queda para el Básico y la gratis
  if (pro) return '';
  if (dg?.color || dg?.cuerpo) return `<section class="dg-tarjeta hecho" data-diag="ver" role="button" tabindex="0"><div class="dg-cab"><h2>${t('Tu diagnóstico', 'Your analysis')}</h2><span class="dg-pro">Pro</span></div>
    ${dg.color ? `<div class="dg-tela">${dg.color.hex.map(h => `<i style="background:${h}"></i>`).join('')}</div>` : ''}
    <p class="dg-res">${[dg.color?.n[es], dg.cuerpo?.n[es]].filter(Boolean).join(' · ')}</p><span class="dg-ver">${t('Ver mi diagnóstico', 'See my analysis')}<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></span></section>`;
  return `<section class="dg-tarjeta"><div class="dg-cab"><h2>${t('Tu diagnóstico', 'Your analysis')}</h2><span class="dg-pro">Pro</span></div>
    <div class="dg-fotos">${mini('selfie', 'ic-camara')}${mini('cuerpo', 'ic-cuerpo')}</div>
    <p>${AT ? t('Dos fotos para tus colores y tu silueta. Se quedan en tu móvil.', 'Two photos for your colours and figure. They stay on your phone.') : t('Una foto de tu cara y otra de cuerpo entero: la app analiza tus colores, tu silueta y la ropa que te favorece. Las fotos no salen de tu móvil.', 'A face photo and a full-body photo: the app analyses your colours, your figure and the clothes that suit you. Photos never leave your phone.')}</p>
    ${pf.selfie || pf.cuerpo ? `<p class="dg-d">${!permiso('diag') ? t('Falta tu permiso para analizarlas.', 'Your permission is needed to analyse them.') : diagPendiente() && !diagFallo ? t('Analizando tus fotos…', 'Analysing your photos…') : t('No he podido leer tus fotos. Prueba con otras.', 'I could not read your photos. Try others.')}</p><button class="boton linea" data-diag="fotos">${t('Ver mis fotos', 'See my photos')}</button>` : `<button class="boton" data-diag="fotos">${t('Hacer las fotos', 'Take the photos')}</button>`}</section>`;
}
// 07/11 (Gabriela: «con la foto que yo puse de mi cara y la foto del cuerpo con la que me hicieron el diagnóstico se puede hacer un avatar… el objetivo es que subiendo
// dos fotos te hagan todo el análisis y el avatar»): el avatar sale de esas dos fotos. Se envían una vez al servidor (Gemini) y no se guardan allí; el avatar se queda
// solo en este móvil (perfil.avatar, como las fotos). «Puesto en mí» viste el avatar con las fotos de catálogo de un look; cada resultado se guarda aquí (BD «puestos»).
const IC_PUESTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.8" r="2.4"/><path d="M8.2 21.5 9 13.8 7.3 10.6c-.4-.9.2-2.1 1.2-2.4L12 7.4l3.5.8c1 .3 1.6 1.5 1.2 2.4L15 13.8l.8 7.7"/></svg>';
const firmaAvatar = () => [E.perfil?.selfie?.size || 0, E.perfil?.cuerpo?.size || 0].join(':');
const tieneAvatar = () => E.perfil?.avatar instanceof Blob && permiso('avatar'); // 10/11: sin su permiso, el avatar no se enseña ni se usa
let avatarEnCurso = false, avatarAbierto = false; // avatarAbierto: la fila del avatar desplegada (se abre sola al crearlo)
async function jpegBlanco(b, max = 1024) {
  const u = URL.createObjectURL(b);
  try {
    const im = await cargaImg(u), e = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * e), h = Math.round(im.naturalHeight * e);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
  } finally { URL.revokeObjectURL(u); }
}
// lo medido en el diagnóstico va con las fotos, para que el avatar no salga más delgado ni más alto (en la prueba del 07/11 lo estilizaba)
function siluetaTxt() {
  const b = E.perfil?.diag?.cuerpo, m = E.perfil?.medidas || {}, x = [];
  if (b?.n) x.push('body type ' + b.n[1]);
  if (m.altura > 0) x.push(`height ${m.altura} cm`);
  if (m.pecho > 0 && m.cintura > 0 && m.cadera > 0) x.push(`bust ${m.pecho} cm, waist ${m.cintura} cm, hips ${m.cadera} cm`);
  else if (b?.ratios?.hombros_cadera) x.push(`shoulders to hips width ${(+b.ratios.hombros_cadera).toFixed(2)}, waist to hips width ${(+(b.ratios.cintura_cadera || .7)).toFixed(2)}`);
  return x.join('; ');
}
const errorAvatar = (st, e, puesto) => e === 'permiso' ? t('Falta tu permiso: márcalo en Yo → Tu avatar', 'Your permission is needed: tick it in Me → Your avatar') : st === 403 ? t('El avatar aún está en pruebas', 'The avatar is still being tested')
  : e === 'tope' ? (puesto ? t('Por hoy ya no quedan más. Vuelve mañana', 'No more for today. Come back tomorrow') : t('Por hoy ya has creado tres avatares. Vuelve mañana', 'You’ve created three avatars today. Come back tomorrow'))
  : e === 'tope-mes' ? t('Este mes ya no quedan. Vuelve el mes que viene', 'None left this month. Come back next month')
  : e === 'pausa' ? t('Ahora mismo no se puede. Prueba más tarde', 'Not available right now. Try again later')
  : st === 401 ? t('Entra en tu cuenta', 'Sign in') : t('No ha salido bien. Prueba otra vez', 'It didn’t work. Try again');
// 10/11: si el servidor aún no tiene apuntado el permiso del avatar (se dio sin conexión), se le manda y se prueba una vez más
async function apiAvatar(ruta, fd) {
  let r = await api(ruta, { method: 'POST', body: fd, tiempo: 150000 });
  if (r.status === 403 && (await r.clone().json().catch(() => ({}))).error === 'permiso' && permiso('avatar') && await permisoAlServidor('avatar')) r = await api(ruta, { method: 'POST', body: fd, tiempo: 150000 });
  return r;
}
async function crearAvatar(nota) {
  const pf = E.perfil || {}; if (avatarEnCurso) return;
  if (!cuenta()) return toast(t('Entra en tu cuenta para crear tu avatar', 'Sign in to create your avatar'));
  if (!(pf.selfie instanceof Blob) || !(pf.cuerpo instanceof Blob)) return panelDiagFotos();
  if (!permiso('avatar')) return toast(errorAvatar(403, 'permiso'));
  avatarEnCurso = true; if (E.pantalla === 'yo') pintarYo();
  try {
    const fd = new FormData(); fd.append('cara', await jpegBlanco(pf.selfie), 'cara.jpg'); fd.append('cuerpo', await jpegBlanco(pf.cuerpo), 'cuerpo.jpg');
    const sil = siluetaTxt(); if (sil) fd.append('silueta', sil);
    if (nota?.length && pf.avatar instanceof Blob) { fd.append('nota', nota.join(',')); fd.append('previo', await jpegBlanco(pf.avatar, 768), 'previo.jpg'); } // 09/11: «No me parezco»
    const r = await apiAvatar('/api/avatar?que=avatar', fd);
    if (!r.ok) { const j = await r.json().catch(() => ({})); return toast(errorAvatar(r.status, j.error)); }
    const fin = await afinarCat(await r.blob()); if (!fin) return toast(errorAvatar(502));
    Object.assign(E.perfil, { avatar: fin.blob, avatarAR: fin.ar, avatarDe: firmaAvatar(), avatarF: new Date().toISOString() });
    vaciarProbados(); await guardar(); avatarAbierto = true; toast(t('Tu avatar está listo', 'Your avatar is ready')); setTimeout(preguntarFotosCuenta, 1200);
  } catch (e) { toast(t('Sin conexión: prueba otra vez', 'No connection: try again')); }
  finally { avatarEnCurso = false; if (E.pantalla === 'yo') pintarYo(); }
}
// 09/11 (Gabriela: «creo que se debería mejorar un poco más el parecido»): «No me parezco» dice a la IA en qué falla el avatar; se rehace desde tus dos fotos,
// con el anterior delante para que corrija eso y deje lo demás
const PARECIDO = [['cara', 'La cara', 'The face'], ['pelo', 'El pelo', 'The hair'], ['cuerpo', 'El cuerpo', 'The body'], ['piel', 'El tono de piel', 'The skin tone'], ['altura', 'Las proporciones', 'The proportions'], ['edad', 'La edad', 'The age']];
function panelParecido() {
  const pf = E.perfil || {}; if (!(pf.selfie instanceof Blob) || !(pf.cuerpo instanceof Blob)) return panelDiagFotos();
  abrirPanel(t('No me parezco', 'Not like me'), `<p class="pn-lema">${t('¿En qué no te pareces? Marca lo que falle y rehago tu avatar desde tus dos fotos.', 'What does not look like you? Tick what is wrong and I will redo your avatar from your two photos.')}</p>
    <div class="an-deta pr-op" role="group" aria-label="${t('Lo que falla', 'What is wrong')}">${PARECIDO.map(([k, es, en]) => `<button type="button" data-par="${k}" aria-pressed="false">${t(es, en)}</button>`).join('')}</div>
    <button class="boton" id="pr-ok" disabled>${t('Rehacer mi avatar', 'Redo my avatar')}</button>
    <p class="pn-nota">${t('Tarda unos 30 segundos. Si tu selfie tiene buena luz y estás de frente, sale más parecido.', 'It takes about 30 seconds. A well-lit selfie facing the camera gives a closer likeness.')}</p>`, cap => {
    cap.addEventListener('click', e => { const b = e.target.closest('[data-par]');
      if (b) { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); cap.querySelector('#pr-ok').disabled = !cap.querySelector('[data-par][aria-pressed="true"]'); return; }
      if (e.target.closest('#pr-ok')) { const nota = [...cap.querySelectorAll('[data-par][aria-pressed="true"]')].map(x => x.dataset.par); cap.remove(); avatarAbierto = true; crearAvatar(nota); } });
  });
}
async function borrarAvatar() { // 10/11: borrar el avatar es retirar su permiso (casilla 2 de la privacidad: «puedo borrar mi avatar cuando quiera»)
  if (await retirarPermiso('avatar')) pintarYo();
}
// el look puesto: el avatar y hasta 6 prendas (primero lo que se ve más), con la foto de catálogo si la hay; lo ya hecho sale de este móvil sin gastar
// 07/11 (Gabriela: «quiero que el avatar, cuando se pruebe una ropa, se quede ahí fijo en la opción de avatar, no que desaparezca»): lo último que te pruebas se queda
// puesto en tu avatar (Yo → Tu avatar), con los anteriores debajo para volver a ellos; se guarda en este móvil, como los looks puestos
const ordenPuestos = () => probados().map(x => x.k);
function fijarPuesto(k) { // lo que llevas puesto en Yo, con la cuenta (10/11)
  const pf = E.perfil = E.perfil || {}, ahora = new Date().toISOString(); pf.avatarFijo = k || ''; pf.avatarFijoT = ahora;
  const x = k && (pf.probados || []).find(q => q.k === k); if (x) x.u = ahora;
  BD.set('perfil', pf).catch(() => { }); programarNube();
}
const puestoFijo = () => { const k = E.perfil?.avatarFijo; return k && E.puestos?.[k] instanceof Blob ? k : ''; };
const ORDEN_PUESTO = ['Vestidos', 'Arriba', 'Abajo', 'Abrigo', 'Calzado', 'Bolsos', 'Accesorios'];
const selLook = ps => ps.filter(p => !p.muestra && (p.cat instanceof Blob || p.foto instanceof Blob)).sort((a, b) => ORDEN_PUESTO.indexOf(a.tipo) - ORDEN_PUESTO.indexOf(b.tipo)).slice(0, 6);
const clavePuesto = ps => { const sel = selLook(ps); return sel.length ? sel.map(p => p.id).sort().join('+') + '|' + (E.perfil?.avatarF || '') : ''; };
// 10/11 (Gabriela: «los conjuntos que ya tengan avatar se quedan así… distinguiéndolo con el maniquí que indica avatar coloreado, como que ya tienes esa prueba»)
const yaProbado = ps => { if (planDemo() !== 'pro' || !tieneAvatar()) return false; const k = clavePuesto(ps); return !!k && (E.puestos?.[k] instanceof Blob || (E.perfil?.probados || []).some(x => x.k === k && x.s)); };
async function puestoEnMi(ps, como, otra, soloGuardado) {
  const pf = E.perfil || {}; if (!(pf.avatar instanceof Blob)) return { error: t('Primero crea tu avatar en Yo', 'First create your avatar in Me') };
  if (!permiso('avatar')) return { error: errorAvatar(403, 'permiso') };
  const sel = selLook(ps); if (!sel.length) return { error: t('Este look aún no tiene fotos', 'This look has no photos yet') };
  const k = clavePuesto(ps);
  E.puestos = E.puestos || (await BD.get('puestos').catch(() => null)) || {};
  if (!otra && E.puestos[k] instanceof Blob) { if (!soloGuardado) fijarPuesto(k); return { blob: E.puestos[k], k }; }
  if (soloGuardado) return { nada: true };
  try {
    const fd = new FormData(); fd.append('avatar', await jpegBlanco(pf.avatar), 'avatar.jpg');
    for (const [i, p] of sel.entries()) fd.append('p' + i, await jpegBlanco(p.cat instanceof Blob ? p.cat : p.foto, 768), `p${i}.jpg`);
    fd.append('nombres', JSON.stringify(sel.map(p => p.nombre || ''))); if (como) fd.append('como', como);
    if (pf.selfie instanceof Blob) fd.append('cara', await jpegBlanco(pf.selfie, 768), 'cara.jpg'); // 09/11 (Gabriela: «mejorar un poco más el parecido»): la cara de verdad, para que no se pierda
    const r = await apiAvatar('/api/avatar?que=puesto' + (otra ? '&otra=1' : ''), fd);
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { error: errorAvatar(r.status, j.error, true) }; }
    const fin = await afinarCat(await r.blob()); if (!fin) return { error: errorAvatar(502) };
    nuevoProbado(k, fin.blob); fijarPuesto(k); await BD.set('puestos', E.puestos).catch(() => { }); return { blob: fin.blob, k };
  } catch (e) { return { error: t('Sin conexión: prueba otra vez', 'No connection: try again') }; }
}
// la tarjeta de Yo, solo en el Pro: sin fotos, lleva a ponerlas; con fotos, «Crear mi avatar»; con avatar, el avatar (se toca para verlo), «Rehacer» y «Borrar»
function tarjetaAvatar() {
  if (planDemo() !== 'pro') return '';
  const pf = E.perfil || {}, fotos = pf.selfie instanceof Blob && pf.cuerpo instanceof Blob, av = tieneAvatar(), viejas = av && pf.avatarDe && pf.avatarDe !== firmaAvatar();
  // 07/11 (Gabriela: «el avatar cuando se crea aparece muy pequeño; debería ser una opción dentro, que lo despliegues y se vea grande»): con avatar, la tarjeta es
  // una fila plegable con la miniatura; al desplegarla, el avatar ocupa el ancho y, al tocarlo, se abre a pantalla completa para acercarlo
  if (av && !avatarEnCurso) { const u = URL.createObjectURL(pf.avatar), kf = puestoFijo(), uF = kf ? URL.createObjectURL(E.puestos[kf]) : u, ord = ordenPuestos().filter(k => E.puestos?.[k] instanceof Blob);
    const tira = ord.length ? `<div class="av-tira" role="group" aria-label="${t('Lo que te has probado', 'What you tried on')}"><button class="av-t" data-avatar="fijar" data-k="" aria-pressed="${!kf}" aria-label="${t('Solo el avatar', 'Just the avatar')}"><img src="${u}" alt=""></button>${ord.map((k, i) => `<button class="av-t" data-avatar="fijar" data-k="${escH(k)}" aria-pressed="${k === kf}" aria-label="${t('Look probado', 'Look tried on')} ${i + 1}"><img src="${URL.createObjectURL(E.puestos[k])}" alt=""></button>`).join('')}</div>` : '';
    return `<section class="av-tarjeta av-con"><h2 class="es-tit">${t('Tu avatar', 'Your avatar')}</h2>
      <details class="av-des" ${avatarAbierto ? 'open' : ''}><summary><span class="av-mini"><img src="${uF}" alt=""></span><span class="av-sum"><span class="av-ver">${t('Ver mi avatar', 'See my avatar')}</span><span class="av-plegar">${t('Plegar', 'Fold')}</span></span><svg class="av-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>
        <button class="av-grande" data-avatar="ver" aria-label="${t('Ver tu avatar a pantalla completa', 'See your avatar full screen')}"><img src="${uF}" alt="${kf ? t('Tú con lo último que te has probado', 'You wearing the last look you tried on') : t('Tu avatar', 'Your avatar')}"></button>
        <p class="av-p">${viejas ? t('Tus fotos han cambiado.', 'Your photos have changed.') : kf ? t('Lo último que te has probado.', 'The last look you tried on.') : t(`En Hoy, toca ${IC_PUESTO} para verte el look puesto.`, `In Today, tap ${IC_PUESTO} to see the look on you.`)}</p>${tira}
        <div class="av-acc"><button class="at-enlace" data-avatar="parecido">${t('No me parezco', 'Not like me')}</button><button class="at-enlace" data-avatar="crear">${t('Rehacer', 'Redo')}</button><button class="at-enlace" data-avatar="borrar">${t('Borrar', 'Delete')}</button></div></details></section>`; }
  const img = av ? `<button class="av-img" data-avatar="ver" aria-label="${t('Ver tu avatar', 'See your avatar')}"><img src="${URL.createObjectURL(pf.avatar)}" alt=""></button>` : `<span class="av-img av-vacio">${IC_PUESTO}</span>`;
  const txt = avatarEnCurso ? t('Creando tu avatar… tarda unos 30 segundos.', 'Creating your avatar… it takes about 30 seconds.')
    : av ? (viejas ? t('Tus fotos han cambiado.', 'Your photos have changed.') : t(`En Hoy, toca ${IC_PUESTO} para verte el look puesto.`, `In Today, tap ${IC_PUESTO} to see the look on you.`))
    : fotos ? t('Con tus dos fotos, para verte los looks puestos.', 'From your two photos, to see the looks on you.') : t('Con una foto de tu cara y otra de cuerpo entero.', 'From a photo of your face and a full-body one.');
  const perm = permiso('avatar'), cas = !perm && !avatarEnCurso && fotos ? casillaPermiso('avatar') : '';
  const bot = avatarEnCurso ? '' : av ? `<div class="av-acc"><button class="at-enlace" data-avatar="crear">${t('Rehacer', 'Redo')}</button><button class="at-enlace" data-avatar="borrar">${t('Borrar', 'Delete')}</button></div>`
    : `<button class="at-btn" data-${fotos ? 'avatar="crear"' : 'diag="fotos"'} ${fotos && !perm ? 'disabled' : ''}>${fotos ? t('Crear mi avatar', 'Create my avatar') : t('Añadir mis fotos', 'Add my photos')}</button>`;
  return `<section class="av-tarjeta${avatarEnCurso ? ' creando' : ''}" aria-busy="${avatarEnCurso}"><h2 class="es-tit">${t('Tu avatar', 'Your avatar')}</h2>${img}<p class="av-p">${txt}</p>${cas}${bot}
    ${!av && fotos && !avatarEnCurso && perm ? `<p class="av-priv">${IC_CANDADO}${pf.fotosCuenta ? t('Tus fotos se envían una vez para crearlo. El avatar se guarda en tu cuenta, privado.', 'Your photos are sent once to create it. The avatar is kept in your account, private.') : t('Tus fotos se envían una vez para crearlo y no se guardan. El avatar se queda en tu móvil.', 'Your photos are sent once to create it and are not stored. The avatar stays on your phone.')}</p>` : ''}</section>`;
}
document.addEventListener('toggle', e => { if (!e.target.classList?.contains('av-des')) return; avatarAbierto = e.target.open;
  // 08/11 (Gabriela: «cuando doy en plegar el avatar la página no baja»): al plegar, la página encoge mucho de golpe y Safari se quedaba sin poder desplazarse; se recoloca la posición y se deja la fila del avatar a la vista
  if (!e.target.open) requestAnimationFrame(() => { const p = e.target.closest('.pantalla'); if (p) p.scrollTop = Math.max(0, Math.min(p.scrollTop, p.scrollHeight - p.clientHeight)); e.target.scrollIntoView({ block: 'center' }); }); }, true);
document.addEventListener('change', async e => { const ck = e.target.closest?.('[data-permiso="avatar"]'); if (!ck) return; // 10/11: la casilla 2, en la tarjeta del avatar
  if (ck.checked) { await ponerPermiso('avatar', true); avatarAbierto = true; } if (E.pantalla === 'yo') pintarYo(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-avatar]'); if (!b) return; const k = b.dataset.avatar;
  if (k === 'crear') crearAvatar(); else if (k === 'parecido') panelParecido(); else if (k === 'borrar') borrarAvatar(); else if (k === 'ver' && tieneAvatar()) { const kf = puestoFijo(); verFoto([{ src: URL.createObjectURL(kf ? E.puestos[kf] : E.perfil.avatar), alt: t('Tu avatar', 'Your avatar') }]); }
  else if (k === 'fijar') { fijarPuesto(b.dataset.k); avatarAbierto = true; const c = b.closest('.av-tarjeta'); if (c) c.outerHTML = tarjetaAvatar(); } });
// 06/11 noche (Gabriela: «lo de cómo lo he medido sobra, o al menos ponlo más pequeña la explicación; y quita cambiar las medidas y las fotos si ya hay una opción para eso
// en otra parte»): «Cómo lo he medido», en pequeño; fuera «Cambiar mis medidas y fotos» y «Apuntar mis medidas»: pasan a Yo → Ajustes → Medidas y fotos.
// 06/11 (Gabriela: «sigo esperando que rediseñes todo lo del perfil de tus medidas y fotos, tu diagnóstico, está horrible, lleno de texto, ya te expliqué cómo debe ser»;
// «todo lo que favorece, la distribución espacial, la colorimetría, necesita un buen diseño de interface»): menos texto y gráficos. Medidas con una figura que enseña
// dónde se mide; las fotos se tocan para verlas en grande y se cambian con su propio botón (antes el selector de fotos tapaba la lupa y en el iPhone abría «subir
// otra foto»); el diagnóstico en dos pestañas, Colores y Silueta, con la paleta en cuadros, los tres ejes del color en reglas, la silueta en barras a escala y una
// sola columna de lo que favorece; el detalle, plegado. Propuesta de Producto: equipo/producto/diseno/diagnostico-referencias/INFORME.md, apdo. 4
const FIG_MED = `<svg class="dx-fig" viewBox="0 0 80 156" aria-hidden="true"><circle cx="40" cy="13" r="9"/><path d="M36 23v6Q22 30 20 36Q21 48 24 56Q28 66 28 72Q20 84 19 96L26 152M44 23v6Q58 30 60 36Q59 48 56 56Q52 66 52 72Q60 84 61 96L54 152M40 104V152"/><path class="dx-l" data-l="pecho" d="M20 47a20 4 0 1 0 40 0a20 4 0 1 0 -40 0"/><path class="dx-l" data-l="cintura" d="M26 70a14 3.5 0 1 0 28 0a14 3.5 0 1 0 -28 0"/><path class="dx-l" data-l="cadera" d="M17 95a23 4.5 0 1 0 46 0a23 4.5 0 1 0 -46 0"/></svg>`;
const IC_CANDADO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const IC_BIEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
function panelDiagFotos() {
  const pf = E.perfil || {}, md = pf.medidas || {}, en = idioma() === 'en';
  const campo = (k, et, ud) => `<label class="dx-campo"><span>${et}</span><span class="dx-in"><input type="text" inputmode="decimal" autocomplete="off" data-med="${k}" value="${md[k] ? String(md[k]).replace('.', en ? '.' : ',') : ''}"><i>${ud}</i></span></label>`;
  const foto = (k, tit, ic) => pf[k]
    ? `<div class="dx-foto"><button type="button" class="dx-ver" data-ampliar-diag="${k}" aria-label="${t('Ver en grande', 'View larger')}: ${tit}"><img src="${URL.createObjectURL(pf[k])}" alt=""><span class="dx-lupa" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></svg></span></button><b>${tit}</b><label class="dx-acc"><svg aria-hidden="true"><use href="#ic-camara"/></svg>${t('Cambiar', 'Change')}<input class="dx-oculto" type="file" accept="image/*" data-dgfoto="${k}"></label></div>`
    : `<label class="dx-foto dx-sin"><span class="dx-caja"><svg aria-hidden="true"><use href="#${ic}"/></svg><b>${tit}</b><small>${t('Opcional', 'Optional')}</small></span><span class="dx-acc">${t('Añadir', 'Add')}</span><input class="dx-oculto" type="file" accept="image/*" data-dgfoto="${k}"></label>`;
  const consejos = [[t('Tu cara', 'Your face'), [t('De frente', 'Facing the camera'), t('Con luz de día', 'In daylight'), t('Sin filtros ni gafas', 'No filters or glasses'), t('El pelo suelto', 'Hair down')]],
    [t('Cuerpo entero', 'Full body'), [t('De pie y de frente', 'Standing, facing the camera'), t('Con ropa ajustada', 'In fitted clothes'), t('Los brazos un poco separados', 'Arms slightly away from your body'), t('Si salen los pies, mido también tus piernas', 'If your feet show, I also measure your legs')]]];
  const pd = permiso('diag');
  abrirPanel(t('Tus medidas y tus fotos', 'Your measurements and photos'), `<div class="dx">
    <section class="dx-sec dx-perm">${casillaPermiso('diag', 'pm-diag')}</section>
    <fieldset class="dx-bloq" ${pd ? '' : 'disabled'} aria-describedby="pm-diag-nota">${pd ? '' : `<p class="dx-nota" id="pm-diag-nota">${t('Marca el permiso para apuntar tus medidas y añadir tus fotos.', 'Tick the permission to enter your measurements and add your photos.')}</p>`}
    <section class="dx-sec"><h2 class="dx-h">${t('Tus medidas', 'Your measurements')}</h2>${FIG_MED}
      <div class="dx-campos dos">${campo('altura', t('Altura', 'Height'), 'cm')}${campo('peso', t('Peso', 'Weight'), 'kg')}</div>
      <div class="dx-campos tres">${campo('pecho', t('Pecho', 'Bust'), 'cm')}${campo('cintura', t('Cintura', 'Waist'), 'cm')}${campo('cadera', t('Cadera', 'Hips'), 'cm')}</div>
      <p class="dx-error" id="dx-med-error" aria-live="polite"></p>
      <p class="dx-nota">${t('Rodea el cuerpo con la cinta: el pecho por lo más saliente, la cintura por lo más estrecho y la cadera por lo más ancho.', 'Wrap the tape around your body: bust at the fullest point, waist at the narrowest, hips at the widest.')}</p></section>
    <section class="dx-sec"><h2 class="dx-h">${t('Tus fotos', 'Your photos')}</h2>
      <div class="dx-fotos">${foto('selfie', t('Tu cara', 'Your face'), 'ic-camara')}${foto('cuerpo', t('Cuerpo entero', 'Full body'), 'ic-cuerpo')}</div>
      <details class="dx-mas"><summary>${t('Cómo hacer las fotos', 'How to take the photos')}</summary><div class="dx-cons">${consejos.map(([h, l]) => `<div><h3>${h}</h3><ul>${l.map(x => `<li>${IC_BIEN}${x}</li>`).join('')}</ul></div>`).join('')}</div></details></section>
    <div class="dg-estado" id="dg-estado" aria-live="polite"></div>
    <button class="boton dx-boton" id="dg-analizar" ${pd && (pf.selfie || pf.cuerpo || firmaMed()) ? '' : 'disabled'}>${t('Analizar', 'Analyse')}</button></fieldset>
    ${cuenta() ? `<label class="pm-cas dx-cuenta-cas"><input type="checkbox" id="dg-cuenta" ${pf.fotosCuenta ? 'checked' : ''}><span>${t(...PERMISOS.fotos)}</span></label>` : ''}
    <p class="dx-priv" id="dg-priv">${IC_CANDADO}${pf.fotosCuenta ? t('Privadas: solo tú las ves, en tu móvil y en tu ordenador', 'Private: only you see them, on your phone and computer') : t('Tus fotos se quedan en tu móvil', 'Your photos stay on your phone')}</p></div>`, cap => {
    setTimeout(preguntarFotosCuenta, 600);
    cap.querySelector('#pm-diag').onchange = async e => { const ck = e.target; if (await cambiarPermisoDiag(ck)) { panelDiagFotos(); if (E.pantalla === 'yo') pintarYo(); } };
    const ck = cap.querySelector('#dg-cuenta'); if (ck) ck.onchange = async () => { await fotosEnCuenta(ck.checked); cap.querySelector('#dg-priv').innerHTML = IC_CANDADO + (ck.checked ? t('Privadas: solo tú las ves, en tu móvil y en tu ordenador', 'Private: only you see them, on your phone and computer') : t('Tus fotos se quedan en tu móvil', 'Your photos stay on your phone')); };
    const LIM = { altura: [120, 220], peso: [30, 250], pecho: [60, 170], cintura: [45, 170], cadera: [60, 180] }; let medT = 0;
    cap.querySelectorAll('[data-med]').forEach(inp => {
      const l = cap.querySelector(`.dx-l[data-l="${inp.dataset.med}"]`);
      if (l) { inp.onfocus = () => l.classList.add('on'); inp.onblur = () => l.classList.remove('on'); }
      inp.oninput = () => {
        // la altura también en metros («1,65»): antes se rechazaba sin decir nada y no se guardaba
        const k = inp.dataset.med, txt = inp.value.trim().replace(',', '.'), v0 = parseFloat(txt), v = k === 'altura' && v0 > 1 && v0 < 2.5 ? Math.round(v0 * 100) : v0, ok = !txt || (v >= LIM[k][0] && v <= LIM[k][1]);
        inp.setAttribute('aria-invalid', ok ? 'false' : 'true');
        // 06/11 (Gabriela: «las estoy poniendo en cm: pecho 28, cintura 27 y cadera 38»): eran anchos, no contornos; antes se ignoraban sin avisar
        const malos = [...cap.querySelectorAll('[data-med][aria-invalid="true"]')].map(i => i.dataset.med), err = cap.querySelector('#dx-med-error');
        err.textContent = !malos.length ? '' : malos.includes('altura') ? t('La altura, en cm (165) o en metros (1,65).', 'Height in cm (165) or metres (1.65).')
          : malos.some(m => +(cap.querySelector(`[data-med="${m}"]`).value.replace(',', '.')) < LIM[m][0]) ? t('Parece el ancho: mide el contorno, con la cinta alrededor del cuerpo (una cintura suele medir entre 55 y 110 cm).', 'That looks like a width: measure all the way round with the tape (a waist is usually 55–110 cm).')
          : t('Revisa esa cifra: parece demasiado grande.', 'Check that number: it looks too large.');
        if (!ok) return;
        E.perfil = E.perfil || {}; const m = { ...(E.perfil.medidas || {}) }; if (txt) m[k] = v; else delete m[k]; E.perfil.medidas = m; E.perfil.medidasT = new Date().toISOString(); diagFallo = 0;
        clearTimeout(medT); medT = setTimeout(guardar, 400); $('dg-analizar').disabled = !(permiso('diag') && (E.perfil.selfie || E.perfil.cuerpo || firmaMed()));
      };
    });
    cap.querySelectorAll('[data-dgfoto]').forEach(inp => inp.onchange = async () => { const f = inp.files?.[0]; if (!f || !permiso('diag')) return; try { const r = await procesarFoto(f); E.perfil = E.perfil || {}; E.perfil[inp.dataset.dgfoto] = r.blob; diagFallo = 0; await guardar(); panelDiagFotos(); setTimeout(preguntarFotosCuenta, 400); } catch (e) { toast(t('No he podido leer esa foto', 'Could not read that photo')); } });
    $('dg-analizar').onclick = async () => {
      const b = $('dg-analizar'), est = $('dg-estado'); b.disabled = true;
      try { const { res, R } = await hacerDiagnostico(x => { est.textContent = x; });
        const malos = [...(res.avisos.cara || []).filter(p => p.fatal).map(p => ['cara', p.k]), ...(res.avisos.cuerpo || []).filter(p => p.fatal).map(p => ['cuerpo', p.k])];
        if (malos.length && !res.color && !res.cuerpo) { est.innerHTML = malos.map(([q, k]) => `<p class="dg-mal">${q === 'cara' ? t('Tu cara', 'Your face') : t('Cuerpo entero', 'Full body')}: ${textoProb(R, k)}</p>`).join(''); b.disabled = false; return; }
        cap.remove(); pintarYo(); panelDiag(malos.map(([q, k]) => `${q === 'cara' ? t('Tu cara', 'Your face') : t('Cuerpo entero', 'Full body')}: ${textoProb(R, k)}`));
      } catch (e) { est.innerHTML = `<p class="dg-mal">${t('No he podido hacer el análisis en este móvil. Prueba otra vez con buena conexión.', 'I could not run the analysis on this phone. Try again with a good connection.')}</p>`; b.disabled = false; }
    };
  });
}
const PIEL_N = { clara: ['clara', 'Fair'], media: ['media', 'Medium'], morena: ['morena', 'Tan'], oscura: ['oscura', 'Deep'] };
const PELO_N = { negro: ['negro', 'Black'], castano_oscuro: ['castaño oscuro', 'Dark brown'], castano: ['castaño', 'Brown'], castano_claro: ['castaño claro', 'Light brown'], rubio_oscuro: ['rubio oscuro', 'Dark blonde'], rubio: ['rubio', 'Blonde'], pelirrojo: ['pelirrojo', 'Red'], canoso: ['canoso', 'Grey'] };
const OJOS_N = { verde: ['verdes', 'Green'], azul: ['azules', 'Blue'], gris: ['grises', 'Grey'], avellana: ['avellana', 'Hazel'], marron: ['marrones', 'Brown'], marron_oscuro: ['marrón oscuro', 'Dark brown'] };
const METALES = [['oro rosa', '#D9A38C', ['Oro rosa', 'Rose gold']], ['oro', '#C9A24B', ['Oro', 'Gold']], ['plata', '#B9BDC2', ['Plata', 'Silver']], ['bronce', '#9C6B3C', ['Bronce', 'Bronze']]];
// la silueta en barras a escala: con la cinta, pecho, cintura y cadera en cm; con la foto, hombros, cintura y cadera en proporción
function barrasSilueta(b) {
  const md = E.perfil?.medidas || {}, cinta = b.fuente === 'medidas' && md.pecho > 0 && md.cintura > 0 && md.cadera > 0;
  const filas = cinta ? [[t('Pecho', 'Bust'), md.pecho], [t('Cintura', 'Waist'), md.cintura], [t('Cadera', 'Hips'), md.cadera]]
    : [[t('Hombros', 'Shoulders'), b.ratios.hombros_cadera || 1], [t('Cintura', 'Waist'), b.ratios.cintura_cadera || .7], [t('Cadera', 'Hips'), 1]];
  const max = Math.max(...filas.map(f => f[1])), lect = filas.map(([n, v]) => cinta ? `${n} ${String(v).replace('.', ',')} cm` : n).join(', ');
  return `<div class="dx-barras" role="img" aria-label="${lect}">${filas.map(([n, v]) => `<span>${n}</span><div><i style="width:${Math.round(v / max * 100)}%"></i></div><span>${cinta ? String(v).replace('.', ',') : ''}</span>`).join('')}</div>`;
}
const listaFavor = (l, cls = '') => `<ul class="dx-lista${cls}">${l.map(x => `<li>${cls ? '' : IC_BIEN}<span>${x}</span></li>`).join('')}</ul>`;
const fotosCloset = ps => `<div class="dx-closet">${ps.map(p => `<button data-ficha="${p.id}" aria-label="${(p.nombre || '').replace(/"/g, '')}"><img src="${urlCat(p)}" alt=""></button>`).join('')}</div>`;
async function panelDiag(pendientes = [], tab) {
  const pf = E.perfil || {}, dg = pf.diag || {}, es = idioma() === 'en' ? 1 : 0, m = medidasLocales(), c = dg.color, b = dg.cuerpo, pro = planDemo() === 'pro';
  let R = null; try { R = (await diagMod()).R; } catch (e) { }
  tab = tab || (c ? 'color' : 'silueta');
  const conf = x => x >= .75 ? t('alta', 'high') : x >= .5 ? t('media', 'medium') : t('baja', 'low');
  const pista = (frase, izq, der, v) => `<div class="dx-pista"><b>${frase}</b><div class="dx-raya" aria-hidden="true"><span>${izq}</span><div><i style="left:${Math.round((Math.max(-1, Math.min(1, v)) + 1) * 50)}%"></i></div><span>${der}</span></div></div>`;
  const tres = (v, a, b2, c2) => v < -.2 ? a : v > .2 ? c2 : b2;
  const deMio = c && pro ? E.prendas.filter(p => c.si.includes(p.color) && ['Arriba', 'Vestidos', 'Abrigo'].includes(p.tipo)).slice(0, 6) : [];
  const favor = b && pro ? E.prendas.filter(p => ['Arriba', 'Abajo', 'Vestidos'].includes(p.tipo)).map(p => [p, puntosDiag([p])]).filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 6).map(x => x[0]) : [];
  const avisosC = (dg.avisos?.cara || []).filter(p => !p.fatal).map(p => textoProb(R, p.k)), avisosB = (dg.avisos?.cuerpo || []).filter(p => !p.fatal).map(p => textoProb(R, p.k));
  const falta = (txt) => `<div class="dx-falta"><p>${txt}</p><button class="boton linea" data-diag="fotos">${t('Añadir', 'Add')}</button></div>`;
  let col = falta(t('Con una foto de tu cara, te digo qué colores te favorecen.', 'With a photo of your face, I tell you which colours suit you.'));
  if (c) {
    const metales = METALES.filter(([k]) => c.metal.includes(k)).filter(([k], i, a) => !(k === 'oro' && a.some(x => x[0] === 'oro rosa') && !/oro(?! rosa)/.test(c.metal.replace('oro rosa', ''))));
    const rasgos = m ? [['piel', PIEL_N[m.pielN], t('Piel ', '') , t('', ' skin')], ['pelo', PELO_N[m.peloN], t('Pelo ', ''), t('', ' hair')], ['ojos', OJOS_N[m.ojosN], t('Ojos ', ''), t('', ' eyes')]].filter(([k]) => m[k]) : [];
    col = `<div class="dx-cab"><span>${t('Tu estación', 'Your season')}</span><h2>${c.n[es]}</h2><p>${c.d[es]}</p></div>
      <div class="dx-paleta" role="img" aria-label="${t('Tu paleta', 'Your palette')}">${c.hex.map(h => `<i style="background:${h}"></i>`).join('')}</div>
      ${rasgos.length ? `<div class="dx-rasgos">${rasgos.map(([k, n, a, z]) => `<div><i style="background:${m[k]}"></i><span>${n ? (es ? n[1] + z : a + n[0]) : cap(k)}</span></div>`).join('')}</div>` : ''}
      <div class="dx-pistas">${pista(tres(c.ejes.t, t('Subtono frío', 'Cool undertone'), t('Subtono neutro', 'Neutral undertone'), t('Subtono cálido', 'Warm undertone')), t('Frío', 'Cool'), t('Cálido', 'Warm'), c.ejes.t)}
        ${pista(tres(-c.ejes.v, t('Tonos claros', 'Light tones'), t('Tonos medios', 'Medium tones'), t('Tonos profundos', 'Deep tones')), t('Claros', 'Light'), t('Profundos', 'Deep'), -c.ejes.v)}
        ${pista(tres(c.ejes.i, t('Colores suaves', 'Soft colours'), t('Intensidad media', 'Medium intensity'), t('Colores vivos', 'Bright colours')), t('Suaves', 'Soft'), t('Vivos', 'Bright'), c.ejes.i)}</div>
      <section class="dx-sec"><h3 class="dx-h3">${t('Mejor lejos de la cara', 'Better away from your face')}</h3><div class="dx-lejos">${c.no.map(x => `<div><i style="background:${COLORES.find(q => q[0] === x)?.[1] || '#ccc'}"></i><span>${cap(colNom(x))}</span></div>`).join('')}</div></section>
      ${metales.length ? `<section class="dx-sec"><h3 class="dx-h3">${t('Tu metal', 'Your metal')}</h3><div class="dx-metal">${metales.map(([k, h, n]) => `<div><i style="background:radial-gradient(circle at 35% 30%,#fff 0,${h} 45%,${h} 100%)"></i><span>${n[es]}</span></div>`).join('')}</div>${!es && c.consejo ? `<p class="dx-consejo">${c.consejo}</p>` : ''}</section>` : ''}
      ${deMio.length ? `<section class="dx-sec"><h3 class="dx-h3">${t('De tu clóset, para la cara', 'From your closet, near your face')}</h3>${fotosCloset(deMio)}</section>` : ''}
      <details class="dx-mas dx-peq"><summary>${t('Cómo lo he medido', 'How I measured it')}</summary><ul class="dx-det">
        ${m?.fotos > 1 ? `<li>${t(`Media de tus ${m.fotos} fotos de cara`, `Average of your ${m.fotos} face photos`)}</li>` : ''}
        ${m ? `<li>${t('Contraste', 'Contrast')}: ${m.contraste >= 45 ? t('alto', 'high') : m.contraste >= 28 ? t('medio', 'medium') : t('bajo', 'low')}</li>` : ''}
        <li>${t('Fiabilidad', 'Confidence')}: ${conf(c.confianza)}</li>${avisosC.map(x => `<li>${x}</li>`).join('')}</ul>
        <button class="dx-enl" data-ir="colores">${t('Afinar con cuatro preguntas', 'Fine-tune with four questions')}</button></details>`;
  }
  let sil = falta(t('Con tus medidas o una foto de cuerpo entero, te digo tu silueta.', 'With your measurements or a full-body photo, I tell you your figure.'));
  if (b) {
    const pr = b.ratios?.pierna, fotoDice = b.foto && b.foto !== b.k && R ? R.silueta.tipos[b.foto].n[es].toLowerCase() : '';
    sil = `<div class="dx-cab"><span>${t('Tu silueta', 'Your figure')}</span><h2>${b.n[es]}</h2><p>${b.d[es]}</p></div>
      ${barrasSilueta(b)}
      ${b.fuente !== 'medidas' ? `<p class="dx-nota">${t('Medida en tu foto. Con cinta sale exacta.', 'Measured in your photo. With a tape measure it is exact.')}</p>` : ''}
      ${b.prop && pr ? `<div class="dx-pistas">${pista(b.propN[es], t('Torso largo', 'Long torso'), t('Piernas largas', 'Long legs'), (pr - .47) / .06)}</div>` : ''}
      <section class="dx-sec"><h3 class="dx-h3">${t('Te favorece', 'Flatters you')}</h3>${listaFavor(b.favorece[es])}</section>
      ${favor.length ? `<section class="dx-sec"><h3 class="dx-h3">${t('De tu clóset, lo que más te favorece', 'From your closet, what suits you most')}</h3>${fotosCloset(favor)}</section>` : ''}
      <details class="dx-mas"><summary>${t('Mejor evitar', 'Better avoid')}</summary>${listaFavor(b.evitar[es], ' sin')}</details>
      <details class="dx-mas dx-peq"><summary>${t('Cómo lo he medido', 'How I measured it')}</summary><ul class="dx-det">
        <li>${b.fuente === 'medidas' ? t('Con tus medidas', 'With your measurements') : t('Con tu foto de cuerpo entero', 'With your full-body photo')}${b.altura ? ' (' + (b.altura / 100).toLocaleString(es ? 'en' : 'es', { minimumFractionDigits: 2 }) + ' m)' : ''}</li>
        ${fotoDice ? `<li>${t('Tu foto da ', 'Your photo says ') + fotoDice}</li>` : ''}
        <li>${t('Fiabilidad', 'Confidence')}: ${conf(b.confianza)}</li>${avisosB.map(x => `<li>${x}</li>`).join('')}</ul></details>`;
  }
  const html = `<div class="dx">${pendientes.length ? `<ul class="dx-avisos">${pendientes.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    <div class="dx-tabs" role="tablist">${[['color', t('Colores', 'Colours')], ['silueta', t('Silueta', 'Figure')]].map(([k, n]) => `<button role="tab" id="dxt-${k}" aria-controls="dxp-${k}" aria-selected="${tab === k}" data-dxtab="${k}">${n}</button>`).join('')}</div>
    <div class="dx-panel" role="tabpanel" id="dxp-color" aria-labelledby="dxt-color" ${tab === 'color' ? '' : 'hidden'}>${col}</div>
    <div class="dx-panel" role="tabpanel" id="dxp-silueta" aria-labelledby="dxt-silueta" ${tab === 'silueta' ? '' : 'hidden'}>${sil}</div>
    ${!pro && (c || b) ? `<p class="dx-nota">${t('Con el Pro, tus looks usan también tu silueta y ves qué prendas de tu clóset te favorecen.', 'With Pro, your looks also use your figure and you see which of your clothes suit you.')}</p>` : ''}
    <p class="dx-priv">${IC_CANDADO}${pf.fotosCuenta ? t('Privadas: solo tú las ves, en tu móvil y en tu ordenador', 'Private: only you see them, on your phone and computer') : t('Tus fotos se quedan en tu móvil', 'Your photos stay on your phone')}</p></div>`;
  abrirPanel(t('Tu diagnóstico', 'Your analysis'), html, cap => cap.addEventListener('click', e => {
    const tb = e.target.closest('[data-dxtab]');
    if (tb) { const k = tb.dataset.dxtab; cap.querySelectorAll('[data-dxtab]').forEach(x => x.setAttribute('aria-selected', x === tb)); cap.querySelectorAll('.dx-panel').forEach(p => { p.hidden = p.id !== 'dxp-' + k; }); cap.querySelector('.pn-cuerpo')?.scrollTo?.({ top: 0 }); return; }
    if (e.target.closest('[data-ir],[data-ficha],[data-diag]')) setTimeout(() => cap.remove(), 0);
  }));
}
document.addEventListener('click', async e => { const b = e.target.closest('[data-vercomo]'); if (!b) return; const k = b.dataset.vercomo; PLAN_URL = null; try { localStorage.setItem('tc_plan', k); } catch (er) { }
  E.perfil = E.perfil || {}; E.perfil.verComo = k; E.propuestas = []; E.generados = []; await guardar(); pintarYo(); toast(t(`Viendo la app como ${nomPlan(k)}. Tu ropa y tus looks siguen igual.`, `Viewing the app as ${nomPlan(k)}. Your clothes and looks stay the same.`)); });
document.addEventListener('click', async e => { const b = e.target.closest('[data-diag]'); if (!b) return; const k = b.dataset.diag; if (k === 'plan') return panelPlan(); if (k === 'fotos') return panelDiagFotos();
  if (diagPendiente() && !diagFallo) { toast(t('Analizando…', 'Analysing…')); await diagHastaAlDia(); }
  const dg = E.perfil?.diag; if (!dg?.color && !dg?.cuerpo) return panelDiagFotos(); panelDiag([], k.split('-')[1]); });
// 08/11: tus medidas y tus fotos, en Yo (antes en Ajustes): una fila con las dos fotos en pequeño y las medidas; abre «Tus medidas y tus fotos»
function bloqueFotosYo() {
  const pf = E.perfil || {}, md = pf.medidas || {}, en = idioma() === 'en';
  const mini = (k, ic) => pf[k] instanceof Blob ? `<span class="dg-mini hecha"><img src="${URL.createObjectURL(pf[k])}" alt=""></span>` : `<span class="dg-mini"><svg aria-hidden="true"><use href="#${ic}"/></svg></span>`;
  const alt = md.altura > 0 ? (md.altura / 100).toLocaleString(en ? 'en' : 'es', { minimumFractionDigits: 2 }) + ' m' : '';
  const cinta = md.pecho > 0 && md.cintura > 0 && md.cadera > 0 ? `${md.pecho} · ${md.cintura} · ${md.cadera} cm` : '';
  const n = (pf.selfie instanceof Blob ? 1 : 0) + (pf.cuerpo instanceof Blob ? 1 : 0);
  const l1 = [alt, cinta].filter(Boolean).map(x => `<span class="yo-nw">${x}</span>`).join(' · ') || t('Añade tus medidas', 'Add your measurements'); // en móviles estrechos no se queda «cm» suelto
  const l2 = n === 2 ? t('Tu cara y cuerpo entero', 'Your face and full body') : n === 1 ? t('Falta una foto', 'One photo missing') : t('Añade tus dos fotos', 'Add your two photos');
  return `<section class="yo-fm-sec"><h2 class="es-tit">${t('Tus medidas y fotos', 'Your measurements and photos')}</h2>
    <button class="yo-fm" data-diag="fotos"><span class="yo-fm-fotos">${mini('selfie', 'ic-camara')}${mini('cuerpo', 'ic-cuerpo')}</span>
      <span class="yo-fm-txt"><span>${l1}</span><small>${l2}</small></span><svg class="yo-fm-fl" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></section>`;
}
function pintarYo() {
  const pf = E.perfil || {}, es = idioma() === 'en' ? 1 : 0;
  const fila = (attr, tit, val, oro, flecha = true) => `<button class="item" ${attr}>${tit}<span class="valor${oro ? ' oro' : ''}">${val}${flecha ? '<svg><use href="#ic-flecha"/></svg>' : ''}</span></button>`;
  // 0.108 · Yo = Y3 «Tu armario» con la paleta de Y2 (Gabriela, 28/10: «Y3, pero me gusta mucho la paleta de colores de Y2… deberían unirse»)
  const nom = (pf.nombre || '').trim(), nomB = nom && nom === nom.toUpperCase() ? nom.charAt(0) + nom.slice(1).toLowerCase() : nom;
  $('yo-nombre').textContent = nomB ? t(`El clóset de ${nomB}`, `${nomB}’s closet`) : t('Tu clóset', 'Your closet');
  const rc = E.prendas.length ? resumenCloset() : null;
  $('yo-sub').textContent = [CLOSET_ACT ? t('clóset de pruebas', 'test closet') : '', `${E.prendas.length} ${t('prendas', 'garments')}`, rc ? `${rc.looks} ${t('looks posibles', 'possible looks')}` : ''].filter(Boolean).join(' · ');
  const nCol = {}; E.prendas.forEach(p => { if (p.color) nCol[p.color] = (nCol[p.color] || 0) + 1; });
  const ord = Object.entries(nCol).sort((a, b) => b[1] - a[1]), min = c => c.toLowerCase();
  $('yo-pal').innerHTML = ord.map(([c, n]) => `<i style="flex:${n};background:${COLORES.find(x => x[0] === c)?.[1] || '#ccc'}" title="${c}"></i>`).join('');
  const base = ord.slice(0, 3).map(e => e[0]).filter(c => c !== 'Estampado'), luz = ord.filter(([c]) => !base.includes(c) && !NEUTROS.has(c) && c !== 'Estampado').slice(0, 2).map(e => e[0]);
  const yy = l => l.length > 1 ? l.slice(0, -1).map(min).join(', ') + ' y ' + min(l[l.length - 1]) : l.map(min).join('');
  $('yo-ley').textContent = !base.length ? '' : idioma() === 'en' ? 'The colours of your closet' : `Tu clóset es ${yy(base)}${luz.length ? `; ${luz.length > 1 ? 'el ' + min(luz[0]) + ' y el ' + min(luz[1]) + ' le dan' : 'el ' + min(luz[0]) + ' le da'} la luz` : ''}`;
  $('yo-pal').classList.toggle('oculto', !ord.length);
  const sil = pf.selfie && pf.cuerpo ? t('fotos listas', 'photos ready') : pf.selfie || pf.cuerpo ? t('falta una foto', 'one photo missing') : t('por descubrir', 'to discover');
  const ests = (pf.estilos || []).map(k => ESTILOS.find(x => x.k === k)?.n[es]).filter(Boolean), colO = pf.colores?.est ? EST_COLOR[pf.colores.est] : null;
  const ent = (attr, tit, val) => `<button class="y3-a" ${attr}>${tit}<small>${val}</small></button>`;
  const dg = pf.diag, pend = diagPendiente() && !diagFallo, mira = (k, f) => dg?.[k] ? min(dg[k].n[es]) : !permiso('diag') && (pf[f] || pf.diagEspera) ? t('falta tu permiso', 'needs your OK') : pf[f] ? (pend ? t('analizando…', 'analysing…') : t('prueba otra foto', 'try another photo')) : k === 'color' ? t('con tu selfie', 'from your selfie') : t('con tu foto', 'from your photo'); // 11/11 (análisis, punto 79): una invitación, no una tarea pendiente
  $('yo-lista').innerHTML = ent(dg?.cuerpo || pf.cuerpo ? 'data-diag="ver-silueta"' : 'data-diag="fotos"', t('Mi silueta', 'My figure'), mira('cuerpo', 'cuerpo'))
    + ent('data-ir="estilo"', t('Mi estilo', 'My style'), ests.length ? (ests.length > 2 ? ests.slice(0, 2).map(min).join(', ') + ` +${ests.length - 2}` : ests.map(min).join(t(' y ', ' and '))) : t('elígelo', 'choose it'))
    + ent(dg?.color || pf.selfie ? 'data-diag="ver-color"' : 'data-diag="fotos"', t('Mis colores', 'My colours'), mira('color', 'selfie'));
  $('yo-lista').setAttribute('aria-label', t('Tu perfil', 'Your profile')); $('yo-ajustes-t').textContent = t('Ajustes', 'Settings');
  let fm = $('yo-fm'); if (!fm) { fm = document.createElement('div'); fm.id = 'yo-fm'; $('yo-lista').after(fm); } fm.innerHTML = bloqueFotosYo();
  let td = $('yo-diag'); if (!td) { td = document.createElement('div'); td.id = 'yo-diag'; fm.after(td); } td.innerHTML = tarjetaDiag() + tarjetaAvatar();
  pintarPanelYo();
  if (pend && !diagCorriendo) diagHastaAlDia().then(() => { if (E.pantalla === 'yo') pintarYo(); });
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
  const co = $('a-correo').value.trim(), cl = $('a-clave').value;
  if (co && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(co)) return toast(t('Escribe un correo válido', 'Enter a valid email'));
  if (co && cl.length < 8) return toast(t('La contraseña necesita al menos 8 caracteres', 'Password needs at least 8 characters'));
  const pf = E.perfil || {}; E.perfil = Object.assign(pf, { nombre: $('a-nombre').value.trim() || pf.nombre || '', ciudad: $('a-ciudad').value.trim() || pf.ciudad || '', idioma: idioma(), alta: pf.alta || hoyISO() });
  await guardar(); cargarTiempo(true); ir('silueta');
}
function pintarSilueta() {
  const pf = E.perfil || {}, pd = permiso('diag'), ap = $('ac-perm');
  if (ap) { ap.innerHTML = casillaPermiso('diag', 'pm-diag-alta'); ap.querySelector('input').onchange = async e => { await cambiarPermisoDiag(e.target); pintarSilueta(); }; }
  ['f-selfie', 'f-cuerpo'].forEach(id => { const i = $(id), l = i?.closest('label'); if (!i) return; i.disabled = !pd; l.classList.toggle('bloq', !pd); // 10/11: las fotos, con el permiso
    l.onclick = () => { if (!permiso('diag')) toast(t('Marca antes el permiso de debajo', 'First tick the permission below')); }; });
  [['selfie', 'l-selfie'], ['cuerpo', 'l-cuerpo']].forEach(([k, id]) => { const l = $(id); const bl = pf[k]; l.classList.toggle('hecho', !!bl); l.querySelectorAll('img,i').forEach(x => x.remove()); if (bl) { const im = document.createElement('img'); im.alt = ''; im.src = URL.createObjectURL(bl); l.prepend(im); const i = document.createElement('i'); i.textContent = '✓'; l.append(i); } });
}
async function guardarFotoPerfil(k, file) {
  if (!permiso('diag')) return toast(t('Marca antes el permiso de debajo', 'First tick the permission below'));
  try { const r = await procesarFoto(file); E.perfil = E.perfil || {}; E.perfil[k] = r.blob; diagFallo = 0; await guardar(); pintarSilueta(); toast(k === 'selfie' ? t('Selfie guardada', 'Selfie saved') : t('Foto de cuerpo guardada', 'Body photo saved'));
    // 0.12: con las dos fotos del alta, el diagnóstico se hace solo, por detrás («no son cosas aisladas, las fotos del inicio con las opciones que pones en Yo»)
    diagFallo = 0; diagHastaAlDia().then(r => { if (E.pantalla === 'cuerpo') pintarCuerpo(); if (r && (r.res.color || r.res.cuerpo)) toast(t('Listo: tus colores y tu tipo de cuerpo están en Yo', 'Done: your colours and body type are in Me')); }); }
  catch (e) { toast(t('No he podido leer esa foto', 'Could not read that photo')); }
}

/* ---------- visor de fotos (06/11, Gabriela: «la foto debería poder ampliarse para poder verla y acercarla») ----------
   A pantalla completa; se acerca con dos dedos, con doble toque o con la rueda, y se mueve con un dedo. Con dos fotos (catálogo y original), se cambia abajo. */
function verFoto(fotos, i = 0) {
  document.querySelector('.vf-capa')?.remove(); fotos = fotos.filter(f => f && f.src); if (!fotos.length) return;
  const ant = document.activeElement, cap = document.createElement('div'); cap.className = 'vf-capa'; cap.setAttribute('role', 'dialog'); cap.setAttribute('aria-modal', 'true'); cap.setAttribute('aria-label', t('Foto ampliada', 'Enlarged photo'));
  cap.innerHTML = `<div class="vf-zona"><img alt="" draggable="false"></div><button class="vf-cerrar" aria-label="${t('Cerrar', 'Close')}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    ${fotos.length > 1 ? `<div class="vf-tabs">${fotos.map((f, j) => `<button data-vf="${j}">${f.et}</button>`).join('')}</div>` : ''}<p class="vf-ayuda">${t('Acerca con dos dedos o con doble toque', 'Pinch or double-tap to zoom')}</p>`;
  document.body.appendChild(cap);
  const zona = cap.querySelector('.vf-zona'), img = cap.querySelector('img'); let s = 1, x = 0, y = 0;
  const pinta = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${s})`; cap.classList.toggle('cerca', s > 1); };
  const limita = () => { s = Math.min(5, Math.max(1, s)); if (s === 1) { x = 0; y = 0; return; } const mx = Math.max(0, (img.offsetWidth * s - zona.clientWidth) / 2 + 40), my = Math.max(0, (img.offsetHeight * s - zona.clientHeight) / 2 + 40); x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y)); };
  const elige = j => { img.src = fotos[j].src; img.alt = fotos[j].alt || ''; s = 1; x = 0; y = 0; pinta(); cap.querySelectorAll('[data-vf]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.vf === j))); };
  elige(Math.min(i, fotos.length - 1));
  const pts = new Map(); let d0 = 0, s0 = 1, ult = 0, prev = null;
  zona.addEventListener('pointerdown', e => {
    zona.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); prev = [e.clientX, e.clientY];
    if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); s0 = s; ult = 0; return; }
    const ahora = Date.now(); if (ahora - ult > 300) { ult = ahora; return; }
    ult = 0; if (s > 1) s = 1; else { const r = zona.getBoundingClientRect(); s = 2.5; x = (r.left + r.width / 2 - e.clientX) * 1.5; y = (r.top + r.height / 2 - e.clientY) * 1.5; } limita(); pinta();
  });
  zona.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size >= 2) { const [a, b] = [...pts.values()]; s = s0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / (d0 || 1); limita(); pinta(); }
    else if (s > 1 && prev) { x += e.clientX - prev[0]; y += e.clientY - prev[1]; limita(); pinta(); }
    prev = [e.clientX, e.clientY];
  });
  const suelta = e => { pts.delete(e.pointerId); prev = pts.size ? [...pts.values()][0] : null; };
  zona.addEventListener('pointerup', suelta); zona.addEventListener('pointercancel', suelta);
  zona.addEventListener('wheel', e => { e.preventDefault(); s *= e.deltaY < 0 ? 1.15 : 1 / 1.15; limita(); pinta(); }, { passive: false });
  const tecla = e => { if (e.key === 'Escape') cerrar(); else if (e.key === '+' || e.key === '=') { s *= 1.3; limita(); pinta(); } else if (e.key === '-') { s /= 1.3; limita(); pinta(); } };
  const cerrar = () => { cap.remove(); document.removeEventListener('keydown', tecla); ant?.focus?.(); };
  document.addEventListener('keydown', tecla); cap.querySelector('.vf-cerrar').onclick = cerrar;
  cap.querySelectorAll('[data-vf]').forEach(b => b.onclick = () => elige(+b.dataset.vf)); cap.querySelector('.vf-cerrar').focus();
}
const urlsOrig = new Map(); const urlOriginal = p => p?.original instanceof Blob && !p.originalRota ? (urlsOrig.get(p.id) || (urlsOrig.set(p.id, URL.createObjectURL(p.original)), urlsOrig.get(p.id))) : '';
function ampliarPrenda(id) {
  const p = E.prendas.find(q => q.id === id); if (!p) return; const o = urlOriginal(p);
  verFoto([{ src: urlCat(p), alt: p.nombre, et: p.cat ? t('Catálogo', 'Catalogue') : t('Recortada', 'Cut out') }, o && { src: o, alt: p.nombre, et: t('Tu foto', 'Your photo') }]);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-ampliar],[data-ampliar-diag]'); if (!a) return; e.preventDefault(); e.stopPropagation();
  if (a.dataset.ampliar) return ampliarPrenda(a.dataset.ampliar);
  const k = a.dataset.ampliarDiag, bl = E.perfil?.[k]; if (bl instanceof Blob) verFoto([{ src: URL.createObjectURL(bl), alt: k === 'selfie' ? t('Tu cara', 'Your face') : t('Cuerpo entero', 'Full body') }]);
}, true);

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ir],[data-ficha],[data-filtro],[data-look],[data-idioma],[data-color],[data-oc],[data-sel],[data-plan],[data-gguardar],[data-ghoy]'); if (!b) return;
  if (b.dataset.ir) { e.preventDefault(); if (b.dataset.ir === 'hoy' && E.pantalla === 'inicio' && !E.perfil?.alta) { E.perfil = Object.assign(E.perfil || {}, { alta: hoyISO(), idioma: idioma() }); guardar(); } ir(b.dataset.ir); }
  else if (b.dataset.ficha) abrirFicha(b.dataset.ficha);
  else if (b.dataset.filtro) { E.filtro = b.dataset.filtro; pintarCloset(); }
  else if (b.dataset.look) abrirLook(b.dataset.look);
  else if (b.dataset.idioma) { localStorage.setItem('tc_idioma', b.dataset.idioma); if (E.perfil) { E.perfil.idioma = b.dataset.idioma; guardar(); } traducir(); }
  else if (b.dataset.color) { const de = $('an-colores')?.dataset.sel, enEd = !!b.closest('#an-colores'); pintarColores(b.dataset.color); if (enEd && $('an-nombre')) $('an-nombre').value = nombreConColor($('an-nombre').value, de, b.dataset.color); }
  else if (b.dataset.oc) { $('nl-ocasiones').dataset.sel = b.dataset.oc; $('nl-ocasiones').querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', c.dataset.oc === b.dataset.oc)); }
  else if (b.dataset.gguardar !== undefined) { const g = E.generados[+b.dataset.gguardar]; if (g) { E.conjuntos.unshift({ id: uid(), nombre: g.nombre, ocasion: g.ocasion, ids: g.ids, creada: hoyISO(), usos: [], ...(g.zspec ? { zspec: g.zspec } : {}), ...(g.como ? { como: g.como } : {}) }); E.generados.splice(+b.dataset.gguardar, 1); guardar(); E.propuestas = []; toast(t('Conjunto guardado', 'Outfit saved')); pintarLooks(); } }
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
const entrarYa = async () => { if (!NUBE) { if (!E.perfil?.alta) { E.perfil = Object.assign(E.perfil || {}, { alta: hoyISO(), idioma: idioma() }); await guardar(); } return ir('hoy'); } const b = $('e-entrar'), txt = b.textContent; b.disabled = true; b.textContent = t('Entrando y trayendo tu clóset…', 'Signing in and fetching your closet…'); const ok = await abrirCuenta('entrar', $('e-correo').value.trim(), $('e-clave').value); b.disabled = false; b.textContent = txt; if (!ok) return; if (!E.perfil?.alta) { E.perfil = Object.assign(E.perfil || {}, { alta: hoyISO(), idioma: idioma() }); await guardar(); } ir('closet'); toast(t('Dentro: tu clóset está al día', 'Signed in: your closet is up to date')); };
$('e-entrar').onclick = entrarYa;
// 0.94 (Gabriela, 24/10: «pon visible como opción la contraseña»): botón para ver u ocultar lo escrito
// 06/11 (Gabriela: «que salga el icono clásico del ojo»): el ojo en vez de «Ver»; tachado cuando se ve, para volver a ocultarla
function ojos() { document.querySelectorAll('input[type=password]:not([data-ojo])').forEach(i => { i.dataset.ojo = 1; const b = document.createElement('button'); b.type = 'button'; b.className = 'ac-ver'; const pinta = () => { const v = i.type === 'text'; b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>${v ? '<path d="M4 4l16 16"/>' : ''}</svg>`; b.setAttribute('aria-label', v ? t('Ocultar contraseña', 'Hide password') : t('Ver contraseña', 'Show password')); }; pinta(); b.onclick = e => { e.preventDefault(); i.type = i.type === 'password' ? 'text' : 'password'; pinta(); i.focus(); }; const caja = document.createElement('span'); caja.className = 'ac-clave'; i.replaceWith(caja); caja.append(i, b); }); }
ojos();
// planes (0.12): se elige plan y periodo; el cobro irá por App Store y Google Play, aquí solo se guarda la elección
E.pl = { plan: 'basico', per: 'mes' };
$('p-planes').addEventListener('click', e => {
  const b = e.target.closest('[data-pplan],[data-pper]'); if (!b) return;
  if (b.dataset.pplan) E.pl.plan = b.dataset.pplan; else E.pl.per = b.dataset.pper;
  // 0.74 (Gabriela, 23/10): el marcador dorado solo en lo que eliges ahora; lo elegido antes se queda solo más oscuro
  $('p-planes').classList.toggle('sel-plan', !!b.dataset.pplan); $('p-planes').classList.toggle('sel-per', !!b.dataset.pper);
  $('p-planes').querySelectorAll('[data-pplan]').forEach(x => x.classList.toggle('on', x.dataset.pplan === E.pl.plan));
  $('p-planes').querySelectorAll('[data-pper]').forEach(x => x.classList.toggle('on', x.dataset.pper === E.pl.per));
  $('p-planes').querySelectorAll('[data-pdet]').forEach(x => x.classList.toggle('on', x.dataset.pdet === E.pl.plan));
  $('p-planes').querySelectorAll('.pl-pre[data-mes]').forEach(x => x.textContent = x.dataset[E.pl.per]);
  $('p-planes').querySelectorAll('.pl-per[data-mes]').forEach(x => x.textContent = x.dataset[E.pl.per]);
  $('p-planes').classList.toggle('anual', E.pl.per === 'anual');
});
if (new URLSearchParams(location.search).get('planes') !== 'a') $('p-planes').classList.add('pl-b'); // diseño B por defecto desde la 0.16 (Gabriela: «me gusta la opción B»); ?planes=a, el de dos columnas
$('pl-empezar').addEventListener('click', async () => { E.perfil = Object.assign(E.perfil || {}, { alta: E.perfil?.alta || hoyISO(), idioma: idioma(), planElegido: E.pl.plan, periodo: E.pl.per }); await guardar(); const co = $('a-correo').value.trim(), cl = $('a-clave').value; if (co && cl && !cuenta()) await abrirCuenta('alta', co, cl, E.perfil.nombre); ir('hoy'); toast(t('Tu prueba de 7 días ha empezado', 'Your 7-day trial has started')); });
document.querySelectorAll('[data-social]').forEach(b => b.onclick = () => toast(t(`Entrar con ${b.dataset.social} llegará con las cuentas en la nube. Ahora tu clóset vive en este móvil.`, `${b.dataset.social} sign-in comes with cloud accounts. For now your closet lives on this phone.`)));
$('e-olvido').onclick = () => toast(t('Escríbenos a app@tucloset.app desde tu correo y te ayudamos a entrar.', 'Write to app@tucloset.app from your email and we will help you in.'));
$('a-ubicacion').onclick = () => { if (!navigator.geolocation) return toast(t('Tu navegador no da la ubicación', 'Your browser gives no location')); navigator.geolocation.getCurrentPosition(async p => { E.perfil = Object.assign(E.perfil || {}, { lat: p.coords.latitude, lon: p.coords.longitude, ciudad: '', lugar: '' }); $('a-ciudad').value = ''; await guardar(); await cargarTiempo(true); toast(E.tiempo ? `${E.tiempo.nombre || t('Ubicación', 'Location')} · ${E.tiempo.t}°` : t('Ubicación guardada', 'Location saved')); }, () => toast(t('Sin permiso de ubicación: escribe la ciudad', 'No location permission: type the city'))); };
$('f-selfie').onchange = e => e.target.files[0] && guardarFotoPerfil('selfie', e.target.files[0]);
$('f-cuerpo').onchange = e => e.target.files[0] && guardarFotoPerfil('cuerpo', e.target.files[0]);
$('an-guardar').onclick = () => guardarPrenda(false);
$('an-otra').onclick = () => guardarPrenda(true);
// 06/11 (Gabriela: «la posibilidad visible de eliminar cualquier prenda subida»): la misma función para la papelera de la ficha y para Editar
// 11/11: al borrar una prenda a mano (o «Sí, es la misma»), sus fotos se borran también de la cuenta; antes se quedaban en el servidor para siempre.
// Sin conexión se quedan (el intercambio de clósets de las socias también usa «borradas» y no debe borrar fotos, así que no lo hace el servidor)
function borrarFotosNube(p) { if (!cuenta() || !p || p.ejemplo) return; for (const k of ['', '-o', '-c']) api('/api/foto/' + p.id + k, { method: 'DELETE' }).catch(() => { }); }
async function borrarPrenda(p) {
  if (!p || !await confirmar(t('¿Borrar esta prenda?', 'Delete this garment?'), t('Se quita del clóset y de sus conjuntos.', 'It is removed from the closet and its outfits.'), t('Borrar', 'Delete'))) return;
  // 11/11 (análisis, punto 31): «Deshacer» durante 8 s; las fotos de la cuenta se borran a los 10 s, si no se ha deshecho
  const i = E.prendas.indexOf(p), looksAntes = E.conjuntos.map(c => ({ ...c, ids: [...c.ids] }));
  E.prendas = E.prendas.filter(x => x.id !== p.id); E.conjuntos.forEach(c => c.ids = c.ids.filter(id => id !== p.id)); E.conjuntos = E.conjuntos.filter(c => c.ids.length >= 1); await guardar(); E.propuestas = []; ir('closet');
  const fotos = setTimeout(() => borrarFotosNube(p), 10000);
  toast(t('Prenda borrada', 'Garment deleted'), [t('Deshacer', 'Undo'), async () => {
    clearTimeout(fotos); if (P(p.id)) return;
    E.prendas.splice(Math.min(Math.max(i, 0), E.prendas.length), 0, p); E.conjuntos = looksAntes;
    const b = new Set(JSON.parse(LS.get('tc_nube_borradas') || '[]')); if (b.delete(p.id)) LS.set('tc_nube_borradas', JSON.stringify([...b])); // si ya se subió el borrado, que los otros móviles no la quiten
    await guardar(); E.propuestas = []; E.generados = []; if (E.pantalla === 'closet') pintarCloset(); toast(t('Prenda recuperada', 'Garment restored'));
  }]);
}
$('an-borrar').onclick = () => borrarPrenda(E.editando);
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
      if (q.get('fin') !== '0') setTimeout(() => { el.classList.add('suave'); setTimeout(() => el.remove(), 400); }, 1300); // 0.96: el logo, 1,3 s (antes 3,6 s)
    };
    decide();
  } else if (q.get('fin') !== '0') setTimeout(() => { el.remove(); if ($('p-inicio').classList.contains('activa')) $('p-inicio').classList.add('aparece'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 2250);
}
(async () => {
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true })); // 0.127: primero todos los scripts (el diseño y el motor); si no, en un móvil lento la primera pantalla salía con el diseño antiguo
  entrada(new URLSearchParams(location.search));
  // 09/11: contador de visitas por red (parámetro común de la coordinación de marketing). Se manda una vez y se quita «o» de la dirección: al recargar no cuenta otra vez y no se guarda nada en el móvil
  try { const q = new URLSearchParams(location.search), o = (q.get('o') || '').toLowerCase(); if (q.has('o') && window.top === window) { q.delete('o'); history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); if (/^[a-z0-9-]{1,24}$/.test(o)) { ORIGEN = o; api('/api/visita', { method: 'POST', json: { o }, tiempo: 10000 }).catch(() => { }); } } } catch (e) { }
  E.perfil = (await BD.get('perfil')) || null; E.prendas = (await BD.get('prendas')) || []; E.conjuntos = (await BD.get('conjuntos')) || []; E.agenda = (await BD.get('agenda')) || {};
  E.puestos = (await BD.get('puestos').catch(() => null)) || {}; migrarProbados();
  if (aplicarRetiradas() | diagAEspera()) await BD.set('perfil', E.perfil).catch(() => { }); // 10/11: sin el permiso del diagnóstico, su resultado queda aparte
  try { navigator.storage?.persist?.(); } catch (e) { }
  if (E.perfil?.estilos?.some(k => ESTILO_VIEJO[k])) E.perfil.estilos = [...new Set(E.perfil.estilos.map(k => ESTILO_VIEJO[k] || k))]; // 0.52: los 6 estilos viejos pasan a los 13 // 0.45: que el navegador no borre el clóset para hacer sitio
  let migra = estacionesAuto() > 0; E.conjuntos.forEach(c => { if (c.ejemplo && c.img && !c.img.includes('-recorte')) { c.img = c.img.replace('.webp', '-recorte.webp'); migra = true; } }); if (migra) await guardar();
  traducir(); pintarSilueta();
  // 04/11: la encuesta de las pruebas (Gabriela: «una encuesta sencilla, de marcar nada más, nada de escribir… después de la prueba, que puede ser una semana»)
  setTimeout(() => preguntarEncuesta(new URLSearchParams(location.search).get('encuesta') === '1'), 4000);
  // 04/11: un apunte al día por móvil con cuenta, para el centro de control (cuántas vuelven cada día); fuera de comparar.html
  try { const dia = new Date().toISOString().slice(0, 10); if (cuenta() && window.top === window && LS.get('tc_uso_dia') !== dia) { LS.set('tc_uso_dia', dia); api('/api/uso', { method: 'POST', tiempo: 10000 }).catch(() => { }); } } catch (e) { }
  if (!NUBE) ['a-correo', 'a-clave'].forEach(id => $(id).closest('label').hidden = true);
  document.querySelector('#p-closet .mc-cab')?.insertAdjacentHTML('beforeend', `<div class="cl-cambio">${['', 'pruebas'].map(k => `<button class="${k === CLOSET_ACT ? 'on' : ''}" data-cambio="${k}">${k ? t('Pruebas', 'Test') : t('Mi ropa', 'My clothes')}</button>`).join('')}</div>`); // 0.54 botón provisional (Sheila, 22/10: «me puedes crear un botón provisional»)
  document.addEventListener('click', e => { const b = e.target.closest('[data-cambio]'); if (!b || b.dataset.cambio === CLOSET_ACT) return; try { localStorage.setItem('tc_closet', b.dataset.cambio); } catch (er) { } location.href = location.pathname + '?repaso=0&pantalla=closet'; });
  { const l = +new URLSearchParams(location.search).get('lema'); const t = LEMAS[l - 1]; if (t) $('p-inicio').querySelector('.lema .t').textContent = t; bordar(); }
  const q = new URLSearchParams(location.search);
  for (const k of Object.keys(DIS)) if (DIS[k].vals.includes(q.get(k))) DIS_URL[k] = q.get(k);
  if (VERSIONES.includes(q.get('plan'))) PLAN_URL = q.get('plan');
  aplicarDiseno();
  if (q.get('ejemplo') && !E.prendas.length && !PUBLICA) await cargarEjemplo();
  // 0.96 (Gabriela, 24/10: «se sigue demorando en abrir la app»): con sesión o con prendas se entra directa en Hoy; el repaso de la bienvenida, solo con ?repaso=1
  const REPASO = q.get('repaso') === '1' || (q.get('repaso') !== '0' && !cuenta() && !E.prendas.length); // 0.48 (Gabriela, 22/10: «cada vez que abra la app, salgan todos los pasos con posibilidad de siguiente página»): mientras diseñamos, se entra siempre por la bienvenida y los pasos del alta; ?repaso=0 vuelve a lo de una usuaria real (directo a Hoy)
  const destino = q.get('pantalla') || (REPASO || !(E.perfil?.alta || E.prendas.length) ? 'inicio' : 'closet'); // 04/11 (Gabriela: «cuando una persona entre por su cuenta salga abriendo tu clóset»)
  if (E.perfil) { if (E.perfil.nombre) $('a-nombre').value = E.perfil.nombre; if (E.perfil.ciudad) $('a-ciudad').value = E.perfil.ciudad; } // en el repaso no se pierde lo ya puesto
  if (destino !== 'inicio') { const tc = cargarTiempo(); if (destino === 'hoy') await Promise.race([tc, new Promise(r => setTimeout(r, 1200))]); tc.then(() => cuandoQuieto(() => { if (E.pantalla === 'hoy') pintarHoy(); })).catch(() => { }); } // 0.96: no se espera al tiempo más de 1,2 s; cuando llega, se repinta Hoy
  ir(destino);
  if (q.get('ficha')) abrirFicha(q.get('ficha') === 'primera' ? (E.prendas.find(p => !p.ejemplo && p.tipo === 'Arriba') || E.prendas[0])?.id : q.get('ficha')); // ?ficha=primera: la primera prenda de arriba (iconos.html)
  setTimeout(() => revisarRepetidas().then(n => { if (n && E.pantalla === 'closet') cuandoQuieto(() => pintarCloset()); }).catch(() => { }), cuenta() ? 9000 : 2500); // 05/11: prendas repetidas
  limpiarFotoPrev().catch(() => { }); setTimeout(() => afinarColores().catch(() => 0).then(() => soltarFallosCatalogo()).catch(() => 0).then(() => clasificarViejas()).catch(() => 0).then(() => estilizarNuevas()).catch(() => { }), cuenta() ? 15000 : 0); // 09/11: antes, el nombre y los detalles de lo subido sin ellos; 06/11: fotos de catálogo de las prendas nuevas que se quedaron a medias
  setTimeout(() => recortarOtraVez().catch(() => { }), cuenta() ? 15000 : 4000); // 0.156: recorte nuevo para lo subido desde el 04/11
  setTimeout(medirTodas, 1500); // 0.95: sin repaso con el reconocedor al abrir (bajaba 45 MB y trababa el móvil); el reconocedor solo se usa al subir ropa
  if (cuenta()) setTimeout(async () => { try { if (await bajarNube()) cuandoQuieto(() => { if (E.pantalla === 'hoy') pintarHoy(); else if (E.pantalla === 'closet') pintarCloset(); }); repararFotos().catch(() => { }); await subirNube(); } catch (e) { } setTimeout(enderezarTodas, 3000); }, 800); else setTimeout(enderezarTodas, 5000); // 0.73: al abrir, trae lo de otros móviles y sube lo pendiente
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
function pintarCuerpo() { // 04/11: ya no se elige a mano; sale de la foto de cuerpo entero (Gabriela: «tú no puedes seleccionar tu tipo de cuerpo»)
  const pf = E.perfil || {}, b = pf.diag?.cuerpo, es = idioma() === 'en' ? 1 : 0, sil = $('tc-siluetas'), fav = $('tc-favorece'), sub = $('tc-sub'); sil.classList.add('uno');
  if (!pf.cuerpo) { sub.textContent = t('Con la foto de cuerpo entero, la app te dice tu tipo de cuerpo. Puedes hacerla ahora o más tarde en Yo.', 'With the full-body photo, the app tells you your body type. Take it now or later in Me.'); sil.innerHTML = ''; fav.innerHTML = `<button class="boton linea" data-ir="silueta">${t('Hacer la foto', 'Take the photo')}</button>`; return; }
  if (diagPendiente() && !diagFallo) { sub.textContent = t('Midiendo tu silueta en la foto…', 'Measuring your figure in the photo…'); sil.innerHTML = ''; fav.innerHTML = ''; diagHastaAlDia().then(() => { if (E.pantalla === 'cuerpo') pintarCuerpo(); }); return; }
  if (!b) { sub.textContent = t('No he podido medir tu silueta en esa foto. Prueba con otra de pie, de frente y hasta los pies.', 'I could not measure your figure in that photo. Try another one standing, facing the camera, head to toe.'); sil.innerHTML = ''; fav.innerHTML = `<button class="boton linea" data-ir="silueta">${t('Cambiar la foto', 'Change the photo')}</button>`; return; }
  // 06/11 (Gabriela: «en tu tipo de cuerpo, el desglose de lo que te favorece está suelto en dos columnas y no se entiende bien, está regado»): las barras de la
  // silueta y una sola columna, como en el diagnóstico
  sub.textContent = b.fuente === 'medidas' ? t('Según tus medidas.', 'From your measurements.') : t('Medido en tu foto de cuerpo entero.', 'Measured in your full-body photo.');
  sil.innerHTML = '';
  fav.innerHTML = `<div class="dx tc-dx"><div class="dx-cab"><h2>${b.n[es]}</h2><p>${b.d[es]}</p></div>${barrasSilueta(b)}<h3 class="dx-h3">${t('Te favorece', 'Flatters you')}</h3>${listaFavor(b.favorece[es])}</div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-tcuerpo]'); if (!b) return;
  E.perfil = E.perfil || {}; E.perfil.tipoCuerpo = b.dataset.tcuerpo; if (E.perfil.diag?.cuerpo) E.perfil.diag.cuerpo.puntos = null; await guardar(); pintarCuerpo(); // 0.12: lo que elige a mano manda sobre el diagnóstico
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
// 06/11 (Gabriela: «cuando selecciono mi estilo o mis estilos, debería dejarme guardar todas las que elija, máximo 5 para identificarse; no seleccionar y ya, no sé
// qué pasa después con esa selección»): hasta cinco; lo elegido es un borrador hasta pulsar «Guardar» (desde Yo) o «Seguir» (en el alta), y al guardar se dice
// para qué sirve. Antes, desde Yo, «Seguir» llevaba a los planes
const MAX_ESTILOS = 5;
function pintarEstilo() {
  const es = idioma() === 'en' ? 1 : 0;
  if (E.perfil?.estilos?.some(k => ESTILO_VIEJO[k])) { E.perfil.estilos = [...new Set(E.perfil.estilos.map(k => ESTILO_VIEJO[k] || k))]; guardar(); }
  if (E.pantalla !== 'estilo') { E.esDesde = ['cuerpo', 'planes', 'silueta', 'alta'].includes(E.pantalla) ? 'alta' : 'yo'; E.esBorr = [...(E.perfil?.estilos || [])]; }
  const el = E.esBorr || [], yo = E.esDesde === 'yo';
  if (E.esFam == null) { const pri = ESTILOS.find(x => x.k === el[0]); E.esFam = pri ? pri.f : 0; }
  $('es-sub').textContent = t('¿Con cuáles te identificas? Elige hasta cinco.', 'Which ones feel like you? Pick up to five.');
  const sg = $('es-seguir'), lu = $('es-luego'), at = document.querySelector('#p-estilo .ac-atras');
  sg.textContent = yo ? t('Guardar', 'Save') : t('Seguir', 'Continue'); sg.dataset.ir = yo ? 'yo' : 'planes'; lu.style.display = yo ? 'none' : ''; at.dataset.ir = yo ? 'yo' : 'cuerpo';
  document.querySelector('#p-estilo .ac-pasos')?.toggleAttribute('hidden', yo);
  // 0.74 (Gabriela, 23/10: «hay 4 estilos solamente, ¿no debería haber más?»): los 13 a la vista, por familias, sin pestañas
  $('es-lista').innerHTML = FAMILIAS.map((f, i) => `<h3 class="es-tit">${f[es]}</h3><div class="es-rej">${ESTILOS.filter(x => x.f === i).map(x => `<button class="${el.includes(x.k) ? 'on' : ''}" data-estilo="${x.k}"><span class="es-tela">${x.c.map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${x.n[es]}</b><span class="es-d">${x.d[es]}</span></button>`).join('')}</div>`).join('')
    + `<p class="es-cuenta" aria-live="polite">${el.length ? `<b>${el.length} ${t('de', 'of')} ${MAX_ESTILOS}</b>${el.map(k => ESTILOS.find(x => x.k === k)?.n[es]).filter(Boolean).join(', ')}` : '&nbsp;'}</p>`
    // 0.108 · «Enseñar la cintura» (Gabriela, 28/10: «12. sí»): preferencia de estilo, saltable, guardada solo en este móvil
    + `<div class="es-cint"><h3 class="es-tit">${t('Un detalle más', 'One more thing')}</h3><p>${t('¿Te gusta enseñar la cintura?', 'Do you like showing your waist?')}</p><div>${[['1', t('Sí', 'Yes')], ['0', t('No', 'No')]].map(([v, n]) => `<button data-cintura="${v}" class="${cinturaPref() === v ? 'on' : ''}">${n}</button>`).join('')}</div><span class="es-d">${t('Así sabemos si proponerte tops cortos con pantalones de tiro bajo.', 'So we know whether to suggest crop tops with low-rise trousers.')}</span></div>`
    + bloqueInspo();
}
// 06/11 · Looks que te encantan (Gabriela: «puedes pedirle fotos a la usuaria de 5 outfits… tú vas valorando, eres el que sabe»; Sheila lo propuso el 14/10).
// Hasta cinco fotos de looks (suyos, de Pinterest o de Instagram): el servidor lee la ropa (/api/inspo, IA de visión de Cloudflare) y la foto no se guarda en ningún
// sitio. Lo leído (prendas, colores, estilos, formalidad y ocasión) va en el perfil, viaja con la cuenta, y el motor tira de los estilos y colores que más se repiten
const MAX_INSPO = 5;
let inspoLeyendo = 0;
const hexCol = c => (COLORES.find(x => x[0] === c) || [, '#ccc'])[1];
function inspoResumen() { // los estilos que más se repiten en sus looks y que aún no ha elegido
  const l = E.perfil?.inspo || [], n = {}; l.forEach(x => (x.estilos || []).forEach((e, i) => { n[e] = (n[e] || 0) + (i ? .5 : 1); }));
  const min = l.length >= 3 ? 1.5 : 1, top = Object.entries(n).filter(([, v]) => v >= min).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
  return { top, nuevos: top.filter(k => !(E.esBorr || []).includes(k)) };
}
function bloqueInspo() {
  const es = idioma() === 'en' ? 1 : 0, l = E.perfil?.inspo || [], nomE = k => ESTILOS.find(x => x.k === k)?.n[es] || k;
  const cab = `<h3 class="es-tit" id="es-inspo-t">${t('Looks que te encantan', 'Looks you love')}</h3><p class="es-insp-sub">${t('Sube hasta cinco fotos de looks que te gusten: tuyos, de Pinterest o de Instagram. Leemos la ropa y la foto no se guarda.', 'Add up to five photos of looks you like: yours, from Pinterest or Instagram. We read the clothes and the photo is not kept.')}</p>`;
  if (!cuenta()) return `<section class="es-inspo" aria-labelledby="es-inspo-t">${cab}<p class="es-insp-sub"><button class="es-insp-entrar" data-ir="entrar">${t('Entra en tu cuenta para usarlo', 'Sign in to use it')}</button></p></section>`;
  const tarjeta = (x, i) => `<li class="es-insp"><span class="es-insp-col">${(x.colores || []).map(c => `<i style="background:${hexCol(c)}" title="${colNom(c)}"></i>`).join('')}</span>`
    + `<p>${escH(x.frase || (x.prendas || []).map(p => p.tipo).join(', '))}</p><small>${(x.estilos || []).map(nomE).join(', ')}</small>`
    + `<button class="es-insp-x" data-inspox="${i}" aria-label="${t('Quitar este look', 'Remove this look')}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15"/></svg></button></li>`;
  const leyendo = Array.from({ length: inspoLeyendo }, () => `<li class="es-insp leyendo" aria-busy="true"><p>${t('Leyendo la foto…', 'Reading the photo…')}</p></li>`).join('');
  const caben = MAX_INSPO - l.length - inspoLeyendo;
  const mas = caben > 0 ? `<li class="es-insp es-insp-mas"><label><input type="file" accept="image/*" multiple id="es-inspo-f"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg><span>${l.length ? t('Añadir otro', 'Add another') : t('Añadir looks', 'Add looks')}</span></label></li>` : '';
  const { top, nuevos } = inspoResumen();
  const res = top.length ? `<p class="es-insp-res">${t('Tus looks se parecen a', 'Your looks are close to')} <b>${top.map(nomE).join(t(' y ', ' and '))}</b>.${nuevos.length ? ` <button data-inspoadd="${nuevos.join(',')}">${t('Añadir a mis estilos', 'Add to my styles')}</button>` : ''}</p>` : '';
  return `<section class="es-inspo" aria-labelledby="es-inspo-t">${cab}<ul class="es-insp-l">${l.map(tarjeta).join('')}${leyendo}${mas}</ul>${res}</section>`;
}
async function leerInspo(f) {
  const u = URL.createObjectURL(f);
  try {
    const im = await cargaImg(u), e = Math.min(1, 768 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * e), h = Math.round(im.naturalHeight * e);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .85)); if (!b) return { error: 'foto' };
    const r = await api('/api/inspo', { method: 'POST', body: b, headers: { 'Content-Type': 'image/jpeg' }, tiempo: 45000 });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.error || 'red' };
  } catch (e) { return { error: 'red' }; } finally { URL.revokeObjectURL(u); }
}
document.addEventListener('change', async e => {
  if (e.target.id !== 'es-inspo-f') return;
  const fs = [...e.target.files].slice(0, MAX_INSPO - (E.perfil?.inspo || []).length - inspoLeyendo); if (!fs.length) return;
  inspoLeyendo += fs.length; pintarEstilo();
  let sinRopa = 0, fallo = '';
  await Promise.all(fs.map(async f => {
    const r = await leerInspo(f); inspoLeyendo--;
    if (r.sinRopa) sinRopa++;
    else if (r.error) fallo = fallo || r.error;
    else { E.perfil = E.perfil || {}; E.perfil.inspo = [...(E.perfil.inspo || []), { ...r, fecha: new Date().toISOString().slice(0, 10) }].slice(0, MAX_INSPO); }
    if (E.pantalla === 'estilo') pintarEstilo();
  }));
  await guardar(); E.propuestas = [];
  if (fallo) toast(fallo === 'tope-ia' ? t('Hoy ya no puedo leer más fotos. Prueba mañana.', 'I can’t read more photos today. Try tomorrow.') : fallo === 'tope' ? t('Ya has subido muchas fotos hoy. Prueba mañana.', 'You’ve added many photos today. Try tomorrow.') : t('No he podido leer la foto. Prueba otra vez.', 'I couldn’t read the photo. Try again.'));
  else if (sinRopa) toast(t('No veo ropa en esa foto. Prueba con otra.', 'I can’t see clothes in that photo. Try another one.'));
  if (E.pantalla === 'estilo') { pintarEstilo(); document.getElementById('es-inspo-t')?.scrollIntoView({ block: 'nearest' }); }
});
document.addEventListener('click', async e => {
  const x = e.target.closest('[data-inspox]'), a = e.target.closest('[data-inspoadd]'); if (!x && !a) return;
  if (x) { E.perfil.inspo = (E.perfil.inspo || []).filter((_, i) => i !== +x.dataset.inspox); await guardar(); E.propuestas = []; return pintarEstilo(); }
  const el = E.esBorr || [], nuevos = a.dataset.inspoadd.split(',').filter(k => !el.includes(k)), caben = nuevos.slice(0, Math.max(0, MAX_ESTILOS - el.length));
  if (!caben.length) return toast(t('Ya tienes cinco estilos. Quita uno para añadir otro.', 'You already have five styles. Remove one to add another.'));
  E.esBorr = [...el, ...caben]; pintarEstilo();
  toast(E.esDesde === 'yo' ? t('Añadido. Pulsa «Guardar» para quedártelo.', 'Added. Tap “Save” to keep it.') : t('Añadido a tus estilos', 'Added to your styles'));
});
// 0.117 (Gabriela, 28/10: «7. b»): la preferencia vive en el perfil (viaja con la cuenta); localStorage queda de reserva
const cinturaPref = () => { const v = E.perfil?.cintura; if (v === '1' || v === '0') return v; try { return localStorage.getItem('tc_cintura') || ''; } catch (e) { return ''; } };
const taconBajo = () => E.perfil?.tacon === 'bajo'; // 0.117 (Gabriela, 28/10: «6. a y b»: plano o hasta 3 cm)
document.addEventListener('click', e => { const b = e.target.closest('[data-cintura]'); if (!b) return; const v = cinturaPref() === b.dataset.cintura ? '' : b.dataset.cintura; E.perfil.cintura = v; try { localStorage.setItem('tc_cintura', v); } catch (er) { } guardar(); E.propuestas = []; pintarEstilo(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-esfam]'); if (!b) return; E.esFam = +b.dataset.esfam; pintarEstilo(); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-estilo]'); if (!b) return;
  const el = E.esBorr || [], k = b.dataset.estilo;
  if (!el.includes(k) && el.length >= MAX_ESTILOS) return toast(t('Como mucho cinco. Quita uno para elegir otro.', 'Five at most. Remove one to pick another.'));
  E.esBorr = el.includes(k) ? el.filter(x => x !== k) : [...el, k]; pintarEstilo();
});
// «Guardar» (desde Yo) y «Seguir» (alta) guardan; la flecha de volver y «Ahora no» no
document.addEventListener('click', async e => {
  if (!e.target.closest('#es-seguir')) return;
  E.perfil = E.perfil || {}; const n = (E.esBorr || []).length, antes = (E.perfil.estilos || []).join();
  E.perfil.estilos = [...(E.esBorr || [])]; if (antes !== E.perfil.estilos.join()) { E.propuestas = []; E.generados = []; await guardar(); }
  if (E.esDesde === 'yo') toast(n ? t(`Guardado. Tus looks e ideas se eligen con ${n === 1 ? 'este estilo' : `estos ${n} estilos`}.`, `Saved. Your looks and ideas are now picked with ${n === 1 ? 'this style' : `these ${n} styles`}.`) : t('Guardado. Tus looks ya no se eligen por estilo.', 'Saved. Your looks are no longer picked by style.'));
}, true);

// 0.25: las funciones de cada plan se marcan con el botón dorado solo al tocarlas (Gabriela: «cuando las selecciones sí salga, pero como predeterminada no»)
document.addEventListener('click', e => { const li = e.target.closest('.plb-fun li'); if (li) li.classList.toggle('on'); });
// 0.89: el iPhone no respeta «user-scalable=no»: se frena a mano el pellizco (el doble toque lo frena «touch-action: manipulation» en el CSS)
['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
