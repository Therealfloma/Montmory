/* MONTMORY V66: ZIP ohne externe Bibliothek (ZIP STORE, CRC32, UTF-8). */
(()=>{'use strict';
const enc=new TextEncoder();
const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function u16(n){return[n&255,(n>>>8)&255];}
function u32(n){return[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
function pack(files){
 const chunks=[],central=[];let offset=0;
 const now=new Date(),dt=((now.getHours()&31)<<11)|((now.getMinutes()&63)<<5)|((now.getSeconds()/2)&31);
 const dd=(((now.getFullYear()-1980)&127)<<9)|(((now.getMonth()+1)&15)<<5)|(now.getDate()&31);
 for(const f of files){
  const name=enc.encode(f.name),body=f.data instanceof Uint8Array?f.data:enc.encode(String(f.data));
  const crc=crc32(body),size=body.length,flags=0x0800;
  const local=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(flags),...u16(0),...u16(dt),...u16(dd),...u32(crc),...u32(size),...u32(size),...u16(name.length),...u16(0)]);
  chunks.push(local,name,body);
  central.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(flags),...u16(0),...u16(dt),...u16(dd),...u32(crc),...u32(size),...u32(size),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]),name);
  offset+=local.length+name.length+body.length;
 }
 const csize=central.reduce((n,b)=>n+b.length,0);
 return new Blob([...chunks,...central,new Uint8Array([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(csize),...u32(offset),...u16(0)])],{type:'application/zip'});
}
async function download(review){
 const gp=window.__montmoryGpxFile || document.getElementById('gpxFile')?.files?.[0];
 if(!gp)throw new Error('GPX-Datei fehlt.');
 const number=review.orderNumber;
 const manifest={bestellnummer:number,erstellt:new Date().toISOString(),tour:document.getElementById('titleInput')?.value||'',
   strecke_km:document.getElementById('distanceInput')?.value||'',hoehenmeter:document.getElementById('gainInput')?.value||'',
   zielort_anzeigen:!!document.getElementById('destinationEnabled')?.checked,zielort:window.MontmoryDestination?.get()||'',
   widmung:window.MontmoryGift?.text()||'',kunde:{name:document.getElementById('customerName')?.value.trim()||'',email:document.getElementById('customerEmail')?.value.trim()||'',nachricht:document.getElementById('customerNote')?.value.trim()||''},gpx_dateiname:gp.name,gravurpruefung:review.warnings,
   hinweis:'Bitte SVG-Dateien in LightBurn vor der Fertigung kontrollieren.'};
 const files=[{name:`${number}_${review.front.filename}`,data:review.front.svg},
 {name:`${number}_${review.back.filename}`,data:review.back.svg},
 {name:`${number}_${gp.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`,data:new Uint8Array(await gp.arrayBuffer())},
 {name:`${number}_Bestelldaten.json`,data:JSON.stringify(manifest,null,2)}];
 const blob=pack(files),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`${number}_MONTMORY_Bestellung.zip`;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 return a.download;
}
window.MontmoryZipOrder={download,pack};
})();