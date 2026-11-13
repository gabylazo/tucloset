/* TuCloset · motor de looks (Dirección, 31/10/2026). Gabriela: «lo que no podemos permitir es que básicamente hagas looks al azar».
   Un look solo sale si encaja en una fórmula del oficio, se rellena con prendas reales de la usuaria y pasa los vetos; nunca se prueba «todo con todo».
   Especificación, fórmulas y reglas: equipo/moda/investigacion-2026-10/ (ESPEC-MOTOR.md, formulas-looks.json, reglas-looks.json; se copian a motor-datos.js con
   herramientas/motor-datos.py). Sin servidor y sin modelos. Todo entra por parámetro y las prendas no se tocan (la ficha va aparte), para poder probarlo en Node
   contra PRUEBA-CLOSET.md. No hay nada aleatorio: el desempate es una huella del día y del look, así que el mismo día salen las mismas ideas. */
const Motor = (() => {
  let R, F, S = {}, ZV = [], VETA_ZAPATO = new Set();
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // palabra que termina en $ = palabra completa; si no, prefijo de palabra
  const re = w => { const q = norm(w), entera = q.endsWith('$'), t = entera ? q.slice(0, -1) : q; return new RegExp('(^|[^a-z0-9])' + esc(t) + (entera ? '($|[^a-z0-9])' : '')); };
  // ropa de deporte (Gabriela, 06/11: «hay minifaldas que son de deporte»): por el nombre o por el detalle «Deporte» de la subida
  const TOP_ESP = /lencer|peplum|halter|cruzad|volant|babydoll|encaje|saten|seda|vuelo|asimetric|un hombro|abullon/;
  const DEPORTE_RE = /(^|[^a-z0-9])(deporte|deportiv|tenis|padel|running|yoga|pilates|gimnasio|gym|fitness|entreno|entrenamiento)/;
  const A_DEPORTE = { falda_mini: 'falda_deportiva', falda_midi: 'falda_deportiva', falda_plisada: 'falda_deportiva', falda_generica: 'falda_deportiva', camiseta: 'camiseta_tecnica', camiseta_tirantes: 'top_deportivo', top: 'top_deportivo', top_corto: 'top_deportivo', chaqueta: 'chaqueta_deportiva', pantalon_generico: 'jogger' };
  const SUB_EST = { pantalon_de_vestir: 'pantalon_vestir', camiseta_sin_mangas: 'camiseta_tirantes' }; // el vocabulario de la ficha de la estilista (28/10)
  const COLOR_FINO = ['Mostaza', 'Burdeos', 'Terracota', 'Camel', 'Crema', 'Caqui', 'Verde menta', 'Verde salvia', 'Verde oliva', 'Verde botella', 'Azul marino', 'Azul petróleo', 'Azul eléctrico', 'Turquesa', 'Fucsia', 'Coral', 'Chocolate', 'Antracita', 'Nude', 'Melocotón', 'Mantequilla']; // 11/11: más colores (sin Dorado ni Plateado: «bolso con cadena dorada» sigue siendo del color del bolso) // si el nombre lo dice, manda sobre el color general de la app («body mostaza» guardado como Amarillo)
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
    VETA_ZAPATO = new Set(R.vetos.lista.filter(v => v.duro && JSON.stringify(v.si).includes('calzado.')).map(v => v.id));
    ZV = ZAPS.map(([k, sub, color, tacon]) => {
      const s = R.inferencia.subtipos.find(x => x.id === sub), f = { ...R.inferencia.defecto_atributos, ...s.def, subtipo: sub, cat: 'calzado', conf: {}, tacon, tacon_num: TACON[tacon], estilos: [] };
      if (sub.startsWith('sandalias')) f.abierto = true;
      return { id: 'zm-' + k, muestra: k, _f: conColor(f, color) };
    });
  }
  const grupo = t => t[0] === '@' ? R.grupos[t] || [] : [t];
  // lo que se llama sin apellido («Pantalón negro», «Zapatos», «Chaqueta», «Top») entra donde entra su familia; si no, no saldría en casi ningún look
  const COMODIN = { pantalon_generico: ['pantalon_vestir', 'chino', 'pantalon_fluido'], zapato_cerrado: ['mocasines', 'bailarinas', 'zapato_cordones'], abrigo_generico: ['abrigo_lana', 'gabardina'], chaqueta: ['americana', 'cazadora_cuero', 'bomber', 'sobrecamisa'], top: ['blusa'] };
  const tiposDe = h => { if (h._t) return h._t; const t = [...new Set(h.tipos.flatMap(grupo))]; for (const k in COMODIN) if (!t.includes(k) && COMODIN[k].some(x => t.includes(x))) t.push(k); return h._t = t; };
  function conColor(f, color) {
    const K = R.color.colores[color] || R.color.colores.Estampado;
    return Object.assign(f, { color, color_clase: K.clase, valor: K.valor, calidez: K.calidez, familia: K.familia, valor_num: { claro: 1, medio: 2, oscuro: 3 }[K.valor] });
  }

  /* ---------- 1. la ficha de cada prenda: lo que dice su nombre, y lo que dieron la usuaria o la estilista manda ---------- */
  function inferir(p, perfil = {}) {
    const I = R.inferencia, nom = norm((p.nombre || '') + ' ' + (p.x || '')), est = p.est || {}, buscar = txt => txt && I.subtipos.find(s => s.tiposApp.includes(p.tipo) && s.re.some(r => r.test(txt)));
    // manda el nombre; lo reconocido en la foto (p.x, en inglés) solo afina si el nombre no dice el tipo: «Pantalón negro» + wide leg pants
    let sub = buscar(norm(p.nombre)); if (!sub || (COMODIN[sub.id] && !(sub.id === 'top' && TOP_ESP.test(norm(p.nombre))))) sub = buscar(norm(p.x)) || sub;
    // 06/11: un top de tirantes o una camiseta con volantes, encaje, satén… es un top arreglado, no una camiseta básica (no va a deporte ni cuenta como básico)
    if (sub && ['camiseta_tirantes', 'camiseta'].includes(sub.id) && TOP_ESP.test(norm((p.nombre || '') + ' ' + (p.detalles || []).join(' ')))) sub = I.subtipos.find(s => s.id === 'top') || sub;
    let conSub = !!sub;
    const dicho = est.sub && I.subtipos.find(s => s.id === (SUB_EST[est.sub] || est.sub));
    if (dicho && !(sub && (sub.id.startsWith(dicho.id) || (dicho.id === 'camiseta' && sub.id === 'henley')))) { sub = dicho; conSub = true; }
    if (!sub) sub = I.por_defecto_si_nada_coincide[p.tipo] || I.por_defecto_si_nada_coincide.Arriba;
    const det = (p.detalles || []).join(' '), dep = det.includes('Deporte') || DEPORTE_RE.test(norm(p.nombre || ''));
    if (dep && A_DEPORTE[sub.id]) sub = I.subtipos.find(s => s.id === A_DEPORTE[sub.id]) || sub;
    const f = { ...I.defecto_atributos, ...sub.def, subtipo: sub.id, cat: sub.cat, conf: { subtipo: conSub ? 'nombre' : 'defecto' } };
    const fijados = new Set(), nomM = det ? nom + ' ' + norm(det) : nom;
    for (const m of I.modificadores) {
      if (m.solo && !m.solo.includes(f.cat)) continue;
      if (!m.re.some(r => r.test(nomM)) || m.no.some(r => r.test(nomM))) continue;
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
    // 12/11: si el nombre no dice la manga, manda la que la IA vio en la foto (p.manga); antes salía la del tipo de prenda y un top de manga larga contaba como sin mangas
    if (p.manga && f.conf.manga !== 'nombre' && ['arriba', 'capa', 'vestido'].includes(f.cat) && ['larga', 'corta', 'sin_mangas'].includes(p.manga)) { f.manga = p.manga; f.conf.manga = 'foto'; }
    if (dep && ['arriba', 'abajo', 'capa', 'vestido'].includes(f.cat)) { f.deportiva = true; f.uso = 'deporte'; f.form = Math.min(f.form, 1); }
    // 06/11 (Moda, revisión del clóset real): las zapatillas de deporte son deportivas (solo ellas van a Deporte) pero también valen para el día a día, sin «uso: deporte»
    if (dep && f.cat === 'calzado') { f.deportiva = true; f.form = Math.min(f.form, 1); }
    // lo que hace protagonista a una pieza aunque su color sea neutro (cuenta una vez por pieza en n_focos)
    f.foco = /encaje|transparen|lentejuel|abullon|peplum|asimetric|un hombro|volant/.test(nomM);
    // 07/11 (Gabriela: «un jersey que es por los hombros abiertos con una camisa abajo, no tiene sentido»): escotes que no admiten nada debajo
    f.hombros = /hombros? al aire|hombros? descubierto|hombros? abierto|off.?shoulder|bardot|palabra de honor|sin tirantes|un hombro|asimetric|halter|espalda al aire|espalda abierta|escote barco caido|cut.?out|recortes/.test(nomM) ? 'al_aire' : undefined;
    // color: el de la app; si es «Estampado» o vacío, el del nombre; vaquero = neutro siempre
    let col = p.color && p.color !== 'Estampado' ? p.color : null;
    if (!col) for (const [c, rs] of Object.entries(I.color.palabras_en_el_nombre)) if (rs.some(r => r.test(nom))) { col = c; break; }
    for (const c of COLOR_FINO) if (I.color.palabras_en_el_nombre[c]?.some(r => r.test(nom))) { col = c; break; }
    conColor(f, col || 'Estampado');
    if (f.color === 'Estampado' && f.estampado === 'liso') f.estampado = 'otro';
    // 13/11 (Moda, equipo/moda/estudio/salidas/ciencia-looks-2026-11-13.md): un vestido corto de manga larga abriga más que uno de tirantes; el motor los trataba
    // igual (mínimo 18 °C) y los de entretiempo no salían nunca en noviembre. Ahora: 4 °C menos de mínimo y +0,08 de clo (estimación de Moda, a calibrar)
    if (f.subtipo === 'vestido_corto' && f.manga === 'larga') { f.tmin -= 4; f.clo += .08; }
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
    const sig = [p.nombre, p.tipo, p.color, p.estacion, p.x, JSON.stringify(p.est || 0), (p.detalles || []).join(), p.manga || '', perfil.usoSolo?.has?.(p.id) ? 1 : 0].join('|'), c = CACHE.get(p);
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
  // 06/11: lo que la IA leyó de los looks que le encantan (Yo → Mi estilo): estilos con su peso, colores y formalidad media
  function inspoDe(l) {
    if (!Array.isArray(l) || !l.length) return null;
    const estilos = {}, colores = new Set(), fs = [];
    for (const x of l) { (x.estilos || []).forEach((e, i) => { estilos[e] = (estilos[e] || 0) + (i ? .5 : 1); }); (x.colores || []).forEach(c => colores.add(c)); if (x.formalidad) fs.push(x.formalidad); }
    return { estilos, colores, form: fs.length ? fs.reduce((s, x) => s + x, 0) / fs.length : null };
  }
  // 11/11 (Sheila: «un mecanismo con al menos unos 10 primeros outfits sugeridos por ti de me lo pondría o no me lo pondría con la ropa de la usuaria
  // para que detecte si le gusta lo que le propones»): cada respuesta suma o resta a los dos estilos de su fórmula y a la fórmula misma (reglas U14–U17)
  function calibDe(c) {
    if (!c?.r?.length) return null; const est = {}, f = {};
    for (const x of c.r) { const s = x.si ? 1 : -1; (x.e || []).forEach((e, i) => { est[e] = (est[e] || 0) + s * (i ? .5 : 1); }); if (x.f) f[x.f] = (f[x.f] || 0) + s; }
    return { est, f };
  }
  function perfilMotor(pf = {}, opc = {}) {
    pf = pf || {}; // 12/11: sin perfil todavía (null), como antes de terminar el alta
    const usoSolo = new Set(pf.usoSolo || []); // el chaleco que los looks a mano llevan sin nada encima lo lleva solo
    for (const l of pf.estilista?.looks || []) if (l.arriba && !l.capa) usoSolo.add(l.arriba);
    const dc = pf.diag?.color, ec = dc?.si ? dc : opc.colorEstacion, cint = pf.cintura === '1' || pf.cintura === 'si' ? 'si' : pf.cintura === '0' || pf.cintura === 'no' ? 'no' : undefined;
    const reglas = opc.pro ? (pf.diag?.cuerpo?.puntos || S[pf.tipoCuerpo] || null) : null;
    return { estilos: pf.estilos || [], publico: pf.publico || (pf.ropa === 'hombre' ? 'masculino' : 'todo') /* 03/11: «¿Qué ropa llevas?» */, cintura: cint, tacon: pf.tacon, tacon_num: TACON[pf.tacon], evitarColores: pf.evitarColores || [], usoSolo, gustos: pf.gustos || {}, uso: pf.usoRopa || null, silueta: pf.tipoCuerpo || pf.diag?.cuerpo?.k || null, inspo: inspoDe([...(pf.inspo || []), ...(pf.propios || [])]) /* 12/11: también los looks que ella sube con foto */, calib: calibDe(pf.calib), diag: { estacion: ec ? { si: ec.si, no: ec.no } : undefined, puntos: reglas } };
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
      clo_total: clo, clo_fuera: fuera, clo_en_rango: fuera === 0, capa_manga_larga: !!(C && C.manga !== 'sin_mangas'), capa_cubre_hombros: !!(C && !String(C.subtipo).startsWith('chaleco')), tiene_abrigo: C?.rol === 'abrigo', capa_quitable: !!(C && C.rol !== 'abrigo'),
      n_capas: [l.capa, l.base_interior && l.base_interior._f.rol === 'capa_ligera'].filter(Boolean).length, capa_sin_base: !l.vestido && l.arriba?._f.rol === 'capa_ligera' && !l.base_interior, n_bases_arriba: bases,
      n_deportivas: ropa.filter(f => f.deportiva).length + (l.calzado?._f.deportiva ? 1 : 0), tonal: !!(A && B && A.familia === B.familia), contraste_valor: !!(A && B && ((A.valor === 'claro' && B.valor === 'oscuro') || (A.valor === 'oscuro' && B.valor === 'claro'))),
      cintura_al_aire: !!(A && B && l.como !== 'por_dentro' && ((A.largo === 'crop' && A.subtipo !== 'body' && (B.tiro === 'bajo' || (B.tiro === 'medio' && pf.cintura === 'no') || (B.tiro === 'medio' && pf.cintura == null))) || (A.largo === 'cintura' && B.tiro === 'bajo'))),
      cintura_marcada: !!(A && B && B.tiro === 'alto' && (['crop', 'cintura'].includes(A.largo) || l.como === 'por_dentro')),
      como: l.como || 'suelta', n_abajos, dos_denim_distintos: denim.length >= 2 && new Set(denim.map(f => f.color)).size > 1, usa_color_vetado: ropa.some(f => pf.evitarColores.includes(f.color)),
      pareja_rechazada_3: no.some(k => g.no[k] >= 3), parejas_gustadas: si, parejas_rechazadas: no.length, es_favorito: (g.fav || []).includes(ids2),
      n_focos: ropa.filter(f => ['acento', 'vivo', 'suave'].includes(f.color_clase) || !['liso', 'rayas_finas'].includes(f.estampado) || ['brillo', 'cuero', 'volantes'].includes(f.tejido) || f.foco).length,
      texturas_distintas: texturas.size, estilos_en_comun: Object.values(cuenta).filter(n => n >= 2).length, estilos_perfil_coinciden: pf.estilos.filter(e => estilos.has(e)).length, estilo_contrario: contrario,
      puntos_diag: Math.max(-.4, Math.min(.4, diag)), dias_desde_ultimo_uso: dias, usos_medios: usos, prenda_nueva_14d: ropaP.some(p => p.p?.creada && diasDesde(p.p.creada, hoy) <= 14),
      hay_estampado_fuerte: ropa.some(f => !['liso', 'rayas_finas'].includes(f.estampado)), acento_fuera_del_estampado: acentos.length > 0 && ropa.some(f => !['liso', 'rayas_finas'].includes(f.estampado)),
      mezcla_negro_marron: colores.includes('Negro') && colores.includes('Marrón'), negro_total: colores.length === 1 && colores[0] === 'Negro', blanco_total: colores.every(c => ['Blanco', 'Crema'].includes(c)),
      hombros_descubiertos: !C && ropa.some(f => ['sin_mangas', 'tirantes'].includes(f.manga)), rodillas_descubiertas: ropa.some(f => ['falda_mini', 'vestido_corto', 'shorts'].includes(f.subtipo)),
      hay_accesorio_util: !!l.accesorio, accesorio_frio: ['bufanda', 'gorro', 'guantes'].includes(l.accesorio?._f.subtipo), valor_dominante: dom(valores, .51), familia_dominante: dom(familias, .5),
      prendas_fuera_de_rango: ps.filter(p => (p._f.tmin != null && ctx.t_ref < p._f.tmin - 3) || (p._f.tmax != null && ctx.t_ref > p._f.tmax + 3)).length,
      arriba_fuera_grados: A?.tmax != null ? Math.max(0, ctx.t_ref - A.tmax) : 0, abajo_fuera_grados: B?.tmax != null ? Math.max(0, ctx.t_ref - B.tmax) : 0,
      n_neutros_pct: ropa.filter(f => ['neutro', 'neutro_suave'].includes(f.color_clase)).length / (ropa.length || 1),
      inspo_estilos: pf.inspo ? (l.formula?.estilos || []).slice(0, 2).filter(e => pf.inspo.estilos[e]).length : 0, inspo_colores_pct: pf.inspo ? colores.filter(c => pf.inspo.colores.has(c)).length / (colores.length || 1) : 0,
      inspo_form_dif: pf.inspo?.form != null ? Math.abs(media - pf.inspo.form) : 0,
      calib_estilos: pf.calib ? (l.formula?.estilos || []).slice(0, 2).reduce((s, e, i) => s + Math.max(-2, Math.min(2, pf.calib.est[e] || 0)) * (i ? .5 : 1), 0) : 0,
      calib_formula: pf.calib && l.formula?.id ? Math.max(-2, Math.min(2, pf.calib.f[l.formula.id] || 0)) : 0, ids };
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
    if ((T.prohibir || []).includes(z.subtipo)) s -= 2; const iPref = (T.preferir || []).indexOf(z.subtipo); if (iPref >= 0) s += iPref ? .4 : .65;
    s -= Math.abs((z.form ?? 3) - media) * .15;
    if (pf.tacon_num != null && z.tacon_num > pf.tacon_num) s -= .6;
    if (B?.corte === 'acampanado') s += z.tacon === 'plano' ? -1 : .5;
    if (z.color === 'Negro' && ['Negro', 'Gris', 'Azul', 'Antracita', 'Azul marino'].some(x => cols.has(x))) s += .4;
    const V = B || l.vestido?._f; if (V && z.color === V.color) s += .1; if (Math.abs((z.form ?? 3) - media) <= 1) s += .1; // tono sobre tono y mismo registro (Moda, 06/11)
    if (z.color === 'Blanco') { if ((denim || cols.has('Gris') || cols.has('Blanco')) && media < 3) s += .45; if (media >= 3) s -= .3; if (ctx.lluvia) s -= .3; }
    if (['Marrón', 'Camel', 'Chocolate'].includes(z.color)) { if (fam.has('tierra') || denim || cols.has('Azul') || cols.has('Azul marino')) s += .4; if (cols.has('Negro')) s -= .3; }
    if (['Beige', 'Nude'].includes(z.color) && fam.has('tierra')) s += .2;
    if (ctx.t_ref >= 26 && z.abierto) s += .2;
    for (const [k, v] of Object.entries(h?.pref || {})) if (v.includes(z[k])) s += .1;
    return s - (c.p?.usos?.length || 0) * .002;
  }
  const cloMedia = ctx => (ctx.clo_min + ctx.clo_max) / 2;
  const cloPiezas = l => .2 + PIEZAS.map(k => l[k]).filter(Boolean).reduce((s, p) => s + (p._f.clo || 0), 0);
  const cercania = (c, l, ctx) => -Math.abs(cloMedia(ctx) - (cloPiezas(l) + (c._f.clo || 0))) + (ctx.lluvia && c._f.impermeable ? .3 : 0) - (c.p?.usos?.length || 0) * .002;
  // 06/11 (bolsos y cinturones sin ideas): el bolso y el cinturón solo salían si la fórmula los pedía (el clutch de noche); los bolsos de diario y los cinturones
  // no entraban nunca y su ficha no tenía ideas. Ahora, en todo look con calzado (salvo Deporte): el bolso del plan (de día o de noche, R.grupos), con el calzado o neutro
  // y de la formalidad del look; y un cinturón solo donde se ve y suma: pantalón o falda de tiro alto con la prenda por dentro o corta, a juego con el calzado o el bolso
  const NO_CINTURON = new Set(['jogger', 'malla', 'falda_deportiva', 'shorts']);
  let MAXPAR = 12; // 08/11: parejas que se convierten en looks por fórmula; «¿Me lo compro?» mira más (o.parejas) para saber con cuántas prendas combina
  let COMPL = false; // con o.complementos: las ideas de la ficha de un bolso o un cinturón y, desde el 11/11 (Gabriela lo pidió), Hoy, Ideas, el calendario y la semana
  /* 11/11 (Gabriela: «no quiero que lo que te dije que no pone se agregue ahora a la fuerza, sino que tengan sentido los outfits… teniendo en cuenta todos
     los elementos que tienes a tu alcance»). Un complemento entra solo si le aporta algo al look; si ninguno casa, el look va sin él. Se mira todo: la ocasión,
     lo arreglado que es el look, el estilo de su fórmula, los colores de todas las prendas y del zapato, los estampados y lo que ya protagoniza.
     · Color: igual que el zapato (lo clásico) o que otra prenda; neutro si el look tiene neutros; un color que no está en el look solo como único toque de color
       en un look neutro. Nunca dos estampados ni dos toques de color sueltos.
     · Bolso: el de la ocasión (de noche, cartera o de mano), de su mismo nivel de arreglo, y solo si casa.
     · Cinturón: donde se ve y marca la cintura (por dentro, corto, tiro alto o un vestido sin cintura propia) y del color del zapato o del bolso.
     · Bandana o pañuelo: si el estilo del look lo pide (bandana: boho, casual, retro, rock, urbano; pañuelo de seda también francés, clásico, old money).
     · Joyas: de noche, en un evento y en la oficina; de día, con estilos que las llevan; el collar, nunca si el look ya tiene protagonista.
     · Como mucho dos además del bolso. */
  function complemento(tipo, l, ents, ctx) {
    if (ctx.ocasion === 'Deporte' || !l.calzado) return null;
    if (tipo === 'cinturon' && l.silueta === 'ovalo') return null; // 12/11 (estudio de Moda, «Elevar look»): con silueta óvalo el diagnóstico dice «evitar: ceñido en el centro»
    const z = l.calzado._f, ropa = ['arriba', 'base_interior', 'abajo', 'vestido', 'capa'].map(k => l[k]).filter(Boolean).map(p => p._f);
    const media = ropa.reduce((s, f) => s + (f.form ?? 3), 0) / (ropa.length || 1), clave = claveRopa(l) + (l.calzado.id || '');
    const est = (l.estilos || []).slice(0, 2), neutro = f => String(f.color_clase).startsWith('neutro'), todoNeutro = ropa.every(neutro);
    const ya = ['bolso', 'accesorio', 'accesorio2', 'joya'].map(k => l[k]).filter(Boolean).map(p => p._f);
    const nAcc = ['accesorio', 'accesorio2', 'joya'].filter(k => l[k]).length;
    if (tipo !== 'bolso' && nAcc >= 2) return null;
    const armonia = f => {
      if (f.estampado && f.estampado !== 'liso' && [...ropa, ...ya].some(x => x.estampado && x.estampado !== 'liso')) return -1; // dos estampados
      if (f.familia && f.familia === z.familia) return .4;
      if (f.familia && [...ropa, ...ya].some(x => x.familia === f.familia)) return .3;
      if (neutro(f) || /dorad|platead/i.test(f.color || '')) return ropa.some(neutro) || neutro(z) ? .15 : .05;
      return todoNeutro && !ya.some(x => !neutro(x)) ? .1 : -1; // un único toque de color en un look neutro
    };
    const nivel = f => Math.abs((f.form ?? 3) - media);
    const elegir = (cs, extra = () => 0, min = .1) => cs.map(p => [armonia(p._f) - nivel(p._f) * .15 + extra(p) + huella(clave + p.id) * .12, p])
      .filter(x => x[0] >= min && nivel(x[1]._f) <= 1.2).sort((a, b) => b[0] - a[0])[0]?.[1] || null;
    if (tipo === 'bolso') {
      const ok = grupo(['Noche', 'Evento'].includes(ctx.ocasion) ? '@bolso_noche' : '@bolso_dia');
      return elegir(ents.filter(p => p._f.cat === 'bolso' && ok.includes(p._f.subtipo) && !(p._f.subtipo === 'mochila' && (media >= 3 || ctx.ocasion === 'Oficina'))));
    }
    if (tipo === 'panuelo') {
      if (ctx.ocasion === 'Evento' || media >= 4 || ropa.some(f => f.foco)) return null;
      return elegir(ents.filter(p => {
        if (p._f.subtipo !== 'panuelo') return false;
        const bandana = /bandana/i.test(p.nombre || ''), van = bandana ? ['boho', 'casual', 'retro', 'rock', 'urbano'] : ['boho', 'casual', 'retro', 'frances', 'clasico', 'oldmoney', 'romantico'];
        return est.some(e => van.includes(e)) && !(bandana && ['Oficina', 'Noche'].includes(ctx.ocasion));
      }), () => 0, .15);
    }
    if (tipo === 'joyas') {
      const arreglado = ['Noche', 'Evento', 'Oficina'].includes(ctx.ocasion), van = ['glam', 'romantico', 'frances', 'oldmoney', 'clasico', 'boho', 'minimalista'];
      if (!arreglado && !est.some(e => van.includes(e))) return null;
      const foco = ropa.some(f => f.foco), cuello = /cuello alto|cisne|halter|volante|lazo|cuello barco/i;
      return elegir(ents.filter(p => p._f.subtipo === 'joyas' && !(/collar|gargantilla/i.test(p.nombre || '') && (foco || [l.arriba, l.vestido].some(q => q && cuello.test(q.nombre || ''))))),
        p => /pendiente|arete/i.test(p.nombre || '') ? .05 : 0);
    }
    // cinturón
    const A = l.arriba?._f, B = l.abajo?._f, V = l.vestido?._f;
    if (l.capa?._f.largo === 'largo' || (l.capa && grupo('@abrigo_frio').includes(l.capa._f.subtipo)) || est.includes('deportivo')) return null;
    if (V && !A && !B) { if (NO_CINTURON.has(V.subtipo) || /cruzad|envolvente|lazo|fajin|cintur|fruncid|drapead|tubo|ajustad|ceñid|lencer|tirante|camiseta/i.test(l.vestido.nombre || '')) return null; }
    else {
      if (!A || !B || B.uso === 'deporte' || NO_CINTURON.has(B.subtipo) || B.tiro === 'bajo') return null;
      if (!(l.como === 'por_dentro' || A.largo === 'crop' || (B.tiro === 'alto' && A.largo === 'cintura'))) return null;
      if (/jersey|sudadera|cardigan|chaleco|forro|polo/.test(A.subtipo) && A.largo !== 'crop') return null;
    }
    const conZapatoOBolso = p => p._f.familia && (p._f.familia === z.familia || p._f.familia === l.bolso?._f.familia); // la piel, a juego con el zapato o el bolso
    return elegir(ents.filter(p => p._f.subtipo === 'cinturon' && conZapatoOBolso(p)), () => 0, .25);
  }
  // la capa que pide el tramo de temperatura aunque la fórmula no la escriba
  function capaPorClima(l, ents, ctx) {
    const id = ctx.tramo.id, grupos = id === 'T4' ? ['@capa_ligera', '@capa_media'] : id === 'T5' ? ['@capa_media', '@abrigo_frio'] : id === 'T6' || id === 'T7' ? ['@abrigo_frio'] : id === 'T3' ? ['@capa_ligera'] : id === 'T2' && (ctx.t_min < 16 || ctx.amplitud >= 10) ? ['@capa_ligera'] : null;
    if (!grupos || l.capa) return [];
    const t = grupos.flatMap(g => R.grupos[g]), cs = ents.filter(p => t.includes(p._f.subtipo) && !PIEZAS.some(k => l[k] === p)).sort((a, b) => cercania(b, l, ctx) - cercania(a, l, ctx)).slice(0, 2);
    return cs.map(c => ({ ...l, capa: c }));
  }
  // 06/11 (Gabriela: «¿cómo va a combinar una camiseta con un short de deporte y las alpargatas?»): la ropa de deporte (detalle «Deporte» o nombre) solo va en fórmulas de deporte
  const soloDeporte = f => f.uso === 'deporte' && ['arriba', 'abajo', 'vestido', 'capa'].includes(f.cat);
  // 06/11 (Gabriela: «¿cómo vas a combinar un short de deporte con un top de verano rosa de volantes?»): al revés también; un look de deporte solo lleva ropa de deporte
  // o básicos lisos de algodón (camiseta, sudadera); nada con volantes, encaje, brillo, transparencias… Abajo, siempre ropa de deporte; la capa, deportiva o de abrigo técnico.
  const ARREGLADO_RE = /volant|encaje|lencer|sat[eé]n|seda|lentejuel|transparen|terciopelo|brillo|peplum|halter|palabra de honor|asim[eé]tric|ganchillo|crochet|cors[eé]|fruncid|drapead|lazo|lunares|flores|cuadros|rayas|abullon|vuelo/;
  const aptoDeporte = p => { const f = p._f; if (f.uso === 'deporte') return true; const n = norm((p.p.nombre || '') + ' ' + (p.p.detalles || []).join(' ') + ' ' + (p.p.notas || ''));
    if (f.cat === 'abajo') return ['jogger', 'malla', 'falda_deportiva'].includes(f.subtipo);
    if (f.cat === 'capa') return ['chaqueta_deportiva', 'forro_polar', 'sudadera', 'plumifero', 'cortavientos'].includes(f.subtipo);
    if (f.cat === 'arriba') return ['camiseta_tecnica', 'top_deportivo', 'sudadera'].includes(f.subtipo) || (['camiseta', 'camiseta_tirantes', 'henley'].includes(f.subtipo) && !ARREGLADO_RE.test(n) && f.form <= 3 && f.largo !== 'crop');
    return f.cat === 'calzado' ? !!f.deportiva : f.cat !== 'vestido'; };
  // 06/11 (Gabriela: «las combinaciones de Inspírate en… son siempre las mismas»): las parejas se elegían sin mirar el estilo pedido y todas las referencias recibían
  // las mismas prendas. Afinidad de cada prenda con un estilo, por sus rasgos (de -1 a 1); «Inspírate en» la pasa como o.afin y pesa en parejas, capa, calzado y nota.
  const rasgo = (f, txt, tok) => { const [k, v] = tok.split(':'), en = x => v.split('|').includes(x);
    switch (k) {
      case 'sub': return en(f.subtipo); case 'tejido': return en(f.tejido); case 'corte': return en(f.corte); case 'tiro': return en(f.tiro); case 'txt': return new RegExp(v).test(txt);
      case 'neutro': return String(f.color_clase).startsWith('neutro'); case 'vivo': return ['vivo', 'acento'].includes(f.color_clase); case 'suave': return f.color_clase === 'suave' || f.familia === 'rosa';
      case 'liso': return f.estampado === 'liso'; case 'estampado': return f.estampado !== 'liso'; case 'rayas': return /rayas/.test(f.estampado || ''); case 'flores': case 'lunares': case 'cuadros': return f.estampado === k;
      case 'vaquero': case 'cuero': case 'sastre': return f.tejido === k; case 'formal': return f.form >= 4; case 'informal': return f.form <= 2;
      case 'deportiva': return !!f.deportiva || f.uso === 'deporte'; case 'brillo': return /saten|raso|lentejuel|brillo|metaliz|terciopelo|charol|seda/.test(txt);
      case 'encaje': return /encaje/.test(txt); case 'volantes': return /volant/.test(txt); case 'romantico': return /volant|encaje/.test(txt) || f.estampado === 'flores';
      case 'foco': return !!f.foco; case 'volumen': return (f.volumen ?? 0) >= 2 || ['ancho', 'barril', 'oversize'].includes(f.corte); case 'crop': return f.largo === 'crop';
      default: return f.familia === k; // negro, tierra, blanco, gris, rojo, azul, verde, rosa
    } };
  const ESTILO_RASGOS = {
    minimalista: [['neutro', .4], ['liso', .2], ['estampado', -.5], ['foco', -.4], ['vivo', -.3]],
    clasico: [['sastre', .4], ['formal', .3], ['sub:camisa|americana|pantalon_vestir|mocasin|trench|abrigo_lana|jersey_cuello_alto|chaleco_traje|blusa', .3], ['neutro', .2], ['deportiva', -.5], ['crop', -.3]],
    frances: [['rayas', .5], ['vaquero', .3], ['sub:camisa|jersey|trench|bailarina|mocasin|americana|vestido_midi', .3], ['txt:negro|blanco|marino|crema', .2], ['vivo', -.3], ['deportiva', -.4]],
    casual: [['vaquero', .5], ['tejido:algodon|punto', .2], ['informal', .3], ['sub:camiseta|sudadera|zapatillas|henley', .3], ['formal', -.4], ['brillo', -.3]],
    urbano: [['vaquero', .3], ['cuero', .4], ['sub:zapatillas|sudadera|botas|botines', .4], ['volumen', .3], ['negro', .2], ['romantico', -.3]],
    glam: [['brillo', .6], ['encaje', .3], ['formal', .4], ['sub:sandalias_tacon|tacones|clutch|vestido_largo', .3], ['negro', .2], ['deportiva', -.6], ['vaquero', -.2], ['informal', -.2]],
    boho: [['flores', .5], ['tejido:fluido|ante', .3], ['volantes', .3], ['tierra', .3], ['sub:vestido_largo|falda_larga|alpargatas|sandalias_planas', .4], ['sastre', -.3], ['deportiva', -.4]],
    romantico: [['volantes', .5], ['encaje', .4], ['flores', .3], ['lunares', .3], ['suave', .3], ['sub:blusa|vestido_midi|falda_larga|vestido_corto', .2], ['cuero', -.3], ['deportiva', -.5]],
    rock: [['cuero', .6], ['negro', .3], ['vaquero', .2], ['sub:botas|botines', .3], ['suave', -.3], ['volantes', -.3]],
    oldmoney: [['txt:crema|beige|camel|marino|blanco|marfil|gris', .4], ['tejido:punto|lana|sastre', .3], ['formal', .2], ['sub:camisa|mocasin|jersey|americana|pantalon_vestir|abrigo_lana|trench', .2], ['vivo', -.4], ['deportiva', -.6], ['estampado', -.2], ['crop', -.3]],
    retro: [['lunares', .5], ['cuadros', .4], ['corte:acampanado', .5], ['vivo', .2], ['tiro:alto', .2], ['deportiva', -.3]],
    eclectico: [['estampado', .3], ['vivo', .4], ['foco', .3], ['volumen', .2], ['neutro', -.1]],
    deportivo: [['deportiva', .6], ['sub:sudadera|camiseta|zapatillas|top_deportivo|malla', .3], ['informal', .2], ['formal', -.3], ['brillo', -.3]],
  };
  const sumaRasgos = (f, txt, reglas) => reglas.reduce((s, [tok, n]) => s + (rasgo(f, txt, tok) ? n : 0), 0), tope1 = x => Math.max(-1, Math.min(1, x));
  const afinEstilo = (f, txt, estilos) => estilos.length ? estilos.reduce((s, e) => s + tope1(sumaRasgos(f, txt, ESTILO_RASGOS[e] || []) + ((f.estilos || []).includes(e) ? .5 : 0)), 0) / estilos.length : 0;
  const txtAfin = p => norm([p.nombre, p.color, ...(p.detalles || []), p.notas].join(' '));
  const afin = x => x?._af || 0, AF = { par: .15, capa: .3, zapato: .2, nota: .15 };
  // 06/11 (Gabriela: «siguen habiendo combinaciones espantosas»): la temperatura de cada prenda era solo un descuento de puntos (K15) y salían tops de verano bajo un abrigo
  // de paño o sandalias a 12°. Ahora es fija: lo que está a más de 3° de su rango (el de su estación, o el de su tipo) no entra en el look de hoy.
  // 06/11 (banco de looks de Moda): a primera hora la referencia mira la mínima y una cazadora o un jersey de entretiempo pasaban en un día de 25° (looks 34, 49, 88,
  // 107, 110, 150, 191 y 195, notas 1 y 2); ahora tampoco vale si la máxima del día pasa en más de 6° la de su estación (7° si es una capa, que se quita al mediodía)
  const vaHoy = (p, ctx) => { const f = p._f; return !((f.tmin != null && ctx.t_ref < f.tmin - 3) || (f.tmax != null && (ctx.t_ref > f.tmax + 3 || (ctx.t_max ?? ctx.t_ref) > f.tmax + (f.cat === 'capa' ? 7 : 6)))); };
  function rellenar(formula, ents, zapatos, ctx, pf, hoy, cacheP) {
    const dep = formula.ocasiones.includes('Deporte');
    ents = ents.filter(p => vaHoy(p, ctx) && (dep ? aptoDeporte(p) : !soloDeporte(p._f)));
    const zHoy = zapatos.filter(p => p.muestra || vaHoy(p, ctx)); if (zHoy.length) zapatos = zHoy;
    if (dep) zapatos = zapatos.filter(p => p.muestra || aptoDeporte(p)); // en Deporte, solo zapatillas de deporte (unas de ante no)
    const H = r => formula.huecos.filter(h => h.rol === r), salida = [], parejas = [];
    const [hv] = H('vestido');
    if (hv) for (const v of cands(hv, ents)) parejas.push({ vestido: v, n: AF.par * 2 * afin(v) });
    else {
      const ha = H('arriba')[0], hb = H('abajo')[0]; if (!ha || !hb) return salida;
      for (const a of cands(ha, ents)) for (const b of cands(hb, ents)) {
        if (a === b) continue;
        const k = a.id + '|' + b.id; let par = cacheP.get(k);
        if (!par) { const l = { arriba: a, abajo: b }; l.como = comoDe(null, l); const c = camposLook(l, ctx, pf, hoy), e = entorno(l, c, ctx, pf); par = { v: vetar(e, true).duros.length > 0, n: puntuar(l, c, e).total }; cacheP.set(k, par); }
        if (!par.v) parejas.push({ arriba: a, abajo: b, n: par.n + AF.par * (afin(a) + afin(b)) });
      }
    }
    parejas.sort((x, y) => y.n - x.n);
    for (const par0 of parejas.slice(0, MAXPAR)) {
      const par = { ...par0, formula }; delete par.n; par.como = comoDe(formula, par);
      let looks = [par], faltaHueco = null;
      for (const r of ['capa', 'base_interior']) {
        const [hc] = H(r); if (!hc) continue;
        // lo de debajo: una camisa que asoma, o una prenda neutra si de verdad hace frío (una camiseta roja bajo un jersey de rayas no aporta nada)
        // y lo de encima tiene que admitirlo: con mangas, sin hombros al aire y que sea de punto, sudadera o chaleco (07/11, Gabriela: el jersey de hombros abiertos con una camisa debajo «no tiene sentido»)
        const fA = par.arriba?._f, encima = !fA || (!fA.hombros && (String(fA.subtipo).startsWith('chaleco') || !['sin_mangas', 'tirantes'].includes(fA.manga)) && (R.grupos['@punto'].includes(fA.subtipo) || ['cardigan', 'sudadera', 'chaleco_punto', 'chaleco_traje'].includes(fA.subtipo)));
        const debajo = p => r !== 'base_interior' || (encima && p._f.largo !== 'crop' && (p._f.subtipo === 'camisa' || (['T5', 'T6', 'T7'].includes(ctx.tramo.id) && ['neutro', 'neutro_suave'].includes(p._f.color_clase))));
        const cs = cands(hc, ents).filter(p => !PIEZAS.some(k => par[k] === p) && debajo(p)).sort((a, b) => cercania(b, par, ctx) + AF.capa * afin(b) - cercania(a, par, ctx) - AF.capa * afin(a)).slice(0, 2);
        if (!cs.length && !hc.opcional) { faltaHueco = { rol: r, h: hc }; continue; }
        looks = looks.flatMap(l => cs.map(c => ({ ...l, [r]: c })).concat(hc.opcional ? [l] : []));
      }
      looks = looks.flatMap(l => { const con = capaPorClima(l, ents, ctx); if (!con.length && !l.capa && String(ctx.tramo.capa).startsWith('obligatoria')) return [{ ...l, capa_faltante: true }]; return con.concat(con.length && String(ctx.tramo.capa).startsWith('obligatoria') ? [] : [l]); });
      for (const l of looks) {
        const [hz] = H('calzado'); let cs = hz ? cands(hz, zapatos) : [];
        if (!cs.length && zapatos.length && !zapatos[0].muestra) cs = zapatos; // con zapatos subidos, siempre uno suyo
        const aguanta = cs.filter(c => pf.tacon_num == null || c._f.tacon_num <= pf.tacon_num); if (aguanta.length) cs = aguanta; // el tacón que ella dijo, si hay con qué
        cs = cs.map(c => [puntosCalzado(c, l, ctx, pf, hz) + AF.zapato * afin(c), c]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
        const sirven = []; for (const c of cs) { if (sirven.length >= 3) break; const lz = { ...l, calzado: c }; if (!vetar(entorno(lz, camposLook(lz, ctx, pf, hoy), ctx, pf)).duros.some(v => VETA_ZAPATO.has(v.id))) sirven.push(c); } // los tres mejores que el par admite
        cs = sirven.length ? sirven : cs.slice(0, 1);
        for (const c of cs.length ? cs : [null]) {
          const l2 = { ...l }; if (c) l2.calzado = c; if (faltaHueco) l2.hueco_faltante = faltaHueco;
          const [hb] = H('bolso'); if (hb && c) { const b = cands(hb, ents)[0]; if (b) l2.bolso = b; }
          const le = () => ({ ...l2, estilos: formula.estilos || [] });
          if (COMPL && c && !l2.bolso) { const b = complemento('bolso', le(), ents, ctx); if (b) l2.bolso = b; }
          if (COMPL && c && !l2.accesorio) { const a = complemento('cinturon', { ...le(), como: comoDe(formula, l2), silueta: pf.silueta }, ents, ctx); if (a) l2.accesorio = a; }
          if (COMPL && c) { const pa = complemento('panuelo', le(), ents, ctx); if (pa) l2[l2.accesorio ? 'accesorio2' : 'accesorio'] = pa; const j = complemento('joyas', le(), ents, ctx); if (j) l2.joya = j; }
          salida.push(l2);
        }
      }
    }
    return salida;
  }
  const claveRopa = l => ['arriba', 'base_interior', 'abajo', 'vestido', 'capa'].map(k => l[k]?.id).filter(Boolean).sort().join();
  const huella = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return (h % 1000) / 1000; };
  /* 12/11 (Sheila, mensaje 2086: «cómo la usuaria quiere interactuar con su clóset… no repetir prenda… intentar usar toda la ropa nueva… da igual… priorizar repetir
     hasta que estén sucias para no acumular muchas cosas puestas una vez… hazlo una opción y en función de eso creas looks»): Mi estilo → Cómo usas tu ropa (pf.uso).
     Sin elegir, lo de siempre (el grupo «variedad»: lo puesto hace poco baja, lo poco estrenado sube). Variar lo aprieta; estrenar sube lo que nunca te has puesto;
     repetir quita esa variedad y sube lo que llevas esta semana (lo sucio no sale: «Sucia» lo quita del clóset); me da igual quita la variedad y deja solo el estilo */
  const USO_P = .15, ROPA_K = ['arriba', 'base_interior', 'abajo', 'vestido', 'capa'];
  function ajusteUso(l, pts, pf, hoy) {
    const m = pf.uso; if (!['variar', 'estrenar', 'repetir', 'igual'].includes(m)) return { p: 0, ayer: true };
    const variedad = (R.puntos.grupos.variedad || 0) * Math.max(-1, Math.min(1, pts.suma.variedad || 0));
    const ropa = ROPA_K.map(k => l[k]).filter(x => x?.p && !x.muestra), media = f => ropa.length ? ropa.reduce((s, x) => s + f(x.p), 0) / ropa.length : 0;
    const dias = p => { let d = null; for (const u of p.usos || []) { const k = diasDesde(u, hoy); if (k >= 0 && (d == null || k < d)) d = k; } return d; };
    if (m === 'igual') return { p: -variedad, ayer: false };
    if (m === 'repetir') return { p: -variedad + USO_P * media(p => { const d = dias(p); return d == null ? -.3 : d <= 7 ? 1 : d <= 14 ? .4 : -.1; }), ayer: false };
    if (m === 'estrenar') return { p: USO_P * media(p => !(p.usos || []).length ? 1 : p.creada && diasDesde(p.creada, hoy) <= 21 ? .6 : -.2), ayer: true };
    return { p: USO_P * media(p => { const d = dias(p); return d == null ? .6 : d <= 3 ? -1 : d <= 7 ? -.4 : d <= 14 ? .2 : .6; }), ayer: true };
  }
  /* 13/11 (Gabriela, 12/11: «la app debe aprender de primero los looks favoritos, de las piezas que cambia del outfit, y poco a poco va conociendo a la persona»):
     lo aprendido de cada persona se queda en el motor, sin pantalla («no quiero cargar más la app»). Parejas de prendas: las de un favorito suman más que las de
     «Me lo pongo»; al cambiar una prenda del look, la que pone suma con el resto y la que quita resta poco. Gustos por rasgo (color, tipo, estampado) con un peso
     que crece con los datos (datos / (datos + k)) y con tope. Solo ordena looks que ya pasan los vetos: elegir() quita antes los vetados, así que el gusto
     nunca saca algo que la estilista prohíbe. Números de Moda (AP_MODA, equipo/moda/estudio/salidas/ciencia-looks-2026-11-13.md). */
  // Pesos de Moda (13/11), ya en puntos de nota: favorito 0,25 del grupo «perfil» (×0,12 = 0,03) por pareja y como mucho 2 parejas; «Me lo pongo» y la prenda
  // que entra al cambiar, 0,10 (0,012); la que sale, −0,012 como mucho; confianza n/(n+10); rasgos solo con 10 señales o más y a la mitad del peso de una pareja;
  // olvido: la mitad cada 90 días; tope ±0,072. Un gusto a favor vale 0 si el look es flojo (nota < 0,12) o tiene un veto blando de −0,30 o peor.
  const AP = { fav: .03, favPares: 2, puesto: .012, cambioSi: .012, cambioNo: .012, k: 10, rasgosDesde: 10, tope: .072, olvido: 90 };
  const RASGOS = f => ['color:' + f.color, 'sub:' + f.subtipo, 'est:' + f.estampado];
  let apCache = { g: null, n: -1, v: null };
  function aprendido(g, ents, hoy) {
    if (!g || (!g.fav?.length && !Object.keys(g.si || {}).length && !g.cam?.length)) return null;
    if (apCache.g === g && apCache.n === ents.length && apCache.hoy === hoy) return apCache.v;
    const f = new Map(ents.map(x => [x.id, x._f])), par = {}, fav = {}, ras = {}, kp = (a, b) => [a, b].sort().join('|'); let datos = 0;
    const sumaRas = (id, w) => { const x = f.get(id); if (x) for (const r of RASGOS(x)) ras[r] = (ras[r] || 0) + w; };
    for (const k of g.fav || []) { const ids = k.split(',').filter(id => f.has(id)); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) fav[kp(ids[i], ids[j])] = 1; ids.forEach(id => sumaRas(id, 1)); datos += 2; }
    for (const [k, n0] of Object.entries(g.si || {})) { const [a, b] = k.split('|'); if (!f.has(a) || !f.has(b)) continue; par[k] = (par[k] || 0) + AP.puesto; sumaRas(a, .5); sumaRas(b, .5); datos += .5 * Math.min(2, n0); }
    const vistos = {};
    for (const c of g.cam || []) { if (!f.has(c.pone)) continue; const w = c.d && hoy ? Math.pow(.5, Math.max(0, diasDesde(c.d, hoy)) / AP.olvido) : 1, rep = vistos[c.quita + '>' + c.pone] = (vistos[c.quita + '>' + c.pone] || 0) + 1;
      for (const r of c.resto || []) { const k = kp(c.pone, r); par[k] = Math.min((par[k] || 0) + AP.cambioSi * w * (rep > 1 ? .5 : 1), AP.cambioSi * 1.5 + AP.puesto * 2); if (c.quita) { const kq = kp(c.quita, r); par[kq] = Math.max((par[kq] || 0) - AP.cambioNo * w / 2, -AP.cambioNo); } }
      sumaRas(c.pone, w); if (c.quita) sumaRas(c.quita, -.5 * w); datos += w; }
    const m = Math.max(1, ...Object.values(ras).map(Math.abs)); for (const r in ras) ras[r] /= m;
    const v = { par, fav, ras, conf: datos / (datos + AP.k), datos }; apCache = { g, n: ents.length, hoy, v }; return v;
  }
  function gustoLook(l, ap, nota0, veto) {
    const ps = PIEZAS.map(k => l[k]).filter(p => p && !p.muestra); let s = 0, nf = 0;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const k = [ps[i].id, ps[j].id].sort().join('|'); s += ap.conf * (ap.par[k] || 0); if (ap.fav[k] && nf < AP.favPares) { s += ap.conf * AP.fav; nf++; } }
    if (ap.datos >= AP.rasgosDesde) s += ap.conf * (AP.puesto / 2) * ps.reduce((a, p) => a + RASGOS(p._f).reduce((b, k) => b + (ap.ras[k] || 0), 0) / 3, 0) / (ps.length || 1) * 3;
    if (s > 0 && (nota0 < R.puntos.umbrales.pasable || veto.blandos.some(v => (v.p || 0) <= -.3))) s = 0;
    return Math.max(-AP.tope, Math.min(AP.tope, s));
  }
  /* 13/11 (Moda, ciencia-looks, punto b: «la variedad solo desempata»): una prenda que lleva tiempo sin salir sube un poco (7–13 días +0,01, 14–27 +0,02, 28 o más,
     o 14 días en el clóset sin estrenar, +0,03; a la mitad con 5–9 usos y nada con 10 o más; +0,01 si otra prenda también lleva 14 días; tope +0,04), solo en looks
     buenos (nota ≥ 0,30) y sin prendas fuera de rango. Y lo que se repite en los 10 últimos días puestos baja (arriba, abajo y vestido: 3 → −0,01, 4 → −0,02,
     5 o más → −0,04; calzado, capa y bolso: 4 → −0,01 … 7 o más → −0,04), solo si hay otra pieza de ese hueco para elegir. Neto, de −0,06 a +0,04. */
  const ROT_ROPA = [0, 0, 0, -.01, -.02, -.04], ROT_COMPL = [0, 0, 0, 0, -.01, -.02, -.03, -.04];
  function variedadModa(l, c, pf, hoy, nota0) {
    const ult = pf.ult10, alt = pf.alt || {}; let bono = 0, otro = 0, rot = 0;
    for (const k of ['arriba', 'abajo', 'vestido', 'capa']) { const x = l[k]; if (!x?.p || x.muestra) continue; const us = x.p.usos || [];
      let d = null; for (const u of us) { const q = diasDesde(u, hoy); if (q >= 0 && (d == null || q < d)) d = q; }
      const nuevo = d == null && (!x.p.creada || diasDesde(x.p.creada, hoy) >= 14), b = (nuevo || d >= 28 ? .03 : d >= 14 ? .02 : d >= 7 ? .01 : 0) * (us.length >= 10 ? 0 : us.length >= 5 ? .5 : 1);
      if (b > bono) { if (bono >= .02) otro = 1; bono = b; } else if (b >= .02) otro = 1; }
    bono = nota0 >= .3 && !c.prendas_fuera_de_rango ? Math.min(.04, bono + (otro ? .01 : 0)) : 0;
    if (ult?.size) for (const k of PIEZAS) { const x = l[k]; if (!x?.p || x.muestra) continue; const n = (x.p.usos || []).filter(u => ult.has(u)).length, compl = ['calzado', 'capa', 'bolso'].includes(k);
      if ((alt[x._f.cat] || 0) < 2) continue; rot += (compl ? ROT_COMPL : ROT_ROPA)[Math.min(n, compl ? 7 : 5)]; }
    return Math.max(-.06, Math.min(.04, bono + Math.max(-.06, rot)));
  }
  function evaluar(l, ctx, pf, hoy) {
    const c = camposLook(l, ctx, pf, hoy), e = entorno(l, c, ctx, pf), veto = vetar(e), pts = puntuar(l, c, e), uso = ajusteUso(l, pts, pf, hoy);
    // un look puesto ayer no es la primera idea: el peso del grupo «variedad» solo no lo baja lo bastante
    const ayer = uso.ayer && (c.dias_desde_ultimo_uso === 1 || c.dias_desde_ultimo_uso === 0) ? (c.es_favorito ? .05 : .15) : 0;
    const nota0 = pts.total + veto.p / 2, gusto = pf.ap ? gustoLook(l, pf.ap, nota0, veto) : 0, vm = pf.uso ? 0 : variedadModa(l, c, pf, hoy, nota0); // con «Cómo usas tu ropa» elegido, manda ajusteUso
    return { ...l, ctx, campos: c, veto, pts, gusto, variedad: vm, nota: pts.total + uso.p + gusto + vm + veto.p / 2 - ayer + huella(hoy + claveRopa(l)) * .04 + AF.nota * (PIEZAS.reduce((s, k) => s + afin(l[k]), 0) / Math.max(1, PIEZAS.filter(k => l[k]).length)), casi: !!(l.hueco_faltante || (l.capa_faltante && ['T4', 'T5', 'T6', 'T7'].includes(ctx.tramo.id) && veto.duros.every(v => v.id === 'V11'))) };
  }
  function elegir(cs, n, excluir) {
    const ok = cs.filter(l => !l.veto.duros.length && !l.casi && !excluir.has(claveLook(l))).sort((a, b) => b.nota - a.nota), sel = [], usoA = new Map(), usoB = new Map(), usoF = new Map(), usoZ = new Map(), vistos = new Set(), gemelos = new Set();
    for (const tope of [1, 2]) for (const l of ok) {
      if (sel.length >= n) break; if (l.nota < R.puntos.umbrales.mostrar_minimo && sel.length) break;
      const a = (l.arriba || l.vestido).id, b = l.abajo?.id, k = claveRopa(l), fA = (l.arriba || l.vestido)._f, fB = l.abajo?._f, gem = [fB?.color, fB?.corte, fA.color, fA.estampado, fA.manga].join('|');
      if (tope === 1 && gemelos.has(gem)) continue; // una de abajo y una de arriba que se ven casi iguales: solo si no hay otra cosa
      if (vistos.has(k) || (usoA.get(a) || 0) >= tope || (b && tope === 1 && (usoB.get(b) || 0) >= 2) || (b && (usoB.get(b) || 0) >= Math.max(3, Math.ceil(n / 2))) || (usoF.get(l.formula.id) || 0) >= 2 || (tope === 1 && l.calzado && (usoZ.get(l.calzado.id) || 0) >= Math.max(2, Math.ceil(n / 3)))) continue; // ningún zapato en más de un tercio, si hay otro
      vistos.add(k); gemelos.add(gem); sel.push(l); usoA.set(a, (usoA.get(a) || 0) + 1); if (b) usoB.set(b, (usoB.get(b) || 0) + 1); usoF.set(l.formula.id, (usoF.get(l.formula.id) || 0) + 1); if (l.calzado) usoZ.set(l.calzado.id, (usoZ.get(l.calzado.id) || 0) + 1);
    }
    // sin dos seguidos con la misma prenda de arriba
    const out = [], resto = [...sel];
    while (resto.length) { const pre = out[out.length - 1], i = resto.findIndex(l => !pre || (l.arriba || l.vestido).id !== (pre.arriba || pre.vestido).id); out.push(...resto.splice(i < 0 ? 0 : i, 1)); }
    return out;
  }
  // en qué ocasiones cabe una prenda (para el filtro del clóset): una fórmula de esa ocasión la admite en un hueco y la prenda no baja del nivel de la ocasión
  const ocasionesDe = p => { const f0 = ficha(p, {}), e = [{ id: p.id, p, _f: f0 }];
    if (f0.cat === 'bolso') return [...(grupo('@bolso_dia').includes(f0.subtipo) ? ['Diario', 'Oficina', 'Viaje'] : []), ...(grupo('@bolso_noche').includes(f0.subtipo) ? ['Noche', 'Evento'] : [])]; // 06/11: complementos
    if (f0.subtipo === 'cinturon') return ['Diario', 'Oficina', 'Noche', 'Evento'];
    return [...new Set(F.formulas.filter(f => (!soloDeporte(f0) || f.ocasiones.includes('Deporte')) && f.huecos.some(h => cands(h, e).length)).flatMap(f => f.ocasiones))].filter(o => !(f0.form < (R.ocasiones[o]?.form_media_min ?? 0) - .5)); };
  const claveLook = l => PIEZAS.map(k => l[k]).filter(p => p && !p.muestra).map(p => p.id).sort().join();

  /* ---------- 6. fórmulas posibles, qué falta y la llamada de la app ---------- */
  const OC_TODOS = ctx => ctx.hora >= 19 ? ['Noche', 'Diario', 'Viaje', 'Oficina'] : ['Diario', 'Viaje', 'Oficina'];
  function formulasPosibles(ctx, pf, plan, margen = 1) {
    const ocs = plan === 'Todos' ? OC_TODOS(ctx) : [plan];
    return F.formulas.filter(f => f.ocasiones.some(o => ocs.includes(o)) && ctx.t_ref >= f.tmin - margen && ctx.t_ref <= f.tmax + margen && (!ctx.lluvia || f.lluvia) && (!f.requiere_estilo || pf.estilos.some(e => f.requiere_estilo.includes(e))) && !(pf.publico === 'masculino' && f.publico === 'femenino'));
  }
  const NOMBRES = { mocasines: 'mocasines', botines: 'botines', zapatillas: 'zapatillas', sandalias_planas: 'sandalias planas', sandalias_tacon: 'sandalias de tacón', bailarinas: 'bailarinas', tacones: 'tacones', zapato_cordones: 'zapatos de cordones', botas_altas: 'botas altas', botas_agua: 'botas de agua', botas_montana: 'botas de montaña', alpargatas: 'alpargatas', abrigo_lana: 'abrigo de lana', plumifero: 'plumífero', pantalon_vestir: 'pantalón de vestir', pantalon_fluido: 'pantalón fluido', pantalon_lino: 'pantalón de lino', cardigan: 'cárdigan', jersey_cuello_alto: 'jersey de cuello alto', vestido_midi: 'vestido midi', falda_midi: 'falda midi' };
  const nombreTipo = id => NOMBRES[id] || R.inferencia.subtipos.find(s => s.id === id)?.palabras?.[0] || id.replace(/_/g, ' ');
  function faltas(ctx, plan, ents, zapatosPropios, pf) {
    const ps = formulasPosibles(ctx, pf, plan, 1), cuenta = {};
    for (const f of ps) {
      const sin = f.huecos.filter(h => !h.opcional && !cands(h, h.rol === 'calzado' ? zapatosPropios : ents).length);
      if (sin.length !== 1) continue;
      const h = sin[0], abrigo = h.rol === 'capa' && tiposDe(h).some(t => R.grupos['@abrigo_frio'].includes(t)), g = abrigo ? 'abrigo' : h.rol === 'base_interior' ? 'arriba' : h.rol;
      const c = cuenta[g] = cuenta[g] || { n: 0, tipos: {}, todos: new Set() }; c.n++; const t0 = tiposDe(h)[0]; c.tipos[t0] = (c.tipos[t0] || 0) + 1; for (const t of tiposDe(h)) c.todos.add(t);
    }
    if (String(ctx.tramo.capa).startsWith('obligatoria') && !ents.some(p => p._f.cat === 'capa' && p._f.subtipo !== 'chaleco_traje')) {
      const t0 = ctx.tramo.id === 'T4' ? 'gabardina' : ctx.tramo.id === 'T5' ? 'abrigo_lana' : 'plumifero', g = ctx.tramo.id === 'T4' ? 'capa' : 'abrigo', c = cuenta[g] = cuenta[g] || { n: 0, tipos: {} };
      c.n += 50; c.tipos[t0] = (c.tipos[t0] || 0) + 50;
    }
    const orden = R.faltas.prioridad;
    if (!Object.keys(cuenta).length && !cands({ tipos: ['@pantalon', '@falda'] }, ents.filter(p => p._f.tmax >= ctx.t_ref && p._f.tmin <= ctx.t_ref)).length) { const c = cuenta.abajo = { n: 1, tipos: {} }; c.tipos[ctx.t_ref >= 24 ? 'pantalon_lino' : 'pantalon_vestir'] = 1; } // sin ninguna prenda de abajo para este tiempo
    return Object.entries(cuenta).sort((a, b) => b[1].n - a[1].n || orden.indexOf(a[0]) - orden.indexOf(b[0])).slice(0, 3).map(([g, c]) => {
      const pref = g === 'calzado' && (ctx.tramo.calzado?.preferir || []).find(t => c.todos?.has(t)); // el zapato que nombra el aviso es el del tiempo que hace
      const t0 = pref || Object.entries(c.tipos).sort((a, b) => b[1] - a[1])[0][0];
      return { grupo: g, tipo: t0, n: c.n, frase: R.faltas.frases[g].replace('{tipo}', nombreTipo(t0)) };
    });
  }
  /* Entrada: { prendas, tiempo, plan, perfil, n, hoy, hora, excluir, pro, colorEstacion }. Salida: { looks, casi, falta, ctx }. */
  function looks(o) {
    const t0 = Date.now(), hoy = o.hoy || new Date().toISOString().slice(0, 10), plan = o.plan || 'Todos', n = o.n || 6, pf = perfilMotor(o.perfil, o), excluir = new Set(o.excluir || []);
    const ctx0 = contexto(o.tiempo, plan, { hora: o.hora, t_ref: o.t_ref, evento: o.evento, lugar: o.lugar });
    const ents = (o.prendas || []).filter(p => !p.noMeGusta).map(p => ({ id: p.id, p, _f: ficha(p, pf) }));
    COMPL = !!o.complementos; MAXPAR = o.parejas || 12; pf.ap = aprendido(pf.gustos, ents, hoy);
    { const fechas = [...new Set(ents.flatMap(x => x.p.usos || []).filter(u => u <= hoy))].sort().slice(-10); pf.ult10 = new Set(fechas); pf.alt = {}; // los 10 últimos días con algo puesto; cuántas piezas hay de cada clase
      for (const x of ents) if (!(x._f.tmin != null && ctx0.t_ref < x._f.tmin - 3) && !(x._f.tmax != null && ctx0.t_ref > x._f.tmax + 3) && !x._f.deportiva) pf.alt[x._f.cat] = (pf.alt[x._f.cat] || 0) + 1; }
    if (o.afin) for (const x of ents) x._af = typeof o.afin === 'function' ? o.afin(x._f, txtAfin(x.p)) : afinEstilo(x._f, txtAfin(x.p), o.afin);
    else if (pf.inspo) { // 06/11: sin «Inspírate en», los looks que le encantan tiran (a menos de la mitad de fuerza) de los estilos que más se repiten en ellos y de sus colores
      const top = Object.entries(pf.inspo.estilos).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
      for (const x of ents) x._af = .5 * afinEstilo(x._f, txtAfin(x.p), top) + (pf.inspo.colores.has(x._f.color) ? .15 : 0);
    }
    let ropa = ents.filter(p => p.p.tipo !== 'Calzado'); const propios = ents.filter(p => p.p.tipo === 'Calzado'), zapatos = propios.length ? propios : ZV;
    if (ents.length > 150) { // clóset enorme: se forman parejas con lo menos puesto últimamente
      const reciente = x => (x.p.usos || []).reduce((m, u) => u > m ? u : m, ''), poco = (tipo, n) => ropa.filter(x => x.p.tipo === tipo).sort((a, b) => reciente(a).localeCompare(reciente(b))).slice(0, n);
      ropa = [...poco('Arriba', 40), ...poco('Abajo', 25), ...ropa.filter(x => !['Arriba', 'Abajo'].includes(x.p.tipo))];
    }
    let cs = [], res = [];
    for (const margen of [1, 3, 6]) {
      const cacheP = new Map(); cs = []; if (margen === 6) BARATOS.delete('V39');
      for (const f of formulasPosibles(ctx0, pf, plan, margen)) {
        const ocs = plan === 'Todos' ? OC_TODOS(ctx0).filter(x => f.ocasiones.includes(x)) : [plan], ctx = plan === 'Todos' ? { ...ctx0, ocasion: ocs[0] } : ctx0;
        const resta = plan === 'Todos' && ocs[0] !== 'Diario' && ocs[0] !== 'Noche' ? .1 : 0; // sin plan, antes lo de diario
        for (const l of rellenar(f, ropa, zapatos, ctx, pf, hoy, cacheP)) { const e = evaluar(l, ctx, pf, hoy); e.nota -= resta; cs.push(e); }
      }
      res = elegir(cs, n, excluir);
      if (margen === 6) { BARATOS.add('V39'); if (!res.length) res = elegir(cs.filter(l => l.campos.arriba_fuera_grados <= 4 && l.veto.duros.every(v => v.id === 'V39')).map(l => ({ ...l, veto: { ...l.veto, duros: [] } })), Math.min(n, 3), excluir); }
      if (res.length >= Math.min(3, n) || (margen === 3 && res.length)) break;
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
  const capaQueFalta = l => { const tr = l.ctx.tramo; if (String(tr.capa).startsWith('obligatoria')) return tr.id === 'T4' ? 'chaqueta' : 'abrigo'; return l.hueco_faltante ? nombreTipo(tiposDe(l.hueco_faltante.h)[0]) : 'abrigo'; };
  const zapatoDe = l => { const c = l.calzado; if (!c || !c.muestra) return null; const f = c._f; return { muestra: c.muestra, tipo: f.subtipo, color: f.color.toLowerCase(), tacon: f.tacon }; };
  // la propuesta tal y como la pinta la app: los ids de las prendas reales, el zapato de muestra si hace falta y cómo se lleva la de arriba
  function aPropuesta(l) {
    const ps = ['capa', 'arriba', 'base_interior', 'abajo', 'vestido', 'calzado', 'bolso', 'accesorio', 'accesorio2', 'joya'].map(k => l[k]).filter(p => p && !p.muestra);
    return { ids: ps.map(p => p.id), ocasion: l.ctx.ocasion, formula: l.formula?.id, estilos: l.formula?.estilos || [], fmedia: l.campos?.form_media, nombre: l.formula?.nombre, porque: l.formula?.porque, como: l.campos.como === 'por_dentro' ? 'por dentro' : l.campos.como, zspec: zapatoDe(l), faltaCapa: !!l.faltaCapa, capaFalta: l.faltaCapa ? capaQueFalta(l) : null, nota: l.nota };
  }
  /* 08/11 (Gabriela: «uno escanea piezas en tiendas y que la app le diga un porcentaje de utilidad, es decir, si tendría muchas combinaciones en su clóset»):
     la prenda que aún no tienes se prueba con tu ropa en su temporada (dos temperaturas si vale para mucho tiempo) y en todas las ocasiones en que puede salir;
     de su categoría solo entra ella, así que todos los looks la llevan. Utilidad: de tus prendas que se llevarían con ella en esa temporada (lo de abajo para
     una de arriba, lo de arriba para una de abajo, calzado y abrigo para un vestido…), cuántas salen con ella en algún look bueno. Además, lo que ya tienes igual. */
  const CON_TIPO = { Arriba: ['Abajo'], Abajo: ['Arriba'], Vestidos: ['Calzado', 'Abrigo'], Abrigo: ['Arriba', 'Abajo', 'Vestidos'], Calzado: ['Arriba', 'Abajo', 'Vestidos'], Bolsos: ['Arriba', 'Abajo', 'Vestidos'], Accesorios: ['Arriba', 'Abajo', 'Vestidos'] };
  function utilidad(o) {
    const p = o.prenda, f = ficha(p, {}), lo = Math.max(f.tmin ?? 5, 0), hi = Math.min(f.tmax ?? 28, 32), min = R.puntos.umbrales.pasable;
    const temps = hi - lo >= 12 ? [lo + 4, hi - 4] : [Math.round((lo + hi) / 2)], tiempos = temps.map(t => ({ t, max: t + 3, min: t - 6 }));
    const resto = (o.prendas || []).filter(x => x.id !== p.id && !x.noMeGusta), dep = soloDeporte(f), ent = { p, _f: f };
    const ocs = dep ? ['Deporte'] : ['Diario', 'Oficina', 'Noche', 'Evento', 'Viaje', ...(aptoDeporte(ent) ? ['Deporte'] : [])];
    const pool = [p, ...resto.filter(x => ficha(x, {}).cat !== f.cat)], vistos = new Map(), socios = new Set(), enOc = new Set();
    for (const tiempo of tiempos) for (const plan of ocs) {
      const r = looks({ prendas: pool, tiempo, plan, perfil: { ...(o.perfil || {}), usoRopa: null }, n: 8, hoy: o.hoy, hora: plan === 'Noche' ? 20 : 12, excluir: o.excluir, pro: true, colorEstacion: o.colorEstacion, depurar: true, complementos: ['bolso', 'accesorio'].includes(f.cat), parejas: o.parejas || 40 });
      for (const l of r.todos || []) {
        if (l.veto.duros.length || l.casi || l.nota < min) continue;
        const ps = PIEZAS.map(k => l[k]).filter(x => x && !x.muestra); if (!ps.some(x => x.id === p.id)) continue;
        if (plan === 'Deporte' && !ps.some(x => soloDeporte(x._f) || x._f.deportiva)) continue;
        ps.forEach(x => x.id !== p.id && socios.add(x.id)); enOc.add(plan);
        const k = claveLook(l), y = vistos.get(k); if (!y || y.nota < l.nota) vistos.set(k, l);
      }
    }
    const ctxs = tiempos.map(w => contexto(w, 'Diario', { hora: 12 }));
    const posibles = resto.filter(x => (CON_TIPO[p.tipo] || []).includes(x.tipo)).filter(x => { const e = { p: x, _f: ficha(x, {}) }; return (dep ? aptoDeporte(e) : !soloDeporte(e._f)) && ctxs.some(c => vaHoy(e, c)); });
    const conEl = posibles.filter(x => socios.has(x.id));
    // los mejores: uno de cada ocasión por turnos (Deporte, al final), sin repetir la pareja principal (la de abajo para una de arriba…) hasta haber probado todas
    const todos = [...vistos.values()].sort((a, b) => b.nota - a.nota), lista = [], usadas = new Set(), N = o.n || 6, clave = l => PIEZAS.map(k => l[k]).filter(x => x && !x.muestra && x.id !== p.id && (CON_TIPO[p.tipo] || []).includes(x.p.tipo)).map(x => x.id).sort().join();
    const porOc = ocs.map(oc => todos.filter(l => l.ctx.ocasion === oc));
    for (let vuelta = 0; lista.length < N && vuelta < 12; vuelta++) for (const ls of porOc) { if (lista.length >= N) break; const l = ls.find(l => !lista.includes(l) && !usadas.has(clave(l))); if (l) { usadas.add(clave(l)); lista.push(l); } }
    for (const l of todos) { if (lista.length >= N) break; if (!lista.includes(l)) lista.push(l); }
    // lo que ya tienes igual: mismo tipo, color y manga (una camiseta roja de manga corta no es la de manga larga abullonada)
    const parecidas = resto.filter(x => { const g = ficha(x, {}); return g.subtipo === f.subtipo && g.color === f.color && (g.manga || '') === (f.manga || '') && !!g.foco === !!f.foco; }).map(x => x.id);
    return { pct: posibles.length ? Math.round(100 * conEl.length / posibles.length) : null, con: conEl.map(x => x.id), posibles: posibles.length, nLooks: vistos.size,
      ocasiones: ocs.filter(x => enOc.has(x)), temps, looks: lista.map(aPropuesta), parecidas, tipos: CON_TIPO[p.tipo] || [] };
  }
  return { iniciar, inferir, afinEstilo, rasgo, txtAfin, ficha: p => ficha(p, {}), ocasionesDe, vaHoy, aptoDeporte, soloDeporte, contexto, perfilMotor, looks, juzgar, aPropuesta, faltas, claveLook, utilidad, get R() { return R; }, get F() { return F; } };
})();
if (typeof module !== 'undefined') module.exports = Motor;
else if (typeof MOTOR_DATOS !== 'undefined') Motor.iniciar(MOTOR_DATOS.R, MOTOR_DATOS.F, MOTOR_DATOS.S);
