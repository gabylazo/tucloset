/* TuCloset · propuesta 013 (Dirección, 29/10/2026, 01:4x). Gabriela: «ES HORROROSO TODO LO QUE HE VISTO… apóyate en otras IAs».
   Diseño hecho por Stitch (Google Labs), sistema «Alta Costura Minimalista»: Bodoni Moda en los títulos, EB Garamond en el texto, DM Sans en las
   etiquetas; blanco, nogal y dorado; esquinas rectas (equipo/producto/diseno/stitch/). Las prendas, con su foto de catálogo hecha con Gemini a partir
   de la suya (p.cat); si no la tiene, la de siempre. Solo actúa con la propuesta 013 (?propuesta=013, o ?ver=013 una vez): sin ella, la app no cambia. */
if (ST) (() => {
  const css = h => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.append(l); };
  css('https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400..600&family=EB+Garamond:ital,wght@0,400..600;1,400..500&family=DM+Sans:opsz,wght@9..40,400..600&display=swap');
  css('st.css?v=0.121');
  document.documentElement.classList.add('st');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const may = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  /* ---------- cabecera fija (Stitch): el nombre en su letra, la sección y el acceso a Yo ---------- */
  const SECCION = { looks: ['Looks', 'Looks'], closet: ['Clóset', 'Closet'], yo: ['Yo', 'Me'], ficha: ['Prenda', 'Garment'], look: ['Look', 'Look'], colores: ['Mis colores', 'My colours'], cuenta: ['Cuenta', 'Account'] };
  const cab = document.createElement('header'); cab.className = 'st-cab'; cab.hidden = true;
  cab.innerHTML = `<button class="st-marca" data-ir="looks" aria-label="TuCloset"><span>Tu</span><span class="oro">Closet</span></button><span class="st-sec" id="st-sec"></span><button class="st-yo" data-ir="yo" aria-label="${t('Yo', 'Me')}"><svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.4"/><path d="M5.5 19.5c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5"/></svg></button>`;
  $('app').prepend(cab);
  const irViejo = ir;
  ir = function (nombre, datos) {
    irViejo(nombre, datos);
    const s = SECCION[E.pantalla]; cab.hidden = !s; document.documentElement.classList.toggle('st-con-cab', !!s);
    if (s) $('st-sec').textContent = s[idioma() === 'en' ? 1 : 0];
  };
  // barra de abajo: los nombres de Stitch
  const tb = $('tabs'); if (tb) { const n = { looks: ['Looks', 'Looks'], closet: ['Clóset', 'Closet'], subir: ['Subir', 'Add'], yo: ['Yo', 'Me'] }; tb.querySelectorAll('button').forEach(b => { const x = n[b.dataset.ir], sp = b.querySelector('[data-t]'); if (x && sp) { sp.removeAttribute('data-t'); sp.textContent = x[idioma() === 'en' ? 1 : 0]; } }); }

  /* ---------- bodegón: el look como una foto de catálogo, con las prendas en sitios fijos según lo que lleve ---------- */
  const rol = p => p.tipo === 'Abrigo' || esCapa(p) ? 'capa' : ({ Arriba: 'top', Abajo: 'bajo', Vestidos: 'vestido', Calzado: 'zapato', Bolsos: 'bolso' }[p.tipo] || 'acc');
  // x, y, ancho, alto sobre una tarjeta de 100 × 125 (4:5); se pinta en el orden de la lista (lo último, encima)
  function sitios(r) {
    const z = r.zapato, b = r.bolso;
    if (r.vestido) return r.capa ? { vestido: [8, 3, 56, 116, 'center top'], capa: [58, 3, 40, 54, 'left top'], bolso: [60, 60, 36, 30], zapato: [60, b ? 94 : 70, 38, 28, 'center bottom'], acc: [4, 4, 18, 18] }
      : { vestido: [10, 3, 56, 116, 'center top'], bolso: [64, 22, 32, 30], zapato: [62, 84, 36, 30, 'center bottom'], acc: [70, 60, 22, 20] };
    if (r.capa) return { top: [30, 0, 40, 40, 'center top'], capa: [2, 4, 52, 66, 'right top'], bajo: [50, 28, 48, z || b ? 92 : 96, 'left top'], bolso: b && z ? [6, 72, 30, 22] : [6, 76, 32, 30], zapato: [6, b ? 96 : 84, 40, b ? 26 : 34, 'center bottom'], acc: [82, 4, 16, 18] };
    return { top: [3, 5, 58, 56, 'right center'], bajo: [46, 10, 50, z || b ? 104 : 110, 'left top'], bolso: z ? [6, 64, 30, 26] : [6, 72, 34, 34], zapato: b ? [4, 92, 40, 30, 'center bottom'] : [8, 66, 34, 40, 'center center'], acc: [76, 4, 18, 18] }; // sin bolso, el calzado en el centro del hueco de abajo
  }
  const ORDEN = ['acc', 'top', 'capa', 'vestido', 'bolso', 'bajo', 'zapato'];
  window.bodegon = function (ps, clase = '') {
    const r = {}; ps.forEach(p => { const k = rol(p); if (!r[k]) r[k] = p; else if (k === 'top' && !r.capa) r.capa = p; });
    const s = sitios(r), ks = ORDEN.filter(k => r[k] && s[k]);
    const piezas = ks.map(k => { const p = r[k], src = p.cat ? urlCat(p) : urlFoto(p), ar = AR.get(src) || null; if (!ar) medir(src); return { k, p, src, ar, caja: s[k] }; });
    // con la proporción de cada foto se sabe dónde queda de verdad cada prenda dentro de su hueco: el conjunto se centra y se amplía hasta llenar la tarjeta
    let rects = null;
    if (piezas.every(q => q.ar)) {
      rects = piezas.map(({ ar, caja: [x, y, w, h, pos = 'center'] }) => { const dw = Math.min(w, h * ar), dh = dw / ar, [px, py = 'center'] = pos.split(' ');
        return [x + (px === 'left' ? 0 : px === 'right' ? w - dw : (w - dw) / 2), y + (py === 'top' ? 0 : py === 'bottom' ? h - dh : (h - dh) / 2), dw, dh]; });
      const x0 = Math.min(...rects.map(q => q[0])), y0 = Math.min(...rects.map(q => q[1])), x1 = Math.max(...rects.map(q => q[0] + q[2])), y1 = Math.max(...rects.map(q => q[1] + q[3]));
      const f = Math.min(92 / (x1 - x0), 117 / (y1 - y0), 1.25), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      rects = rects.map(([x, y, w, h]) => [50 + (x - cx) * f, 62.5 + (y - cy) * f, w * f, h * f]);
    }
    const imgs = piezas.map(({ k, p, src, caja }, i) => { const [x, y, w, h] = rects ? rects[i] : caja, cat = !!p.cat || !!p.src;
      return `<img class="bg-p bg-${k}${cat ? '' : ' sin-cat'}" src="${src}" alt="${esc(p.nombre || '')}" style="left:${x.toFixed(2)}%;top:${(y / 1.25).toFixed(2)}%;width:${w.toFixed(2)}%;height:${(h / 1.25).toFixed(2)}%;object-position:${rects ? 'center' : caja[4] || 'center'}">`; }).join('');
    return `<div class="bodegon ${clase}">${imgs}</div>`;
  };
  // proporción (ancho / alto) de cada foto, por su dirección; la primera vez se mide y se repinta
  const AR = new Map(), midiendo = new Set();
  function medir(src) { if (!src || midiendo.has(src)) return; midiendo.add(src); const im = new Image(); im.onload = () => { if (im.naturalHeight) AR.set(src, im.naturalWidth / im.naturalHeight); if (typeof stRepintar === 'function') stRepintar(); }; im.src = src; }
  const piezasTxt = ps => { const base = ps.filter(p => !['Calzado', 'Bolsos', 'Accesorios'].includes(p.tipo)), comp = ps.filter(p => ['Calzado', 'Bolsos', 'Accesorios'].includes(p.tipo));
    return { base: base.map(p => p.nombre).join(' · '), comp: comp.map(p => p.muestra ? t('zapatos de muestra', 'sample shoes') : p.nombre).join(' · ') }; };
  const nomLook = (pr, oc) => pr.c?.nombre || (pr.nombre && !/\d+$/.test(pr.nombre) ? pr.nombre : '') || `${ocNombre(oc)} ${t('de hoy', 'for today')}`;

  /* ---------- Looks: Hoy · Mis looks · Calendario ---------- */
  const pestanas = act => `<nav class="st-tabs">${[['hoy', t('Hoy', 'Today')], ['mios', t('Mis looks', 'My looks')], ['cal', t('Calendario', 'Calendar')]].map(([k, n]) => `<button class="${act === k ? 'on' : ''}" data-lktab="${k}">${n}</button>`).join('')}${act === 'mios' ? `<span class="st-cuenta">${E.conjuntos.length} ${E.conjuntos.length === 1 ? 'look' : 'looks'}</span>` : ''}</nav>`;
  pintarLooks = function () {
    const raiz = $('lk-raiz'); document.documentElement.dataset.looks = 'st';
    if (!['hoy', 'mios', 'cal'].includes(E.lkTab)) E.lkTab = 'hoy';
    raiz.onclick = e => { const b = e.target.closest('[data-lktab],[data-lkoc]'); if (!b) return; if (b.dataset.lktab) { E.lkTab = b.dataset.lktab; E.lkTocado = true; } else E.lkOc = b.dataset.lkoc; pintarLooks(); };
    const cabT = pestanas(E.lkTab);
    if (E.lkTab === 'cal') return pintarCalendario(raiz); // trae su propia cabecera y pestañas (se repinta sola); st.css las viste como las de Stitch
    if (E.lkTab === 'mios') return misLooks(raiz, cabT);
    hoy(raiz, cabT);
  };
  function hoy(raiz, cabT) {
    const planHoy = eventoAhora()?.oc;
    if (!E.propuestas.length) { E.hoyFalta = null; E.plan = planHoy || 'Todos'; proponer(); if (!E.propuestas.length && E.plan !== 'Todos') { E.hoyFalta = E.plan; E.plan = 'Todos'; proponer(); E.propuestas = masCercanos(E.hoyFalta, E.propuestas); } }
    const act = activas(), hayCapas = act.some(p => p.tipo === 'Abrigo' || esCapa(p)), hayZap = act.some(p => p.tipo === 'Calzado'), fresco = hayCapas ? '' : avisoTiempo([]);
    const lista = E.propuestas.slice(0, 8); if ((E.hoyIdx || 0) >= lista.length) E.hoyIdx = 0;
    const w = E.tiempo, fecha = new Date().toLocaleDateString(idioma() === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const tiempo = w ? `<span class="st-pt">·</span><span>${w.min != null ? `${w.min}°–${w.max}°` : `${w.t}°`}</span>${w.lluviaH != null ? `<span class="st-pt">·</span><span>${t(`lluvia a las ${w.lluviaH}:00`, `rain at ${w.lluviaH}:00`)}</span>` : ''}` : '';
    const ocs = `<div class="st-chips sinbarra">${OCASIONES.map(o => `<button class="${o === planHoy ? 'on' : ''}" data-hzoc="${o}">${ocNombre(o)}</button>`).join('')}</div>`;
    const avisos = [fresco, !hayZap && t('Los zapatos son de muestra hasta que subas los tuyos.', 'Shoes are samples until you upload yours.')].filter(Boolean);
    let html = cabT + `<div class="st-dia"><span>${fecha}</span>${tiempo}</div>` + ocs + (avisos.length ? `<p class="st-aviso">${avisos.join(' ')} <button data-ir="subir">${t('Subir prendas', 'Add garments')}</button></p>` : '');
    if (!lista.length) { raiz.innerHTML = html + `<div class="st-vacio"><p>${act.length ? t('Me falta una parte de arriba y una de abajo, o un vestido, para este tiempo.', 'I need a top and a bottom, or a dress, for this weather.') : t('Tu look de hoy aparecerá aquí en cuanto tengas una prenda de arriba, una de abajo y unos zapatos.', 'Your look of the day will appear here once you have a top, a bottom and shoes.')}</p><button class="st-bt" data-ir="subir">${t('Subir mis prendas', 'Add my garments')}</button></div>`; return; }
    const i = E.hoyIdx || 0, pr = lista[i], ps = pr.ids.map(P).filter(Boolean), psZ = conZapato(ps, pr.zspec, pr.como), fav = esFav(pr.ids);
    const oc = planHoy && !E.hoyFalta && pr.tipo !== 'conjunto' ? planHoy : (pr.c && pr.c.ocasion) || pr.ocasion || ocasionDe(ps); pr.ocHoy = oc;
    const porque = porqueHoy(pr, ps, hayCapas), tx = piezasTxt(psZ);
    html += `<article class="st-heroe"><div class="st-foto" data-stficha>${bodegon(psZ, 'grande')}<span class="st-et">${t('Propuesta', 'Look')} ${i + 1} ${t('de', 'of')} ${lista.length}</span><button class="st-fav${fav ? ' on' : ''}" data-stfav aria-pressed="${fav}" aria-label="${t('Favorito', 'Favourite')}">${CORAZON}</button></div>
      <h2 class="st-tit">${esc(nomLook(pr, oc))}</h2>
      ${porque ? `<p class="st-porque">${esc(porque)}</p>` : ''}
      <dl class="st-piezas"><div><dt>${t('Prendas', 'Garments')}</dt><dd>${esc(tx.base)}</dd></div>${tx.comp ? `<div><dt>${t('Complementos', 'Accessories')}</dt><dd>${esc(tx.comp)}</dd></div>` : ''}</dl>
      <button class="st-bt" data-stpongo><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>${t('Me lo pongo', 'I’ll wear it')}</button>
      <div class="st-fila"><button class="st-sub" data-stotro><svg viewBox="0 0 24 24"><path d="M19 8a7.5 7.5 0 0 0-13.4 1M5 16a7.5 7.5 0 0 0 13.4-1M19 4v4h-4M5 20v-4h4"/></svg>${t('Probar otro look', 'Try another look')}</button><button class="st-no" data-stno>${t('No me gusta', 'Not for me')}</button></div></article>`;
    const otras = lista.map((x, k) => [x, k]).filter(([, k]) => k !== i);
    if (otras.length) html += `<section class="st-otras"><div class="st-h"><h3>${t('Otras opciones para hoy', 'Other options for today')}</h3><span>${otras.length} ${otras.length === 1 ? t('opción', 'option') : t('opciones', 'options')}</span></div><div class="st-tira sinbarra">${otras.map(([x, k]) => { const xs = conZapato(x.ids.map(P).filter(Boolean), x.zspec, x.como), o = (x.c && x.c.ocasion) || x.ocasion || ocasionDe(xs); return `<button class="st-mini" data-stver="${k}"><span class="st-foto">${bodegon(xs, 'mini')}</span><b>${esc(nomLook(x, o))}</b><small>${esc(piezasTxt(xs).base)}</small></button>`; }).join('')}</div></section>`;
    raiz.innerHTML = html;
    raiz.querySelector('.st-heroe').onclick = async e => {
      const b = e.target.closest('[data-stfav],[data-stpongo],[data-stotro],[data-stno],[data-stficha]'); if (!b) return;
      if (b.dataset.stfav != null) { e.stopPropagation(); await alternarFav(pr.ids, pr.ocHoy); b.classList.toggle('on', esFav(pr.ids)); b.setAttribute('aria-pressed', esFav(pr.ids)); }
      else if (b.dataset.stpongo != null) await ponerse(pr.ids, pr.c);
      else if (b.dataset.stotro != null) { E.hoyIdx = (i + 1) % lista.length; pintarLooks(); $('p-looks').scrollTo({ top: 0, behavior: 'smooth' }); }
      else if (b.dataset.stno != null) { anotarGusto(pr.ids, 'no'); const g = E.perfil.gustos, k = [...pr.ids].sort().join(); if (pr.tipo === 'propuesta') g.fuera = [...(g.fuera || []), k].slice(-300); else { if (g.hoy?.d !== hoyISO()) g.hoy = { d: hoyISO(), k: [] }; g.hoy.k.push(k); } await guardar(); E.propuestas.splice(E.propuestas.indexOf(pr), 1); pintarLooks(); }
      else { const cj = E.conjuntos.find(x => claveLook(x.ids) === claveLook(pr.ids)); if (cj) abrirLook(cj.id); }
    };
    raiz.querySelectorAll('[data-stver]').forEach(b => b.onclick = () => { E.hoyIdx = +b.dataset.stver; pintarLooks(); $('p-looks').scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  function misLooks(raiz, cabT) {
    const hayFav = E.conjuntos.some(c => c.fav || esFav(c.ids)), ocs = ['Todo', ...(hayFav ? ['Fav'] : []), ...OCASIONES.filter(o => E.conjuntos.some(c => (c.ocasion || 'Diario') === o))];
    if (!ocs.includes(E.lkOc)) E.lkOc = 'Todo';
    const n = o => o === 'Todo' ? E.conjuntos.length : o === 'Fav' ? E.conjuntos.filter(c => c.fav || esFav(c.ids)).length : E.conjuntos.filter(c => (c.ocasion || 'Diario') === o).length;
    const lista = E.conjuntos.filter(c => E.lkOc === 'Todo' || (E.lkOc === 'Fav' ? c.fav || esFav(c.ids) : (c.ocasion || 'Diario') === E.lkOc));
    const chips = ocs.length > 1 ? `<div class="st-chips sinbarra">${ocs.map(o => `<button class="${o === E.lkOc ? 'on' : ''}" data-lkoc="${o}">${o === 'Todo' ? t('Todos', 'All') : o === 'Fav' ? `${CORAZON}${t('Favoritos', 'Favourites')}` : ocNombre(o)} <i>${n(o)}</i></button>`).join('')}</div>` : '';
    const tarjeta = c => { const ps = conZapato(c.ids.map(P).filter(Boolean), c.zspec, c.como), f = c.fav || esFav(c.ids), tx = piezasTxt(ps), cols = [...new Set(ps.filter(p => !p.muestra).map(p => COLORES.find(x => x[0] === p.color)?.[1]).filter(Boolean))].slice(0, 5);
      return `<article class="st-look"><div class="st-foto" data-look="${c.id}">${bodegon(ps, 'grande')}<span class="st-et">${ocNombre(c.ocasion || 'Diario')}</span><button class="st-fav${f ? ' on' : ''}" data-lkfav="${c.id}" aria-pressed="${f}" aria-label="${t('Favorito', 'Favourite')}">${CORAZON}</button></div>
        <div class="st-h"><h3>${esc(c.nombre)}</h3><span>${ps.length} ${t('piezas', 'pieces')} · ${usosTxt(c)}</span></div><p class="st-desc">${esc([tx.base, tx.comp].filter(Boolean).join(' · '))}</p>
        ${cols.length ? `<div class="st-paleta"><span>${t('Paleta', 'Palette')}</span><span class="st-tonos">${cols.map(h => `<i style="background:${h}"></i>`).join('')}</span></div>` : ''}
        <div class="st-dos"><button class="st-bt" data-lkpongo="${c.id}">${t('Ponérmelo', 'Wear it')}</button><button class="st-bt claro" data-look="${c.id}">${t('Ver look', 'See look')}</button></div></article>`; };
    raiz.innerHTML = cabT + chips + `<button class="st-sub st-crear" data-ir="nuevo-look"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>${t('Crear un look con mi ropa', 'Create a look from my clothes')}</button>` + (lista.length ? `<div class="st-lista">${lista.map(tarjeta).join('')}</div>`
      : `<div class="st-vacio"><p>${E.lkOc === 'Fav' ? t('Aún no tienes favoritos: toca el corazón de un look.', 'No favourites yet: tap the heart on a look.') : t('Aún no tienes looks guardados. En Hoy, toca el corazón de los que te gusten.', 'No saved looks yet. In Today, tap the heart on the ones you like.')}</p><button class="st-bt" data-lktab="hoy">${t('Ver los de hoy', 'See today’s')}</button></div>`);
    raiz.querySelectorAll('[data-lkfav]').forEach(b => b.onclick = async ev => { ev.stopPropagation(); const c = E.conjuntos.find(x => x.id === b.dataset.lkfav); if (!c) return; const g = E.perfil.gustos = E.perfil.gustos || { si: {}, no: {} }, k = claveLook(c.ids); g.fav = g.fav || []; const ya = c.fav || g.fav.includes(k); g.fav = ya ? g.fav.filter(x => x !== k) : [...g.fav, k]; c.fav = !ya; await guardar(); pintarLooks(); });
    raiz.querySelectorAll('[data-lkpongo]').forEach(b => b.onclick = ev => { ev.stopPropagation(); const c = E.conjuntos.find(x => x.id === b.dataset.lkpongo); if (c) ponerse(c.ids, c); });
  }
  // el look abierto: el bodegón grande
  const abrirLookViejo = abrirLook;
  abrirLook = function (id) { abrirLookViejo(id); const c = E.conjuntos.find(x => x.id === id); if (!c) return; $('lk-foto').innerHTML = bodegon(conZapato(c.ids.map(P).filter(Boolean), c.zspec, c.como), 'grande'); $('lk-piezas').querySelectorAll('img').forEach(im => { const p = P(im.closest('[data-ficha]')?.dataset.ficha); if (p?.cat) im.src = urlCat(p); }); };

  /* ---------- Clóset: «Mi armario» con la rejilla de catálogo ---------- */
  const usoTxt = p => { const n = (p.usos || []).length; return n ? `${n} ${n === 1 ? t('uso', 'wear') : t('usos', 'wears')}` : ''; };
  pintarCloset = function () {
    const todas = E.prendas, cats = ['Todo', ...CATS_ORDEN.filter(c => todas.some(p => catDe(p) === c))];
    if (!cats.includes(E.filtro)) E.filtro = 'Todo';
    const q = E.busca.trim().toLowerCase();
    const lista = todas.filter(p => (E.filtro === 'Todo' || catDe(p) === E.filtro) && pasaFiltros(p) && (!q || [p.nombre, p.color, catDe(p), p.notas].join(' ').toLowerCase().includes(q)));
    const nf = Object.values(E.f).reduce((s, v) => s + v.length, 0); $('mc-nf').textContent = nf || '';
    let c = $('st-mc-cab'); if (!c) { c = document.createElement('div'); c.id = 'st-mc-cab'; c.className = 'st-mc-cab'; $('p-closet').querySelector('.mc-cab').replaceWith(c); }
    c.innerHTML = `<div><span class="st-lab">${t('Tu armario', 'Your wardrobe')}</span><h1>${t('Mi clóset', 'My closet')}</h1></div><div class="st-n"><b>${todas.length}</b><span>${t('prendas', 'garments')}</span></div>`;
    $('cats').innerHTML = cats.map(k => `<button class="${k === E.filtro ? 'activo' : ''}" data-filtro="${k}">${catTxt(k)} <i>${k === 'Todo' ? todas.length : todas.filter(p => catDe(p) === k).length}</i></button>`).join('');
    $('pared').innerHTML = lista.map(p => `<button class="st-prenda" data-ficha="${p.id}" aria-label="${esc(p.nombre)}"><span class="st-img${p.cat ? '' : ' sin-cat'}"><img src="${urlCat(p)}" alt="" loading="lazy">${usoTxt(p) ? `<i>${usoTxt(p)}</i>` : ''}${p.estado ? `<i class="izq">${estadoTxt(p.estado)}</i>` : ''}</span><small>${catTxt(catDe(p))}</small><b>${esc(p.nombre)}</b><span class="st-col">${esc(colNom(p.color) || '')}</span></button>`).join('');
    $('closet-vacio').innerHTML = todas.length ? (lista.length ? '' : `<div class="st-vacio"><p>${t('Nada con ese filtro.', 'Nothing matches.')}</p></div>`) : `<div class="st-vacio"><p>${t('Haz una foto a cada prenda sobre un fondo liso. Con tres ya hay look de hoy.', 'Photograph each garment on a plain background. With three there is already a look for today.')}</p><button class="st-bt" data-ir="subir">${t('Subir mis prendas', 'Add my garments')}</button></div>`;
    if (!$('mc-hoja').hidden) pintarFiltros();
  };

  /* ---------- Prenda: la foto de catálogo arriba, el nombre y los datos en una tabla ---------- */
  const abrirFichaViejo = abrirFicha;
  abrirFicha = function (id) {
    abrirFichaViejo(id); const p = P(id); if (!p) return;
    $('f-img').src = urlCat(p); $('f-img').closest('.f-foto').classList.toggle('sin-cat', !p.cat);
    let et = $('st-f-et'); if (!et) { et = document.createElement('p'); et.id = 'st-f-et'; et.className = 'st-lab'; $('f-nombre').before(et); }
    et.textContent = [catTxt(catDe(p)), may(colNom(p.color) || ''), estNombre(p.estacion)].filter(Boolean).join(' · ');
    const conj = E.conjuntos.filter(c => c.ids.includes(id));
    $('f-asi').innerHTML = conj.length ? `<div class="st-tira sinbarra">${conj.slice(0, 8).map(c => `<button class="st-mini" data-look="${c.id}"><span class="st-foto">${bodegon(conZapato(c.ids.map(P).filter(Boolean), c.zspec, c.como), 'mini')}</span><b>${esc(c.nombre)}</b></button>`).join('')}</div>` : `<p class="st-desc">${t('Aún no está en ningún look. Toca «Hoy llevo esto» o añádela a uno.', 'Not in any look yet. Tap “I’m wearing this today” or add it to one.')}</p>`;
    const tit = $('p-ficha').querySelector('.asi .tit b'); if (tit) tit.textContent = t('Looks con esta prenda', 'Looks with this garment');
  };

  /* ---------- Yo: nombre grande, tres cifras, el diagnóstico como en Stitch y los ajustes ---------- */
  const tarjetaDiagVieja = tarjetaDiag;
  tarjetaDiag = function () {
    const pf = E.perfil || {}, dg = pf.diag, es = idioma() === 'en' ? 1 : 0;
    if (planDemo() !== 'pro' || !(dg?.color || dg?.cuerpo)) return tarjetaDiagVieja();
    return `<section class="st-diag" data-diag="ver" role="button" tabindex="0"><span class="st-lab">${t('Tu diagnóstico', 'Your analysis')}</span>
      ${dg.color ? `<h2>${esc(dg.color.n[es])}</h2><div class="st-tonos6">${dg.color.hex.slice(0, 6).map(h => `<span><i style="background:${h}"></i><small>${h.toUpperCase()}</small></span>`).join('')}</div>` : ''}
      ${dg.cuerpo ? `<div class="st-sil"><span class="st-lab">${t('Tu silueta', 'Your figure')}</span><h3>${esc(dg.cuerpo.n[es])}</h3></div>` : ''}
      <span class="st-sub">${t('Ver mi diagnóstico', 'See my analysis')}</span></section>`;
  };
  const pintarYoViejo = pintarYo;
  pintarYo = function () {
    pintarYoViejo();
    const pf = E.perfil || {}, nom = (pf.nombre || '').trim(), nomB = nom && nom === nom.toUpperCase() ? nom.charAt(0) + nom.slice(1).toLowerCase() : nom;
    $('yo-nombre').textContent = nomB || t('Tu clóset', 'Your closet');
    const alta = pf.alta ? new Date(pf.alta).toLocaleDateString(idioma() === 'en' ? 'en-GB' : 'es-ES', { month: 'long', year: 'numeric' }) : '';
    $('yo-sub').textContent = [pf.ciudad || E.tiempo?.nombre || pf.lugar, alta && t(`en TuCloset desde ${alta}`, `on TuCloset since ${alta}`)].filter(Boolean).join(' · ');
    const mes = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), puestas = E.prendas.reduce((s, p) => s + (p.usos || []).filter(d => d >= mes).length, 0);
    let c = $('st-yo-cifras'); if (!c) { c = document.createElement('div'); c.id = 'st-yo-cifras'; c.className = 'st-cifras'; $('yo-sub').after(c); }
    c.innerHTML = [[E.prendas.length, t('prendas', 'garments')], [E.conjuntos.length, t('looks', 'looks')], [puestas, t('puestas este mes', 'worn this month')]].map(([n, k]) => `<div><b>${n}</b><span>${k}</span></div>`).join('');
  };

  /* ---------- repintar cuando llegan las fotos de catálogo ---------- */
  let rt; window.stRepintar = () => { clearTimeout(rt); rt = setTimeout(() => cuandoQuieto(() => { if (E.pantalla === 'looks') pintarLooks(); else if (E.pantalla === 'closet') pintarCloset(); }), 400); };
})();
