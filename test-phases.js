/* Tests headless — durée des phases réglable par programme. */
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
// n séances enregistrées pour faire avancer le cycle
function logSessions(w, n, sessionId) {
  for (let i = 0; i < n; i++)
    w.__dbg.S.logs.push({ id: i+1, date: new Date(2026, 7, 1 + i).toISOString(),
      sessionId, bloc: "hyp", entries: { presse: [{ w: 100, r: 10 }] } });
}

console.log("A — Conversion phases ⇄ plan");
{
  const w = boot();
  check("défaut 2/2/2", JSON.stringify(w.phasesOf(w.activeProgram())) === '{"hyp":2,"force":2,"end":2}');
  check("longueur de cycle par défaut : 6", w.cycleLength() === 6);
  check("plan 3/3/2 = 8 semaines",
        w.planFromPhases({hyp:3,force:3,end:2}).join(",") === "hyp,hyp,hyp,force,force,force,end,end");
  check("ordre Hyp → Force → End respecté",
        w.planFromPhases({hyp:1,force:1,end:1}).join(",") === "hyp,force,end");
  check("phase à 0 : bloc absent du cycle",
        w.planFromPhases({hyp:2,force:0,end:2}).join(",") === "hyp,hyp,end,end");
  check("plan vide : retour au défaut", w.planFromPhases({hyp:0,force:0,end:0}).length === 6);
  check("aller-retour phases → plan → phases",
        JSON.stringify(w.phasesOf({ cyclePlan: w.planFromPhases({hyp:4,force:1,end:3}) }))
        === '{"hyp":4,"force":1,"end":3}');
}

console.log("B — Le cycle suit la longueur réglée");
{
  const w = boot();
  w.__dbg.S.bodyweight = 78;
  w.__dbg.S.cycleStart = "2026-08-01";
  const p = w.activeProgram();
  const sess = p.sessions[0].id;
  p.cyclePlan = w.planFromPhases({ hyp:3, force:3, end:2 }); // cycle de 8 semaines, 3 séances/sem
  logSessions(w, 9, sess); // 9 séances = 3 semaines révolues -> semaine 4
  check("longueur = 8", w.cycleLength() === 8);
  check("semaine 4 (9 séances / 3 par semaine)", w.weekOfCycle() === 4, String(w.weekOfCycle()));
  check("semaine 4 → bloc Force (phase Hyp = 3 semaines)", w.suggestedBloc() === "force", w.suggestedBloc());
  logSessions(w, 9, sess); // 18 séances -> semaine 7
  check("semaine 7 → Endurance", w.weekOfCycle() === 7 && w.suggestedBloc() === "end",
        w.weekOfCycle() + "/" + w.suggestedBloc());
  logSessions(w, 6, sess); // 24 séances = 8 semaines révolues -> retour semaine 1
  check("bouclage sur 8 semaines", w.weekOfCycle() === 1 && w.suggestedBloc() === "hyp",
        w.weekOfCycle() + "/" + w.suggestedBloc());
  w.renderSeance(); // le bandeau n'affiche la semaine qu'une fois poids et date réglés
  check("affichage Semaine x/8",
        w.document.getElementById("cycleInfo").textContent.includes("/8"),
        w.document.getElementById("cycleInfo").textContent);
}

console.log("C — Réglage par programme, et non global");
{
  const w = boot();
  const p2 = w.createProgram("Perso");
  w.addSessionTo(p2.id, "S");
  p2.cyclePlan = w.planFromPhases({ hyp:4, force:0, end:2 }); // sans bloc Force
  check("programme par défaut inchangé", w.cycleLength(w.__dbg.S.programs[0]) === 6);
  check("programme perso à 6 semaines sans Force",
        w.cycleLength(p2) === 6 && !w.cyclePlanOf(p2).includes("force"));
  w.activateProgram(p2.id);
  const chips = [...w.document.querySelectorAll("#blocSeg button")].map(b => b.textContent);
  check("puce Force retirée du sélecteur", !chips.some(t => /Force/.test(t)), chips.join("|"));
  w.activateProgram("defaut");
  const chips2 = [...w.document.querySelectorAll("#blocSeg button")].map(b => b.textContent);
  check("puce Force de retour sur le programme par défaut", chips2.some(t => /Force/.test(t)));
}

console.log("D — Interface de réglage");
{
  const w = boot();
  w.__dbg.S.bodyweight = 78;
  w.document.querySelector('nav button[data-scr="reglages"]').click();
  check("champs préremplis à 2/2/2",
        w.document.getElementById("phHyp").value === "2" &&
        w.document.getElementById("phForce").value === "2" &&
        w.document.getElementById("phEnd").value === "2");
  check("aperçu affiché", w.document.getElementById("phPreview").textContent.includes("6 semaines"));
  // Saisie 3/3/2
  w.document.getElementById("phHyp").value = "3";
  w.document.getElementById("phHyp").dispatchEvent(new w.Event("input", { bubbles:true }));
  w.document.getElementById("phForce").value = "3";
  w.document.getElementById("phForce").dispatchEvent(new w.Event("input", { bubbles:true }));
  check("aperçu mis à jour en direct", w.document.getElementById("phPreview").textContent.includes("8 semaines"),
        w.document.getElementById("phPreview").textContent);
  w.document.getElementById("phSave").click();
  check("plan enregistré", w.cycleLength() === 8);
  check("persisté", JSON.parse(w.localStorage.getItem("suiviMuscuBuilder.v1")).programs[0].cyclePlan.length === 8);
  // Garde-fou : cycle trop court
  w.document.getElementById("phHyp").value = "1";
  w.document.getElementById("phForce").value = "0";
  w.document.getElementById("phEnd").value = "1";
  w.document.getElementById("phHyp").dispatchEvent(new w.Event("input", { bubbles:true }));
  check("aperçu signale le cycle trop court", /trop court/.test(w.document.getElementById("phPreview").textContent));
  w.document.getElementById("phSave").click();
  check("enregistrement refusé sous 3 semaines", w.cycleLength() === 8, String(w.cycleLength()));
  // Cycle minimal accepté
  w.document.getElementById("phEnd").value = "2";
  w.document.getElementById("phSave").click();
  check("3 semaines au total : accepté", w.cycleLength() === 3, String(w.cycleLength()));
}

console.log("E — Compatibilité et honnêteté du discours");
{
  // Ancien programme "grand débutant" (drapeau noForce, sans cyclePlan)
  const w = boot();
  const legacy = { id:"u_gd", name:"GD", noForce:true, sessionsPerWeek:3,
                   sessions:[{ id:"us1", name:"FB", exos:[] }] };
  check("compat noForce : cycle sans Force", !w.cyclePlanOf(legacy).includes("force"));
  check("compat noForce : longueur 6", w.cycleLength(legacy) === 6);
  // Le texte du guide et des réglages assume le choix de diversité
  const guide = w.document.getElementById("scr-guide").textContent;
  check("guide : mention du choix de diversité", /diversité/.test(guide));
  check("guide : dit que ce n'est pas 100 % dicté par la science", /pas un choix dicté à 100/.test(guide));
  check("guide : endurance présentée comme décharge", /décharge/.test(guide));
  const reg = w.document.getElementById("scr-reglages").textContent;
  check("réglages : même explication", /diversité/.test(reg) && /décharge/.test(reg));
  check("aucune erreur fatale", w.__bootOk === true && !w.document.getElementById("bootError"));
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
