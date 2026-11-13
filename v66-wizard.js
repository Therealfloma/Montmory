/* MONTMORY V66: Drei echte Konfigurationsschritte, ohne Verlust der bisherigen Felder. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let step=1;
const nodes=[...document.querySelectorAll('[data-wizard-step]')];
const buttons=[...document.querySelectorAll('[data-wizard-go]')];
function render(){
 nodes.forEach(el=>{el.hidden=Number(el.dataset.wizardStep)!==step;});
 buttons.forEach(b=>{const n=Number(b.dataset.wizardGo);b.classList.toggle('active',n===step);b.disabled=n>1&&!window.__trailMarkLastResult;});
 $('wizardBack').hidden=step===1;$('wizardNext').hidden=step===3;
 $('wizardNext').textContent=step===1?'Weiter zur Gestaltung':'Weiter zur Prüfung';
 $('wizardStatus').textContent=`Schritt ${step} von 3`;
}
function go(n){
 if(n>1 && !window.__trailMarkLastResult){
   $('wizardStatus').textContent='Bitte zuerst eine gültige GPX-Datei laden.';return;
 }
 if(n<1||n>3)return;
 step=n;render();document.querySelector('.wizard-nav')?.scrollIntoView({behavior:'smooth',block:'start'});
}
$('wizardNext')?.addEventListener('click',()=>go(step+1));
$('wizardBack')?.addEventListener('click',()=>go(step-1));
buttons.forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.wizardGo))));
$('gpxFile')?.addEventListener('change',()=>{if(step>1){step=1;render();}});
window.addEventListener('trailmark:gpx-ready', render);
render();
})();