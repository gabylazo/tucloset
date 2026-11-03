/* TuCloset · diseño A «Atelier» (Dirección, 30/10/2026). Gabriela eligió la A («la a») entre las dos direcciones hechas con el método del manual de
   Estudio (equipo/producto/diseno/territorios/: brief, «lo que NO queremos», crítica independiente y lista de calidad). Centrado y quieto: el look de
   arriba abajo, a escala real y con las fotos de catálogo; el clóset en rejilla de 3 sobre baldosas; Bellefair en los nombres y Jost en la letra
   pequeña; un solo botón relleno por pantalla y lo demás en enlace; lo elegido, con el botón de dos agujeros. Gabriela, al verla: «el cuadrado donde
   está el conjunto completo… queda muy ajustado, tiene que quedar más holgado»: todo look en baldosa lleva 24 px de aire arriba y abajo.
   Solo actúa con ?propuesta=atelier (o ?ver=atelier una vez): sin ella, la app no cambia. */
if (AT) (() => {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'at.css?v=0.135'; document.head.append(l);
  document.documentElement.classList.add('at');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const en = () => idioma() === 'en', loc = () => en() ? 'en-GB' : 'es-ES';
  // Sheila, 01/11 (m. 1647): una blusa de manga larga no es un top; 03/11 (m. 1696): unas chaquetas y un chaleco de pelo tampoco, «estudia en Zara, Lefties, H&M, Pull and Bear
  // las clasificaciones». Las cuatro separan siempre la ropa de abrigo de los tops (Zara: abrigos, cazadoras, blazers; H&M: chaquetas y abrigos; Pull&Bear: cazadoras y chaquetas;
  // Lefties: cazadoras | abrigos), las camisetas de los tops y bodies (Zara), el punto y las sudaderas, y los vaqueros de los pantalones (Zara: jeans; H&M: vaqueros; Lefties: denim).
  // Menú de Zara leído el 03/11; de las otras, los nombres de sus secciones. La categoría sale de lo que el motor entiende del nombre (y de la foto), sea cual sea el tipo elegido.
  const CAT_SUB = { camiseta: 'Camisetas', camiseta_tirantes: 'Camisetas', henley: 'Camisetas', polo: 'Camisetas', camiseta_tecnica: 'Camisetas',
    top: 'Tops', top_corto: 'Tops', body: 'Tops', top_deportivo: 'Tops', blusa: 'Camisas y blusas', camisa: 'Camisas y blusas', sobrecamisa: 'Camisas y blusas',
    jersey: 'Punto', jersey_cuello_alto: 'Punto', cardigan: 'Punto', chaleco_punto: 'Punto', sudadera: 'Sudaderas', forro_polar: 'Sudaderas',
    chaleco_traje: 'Abrigos', chaleco_acolchado: 'Abrigos', americana: 'Abrigos', chaqueta_vaquera: 'Abrigos', cazadora_cuero: 'Abrigos', bomber: 'Abrigos', chaqueta_deportiva: 'Abrigos',
    chubasquero: 'Abrigos', parka: 'Abrigos', plumifero: 'Abrigos', gabardina: 'Abrigos', abrigo_lana: 'Abrigos', abrigo_generico: 'Abrigos', kimono: 'Abrigos', chaqueta: 'Abrigos',
    vaquero: 'Vaqueros', shorts: 'Shorts', bermudas: 'Shorts', mono: 'Vestidos' };
  const ARRIBA = ['Camisetas', 'Tops', 'Camisas y blusas', 'Punto', 'Sudaderas'];
  catPor = p => { if (!['Arriba', 'Abrigo', 'Abajo', 'Vestidos'].includes(p.tipo)) return null; const c = CAT_SUB[Motor.ficha(p).subtipo]; return c || (p.tipo === 'Arriba' ? 'Tops' : null); };
  catArriba = p => catPor(p) || 'Tops';
  CATS_ORDEN.splice(0, CATS_ORDEN.length, ...ARRIBA, 'Abrigos', 'Pantalones', 'Vaqueros', 'Faldas', 'Shorts', 'Vestidos', 'Zapatos', 'Bolsos', 'Accesorios');
  Object.assign(CAT_ES, { Tops: 'Tops y bodies', Abrigos: 'Chaquetas y abrigos' });
  Object.assign(TIPO_DE_CAT, { Camisetas: 'Arriba', 'Camisas y blusas': 'Arriba', Punto: 'Arriba', Sudaderas: 'Arriba', Vaqueros: 'Abajo', Shorts: 'Abajo' });
  Object.assign(SUBCATS, { Tops: ['a crop top', 'a sleeveless top', 'a halter bodysuit', 'a peplum top'], Camisetas: ['a t-shirt', 'a polo shirt', 'a tank top'], 'Camisas y blusas': ['a blouse', 'a shirt'], Punto: ['a sweater', 'a cardigan', 'a knitted vest'], Sudaderas: ['a hoodie'],
    Pantalones: ['trousers', 'wide leg pants', 'leggings'], Vaqueros: ['jeans'], Shorts: ['shorts'] });
  for (const k in COMPLEMENTA) { const i = COMPLEMENTA[k].indexOf('Tops'); if (i >= 0) COMPLEMENTA[k].splice(i, 1, ...ARRIBA); const j = COMPLEMENTA[k].indexOf('Pantalones'); if (j >= 0) COMPLEMENTA[k].splice(j + 1, 0, 'Vaqueros'); }
  // Sheila, 01/11 (m. 1649): con el filtro Evento no salía ningún pantalón. La ocasión de una prenda también sale de las fórmulas del motor
  const ocasionesViejas = ocasionesPrenda;
  ocasionesPrenda = p => [...new Set([...ocasionesViejas(p), ...Motor.ocasionesDe(p)])];
  const caja = () => { const a = $('app'); return [Math.min(a.clientWidth || innerWidth, 430), a.clientHeight || innerHeight]; };
  const DOS = '<span class="at-dos" aria-hidden="true"></span>';
  // los botones (Gabriela, 03/11: «son muy grandes… generan ruido visual, prueba dorados u otra forma, proponme varias opciones»): ?boton=1…4 elige uno en este navegador
  // (1 contorno nogal fino, 2 contorno dorado, 3 dorado lleno, 4 solo letra con raya dorada); sin elegir, el 1. Decide ella
  { const q = new URLSearchParams(location.search).get('boton'); let b = null; try { if (/^[1-4]$/.test(q || '')) localStorage.setItem('tc_boton', q); b = localStorage.getItem('tc_boton'); } catch (e) {} document.documentElement.dataset.boton = /^[1-4]$/.test(q || '') ? q : b || '1'; }
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
     La de arriba pisa un 7 % la de abajo; si hay capas, cada prenda entera, en fila y sin taparse (Sheila, 01/11: una foto encima de otra no se entiende); el calzado, al pie con 3 cm de aire y 26 cm de ancho; el bolso a la derecha a la
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
    // con manga larga la foto llega hasta el puño: casi 60 cm aunque el cuerpo sea corto (03/11: un top corto de manga larga salía diminuto junto al pantalón)
    let L = largoDe(p); if (['Arriba', 'Abrigo'].includes(p.tipo) && typeof Motor !== 'undefined' && Motor.ficha(p).manga === 'larga') L = Math.max(L, 58);
    return [L / r, L];
  }
  const eje = p => conCat(p) || p.muestra ? .5 : (p.caja?.[5] ?? .5);
  function lookAt(ps) {
    const rol = r => ps.filter(p => r.includes(p.tipo)), abrigo = rol(['Abrigo'])[0], tops = rol(['Arriba']), sup = abrigo ? [abrigo, ...tops] : tops; // las de arriba, de fuera hacia dentro
    const grande = rol(['Abajo', 'Vestidos'])[0], zap = rol(['Calzado'])[0], bolso = rol(['Bolsos'])[0], acc = rol(['Accesorios']).slice(0, 2);
    const dentro = ps.como === 'por dentro', out = [], AIRE = 3;
    const pon = (p, x, y, z) => { const [w, h] = medidas(p), o = [p, x == null ? -w * eje(p) : x, y, w, h, z]; out.push(o); return o; };
    const alto = p => medidas(p)[1], anchoFila = l => l.reduce((s, p) => s + medidas(p)[0], 0) + AIRE * Math.max(0, l.length - 1);
    // a un lado, de arriba abajo: la capa junto a un vestido o el abrigo mucho más largo que lo de debajo
    const vestido = grande?.tipo === 'Vestidos', vaAlLado = sup.length && (vestido || (grande && sup.length > 1 && alto(sup[0]) > 1.35 * Math.max(...sup.slice(1).map(alto))));
    const resto = vaAlLado ? sup.slice(1) : sup;
    let ejeX = 0, oL = null;
    if (vaAlLado) { const col = Math.max(anchoFila(resto), grande ? medidas(grande)[0] : 0, zap ? 26 : 0), total = medidas(sup[0])[0] + 4 + col; oL = pon(sup[0], -total / 2, 0, 1); ejeX = total / 2 - col / 2; }
    let x = ejeX - anchoFila(resto) / 2;
    const fila = resto.map(p => { const o = pon(p, resto.length === 1 && !ejeX ? null : x, 0, dentro ? 1 : 2); x += o[3] + AIRE; return o; }), oT = fila[0] || null;
    // con manga larga el puño baja más que el bajo de la prenda: se solapa un poco más para que no quede un hueco en la cintura; varias en fila, casi sin pisar
    let oG = null;
    if (grande) { const larga = fila.length === 1 && typeof Motor !== 'undefined' && Motor.ficha(resto[0]).manga === 'larga', finFila = fila.length ? Math.max(...fila.map(o => o[4])) : 0, wG = medidas(grande)[0]; oG = pon(grande, ejeX ? ejeX - wG / 2 : null, finFila * (fila.length > 1 ? .98 : larga ? .87 : .93), dentro ? 2 : 1); }
    const columna = [...fila, oG].filter(Boolean), cuerpo = [oL, ...columna].filter(Boolean);
    let fin = columna.length ? Math.max(...columna.map(o => o[2] + o[4])) : oL ? oL[4] : 0;
    if (zap) { const [w, h] = medidas(zap); pon(zap, ejeX - w / 2, fin + (cuerpo.length ? 3 : 0), 3); fin += h + 3; }
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
      if (conCat(p) || p.muestra) return `<img class="at-p" src="${conCat(p) ? urlCat(p) : p.src}" alt="${esc(p.nombre || '')}" style="left:${x / c.W * 100}%;top:${y / c.H * 100}%;width:${w / c.W * 100}%;height:${h / c.H * 100}%"${attr}>`;
      const html = pieza(p, x, y, w, h, c.W, c.H); // sin foto de catálogo todavía: el recorte de siempre
      return attr ? html.replace(/^<(img|i) /, `<$1${attr} `) : html;
    }).join('');
  }
  /* ---------- el look grande, repartido solo según las piezas que lleve (Gabriela, 03/11: «que se eligiera la distribución de las piezas automáticamente en función del número
     de piezas que tenga el look»; «no entiendo por qué los zapatos están en ese lugar y hay tanto espacio en blanco libre arriba»). Se prueban todos los repartos en una o dos
     columnas y gana el que deja la ropa más grande en la caja sin huecos: con dos piezas, una sobre otra; con tres, en diagonal (el pantalón a un lado; lo de arriba y los
     zapatos al otro); con más, dos columnas parejas. Todas a la misma escala (real entre sí; bolso y accesorios, hasta un 60 % más; el calzado, un 15 %). Lo de arriba y lo
     de abajo van juntos salvo que separarlos dé bastante más tamaño. Medidas en cm; figura() las lleva a la caja. ---------- */
  function collage(ps, W, H) {
    const rol = r => ps.filter(p => r.includes(p.tipo)), abrigo = rol(['Abrigo'])[0], sup = abrigo ? [abrigo, ...rol(['Arriba'])] : rol(['Arriba']); // de fuera hacia dentro
    const top = sup[sup.length - 1] || null, grande = rol(['Abajo', 'Vestidos'])[0];
    if (!top && !grande) return null;
    const lista = [...rol(['Accesorios']).slice(0, 2), ...sup.slice(0, -1), top, rol(['Bolsos'])[0], grande, rol(['Calzado'])[0]].filter(Boolean), n = lista.length; // de arriba abajo
    const dentro = ps.como === 'por dentro', larga = top && typeof Motor !== 'undefined' && Motor.ficha(top).manga === 'larga';
    const k = p => ['Bolsos', 'Accesorios'].includes(p.tipo) ? 1.6 : p.tipo === 'Calzado' ? 1.15 : 1, med = new Map(lista.map(p => [p, medidas(p).map(v => v * k(p))]));
    const G = 4, monta = () => med.get(top)[1] * (larga ? .13 : .07); // aire entre piezas; lo de abajo entra un poco bajo lo de arriba (con manga larga, algo más)
    const columna = l => { let y = 0, w = 0; const pos = l.map((p, i) => { if (i) y += p === grande && l[i - 1] === top ? -monta() : G; const y0 = y; y += med.get(p)[1]; w = Math.max(w, med.get(p)[0]); return y0; }); return { l, pos, h: y, w }; };
    let mejor = null;
    for (let m = 0; m < 1 << n; m += 2) { // la primera pieza, siempre en la columna A: cada reparto se mira una vez
      const A = columna(lista.filter((_, i) => !(m >> i & 1))), bl = lista.filter((_, i) => m >> i & 1), B = bl.length ? columna(bl) : null;
      const s = Math.min(W / (A.w + (B ? B.w + 2 * G : 0)), H / Math.max(A.h, B ? B.h : 0));
      const parejo = B ? Math.min(A.h, B.h) / Math.max(A.h, B.h) : 1, separa = B && top && grande && A.l.includes(top) !== A.l.includes(grande);
      const nota = s * (.75 + .25 * parejo) * (separa ? .85 : 1);
      if (!mejor || nota > mejor.nota) mejor = { nota, A, B };
    }
    const { A, B } = mejor, alto = Math.max(A.h, B ? B.h : 0), out = [];
    const z = p => p === top ? (dentro ? 1 : 2) : p === grande ? (dentro ? 2 : 1) : 3;
    const poner = (c, x0) => {
      const sobra = alto - c.h, ys = c.l.length === 1 ? [c.l[0].tipo === 'Calzado' ? sobra : sobra / 2] // una sola: el calzado abajo; lo demás, en medio
        : c.pos.map((y, i) => y + sobra * i / (c.l.length - 1)); // varias: de arriba abajo, repartiendo lo que sobra entre ellas (sin hueco encima de los zapatos)
      c.l.forEach((p, i) => { const [w, h] = med.get(p); out.push([p, x0 + c.w / 2 - w * eje(p), ys[i], w, h, z(p)]); });
    };
    poner(A, 0); if (B) poner(B, A.w + 2 * G);
    const x0 = Math.min(...out.map(o => o[1])), x1 = Math.max(...out.map(o => o[1] + o[3]));
    return { out: out.sort((a, b) => a[5] - b[5]).map(([p, x, y, w, h]) => [p, x - x0, y, w, h]), W: x1 - x0, H: alto };
  }
  // el look dentro de una caja de W × H px, a la mayor escala que quepa y centrado
  function figura(ps, W, H, fichas) {
    const c = collage(ps, W, H) || lookAt(ps); if (!c) return `<div class="at-look" style="width:${W}px;height:${H}px"></div>`;
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
    if (!E.propuestas.length) { E.hoyFalta = null; E.plan = planHoy && hayOcasion(planHoy) ? planHoy : 'Todos'; proponer(); if (planHoy && E.plan === 'Todos' && !hayOcasion(planHoy)) E.hoyFalta = planHoy; if (!E.propuestas.length && E.plan !== 'Todos') { E.hoyFalta = E.plan; E.plan = 'Todos'; proponer(); E.propuestas = masCercanos(E.hoyFalta, E.propuestas); } }
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
    const [ancho, alto] = caja(), W = Math.min(440, ancho - 72), H = Math.max(240, alto - 300);
    const muestra = ps.some(p => p.muestra);
    const flechas = lista.length > 1 ? `<button class="at-flecha iz" data-atmov="-1" aria-label="${t('Look anterior', 'Previous look')}">${I.iz}</button><button class="at-flecha de" data-atmov="1" aria-label="${t('Look siguiente', 'Next look')}">${I.de}</button>` : '';
    const ocs = E.hzPreg ? `<div class="at-fila at-ocs">${OCASIONES.filter(o => o === oc || hayOcasion(o)).map(o => `<button class="${o === oc ? 'on' : ''}" data-hzoc="${o}">${ocNombre(o)}${DOS}</button>`).join('')}</div>` : '';
    const fav = esFav(pr.ids), puesto = pr.ids.length > 0 && pr.ids.every(id => (P(id)?.usos || []).includes(hoyISO()));
    // 03/11, tarde (Gabriela: «la página de inicio me da la sensación de apretado… y desorden»; «no me gusta eso de no me gusta»): la ocasión pasa a la cabecera, bajo la
    // fecha; debajo del look, si hace falta, la nota; y abajo, juntos y centrados, el corazón y «Me lo pongo»
    const nota = E.hoyFalta ? avisoFalta(E.hoyFalta, false) : pr.faltaCapa ? `<button class="at-nota" data-ir="subir">${(idioma() === 'en' ? 'With your coat on top: add it and it will show here' : `Con ${pr.capaFalta && pr.capaFalta !== 'abrigo' ? (pr.capaFalta === 'chaqueta' ? 'tu chaqueta' : 'tu ' + pr.capaFalta) : 'tu abrigo'} encima: súbelo y saldrá aquí`)}</button>` : muestra ? `<button class="at-nota" data-ir="subir">${t('Zapatos de muestra: sube los tuyos', 'Sample shoes: add yours')}</button>` : '';
    const ocB = `<button class="at-oc" data-hzpreg aria-expanded="${!!E.hzPreg}" aria-label="${ocNombre(oc)}: ${t('cambiar la ocasión', 'change the occasion')}">${ocNombre(oc)}${I.abajo}</button>`;
    pant.innerHTML = `<div class="at-pant">${cab.replace('</header>', ocB + '</header>')}${ocs}<div class="at-hoy" id="at-hoy">${flechas}${figura(ps, W, H, true)}${nota}</div>
      <div class="at-pie"><button class="at-fav${fav ? ' on' : ''}" id="at-fav" aria-pressed="${fav}" aria-label="${t('Favorito', 'Favourite')}">${I.corazon}</button><button class="at-btn${puesto ? ' hecho' : ''}" id="at-pongo" aria-pressed="${puesto}">${puesto ? t('Puesto hoy', 'Worn today') : t('Me lo pongo', 'I’ll wear it')}</button></div></div>`;
    // el look ocupa el hueco que de verdad queda entre la cabecera y el botón (en cada móvil es distinto)
    const z = $('at-hoy'), ajustar = () => { const fig = z.querySelector('.at-look'); if (!fig || !z.clientHeight) return;
      const resto = [...z.children].filter(x => x !== fig && !x.classList.contains('at-flecha')).reduce((s, x) => s + x.offsetHeight + 6, 0), libre = Math.floor(z.clientHeight - resto - 12);
      if (libre > 120 && Math.abs(libre - fig.offsetHeight) > 4) fig.outerHTML = figura(ps, W, libre, true); };
    ajustar(); requestAnimationFrame(ajustar); // la primera vez la pantalla aún no se ve: se mide en el siguiente fotograma
    const mover = d => { E.hoyIdx = ((E.hoyIdx || 0) + d + lista.length) % lista.length; E.hzPreg = false; pintarHoy(); };
    pant.querySelectorAll('[data-atmov]').forEach(b => b.onclick = () => mover(+b.dataset.atmov));
    $('at-pongo').onclick = async e => { const b = e.currentTarget; await ponerse(pr.ids, pr.c); await datosLook(pr); b.classList.add('hecho'); b.setAttribute('aria-pressed', 'true'); b.textContent = t('Puesto hoy', 'Worn today'); };
    // el corazón, y el doble toque sobre el look como en Instagram (un toque sobre una prenda abre su ficha, un instante después para distinguirlos)
    const fv = $('at-fav'), alternar = async quiero => { if (quiero != null && esFav(pr.ids) === quiero) { fv.classList.remove('late'); void fv.offsetWidth; fv.classList.add('late'); return; }
      await alternarFav(pr.ids, oc); await datosLook(pr); const on = esFav(pr.ids); fv.classList.toggle('on', on); fv.setAttribute('aria-pressed', on); fv.classList.remove('late'); void fv.offsetWidth; if (on) fv.classList.add('late'); };
    fv.onclick = () => alternar();
    let toque = 0, espera = null;
    z.addEventListener('click', e => {
      const ahora = Date.now(), f = e.target.closest('[data-ficha]'), enLook = e.target.closest('.at-look'); if (!enLook) return;
      e.stopPropagation(); clearTimeout(espera);
      if (ahora - toque < 280) { toque = 0; return alternar(true); }
      toque = ahora; if (f) espera = setTimeout(() => abrirFicha(f.dataset.ficha), 280);
    }, true);
    // deslizar el look también cambia de look
    let x0 = null;
    z.ontouchstart = e => { x0 = e.touches[0].clientX; };
    z.ontouchend = e => { if (x0 == null || lista.length < 2) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1); };
  };

  /* ---------- Estilos (Sheila, 03/11, m. 1702: «más visuales, para que las personas se identifiquen con outfits que les gustan»): cada estilo con un look en foto, hecho
     con Gemini (de nadie, sin marcas); la paleta del 22/10 (Gabriela: «me gusta con las paletas de colores») se queda debajo, en una tira. Decide Gabriela ---------- */
  const FOTO_ESTILO = new Set(['oldmoney', 'clasico', 'minimalista', 'frances', 'casual', 'deportivo', 'urbano', 'rock', 'glam', 'retro', 'eclectico', 'romantico', 'boho']);
  const pintarEstiloViejo = pintarEstilo;
  pintarEstilo = function () {
    pintarEstiloViejo();
    document.querySelectorAll('#es-lista [data-estilo]').forEach(b => { if (!FOTO_ESTILO.has(b.dataset.estilo)) return; const tela = b.querySelector('.es-tela'); tela.insertAdjacentHTML('beforebegin', `<img class="es-foto" src="estilos/${b.dataset.estilo}.webp?v=1" alt="">`); tela.classList.add('es-mini'); });
  };

  /* ---------- al volver de una prenda o de un look, el clóset y Looks siguen donde estaban (la queja repetida de las apps de armario) ---------- */
  const irViejo = ir, sitio = {};
  ir = function (n, d) {
    const de = E.pantalla;
    if ((de === 'closet' || de === 'looks') && (n === 'ficha' || n === 'look')) sitio[de] = $('p-' + de).scrollTop;
    irViejo(n, d);
    if ((n === 'closet' || n === 'looks') && (de === 'ficha' || de === 'look') && sitio[n]) $('p-' + n).scrollTop = sitio[n];
  };

  /* ---------- CLÓSET: MiCloset, el buscador a todo el ancho con el filtro dentro, las categorías en letras y la rejilla de 3 en baldosas ---------- */
  const rejCats = () => $('cats');
  pintarCloset = function () {
    const todas = E.prendas, cats = ['Todo', ...CATS_ORDEN.filter(c => todas.some(p => catDe(p) === c))];
    if (!cats.includes(E.filtro)) E.filtro = 'Todo';
    if (E.filtro !== E.atFiltroAnt) { E.atCatsAbiertas = false; E.atFiltroAnt = E.filtro; }
    const cuantas = c => c === 'Todo' ? todas.length : todas.filter(p => catDe(p) === c).length;
    rejCats().innerHTML = `<button class="at-catsel" data-atcats aria-expanded="${!!E.atCatsAbiertas}">${catTxt(E.filtro)} <small>${cuantas(E.filtro)}</small>${I.abajo}</button>`
      + (E.atCatsAbiertas ? `<div class="at-catlista">${cats.map(c => `<button class="${c === E.filtro ? 'activo' : ''}" data-filtro="${c}"${c === E.filtro ? ' aria-current="true"' : ''}>${catTxt(c)} <small>${cuantas(c)}</small></button>`).join('')}</div>` : '');
    const q = E.busca.trim().toLowerCase();
    const lista = todas.filter(p => (E.filtro === 'Todo' || catDe(p) === E.filtro) && pasaFiltros(p) && (!q || [p.nombre, p.color, catDe(p), p.notas].join(' ').toLowerCase().includes(q)));
    const nf = Object.values(E.f).reduce((s, v) => s + v.length, 0); $('mc-nf').textContent = nf || '';
    $('pared').innerHTML = lista.map(p => `<button class="at-cel${conCat(p) ? '' : ' sin-cat'}" data-ficha="${p.id}" aria-label="${esc(p.nombre)}"><img src="${urlCat(p)}" alt="" loading="lazy">${p.estado ? `<i>${estadoTxt(p.estado)}</i>` : ''}</button>`).join('');
    $('closet-vacio').innerHTML = todas.length ? (lista.length ? '' : `<div class="at-vacio"><p>${t('Nada con ese filtro.', 'Nothing matches.')}</p></div>`)
      : `<div class="at-vacio"><p>${t('Haz una foto a cada prenda sobre un fondo liso. Con tres ya hay look de hoy.', 'Photograph each garment on a plain background. With three there is already a look for today.')}</p><button class="at-btn" data-ir="subir">${t('Subir prendas', 'Add garments')}</button>${PUBLICA ? '' : `<button class="at-enlace" id="at-cl-ejemplo">${t('Cargar un clóset de ejemplo', 'Load a sample closet')}</button>`}</div>`;
    const ej = $('at-cl-ejemplo'); if (ej) ej.onclick = cargarEjemplo;
    if (!$('mc-hoja').hidden) pintarFiltros();
  };

  document.addEventListener('click', e => { if (!e.target.closest('[data-atcats]')) return; E.atCatsAbiertas = !E.atCatsAbiertas; pintarCloset(); });

  /* ---------- cómo cuidar cada prenda (Gabriela, 03/11: «esa opción era para dar instrucciones de lavado de cada prenda, cómo tienes que lavarla para cuidarla»).
     Pautas generales por tejido y tipo, sacadas del nombre; la etiqueta manda ---------- */
  function cuidados(p) {
    const n = ((p.nombre || '') + ' ' + (p.notas || '')).toLowerCase(), f = typeof Motor !== 'undefined' ? Motor.ficha(p) : {}, st = f.subtipo || '', out = [];
    const T = (es, en_) => out.push(t(es, en_));
    if (p.tipo === 'Calzado') { /piel|cuero|ante\b|antelina/.test(n) || !/lona|tela|deportiv|zapatilla/.test(n) ? T('Cepíllalos y dales crema de su color; si se mojan, sécalos con papel dentro y lejos del radiador.', 'Brush them and use matching cream; if they get wet, stuff with paper and dry away from heat.') : T('A mano, con agua tibia y jabón neutro; sécalas al aire, nunca en la secadora.', 'By hand with lukewarm water and mild soap; air-dry, never tumble-dry.'); }
    else if (p.tipo === 'Bolsos') T('Límpialo con un paño seco y guárdalo relleno de papel, para que no pierda la forma.', 'Wipe with a dry cloth and store it stuffed with paper so it keeps its shape.');
    else if (p.tipo === 'Accesorios') T('Guárdalo aparte y lejos del perfume y la humedad.', 'Store it separately, away from perfume and damp.');
    else if (/piel|cuero|polipiel|antelina|\bante\b/.test(n) || ['cazadora_cuero'].includes(st)) T('No va a la lavadora: límpiala con un paño húmedo y, si se mancha, a la tintorería.', 'No washing machine: wipe with a damp cloth; take stains to a dry cleaner.');
    else if (/pluma|plumífero|plumifero|acolchad/.test(n) || ['plumifero', 'chaleco_acolchado'].includes(st)) T('Programa delicado en frío y sin suavizante; sécalo a baja temperatura con dos pelotas de tenis para que no se apelmace.', 'Gentle cold cycle, no softener; tumble-dry low with two tennis balls so it doesn’t clump.');
    else if (['abrigo_lana', 'gabardina', 'americana', 'chaleco_traje', 'abrigo_generico'].includes(st)) T('Mejor a la tintorería; entre usos, cepíllalo y déjalo airear en una percha ancha.', 'Best dry-cleaned; between wears, brush it and air it on a wide hanger.');
    else if (/seda|sat[eé]n/.test(n)) T('A mano en agua fría con jabón neutro, sin retorcer; plánchala del revés y a baja temperatura.', 'Hand-wash cold with mild soap, don’t wring; iron inside out on low.');
    else if (/lana|cachemir|cashmere|merino|alpaca|mohair/.test(n)) T('A mano o con el programa de lana, en frío; sécalo en plano sobre una toalla y guárdalo doblado: en percha se deforma.', 'Hand-wash or wool cycle, cold; dry flat on a towel and store folded: hangers stretch it.');
    else if (p.tipo === 'Abajo' && (st === 'vaquero' || /vaquer|jean|denim/.test(n))) T('Del revés, en frío (30 °C) y solo cuando haga falta; tendido, sin secadora: así no destiñe ni encoge.', 'Inside out, cold (30 °C) and only when needed; line-dry, no dryer, so it won’t fade or shrink.');
    else if (/lino/.test(n)) T('A 30–40 °C con programa suave; plánchalo aún húmedo.', 'Gentle wash at 30–40 °C; iron while still damp.');
    else if (['jersey', 'jersey_cuello_alto', 'cardigan', 'chaleco_punto'].includes(st) || /punto|canal/.test(n)) T('Del revés, programa delicado a 30 °C; sécalo en plano y guárdalo doblado.', 'Inside out, delicate cycle at 30 °C; dry flat and store folded.');
    else if (['camisa', 'blusa', 'sobrecamisa'].includes(st)) T('A 30 °C con programa de camisas; cuélgala en percha nada más sacarla y casi no hará falta plancharla.', 'Shirt cycle at 30 °C; hang it straight away and it will barely need ironing.');
    else if (p.tipo === 'Abajo' && /pinzas|vestir|traje|raya/.test(n)) T('Programa delicado a 30 °C o tintorería; cuélgalo por el bajo para que no se marque la raya.', 'Delicate cycle at 30 °C or dry-clean; hang it by the hem so the crease stays.');
    else T('A 30 °C, del revés si tiene estampado; tiéndela a la sombra para que no pierda el color.', 'At 30 °C, inside out if printed; dry in the shade so it keeps its colour.');
    if (!['Calzado', 'Bolsos', 'Accesorios'].includes(p.tipo)) { if (/negr|marino|oscur/.test(n) || ['Negro', 'Azul marino'].includes(p.color)) T('Con la ropa oscura y del revés, para que no se apague el negro.', 'With darks and inside out, so the black stays deep.'); else if (/blanc/.test(n) || p.color === 'Blanco') T('Aparte de los colores, con la ropa blanca.', 'Separately from colours, with whites.'); }
    T('Si la etiqueta dice otra cosa, manda la etiqueta.', 'If the label says otherwise, follow the label.');
    return out;
  }

  /* ---------- PRENDA: la foto, el nombre, una línea de datos y sus looks; «Crear un look»; el resto, en enlaces debajo ---------- */
  const abrirFichaViejo = abrirFicha;
  abrirFicha = function (id) {
    abrirFichaViejo(id); const p = P(id); if (!p) return; // deja hechos los datos, las acciones de siempre y la pantalla
    let r = $('at-ficha'); if (!r) { r = document.createElement('div'); r.id = 'at-ficha'; r.className = 'at-ficha'; $('p-ficha').append(r); }
    const usos = p.usos || [], conj = E.conjuntos.filter(c => c.ids.includes(id));
    const sub = (NOM_X[p.x] || [])[en() ? 1 : 0] || catTxt(catDe(p));
    const fz = Motor.ficha(p), TIRO = { alto: t('Tiro alto', 'High rise'), medio: t('Tiro medio', 'Mid rise'), bajo: t('Tiro bajo', 'Low rise') }, LARGO = { crop: t('Corto, sobre el ombligo', 'Cropped, above the navel'), cintura: t('A la cintura', 'Waist length'), cadera: t('A la cadera', 'Hip length'), largo: t('Largo', 'Long') };
    const forma = p.tipo === 'Abajo' ? TIRO[fz.tiro] : p.tipo === 'Arriba' ? LARGO[fz.largo] : '';
    const datos = [sub, forma, p.color, estNombre(p.estacion), usos.length ? t(`Puesta ${veces(usos.length)}`, `Worn ${veces(usos.length)}`) : t('Sin estrenar', 'Not worn yet')].filter(Boolean).map(esc).join(' · ');
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
      <section class="at-cuidar"><h2>${t('Cómo cuidarla', 'How to care for it')}</h2><ul>${cuidados(p).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <nav class="at-lista" aria-label="${t('Acciones de la prenda', 'Garment actions')}">${acc.map(([k, v]) => `<button data-atfacc="${k}">${esc(v)}</button>`).join('')}</nav>
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

  /* ---------- LOOKS: Mis looks · Favoritos · Calendario, en letras; los looks en baldosas de dos en dos; el primero, «Crear un look» ---------- */
  const filaLooks = act => `<header class="at-tit"><h1>${t('Looks', 'Looks')}</h1></header><nav class="at-fila at-cats" aria-label="${t('Tipos de look', 'Look types')}">${[['ideas', t('Ideas', 'Ideas')], ['mios', t('Mis looks', 'My looks')], ['fav', t('Favoritos', 'Favourites')], ['cal', t('Calendario', 'Calendar')]].map(([k, n]) => `<button class="${act === k ? 'on' : ''}" data-lktab="${k}"${act === k ? ' aria-current="true"' : ''}>${n}${DOS}</button>`).join('')}</nav>`;
  pintarLooks = function () {
    const raiz = $('lk-raiz'); document.documentElement.dataset.looks = 'at';
    if (!E.lkTocado || !['ideas', 'mios', 'fav', 'cal'].includes(E.lkTab)) E.lkTab = 'ideas'; // se abre en Ideas hasta que ella elija otra
    if (E.lkTab === 'cal') return pintarCalendario(raiz);
    if (E.lkTab === 'ideas') return pintarIdeas(raiz);
    const fav = E.lkTab === 'fav', lista = E.conjuntos.filter(c => !fav || c.fav || esFav(c.ids));
    const [ancho] = caja(), TW = Math.floor((ancho - 40 - 12) / 2), TH = Math.round(TW * 1.25);
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

  /* ---------- EL MOTOR DE LOOKS (motor.js): un look solo sale si encaja en una fórmula del oficio y pasa los vetos. Primero lo apuntado en el calendario,
     luego las ideas del motor y después los looks guardados que valgan para el tiempo de hoy ---------- */
  let ultima = {};
  const pedirMotor = (plan, n) => {
    const g = E.perfil?.gustos, hoy = hoyISO(), excluir = [...(g?.fuera || []), ...(g?.hoy?.d === hoy ? g.hoy.k : [])], pr = activas();
    const firma = JSON.stringify([plan, n, hoy, new Date().getHours(), E.tiempo, pr.length, pr.reduce((s, p) => s + (p.usos?.length || 0), 0), E.perfil?.estilos, g, E.perfil?.diag?.fecha, planDemo()]);
    if (ultima[plan + n]?.firma === firma) return ultima[plan + n].r;
    const r = Motor.looks({ prendas: pr, tiempo: E.tiempo, plan, perfil: E.perfil, n, hoy, excluir, pro: planDemo() === 'pro', colorEstacion: EST_COLOR[E.perfil?.colores?.est] });
    ultima[plan + n] = { firma, r }; return r;
  };
  // Gabriela, 03/11: «tampoco que te inventes categorías si no hay ropa para eso: por ejemplo deporte, no tengo subida ropa de deporte, ¿y me pones un conjunto?»
  const DEPORTIVO = new Set(['malla', 'jogger', 'camiseta_tecnica', 'top_deportivo', 'chaqueta_deportiva', 'forro_polar', 'botas_montana']);
  const deVerdad = (plan, l) => plan !== 'Deporte' ? l : l.filter(x => x.ids.some(id => P(id) && DEPORTIVO.has(Motor.ficha(P(id)).subtipo)));
  const propuestasDe = (plan, n) => { const r = pedirMotor(plan, n); return deVerdad(plan, (r.looks.length ? r.looks : r.casi).map(Motor.aPropuesta)); };
  // una ocasión sale en los filtros solo si con tu ropa hay al menos un look para ella
  const hayOcasion = o => o === 'Todos' || propuestasDe(o, 4).length > 0;
  generarLooks = (n, plan) => propuestasDe(plan || 'Todos', n).map(x => ({ ...x, prin: x.ids[0] }));
  // al guardar un look del motor, también su zapato y cómo se lleva la de arriba
  const datosLook = async x => { if (!x.zspec && !x.como) return; const k = claveLook(x.ids), cj = E.conjuntos.find(c => claveLook(c.ids) === k); if (cj && !cj.zspec && !cj.como) { cj.zspec = x.zspec; cj.como = x.como; await guardar(); } };
  const valeHoy = c => {
    const o = { tiempo: E.tiempo, plan: c.ocasion || 'Diario', perfil: E.perfil, hoy: hoyISO(), hora: new Date().getHours() }, K = { Abajo: 'abajo', Vestidos: 'vestido', Abrigo: 'capa', Calzado: 'calzado', Bolsos: 'bolso' };
    for (const id of c.ids) { const p = P(id); if (!p) return false; if (p.tipo === 'Arriba') { if (esCapa(p) && !o.capa) o.capa = p; else if (!o.arriba) o.arriba = p; else o.base_interior = p; } else if (K[p.tipo]) o[K[p.tipo]] = p; }
    if (o.capa && !o.arriba) { o.arriba = o.capa; delete o.capa; }
    return !Motor.juzgar(o).veto.duros.length;
  };
  proponer = function () {
    const props = [], dia = E.agenda[diaISO(new Date())], evA = eventoAhora(), lkA = evA ? lookDe(diaISO(new Date()), evA) : null, clave = claveLook, g = E.perfil?.gustos;
    if (lkA) props.push({ tipo: 'agenda', ids: lkA, ocasion: evA.oc }); else if (dia?.look?.length && dia.look.every(P)) props.push({ tipo: 'agenda', ids: dia.look, ocasion: dia.planes?.[0]?.oc });
    for (const x of propuestasDe(E.plan, 8)) if (!props.some(y => clave(y.ids) === clave(x.ids))) props.push({ tipo: 'propuesta', ...x });
    const guardados = E.conjuntos.filter(c => c.ids.every(id => P(id) && !['guardada', 'donar'].includes(P(id).estado)) && (E.plan === 'Todos' || (c.ocasion || 'Diario') === E.plan) && !props.some(y => clave(y.ids) === clave(c.ids)) && valeHoy(c)).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
    for (const c of guardados.slice(0, 4)) props.push({ tipo: 'conjunto', c, ids: c.ids, zspec: c.zspec, como: c.como });
    const fuera = x => x.tipo !== 'agenda' && (g?.fuera?.includes(clave(x.ids)) || (g?.hoy?.d === hoyISO() && g.hoy.k.includes(clave(x.ids))));
    E.propuestas = props.filter(x => !fuera(x)); if (E.hoyIdx >= E.propuestas.length) E.hoyIdx = 0;
  };

  /* ---------- IDEAS: lo que el motor saca de su ropa para el tiempo de hoy, en rejilla como Pinterest; el corazón guarda sin abrir; sin frases a la vista ---------- */
  function pintarIdeas(raiz) {
    const oc = E.ideaOc || 'Todos', r = pedirMotor(oc, 12), lista = E.ideas = deVerdad(oc, (r.looks.length ? r.looks : r.casi).map(Motor.aPropuesta)), w = E.tiempo;
    const [ancho] = caja(), TW = Math.floor((ancho - 40 - 12) / 2), TH = Math.round(TW * 1.25);
    const fila = ['Todos', 'Diario', 'Oficina', 'Noche', 'Evento', 'Viaje', 'Deporte'].filter(o => o === oc || hayOcasion(o)).map(o => `<button class="${o === oc ? 'on' : ''}" data-ideaoc="${o}"${o === oc ? ' aria-current="true"' : ''}>${o === 'Todos' ? t('Todas', 'All') : ocNombre(o)}${DOS}</button>`).join('');
    const t1 = (x, i) => { const fav = esFav(x.ids); return `<figure class="at-t at-idea">${baldosa(psDe(x), TW, TH, ` data-idea="${i}" aria-label="${esc(ocNombre(x.ocasion))}"`)}<button class="at-fav at-fav-t${fav ? ' on' : ''}" data-ideafav="${i}" aria-pressed="${fav}" aria-label="${t('Favorito', 'Favourite')}">${I.corazon}</button></figure>`; };
    const vendria = r.falta?.length && !en() && activas().length ? `<button class="at-enlace at-vendria" data-ideavendria aria-expanded="${!!E.ideaVendria}">${t('Qué te vendría bien', 'What would help')}</button>${E.ideaVendria ? `<ul class="at-faltas">${r.falta.map(f => `<li>${esc(f.frase)}</li>`).join('')}</ul>` : ''}` : '';
    raiz.innerHTML = filaLooks('ideas') + `<nav class="at-fila at-ocs-ideas" aria-label="${t('Ocasión', 'Occasion')}">${fila}</nav>${w ? `<p class="at-para">${t('Para hoy', 'For today')}, ${Math.round(w.t)}°</p>` : ''}`
      + (lista.length ? `<div class="at-rej2 at-rej-ideas">${lista.map(t1).join('')}</div>` : `<div class="at-vacio">${activas().length ? `<p>${t('Con lo que tienes no sale un look completo para esta ocasión.', 'What you have doesn’t make a complete look for this occasion.')}</p>` : `<p>${t('Sube tu ropa y aquí saldrán tus ideas.', 'Add your clothes and your ideas will appear here.')}</p><button class="at-btn" data-ir="subir">${t('Subir prendas', 'Add garments')}</button>`}</div>`) + `<div class="at-ideas-pie">${vendria}</div>`;
    raiz.onclick = async e => {
      const b = e.target.closest('[data-lktab],[data-ideaoc],[data-idea],[data-ideafav],[data-ideavendria]'); if (!b) return;
      if (b.dataset.lktab) { E.lkTab = b.dataset.lktab; E.lkTocado = true; return pintarLooks(); }
      if (b.dataset.ideaoc) { E.ideaOc = b.dataset.ideaoc; E.ideaVendria = false; return pintarLooks(); }
      if (b.dataset.ideavendria != null) { E.ideaVendria = !E.ideaVendria; return pintarLooks(); }
      if (b.dataset.ideafav != null) { const x = lista[+b.dataset.ideafav]; await alternarFav(x.ids, x.ocasion); await datosLook(x); const on = esFav(x.ids); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); return; }
      abrirIdea(lista[+b.dataset.idea]);
    };
  }
  // una idea abierta: igual que un look, pero aún sin guardar
  function abrirIdea(x) {
    ir('look'); let r = $('at-look'); if (!r) { r = document.createElement('div'); r.id = 'at-look'; r.className = 'at-abierto'; $('p-look').append(r); }
    const [ancho, alto] = caja(), W = Math.min(330, ancho - 60), H = Math.max(260, alto - 330), fav = esFav(x.ids), porque = !en() && x.porque;
    r.innerHTML = `<div class="at-barra-sup"><button class="at-volver" data-ir="looks" aria-label="${t('Volver', 'Back')}">${I.iz}</button><button class="at-fav${fav ? ' on' : ''}" data-atfav aria-pressed="${fav}" aria-label="${t('Favorito', 'Favourite')}">${I.corazon}</button></div>
      <h1 class="at-h1">${esc(ocNombre(x.ocasion))}</h1>
      <div class="at-centro">${figura(psDe(x), W, H, true)}</div>
      <div class="at-acciones"><button class="at-btn" data-atl="pongo">${t('Me lo pongo', 'I’ll wear it')}</button>
        ${porque ? `<div class="at-enlaces"><button class="at-enlace" data-atl="porque" aria-expanded="${!!E.ideaPorque}">${t('Por qué funciona', 'Why it works')}</button></div>${E.ideaPorque ? `<p class="at-porque">${esc(porque)}</p>` : ''}` : ''}</div>`;
    r.onclick = async e => {
      const b = e.target.closest('[data-atl],[data-atfav]'); if (!b) return;
      if (b.dataset.atfav != null) { await alternarFav(x.ids, x.ocasion); await datosLook(x); return abrirIdea(x); }
      if (b.dataset.atl === 'porque') { E.ideaPorque = !E.ideaPorque; return abrirIdea(x); }
      await ponerse(x.ids, null); await datosLook(x); E.propuestas = []; b.textContent = t('Puesto hoy', 'Worn today'); b.classList.add('hecho');
    };
  }

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
