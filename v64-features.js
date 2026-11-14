/* MONTMORY V64 – clientseitige Qualitätsprüfung, Widmung und Produktionsmodus. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const gift=()=>$('giftEnabled')?.checked ? ($('giftMessage')?.value||'').slice(0,30).trim() : '';
window.MontmoryGift={text:gift};
function updateGift(){
  $('giftMessageWrap').hidden=!$('giftEnabled').checked;
  $('giftMessage').maxLength=30;
  // Canvas-Textur neu zeichnen, damit Widmung auch in 3D erscheint.
  if(window.__trailMarkLastResult){
    const mode=document.querySelector('input[name="profileMode"]:checked');
    mode?.dispatchEvent(new Event('change',{bubbles:true}));
  }
}
$('giftEnabled')?.addEventListener('change',updateGift);
$('giftMessage')?.addEventListener('input',updateGift);
function orderNumber(){
  const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('');
  const random=new Uint8Array(4);crypto.getRandomValues(random);
  return `MM-${date}-${Array.from(random,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()}`;
}
async function inspect(svg,side){
  const issues=[];
  const parsed=new DOMParser().parseFromString(svg,'image/svg+xml');
  if(parsed.querySelector('parsererror'))return [{level:'error',message:`${side}: SVG ist ungültig.`}];
  const root=parsed.documentElement;
  const width=parseFloat(root.getAttribute('width')),height=parseFloat(root.getAttribute('height'));
  if(!(width>0&&height>0))issues.push({level:'error',message:`${side}: Ungültige Werkstückmaße.`});
  // SVG ist mit realen Abmessungen gerendert. Bounding-Boxes prüfen die Textpositionen
  // nach Anwendung aller Transformationen. Warnung bei 1,5 mm Randabstand.
  const host=document.createElement('div');
  Object.assign(host.style,{position:'fixed',left:'-20000px',top:'0',width:'1000px',visibility:'hidden',pointerEvents:'none'});
  const node=document.importNode(root,true);
  node.setAttribute('width',`${width*10}px`);node.setAttribute('height',`${height*10}px`);
  host.appendChild(node);document.body.appendChild(host);
  try{
    await document.fonts?.ready;
    const texts=Array.from(node.querySelectorAll('text'));
    
  const boxes=[];
  for(const t of texts){
  // Leere Texte bei der Gravurprüfung überspringen.
  if(!(t.textContent || '').trim()) continue;

  let r;
  try {
    r=t.getBBox();
  } catch {
    continue;
  }

  const m=t.getCTM();
  if(!m) continue;

      const corners=[[r.x,r.y],[r.x+r.width,r.y],[r.x,r.y+r.height],[r.x+r.width,r.y+r.height]].map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));
      const box={minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y)),name:t.textContent.trim().slice(0,28)};
      // getCTM may include scaling to CSS pixels; normalize against displayed SVG dimensions.
      const rect=node.getBoundingClientRect();
      const kx=width/rect.width,ky=height/rect.height;
      for(const k of ['minX','maxX'])box[k]*=kx;
      for(const k of ['minY','maxY'])box[k]*=ky;
      if(box.minX<1.5||box.maxX>width-1.5||box.minY<1.5||box.maxY>height-1.5)
        issues.push({level:'error',message:`${side}: Text „${box.name}“ liegt zu nah am Werkstückrand.`});
      boxes.push(box);
    }
    // Textüberschneidungen; nur echte Überschneidungen mit mindestens 0,5 mm.
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j],ox=Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX),oy=Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY);
      if(ox>0.5&&oy>0.5)issues.push({level:'warn',message:`${side}: Textfelder „${a.name}“ und „${b.name}“ überlappen möglicherweise.`});
    }
  }finally{host.remove();}
  // Schriftgröße in realen Millimetern prüfen. Die SVG-viewBox-Höhe ist 1152 Einheiten.
  // Warnung statt Blockade, da die tatsächliche Gravur von Holz und Laser abhängt.
  const viewBox=(root.getAttribute('viewBox')||'0 0 1024 1152').trim().split(/[\s,]+/).map(Number);
  const svgUnitsPerMM=(viewBox[3]||1152)/height;
  for(const t of root.querySelectorAll('text')){
    // Keine Schriftgrößenwarnung für leere Texte.
    if(!(t.textContent || '').trim()) continue;

    const size=parseFloat(t.getAttribute('font-size'));
    if(Number.isFinite(size) && size/svgUnitsPerMM<1.8){
      issues.push({level:'warn',message:`${side}: Schrift „${(t.textContent||'').trim().slice(0,24)}“ ist nur ${(size/svgUnitsPerMM).toFixed(2)} mm hoch (Richtwert mindestens 1,8 mm).`});
    }
  }
  if(!svg.includes('id="gravur"'))issues.push({level:'error',message:`${side}: Gravurebene fehlt.`});
  if(!svg.includes('id="mark-aussenkontur"'))issues.push({level:'warn',message:`${side}: Keine rote Außenkontur exportiert.`});
  return issues;
}
async function check(front,back){return [...await inspect(front,'Vorderseite'),...await inspect(back,'Rückseite')];}
function showWarnings(el,warnings){if(!el)return;el.replaceChildren();const title=document.createElement('strong');title.textContent=warnings.length?'Automatische Gravurprüfung:':'Gravurprüfung: Keine offensichtlichen Textprobleme erkannt.';el.append(title);for(const w of warnings){const p=document.createElement('p');p.className=w.level;p.textContent=`${w.level==='error'?'Fehler':'Hinweis'}: ${w.message}`;el.append(p);}const p=document.createElement('p');p.textContent='Die Prüfung ersetzt keine Sichtkontrolle in LightBurn. Linien, Konturen und Lochabstände müssen zusätzlich geprüft werden.';el.append(p);}
function download(content,name,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const api=window.MontmoryV64={orderNumber,check,showWarnings,lastReview:null};
const production=new URLSearchParams(location.search).get('production')==='1';
if(production){$('productionPanel').hidden=false;$('productionExport').addEventListener('click',async()=>{
 const status=$('productionStatus');try{
 status.textContent='Produktionsdateien werden erstellt …';
 const review=api.lastReview;
 const front=review?.front||await window.MontmorySvgExport.createSvg('front');
 const back=review?.back||await window.MontmorySvgExport.createSvg('back');
 const number=review?.orderNumber||orderNumber();
 const warnings=await check(front.svg,back.svg);
 warnings.push(...(window.MontmoryV71?.validateSvg(front.svg,'Vorderseite')||[]));
 warnings.push(...(window.MontmoryV71?.validateSvg(back.svg,'Rückseite')||[]));
 if(warnings.some(w=>w.level==='error'))throw new Error('Technische SVG-Prüfung fehlgeschlagen: '+warnings.filter(w=>w.level==='error').map(w=>w.message).join('; '));
 const manifest={bestellnummer:number,erstellt:new Date().toISOString(),titel:$('titleInput')?.value,geschenkmodus:!!$('giftEnabled')?.checked,widmung:gift(),breite_mm:Number($('markWidthMM')?.value),hoehe_mm:Number($('markHeightMM')?.value),dateien:[`${number}_${front.filename}`,`${number}_${back.filename}`],gravurpruefung:warnings,hinweis:'Vor Laserfertigung in LightBurn kontrollieren.'};
 download(front.svg,manifest.dateien[0],'image/svg+xml');download(back.svg,manifest.dateien[1],'image/svg+xml');download(JSON.stringify(manifest,null,2),`${number}_Produktion.json`,'application/json');
 status.textContent=`${number}: Drei Dateien heruntergeladen. ${warnings.length} Prüfhinweise. Mehrfachdownloads ggf. im Browser erlauben.`;
 }catch(e){status.textContent=`Produktions-Export fehlgeschlagen: ${e.message}`;}
 });}
})();
