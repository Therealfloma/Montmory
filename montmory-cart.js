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
  const dialog=$('montmoryCart'),backdrop=$('cartBackdrop'),pack=$('montmoryPackShortcut');
  let previousFocus=null;
  let currentMarkSaved=false;
  const newButtons=()=>[$('cartNewMark'),$('newMarkFromStep3')].filter(Boolean);
  const hasActiveDraft=()=>Boolean(window.__montmoryGpxFile || $('gpxFile')?.files?.length);
  function syncNewMarkButtons(){
    // Never show a new-configuration action until the current mark has been saved.
    // For a fresh visit without an active GPX, allow the action only when a mark
    // has actually been saved during this session.
    for(const button of newButtons()){
      button.hidden=!currentMarkSaved;
      button.disabled=!currentMarkSaved;
      button.title=currentMarkSaved?'Weitere Gestaltung beginnen':'Zuerst aktuellen Trail Mark speichern';
      button.setAttribute('aria-disabled',String(!currentMarkSaved));
    }
    const hint=$('saveBeforeNewHint');if(hint)hint.hidden=currentMarkSaved||!hasActiveDraft();
  }
  function markUnsaved(){currentMarkSaved=false;syncNewMarkButtons();}
  // Any adjustment to the current configuration requires saving again.
  document.querySelector('#konfigurator')?.addEventListener('input',e=>{
    if(e.target.closest('.settings-card,.upload-card,.tour-card'))markUnsaved();
  });
  document.querySelector('#konfigurator')?.addEventListener('change',e=>{
    if(e.target.closest('.settings-card,.upload-card,.tour-card'))markUnsaved();
  });
  syncNewMarkButtons();
  function openCart(){
    previousFocus=document.activeElement;
    showCartView('main');
    dialog.hidden=false;backdrop.hidden=false;document.body.classList.add('cart-dialog-open');
    render().catch(e=>setStatus('Übersicht nicht verfügbar: '+e.message));
    $('cartClose')?.focus();
  }
  function closeCart(){
    dialog.hidden=true;backdrop.hidden=true;document.body.classList.remove('cart-dialog-open');
    if(previousFocus?.isConnected)previousFocus.focus();
  }
  pack?.addEventListener('click',openCart);
  $('openCartFromStep3')?.addEventListener('click',openCart);
  $('cartClose')?.addEventListener('click',closeCart);
  backdrop?.addEventListener('click',closeCart);
  document.addEventListener('keydown',e=>{
    if(dialog.hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeCart();}
    if(e.key==='Tab'){
      const nodes=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(el=>el.getClientRects().length);
      if(!nodes.length)return;
      if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}
    }
  });
  function showCartView(view){
    const names={main:'cartMainView',checkout:'cartDemoCheckout',success:'cartDemoSuccess'};
    for(const [key,id] of Object.entries(names)){const el=$(id);if(el)el.hidden=key!==view;}
    if(view==='main')$('cartTitle').firstChild.textContent='Dein Rucksack ';
    if(view==='checkout')$('cartTitle').firstChild.textContent='Demo-Abschluss ';
    if(view==='success')$('cartTitle').firstChild.textContent='Abschluss bestätigt ';
  }
  const euro=n=>n.toFixed(2).replace('.',',')+' €';
  $('cartDemoStart')?.addEventListener('click',async()=>{
    try{
      const marks=await all();if(!marks.length)return;
      const summary=$('cartDemoSummary');summary.replaceChildren();
      addText(summary,'strong',`${marks.length} Trail Mark${marks.length===1?'':'s'}`);
      addText(summary,'div',`Beispiel-Warenwert: ${euro(marks.length*14.9)} – ${euro(marks.length*19.9)}`);
      addText(summary,'div','Versand noch offen · Lieferzeit beispielhaft 7–14 Werktage');
      $('cartDemoConsent').checked=false;
      showCartView('checkout');dialog.scrollTop=0;
    }catch(e){setStatus('Demo konnte nicht geöffnet werden: '+e.message);}
  });
  $('cartDemoBack')?.addEventListener('click',()=>showCartView('main'));
  $('cartCustomerForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const form=$('cartCustomerForm');
    if(!form.reportValidity())return;
    // Keine Speicherung oder Übermittlung persönlicher Angaben.
    form.reset();
    showCartView('success');dialog.scrollTop=0;
  });
  $('cartDemoReturn')?.addEventListener('click',()=>{showCartView('main');render().catch(e=>setStatus(e.message));});
  function svgImage(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
  function addText(el,tag,value){const child=document.createElement(tag);child.textContent=value;el.append(child);return child;}
  async function render(){
    const marks=(await all()).sort((a,b)=>a.created-b.created),list=$('cartItems');list.replaceChildren();
    $('cartCount').textContent=`(${marks.length})`;
    const packCount=$('montmoryPackCount'),packButton=$('montmoryPackShortcut');
    if(packCount)packCount.textContent=marks.length>99?'99+':String(marks.length);
    if(packButton)packButton.setAttribute('aria-label',`Rucksack öffnen: ${marks.length} Trail Mark${marks.length===1?'':'s'} gespeichert`);

    syncNewMarkButtons();
    $('cartEmpty').hidden=marks.length>0;
    $('cartNewMark').hidden=marks.length===0;
    $('cartTotals').hidden=marks.length===0;
    if($('cartDemoStart'))$('cartDemoStart').disabled=marks.length===0;
    if(marks.length){
      const totals=$('cartTotals');totals.replaceChildren();
      addText(totals,'h4','Deine Preisübersicht');
      addText(totals,'p',`${marks.length} × Trail Mark · je 14,90–19,90 €`);
      const total=addText(totals,'p',`Zusammen: ${euro(marks.length*14.9)} – ${euro(marks.length*19.9)}`);total.className='cart-total-value';
      addText(totals,'p','Versand noch offen · Lieferzeit ca. 7–14 Werktage (Beispiel)');
    }
    for(const mark of marks){
      const article=document.createElement('article');article.className='cart-item';
      const head=document.createElement('div');head.className='cart-item-header';
      addText(head,'h4',mark.title||'Mein Trail Mark');addText(head,'span','1 × Trail Mark');article.append(head);
      addText(article,'p',`${mark.km||'–'} · ${mark.hm||'–'} · ${mark.date||'–'}`);
      const itemPrice=addText(article,'p','Beispielpreis pro Trail Mark: 14,90–19,90 €');itemPrice.className='cart-item-price';

      const imgs=document.createElement('div');imgs.className='cart-item-images';
      for(const [label,svg] of [['Vorderseite',mark.front],['Rückseite',mark.back]]){
        const figure=document.createElement('figure');figure.style.margin='0';
        const img=document.createElement('img');img.src=svgImage(svg);img.alt=label+' – '+(mark.title||'Trail Mark');img.loading='lazy';figure.append(img);addText(figure,'figcaption',label);imgs.append(figure);
      }
      article.append(imgs);
      const actions=document.createElement('div');actions.className='cart-item-actions';
      const remove=document.createElement('button');remove.type='button';remove.className='review-cancel';remove.textContent='Entfernen';
      remove.addEventListener('click',async()=>{if(!confirm('Diesen Trail Mark aus dem Warenkorb entfernen?'))return;try{await del(mark.id);if(currentMarkSaved)markUnsaved();await render();setStatus('Trail Mark entfernt.');}catch(e){setStatus('Entfernen fehlgeschlagen: '+e.message);}});
      const edit=document.createElement('button');edit.type='button';edit.className='primary-button';edit.textContent='Weiterbearbeiten';
      edit.addEventListener('click',async()=>{
        try{
          const selected=await get(mark.id);
          if(!selected?.gpxText)throw new Error('Für diesen älteren Warenkorb-Eintrag wurde die GPX-Datei noch nicht gespeichert. Bitte die Strecke erneut hochladen und den Mark neu speichern.');
          sessionStorage.setItem('montmory-cart-edit-id',selected.id);
          setStatus('Konfiguration wird geladen …');
          closeCart();await restore(selected);
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
    markUnsaved();
    // Wizard controls are the single source of truth for step visibility.
    const stepTwo=document.querySelector('[data-wizard-go="2"]');
    if(!stepTwo)throw new Error('Schritt 2 ist nicht verfügbar.');
    stepTwo.click();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const settings=document.querySelector('.settings-card[data-wizard-step="2"]');
    (settings||document.querySelector('#konfigurator'))?.scrollIntoView({behavior:'smooth',block:'start'});
    setStatus('Trail Mark geladen. Änderungen vornehmen und erneut im Warenkorb speichern.');
  }
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
      await put(mark);sessionStorage.removeItem('montmory-cart-edit-id');currentMarkSaved=true;syncNewMarkButtons();await render();setStatus('Trail Mark zum Warenkorb hinzugefügt. Du kannst weitere Trail Marks gestalten oder später im Rucksack den Demo-Abschluss starten.');
    }catch(e){setStatus('Speichern fehlgeschlagen: '+e.message);}
    finally{button.disabled=false;}
  });
  function newMark(){
    if(hasActiveDraft()&&!currentMarkSaved){
      setStatus('Bitte speichere deinen aktuellen Trail Mark zuerst im Rucksack.');
      closeCart();
      document.querySelector('[data-wizard-go="3"]')?.click();
      document.querySelector('.send-config-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    // Neustart setzt alle alten GPX- und Formulardaten sicher zurück; IndexedDB-Warenkorb bleibt erhalten.
    sessionStorage.removeItem('montmory-cart-edit-id');window.location.href=window.location.pathname+'#konfigurator';window.location.reload();
  }
  $('cartNewMark')?.addEventListener('click',newMark);
  $('newMarkFromStep3')?.addEventListener('click',newMark);
  render().catch(e=>setStatus('Warenkorb konnte nicht geladen werden: '+e.message));
})();