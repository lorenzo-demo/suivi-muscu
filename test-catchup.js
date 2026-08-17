/* Tests headless — rattrapage automatique vers la zone du bloc. */
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

// Reconstitue le cas réel : presse à cuisse, séries de 10 reps à 200 kg (1RM estimé ~260),
// charge de travail restée à 200 alors que la zone Force en justifie ~226.
function setupPresse(w, { blocs = ["hyp","hyp","force"], poids = 200, reps = 10 } = {}) {
  const presse = w.allUniqueExos().find(e => e.id === "presse");
  const sess = w.__dbg.S.programs[0].sessions[0];
  blocs.forEach((b, i) => {
    w.__dbg.S.logs.push({ id: i+1, date: `2026-08-0${i+1}T10:00:00.000Z`, sessionId: sess.id, bloc: b,
      entries: { presse: [{ w: poids, r: reps }, { w: poids, r: reps }, { w: poids, r: reps }] } });
  });
  w.recomputeRms();
  return presse;
}

console.log("A — Le cas signalé : charge décrochée de la zone Force");
{
  const w = boot();
  const presse = setupPresse(w);
  const rm = w.smoothedRm(presse);
  check("1RM estimé cohérent (~260)", rm > 250 && rm < 275, String(rm));
  const zoneForce = rm * 0.85;
  check("zone Force ~226", zoneForce > 215 && zoneForce < 235, String(Math.round(zoneForce)));
  const rec = w.recommend(presse, "force");
  check("rattrapage déclenché : charge > 200", rec && rec.w > 200, rec && String(rec.w));
  check("borné à +10 % (≤ 220)", rec.w <= 220 + 1e-9, String(rec.w));
  check("conseil explique le rattrapage", /rattrapage progressif/.test(rec.conseil), rec.conseil);
  check("conseil cite la zone et la charge actuelle", /zone Force/.test(rec.conseil) && /200/.test(rec.conseil), rec.conseil);
  check("cibles dans la fourchette Force", rec.targets.every(r => r >= 5 && r <= 6), rec.targets.join(","));
  // Hypertrophie : la zone est à 75 % (~195), proche de 200 -> pas de rattrapage
  const recH = w.recommend(presse, "hyp");
  check("hypertrophie : pas de rattrapage inutile", !/rattrapage/.test(recH.conseil || ""), recH.conseil);
}

console.log("B — Convergence en deux séances");
{
  const w = boot();
  const presse = setupPresse(w);
  const r1 = w.recommend(presse, "force");
  // On simule la séance faite à la charge proposée, dans la fourchette
  const sess = w.__dbg.S.programs[0].sessions[0];
  w.__dbg.S.logs.unshift({ id: 99, date: "2026-08-10T10:00:00.000Z", sessionId: sess.id, bloc: "force",
    entries: { presse: r1.targets.map(r => ({ w: r1.w, r })) } });
  w.recomputeRms();
  const r2 = w.recommend(presse, "force");
  check("2e séance : on progresse encore vers la zone", r2.w >= r1.w, r1.w + " -> " + r2.w);
  const zone = w.smoothedRm(presse) * 0.85;
  check("on ne dépasse jamais la zone théorique", r2.w <= zone + 1e-9, r2.w + " vs zone " + Math.round(zone));
}

console.log("C — Les ressentis gardent la priorité");
{
  // "limite" -> consolidation, pas de rattrapage
  const w1 = boot();
  const p1 = setupPresse(w1);
  const lastForce1 = w1.__dbg.S.logs.filter(l => l.bloc === "force").sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  lastForce1.effort = { presse: "limite" };
  const recL = w1.recommend(p1, "force");
  check("limite : consolidation au même poids", recL.w === 200, String(recL.w));
  check("limite : aucun rattrapage", !/rattrapage/.test(recL.conseil || ""), recL.conseil);
  // "facile" -> rattrapage complet (non borné à +10 %), prioritaire
  const w2 = boot();
  const p2 = setupPresse(w2);
  const lastForce2 = w2.__dbg.S.logs.filter(l => l.bloc === "force").sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  lastForce2.effort = { presse: "facile" };
  const recF = w2.recommend(p2, "force");
  check("facile : montée franche", recF.w > 200, String(recF.w));
  check("facile : conseil dédié conservé", /facile/.test(recF.conseil), recF.conseil);
  // Échec sous le plancher -> consolidation, jamais de rattrapage
  const w3 = boot();
  const p3 = setupPresse(w3, { blocs:["hyp","hyp","force"], poids:200, reps:10 });
  w3.__dbg.S.logs.unshift({ id: 50, date: "2026-08-09T10:00:00.000Z", sessionId: w3.__dbg.S.programs[0].sessions[0].id,
    bloc: "force", entries: { presse: [{ w:200, r:4 }, { w:200, r:4 }, { w:200, r:3 }] } });
  const recE = w3.recommend(p3, "force");
  check("échec : pas de rattrapage", !/rattrapage/.test(recE.conseil || ""), recE.conseil);
  check("échec : la charge ne monte pas", recE.w <= 200, String(recE.w));
}

console.log("D — Garde-fous");
{
  // Moins de 3 séances : phase de tâtonnement, pas de rattrapage
  const w = boot();
  const presse = setupPresse(w, { blocs:["force","force"] });
  const rec = w.recommend(presse, "force");
  check("2 séances seulement : pas de rattrapage", !/rattrapage/.test(rec.conseil || ""), rec.conseil);
  // Écart faible (< 7 %) : la double progression suffit
  const w2 = boot();
  const p2 = setupPresse(w2, { blocs:["hyp","hyp","force"], poids:220, reps:6 });
  const rec2 = w2.recommend(p2, "force");
  const zone2 = w2.smoothedRm(p2) * 0.85;
  check("écart faible : pas de rattrapage", zone2 <= 220 * 1.07 ? !/rattrapage/.test(rec2.conseil || "") : true,
        "zone " + Math.round(zone2) + " vs 220 · " + rec2.conseil);
  // Exercice "santé" : jamais concerné
  const w3 = boot();
  const fp = w3.allUniqueExos().find(e => e.id === "facepull");
  const sess = w3.__dbg.S.programs[0].sessions[2];
  [1,2,3].forEach(i => w3.__dbg.S.logs.push({ id:i, date:`2026-08-0${i}T10:00:00.000Z`, sessionId:sess.id, bloc:"force",
    entries:{ facepull: [{w:20,r:14},{w:20,r:14}] } }));
  const rec3 = w3.recommend(fp, "force");
  check("face pull : jamais de rattrapage", !/rattrapage/.test(rec3.conseil || ""), rec3.conseil);
}

console.log("E — Réglage de désactivation");
{
  const w = boot();
  const presse = setupPresse(w);
  check("activé par défaut", w.__dbg.S.autoCatchup !== false);
  w.document.querySelector('nav button[data-scr="reglages"]').click();
  const tog = w.document.getElementById("catchupToggle");
  check("case présente et cochée", tog && tog.checked === true);
  tog.checked = false;
  tog.dispatchEvent(new w.Event("change", { bubbles:true }));
  check("désactivation enregistrée", w.__dbg.S.autoCatchup === false);
  const rec = w.recommend(presse, "force");
  check("désactivé : plus de rattrapage", !/rattrapage/.test(rec.conseil || ""), rec.conseil);
  // Sans rattrapage, 10 reps sur une fourchette 5-6 relèvent du "dépassement massif" :
  // la charge monte quand même, mais par la règle classique (bornée à +10 %), pas par le rattrapage.
  check("désactivé : la montée classique reste active", rec.w > 200 && /monte|montée|marge/i.test(rec.conseil), rec.w + " · " + rec.conseil);
  // Le réglage survit au rechargement
  w.save();
  const w2 = boot({ "suiviMuscuBuilder.v1": w.localStorage.getItem("suiviMuscuBuilder.v1") });
  check("réglage persisté", w2.__dbg.S.autoCatchup === false);
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
