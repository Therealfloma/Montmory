// V76: Beispieloberfläche nur solange keine GPX-Datei ausgewählt wurde.
(()=>{
  const input=document.getElementById('gpxFile');
  const preview=document.getElementById('samplePreview');
  if(!input||!preview)return;
  function update(){
    const hasFile=!!input.files?.length;
    preview.hidden=hasFile;
    document.querySelector('.viewer-card')?.classList.toggle('showing-sample',!hasFile);
  }
  input.addEventListener('change',update);
  update();
})();
