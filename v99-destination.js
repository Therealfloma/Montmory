/* MONTMORY V99: manueller, optionaler Zielort. Keine externe Ortsabfrage. */
(()=>{'use strict';
  const enabled=document.getElementById('destinationEnabled');
  const input=document.getElementById('destinationInput');
  const row=document.getElementById('previewDestinationRow');
  const value=document.getElementById('previewDestination');
  if(!enabled || !input) return;
  function get(){return enabled.checked ? input.value.trim().slice(0,30) : '';}
  function sync(){
    input.disabled=!enabled.checked;
    const destination=get();
    if(row) row.hidden=!destination;
    if(value) value.textContent=destination;
    if(typeof window.update3DEngraving==='function'){
      window.update3DEngraving({destinationEnabled:!!destination,destination});
    }
  }
  window.MontmoryDestination={get,sync};
  enabled.addEventListener('change',sync);
  input.addEventListener('input',sync);
  input.addEventListener('change',sync);
  // Nach dem Laden des 3D-Viewers aktualisieren; keine anderen Module überschreiben.
  window.addEventListener('load',sync);
  sync();
})();
