/* MONTMORY V146 — offline ZIP export of locally saved cart production data. */
(()=>{'use strict';
if(new URLSearchParams(location.search).get('production')!=='1')return;
const panel=document.getElementById('productionPanel');if(!panel)return;
const button=document.createElement('button');button.type='button';button.className='primary-button';button.textContent='Warenkorb als Produktions-ZIP herunterladen';button.style.margin='12px 0';
const status=document.createElement('p');status.setAttribute('role','status');status.style.fontSize='.9rem';
panel.append(button,status);
const enc=new TextEncoder();
const safe=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,55)||'Tour';
const txt=s=>enc.encode(s);
const u16=n=>[n&255,(n>>>8)&255],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
const table=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function crc32(data){let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function zip(files){
  // ZIP STORE (no compression). Standard-compliant 30/46/22-byte headers.
  const chunks=[],directory=[];let offset=0,centralSize=0;
  const write16=(v,n,x)=>v.setUint16(n,x,true);
  const write32=(v,n,x)=>v.setUint32(n,x>>>0,true);
  for(const file of files){
    const name=txt(file.name),data=typeof file.data==='string'?txt(file.data):file.data;
    if(name.length>65535||data.length>0xffffffff)throw Error('Datei zu groß für ZIP.');
    const crc=crc32(data);
    const local=new Uint8Array(30),lv=new DataView(local.buffer);
    write32(lv,0,0x04034b50);write16(lv,4,20);write16(lv,6,0x0800);
    write16(lv,8,0);write32(lv,14,crc);write32(lv,18,data.length);
    write32(lv,22,data.length);write16(lv,26,name.length);
    chunks.push(local,name,data);
    const central=new Uint8Array(46),cv=new DataView(central.buffer);
    write32(cv,0,0x02014b50);write16(cv,4,20);write16(cv,6,20);
    write16(cv,8,0x0800);write16(cv,10,0);write32(cv,16,crc);
    write32(cv,20,data.length);write32(cv,24,data.length);
    write16(cv,28,name.length);write32(cv,42,offset);
    directory.push(central,name);centralSize+=central.length+name.length;
    offset+=local.length+name.length+data.length;
  }
  if(files.length>65535||offset+centralSize>0xffffffff)throw Error('Zu viele Produktionsdaten für ZIP.');
  const end=new Uint8Array(22),ev=new DataView(end.buffer);
  write32(ev,0,0x06054b50);write16(ev,8,files.length);
  write16(ev,10,files.length);write32(ev,12,centralSize);write32(ev,16,offset);
  return new Blob([...chunks,...directory,end],{type:'application/zip'});
}
function loadMarks(){return new Promise((resolve,reject)=>{const r=indexedDB.open('montmory-mark-cart-v1',1);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('marks'))r.result.createObjectStore('marks',{keyPath:'id'});};r.onsuccess=()=>{const db=r.result,tx=db.transaction('marks','readonly'),q=tx.objectStore('marks').getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);tx.oncomplete=()=>db.close();};});}
const styleName=s=>s==='kompass'?'Kompass & Weltkarte':'Bergpanorama';
button.addEventListener('click',async()=>{button.disabled=true;status.textContent='Produktionsdaten werden vorbereitet …';try{
const all=await loadMarks();const groups=new Map();for(const m of all){if(m.bundleId){const a=groups.get(m.bundleId)||[];a.push(m);groups.set(m.bundleId,a);}}
const incomplete=[...groups.values()].filter(a=>a.length!==3);if(incomplete.length)throw Error('Ein Set ist noch unvollständig. Bitte zuerst alle drei Marks gestalten.');
const marks=all.sort((a,b)=>(a.created||0)-(b.created||0));const boardQty=Math.max(0,Number(localStorage.getItem('montmory-shop-board-v1'))||0);if(!marks.length&&!boardQty)throw Error('Der Warenkorb ist leer.');
const files=[],rows=['MONTMORY — PRODUKTIONSÜBERSICHT','Erstellt: '+new Date().toLocaleString('de-DE'),'','SVG-Dateien enthalten die gespeicherten Gravuren. Maße und Schnittkonturen vor Fertigung in LightBurn kontrollieren.',''];let count=0;
for(const [i,m] of marks.entries()){if(!m.front||!m.back)throw Error('Bei '+(m.title||'Mark '+(i+1))+' fehlen SVG-Daten. Bitte neu speichern.');const prefix=String(i+1).padStart(2,'0')+'_'+safe(m.title);files.push({name:'Trail-Marks/'+prefix+'_Vorderseite.svg',data:m.front},{name:'Trail-Marks/'+prefix+'_Rueckseite.svg',data:m.back});const quantity=Math.max(1,Number(m.quantity)||1);count+=quantity;rows.push('Trail Mark '+(i+1)+': '+(m.title||'Meine Tour'),'  Menge: '+quantity+' Stück','  GPX: '+(m.gpxName||'–'),'  Distanz: '+(m.km||'–')+' · Höhenmeter: '+(m.hm||'–')+' · Datum: '+(m.date||'–'),'  Set: '+(m.bundleId?(m.bundle==='starter'?'Starterpaket':'3er-Set')+' / '+(m.bundleIndex||'?')+' von 3 / ID '+m.bundleId:'Einzelner Trail Mark'),'  Gravurmaße: '+(m.config?.width||'–')+' × '+(m.config?.height||'–')+' mm','  SVG: '+prefix+'_Vorderseite.svg / '+prefix+'_Rueckseite.svg','');}
const starter=[...groups.values()].filter(a=>a.length===3&&a[0].bundle==='starter');rows.push('SAMMELBOARDS');if(boardQty)rows.push('Einzelnes Sammelboard: '+boardQty+' Stück · '+styleName(localStorage.getItem('montmory-shop-board-style-v1')));for(const [i,g] of starter.entries())rows.push('Starterpaket '+(i+1)+': 1 Sammelboard · '+styleName(g[0].boardStyle));rows.push('','GESAMT: '+count+' Trail Marks · '+(boardQty+starter.length)+' Sammelboards','', 'Hinweis: Sammelboard-SVGs sind nicht enthalten; Boardmotiv ist in der Übersicht dokumentiert.','Die Mengen gelten je gespeicherter SVG-Konfiguration.');files.unshift({name:'Fertigungsuebersicht.txt',data:rows.join('\r\n')});
const blob=zip(files),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='MONTMORY_Produktionsdaten_'+new Date().toISOString().slice(0,10)+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent='ZIP erstellt: '+marks.length+' Konfigurationen, '+count+' Trail Marks und '+(boardQty+starter.length)+' Sammelboards.';
}catch(e){status.textContent='Export nicht möglich: '+e.message;}finally{button.disabled=false;}});
})();
