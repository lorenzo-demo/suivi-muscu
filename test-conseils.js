/* Tests headless — un conseil d'évolution sur CHAQUE exercice ayant un historique. */
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

console.log("A — Chaque type d'exercice reçoit un conseil");
{
  const w = boot();
  w.__dbg.S.bodyweight = 78;
  const p = w.createProgram("Conseils"); const s = w.addSessionTo(p.id, "S");
  const exos = {
    charge:  w.makeExoFromDb("tiragev", "lb15"),
    pdc:     w.makeExoFromDb("crunch", "pdc"),
    pdcTime: w.makeExoFromDb("planche", "pdc"),
    assist:  w.makeExoFromDb("tractions", "assist"),
    sante:   w.makeExoFromDb("facepull", "lb"),
    barre:   w.makeExoFromDb("squat", "barre", { incr: 2.5 })
  };
  Object.values(exos).forEach(e => w.addExoToSession(p.id, s.id, e));
  // Une séance "normale" : milieu de fourchette, ressenti correct
  const entries = {}, units = {};
  Object.entries(exos).forEach(([k, e]) => {
    const [lo, hi] = w.parseRange(w.targetRange(e, "hyp"));
    const r = Math.round((lo + hi) / 2);
    const poids = e.type === "pdc" ? 0 : e.type === "assist" ? 27 : 45;
    entries[e.id] = [{ w: poids, r }, { w: poids, r }, { w: poids, r }];
    units[e.id] = w.exoUnit(e, "hyp");
  });
  w.__dbg.S.logs.push({ id: 1, date: "2026-08-01T10:00:00.000Z", sessionId: s.id, bloc: "hyp", entries, units });

  Object.entries(exos).forEach(([k, e]) => {
    const rec = w.recommend(e, "hyp");
    check(k + " : recommandation produite", !!rec);
    check(k + " : conseil non vide", !!(rec && rec.conseil && rec.conseil.trim().length > 10),
          rec && String(rec.conseil));
  });

  // Le conseil apparaît bien à l'écran, sur chaque carte
  w.activateProgram(p.id);
  const cards = [...w.document.querySelectorAll("#exoList .exo")];
  check("6 cartes d'exercice affichées", cards.length === 6, "obtenu : " + cards.length);
  const sansConseil = cards.filter(c => !c.querySelector(".exo-advice"))
                           .map(c => c.textContent.slice(0, 25));
  check("aucune carte sans bandeau de conseil", sansConseil.length === 0, sansConseil.join(" | "));
}

console.log("B — Le conseil décrit l'évolution par rapport à la dernière fois");
{
  const w = boot();
  const p = w.createProgram("Evolution"); const s = w.addSessionTo(p.id, "S");
  const tir = w.makeExoFromDb("tiragev", "lb15");
  w.addExoToSession(p.id, s.id, tir);
  const log = (id, d, poids, reps) => w.__dbg.S.logs.push({ id, date:`2026-08-0${d}T10:00:00.000Z`,
    sessionId:s.id, bloc:"hyp", entries:{ [tir.id]: reps.map(r => ({ w: poids, r })) } });

  // Milieu de fourchette -> +1 rep, en rappelant la séance précédente
  log(1, 1, 45, [10, 10, 9]);
  let rec = w.recommend(tir, "hyp");
  check("progression en reps : rappelle la dernière séance", /dernière fois/.test(rec.conseil), rec.conseil);
  check("progression en reps : mentionne la charge", /45 kg/.test(rec.conseil), rec.conseil);

  // Toutes les séries au plafond -> montée de charge chiffrée
  w.__dbg.S.logs = []; log(2, 3, 45, [12, 12, 12]);
  rec = w.recommend(tir, "hyp");
  check("montée de charge : conseil explicite", /monte|montée/i.test(rec.conseil), rec.conseil);

  // Ressenti facile -> montée franche annoncée
  w.__dbg.S.logs = []; log(3, 5, 45, [12, 12, 12]);
  w.__dbg.S.logs[0].effort = { [tir.id]: "facile" };
  rec = w.recommend(tir, "hyp");
  check("ressenti facile : conseil dédié", /facile/.test(rec.conseil), rec.conseil);

  // Poids du corps : nombre de reps ajoutées explicite
  const cr = w.makeExoFromDb("crunch", "pdc");
  w.addExoToSession(p.id, s.id, cr);
  w.__dbg.S.logs = [];
  w.__dbg.S.logs.push({ id: 9, date: "2026-08-06T10:00:00.000Z", sessionId: s.id, bloc: "hyp",
    entries: { [cr.id]: [{ w: 0, r: 27 }, { w: 0, r: 27 }] }, units: { [cr.id]: "reps" } });
  rec = w.recommend(cr, "hyp");
  check("poids du corps : indique l'ajout de reps", /ajoute 1 rep/.test(rec.conseil), rec.conseil);
  check("poids du corps : rappelle la dernière séance", /27/.test(rec.conseil), rec.conseil);

  // Mode temps : l'unité suit
  w.setExoUnit(cr, "sec");
  w.__dbg.S.logs = [];
  w.__dbg.S.logs.push({ id: 10, date: "2026-08-06T11:00:00.000Z", sessionId: s.id, bloc: "hyp",
    entries: { [cr.id]: [{ w: 0, r: 80 }, { w: 0, r: 80 }] }, units: { [cr.id]: "sec" } });
  rec = w.recommend(cr, "hyp");
  check("mode temps : conseil en secondes", / sec/.test(rec.conseil), rec.conseil);
}

console.log("C — Non-régression : conseils existants inchangés");
{
  const w = boot();
  const p = w.createProgram("Regression"); const s = w.addSessionTo(p.id, "S");
  const dm = w.makeExoFromDb("devmilitaire", "dbPair");
  w.addExoToSession(p.id, s.id, dm);
  const log = (id, d, reps) => w.__dbg.S.logs.push({ id, date:`2026-08-0${d}T10:00:00.000Z`,
    sessionId:s.id, bloc:"hyp", entries:{ [dm.id]: reps.map(r => ({ w: 28, r })) } });
  log(1, 1, [7, 6, 7]);
  check("raté marginal : consolidation", /consolide/.test(w.recommend(dm, "hyp").conseil));
  log(2, 3, [7, 7, 6]);
  check("récidive : descente annoncée", /2 séances de suite/.test(w.recommend(dm, "hyp").conseil));
  check("aucune erreur fatale", !w.document.getElementById("bootError") && w.__bootOk === true);
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
