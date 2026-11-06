// TuCloset · diagnóstico por foto (0.12). Gabriela, 28/10/2026: «eso te lo tiene que hacer la app a partir de una foto… la app es quien te escanea
// y te da un diagnóstico de colorimetría, silueta y tipo de ropa que te favorece… te tiras una foto al inicio de cara y de cuerpo, o las subes».
// Todo ocurre en el móvil con MediaPipe (modelos en modelos/mp/): las fotos no se suben nunca. Se carga solo cuando hace falta (import dinámico).
// Mide; no decide: las reglas (umbrales, estaciones, tipos de cuerpo y recomendaciones) son de la Dirección de Moda, en diagnostico-reglas.json.

const MP = new URL('./modelos/mp/', import.meta.url).href;
let tareas = null;

export async function cargar() {
  if (tareas) return tareas;
  tareas = (async () => {
    const V = await import(MP + 'vision_bundle.mjs');
    const fs = await V.FilesetResolver.forVisionTasks(MP + 'wasm');
    const op = (f, extra) => ({ baseOptions: { modelAssetPath: MP + f, delegate: 'CPU' }, runningMode: 'IMAGE', ...extra });
    const [cara, partes, pose] = await Promise.all([
      V.FaceLandmarker.createFromOptions(fs, op('face_landmarker.task', { numFaces: 2 })),
      V.ImageSegmenter.createFromOptions(fs, op('selfie_multiclass_256x256.tflite', { outputCategoryMask: true, outputConfidenceMasks: false })),
      V.PoseLandmarker.createFromOptions(fs, op('pose_landmarker_lite.task', { numPoses: 2 }))]);
    return { cara, partes, pose };
  })();
  try { return await tareas; } catch (e) { tareas = null; throw e; }
}

// ---------- utilidades ----------
async function lienzo(blob, max = 1024) {
  const bm = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bm.width, bm.height)), W = Math.round(bm.width * k), H = Math.round(bm.height * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bm, 0, 0, W, H); bm.close?.();
  return { c, W, H, px: x.getImageData(0, 0, W, H).data };
}
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i));
function lab(r, g, b) { return labLin([LIN[r], LIN[g], LIN[b]]); }
function labLin([R, G, B]) { // RGB lineal → CIELAB (D65)
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const X = f((R * .4124 + G * .3576 + B * .1805) / .95047), Y = f(R * .2126 + G * .7152 + B * .0722), Z = f((R * .0193 + G * .1192 + B * .9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const mediana = a => { if (!a.length) return null; const s = Float32Array.from(a).sort(); return s[s.length >> 1]; };
// color representativo de un grupo de píxeles: sin sombras (25 % más oscuro) ni brillos (10 % más claro), mediana de L, a y b
function colorDe(muestras) {
  if (muestras.length < 30) return null;
  const Ls = muestras.map(m => m[0]).sort((a, b) => a - b), lo = Ls[Math.floor(Ls.length * .25)], hi = Ls[Math.floor(Ls.length * .9)];
  const ok = muestras.filter(m => m[0] >= lo && m[0] <= hi); if (ok.length < 20) return null;
  const L = mediana(ok.map(m => m[0])), a = mediana(ok.map(m => m[1])), b = mediana(ok.map(m => m[2]));
  return { L: +L.toFixed(1), a: +a.toFixed(1), b: +b.toFixed(1), C: +Math.hypot(a, b).toFixed(1), h: +((Math.atan2(b, a) * 180 / Math.PI + 360) % 360).toFixed(1), n: ok.length, hex: hexDe(L, a, b) };
}
// color natural del blanco del ojo con luz neutra: b* hacia +6 (algo amarillento); a* entre −1 y +6
const BLANCO_OJO_B = 6, BLANCO_OJO_A = [-1, 6];
function linDeLab([L, a, b]) { // CIELAB (D65) → RGB lineal
  const fy = (L + 16) / 116, f3 = t => t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27);
  const X = f3(fy + a / 500) * .95047, Y = f3(fy), Z = f3(fy - b / 200) * 1.08883;
  return [3.2406 * X - 1.5372 * Y - .4986 * Z, -.9689 * X + 1.8758 * Y + .0415 * Z, .0557 * X - .204 * Y + 1.057 * Z];
}
// contorno de cada ojo en Face Mesh (lo que se ve entre los párpados)
const OJO_A = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], OJO_B = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const dentro = (pg, x, y) => { let c = false; for (let i = 0, j = pg.length - 1; i < pg.length; j = i++) { const [xi, yi] = pg[i], [xj, yj] = pg[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
// nombre del color de ojos a partir del tono (h) y la saturación (C) en CIELAB, ya sin el tinte de la luz
// 06/11 (Gabriela: «debería poner tonos de pelo reales: castaños, negro…»): nombre del pelo y de la piel por luz (L), tono (h) y saturación (C), ya sin el tinte de la luz;
// en foto el pelo sale más oscuro de lo que se ve (sombras), por eso los cortes son bajos
export function nombrePelo({ L, C, h }) {
  if (C < 7 && L >= 55) return 'canoso';
  if (L < 14) return 'negro';
  if (C >= 16 && h >= 25 && h < 60 && L < 62) return 'pelirrojo';
  if (L < 24) return 'castano_oscuro';
  if (L < 36) return 'castano';
  if (L < 48) return 'castano_claro';
  return L < 60 ? 'rubio_oscuro' : 'rubio';
}
export const nombrePiel = ({ L }) => L >= 70 ? 'clara' : L >= 58 ? 'media' : L >= 45 ? 'morena' : 'oscura';
// varias selfies de la misma persona (06/11, Gabriela: «me cambia la colorimetría según qué, ¿según la foto? eso hay que perfeccionarlo»): la estación sale de la media
// de las últimas fotos de cara, así una foto con mala luz pesa menos; cada medida se promedia en CIELAB
export function mediaCaras(cs) {
  const med = k => { const xs = cs.map(c => c[k]).filter(Boolean); if (!xs.length) return null; const m = j => xs.reduce((s, x) => s + x[j], 0) / xs.length, L = m('L'), a = m('a'), b = m('b');
    return { L: +L.toFixed(1), a: +a.toFixed(1), b: +b.toFixed(1), C: +Math.hypot(a, b).toFixed(1), h: +((Math.atan2(b, a) * 180 / Math.PI + 360) % 360).toFixed(1), hex: hexDe(L, a, b) }; };
  const piel = med('piel'), pelo = med('pelo'), ojos = med('ojos'); piel.nombre = nombrePiel(piel); if (pelo) pelo.nombre = nombrePelo(pelo); if (ojos) ojos.nombre = nombreOjos(ojos);
  return { piel, pelo, ojos, contraste: +(cs.reduce((s, c) => s + c.contraste, 0) / cs.length).toFixed(1), calidad: Math.min(1, cs.reduce((s, c) => s + (c.calidad || .6), 0) / cs.length + (cs.length - 1) * .08), n: cs.length };
}
export function nombreOjos({ L, C, h }) {
  const verdoso = h >= 95 && h < 180, azulado = h >= 180 && h < 300;
  if (C < 4) return L >= 40 ? 'gris' : 'marron_oscuro';
  if (azulado) return C < 9 ? 'gris' : 'azul';
  if (verdoso) return C < 5 && L < 25 ? 'marron_oscuro' : 'verde';
  if (h >= 72 && h < 95) return 'avellana';
  return L < 30 ? 'marron_oscuro' : 'marron';
}
function hexDe(L, a, b) { // CIELAB → sRGB, para enseñar el color medido
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, inv = t => t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27);
  const X = inv(fx) * .95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const g = v => { v = v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
  return '#' + [X * 3.2406 - Y * 1.5372 - Z * .4986, -X * .9689 + Y * 1.8758 + Z * .0415, X * .0557 - Y * .204 + Z * 1.057].map(v => g(v).toString(16).padStart(2, '0')).join('');
}

// ---------- cara: piel, pelo, ojos, contraste ----------
// Problemas que impiden el diagnóstico (fatal) o le quitan confianza (aviso); la app los explica con una frase y pide otra foto.
// si el motor de MediaPipe se rompe (le pasa con algunas fotos), se descarta y la próxima vez se vuelve a cargar
const seguro = f => async blob => { try { return await f(blob); } catch (e) { tareas = null; return { ok: false, prob: [{ k: 'error', fatal: true }], error: String(e).slice(0, 200) }; } };
export const analizarCara = seguro(caraSin), analizarCuerpo = seguro(cuerpoSin);
async function caraSin(blob) {
  const T = await cargar(), { c, W, H, px } = await lienzo(blob);
  const prob = [], aviso = k => prob.push({ k, fatal: false }), fatal = k => prob.push({ k, fatal: true });
  // foto sin color (blanco y negro o sepia): no se puede medir nada
  let cro = 0, n = 0; for (let i = 0; i < px.length; i += 4 * 37) { const [, A, B] = lab(px[i], px[i + 1], px[i + 2]); cro += Math.hypot(A, B); n++; }
  if (cro / n < 4) return { ok: false, prob: [{ k: 'sin_color', fatal: true }] };
  const fl = T.cara.detect(c).faceLandmarks || [];
  if (!fl.length) return { ok: false, prob: [{ k: 'sin_cara', fatal: true }] };
  if (fl.length > 1) return { ok: false, prob: [{ k: 'varias_caras', fatal: true }] };
  const lm = fl[0], P = i => [lm[i].x * W, lm[i].y * H];
  const xs = lm.map(p => p.x * W), ys = lm.map(p => p.y * H), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), fw = x1 - x0;
  if (fw / W < .16 && fw < 140) fatal('cara_lejos');
  const ojoI = P(33), ojoD = P(263), nariz = P(1), dOjos = Math.hypot(ojoD[0] - ojoI[0], ojoD[1] - ojoI[1]);
  if (Math.abs(nariz[0] - (ojoI[0] + ojoD[0]) / 2) / dOjos > .16) aviso('cara_de_lado');
  if (Math.abs(Math.atan2(ojoD[1] - ojoI[1], ojoD[0] - ojoI[0])) > .25) aviso('inclinada');
  // partes: 0 fondo, 1 pelo, 2 piel del cuerpo, 3 piel de la cara, 4 ropa, 5 otros (gafas, accesorios)
  const seg = T.partes.segment(c), cm = seg.categoryMask, mW = cm.width, mH = cm.height, m = cm.getAsUint8Array().slice(); cm.close?.(); seg.close?.();
  const parte = (x, y) => m[Math.min(mH - 1, Math.floor(y / H * mH)) * mW + Math.min(mW - 1, Math.floor(x / W * mW))];
  // ojos (06/11, Gabriela: «mis ojos son verdes y los pone marrón»): antes se tomaba todo el anillo del iris y entraban la sombra del párpado de arriba, el anillo
  // ámbar que muchos ojos verdes tienen junto a la pupila y el tinte amarillo de la luz de casa. Ahora: solo lo que se ve entre los párpados (contorno del ojo), la parte
  // de fuera del iris sin el borde oscuro, sin la franja de arriba; y el blanco del ojo, que es casi neutro, sirve de referencia para quitar el tinte de la luz.
  const iris = [], blanco = [];
  for (const [cI, bI] of [[468, 469], [473, 474]]) {
    const [cx, cy] = P(cI), R = Math.hypot(P(bI)[0] - cx, P(bI)[1] - cy); if (R < 2.5) continue;
    const pg = [OJO_A, OJO_B].map(o => o.map(P)).find(q => dentro(q, cx, cy)); if (!pg) continue;
    const gx = pg.map(q => q[0]), gy = pg.map(q => q[1]);
    for (let y = Math.min(...gy) | 0; y <= Math.max(...gy); y++) for (let x = Math.min(...gx) | 0; x <= Math.max(...gx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || !dentro(pg, x, y)) continue;
      const d = Math.hypot(x - cx, y - cy), k = (y * W + x) * 4, rgb = [LIN[px[k]], LIN[px[k + 1]], LIN[px[k + 2]]];
      if (d > R * 1.2) { blanco.push(rgb); continue; }
      if (d < R * .5 || d > R * .88 || y < cy - R * .45) continue;
      iris.push(rgb);
    }
  }
  // balance de blancos con el blanco del ojo (en RGB lineal, como actúa la luz): la mitad más clara y poco saturada; su color natural es un blanco algo cálido
  let gan = [1, 1, 1], ref = null;
  const bl = blanco.filter(c => { const v = labLin(c); return v[0] > 45 && Math.hypot(v[1], v[2]) < 30; }).sort((p, q) => (q[0] + q[1] + q[2]) - (p[0] + p[1] + p[2]));
  // la luz tiñe sobre todo en el eje azul–ámbar (b*); el rojo del blanco del ojo cambia mucho de una persona a otra (venitas, lagrimal), así que en a* solo se corrige lo que se sale de lo natural
  if (bl.length >= 12) { const top = bl.slice(0, Math.max(12, bl.length >> 1)), m = [0, 1, 2].map(c => mediana(top.map(v => v[c]))), r0 = labLin(m);
    const obj = linDeLab([r0[0], Math.max(BLANCO_OJO_A[0], Math.min(BLANCO_OJO_A[1], r0[1])), BLANCO_OJO_B]);
    gan = [0, 1, 2].map(c => Math.max(.6, Math.min(1.6, (obj[c] / obj[1]) / (m[c] / m[1])))); ref = r0.map(v => +v.toFixed(1)); }
  const ojos = iris.map(c => labLin([c[0] * gan[0], c[1] * gan[1], c[2] * gan[2]])).filter(v => v[0] < 88);
  let ey = colorDe(ojos); if (ey) { ey.luz = gan.map(g => +g.toFixed(2)); ey.ref = ref; }
  // 06/11 (Gabriela: «la clasificación tiene que ser buena, no sé si a mí me favorecen mucho los colores fucsia»): la piel y el pelo se medían con el tinte
  // de la luz de cada casa y de cada móvil (una luz fría enfriaba la piel y daba Invierno); ahora pasan por el mismo balance de blancos que los ojos
  const labG = k => labLin([LIN[px[k]] * gan[0], LIN[px[k + 1]] * gan[1], LIN[px[k + 2]] * gan[2]]);
  if (ey) ey.nombre = nombreOjos(ey);
  if (!ey) aviso('ojos_no_visibles');
  // piel: mejillas y frente (puntos 50, 280 y 151), solo donde el segmentador ve piel de la cara
  const r = fw * .07, piel = [], lados = [[], []];
  [[50, 0], [280, 1], [151, -1], [205, 0], [425, 1]].forEach(([i, lado]) => {
    const [cx, cy] = P(i);
    for (let y = Math.max(0, cy - r | 0); y < Math.min(H, cy + r); y++) for (let x = Math.max(0, cx - r | 0); x < Math.min(W, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || parte(x, y) !== 3) continue;
      const k = (y * W + x) * 4, v = labG(k); piel.push(v); if (lado >= 0) lados[lado].push(v[0]);
    }
  });
  const sk = colorDe(piel); if (!sk) return { ok: false, prob: [...prob, { k: 'sin_piel', fatal: true }] };
  sk.nombre = nombrePiel(sk);
  // luz: quemada, escasa o de un lado
  let quem = 0, tot = 0; for (let y = y0 | 0; y < y1; y += 2) for (let x = x0 | 0; x < x1; x += 2) { const k = (y * W + x) * 4; tot++; if (Math.max(px[k], px[k + 1], px[k + 2]) >= 250) quem++; }
  if (quem / tot > .06) aviso('mucha_luz');
  const lI = mediana(lados[0]), lD = mediana(lados[1]); if (lI != null && lD != null && Math.abs(lI - lD) > 14) aviso('luz_lateral');
  let lum = 0; for (let i = 0; i < px.length; i += 4 * 53) lum += lab(px[i], px[i + 1], px[i + 2])[0]; lum /= px.length / (4 * 53); if (lum < 22) aviso('poca_luz');
  // pelo: lo que el segmentador marca como pelo cerca de la cara (no el de otras personas ni el fondo)
  const pelo = [], bx0 = Math.max(0, x0 - fw * .8), bx1 = Math.min(W, x1 + fw * .8), by0 = Math.max(0, y0 - fw * .8), by1 = Math.min(H, y1 + fw * 1.2);
  for (let y = by0 | 0; y < by1; y += 2) for (let x = bx0 | 0; x < bx1; x += 2) if (parte(x, y) === 1) { const k = (y * W + x) * 4; pelo.push(labG(k)); }
  const hr = pelo.length > (fw * fw) * .04 ? colorDe(pelo) : null; if (!hr) aviso('pelo_no_visible'); else hr.nombre = nombrePelo(hr);
  if (prob.some(p => p.fatal)) return { ok: false, prob };
  const contraste = Math.max(hr ? Math.abs(hr.L - sk.L) : 0, ey ? Math.abs(ey.L - sk.L) : 0);
  return { ok: true, prob, piel: sk, pelo: hr, ojos: ey, contraste: +contraste.toFixed(1), calidad: Math.max(.3, 1 - prob.length * .18) };
}

// ---------- cuerpo: hombros, cintura, cadera y piernas ----------
async function cuerpoSin(blob) {
  const T = await cargar(), { c, W, H } = await lienzo(blob, 900);
  const prob = [], aviso = k => prob.push({ k, fatal: false }), fatal = k => prob.push({ k, fatal: true });
  const r = T.pose.detect(c), poses = r.landmarks || [];
  if (!poses.length) { r.close?.(); return { ok: false, prob: [{ k: 'sin_cuerpo', fatal: true }] }; }
  if (poses.length > 1) { r.close?.(); return { ok: false, prob: [{ k: 'varias_personas', fatal: true }] }; }
  const lm = poses[0], P = i => [lm[i].x * W, lm[i].y * H], vis = i => (lm[i].visibility ?? 1) > .5 && lm[i].y > 0 && lm[i].y < 1;
  if (![11, 12, 23, 24].every(vis)) { r.close?.(); return { ok: false, prob: [{ k: 'sin_tronco', fatal: true }] }; }
  // 06/11 (Gabriela: «me sigue poniendo la foto del cuerpo entero como que tienen que salir los pies… la foto que puse se ve mi silueta 100 %»): los pies ya no son
  // obligatorios; sin ellos se mide la silueta (hombros, cintura, cadera) pero no el largo de las piernas
  const pies = [27, 28].every(vis); if (!pies) aviso('sin_pies');
  r.close?.();
  // 06/11 (Gabriela: «me dice una y otra vez que no me coge la foto de cuerpo entero»): la máscara de silueta de PoseLandmarker abortaba MediaPipe
  // en el móvil con cualquier foto real de cuerpo entero («Check failed: 1 == ChannelSize()»); la silueta sale ahora del segmentador de la cara
  // (selfie_multiclass, ya cargado): todo lo que no es fondo (categoría 0) es la persona
  const seg = T.partes.segment(c), cm = seg.categoryMask; if (!cm) { seg.close?.(); return { ok: false, prob: [{ k: 'sin_silueta', fatal: true }] }; }
  const mW = cm.width, mH = cm.height, mask = cm.getAsUint8Array().slice(); cm.close?.(); seg.close?.();
  const cat = (x, y) => mask[Math.min(mH - 1, Math.max(0, Math.round(y / H * mH))) * mW + Math.min(mW - 1, Math.max(0, Math.round(x / W * mW)))], persona = (x, y) => cat(x, y) > 0;
  const hI = P(11), hD = P(12), cI = P(23), cD = P(24), yS = (hI[1] + hD[1]) / 2, yC = (cI[1] + cD[1]) / 2, Tr = yC - yS, xC = (cI[0] + cD[0]) / 2;
  if (Tr < H * .12) fatal('cuerpo_lejos');
  if (Math.abs(Math.atan2(hD[1] - hI[1], hD[0] - hI[0]) % Math.PI) > .12 && Math.abs(Math.abs(Math.atan2(hD[1] - hI[1], hD[0] - hI[0])) - Math.PI) > .12) aviso('hombros_torcidos');
  if (Math.abs(lm[11].z - lm[12].z) > .35 || Math.abs(hD[0] - hI[0]) < Tr * .55) fatal('cuerpo_de_lado');
  // brazos: muñecas por encima de los hombros o pegadas al tronco a la altura de la cintura
  if (P(15)[1] < yS || P(16)[1] < yS) aviso('brazos_arriba');
  // ancho del tronco en una fila: el tramo de silueta que contiene el centro del cuerpo
  // 06/11 (Gabriela: «mi cuerpo es más ancho de caderas que de hombros y se ve en la foto, y lo hace al revés»): lo que no es el cuerpo ya no cuenta.
  //  · Bolsos, móviles y accesorios (categoría 5 del segmentador) que cuelgan por los lados se quitan siempre.
  //  · En cintura y cadera, la piel que sobresale por fuera de la ropa son manos o brazos (la mano en la cadera, el brazo pegado): se quita si deja al menos el 75 %.
  //  · En las fotos en el espejo el brazo que sujeta el móvil sale a la altura del hombro: el hombro se corta a 0,3 de la distancia entre hombros por fuera de cada
  //    punto (el deltoides); la cadera, a 0,85 de la distancia entre caderas por fuera de cada punto (la cadera real mide unas 2 veces esa distancia: queda margen
  //    para las caderas anchas de verdad).
  //  · La cadera ya no es la fila más ancha (la que más se contamina con una mano o un bolso) sino la del percentil 75 de la franja.
  const tramo = (y, lim, piel) => {
    if (!persona(xC, y)) return null; let a = xC, b = xC; while (a > 0 && persona(a - 1, y)) a--; while (b < W - 1 && persona(b + 1, y)) b++;
    while (a < b && cat(a, y) === 5) a++; while (b > a && cat(b, y) === 5) b--;
    if (piel) { let a2 = a, b2 = b; while (a2 < b2 && cat(a2, y) === 2) a2++; while (b2 > a2 && cat(b2, y) === 2) b2--; if (b2 - a2 >= (b - a) * .75) { a = a2; b = b2; } }
    return lim ? [Math.max(a, lim[0]), Math.min(b, lim[1])] : [a, b];
  };
  const dS = Math.abs(hD[0] - hI[0]), dH = Math.abs(cD[0] - cI[0]);
  const limS = [Math.min(hI[0], hD[0]) - dS * .3, Math.max(hI[0], hD[0]) + dS * .3], limH = [Math.min(cI[0], cD[0]) - dH * .85, Math.max(cI[0], cD[0]) + dH * .85];
  const ancho = (y, lim, piel) => { const t = tramo(y, lim, piel); return t ? t[1] - t[0] : null; };
  const pegados = [];
  const fila = (f0, f1, cmp, lim, piel) => { let mejor = null, yM = null; for (let f = f0; f <= f1; f += .01) { const y = yS + Tr * f, w = ancho(y, lim, piel); if (w == null) continue; if (mejor == null || cmp(w, mejor)) { mejor = w; yM = y; } } return [mejor, yM]; };
  const [hombros, yHo] = fila(.06, .14, (a, b) => a > b, limS);
  const [cintura, yW] = fila(.45, .85, (a, b) => a < b, limH, true);
  const filasC = []; for (let f = .9; f <= 1.3; f += .01) { const y = yS + Tr * f, w = ancho(y, limH, true); if (w != null) filasC.push([w, y]); }
  filasC.sort((a, b) => a[0] - b[0]); const [cadera, yH] = filasC.length ? filasC[Math.floor((filasC.length - 1) * .75)] : [null, null];
  if (!hombros || !cintura || !cadera) return { ok: false, prob: [...prob, { k: 'sin_silueta', fatal: true }] };
  // si los brazos tocan el tronco en la cintura, el tramo los incluye: el ancho de la cintura se dispara frente al de las articulaciones
  for (const [i, y] of [[15, yW], [16, yW], [15, yH], [16, yH]]) { const t = tramo(y), x = P(i)[0]; if (t && x > t[0] - 4 && x < t[1] + 4 && Math.abs(P(i)[1] - y) < Tr * .25) pegados.push(i); }
  if (pegados.length) aviso('brazos_pegados');
  // altura: de la coronilla (primera fila con silueta sobre la nariz) al tobillo; pierna: de la cadera al tobillo
  const xN = P(0)[0]; let yTop = P(0)[1]; while (yTop > 0 && persona(xN, yTop - 1)) yTop--;
  const yTob = (P(27)[1] + P(28)[1]) / 2, alto = pies ? yTob - yTop : Tr * 3.3, pierna = pies ? +((yTob - yC) / alto).toFixed(3) : null;
  if (prob.some(p => p.fatal)) return { ok: false, prob };
  const lin = (y, lim, piel) => { const t = tramo(y, lim, piel), u = tramo(y); return t && [Math.round(t[0]), Math.round(t[1]), Math.round(y), Math.round(u[0]), Math.round(u[1])]; };
  return { ok: true, prob, lineas: { W, H, pts: [hI, hD, cI, cD].map(q => q.map(Math.round)), hombros: lin(yHo, limS), cintura: lin(yW, limH, true), cadera: lin(yH, limH, true) }, medidas: { hombros: +(hombros / alto).toFixed(3), cintura: +(cintura / alto).toFixed(3), cadera: +(cadera / alto).toFixed(3), pierna, torso: +(Tr / alto).toFixed(3) },
    calidad: Math.max(.3, 1 - prob.length * .2) };
}

// silueta con cinta métrica (06/11, Gabriela: «te debe primero preguntar características físicas… y las fotos son para clasificar tu silueta»): con pecho, cintura y cadera
// en cm manda la cinta, que es más exacta que la foto; criterio FFIT for Apparel (Lee, Istook, Nam y Park, 2007), en cm, con los umbrales de Moda en diagnostico-reglas.json
export function siluetaCinta({ pecho: B, cintura: Wc, cadera: Hc }, R) {
  const u = R.silueta.cinta; let k;
  if (Wc >= u.ovalo * B && Wc >= u.ovalo * Hc) k = 'ovalo';
  else if (Math.abs(B - Hc) < u.dif && (B - Wc >= u.reloj_pecho || Hc - Wc >= u.reloj_cadera)) k = 'reloj';
  else if (Hc - B >= u.dif) k = 'triangulo';
  else if (B - Hc >= u.dif) k = 'invertido';
  else k = 'rectangulo';
  return { k, ratios: { pecho_cadera: +(B / Hc).toFixed(2), cintura_cadera: +(Wc / Hc).toFixed(2), cintura_pecho: +(Wc / B).toFixed(2) }, confianza: .9 };
}

// ---------- reglas de la Dirección de Moda ----------
let reglas = null;
export async function cargarReglas() { if (!reglas) reglas = await (await fetch(new URL('./diagnostico-reglas.json', import.meta.url))).json(); return reglas; }

// colorimetría: tres ejes (temperatura, valor, intensidad) de −1 a 1; la característica dominante decide la estación de las 12
export function estacion(cara, R, resp = {}) {
  const u = R.colorimetria.umbrales, cl = v => Math.max(-1, Math.min(1, v));
  const { piel, pelo, ojos, contraste } = cara;
  let t = cl((piel.h - u.piel_h_neutro) / u.piel_h_escala);
  // el pelo cobrizo, rojizo o dorado tiene mucho croma (cálido); el ceniza, poco (frío); el negro no cuenta para la temperatura
  if (pelo && pelo.L >= u.pelo_L_min) t = cl(t * (1 - u.pelo_peso) + cl((pelo.C - u.pelo_C_neutro) / u.pelo_C_escala) * u.pelo_peso);
  const extra = ['venas', 'metal'].reduce((a, k) => a + (resp[k] === 'c' ? .25 : resp[k] === 'f' ? -.25 : 0), 0); t = cl(t + extra); // las respuestas de Mis colores, si las hay, afinan
  // 06/11: el LEEME de Moda dice que «las 4 preguntas de Mis colores siguen sumando», pero solo sumaban venas y metal; ahora también tono (valor) y contraste (intensidad)
  const Lm = pelo ? piel.L * .5 + pelo.L * .5 : piel.L, v = cl((Lm - u.valor_L_medio) / u.valor_L_escala + (resp.tono === 'cl' ? .3 : resp.tono === 'os' ? -.3 : 0));
  const cOjo = ojos ? ojos.C : u.ojo_C_medio, i = cl(((contraste - u.contraste_medio) / u.contraste_escala) * .6 + ((cOjo - u.ojo_C_medio) / u.ojo_C_escala) * .4 + (resp.contraste === 'al' ? .3 : resp.contraste === 'ba' ? -.3 : 0));
  const ejes = { t: +t.toFixed(2), v: +v.toFixed(2), i: +i.toFixed(2) }, dom = Object.entries({ t: Math.abs(t), v: Math.abs(v), i: Math.abs(i) }).sort((a, b) => b[1] - a[1])[0][0];
  let k;
  if (dom === 't') k = t > 0 ? (v + i >= 0 ? 'primavera_calida' : 'otono_calido') : (v - i >= 0 ? 'verano_frio' : 'invierno_frio');
  else if (dom === 'v') k = v > 0 ? (t >= 0 ? 'primavera_clara' : 'verano_claro') : (t >= 0 ? 'otono_profundo' : 'invierno_profundo');
  else k = i > 0 ? (t >= 0 ? 'primavera_brillante' : 'invierno_brillante') : (t >= 0 ? 'otono_suave' : 'verano_suave');
  const margen = Math.max(Math.abs(t), Math.abs(v), Math.abs(i)) - [Math.abs(t), Math.abs(v), Math.abs(i)].sort((a, b) => b - a)[1];
  return { k, familia: k.split('_')[0], ejes, dominante: dom, confianza: +Math.min(1, (cara.calidad || 1) * (.55 + margen)).toFixed(2) };
}

// silueta: proporciones hombros / cintura / cadera de la silueta de frente
export function silueta(cuerpo, R) {
  const u = R.silueta.umbrales, { hombros: S, cintura: Wc, cadera: Hc, pierna } = cuerpo.medidas, sh = S / Hc, wh = Wc / Hc, ws = Wc / S;
  let k;
  if (wh >= u.ovalo_wh && ws >= u.ovalo_ws) k = 'ovalo';
  else if (sh >= u.invertido_sh) k = 'invertido';
  else if (sh <= u.triangulo_sh) k = 'triangulo';
  else k = wh <= u.reloj_wh ? 'reloj' : 'rectangulo';
  const prop = pierna == null ? null : pierna >= u.pierna_larga ? 'piernas_largas' : pierna <= u.pierna_corta ? 'torso_largo' : 'equilibrada';
  return { k, prop, ratios: { hombros_cadera: +sh.toFixed(2), cintura_cadera: +wh.toFixed(2), cintura_hombros: +ws.toFixed(2), pierna: pierna }, confianza: cuerpo.calidad };
}
