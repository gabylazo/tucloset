/* TuCloset · propuesta 014 (Dirección, 29/10/2026, 18:5x). Gabriela, al ver la 013: «la verdad, lo veo horrible, la interfaz va en contra total de mi
   concepto de estética»; referencia única: Zara y Massimo Dutti (fotos grandes, casi sin texto, mucho aire); «los colores se mantienen, el icono se mantiene».
   La letra es la Helvetica fina de las dos tiendas, en mayúsculas pequeñas. Cada prenda va en su baldosa gris con la foto de catálogo y los looks son un
   mosaico de baldosas: sin collage, sin recuadros, sin sombras y sin frases. Colores: nogal, blanco y dorado (este, solo en el nombre y en el corazón).
   Solo actúa con la propuesta 014 (?propuesta=014, o ?ver=014 una vez): sin ella, la app no cambia. */
if (Z14) (() => {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'z14.css?v=0.122b'; document.head.append(l);
  document.documentElement.classList.add('z');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- cabecera: solo el nombre, en el centro (como el de Massimo Dutti) ---------- */
  const cab = document.createElement('header'); cab.className = 'z-cab'; cab.hidden = true;
  cab.innerHTML = `<button class="z-marca" data-ir="looks" aria-label="TuCloset"><span>Tu</span><span class="oro">Closet</span></button>`;
  $('app').prepend(cab);
  const CON_CAB = ['looks', 'closet', 'yo'];
  const irViejo = ir;
  ir = function (nombre, datos) { irViejo(nombre, datos); const s = CON_CAB.includes(E.pantalla); cab.hidden = !s; document.documentElement.classList.toggle('z-con-cab', s); };
  // barra de abajo: solo palabras
  const tb = $('tabs'); if (tb) { const n = { looks: ['Looks', 'Looks'], closet: ['Clóset', 'Closet'], subir: ['Subir', 'Add'], yo: ['Yo', 'Me'] }; tb.querySelectorAll('button').forEach(b => { const x = n[b.dataset.ir], sp = b.querySelector('[data-t]'); if (x && sp) { sp.removeAttribute('data-t'); sp.textContent = x[idioma() === 'en' ? 1 : 0]; } }); }

  /* ---------- mosaico: el look como baldosas de catálogo; arriba las prendas principales, debajo calzado, bolso y accesorios ---------- */
  const rol = p => p.tipo === 'Abrigo' || esCapa(p) ? 'capa' : ({ Arriba: 'top', Abajo: 'bajo', Vestidos: 'vestido', Calzado: 'zapato', Bolsos: 'bolso' }[p.tipo] || 'acc');
  const PRIN = ['capa', 'top', 'vestido', 'bajo'], COMPL = ['zapato', 'bolso', 'acc'];
  const foto = p => p.cat ? urlCat(p) : urlFoto(p);
  const baldosa = (p, ficha) => `<span class="z-b${p.cat || p.src ? '' : ' sin-cat'}" data-k="${rol(p)}"${ficha && !p.muestra ? ` data-ficha="${p.id}" role="button"` : ''}><img src="${foto(p)}" alt="${esc(p.nombre || '')}"></span>`; // sin carga diferida: el look se ve entero desde el primer momento
  window.mosaico = function (ps, clase = '') {
    const pr = ps.filter(p => PRIN.includes(rol(p))).sort((a, b) => PRIN.indexOf(rol(a)) - PRIN.indexOf(rol(b))).slice(0, 4);
    const co = ps.filter(p => !PRIN.includes(rol(p))).sort((a, b) => COMPL.indexOf(rol(a)) - COMPL.indexOf(rol(b))).slice(0, 3);
    const fi = clase.includes('fichas'), bd = p => baldosa(p, fi); // en el look abierto, cada baldosa abre su prenda
    if (pr.length === 1 && co.length) return `<div class="z-mos uno ${clase}" style="--n:${co.length}">${bd(pr[0])}${co.map(bd).join('')}</div>`;
    return `<div class="z-mos ${clase}">${pr.length ? `<div class="z-f p${pr.length}">${pr.map(bd).join('')}</div>` : ''}${co.length ? `<div class="z-f c${co.length}">${co.map(bd).join('')}</div>` : ''}</div>`;
  };
  const conZ = x => conZapato(x.ids.map(P).filter(Boolean), x.zspec, x.como);
  const nomLook = c => c?.nombre && !/^(hoy|today)\b|\d+$/i.test(c.nombre.trim()) ? c.nombre : '';
  const fecha = () => new Date().toLocaleDateString(idioma() === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');

  /* ---------- Looks: Hoy · Mis looks · Calendario, como las subcategorías de Zara ---------- */
  const pestanas = (act, der = '') => `<nav class="z-tabs sinbarra">${[['hoy', t('Hoy', 'Today')], ['mios', t('Mis looks', 'My looks')], ['cal', t('Calendario', 'Calendar')]].map(([k, n]) => `<button class="${act === k ? 'on' : ''}" data-lktab="${k}">${n}</button>`).join('')}${der ? `<span class="z-der">${der}</span>` : ''}</nav>`;
  const X = '<svg viewBox="0 0 16 16"><path d="m4 4 8 8M12 4l-8 8"/></svg>';
  pintarLooks = function () {
    const raiz = $('lk-raiz'); document.documentElement.dataset.looks = 'z';
    if (!['hoy', 'mios', 'cal'].includes(E.lkTab)) E.lkTab = 'hoy';
    raiz.onclick = e => { const b = e.target.closest('[data-lktab],[data-lkoc]'); if (!b) return; if (b.dataset.lktab) { E.lkTab = b.dataset.lktab; E.lkTocado = true; } else E.lkOc = b.dataset.lkoc; pintarLooks(); };
    const w = E.tiempo, dia = new Date().toLocaleDateString(idioma() === 'en' ? 'en-GB' : 'es-ES', { weekday: 'short', day: 'numeric' }).replace(/[.,]/g, '');
    const cabT = pestanas(E.lkTab, E.lkTab === 'hoy' ? `${dia}${w ? ` · ${w.min != null ? `${w.min}°–${w.max}°` : `${w.t}°`}` : ''}` : '');
    if (E.lkTab === 'cal') return pintarCalendario(raiz);
    if (E.lkTab === 'mios') return misLooks(raiz, cabT);
    hoy(raiz, cabT);
  };
  function hoy(raiz, cabT) {
    const planHoy = eventoAhora()?.oc;
    if (!E.propuestas.length) { E.hoyFalta = null; E.plan = planHoy || 'Todos'; proponer(); if (!E.propuestas.length && E.plan !== 'Todos') { E.hoyFalta = E.plan; E.plan = 'Todos'; proponer(); E.propuestas = masCercanos(E.hoyFalta, E.propuestas); } }
    const act = activas(), lista = E.propuestas.slice(0, 8); if ((E.hoyIdx || 0) >= lista.length) E.hoyIdx = 0;
    const w = E.tiempo, lluvia = w?.lluviaH != null ? `<p class="z-dia">${t(`Lluvia a las ${w.lluviaH}:00`, `Rain at ${w.lluviaH}:00`)}</p>` : '';
    const ocs = `<div class="z-ocs sinbarra" id="z-ocs" hidden>${OCASIONES.map(o => `<button class="${o === planHoy ? 'on' : ''}" data-hzoc="${o}">${ocNombre(o)}</button>`).join('')}</div>`;
    let html = cabT + lluvia;
    if (!lista.length) { raiz.innerHTML = html + `<div class="z-vacio"><p>${act.length ? t('Para este tiempo me falta una prenda de arriba y una de abajo, o un vestido.', 'For this weather I need a top and a bottom, or a dress.') : t('Tu look de hoy aparecerá aquí cuando tengas una prenda de arriba, una de abajo y unos zapatos.', 'Your look of the day will appear here once you have a top, a bottom and shoes.')}</p><button class="z-bt" data-ir="subir">${t('Subir prendas', 'Add garments')}</button></div>`; return; }
    const i = E.hoyIdx || 0;
    const ocDe = (pr, ps) => planHoy && !E.hoyFalta && pr.tipo !== 'conjunto' ? planHoy : (pr.c && pr.c.ocasion) || pr.ocasion || ocasionDe(ps);
    html += `<div class="z-carril sinbarra" id="z-carril">${lista.map((pr, k) => { const ps = conZ(pr), oc = ocDe(pr, ps), f = esFav(pr.ids); pr.ocHoy = oc;
      return `<article class="z-slide" data-k="${k}"><div class="z-foto" data-zver>${mosaico(ps, 'grande')}</div>
        <div class="z-info"><div class="z-l1"><button class="z-oc" data-zoc aria-expanded="false">${ocNombre(oc)}</button><span class="z-cnt">${k + 1} / ${lista.length}</span><button class="z-ic" data-zno aria-label="${t('No me gusta', 'Not for me')}">${X}</button><button class="z-fav${f ? ' on' : ''}" data-zfav aria-pressed="${f}" aria-label="${t('Favorito', 'Favourite')}">${CORAZON}</button></div>
        </div></article>`; }).join('')}</div>${ocs}<div class="z-pie"><button class="z-bt" data-zpongo>${t('Me lo pongo', 'I’ll wear it')}</button></div>`;
    raiz.innerHTML = html;
    const carril = $('z-carril');
    if (i) carril.scrollLeft = i * carril.clientWidth;
    carril.onscroll = () => { E.hoyIdx = Math.round(carril.scrollLeft / carril.clientWidth); };
    raiz.querySelector('.z-pie').onclick = () => { const pr = lista[E.hoyIdx || 0]; if (pr) ponerse(pr.ids, pr.c); };
    carril.onclick = async e => {
      const b = e.target.closest('[data-zfav],[data-zoc],[data-zno],[data-zver]'); if (!b) return;
      if (b.dataset.zoc != null) { const o = $('z-ocs'); o.hidden = !o.hidden; b.setAttribute('aria-expanded', !o.hidden); return; }
      const pr = lista[+b.closest('.z-slide').dataset.k];
      if (b.dataset.zfav != null) { e.stopPropagation(); await alternarFav(pr.ids, pr.ocHoy); b.classList.toggle('on', esFav(pr.ids)); b.setAttribute('aria-pressed', esFav(pr.ids)); }
      else if (b.dataset.zno != null) { anotarGusto(pr.ids, 'no'); const g = E.perfil.gustos, k = [...pr.ids].sort().join(); if (pr.tipo === 'propuesta') g.fuera = [...(g.fuera || []), k].slice(-300); else { if (g.hoy?.d !== hoyISO()) g.hoy = { d: hoyISO(), k: [] }; g.hoy.k.push(k); } await guardar(); E.propuestas.splice(E.propuestas.indexOf(pr), 1); pintarLooks(); }
      else { const cj = E.conjuntos.find(x => claveLook(x.ids) === claveLook(pr.ids)); if (cj) abrirLook(cj.id); }
    };
  }
  function misLooks(raiz, cabT) {
    const hayFav = E.conjuntos.some(c => c.fav || esFav(c.ids)), ocs = ['Todo', ...(hayFav ? ['Fav'] : []), ...OCASIONES.filter(o => E.conjuntos.some(c => (c.ocasion || 'Diario') === o))];
    if (!ocs.includes(E.lkOc)) E.lkOc = 'Todo';
    const n = o => o === 'Todo' ? E.conjuntos.length : o === 'Fav' ? E.conjuntos.filter(c => c.fav || esFav(c.ids)).length : E.conjuntos.filter(c => (c.ocasion || 'Diario') === o).length;
    const lista = E.conjuntos.filter(c => E.lkOc === 'Todo' || (E.lkOc === 'Fav' ? c.fav || esFav(c.ids) : (c.ocasion || 'Diario') === E.lkOc));
    const filtros = `<div class="z-ocs sinbarra">${ocs.map(o => `<button class="${o === E.lkOc ? 'on' : ''}" data-lkoc="${o}">${o === 'Todo' ? t('Todos', 'All') : o === 'Fav' ? t('Favoritos', 'Favourites') : ocNombre(o)}</button>`).join('')}<button class="z-mas" data-ir="nuevo-look">+ ${t('Crear', 'Create')}</button></div>`;
    const tarjeta = c => { const ps = conZ(c), f = c.fav || esFav(c.ids), nom = nomLook(c);
      return `<article class="z-look"><div class="z-foto" data-look="${c.id}">${mosaico(ps, 'mini')}</div>
        <div class="z-l1"><span>${esc(nom || ocNombre(c.ocasion || 'Diario'))}</span><button class="z-fav${f ? ' on' : ''}" data-lkfav="${c.id}" aria-pressed="${f}" aria-label="${t('Favorito', 'Favourite')}">${CORAZON}</button></div>
        <small>${nom ? `${ocNombre(c.ocasion || 'Diario')} · ` : ''}${usosTxt(c)}</small></article>`; };
    raiz.innerHTML = cabT + filtros + (lista.length ? `<div class="z-rej">${lista.map(tarjeta).join('')}</div>`
      : `<div class="z-vacio"><p>${E.lkOc === 'Fav' ? t('Aún no tienes favoritos. Toca el corazón de un look.', 'No favourites yet. Tap the heart on a look.') : t('Aún no tienes looks guardados. En Hoy, toca el corazón de los que te gusten.', 'No saved looks yet. In Today, tap the heart on the ones you like.')}</p><button class="z-bt" data-lktab="hoy">${t('Ver los de hoy', 'See today’s')}</button></div>`);
    raiz.querySelectorAll('[data-lkfav]').forEach(b => b.onclick = async ev => { ev.stopPropagation(); const c = E.conjuntos.find(x => x.id === b.dataset.lkfav); if (!c) return; const g = E.perfil.gustos = E.perfil.gustos || { si: {}, no: {} }, k = claveLook(c.ids); g.fav = g.fav || []; const ya = c.fav || g.fav.includes(k); g.fav = ya ? g.fav.filter(x => x !== k) : [...g.fav, k]; c.fav = !ya; await guardar(); pintarLooks(); });
  }
  // el look abierto: el mosaico grande y sus prendas en baldosas
  const abrirLookViejo = abrirLook;
  abrirLook = function (id) {
    abrirLookViejo(id); const c = E.conjuntos.find(x => x.id === id); if (!c) return;
    $('lk-foto').innerHTML = mosaico(conZ(c), 'grande fichas');
    const nom = nomLook(c); $('lk-nombre').textContent = nom || ocNombre(c.ocasion || 'Diario');
    $('lk-piezas').querySelectorAll('img').forEach(im => { const p = P(im.closest('[data-ficha]')?.dataset.ficha); if (p?.cat) im.src = urlCat(p); });
  };

  /* ---------- Clóset: la rejilla de una tienda (2 columnas, o 3 con el botón) ---------- */
  let cols = 2; try { cols = +localStorage.getItem('tc_z_cols') || 2; } catch (e) {}
  const usoTxt = p => { const n = (p.usos || []).length; return n ? `${n} ${n === 1 ? t('uso', 'wear') : t('usos', 'wears')}` : t('Sin estrenar', 'Not worn yet'); };
  pintarCloset = function () {
    const todas = E.prendas, cats = ['Todo', ...CATS_ORDEN.filter(c => todas.some(p => catDe(p) === c))];
    if (!cats.includes(E.filtro)) E.filtro = 'Todo';
    const q = E.busca.trim().toLowerCase();
    const lista = todas.filter(p => (E.filtro === 'Todo' || catDe(p) === E.filtro) && pasaFiltros(p) && (!q || [p.nombre, p.color, catDe(p), p.notas].join(' ').toLowerCase().includes(q)));
    const nf = Object.values(E.f).reduce((s, v) => s + v.length, 0); $('mc-nf').textContent = nf || '';
    let c = $('z-mc-cab'); if (!c) { c = document.createElement('div'); c.id = 'z-mc-cab'; c.className = 'z-mc-cab'; $('p-closet').querySelector('.mc-cab').replaceWith(c); }
    if (!c.contains($('cats'))) c.prepend($('cats'));
    c.querySelectorAll(':scope>button').forEach(b => b.remove());
    c.insertAdjacentHTML('beforeend', `<button data-zfiltro>${t('Filtros', 'Filters')}${nf ? ` (${nf})` : ''}</button><button class="z-ic" data-zbusca aria-label="${t('Buscar', 'Search')}"><svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.6"/><path d="m10.4 10.4 3.6 3.6"/></svg></button><button class="z-vista" data-zcols aria-label="${t('Cambiar la vista', 'Change view')}"><svg viewBox="0 0 16 16">${cols === 2 ? '<rect x="1.5" y="1.5" width="5.5" height="13"/><rect x="9" y="1.5" width="5.5" height="13"/>' : '<rect x="1" y="1.5" width="3.6" height="13"/><rect x="6.2" y="1.5" width="3.6" height="13"/><rect x="11.4" y="1.5" width="3.6" height="13"/>'}</svg></button>`);
    c.onclick = e => { const b = e.target.closest('[data-zcols],[data-zfiltro],[data-zbusca]'); if (!b) return;
      if (b.dataset.zcols != null) { cols = cols === 2 ? 3 : 2; try { localStorage.setItem('tc_z_cols', cols); } catch (er) {} pintarCloset(); }
      else if (b.dataset.zfiltro != null) $('mc-filtrar').click();
      else { const caja = $('busca-caja'); caja.classList.toggle('z-abierta'); if (caja.classList.contains('z-abierta')) $('busca').focus(); } };
    if (q) $('busca-caja').classList.add('z-abierta');
    $('cats').innerHTML = cats.map(k => `<button class="${k === E.filtro ? 'activo' : ''}" data-filtro="${k}">${catTxt(k)}</button>`).join('');
    const pared = $('pared'); pared.dataset.cols = cols;
    pared.innerHTML = lista.map(p => `<button class="z-prenda" data-ficha="${p.id}" aria-label="${esc(p.nombre)}"><span class="z-b${p.cat ? '' : ' sin-cat'}"><img src="${urlCat(p)}" alt="" loading="lazy">${p.estado ? `<i>${estadoTxt(p.estado)}</i>` : ''}</span><b>${esc(p.nombre)}</b><small>${usoTxt(p)}</small></button>`).join('');
    $('closet-vacio').innerHTML = todas.length ? (lista.length ? '' : `<div class="z-vacio"><p>${t('Nada con ese filtro.', 'Nothing matches.')}</p></div>`) : `<div class="z-vacio"><p>${t('Haz una foto a cada prenda sobre un fondo liso. Con tres ya hay look de hoy.', 'Photograph each garment on a plain background. With three there is already a look for today.')}</p><button class="z-bt" data-ir="subir">${t('Subir prendas', 'Add garments')}</button></div>`;
    if (!$('mc-hoja').hidden) pintarFiltros();
  };

  /* ---------- Prenda: la foto grande, el nombre y los datos en filas (como la ficha de Massimo Dutti) ---------- */
  const abrirFichaViejo = abrirFicha;
  abrirFicha = function (id) {
    abrirFichaViejo(id); const p = P(id); if (!p) return;
    $('f-img').src = urlCat(p); $('f-img').closest('.f-foto').classList.toggle('sin-cat', !p.cat);
    let ln = $('z-f-linea'); if (!ln) { ln = document.createElement('p'); ln.id = 'z-f-linea'; ln.className = 'z-f-linea'; $('f-uso').after(ln); }
    ln.textContent = [...$('f-datos').querySelectorAll('dd')].map(d => d.textContent.trim()).filter(x => x && x !== '0' && x !== '—').slice(0, 5).join(' · ');
    const conj = E.conjuntos.filter(c => c.ids.includes(id));
    $('f-asi').innerHTML = conj.length ? `<div class="z-tira sinbarra">${conj.slice(0, 8).map(c => `<button class="z-mini" data-look="${c.id}">${mosaico(conZ(c), 'mini')}</button>`).join('')}</div>` : `<p class="z-nota">${t('Aún no está en ningún look.', 'Not in any look yet.')}</p>`;
    const tit = $('p-ficha').querySelector('.asi .tit b'); if (tit) tit.textContent = t('Looks con esta prenda', 'Looks with this garment');
  };

  /* ---------- Yo: el nombre, tres cifras y la lista ---------- */
  const pintarYoViejo = pintarYo;
  pintarYo = function () {
    pintarYoViejo();
    const pf = E.perfil || {}, nom = (pf.nombre || '').trim();
    $('yo-nombre').textContent = nom ? t(`Hola, ${nom}`, `Hello, ${nom}`) : t('Tu clóset', 'Your closet');
  };
  tarjetaDiag = function () {
    const dg = E.perfil?.diag, pro = planDemo() === 'pro', k = !pro ? 'plan' : dg?.color || dg?.cuerpo ? 'ver' : 'fotos';
    return `<nav class="y3-nav z-diag"><button class="y3-a" data-diag="${k}">${t('Tu diagnóstico', 'Your analysis')}<small>${pro ? (k === 'ver' ? t('Ver', 'See') : t('Hacer las fotos', 'Take the photos')) : 'Pro'}</small></button></nav>`;
  };

  /* ---------- repintar cuando llegan las fotos de catálogo ---------- */
  let rt; window.stRepintar = () => { clearTimeout(rt); rt = setTimeout(() => cuandoQuieto(() => { if (E.pantalla === 'looks') pintarLooks(); else if (E.pantalla === 'closet') pintarCloset(); }), 400); };
})();
