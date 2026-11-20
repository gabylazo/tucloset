// motor-worker.js — 20/11/2026 (Gabriela, panel: «la app está lenta y los botones no están funcionando»): el motor de looks en segundo plano.
// Con un clóset grande un cálculo bloquea el móvil uno o dos segundos; aquí corre aparte y la pantalla sigue respondiendo. at.js le manda las mismas
// opciones que a Motor.looks y guarda lo que vuelve en su caché (pedirMotor); si esto falla, at.js calcula como antes.
const v = new URL(location.href).searchParams.get('v') || '';
importScripts('motor-datos.js?v=' + v, 'motor.js?v=' + v);
onmessage = e => { const { id, o } = e.data || {}; try { postMessage({ id, r: Motor.looks(o) }); } catch (err) { postMessage({ id, error: String(err && err.message || err) }); } };
