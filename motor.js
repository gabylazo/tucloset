/* TuCloset · motor de looks (Dirección, 31/10/2026). Gabriela: «lo que no podemos permitir es que básicamente hagas looks al azar».
   Un look solo sale si encaja en una fórmula del oficio, se rellena con prendas reales de la usuaria y pasa los vetos; nunca se prueba «todo con todo».
   Especificación, fórmulas y reglas: equipo/moda/investigacion-2026-10/ (ESPEC-MOTOR.md, formulas-looks.json, reglas-looks.json; se copian a motor-datos.js con
   herramientas/motor-datos.py). Sin servidor y sin modelos. Todo entra por parámetro y las prendas no se tocan (la ficha va aparte), para poder probarlo en Node
   contra PRUEBA-CLOSET.md. No hay nada aleatorio: el desempate es una huella del día y del look, así que el mismo día salen las mismas ideas. */
const Motor = (() => {
  let R, F, S = {}, ZV = [];
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // palabra que termina en $ = palabra completa; si no, prefijo de palabra
  const re = w => { const q = norm(w), entera = q.endsWith('$'), t = entera ? q.slice(0, -1) : q; return new RegExp('(^|[^a-z0-9])' + esc(t) + (entera ? '($|[^a-z0-9])' : '')); };
  const SUB_EST = { pantalon_de_vestir: 'pantalon_vestir', camiseta_sin_mangas: 'camiseta_tirantes' }; // el vocabulario de la ficha de la estilista (28/10)
  const COLOR_FINO = ['Mostaza', 'Burdeos', 'Terracota', 'Camel', 'Crema', 'Caqui']; // si el nombre lo dice, manda sobre el color general de la app («body mostaza» guardado como Amarillo)
  const VOL = { ajuste: { regular: 1 }, corte: {} };
  const CONTRARIOS = [['minimalista', 'eclectico'], ['oldmoney', 'urbano'], ['glam', 'casual']];
  // los zapatos de muestra de la app (prototipo/app/zapatos/): solo salen si la usuaria no ha subido ninguno
  const ZAPS = [['zapatillas-blancas', 'zapatillas', 'Blanco', 'plano'], ['zapatillas-negras', 'zapatillas', 'Negro', 'plano'], ['botines-negros-planos', 'botines', 'Negro', 'plano'], ['botines-negros-plataforma', 'botines', 'Negro', 'bajo'], ['botines-camel-plataforma', 'botines', 'Camel', 'bajo'], ['botines-negros-tacon', 'botines', 'Negro', 'medio'], ['mocasines-negros', 'mocasines', 'Negro', 'plano'], ['bailarinas-negras', 'bailarinas', 'Negro', 'plano'], ['sandalias-negras-planas', 'sandalias_planas', 'Negro', 'plano'], ['sandalias-marrones-planas', 'sandalias_planas', 'Marrón', 'plano'], ['sandalias-beige-plataforma', 'sandalias_planas', 'Beige', 'bajo'], ['sandalias-negras-tacon', 'sandalias_tacon', 'Negro', 'medio']];
  const TACON = { plano: 0, bajo: 1, medio: 2, alto: 3 };

  function iniciar(reglas, formulas, siluetas) {
    R = reglas; F = formulas; S = siluetas || {};
    for (const s of R.inferencia.subtipos) s.re = s.palabras.map(re);
    for (const m of R.inferencia.modificadores) {
      m.re = m.palabras.map(re); m.no = (m.excluir || []).map(re);
      if (m.volumen != null && VOL[m.campo]) VOL[m.campo][m.valor] = m.volumen;
    }
    const cn = R.inferencia.color.palabras_en_el_nombre;
    for (const c of Object.keys(cn)) cn[c] = cn[c].map(x => typeof x === 'string' ? re(x) : x);
    F.porId = Object.fromEntries(F.formulas.map(f => [f.id, f]));
    ZV = ZAPS.map(([k, sub, color, tacon]) => {
      const s = R.inferencia.subtipos.find(x => x.id === sub), f = { ...R.inferencia.defecto_atributos, ...s.def, subtipo: sub, cat: 'calzado', conf: {}, tacon, tacon_num: TACON[tacon], estilos: [] };
      if (sub.startsWith('sandalias')) f.abierto = true;
      return { id: 'zm-' + k, muestra: k, _f: conColor(f, color) };
    });
  }
  const grupo = t => t[0] === '@' ? R.grupos[t] || [] : [t];
  const tiposDe = h => h._t || (h._t = [...new Set(h.tipos.flatMap(grupo))]);
  function conColor(f, color) {
    const K = R.color.colores[color] || R.color.colores.Estampado;
    return Object.assign(f, { color, color_clase: K.clase, valor: K.valor, calidez: K.calidez, familia: K.familia, valor_num: { claro: 1, medio: 2, oscuro: 3 }[K.valor] });
  }

  /* ---------- 1. la ficha de cada prenda: lo que dice su nombre, y lo que dieron la usuaria o la estilista manda ---------- */
  function inferir(p, perfil = {}) {
    const I = R.inferencia, nom = norm((p.nombre || '') + ' ' + (p.x || '')), est = p.est || {};
    let sub = I.subtipos.find(s => s.tiposApp.includes(p.tipo) && s.re.some(r => r.test(nom))), conSub = !!sub;
    const dicho = est.sub && I.subtipos.find(s => s.id === (SUB_EST[est.sub] || est.sub));
    if (dicho && !(sub && (sub.id.startsWith(dicho.id) || (dicho.id === 'camiseta' && sub.id === 'henley')))) { sub = dicho; conSub = true; }
    if (!sub) sub = I.por_defecto_si_nada_coincide[p.tipo] || I.por_defecto_si_nada_coincide.Arriba;
    const f = { ...I.defecto_atributos, ...sub.def, subtipo: sub.id, cat: sub.cat, conf: { subtipo: conSub ? 'nombre' : 'defecto' } };
    const fijados = new Set();
    for (const m of I.modificadores) {
      if (m.solo && !m.solo.includes(f.cat)) continue;
      if (!m.re.some(r => r.test(nom)) || m.no.some(r => r.test(nom))) continue;
      const c = m.campo;
      if (c === 'form_mas') { f.form = Math.min(m.max, f.form + m.valor); continue; }
      if (c === 'form_menos') { f.form = Math.max(m.min, f.form - m.valor); continue; }
      if (fijados.has(c)) continue; fijados.add(c);
      f[c] = m.valor; f.conf[c] = 'nombre';
      if (m.volumen != null) f.volumen = m.volumen;
      if (m.clo_mas) f.clo += m.clo_mas; if (m.clo_menos) f.clo -= m.clo_menos;
      if (m.form_min) f.form = Math.max(f.form, m.form_min); if (m.form_max) f.form = Math.min(f.form, m.form_max);
      if (m.tmax_max) f.tmax = Math.min(f.tmax, m.tmax_max);
      if (m.lluvia_mala) f.lluvia_mala = true; if (m.deportiva) f.deportiva = true;
    }
    // color: el de la app; si es «Estampado» o vacío, el del nombre; vaquero = neutro siempre
    let col = p.color && p.color !== 'Estampado' ? p.color : null;
    if (!col) for (const [c, rs] of Object.entries(I.color.palabras_en_el_nombre)) if (rs.some(r => r.test(nom))) { col = c; break; }
    for (const c of COLOR_FINO) if (I.color.palabras_en_el_nombre[c]?.some(r => r.test(nom))) { col = c; break; }
    conColor(f, col || 'Estampado');
    if (f.color === 'Estampado' && f.estampado === 'liso') f.estampado = 'otro';
    // la estación de la ficha solo recorta el rango de temperatura (nunca lo amplía)
    const e = I.estacion_a_rango[p.estacion]; if (e) { f.tmin = Math.max(f.tmin, e.tmin); f.tmax = Math.min(f.tmax, e.tmax); }
    f.estacion = p.estacion;
    for (const [k, v] of Object.entries(est)) if (v != null && !['conf', 'sub', 'pal', 'estilos', 'rol'].includes(k)) { f[k] = v; f.conf[k] = 'usuaria'; }
    if (est.rol) f.rol = est.rol;
    if (est.ajuste && f.cat !== 'abajo' && VOL.ajuste[est.ajuste] != null) f.volumen = VOL.ajuste[est.ajuste];
    if (est.corte && VOL.corte[est.corte] != null) f.volumen = VOL.corte[est.corte];
    if (f.cat === 'abajo') f.largo_pierna = f.largo_pierna || I.largo_pierna_por_corte[f.corte] || 'tobillo';
    if (f.tacon) f.tacon_num = TACON[f.tacon];
    if ((f.tejido === 'denim' && f.cat === 'abajo') || f.subtipo === 'chaqueta_vaquera') f.color_clase = 'neutro';
    if (f.subtipo === 'chaleco_traje') f.rol = est.usoSolo || perfil.usoSolo?.has?.(p.id) ? 'base' : 'capa_ligera'; // solo cuenta como prenda de arriba si ella lo lleva solo
    f.conf_corte = f.conf.corte || 'defecto'; f.conf_tiro = f.conf.tiro || 'defecto';
    f.estilos = est.estilos || [];
    return f;
  }
  const CACHE = new WeakMap();
  function ficha(p, perfil) {
    const sig = [p.nombre, p.tipo, p.color, p.estacion, p.x, JSON.stringify(p.est || 0), perfil.usoSolo?.has?.(p.id) ? 1 : 0].join('|'), c = CACHE.get(p);
    if (c && c.sig === sig) return c.f;
    const f = inferir(p, perfil); CACHE.set(p, { sig, f }); return f;
  }

  /* ---------- 2. el momento: sensación térmica, tramo de abrigo y lluvia ---------- */
  function sensacion(t, v) { if (t <= 10 && v > 4.8) { const k = Math.pow(v, .16); return 13.12 + .6215 * t - 11.37 * k + .3965 * t * k; } return t; } // Environment Canada
  function contexto(tiempo, plan, extra = {}) {
    tiempo = tiempo || { t: 18 };
    const h = extra.hora ?? new Date().getHours(), v = tiempo.viento ?? 0, sens = tiempo.sens ?? sensacion(tiempo.t, v), tmin = tiempo.min ?? tiempo.t, tmax = tiempo.max ?? tiempo.t;
    let t_ref = extra.t_ref ?? (h < 11 ? (sens + tmin + 2) / 2 : sens);
    if (extra.t_ref == null && (plan === 'Noche' || plan === 'Evento') && h >= 19) t_ref = Math.min(sens, tmin + 4);
    const tr = R.clima.tramos.find(x => t_ref >= x.desde) || R.clima.tramos[R.clima.tramos.length - 1];
    const lluvia = (tiempo.lluvia ?? 0) >= R.clima.lluvia.umbral_probabilidad || tiempo.lluviaH != null;
    return { t_ref, t_min: tmin, t_max: tmax, amplitud: tmax - tmin, lluvia, viento: v, humedad: tiempo.hum ?? 50, hora: h, ocasion: plan, evento: extra.evento || null, lugar: extra.lugar || 'normal',
      tramo: tr, clo_min: tr.clo[0], clo_max: tr.clo[1], clo_min_menos_0_4: tr.clo[0] - .4, clo_max_mas_0_35: tr.clo[1] + .35, sol: (tiempo.uv ?? 0) >= 6, paraguas: !!extra.paraguas };
  }
  function perfilMotor(pf = {}, opc = {}) {
    const usoSolo = new Set(pf.usoSolo || []); // el chaleco que los looks a mano llevan sin nada encima lo lleva solo
    for (const l of pf.estilista?.looks || []) if (l.arriba && !l.capa) usoSolo.add(l.arriba);
    const dc = pf.diag?.color, ec = dc?.si ? dc : opc.colorEstacion, cint = pf.cintura === '1' || pf.cintura === 'si' ? 'si' : pf.cintura === '0' || pf.cintura === 'no' ? 'no' : undefined;
    const reglas = opc.pro ? (pf.diag?.cuerpo?.puntos || S[pf.tipoCuerpo] || null) : null;
    return { estilos: pf.estilos || [], publico: pf.publico || 'todo', cintura: cint, tacon: pf.tacon, tacon_num: TACON[pf.tacon], evitarColores: pf.evitarColores || [], usoSolo, gustos: pf.gustos || {}, diag: { estacion: ec ? { si: ec.si, no: ec.no } : undefined, puntos: reglas } };
  }

  /* ---------- 3. condiciones: las de las fórmulas sobre una prenda y las de las reglas sobre el look ---------- */
  function cumpleCond(cond, f) {
    if (!cond) return true;
    for (const k in cond) {
      const v = cond[k], neg = k[0] === '!', x = f[neg ? k.slice(1) : k];
      const ok = Array.isArray(v) ? v.includes(x) : (v && typeof v === 'object') ? (x != null && (v.min == null || x >= v.min) && (v.max == null || x <= v.max)) : x === v;
      if (neg ? ok : !ok) return false;
    }
    return true;
  }
  const RUTAS = new Map(), ES_RUTA = /^(look|ctx|perfil|arriba|abajo|vestido|capa|calzado|bolso|formula)\./;
  const ruta = p => RUTAS.get(p) || (RUTAS.set(p, p.split('.')), RUTAS.get(p));
  const leer = (p, env) => { let o = env; for (const k of ruta(p)) { if (o == null) return undefined; o = o[k]; } return o; };
  const OP = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
    en: (a, b) => Array.isArray(a) ? a.some(x => (b || []).includes(x)) : (b || []).includes(a), no_en: (a, b) => !OP.en(a, b), contiene: (a, b) => (a || []).includes(b) };
  function una(c, env) {
    if (!Array.isArray(c)) return c.o.some(x => Array.isArray(x) && Array.isArray(x[0]) ? x.every(y => una(y, env)) : una(x, env));
    const a = leer(c[0], env);
    if (c[1] === 'existe') return a != null; if (c[1] === 'no_existe') return a == null;
    if (a === undefined) return false;
    const b = typeof c[2] === 'string' && ES_RUTA.test(c[2]) ? leer(c[2], env) : c[2];
    return OP[c[1]](a, b);
  }
  const cumple = (si, env) => { for (const c of si) if (!una(c, env)) return false; return true; };

  /* ---------- 4. los campos del look ---------- */
  const PIEZAS = ['arriba', 'base_interior', 'abajo', 'vestido', 'capa', 'calzado', 'bolso', 'accesorio'];
  const diasDesde = (iso, hoy) => Math.round((Date.parse(hoy) - Date.parse(iso)) / 864e5);
  function camposLook(l, ctx, pf, hoy) {
    const ps = PIEZAS.map(k => l[k]).filter(Boolean), ropaP = ps.filter(p => !['calzado', 'bolso', 'accesorio'].includes(p._f.cat)), ropa = ropaP.map(p => p._f);
    const prA = l.arriba || l.vestido, A = prA?._f, B = l.abajo?._f, C = l.capa?._f;
    const forms = ropa.map(f => f.form ?? 3), media = forms.reduce((s, x) => s + x, 0) / (forms.length || 1), fmax = Math.max(...forms), fmin = Math.min(...forms);
    const acentos = [...new Set(ropa.filter(f => !['neutro', 'neutro_suave', 'estampado'].includes(f.color_clase)).map(f => f.color))];
    const estamp = ropaP.filter(p => p._f.estampado !== 'liso'), hayConjunto = estamp.length === 2 && (estamp[0]._f.conjunto === estamp[1].id || estamp[1]._f.conjunto === estamp[0].id);
    const clo = .2 + ps.reduce((s, p) => s + (p._f.clo || 0), 0), fuera = clo < ctx.clo_min ? ctx.clo_min - clo : clo > ctx.clo_max ? clo - ctx.clo_max : 0;
    const claros = c => R.color.colores[c]?.valor === 'claro';
    const pares = acentos.flatMap((x, i) => acentos.slice(i + 1).map(y => [x, y])), esPar = (lista, a, b) => lista.some(q => (q[0] === a && q[1] === b) || (q[0] === b && q[1] === a));
    const colores = [...new Set(ropa.map(f => f.color))];
    const valores = {}, familias = {}; ropa.forEach(f => { valores[f.valor] = (valores[f.valor] || 0) + 1; familias[f.familia] = (familias[f.familia] || 0) + 1; });
    const dom = (o, ratio) => { const [k, n] = Object.entries(o).sort((a, b) => b[1] - a[1])[0] || []; return n && n >= ropa.length * ratio && (ratio === .5 || n > ropa.length / 2) ? k : ''; };
    const conEstilos = ropa.map(f => f.estilos || []), cuenta = {}; conEstilos.forEach(es => es.forEach(e => { cuenta[e] = (cuenta[e] || 0) + 1; }));
    const estilos = new Set([...(l.formula?.estilos || []), ...ropa.flatMap(f => f.estilos || [])]);
    const contrario = CONTRARIOS.some(([x, y]) => (pf.estilos.includes(x) && !pf.estilos.includes(y) && (l.formula?.estilos || []).includes(y)) || (pf.estilos.includes(y) && !pf.estilos.includes(x) && (l.formula?.estilos || []).includes(x)));
    const texturas = new Set([A, B, C].filter(Boolean).map(f => f.tejido).filter(x => x && x !== 'desconocido'));
    const denim = ropa.filter(f => f.tejido === 'denim');
    let bases = (l.arriba && l.arriba._f.rol === 'base') ? 1 : 0;
    if (l.base_interior && l.base_interior._f.rol === 'base' && !(l.arriba && (R.grupos['@punto'].includes(l.arriba._f.subtipo) || ['cardigan', 'sudadera', 'chaleco_punto', 'chaleco_traje'].includes(l.arriba._f.subtipo)))) bases++;
    const ids = ropaP.map(p => p.id), parK = []; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (!ps[i].muestra && !ps[j].muestra) parK.push([ps[i].id, ps[j].id].sort().join('|'));
    const g = pf.gustos, si = parK.filter(k => g.si?.[k]).length, no = parK.filter(k => g.no?.[k]);
    const ids2 = PIEZAS.map(k => l[k]).filter(p => p && !p.muestra).map(p => p.id).sort().join();
    const claves = [prA, l.abajo].filter(Boolean); let dias; for (const p of claves) for (const u of p.p?.usos || []) { const d = diasDesde(u, hoy); if (d >= 0 && (dias == null || d < dias)) dias = d; }
    const usos = ropaP.reduce((s, p) => s + (p.p?.usos?.length || 0), 0) / (ropaP.length || 1);
    let diag = 0;
    if (pf.diag.puntos) for (const r of pf.diag.puntos) {
      const vale = v => Array.isArray(r.valor) ? r.valor.includes(v) : r.valor === 'no_liso' ? v && v !== 'liso' : r.valor === v;
      if (r.donde === 'abajo' && B && vale(B[r.campo])) diag += r.p; else if (r.donde === 'arriba' && A && vale(A[r.campo])) diag += r.p;
      else if (r.donde === 'look' && ((r.campo === 'como' && l.como === 'por_dentro') || (r.campo === 'capa' && C) || (r.campo === 'mismo_color' && A && B && A.color === B.color))) diag += r.p;
    }
    const n_abajos = (l.abajo ? 1 : 0) + (l.vestido && l.abajo ? 1 : 0);
    return { vol_arriba: A?.volumen ?? 1, vol_abajo: B?.volumen ?? 1, form_max: fmax, form_min: fmin, form_dif: fmax - fmin, form_media: media, form_media_menos_1: media - 1, form_media_menos_2: media - 2, form_media_mas_1: media + 1, form_media_mas_2: media + 2,
      n_estampados: hayConjunto ? 1 : estamp.length, conjunto_estampado: hayConjunto, n_acentos: acentos.length, n_colores: colores.length, colores,
      pareja_no: pares.some(([a, b]) => esPar(R.color.pares_no, a, b) && !(claros(a) && claros(b))), pareja_si: pares.some(([a, b]) => esPar(R.color.pares_si, a, b)), pareja_dudosa: pares.some(([a, b]) => esPar(R.color.pares_dudosos, a, b)),
      clo_total: clo, clo_fuera: fuera, clo_en_rango: fuera === 0, capa_manga_larga: !!(C && C.manga !== 'sin_mangas'), tiene_abrigo: C?.rol === 'abrigo', capa_quitable: !!(C && C.rol !== 'abrigo'),
      n_capas: [l.capa, l.base_interior && l.base_interior._f.rol === 'capa_ligera'].filter(Boolean).length, capa_sin_base: !l.vestido && l.arriba?._f.rol === 'capa_ligera' && !l.base_interior, n_bases_arriba: bases,
      n_deportivas: ropa.filter(f => f.deportiva).length + (l.calzado?._f.deportiva ? 1 : 0), tonal: !!(A && B && A.familia === B.familia), contraste_valor: !!(A && B && ((A.valor === 'claro' && B.valor === 'oscuro') || (A.valor === 'oscuro' && B.valor === 'claro'))),
      cintura_al_aire: !!(A && B && A.largo === 'crop' && A.subtipo !== 'body' && l.como !== 'por_dentro' && (B.tiro === 'bajo' || (B.tiro === 'medio' && pf.cintura === 'no') || (B.tiro === 'medio' && pf.cintura == null))),
      cintura_marcada: !!(A && B && B.tiro === 'alto' && (['crop', 'cintura'].includes(A.largo) || l.como === 'por_dentro')),
      como: l.como || 'suelta', n_abajos, dos_denim_distintos: denim.length >= 2 && new Set(denim.map(f => f.color)).size > 1, usa_color_vetado: ropa.some(f => pf.evitarColores.includes(f.color)),
      pareja_rechazada_3: no.some(k => g.no[k] >= 3), parejas_gustadas: si, parejas_rechazadas: no.length, es_favorito: (g.fav || []).includes(ids2),
      n_focos: ropa.filter(f => ['acento', 'vivo', 'suave'].includes(f.color_clase) || !['liso', 'rayas_finas'].includes(f.estampado) || ['brillo', 'cuero', 'volantes'].includes(f.tejido)).length,
      texturas_distintas: texturas.size, estilos_en_comun: Object.values(cuenta).filter(n => n >= 2).length, estilos_perfil_coinciden: pf.estilos.filter(e => estilos.has(e)).length, estilo_contrario: contrario,
      puntos_diag: Math.max(-.4, Math.min(.4, diag)), dias_desde_ultimo_uso: dias, usos_medios: usos, prenda_nueva_14d: ropaP.some(p => p.p?.creada && diasDesde(p.p.creada, hoy) <= 14),
      hay_estampado_fuerte: ropa.some(f => !['liso', 'rayas_finas'].includes(f.estampado)), acento_fuera_del_estampado: acentos.length > 0 && ropa.some(f => !['liso', 'rayas_finas'].includes(f.estampado)),
      mezcla_negro_marron: colores.includes('Negro') && colores.includes('Marrón'), negro_total: colores.length === 1 && colores[0] === 'Negro', blanco_total: colores.every(c => ['Blanco', 'Crema'].includes(c)),
      hombros_descubiertos: !C && ropa.some(f => ['sin_mangas', 'tirantes'].includes(f.manga)), rodillas_descubiertas: ropa.some(f => ['falda_mini', 'vestido_corto', 'shorts'].includes(f.subtipo)),
      hay_accesorio_util: !!l.accesorio, accesorio_frio: ['bufanda', 'gorro', 'guantes'].includes(l.accesorio?._f.subtipo), valor_dominante: dom(valores, .51), familia_dominante: dom(familias, .5),
      prendas_fuera_de_rango: ps.filter(p => (p._f.tmin != null && ctx.t_ref < p._f.tmin - 3) || (p._f.tmax != null && ctx.t_ref > p._f.tmax + 3)).length,
      arriba_fuera_grados: A?.tmax != null ? Math.max(0, ctx.t_ref - A.tmax) : 0, abajo_fuera_grados: B?.tmax != null ? Math.max(0, ctx.t_ref - B.tmax) : 0,
      n_neutros_pct: ropa.filter(f => ['neutro', 'neutro_suave'].includes(f.color_clase)).length / (ropa.length || 1), ids };
  }
  function entorno(l, campos, ctx, pf) {
    const e = { look: campos, ctx, perfil: pf, formula: l.formula || {} };
    if (l.arriba || l.vestido) e.arriba = (l.arriba || l.vestido)._f;
    for (const k of ['abajo', 'vestido', 'capa', 'calzado', 'bolso']) if (l[k]) e[k] = l[k]._f;
    return e;
  }
  function vetar(env, soloPareja) {
    const duros = [], blandos = [];
    for (const v of R.vetos.lista) { if (soloPareja && !BARATOS.has(v.id)) continue; if (cumple(v.si, env)) (v.duro ? duros : blandos).push(v); }
    return { duros, blandos, p: blandos.reduce((s, v) => s + (v.p || 0), 0) };
  }
  const BARATOS = new Set(['V39', 'V02', 'V03', 'V04', 'V05', 'V06', 'V08', 'V09', 'V19', 'V21', 'V22', 'V23', 'V24', 'V25', 'V34', 'V37']); // los que solo dependen de la pareja y del momento
  function puntuar(l, campos, env) {
    const suma = {};
    for (const r of R.puntos.reglas) if (cumple(r.si, env)) { const p = typeof r.p === 'string' ? campos[r.p.split('.')[1]] : r.p; suma[r.grupo] = (suma[r.grupo] || 0) + p; }
    for (const h of l.formula?.huecos || []) for (const [k, v] of Object.entries(h.pref || {})) if (l[h.rol] && v.includes(l[h.rol]._f[k])) suma.coherencia = (suma.coherencia || 0) + .05;
    let total = 0; for (const [g, w] of Object.entries(R.puntos.grupos)) total += w * Math.max(-1, Math.min(1, suma[g] || 0));
    return { total, suma };
  }

  /* ---------- 5. rellenar los huecos de una fórmula ---------- */
  const comoDe = (formula, l) => {
    if (formula?.como) return formula.como;
    const A = (l.arriba || l.vestido)?._f, B = l.abajo?._f; if (!A || !B) return 'suelta';
    if (A.subtipo === 'body') return 'por_dentro';
    if (B.tiro === 'alto' && ['cadera', 'largo'].includes(A.largo) && A.ajuste !== 'oversize' && A.grosor !== 'grueso' && A.ajuste !== 'holgado') return 'por_dentro';
    return 'suelta';
  };
  const cands = (h, ents) => { const t = tiposDe(h); return ents.filter(p => t.includes(p._f.subtipo) && cumpleCond(h.cond, p._f)); };
  function puntosCalzado(c, l, ctx, pf, h) {
    const z = c._f, ropa = PIEZAS.map(k => l[k]).filter(p => p && !['calzado', 'bolso'].includes(p._f.cat)).map(p => p._f), B = l.abajo?._f, T = ctx.tramo.calzado || {};
    const media = ropa.reduce((s, f) => s + (f.form ?? 3), 0) / (ropa.length || 1), cols = new Set(ropa.map(f => f.color)), fam = new Set(ropa.map(f => f.familia)), denim = ropa.some(f => f.tejido === 'denim');
    let s = 0;
    if ((T.prohibir || []).includes(z.subtipo)) s -= 2; if ((T.preferir || []).includes(z.subtipo)) s += .4;
    s -= Math.abs((z.form ?? 3) - media) * .15;
    if (pf.tacon_num != null && z.tacon_num > pf.tacon_num) s -= .6;
    if (B?.corte === 'acampanado') s += z.tacon === 'plano' ? -1 : .5;
    if (z.color === 'Negro' && ['Negro', 'Gris', 'Azul'].some(x => cols.has(x))) s += .4;
    if (z.color === 'Blanco') { if ((denim || cols.has('Gris') || cols.has('Blanco')) && media < 3) s += .45; if (media >= 3) s -= .3; if (ctx.lluvia) s -= .3; }
    if (['Marrón', 'Camel'].includes(z.color)) { if (fam.has('tierra') || denim || cols.has('Azul')) s += .4; if (cols.has('Negro')) s -= .3; }
    if (z.color === 'Beige' && fam.has('tierra')) s += .2;
    if (ctx.t_ref >= 26 && z.abierto) s += .2;
    for (const [k, v] of Object.entries(h?.pref || {})) if (v.includes(z[k])) s += .1;
    return s - (c.p?.usos?.length || 0) * .002;
  }
  const cloMedia = ctx => (ctx.clo_min + ctx.clo_max) / 2;
  const cloPiezas = l => .2 + PIEZAS.map(k => l[k]).filter(Boolean).reduce((s, p) => s + (p._f.clo || 0), 0);
  const cercania = (c, l, ctx) => -Math.abs(cloMedia(ctx) - (cloPiezas(l) + (c._f.clo || 0))) + (ctx.lluvia && c._f.impermeable ? .3 : 0) - (c.p?.usos?.length || 0) * .002;
  // la capa que pide el tramo de temperatura aunque la fórmula no la escriba
  function capaPorClima(l, ents, ctx) {
    const id = ctx.tramo.id, grupos = id === 'T4' ? ['@capa_ligera', '@capa_media'] : id === 'T5' ? ['@capa_media', '@abrigo_frio'] : id === 'T6' || id === 'T7' ? ['@abrigo_frio'] : id === 'T3' ? ['@capa_ligera'] : id === 'T2' && (ctx.t_min < 16 || ctx.amplitud >= 10) ? ['@capa_ligera'] : null;
    if (!grupos || l.capa) return [];
    const t = grupos.flatMap(g => R.grupos[g]), cs = ents.filter(p => t.includes(p._f.subtipo) && !PIEZAS.some(k => l[k] === p)).sort((a, b) => cercania(b, l, ctx) - cercania(a, l, ctx)).slice(0, 2);
    return cs.map(c => ({ ...l, capa: c }));
  }
  function rellenar(formula, ents, zapatos, ctx, pf, hoy, cacheP) {
    const H = r => formula.huecos.filter(h => h.rol === r), salida = [], parejas = [];
    const [hv] = H('vestido');
    if (hv) for (const v of cands(hv, ents)) parejas.push({ vestido: v, n: 0 });
    else {
      const ha = H('arriba')[0], hb = H('abajo')[0]; if (!ha || !hb) return salida;
      for (const a of cands(ha, ents)) for (const b of cands(hb, ents)) {
        if (a === b) continue;
        const k = a.id + '|' + b.id; let par = cacheP.get(k);
        if (!par) { const l = { arriba: a, abajo: b }; l.como = comoDe(null, l); const c = camposLook(l, ctx, pf, hoy), e = entorno(l, c, ctx, pf); par = { v: vetar(e, true).duros.length > 0, n: puntuar(l, c, e).total }; cacheP.set(k, par); }
        if (!par.v) parejas.push({ arriba: a, abajo: b, n: par.n });
      }
    }
    parejas.sort((x, y) => y.n - x.n);
    for (const par0 of parejas.slice(0, 12)) {
      const par = { ...par0, formula }; delete par.n; par.como = comoDe(formula, par);
      let looks = [par], faltaHueco = null;
      for (const r of ['capa', 'base_interior']) {
        const [hc] = H(r); if (!hc) continue;
        // lo de debajo: una camisa que asoma, o una prenda neutra si de verdad hace frío (una camiseta roja bajo un jersey de rayas no aporta nada)
        const debajo = p => r !== 'base_interior' || (p._f.largo !== 'crop' && (p._f.subtipo === 'camisa' || (['T5', 'T6', 'T7'].includes(ctx.tramo.id) && ['neutro', 'neutro_suave'].includes(p._f.color_clase))));
        const cs = cands(hc, ents).filter(p => !PIEZAS.some(k => par[k] === p) && debajo(p)).sort((a, b) => cercania(b, par, ctx) - cercania(a, par, ctx)).slice(0, 2);
        if (!cs.length && !hc.opcional) { faltaHueco = { rol: r, h: hc }; continue; }
        looks = looks.flatMap(l => cs.map(c => ({ ...l, [r]: c })).concat(hc.opcional ? [l] : []));
      }
      looks = looks.flatMap(l => { const con = capaPorClima(l, ents, ctx); if (!con.length && !l.capa && String(ctx.tramo.capa).startsWith('obligatoria')) return [{ ...l, capa_faltante: true }]; return con.concat(con.length && String(ctx.tramo.capa).startsWith('obligatoria') ? [] : [l]); });
      for (const l of looks) {
        const [hz] = H('calzado'); let cs = hz ? cands(hz, zapatos) : [];
        if (!cs.length && zapatos.length && !zapatos[0].muestra) cs = zapatos; // con zapatos subidos, siempre uno suyo
        const aguanta = cs.filter(c => pf.tacon_num == null || c._f.tacon_num <= pf.tacon_num); if (aguanta.length) cs = aguanta; // el tacón que ella dijo, si hay con qué
        cs = cs.map(c => [puntosCalzado(c, l, ctx, pf, hz), c]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]);
        for (const c of cs.length ? cs : [null]) {
          const l2 = { ...l }; if (c) l2.calzado = c; if (faltaHueco) l2.hueco_faltante = faltaHueco;
          const [hb] = H('bolso'); if (hb && c) { const b = cands(hb, ents)[0]; if (b) l2.bolso = b; }
          salida.push(l2);
        }
      }
    }
    return salida;
  }
  const claveRopa = l => ['arriba', 'base_interior', 'abajo', 'vestido', 'capa'].map(k => l[k]?.id).filter(Boolean).sort().join();
  const huella = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return (h % 1000) / 1000; };
  function evaluar(l, ctx, pf, hoy) {
    const c = camposLook(l, ctx, pf, hoy), e = entorno(l, c, ctx, pf), veto = vetar(e), pts = puntuar(l, c, e);
    // un look puesto ayer no es la primera idea: el peso del grupo «variedad» solo no lo baja lo bastante
    const ayer = c.dias_desde_ultimo_uso === 1 || c.dias_desde_ultimo_uso === 0 ? (c.es_favorito ? .05 : .15) : 0;
    return { ...l, ctx, campos: c, veto, pts, nota: pts.total + veto.p / 4 - ayer + huella(hoy + claveRopa(l)) * .04, casi: !!(l.hueco_faltante || (l.capa_faltante && ['T5', 'T6', 'T7'].includes(ctx.tramo.id) && veto.duros.every(v => v.id === 'V11'))) };
  }
  function elegir(cs, n, excluir) {
    const ok = cs.filter(l => !l.veto.duros.length && !l.casi && !excluir.has(claveLook(l))).sort((a, b) => b.nota - a.nota), sel = [], usoA = new Map(), usoB = new Map(), usoF = new Map(), vistos = new Set(), gemelos = new Set();
    for (const tope of [1, 2]) for (const l of ok) {
      if (sel.length >= n) break; if (l.nota < R.puntos.umbrales.mostrar_minimo && sel.length) break;
      const a = (l.arriba || l.vestido).id, b = l.abajo?.id, k = claveRopa(l), fA = (l.arriba || l.vestido)._f, gem = [b, fA.color, fA.estampado, fA.manga].join('|');
      if (tope === 1 && gemelos.has(gem)) continue; // misma prenda de abajo y una de arriba que se ve casi igual: solo si no hay otra cosa
      if (vistos.has(k) || (usoA.get(a) || 0) >= tope || (b && tope === 1 && (usoB.get(b) || 0) >= 2) || (b && (usoB.get(b) || 0) >= Math.max(3, Math.ceil(n / 2))) || (usoF.get(l.formula.id) || 0) >= 2) continue;
      vistos.add(k); gemelos.add(gem); sel.push(l); usoA.set(a, (usoA.get(a) || 0) + 1); if (b) usoB.set(b, (usoB.get(b) || 0) + 1); usoF.set(l.formula.id, (usoF.get(l.formula.id) || 0) + 1);
    }
    // sin dos seguidos con la misma prenda de arriba
    const out = [], resto = [...sel];
    while (resto.length) { const pre = out[out.length - 1], i = resto.findIndex(l => !pre || (l.arriba || l.vestido).id !== (pre.arriba || pre.vestido).id); out.push(...resto.splice(i < 0 ? 0 : i, 1)); }
    return out;
  }
  const claveLook = l => PIEZAS.map(k => l[k]).filter(p => p && !p.muestra).map(p => p.id).sort().join();

  /* ---------- 6. fórmulas posibles, qué falta y la llamada de la app ---------- */
  const OC_TODOS = ctx => ctx.hora >= 19 ? ['Noche', 'Diario', 'Viaje', 'Oficina'] : ['Diario', 'Viaje', 'Oficina'];
  function formulasPosibles(ctx, pf, plan, margen = 1) {
    const ocs = plan === 'Todos' ? OC_TODOS(ctx) : [plan];
    return F.formulas.filter(f => f.ocasiones.some(o => ocs.includes(o)) && ctx.t_ref >= f.tmin - margen && ctx.t_ref <= f.tmax + margen && (!ctx.lluvia || f.lluvia) && (!f.requiere_estilo || pf.estilos.some(e => f.requiere_estilo.includes(e))));
  }
  const NOMBRES = { mocasines: 'mocasines', botines: 'botines', zapatillas: 'zapatillas', sandalias_planas: 'sandalias planas', sandalias_tacon: 'sandalias de tacón', bailarinas: 'bailarinas', tacones: 'tacones', zapato_cordones: 'zapatos de cordones', botas_altas: 'botas altas', botas_agua: 'botas de agua', botas_montana: 'botas de montaña', alpargatas: 'alpargatas', abrigo_lana: 'abrigo de lana', plumifero: 'plumífero', pantalon_vestir: 'pantalón de vestir', pantalon_fluido: 'pantalón fluido', pantalon_lino: 'pantalón de lino', cardigan: 'cárdigan', jersey_cuello_alto: 'jersey de cuello alto', vestido_midi: 'vestido midi', falda_midi: 'falda midi' };
  const nombreTipo = id => NOMBRES[id] || R.inferencia.subtipos.find(s => s.id === id)?.palabras?.[0] || id.replace(/_/g, ' ');
  function faltas(ctx, plan, ents, zapatosPropios, pf) {
    const ps = formulasPosibles(ctx, pf, plan, 1), cuenta = {};
    for (const f of ps) {
      const sin = f.huecos.filter(h => !h.opcional && !cands(h, h.rol === 'calzado' ? zapatosPropios : ents).length);
      if (sin.length !== 1) continue;
      const h = sin[0], abrigo = h.rol === 'capa' && tiposDe(h).some(t => R.grupos['@abrigo_frio'].includes(t)), g = abrigo ? 'abrigo' : h.rol === 'base_interior' ? 'arriba' : h.rol;
      const c = cuenta[g] = cuenta[g] || { n: 0, tipos: {} }; c.n++; const t0 = tiposDe(h)[0]; c.tipos[t0] = (c.tipos[t0] || 0) + 1;
    }
    if (String(ctx.tramo.capa).startsWith('obligatoria') && !ents.some(p => p._f.cat === 'capa' && p._f.subtipo !== 'chaleco_traje')) {
      const t0 = ctx.tramo.id === 'T4' ? 'gabardina' : ctx.tramo.id === 'T5' ? 'abrigo_lana' : 'plumifero', g = ctx.tramo.id === 'T4' ? 'capa' : 'abrigo', c = cuenta[g] = cuenta[g] || { n: 0, tipos: {} };
      c.n += 50; c.tipos[t0] = (c.tipos[t0] || 0) + 50;
    }
    const orden = R.faltas.prioridad;
    return Object.entries(cuenta).sort((a, b) => b[1].n - a[1].n || orden.indexOf(a[0]) - orden.indexOf(b[0])).slice(0, 3).map(([g, c]) => {
      const t0 = Object.entries(c.tipos).sort((a, b) => b[1] - a[1])[0][0];
      return { grupo: g, tipo: t0, n: c.n, frase: R.faltas.frases[g].replace('{tipo}', nombreTipo(t0)) };
    });
  }
  /* Entrada: { prendas, tiempo, plan, perfil, n, hoy, hora, excluir, pro, colorEstacion }. Salida: { looks, casi, falta, ctx }. */
  function looks(o) {
    const t0 = Date.now(), hoy = o.hoy || new Date().toISOString().slice(0, 10), plan = o.plan || 'Todos', n = o.n || 6, pf = perfilMotor(o.perfil, o), excluir = new Set(o.excluir || []);
    const ctx0 = contexto(o.tiempo, plan, { hora: o.hora, t_ref: o.t_ref, evento: o.evento, lugar: o.lugar });
    const ents = (o.prendas || []).filter(p => !p.noMeGusta).map(p => ({ id: p.id, p, _f: ficha(p, pf) }));
    const ropa = ents.filter(p => p.p.tipo !== 'Calzado'), propios = ents.filter(p => p.p.tipo === 'Calzado'), zapatos = propios.length ? propios : ZV;
    let cs = [], res = [];
    for (const margen of [1, 3]) {
      const cacheP = new Map(); cs = [];
      for (const f of formulasPosibles(ctx0, pf, plan, margen)) {
        const ocs = plan === 'Todos' ? OC_TODOS(ctx0).filter(x => f.ocasiones.includes(x)) : [plan], ctx = plan === 'Todos' ? { ...ctx0, ocasion: ocs[0] } : ctx0;
        const resta = plan === 'Todos' && ocs[0] !== 'Diario' && ocs[0] !== 'Noche' ? .1 : 0; // sin plan, antes lo de diario
        for (const l of rellenar(f, ropa, zapatos, ctx, pf, hoy, cacheP)) { const e = evaluar(l, ctx, pf, hoy); e.nota -= resta; cs.push(e); }
      }
      res = elegir(cs, n, excluir); if (res.length >= Math.min(3, n)) break;
    }
    const casi = res.length ? [] : elegir(cs.filter(l => l.casi).map(l => ({ ...l, veto: { ...l.veto, duros: [] }, casi: false, faltaCapa: true })), Math.min(n, 4), excluir);
    return { looks: res, casi, falta: faltas(ctx0, plan, ropa, propios, pf), ctx: ctx0, ms: Date.now() - t0, candidatos: cs.length, todos: o.depurar ? cs : undefined };
  }
  // una combinación concreta (la prueba de los prohibidos y los looks guardados): vetos y nota, sin fórmula
  function juzgar(o) {
    const pf = perfilMotor(o.perfil, o), ctx = contexto(o.tiempo, o.plan || 'Diario', { hora: o.hora ?? 12, t_ref: o.t_ref, evento: o.evento, lugar: o.lugar }), l = { formula: o.formula || null }, hoy = o.hoy || new Date().toISOString().slice(0, 10);
    for (const k of PIEZAS) if (o[k]) l[k] = o[k]._f ? o[k] : { id: o[k].id, p: o[k], _f: ficha(o[k], pf) };
    l.como = o.como || comoDe(o.formula, l);
    return evaluar(l, ctx, pf, hoy);
  }
  const zapatoDe = l => { const c = l.calzado; if (!c || !c.muestra) return null; const f = c._f; return { muestra: c.muestra, tipo: f.subtipo, color: f.color.toLowerCase(), tacon: f.tacon }; };
  // la propuesta tal y como la pinta la app: los ids de las prendas reales, el zapato de muestra si hace falta y cómo se lleva la de arriba
  function aPropuesta(l) {
    const ps = ['capa', 'arriba', 'base_interior', 'abajo', 'vestido', 'calzado', 'bolso', 'accesorio'].map(k => l[k]).filter(p => p && !p.muestra);
    return { ids: ps.map(p => p.id), ocasion: l.ctx.ocasion, formula: l.formula?.id, nombre: l.formula?.nombre, porque: l.formula?.porque, como: l.campos.como === 'por_dentro' ? 'por dentro' : l.campos.como, zspec: zapatoDe(l), faltaCapa: !!l.faltaCapa, nota: l.nota };
  }
  return { iniciar, inferir, ficha: p => ficha(p, {}), contexto, perfilMotor, looks, juzgar, aPropuesta, faltas, claveLook, get R() { return R; }, get F() { return F; } };
})();
if (typeof module !== 'undefined') module.exports = Motor;
else if (typeof MOTOR_DATOS !== 'undefined') Motor.iniciar(MOTOR_DATOS.R, MOTOR_DATOS.F, MOTOR_DATOS.S);
