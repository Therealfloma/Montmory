/* MONTMORY V71: portable configuration save, SVG technical checks. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const ids=['titleInput','distanceInput','gainInput','giftEnabled','giftMessage',
 'markWidthMM','markHeightMM','includeOuterContour','customerName','customerEmail','customerNote'];
function getSettings(){
 const settings={};
 for(const id of ids){const el=$(id);if(el)settings[id]=el.type==='checkbox'?el.checked:el.value;}
 settings.profileMode=document.querySelector('input[name="profileMode"]:checked')?.value||'elevation';
 return settings;
}
function setSettings(settings){
 for(const id of ids){const el=$(id);if(!el||!(id in settings))continue;
  if(el.type==='checkbox')el.checked=!!settings[id];else el.value=String(settings[id]);}
 const mode=document.querySelector(`input[name="profileMode"][value="${settings.profileMode==='route'?'route':'elevation'}"]`);
 if(mode)mode.checked=true;
 $('giftEnabled')?.dispatchEvent(new Event('change',{bubbles:true}));
 $('titleInput')?.dispatchEvent(new Event('input',{bubbles:true}));
 $('distanceInput')?.dispatchEvent(new Event('input',{bubbles:true}));
 $('gainInput')?.dispatchEvent(new Event('input',{bubbles:true}));
 mode?.dispatchEvent(new Event('change',{bubbles:true}));
}
function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('saveConfig')?.addEventListener('click',async()=>{
 try{
  const f=$('gpxFile')?.files?.[0];
  const data={format:'MONTMORY-Konfiguration',version:71,settings:getSettings(),
    gpx:f?{name:f.name,content:await f.text()}:null};
  const text=JSON.stringify(data,null,2);
  downloadBlob(new Blob([text],{type:'application/json'}),'MONTMORY_Konfiguration.json');
  $('saveStatus').textContent='Konfiguration inklusive GPX als JSON gespeichert. Datei bitte sicher aufbewahren.';
 }catch(e){$('saveStatus').textContent='Speichern fehlgeschlagen: '+e.message;}
});
$('loadConfig')?.addEventListener('change',async(e)=>{
 try{
  const f=e.target.files?.[0];if(!f)return;
  if(f.size>12*1024*1024)throw new Error('Konfigurationsdatei ist zu groß.');
  const data=JSON.parse(await f.text());
  if(data.format!=='MONTMORY-Konfiguration'||!data.settings||data.version!==71)
   throw new Error('Bitte eine mit V71 gespeicherte MONTMORY-Konfiguration auswählen.');
  if(data.gpx){
   if(typeof data.gpx.content!=='string'||data.gpx.content.length>10*1024*1024)throw new Error('GPX-Daten ungültig oder zu groß.');
   const file=new File([data.gpx.content],String(data.gpx.name||'tour.gpx'),{type:'application/gpx+xml'});
   const transfer=new DataTransfer();transfer.items.add(file);$('gpxFile').files=transfer.files;
   $('gpxFile').dispatchEvent(new Event('change',{bubbles:true}));
   // GPX parsing is async; apply settings once its change handler has settled.
   await new Promise(resolve=>setTimeout(resolve,350));
  }
  setSettings(data.settings);
  $('saveStatus').textContent='Konfiguration geladen. Bitte die Vorschau und Tourdaten prüfen.';
 }catch(err){$('saveStatus').textContent='Laden fehlgeschlagen: '+err.message;}
 finally{e.target.value='';}
});
function validateSvg(svg,side){
 const issues=[],doc=new DOMParser().parseFromString(svg,'image/svg+xml');
 if(doc.querySelector('parsererror'))return [{level:'error',message:`${side}: SVG kann nicht gelesen werden.`}];
 const root=doc.documentElement;
 const width=parseFloat(root.getAttribute('width')),height=parseFloat(root.getAttribute('height'));
 const vb=(root.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);
 if(vb.length!==4||vb.some(x=>!Number.isFinite(x))||vb[2]<=0||vb[3]<=0)
  issues.push({level:'error',message:`${side}: Ungültige SVG-viewBox.`});
 if(Math.abs(width-60)>0.05||Math.abs(height-80)>0.05)
  issues.push({level:'warn',message:`${side}: SVG-Maße ${width} × ${height} statt 60 × 80 mm. Bitte Werkstückgröße prüfen.`});
 const contour=root.querySelector('#mark-aussenkontur');
 if($('includeOuterContour')?.checked&&!contour)
  issues.push({level:'error',message:`${side}: Aktivierte Außenkontur fehlt.`});
 if(contour){
  const d=contour.getAttribute('d')||'';
  if(!/[zZ]\s*$/.test(d))issues.push({level:'warn',message:`${side}: Außenkontur scheint nicht geschlossen zu sein.`});
  const color=(contour.getAttribute('stroke')||'').toLowerCase();
  if(color&&!['#ff0000','red','#f00'].includes(color))
   issues.push({level:'warn',message:`${side}: Kontur ist nicht rot kodiert.`});
 }
 for(const path of root.querySelectorAll('path')){
  const d=path.getAttribute('d')||'';
  if(!d.trim())issues.push({level:'warn',message:`${side}: Leerer SVG-Pfad gefunden.`});
  if(/(?:NaN|Infinity|undefined)/i.test(d))issues.push({level:'error',message:`${side}: Ungültige Koordinaten im SVG-Pfad.`});
  if(path.id.includes('fein-018mm')&&!/[zZ]\s*$/.test(d))
   issues.push({level:'error',message:`${side}: Schmale Gravurfläche ist nicht geschlossen.`});
 }
 if(!root.querySelector('#gravur'))
  issues.push({level:'error',message:`${side}: Gravurebene fehlt.`});
 return issues;
}
window.MontmoryV71={validateSvg};
})();
