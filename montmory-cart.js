/* MONTMORY V110 – unverbindlicher lokaler Warenkorb, IndexedDB. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const DB='montmory-mark-cart-v1', STORE='marks';
  const status=$('cartStatus');
  if(!$('montmoryCart')) return;
  const setStatus=t=>{if(status)status.textContent=t;};
  function dbOpen(){return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(new Error('Lokale Speicherung wird von diesem Browser nicht unterstützt.'));
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });}
  async function transaction(mode,fn){
    const db=await dbOpen();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),req=fn(tx.objectStore(STORE));
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      tx.onerror=()=>reject(tx.error);
    });}finally{db.close();}
  }
  const all=()=>transaction('readonly',s=>s.getAll());
  const put=x=>transaction('readwrite',s=>s.put(x));
  const del=id=>transaction('readwrite',s=>s.delete(id));
  const get=id=>transaction('readonly',s=>s.get(id));
  function svgImage(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
  function addText(el,tag,value){const child=document.createElement(tag);child.textContent=value;el.append(child);return child;}
  async function render(){
    const marks=(await all()).sort((a,b)=>a.created-b.created),list=$('cartItems');list.replaceChildren();
    $('cartCount').textContent=`(${marks.length})`;
    const packCount=$('montmoryPackCount'),packButton=$('montmoryPackShortcut');
    if(packCount)packCount.textContent=marks.length>99?'99+':String(marks.length);
    if(packButton)packButton.setAttribute('aria-label',`Rucksack öffnen: ${marks.length} Trail Mark${marks.length===1?'':'s'} gespeichert`);

    $('cartEmpty').hidden=marks.length>0;
    $('cartNewMark').hidden=marks.length===0;
    $('cartTotals').hidden=marks.length===0;
    if(marks.length){
      $('cartTotals').textContent=`${marks.length} Trail Mark${marks.length===1?'':'s'} · Beispielhafter Warenwert: ${(marks.length*14.9).toFixed(2).replace('.',',')}–${(marks.length*19.9).toFixed(2).replace('.',',')} € · Versand nicht enthalten · Lieferzeit nach künftigem Verkaufsstart möglicherweise 7–14 Werktage (unverbindlich).`;
    }
    for(const mark of marks){
      const article=document.createElement('article');article.className='cart-item';
      const head=document.createElement('div');head.className='cart-item-header';
      addText(head,'h4',mark.title||'Mein Trail Mark');addText(head,'span','1 × Trail Mark');article.append(head);
      addText(article,'p',`${mark.km||'–'} · ${mark.hm||'–'} · ${mark.date||'–'}`);
      if(mark.destination)addText(article,'p','Zielort: '+mark.destination);
      const imgs=document.createElement('div');imgs.className='cart-item-images';
      for(const [label,svg] of [['Vorderseite',mark.front],['Rückseite',mark.back]]){
        const figure=document.createElement('figure');figure.style.margin='0';
        const img=document.createElement('img');img.src=svgImage(svg);img.alt=label+' – '+(mark.title||'Trail Mark');img.loading='lazy';figure.append(img);addText(figure,'figcaption',label);imgs.append(figure);
      }
      article.append(imgs);
      const actions=document.createElement('div');actions.className='cart-item-actions';
      const remove=document.createElement('button');remove.type='button';remove.className='review-cancel';remove.textContent='Entfernen';
      remove.addEventListener('click',async()=>{if(!confirm('Diesen Trail Mark aus dem Warenkorb entfernen?'))return;try{await del(mark.id);await render();setStatus('Trail Mark entfernt.');}catch(e){setStatus('Entfernen fehlgeschlagen: '+e.message);}});
      const edit=document.createElement('button');edit.type='button';edit.className='primary-button';edit.textContent='Weiterbearbeiten';
      edit.addEventListener('click',async()=>{
        try{
          const selected=await get(mark.id);
          if(!selected?.gpxText)throw new Error('Für diesen älteren Warenkorb-Eintrag wurde die GPX-Datei noch nicht gespeichert. Bitte die Strecke erneut hochladen und den Mark neu speichern.');
          sessionStorage.setItem('montmory-cart-edit-id',selected.id);
          setStatus('Konfiguration wird geladen …');
          await restore(selected);
        }catch(e){setStatus('Bearbeiten nicht möglich: '+e.message);}
      });
      actions.append(edit,remove);article.append(actions);list.append(article);
    }
  }
  function updateField(id,value){
    const el=$(id);if(!el||value===undefined||value===null)return;
    if(el.type==='checkbox')el.checked=Boolean(value);
    else el.value=String(value);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  async function restore(mark){
    const fileInput=$('gpxFile');
    const file=new File([mark.gpxText],mark.gpxName||'tour.gpx',{type:'application/gpx+xml'});
    const transfer=new DataTransfer();transfer.items.add(file);
    fileInput.files=transfer.files;
    fileInput.dispatchEvent(new Event('change',{bubbles:true}));
    // GPX-Verarbeitung ist asynchron; auf erfolgreichen Import warten.
    const deadline=Date.now()+12000;
    while(Date.now()<deadline){
      if(window.__montmoryImportState?.status==='ready' && window.__montmoryGpxFile?.name===file.name)break;
      await new Promise(r=>setTimeout(r,120));
    }
    if(window.__montmoryImportState?.status!=='ready')throw new Error('Die gespeicherte GPX-Strecke konnte nicht wiederhergestellt werden.');
    const c=mark.config||{};
    updateField('titleInput',c.title);
    updateField('distanceInput',c.distance);
    updateField('gainInput',c.gain);
    updateField('giftEnabled',c.giftEnabled);
    updateField('giftMessage',c.giftMessage);
    updateField('destinationEnabled',c.destinationEnabled);
    updateField('destinationInput',c.destinationInput);
    updateField('markWidthMM',c.width);
    updateField('markHeightMM',c.height);
    updateField('includeOuterContour',c.contour);
    if(c.mode){
      const radio=document.querySelector(`input[name="profileMode"][value="${c.mode==='route'?'route':'elevation'}"]`);
      if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}
    }
    $('orderReview')?.setAttribute('hidden','');
    document.querySelector('#konfigurator')?.scrollIntoView({behavior:'smooth',block:'start'});
    setStatus('Trail Mark geladen. Änderungen vornehmen und erneut im Warenkorb speichern.');
  }
  $('montmoryPackShortcut')?.addEventListener('click',()=>{
    const step3=document.querySelector('[data-wizard-go="3"]');
    // Den bestehenden Assistenten benutzen, damit der Warenkorb auch aus Schritt 1/2 sichtbar ist.
    if(step3)step3.click();
    const target=$('montmoryCart');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      target?.scrollIntoView({behavior:'smooth',block:'start'});
      target?.setAttribute('tabindex','-1');
      target?.focus({preventScroll:true});
    }));
  });
  $('addMarkToCart')?.addEventListener('click',async()=>{
    const button=$('addMarkToCart');button.disabled=true;
    try{
      const r=window.MontmoryCartReview?.();
      if(!r?.front?.svg||!r?.back?.svg)throw new Error('Bitte zuerst die aktuelle Bestellübersicht erstellen.');
      const gpx=window.__montmoryGpxFile || $('gpxFile')?.files?.[0];
      if(!gpx)throw new Error('Keine GPX-Datei geladen.');
      const editingId=sessionStorage.getItem('montmory-cart-edit-id');
      const oldMark=editingId?await get(editingId):null;
      const mark={id:oldMark?.id||crypto.randomUUID?.()||String(Date.now())+'-'+Math.random(),created:oldMark?.created||Date.now(),
        gpxName:gpx.name,gpxText:await gpx.text(),
        config:{
          title:$('titleInput')?.value,distance:$('distanceInput')?.value,gain:$('gainInput')?.value,
          giftEnabled:$('giftEnabled')?.checked,giftMessage:$('giftMessage')?.value,
          destinationEnabled:$('destinationEnabled')?.checked,destinationInput:$('destinationInput')?.value,
          width:$('markWidthMM')?.value,height:$('markHeightMM')?.value,
          contour:$('includeOuterContour')?.checked,
          mode:document.querySelector('input[name="profileMode"]:checked')?.value
        },
        title:$('titleInput')?.value?.trim()||'Meine Tour',km:$('previewDistance')?.textContent,
        hm:$('previewGain')?.textContent,date:$('previewDate')?.textContent,
        destination:window.MontmoryDestination?.get?.()||'',front:r.front.svg,back:r.back.svg};
      await put(mark);sessionStorage.removeItem('montmory-cart-edit-id');await render();setStatus('Trail Mark gespeichert. Du kannst jetzt eine neue Konfiguration starten.');
      $('montmoryCart').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){setStatus('Speichern fehlgeschlagen: '+e.message);}
    finally{button.disabled=false;}
  });
  $('cartNewMark')?.addEventListener('click',()=>{
    // Neustart setzt alle alten GPX- und Formulardaten sicher zurück; IndexedDB-Warenkorb bleibt erhalten.
    sessionStorage.removeItem('montmory-cart-edit-id');window.location.href=window.location.pathname+'#konfigurator';window.location.reload();
  });
  render().catch(e=>setStatus('Warenkorb konnte nicht geladen werden: '+e.message));
})();