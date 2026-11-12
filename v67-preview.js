/* V69: zwei echte 3D-WebGL-Ansichten desselben Modells. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const card=document.querySelector('.viewer-card');
if(!card)return;
function toggle(on){
 window.MontmoryDual3D=on;
 card.classList.toggle('dual-active',on);
 $('dualPreview').hidden=!on;
 $('singlePreview').classList.toggle('active',!on);
 $('doublePreview').classList.toggle('active',on);
 $('singlePreview').setAttribute('aria-pressed',String(!on));
 $('doublePreview').setAttribute('aria-pressed',String(on));
}
$('singlePreview')?.addEventListener('click',()=>toggle(false));
$('doublePreview')?.addEventListener('click',()=>toggle(true));
})();
