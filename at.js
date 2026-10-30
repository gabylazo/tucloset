/* TuCloset · diseño A «Atelier» (Dirección, 30/10/2026). Gabriela eligió la A («la a») entre las dos direcciones hechas con el método del manual de
   Estudio (equipo/producto/diseno/territorios/: brief, «lo que NO queremos», crítica independiente y lista de calidad). Centrado y quieto: el look de
   arriba abajo, a escala real y con las fotos de catálogo; el clóset en rejilla de 3 sobre baldosas; Bellefair en los nombres y Jost en la letra
   pequeña; un solo botón relleno por pantalla y lo demás en enlace; lo elegido, con el botón de dos agujeros. Gabriela, al verla: «el cuadrado donde
   está el conjunto completo… queda muy ajustado, tiene que quedar más holgado»: todo look en baldosa lleva 24 px de aire arriba y abajo.
   Solo actúa con ?propuesta=atelier (o ?ver=atelier una vez): sin ella, la app no cambia. */
if (AT) (() => {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'at.css?v=0.125'; document.head.append(l);
  document.documentElement.classList.add('at');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const en = () => idioma() === 'en', loc = () => en() ? 'en-GB' : 'es-ES';
  const caja = () => { const a = $('app'); return [Math.min(a.clientWidth || innerWidth, 430), a.clientHeight || innerHeight]; };
  const DOS = '<span class="at-dos" aria-hidden="true"></span>';
  const svg = d => `<svg class="at-ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const I = {
    sol: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
    armario: svg('<path d="M8 6.5a4 4 0 0 1 8 0M5.5 6.5h13M6.5 6.5v14h11v-14M12 6.5v14M7 20.5v1.5M17 20.5v1.5"/><circle cx="11" cy="13.5" r=".5"/><circle cx="13" cy="13.5" r=".5"/>'),
    mas: svg('<path d="M12 5v14M5 12h14"/>'),
    percha: svg('<path d="M12 7.5a2 2 0 1 1 2-2c0 1-2 1.3-2 2.6V9M12 9l8.5 6.5c.6.5.3 1.5-.5 1.5H4c-.8 0-1.1-1-.5-1.5Z"/>'),
    yo: svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3"/>'),
    iz: svg('<path d="m14.5 5-7 7 7 7"/>'), de: svg('<path d="m9.5 5 7 7-7 7"/>'), abajo: svg('<path d="m6 9.5 6 6 6-6"/>'),
    corazon: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  };

  /* ---------- barra de abajo: cinco secciones, en mayúsculas pequeñas; la activa, en nogal y con los dos agujeros ---------- */
  const tb = $('tabs');
  if (tb) {
    const N = { hoy: [I.sol, 'Hoy', 'Today'], closet: [I.armario, 'Clóset', 'Closet'], subir: [I.mas, 'Subir', 'Add'], looks: [I.percha, 'Looks', 'Looks'], yo: [I.yo, 'Yo', 'Me'] };
    tb.querySelectorAll('button').forEach(b => { const x = N[b.dataset.ir]; if (!x) return; b.innerHTML = `${x[0]}<span class="at-lbl">${en() ? x[2] : x[1]}</span>${DOS}`; });
  }

  /* ---------- el look: a escala real (Eje, cerrado el 20/10), con la foto de catálogo de cada prenda ----------
     La de arriba pisa un 7 % la de abajo; la capa asoma por detrás; el calzado, al pie con 3 cm de aire y 26 cm de ancho; el bolso a la derecha a la
     altura de la cadera y los accesorios a la izquierda, a la de los hombros. El marco es simétrico respecto al eje: el look queda siempre en el centro. */
  const AR = new Map(), midiendo = new Set();
  const medir = src => { if (!src || midiendo.has(src)) return; midiendo.add(src); const im = new Image(); im.onload = () => { if (im.naturalHeight) { AR.set(src, im.naturalWidth / im.naturalHeight); window.stRepintar?.(); } }; im.src = src; };
  const conCat = p => !!p.cat;
  function razon(p) { // alto / ancho de la prenda en su foto
    if (conCat(p)) { if (p.catAR) return 1 / p.catAR; const s = urlCat(p), a = AR.get(s); if (a) return 1 / a; medir(s); return 1.2; }
    return p.caja?.[4] || 1.2;
  }
  function medidas(p) {
    const r = razon(p);
    if (p.tipo === 'Calzado') return [26, 26 * r];
    if (p.tipo === 'Bolsos') { const L = 30; return r >= 1 ? [L / r, L] : [L, L * r]; }
    if (p.tipo === 'Accesorios') { const L = 20; return r >= 1 ? [L / r, L] : [L, L * r]; }
    const L = largoDe(p); return [L / r, L];
  }
  const eje = p => conCat(p) || p.muestra ? .5 : (p.caja?.[5] ?? .5);
  function lookAt(ps) {
    const rol = r => ps.filter(p => r.includes(p.tipo)), tops = rol(['Arriba']);
    const capa = rol(['Abrigo'])[0] || (tops.length > 1 ? tops.find(esCapa) || tops[1] : null), top = tops.find(p => p !== capa);
    const grande = rol(['Abajo', 'Vestidos'])[0], zap = rol(['Calzado'])[0], bolso = rol(['Bolsos'])[0], acc = rol(['Accesorios']).slice(0, 2);
    const dentro = ps.como === 'por dentro', out = [];
    const pon = (p, x, y, z) => { const [w, h] = medidas(p), o = [p, x == null ? -w * eje(p) : x, y, w, h, z]; out.push(o); return o; };
    let y = 0, oC = null, oT = null, oG = null;
    if (capa && (top || grande)) { oC = pon(capa, null, 0, 0); y = oC[4] * .06; }
    else if (capa) oT = pon(capa, null, 0, 2);
    if (top) oT = pon(top, null, y, dentro ? 1 : 2);
    if (grande) { const yG = oT ? oT[2] + oT[4] * (grande.tipo === 'Vestidos' ? .55 : .93) : y; oG = pon(grande, null, yG, dentro ? 2 : 1); }
    const cuerpo = [oC, oT, oG].filter(Boolean);
    let fin = cuerpo.length ? Math.max(...cuerpo.map(o => o[2] + o[4])) : 0;
    if (zap) { const [w, h] = medidas(zap); pon(zap, -w / 2, fin + (cuerpo.length ? 3 : 0), 3); fin += h + 3; }
    if (!out.length) return null;
    const der = Math.max(0, ...cuerpo.map(o => o[1] + o[3])), izq = Math.min(0, ...cuerpo.map(o => o[1]));
    if (bolso) { const [, h] = medidas(bolso), ref = oG || oT; pon(bolso, der + 3, ref ? ref[2] + ref[4] * (ref === oG ? .1 : .55) : 0, 3); }
    let ya = oT ? oT[2] + 2 : 0; acc.forEach(p => { const [w, h] = medidas(p); pon(p, izq - w - 3, ya, 3); ya += h + 3; });
    const x0 = Math.min(...out.map(o => o[1])), x1 = Math.max(...out.map(o => o[1] + o[3])), R = Math.max(-x0, x1);
    const y0 = Math.min(...out.map(o => o[2])), y1 = Math.max(...out.map(o => o[2] + o[4]));
    return { out: out.sort((a, b) => a[5] - b[5]).map(([p, x, yy, w, h]) => [p, x + R, yy - y0, w, h]), W: 2 * R, H: y1 - y0 };
  }
  function piezas(c, fichas) {
    return c.out.map(([p, x, y, w, h]) => {
      const attr = fichas && !p.muestra ? ` data-ficha="${p.id}" role="button" tabindex="0" aria-label="${esc(p.nombre || '')}"` : '';
      if (conCat(p) || p.muestra) return `<img class="at-p" src="${conCat(p) ? urlCat(p) : p.src}" alt="${attr ? '' : esc(p.nombre || '')}" style="left:${x / c.W * 100}%;top:${y / c.H * 100}%;width:${w / c.W * 100}%;height:${h / c.H * 100}%"${attr}>`;
      const html = pieza(p, x, y, w, h, c.W, c.H); // sin foto de catálogo todavía: el recorte de siempre
      return attr ? html.replace(/^<(img|i) /, `<$1${attr} `) : html;
    }).join('');
  }
  // el look dentro de una caja de W × H px, a la mayor escala que quepa y centrado
  function figura(ps, W, H, fichas) {
    const c = lookAt(ps); if (!c) return `<div class="at-look" style="width:${W}px;height:${H}px"></div>`;
    const s = Math.min(W / c.W, H / c.H);
    return `<div class="at-look" style="width:${W}px;height:${H}px"><div class="at-lz" style="width:${(c.W * s).toFixed(1)}px;height:${(c.H * s).toFixed(1)}px">${piezas(c, fichas)}</div></div>`;
  }
  // un look en su baldosa, con aire: un 12 % arriba y abajo y un 17 % a cada lado (24 px y 27 px en la de la ficha; Gabriela: «tiene que quedar más holgado»)
  const baldosa = (ps, W, H, attr = '') => `<button class="at-bal" style="width:${W}px;height:${H}px"${attr}>${figura(ps, W - 2 * Math.round(W * .17), H - 2 * Math.round(H * .12))}</button>`;
  const psDe = x => conZapato(x.ids.map(P).filter(Boolean), x.zspec, x.como);
  // los demás sitios que pintan looks (calendario, «Sácale partido»…) usan la misma composición
  const maniquiViejo = maniqui;
  maniqui = function (ps, mini, modo) {
    const c = lookAt(ps); if (!c) return maniquiViejo(ps, mini, modo);
    return `<div class="lienzo${mini ? ' mini' : ''} at-lienzo" style="aspect-ratio:${c.W.toFixed(1)}/${c.H.toFixed(1)}">${piezas(c)}</div>`;
  };
  const nomLook = c => c?.nombre && !/^(hoy|today|favorito|favourite)\b|\d+$/i.test(c.nombre.trim()) ? c.nombre : '';

  /* ---------- HOY: el nombre, la fecha con el tiempo, el look grande y quieto; debajo, la ocasión y «Me lo pongo» ---------- */
  pintarHoy = function () {
    const pant = $('p-hoy'), w = E.tiempo, planHoy = eventoAhora()?.oc;
    if (!E.propuestas.length) { E.hoyFalta = null; E.plan = planHoy || 'Todos'; proponer(); if (!E.propuestas.length && E.plan !== 'Todos') { E.hoyFalta = E.plan; E.plan = 'Todos'; proponer(); E.propuestas = masCercanos(E.hoyFalta, E.propuestas); } }
    const lista = E.propuestas; if ((E.hoyIdx || 0) >= lista.length) E.hoyIdx = 0; const pr = lista[E.hoyIdx || 0];
    const dia = new Date().toLocaleDateString(loc(), { weekday: 'long', day: 'numeric' }).replace(',', '');
    const cielo = w ? (w.clave === 'solnube' ? 'sol' : ['lluvia', 'tormenta'].includes(w.clave) ? 'nube' : w.clave) : null;
    const lluvia = !w ? '' : ['lluvia', 'tormenta'].includes(w.clave) ? `<span class="at-sep">·</span>${ICO_T.lluvia}${t('ahora', 'now')}` : w.lluviaH != null ? `<span class="at-sep">·</span>${ICO_T.lluvia}${w.lluviaH}:00` : '';
    const cab = `<header class="at-cab"><span class="at-marca"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#i129"/></svg>Tu<span>Closet</span></span>
      <p class="at-fecha">${dia}${w ? `${ICO_T[cielo] || ICO_T.nube}${w.t}°${lluvia}` : ''}</p></header>`;
    if (!pr) {
      const hay = activas().length, rech = E.perfil?.gustos?.fuera?.length || (E.perfil?.gustos?.hoy?.d === hoyISO() && E.perfil.gustos.hoy.k.length);
      pant.innerHTML = `<div class="at-pant">${cab}<div class="at-vacio"><p>${hay && rech ? t('Por hoy no me quedan combinaciones nuevas con tu ropa. Sube más prendas y te propongo otras.', 'No new combinations left for today. Upload more garments and I’ll suggest others.') : hay ? t('Para este tiempo me falta una prenda de arriba y una de abajo, o un vestido.', 'For this weather I need a top and a bottom, or a dress.') : t('Tu look de hoy aparecerá aquí cuando tengas una prenda de arriba, una de abajo y unos zapatos.', 'Your look of the day will appear here once you have a top, a bottom and shoes.')}</p><button class="at-btn" data-ir="subir">${t('Subir prendas', 'Add garments')}</button>${hay || PUBLICA ? '' : `<button class="at-enlace" id="at-ejemplo">${t('Ver un ejemplo', 'See an example')}</button>`}</div></div>`;
      const ej = $('at-ejemplo'); if (ej) ej.onclick = cargarEjemplo;
      return;
    }
    const ps = psDe(pr), oc = planHoy && !E.hoyFalta && pr.tipo !== 'conjunto' ? planHoy : (pr.c && pr.c.ocasion) || pr.ocasion || ocasionDe(ps);
    const [ancho, alto] = caja(), W = Math.min(330, ancho - 60), H = Math.max(240, alto - 360);
    const muestra = ps.some(p => p.muestra);
    const flechas = lista.length > 1 ? `<button class="at-flecha iz" data-atmov="-1" aria-label="${t('Look anterior', 'Previous look')}">${I.iz}</button><button class="at-flecha de" data-atmov="1" aria-label="${t('Look siguiente', 'Next look')}">${I.de}</button>` : '';
    const ocs = E.hzPreg ? `<div class="at-fila at-ocs">${OCASIONES.map(o => `<button class="${o === oc ? 'on' : ''}" data-hzoc="${o}">${ocNombre(o)}${DOS}</button>`).join('')}</div>` : '';
    pant.innerHTML = `<div class="at-pant">${cab}<main class="at-hoy" id="at-hoy">${flechas}${figura(ps, W, H, true)}
      <button class="at-oc" data-hzpreg aria-expanded="${!!E.hzPreg}" aria-label="${t('Ocasión', 'Occasion')}: ${ocNombre(oc)}. ${t('Cambiar', 'Change')}">${ocNombre(oc)}${I.abajo}</button>${ocs}
      ${E.hoyFalta ? avisoFalta(E.hoyFalta, false) : muestra ? `<button class="at-nota" data-ir="subir">${t('Zapatos de muestra: sube los tuyos', 'Sample shoes: add yours')}</button>` : ''}</main>
      <div class="at-pie"><button class="at-btn" id="at-pongo">${t('Me lo pongo', 'I’ll wear it')}</button></div></div>`;
    // el look ocupa el hueco que de verdad queda entre la cabecera y el botón (en cada móvil es distinto)
    const z = $('at-hoy'), ajustar = () => { const fig = z.querySelector('.at-look'); if (!fig || !z.clientHeight) return;
      const resto = [...z.children].filter(x => x !== fig && !x.classList.contains('at-flecha')).reduce((s, x) => s + x.offsetHeight + 6, 0), libre = Math.floor(z.clientHeight - resto - 12);
      if (libre > 120 && Math.abs(libre - fig.offsetHeight) > 4) fig.outerHTML = figura(ps, W, libre, true); };
    ajustar(); requestAnimationFrame(ajustar); // la primera vez la pantalla aún no se ve: se mide en el siguiente fotograma
    const mover = d => { E.hoyIdx = ((E.hoyIdx || 0) + d + lista.length) % lista.length; E.hzPreg = false; pintarHoy(); };
    pant.querySelectorAll('[data-atmov]').forEach(b => b.onclick = () => mover(+b.dataset.atmov));
    $('at-pongo').onclick = () => ponerse(pr.ids, pr.c);
    // deslizar el look también cambia de look
    let x0 = null;
    z.ontouchstart = e => { x0 = e.touches[0].clientX; };
    z.ontouchend = e => { if (x0 == null || lista.length < 2) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1); };
  };

  /* ---------- CLÓSET: MiCloset, el buscador a todo el ancho con el filtro dentro, las categorías en letras y la rejilla de 3 en baldosas ---------- */
  const rejCats = () => $('cats');
  pintarCloset = function () {
    const todas = E.prendas, cats = ['Todo', ...CATS_ORDEN.filter(c => todas.some(p => catDe(p) === c))];
    if (!cats.includes(E.filtro)) E.filtro = 'Todo';
    rejCats().innerHTML = cats.map(c => `<button class="${c === E.filtro ? 'activo' : ''}" data-filtro="${c}"${c === E.filtro ? ' aria-current="true"' : ''}>${catTxt(c)}${DOS}</button>`).join('');
    const q = E.busca.trim().toLowerCase();
    const lista = todas.filter(p => (E.filtro === 'Todo' || catDe(p) === E.filtro) && pasaFiltros(p) && (!q || [p.nombre, p.color, catDe(p), p.notas].join(' ').toLowerCase().includes(q)));
    const nf = Object.values(E.f).reduce((s, v) => s + v.length, 0); $('mc-nf').textContent = nf || '';
    $('pared').innerHTML = lista.map(p => `<button class="at-cel${conCat(p) ? '' : ' sin-cat'}" data-ficha="${p.id}" aria-label="${esc(p.nombre)}"><img src="${urlCat(p)}" alt="" loading="lazy">${p.estado ? `<i>${estadoTxt(p.estado)}</i>` : ''}</button>`).join('');
    $('closet-vacio').innerHTML = todas.length ? (lista.length ? '' : `<div class="at-vacio"><p>${t('Nada con ese filtro.', 'Nothing matches.')}</p></div>`)
      : `<div class="at-vacio"><p>${t('Haz una foto a cada prenda sobre un fondo liso. Con tres ya hay look de hoy.', 'Photograph each garment on a plain background. With three there is already a look for today.')}</p><button class="at-btn" data-ir="subir">${t('Subir prendas', 'Add garments')}</button>${PUBLICA ? '' : `<button class="at-enlace" id="at-cl-ejemplo">${t('Cargar un clóset de ejemplo', 'Load a sample closet')}</button>`}</div>`;
    const ej = $('at-cl-ejemplo'); if (ej) ej.onclick = cargarEjemplo;
    if (!$('mc-hoja').hidden) pintarFiltros();
  };

  /* ---------- PRENDA: la foto, el nombre, una línea de datos y sus looks; «Crear un look»; el resto, en enlaces debajo ---------- */
  const abrirFichaViejo = abrirFicha;
  abrirFicha = function (id) {
    abrirFichaViejo(id); const p = P(id); if (!p) return; // deja hechos los datos, las acciones de siempre y la pantalla
    let r = $('at-ficha'); if (!r) { r = document.createElement('div'); r.id = 'at-ficha'; r.className = 'at-ficha'; $('p-ficha').append(r); }
    const usos = p.usos || [], conj = E.conjuntos.filter(c => c.ids.includes(id));
    const sub = (NOM_X[p.x] || [])[en() ? 1 : 0] || catTxt(catDe(p));
    const datos = [sub, p.color, estNombre(p.estacion), usos.length ? t(`Puesta ${veces(usos.length)}`, `Worn ${veces(usos.length)}`) : t('Sin estrenar', 'Not worn yet')].filter(Boolean).map(esc).join(' · ');
    const precio = p.precio ? `${dinero(p.precio)}${usos.length ? ` · ${dinero(p.precio / usos.length)} ${t('por puesta', 'per wear')}` : ''}` : '';
    // sus looks; si aún no tiene, los dos que mejor le van con tu ropa (al tocarlos, se crean)
    let looks = conj.slice(0, 8).map(c => ({ ps: psDe(c), attr: ` data-look="${c.id}" aria-label="${esc(nomLook(c) || ocNombre(c.ocasion || 'Diario'))}"` }));
    if (!looks.length && p.tipo !== 'Accesorios') {
      try { const pool = activas().filter(x => x.id !== id); const vistos = new Set();
        looks = combosCon([p], pool).sort((a, b) => b.pts - a.pts).filter(x => !vistos.has(x.base) && vistos.add(x.base)).slice(0, 2)
          .map(x => ({ ps: conZapato(x.ps), attr: ` data-atcrear="${x.ps.map(y => y.id).join(',')}" aria-label="${t('Crear este look', 'Create this look')}"` }));
      } catch (e) { looks = []; }
    }
    const [ancho] = caja(), MW = Math.min(160, Math.floor((ancho - 56) / 2)), MH = Math.round(MW * 1.25);
    const acc = [['hoy', t('Me la pongo hoy', 'Wearing it today')], ...[...$('f-acciones').querySelectorAll('[data-accion]')].filter(b => b.dataset.accion !== 'conjunto').map(b => [b.dataset.accion, b.textContent.trim()])];
    r.innerHTML = `<div class="at-barra-sup"><button class="at-volver" data-ir="closet" aria-label="${t('Volver', 'Back')}">${I.iz}</button><button class="at-enlace at-der" data-atfacc="editar">${t('Editar', 'Edit')}</button></div>
      <div class="at-foto${conCat(p) ? '' : ' sin-cat'}"><img src="${urlCat(p)}" alt="${esc(p.nombre)}"></div>
      ${p.estado ? `<p class="at-estado">${estadoTxt(p.estado)}</p>` : ''}<h1 class="at-h1">${esc(p.nombre)}</h1><p class="at-datos">${datos}</p>${precio ? `<p class="at-datos">${precio}</p>` : ''}
      ${looks.length ? `<div class="at-minis${looks.length > 2 ? ' muchos' : ''}">${looks.map(x => baldosa(x.ps, MW, MH, x.attr)).join('')}</div>` : ''}
      <div class="at-acciones"><button class="at-btn" data-ir="nuevo-look" data-atpre="${id}">${t('Crear un look', 'Create a look')}</button></div>
      <nav class="at-lista">${acc.map(([k, v]) => `<button data-atfacc="${k}">${esc(v)}</button>`).join('')}</nav>
      <p class="at-nota-fin">${esc($('f-nota').textContent)}</p>`;
    r.onclick = e => {
      const b = e.target.closest('[data-atfacc],[data-atcrear],[data-atpre]'); if (!b) return;
      if (b.dataset.atpre) { e.stopPropagation(); return ir('nuevo-look', [b.dataset.atpre]); }
      if (b.dataset.atcrear) { e.stopPropagation(); return ir('nuevo-look', b.dataset.atcrear.split(',')); }
      const k = b.dataset.atfacc;
      if (k === 'editar') $('f-editar').click(); else if (k === 'hoy') $('f-hoy').click();
      else $('f-acciones').querySelector(`[data-accion="${k}"]`)?.click();
    };
  };

  /* ---------- LOOK: el nombre, el look grande (cada prenda abre su ficha), «Me lo pongo» y, en enlaces, «Al calendario» y «Borrar» ---------- */
  const abrirLookViejo = abrirLook;
  abrirLook = function (id) {
    abrirLookViejo(id); const c = E.conjuntos.find(x => x.id === id); if (!c) return;
    let r = $('at-look'); if (!r) { r = document.createElement('div'); r.id = 'at-look'; r.className = 'at-abierto'; $('p-look').append(r); }
    const [ancho, alto] = caja(), W = Math.min(330, ancho - 60), H = Math.max(260, alto - 330), fav = c.fav || esFav(c.ids);
    const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return [diaISO(d), i === 0 ? t('Hoy', 'Today') : i === 1 ? t('Mañana', 'Tomorrow') : d.toLocaleDateString(loc(), { weekday: 'short', day: 'numeric' }).replace(/[.,]/g, '')]; });
    r.innerHTML = `<div class="at-barra-sup"><button class="at-volver" data-ir="looks" aria-label="${t('Volver', 'Back')}">${I.iz}</button><button class="at-fav${fav ? ' on' : ''}" data-atfav aria-pressed="${fav}" aria-label="${t('Favorito', 'Favourite')}">${I.corazon}</button></div>
      <h1 class="at-h1">${esc(nomLook(c) || ocNombre(c.ocasion || 'Diario'))}</h1>
      <div class="at-centro">${figura(psDe(c), W, H, true)}</div>
      <div class="at-acciones"><button class="at-btn" data-atl="pongo">${t('Me lo pongo', 'I’ll wear it')}</button>
        <div class="at-enlaces"><button class="at-enlace" data-atl="cal" aria-expanded="${!!E.atCal}">${t('Al calendario', 'To the calendar')}</button><button class="at-enlace" data-atl="borrar">${t('Borrar', 'Delete')}</button></div>
        ${E.atCal ? `<div class="at-fila at-dias">${dias.map(([d, n]) => `<button data-atdia="${d}">${n}</button>`).join('')}</div>` : ''}</div>`;
    r.onclick = async e => {
      const b = e.target.closest('[data-atl],[data-atfav],[data-atdia]'); if (!b) return;
      if (b.dataset.atfav != null) { await alternarFav(c.ids, c.ocasion || 'Diario'); return abrirLook(id); }
      if (b.dataset.atdia) { // el look va al primer plan de ese día sin look; si no hay planes, se apunta uno con su ocasión
        const d = b.dataset.atdia, a = E.agenda[d] = E.agenda[d] || { planes: [] }, ev = eventosDe(d).find(x => !lookDe(d, x));
        const evId = ev ? ev.id : uid(); if (!ev) a.planes = [...(a.planes || []), { id: evId, oc: c.ocasion || 'Diario', fr: 'Mañana' }];
        a.looks = { ...(a.looks || {}), [evId]: [...c.ids] }; E.atCal = false; await guardar(); E.propuestas = [];
        toast(t(`Guardado para ${b.textContent.trim().toLowerCase()}`, `Saved for ${b.textContent.trim()}`)); return abrirLook(id);
      }
      const k = b.dataset.atl;
      if (k === 'pongo') $('lk-pongo').click(); else if (k === 'borrar') $('lk-borrar').click(); else { E.atCal = !E.atCal; abrirLook(id); }
    };
  };

  /* ---------- LOOKS: Mis looks · Favoritos · Calendario, en letras; los looks en baldosas de tres en tres, como Indyx; el primero, «Crear un look» ---------- */
  const filaLooks = act => `<header class="at-tit"><h1>${t('Looks', 'Looks')}</h1></header><nav class="at-fila at-cats">${[['mios', t('Mis looks', 'My looks')], ['fav', t('Favoritos', 'Favourites')], ['cal', t('Calendario', 'Calendar')]].map(([k, n]) => `<button class="${act === k ? 'on' : ''}" data-lktab="${k}"${act === k ? ' aria-current="true"' : ''}>${n}${DOS}</button>`).join('')}</nav>`;
  pintarLooks = function () {
    const raiz = $('lk-raiz'); document.documentElement.dataset.looks = 'at';
    if (!['mios', 'fav', 'cal'].includes(E.lkTab)) E.lkTab = 'mios';
    if (E.lkTab === 'cal') return pintarCalendario(raiz);
    const fav = E.lkTab === 'fav', lista = E.conjuntos.filter(c => !fav || c.fav || esFav(c.ids));
    const [ancho] = caja(), TW = Math.floor((ancho - 40 - 16) / 3), TH = Math.round(TW * 1.25);
    const crear = fav ? '' : `<figure class="at-t"><button class="at-bal at-crear" style="width:${TW}px;height:${TH}px" data-ir="nuevo-look">${I.mas}<span>${t('Crear un look', 'Create a look')}</span></button></figure>`;
    const t1 = c => `<figure class="at-t">${baldosa(psDe(c), TW, TH, ` data-look="${c.id}"`)}<figcaption>${esc(nomLook(c) || ocNombre(c.ocasion || 'Diario'))}</figcaption></figure>`;
    raiz.innerHTML = filaLooks(E.lkTab) + (lista.length || !fav ? `<div class="at-rej2">${crear}${lista.map(t1).join('')}</div>`
      : `<div class="at-vacio"><p>${t('Aún no tienes favoritos. Abre un look y toca el corazón.', 'No favourites yet. Open a look and tap the heart.')}</p></div>`);
    raiz.onclick = e => { const b = e.target.closest('[data-lktab]'); if (!b) return; E.lkTab = b.dataset.lktab; E.lkTocado = true; pintarLooks(); };
  };
  // el calendario de siempre, con la cabecera de Looks
  const pintarAgendaVieja = pintarAgenda;
  pintarAgenda = function (raiz) {
    pintarAgendaVieja(raiz); if (raiz.id !== 'lk-raiz') return;
    raiz.querySelector('.lk-cab')?.remove(); raiz.querySelector('.lk-tabs')?.remove();
    raiz.insertAdjacentHTML('afterbegin', filaLooks('cal'));
  };

  /* ---------- NUEVO LOOK: las prendas, con su foto de catálogo ---------- */
  const prepararNuevoLookViejo = prepararNuevoLook;
  prepararNuevoLook = function (pre) {
    prepararNuevoLookViejo(pre);
    const tit = $('p-nuevo-look').querySelector('.cab .et'); if (tit) tit.textContent = t('Nuevo look', 'New look');
    $('nl-guardar').textContent = t('Guardar el look', 'Save the look');
    $('nl-prendas').querySelectorAll('[data-sel]').forEach(b => { const p = P(b.dataset.sel), im = b.querySelector('img'); if (p && im && conCat(p)) im.src = urlCat(p); });
  };

  /* ---------- repintar cuando llegan las fotos de catálogo ---------- */
  let rt; window.stRepintar = () => { clearTimeout(rt); rt = setTimeout(() => cuandoQuieto(() => {
    const s = E.pantalla; if (s === 'hoy') pintarHoy(); else if (s === 'looks') pintarLooks(); else if (s === 'closet') pintarCloset();
  }), 400); };
})();
