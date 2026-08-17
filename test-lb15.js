/* Tests headless (jsdom) — séparation des colonnes 15 lb + non-régression du moteur. */
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

console.log("A — Deux tables 15 lb distinctes");
{
  const w = boot();
  check("app démarrée", w.__bootOk === true);
  const R = w.__dbg.RACKS.lb15, F = w.__dbg.RACKS.lb15f;
  check("lb15 : 60 paliers (2 appoints de 2,3)", R.length === 60, "obtenu : " + R.length);
  check("lb15f : 120 paliers (appoints fins)", F.length === 120, "obtenu : " + F.length);
  check("lb15 SANS le petit poids de 1,1", !R.includes(46.1) && !R.includes(40.1));
  check("lb15f AVEC le petit poids de 1,1", F.includes(46.1) && F.includes(40.1));
  check("mêmes plaques de base", [4.5, 11, 45, 134].every(v => R.includes(v) && F.includes(v)));
  check("lb15 strictement croissante", R.every((v,i) => i===0 || v > R[i-1]));
  check("lb15f strictement croissante", F.every((v,i) => i===0 || v > F[i-1]));
  check("lb15 max = 134 + 4,6", R[R.length-1] === 138.6, String(R[R.length-1]));
  check("lb15f max = 134 + 5,7", F[F.length-1] === 139.7, String(F[F.length-1]));
  check("table lb (10 lb) intacte", w.__dbg.RACKS.lb.length === 40);
}

console.log("B — Progression réelle sur chaque colonne");
{
  const w = boot();
  const tir = w.makeExoFromDb("tiragev", "lb15");
  const ext = w.makeExoFromDb("legext", "lb15f");
  check("tirage : cran suivant après 45 = 47,3", w.nextWeight(tir, 45) === 47.3, String(w.nextWeight(tir, 45)));
  check("cuisses : cran suivant après 45 = 46,1", w.nextWeight(ext, 45) === 46.1, String(w.nextWeight(ext, 45)));
  check("tirage : cran précédent avant 45 = 43,6", w.prevWeight(tir, 45) === 43.6, String(w.prevWeight(tir, 45)));
  check("cuisses : cran précédent avant 45 = 44,7", w.prevWeight(ext, 45) === 44.7, String(w.prevWeight(ext, 45)));
  check("snap tirage sur palier réel", w.__dbg.RACKS.lb15.includes(w.snapWeight(tir, 46)), String(w.snapWeight(tir, 46)));
  check("snap cuisses sur palier réel", w.__dbg.RACKS.lb15f.includes(w.snapWeight(ext, 46)), String(w.snapWeight(ext, 46)));
  check("ids distincts entre les deux colonnes", tir.id !== w.makeExoFromDb("tiragev", "lb15f").id);
}

console.log("C — Programme par défaut (seed v11)");
{
  const w = boot();
  const rack = id => w.allUniqueExos().find(e => e.id === id).rack;
  check("extension jambes sur appoints fins", rack("extj") === "lb15f");
  check("flexion jambes sur appoints fins", rack("flexj") === "lb15f");
  check("tirage vertical sans appoint fin", rack("tirv") === "lb15");
  check("tirage horizontal sans appoint fin", rack("tirh") === "lb15");
  check("machine assistée toujours en 10 lb", w.allUniqueExos().find(e => e.id === "tractions").rack === "lb");
  check("SEED_VERSION 11", w.__dbg.S.programs[0].seedVersion === 11);
}

console.log("D — Migration : historique et 1RM préservés");
{
  const st = { schemaVersion:2, bodyweight:78, cycleStart:"2026-07-01",
    logs:[{ id:1, date:"2026-07-10T10:00:00.000Z", sessionId:"s1", bloc:"hyp",
            entries:{ extj:[{w:45,r:12},{w:45,r:11}] } }],
    restPref:{ "extj.hyp":80 }, oneRmOverride:{ extj:63.4 }, draft:null,
    programs:[{ id:"defaut", name:"Programme par défaut", sessions:[], seedVersion:10, sessionsPerWeek:3 }],
    activeProgramId:"defaut" };
  const w = boot({ "suiviMuscuBuilder.v1": JSON.stringify(st) });
  const S = JSON.parse(w.localStorage.getItem("suiviMuscuBuilder.v1"));
  check("reseed appliqué", S.programs[0].seedVersion === 11 && S.programs[0].sessions.length === 3);
  check("historique conservé", S.logs.length === 1 && S.logs[0].entries.extj.length === 2);
  check("1RM conservé", S.oneRmOverride.extj === 63.4);
  check("repos personnalisé conservé", S.restPref["extj.hyp"] === 80);
  const ext = w.allUniqueExos().find(e => e.id === "extj");
  const rec = w.recommend(ext, "hyp");
  check("recommandation sur un palier réel de la colonne fine",
        !rec || w.__dbg.RACKS.lb15f.includes(rec.w), JSON.stringify(rec).slice(0, 60));
}

console.log("E — Sélecteur : quatre graduations proposées");
{
  const w = boot();
  const p = w.createProgram("Test"); const s = w.addSessionTo(p.id, "S");
  w.document.querySelector('nav button[data-scr="reglages"]').click();
  w.document.getElementById("openBuilderBtn").click();
  w.document.querySelector("#bProgList .b-row:not(.locked) .b-edit").click();
  w.document.querySelector("#bSessList .b-edit").click();
  w.document.getElementById("bAddExo").click();
  w.document.getElementById("pkMuscle").value = "quads";
  w.document.getElementById("pkMuscle").dispatchEvent(new w.Event("change", { bubbles:true }));
  [...w.document.querySelectorAll("#pkList .b-row")].find(r => r.textContent.includes("Extension jambes")).click();
  w.document.querySelector('#pkMats .pill[data-mat="lb"]').click();
  const machs = [...w.document.querySelectorAll("#pkMachPills .pill")].map(b => b.dataset.mach);
  check("4 graduations : 10 lb, 15 lb, 15 lb fin, kg",
        machs.join(",") === "lb,lb15,lb15f,kgmach", machs.join(","));
  w.document.querySelector('#pkMachPills .pill[data-mach="lb15f"]').click();
  w.document.getElementById("pkAdd").click();
  check("exercice ajouté sur la colonne à appoints fins", s.exos.length === 1 && s.exos[0].rack === "lb15f",
        s.exos[0] && s.exos[0].rack);
}

console.log("F — Non-régression générale");
{
  const w = boot();
  check("64 paliers d'haltères et machines inchangés",
        w.__dbg.RACKS.dbPair.length === 30 && w.__dbg.RACKS.dbSingle.length === 30);
  check("base à 76 mouvements", w.__dbg.EXODB.length === 76, String(w.__dbg.EXODB.length));
  check("assistant fonctionnel", w.buildWizardProgram({ level:"inter", days:3, style:"libre" }).sessions.length === 3);
  const prog = w.__dbg.S.programs[0];
  check("volume seed cohérent", w.weeklyVolumeByMuscle(prog).pecs === 15, String(w.weeklyVolumeByMuscle(prog).pecs));
  check("aucune erreur fatale à l'écran", !w.document.getElementById("bootError"));
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
