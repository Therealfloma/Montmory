/* MONTMORY V88 – zentrale GPX-Statusprüfung, keine Abhängigkeit vom Dateifeld. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let step=1;
const nodes=[...document.querySelectorAll('[data-wizard-step]')];
const buttons=[...document.querySelectorAll('[data-wizard-go]')];
const hasTour=()=>window.__montmoryImportState?.status==='ready' && Boolean(window.__trailMarkLastResult);
function render(){
 nodes.forEach(el=>{el.hidden=Number(el.dataset.wizardStep)!==step;});
 buttons.forEach(b=>{const n=Number(b.dataset.wizardGo);b.classList.toggle('active',n===step);b.disabled=n>1&&!hasTour();});
 $('wizardBack').hidden=step===1;$('wizardNext').hidden=step===3;
 $('wizardNext').textContent=step===1?'Weiter zur Gestaltung':'Weiter zur Prüfung';
 const state=window.__montmoryImportState;
 $('wizardStatus').textContent=step===1&&state?.status==='ready'?'✓ Tour geladen – du kannst jetzt weiter.':`Schritt ${step} von 3`;
}
function go(n){
 if(n<1||n>3)return;
 if(n>1&&!hasTour()){
  $('wizardStatus').textContent=window.__montmoryImportState?.status==='loading'?'Deine Tour wird noch verarbeitet.':'Bitte zuerst eine gültige GPX-Datei laden.';
  return;
 }
 step=n;render();document.querySelector('.wizard-nav')?.scrollIntoView({behavior:'smooth',block:'start'});
}
$('wizardNext')?.addEventListener('click',()=>go(step+1));
$('wizardBack')?.addEventListener('click',()=>go(step-1));
buttons.forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.wizardGo))));
$('gpxFile')?.addEventListener('change',()=>{if(step>1){step=1;render();}});
window.addEventListener('montmory:import-state',render);
window.addEventListener('trailmark:gpx-ready',render);
render();
})();
