// V81: Simple public controls, existing 3D controls remain the functional source of truth.
(()=>{'use strict';
 const single=document.getElementById('singlePreview');
 const both=document.getElementById('doublePreview');
 const mode3d=document.getElementById('v81Mode3d');
 const modeBoth=document.getElementById('v81ModeBoth');
 if(!single||!both||!mode3d||!modeBoth)return;
 const sync=()=>{const dual=both.classList.contains('active');mode3d.classList.toggle('active',!dual);modeBoth.classList.toggle('active',dual);mode3d.setAttribute('aria-pressed',String(!dual));modeBoth.setAttribute('aria-pressed',String(dual));};
 mode3d.addEventListener('click',()=>{single.click();sync();});
 modeBoth.addEventListener('click',()=>{both.click();sync();});
 sync();
})();
