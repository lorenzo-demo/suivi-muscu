/* Tests headless — consignes d'exécution et fiche d'exercice. */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "pwa-builder/index.html"), "utf8");

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? " — " + extra : "")); }
}
function boot() {
  return new JSDOM(html, {
    runScripts: "dangerously", url: "https://example.com/pwa-builder/index.html",
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => ({
        fillText(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
        set fillStyle(v){}, set font(v){}, set strokeStyle(v){}, set lineWidth(v){}, set lineJoin(v){}
      });
      window.confirm = () => true;
    }
  }).window;
}

console.log("A — Couverture des consignes");
{
  const w = boot();
  const db = w.__dbg.EXODB;
  const sans = db.filter(m => {
    const mat = m.mat[0];
    const exo = w.makeExoFromDb(m.id, mat);
    return !exo || !w.tipsFor(exo);
  });
  check("les 76 mouvements ont une consigne", sans.length === 0, sans.map(m => m.id).join(","));
  check("consignes suffisamment détaillées",
        db.every(m => {
          const exo = w.makeExoFromDb(m.id, m.mat[0]);
          const t = exo && w.tipsFor(exo);
          return t && t.length >= 60;
        }));
  // Exercices seed : la consigne passe par le mapping
  const presse = w.allUniqueExos().find(e => e.id === "presse");
  check("exercice seed : consigne résolue", !!w.tipsFor(presse));
  check("consigne pertinente (presse)", /dossier|plateau|genou/i.test(w.tipsFor(presse)), w.tipsFor(presse));
  // Exercice libre hors base : pas de consigne, pas de bouton
  const libre = w.makeFreeExo("Mouvement maison", "pdc", "iso", "abdos");
  check("exercice libre : pas de consigne inventée", w.tipsFor(libre) === null);
}

console.log("B — Liens vidéo");
{
  const w = boot();
  const presse = w.allUniqueExos().find(e => e.id === "presse");
  w.document.querySelector('nav button[data-scr="seance"]')?.click();
  const btn = [...w.document.querySelectorAll(".tip-btn")][0];
  btn.click();
  const card = w.document.getElementById("tipCard");
  const links = [...card.querySelectorAll(".tip-link")];
  check("2 sources proposées", links.length === 2);
  check("Olymp'Fit en premier", /Olymp/.test(links[0].textContent));
  check("Nassim Sahili en second", /Nassim/.test(links[1].textContent));
  check("recherche ciblée sur la chaîne", links[0].href.includes("Olymp") && links[0].href.includes("search_query"));
  check("nom du mouvement dans la requête", decodeURIComponent(links[0].href).includes("Presse"));
  check("ouverture dans un nouvel onglet", links.every(a => a.target === "_blank" && /noopener/.test(a.rel)));
  check("aucun lien vidéo codé en dur", !html.includes("youtube.com/watch"));
}

console.log("C — Interface");
{
  const w = boot();
  const nbCards = w.document.querySelectorAll("#exoList .exo").length;
  const nbBtns = w.document.querySelectorAll(".tip-btn").length;
  check("un bouton ? par exercice", nbBtns === nbCards, nbBtns + "/" + nbCards);
  check("popup fermée au départ", w.document.getElementById("tipModal").style.display === "none");
  w.document.querySelector(".tip-btn").click();
  check("popup ouverte au clic", w.document.getElementById("tipModal").style.display === "flex");
  const card = w.document.getElementById("tipCard");
  check("titre de l'exercice", !!card.querySelector("h3").textContent.trim());
  check("consigne affichée", card.textContent.length > 150);
  check("mention du mode hors ligne", /hors ligne/.test(card.textContent));
  w.document.getElementById("tipClose").click();
  check("fermeture par la croix", w.document.getElementById("tipModal").style.display === "none");
  // Fermeture par clic sur le fond
  w.document.querySelector(".tip-btn").click();
  const evt = new w.Event("click", { bubbles: true });
  Object.defineProperty(evt, "target", { value: w.document.getElementById("tipModal") });
  w.document.getElementById("tipModal").dispatchEvent(evt);
  check("fermeture par clic sur le fond", w.document.getElementById("tipModal").style.display === "none");
  // L'avertissement de l'exercice est repris dans la fiche
  const w2 = boot();
  const segs = [...w2.document.querySelectorAll("#seanceSeg button")];
  segs[2].click(); // séance contenant le face pull (noRm, avec warn)
  const fpBtn = [...w2.document.querySelectorAll("#exoList .exo")]
    .find(c => /Face pull/i.test(c.textContent))?.querySelector(".tip-btn");
  fpBtn.click();
  check("avertissement repris dans la fiche", /⚠/.test(w2.document.getElementById("tipCard").textContent));
}

console.log("D — Non-régression");
{
  const w = boot();
  check("app démarrée", w.__bootOk === true && !w.document.getElementById("bootError"));
  check("cartes d'exercice intactes", w.document.querySelectorAll("#exoList .exo").length > 0);
  check("sélecteur d'unité toujours présent", w.document.querySelectorAll(".unit-sel").length > 0);
  check("modèle toujours disponible", !!w.buildModelProgram("reprise_fb_ab"));
}

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
