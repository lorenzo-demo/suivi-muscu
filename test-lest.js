/* Tests headless — lest conservé sur les exercices au poids du corps. */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "pwa-builder/index.html"), "utf8");

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? " — " + extra : "")); }
}
function boot(preSeed = {}) {
  return new JSDOM(html, {
    runScripts: "dangerously", url: "https://example.com/pwa-builder/index.html",
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => ({
        fillText(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
        set fillStyle(v){}, set font(v){}, set strokeStyle(v){}, set lineWidth(v){}, set lineJoin(v){}
      });
      window.confirm = () => true;
      for (const [k, v] of Object.entries(preSeed)) window.localStorage.setItem(k, v);
    }
  }).window;
}
const sessOf = (w, id) => w.__dbg.S.programs[0].sessions.find(s => s.exos.some(e => e.id === id));
function logSets(w, exoId, date, bloc, sets, extra = {}) {
  w.__dbg.S.logs.unshift({ id: Date.parse(date), date, sessionId: sessOf(w, exoId).id, bloc,
    entries: { [exoId]: sets }, ...extra });
}

console.log("A — Le cas signalé : extension lombaire lestée à 10 kg");
{
  const w = boot();
  const lomb = w.allUniqueExos().find(e => e.id === "lomb");
  logSets(w, "lomb", "2026-08-01T10:00:00.000Z", "hyp", [{w:10,r:18},{w:10,r:18},{w:10,r:17}]);
  const rec = w.recommend(lomb, "hyp");
  check("lest conservé (10 kg, plus de remise à 0)", rec.w === 10, String(rec.w));
  check("progression en reps maintenue", rec.targets[0] === 19, rec.targets.join(","));
  check("conseil mentionne le lest", /avec 10 kg/.test(rec.conseil), rec.conseil);
  // Séance suivante, lest augmenté à la main : l'app suit
  logSets(w, "lomb", "2026-08-04T10:00:00.000Z", "hyp", [{w:12,r:16},{w:12,r:16},{w:12,r:15}]);
  const rec2 = w.recommend(lomb, "hyp");
  check("lest augmenté par l'utilisateur : suivi", rec2.w === 12, String(rec2.w));
}

console.log("B — Sans lest, rien ne change");
{
  const w = boot();
  const cr = w.allUniqueExos().find(e => e.id === "crunch");
  logSets(w, "crunch", "2026-08-01T10:00:00.000Z", "hyp", [{w:0,r:27},{w:0,r:27}]);
  const rec = w.recommend(cr, "hyp");
  check("poids du corps strict : reste à 0", rec.w === 0, String(rec.w));
  check("conseil sans mention de lest", !/avec .* kg/.test(rec.conseil), rec.conseil);
  check("progression en reps inchangée", rec.targets[0] === 28, rec.targets.join(","));
}

console.log("C — Ressentis et mode temps");
{
  const w = boot();
  const lomb = w.allUniqueExos().find(e => e.id === "lomb");
  logSets(w, "lomb", "2026-08-01T10:00:00.000Z", "hyp", [{w:10,r:18},{w:10,r:18}],
          { effort: { lomb: "limite" } });
  const rec = w.recommend(lomb, "hyp");
  check("ressenti limite : lest conservé, reps inchangées", rec.w === 10 && rec.targets[0] === 18,
        rec.w + " / " + rec.targets.join(","));
  check("conseil de consolidation avec lest", /consolide/.test(rec.conseil) && /10 kg/.test(rec.conseil), rec.conseil);
  // Ressenti facile : +2 reps, lest inchangé
  const w2 = boot();
  const l2 = w2.allUniqueExos().find(e => e.id === "lomb");
  logSets(w2, "lomb", "2026-08-01T10:00:00.000Z", "hyp", [{w:10,r:18},{w:10,r:18}],
          { effort: { lomb: "facile" } });
  const rec2 = w2.recommend(l2, "hyp");
  check("ressenti facile : +2 reps, lest gardé", rec2.w === 10 && rec2.targets[0] === 20,
        rec2.w + " / " + rec2.targets.join(","));
  // Mode temps avec lest (planche lestée)
  const w3 = boot();
  const pl = w3.allUniqueExos().find(e => e.id === "planche");
  logSets(w3, "planche", "2026-08-01T10:00:00.000Z", "hyp", [{w:5,r:100},{w:5,r:100}],
          { units: { planche: "sec" } });
  const rec3 = w3.recommend(pl, "hyp");
  check("mode temps : lest conservé et +5 sec", rec3.w === 5 && rec3.targets[0] === 105,
        rec3.w + " / " + rec3.targets.join(","));
}

console.log("D — Affichage en séance");
{
  const w = boot();
  w.__dbg.S.bodyweight = 78;
  const lomb = w.allUniqueExos().find(e => e.id === "lomb");
  logSets(w, "lomb", "2026-08-01T10:00:00.000Z", "hyp", [{w:10,r:18},{w:10,r:18},{w:10,r:17}]);
  // Ouvrir la séance qui contient l'extension lombaire
  const idx = w.__dbg.S.programs[0].sessions.findIndex(s => s.exos.some(e => e.id === "lomb"));
  [...w.document.querySelectorAll("#seanceSeg button")][idx].click();
  const entries = w.__dbg.cur.entries[lomb.id];
  check("séries préremplies avec le lest", entries.every(s => s.w === 10),
        JSON.stringify(entries));
  // Sans aucun historique : champ à 0, pas de valeur inventée
  const w2 = boot();
  const idx2 = w2.__dbg.S.programs[0].sessions.findIndex(s => s.exos.some(e => e.id === "lomb"));
  [...w2.document.querySelectorAll("#seanceSeg button")][idx2].click();
  const l2 = w2.allUniqueExos().find(e => e.id === "lomb");
  check("aucun historique : lest à 0", w2.__dbg.cur.entries[l2.id].every(s => s.w === 0));
}

console.log("E — Non-régression du 1RM");
{
  const w = boot();
  const lomb = w.allUniqueExos().find(e => e.id === "lomb");
  logSets(w, "lomb", "2026-08-01T10:00:00.000Z", "hyp", [{w:10,r:12},{w:10,r:12}]);
  w.recomputeRms();
  check("exercice pdc : toujours exclu du calcul de 1RM", !w.__dbg.S.oneRmOverride.lomb,
        String(w.__dbg.S.oneRmOverride.lomb));
  check("aucune erreur fatale", w.__bootOk === true && !w.document.getElementById("bootError"));
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
