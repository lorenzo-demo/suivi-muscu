/* Tests headless — modèles de programmes (copie dans les programmes de l'utilisateur). */
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

console.log("A — Structure du modèle Reprise Full body A/B");
{
  const w = boot();
  const p = w.buildModelProgram("reprise_fb_ab");
  check("programme construit", !!p);
  check("2 séances", p.sessions.length === 2);
  check("rythme 2 séances/semaine", p.sessionsPerWeek === 2);
  check("7 exercices par séance", p.sessions.every(s => s.exos.length === 7),
        p.sessions.map(s => s.exos.length).join("/"));
  const all = p.sessions.flatMap(s => s.exos);
  check("tous les exercices sont valides", all.every(e => e && e.id && e.t && e.t.hyp));
  check("aucun exercice commun aux deux séances",
        new Set(all.map(e => e.id)).size === all.length);
  // Contraintes demandées : matériel guidé, pas de soulevé de terre ni de squat barre
  const lev = e => w.dbEntryForExo(e.id)?.lev || 2;
  check("aucun exercice de niveau exigeant", all.every(e => lev(e) <= 2),
        all.filter(e => lev(e) > 2).map(e => e.name).join(","));
  check("pas de soulevé de terre", !all.some(e => /sdt|deadlift/.test(e.id)));
  check("pas de squat barre", !all.some(e => e.id === "db_squat_barre"));
  check("gainage en fin de chaque séance",
        p.sessions.every(s => w.orderGroup(s.exos[s.exos.length-1]) === 2));
  check("ordre conseillé respecté", p.sessions.every(s => w.analyzeOrder(s).length === 0),
        p.sessions.flatMap(s => w.analyzeOrder(s)).join(" | "));
}

console.log("B — Couverture musculaire");
{
  const w = boot();
  const p = w.buildModelProgram("reprise_fb_ab");
  const vol = w.weeklyVolumeByMuscle(p);
  const grosGroupes = ["quads","fessiers","ischios","pecs","dosL","dosE","deltA","biceps","triceps","abdos","mollets"];
  check("tous les grands groupes sont sollicités",
        grosGroupes.every(m => (vol[m] || 0) > 0),
        grosGroupes.filter(m => !(vol[m] > 0)).join(","));
  check("dominante quadriceps/poussée en A",
        w.sessionVolumeByMuscle(p.sessions[0]).quads > 0 && w.sessionVolumeByMuscle(p.sessions[0]).pecs > 0);
  check("dominante fessiers/tirage en B",
        w.sessionVolumeByMuscle(p.sessions[1]).fessiers > 0 && w.sessionVolumeByMuscle(p.sessions[1]).dosE > 0);
  check("volume total raisonnable pour une reprise",
        Object.values(vol).every(v => v <= 20), JSON.stringify(vol));
}

console.log("C — Le modèle est une COPIE modifiable");
{
  const w = boot();
  const before = w.__dbg.S.programs.length;
  w.document.querySelector('nav button[data-scr="reglages"]').click();
  w.document.getElementById("openBuilderBtn").click();
  w.document.getElementById("bModelsBtn").click();
  check("écran des modèles", w.document.getElementById("builderBody").textContent.includes("Modèles"));
  check("aperçu des séances affiché",
        w.document.getElementById("builderBody").textContent.includes("Full body A"));
  w.document.querySelector('.btn[data-model="reprise_fb_ab"]').click();
  check("programme ajouté", w.__dbg.S.programs.length === before + 1);
  check("éditeur ouvert sur le nouveau programme", !!w.document.getElementById("bProgName"));
  const p = w.__dbg.S.programs[w.__dbg.S.programs.length-1];
  check("modifiable (pas verrouillé comme le programme par défaut)",
        p.id !== "defaut" && w.addSessionTo(p.id, "Test") !== null);
  check("suppression possible", w.deleteProgram(p.id) === true);
  // Deux créations donnent deux programmes indépendants
  const a = w.buildModelProgram("reprise_fb_ab"), b = w.buildModelProgram("reprise_fb_ab");
  check("ids de programme distincts", a.id !== b.id);
  check("ids de séance distincts", a.sessions[0].id !== b.sessions[0].id);
  check("mais mêmes ids d'exercice (1RM partagé)", a.sessions[0].exos[0].id === b.sessions[0].exos[0].id);
}

console.log("D — Utilisable immédiatement");
{
  const w = boot();
  w.__dbg.S.bodyweight = 78;
  const p = w.buildModelProgram("reprise_fb_ab");
  w.__dbg.S.programs.push(p);
  w.activateProgram(p.id);
  check("séance affichée", w.document.getElementById("seanceSeg").textContent.includes("Full body A"));
  check("cartes d'exercice construites", w.document.querySelectorAll("#exoList .exo").length === 7);
  // Enregistrer une séance : le moteur prend le relais
  const presse = p.sessions[0].exos[0];
  w.__dbg.cur.entries[presse.id] = [{w:80,r:10,done:true},{w:80,r:10,done:true},{w:80,r:9,done:true}];
  w.document.getElementById("finishBtn").click();
  check("séance enregistrée", w.__dbg.S.logs.length === 1);
  check("1RM estimé sur l'exercice du modèle", w.__dbg.S.oneRmOverride[presse.id] > 80,
        String(w.__dbg.S.oneRmOverride[presse.id]));
  const rec = w.recommend(presse, "hyp");
  check("recommandation produite", !!rec && rec.w > 0);
  check("charge sur un palier réel (ou maintien à la charge actuelle)",
        w.__dbg.RACKS.lb.includes(rec.w) || rec.w === 80, String(rec.w));
}

console.log("E — Non-régression");
{
  const w = boot();
  check("programme par défaut intact", w.__dbg.S.programs[0].sessions.length === 3);
  check("assistant toujours fonctionnel",
        w.buildWizardProgram({ level:"reprise", days:3 }).sessions.length >= 1);
  check("aucune erreur fatale", w.__bootOk === true && !w.document.getElementById("bootError"));
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
