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
  const clearAll=()=>transaction('readwrite',s=>s.clear());
  const SHOP_KEY='montmory-shop-board-v1';
  const shopBoard=()=>Math.max(0,Math.min(10,Number(localStorage.getItem(SHOP_KEY))||0));
  const setShopBoard=n=>localStorage.setItem(SHOP_KEY,String(Math.max(0,Math.min(10,n))));
  const pendingKey='montmory-shop-pending-v1';
  const pending=()=>{try{return JSON.parse(sessionStorage.getItem(pendingKey)||'null')}catch{return null}};
  const setPending=p=>p?sessionStorage.setItem(pendingKey,JSON.stringify(p)):sessionStorage.removeItem(pendingKey);
  const qty=m=>Math.max(1,Math.min(99,Number.parseInt(m.quantity,10)||1));
  const units=marks=>marks.reduce((sum,m)=>sum+qty(m),0);
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
      const marks=await all();if(!marks.length&&!shopBoard())return;
      const summary=$('cartDemoSummary');summary.replaceChildren();
      addText(summary,'strong',`${units(marks)} Trail Marks · ${shopBoard()} Sammelboard(s)`);
      const [low,high]=cartPrice(marks);addText(summary,'div',`Beispiel-Warenwert: ${euro(low)} – ${euro(high)}`);
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
  function cartPrice(marks){
    let low=shopBoard()*59.9,high=shopBoard()*89.9;
    for(const m of marks){if(m.bundle==='triple'){low+=39.9;high+=49.9;}
      else if(m.bundle==='starter'){low+=99.9;high+=129.9;}
      else{low+=qty(m)*14.9;high+=qty(m)*19.9;}}
    return [low,high];
  }
  async function render(){
    const marks=(await all()).sort((a,b)=>a.created-b.created),list=$('cartItems');list.replaceChildren();
    const count=units(marks)+shopBoard();
    $('cartCount').textContent=`(${count})`;
    const packCount=$('montmoryPackCount'),packButton=$('montmoryPackShortcut');
    if(packCount)packCount.textContent=count>99?'99+':String(count);
    if(packButton)packButton.setAttribute('aria-label',`Rucksack öffnen: ${marks.length} Trail Mark${marks.length===1?'':'s'} gespeichert`);

    syncNewMarkButtons();
    $('cartEmpty').hidden=marks.length>0||shopBoard()>0;
    $('cartNewMark').hidden=marks.length===0 || !currentMarkSaved;
    if($('cartClearAll'))$('cartClearAll').hidden=marks.length===0&&shopBoard()===0;
    $('cartTotals').hidden=marks.length===0&&shopBoard()===0;
    if($('cartDemoStart'))$('cartDemoStart').disabled=marks.length===0&&shopBoard()===0;
    if(marks.length||shopBoard()){
      const totals=$('cartTotals');totals.replaceChildren();
      addText(totals,'h4','Zusammenfassung');
      addText(totals,'p',`${units(marks)} × Trail Mark · ${shopBoard()} × Sammelboard`);
      const [low,high]=cartPrice(marks);const total=addText(totals,'p',`${euro(low)} – ${euro(high)}`);total.className='cart-total-value';
      addText(totals,'p','Unverbindliche Beispielpreise · Versand noch offen');
    }
    if(shopBoard()){
      const article=document.createElement('article');article.className='shop-cart-product';
      addText(article,'h4','MONTMORY Sammelboard');
      addText(article,'p',`${shopBoard()} Stück · je 59,90–89,90 € (Beispielpreis)`);
      const controls=document.createElement('div');
      const select=document.createElement('select');select.setAttribute('aria-label','Anzahl Sammelboards');
      for(let i=1;i<=10;i++){const o=document.createElement('option');o.value=String(i);o.textContent=i+' Stück';select.append(o);}
      select.value=String(shopBoard());select.addEventListener('change',()=>{setShopBoard(Number(select.value));render();});controls.append(select);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Entfernen';remove.addEventListener('click',()=>{setShopBoard(0);render();});controls.append(remove);article.append(controls);list.append(article);
    }
    for(const mark of marks){
      const article=document.createElement('article');article.className='cart-item';
      const head=document.createElement('div');head.className='cart-item-header';
      addText(head,'h4',mark.bundle==='starter'?'Starterpaket · '+(mark.title||'Meine Tour'):mark.bundle==='triple'?'3er-Set · '+(mark.title||'Meine Tour'):(mark.title||'Mein Trail Mark'));addText(head,'span',`${qty(mark)} × Trail Mark`);article.append(head);
      const meta=addText(article,'p',`${mark.km||'–'} · ${mark.hm||'–'} · ${mark.date||'–'}`);meta.className='cart-item-meta';
      const itemPrice=addText(article,'p',mark.bundle==='starter'?'Starterpaket mit Board: 99,90–129,90 € (Beispielpreis)':mark.bundle==='triple'?'3er-Set: 39,90–49,90 € (Beispielpreis)':'Beispielpreis pro Trail Mark: 14,90–19,90 €');itemPrice.className='cart-item-price';

      const quantityRow=document.createElement('div');quantityRow.className='cart-quantity-row';
      const quantityLabel=document.createElement('label');quantityLabel.textContent='Anzahl dieser Konfiguration';
      const quantitySelect=document.createElement('select');quantitySelect.className='cart-quantity-select';
      quantitySelect.setAttribute('aria-label',`Anzahl für ${mark.title||'Trail Mark'}`);
      for(let n=1;n<=10;n++){const option=document.createElement('option');option.value=String(n);option.textContent=`${n} Stück`;quantitySelect.append(option);}
      if(qty(mark)>10){const option=document.createElement('option');option.value=String(qty(mark));option.textContent=`${qty(mark)} Stück`;quantitySelect.append(option);}
      quantitySelect.value=String(qty(mark));
      if(mark.bundle){quantitySelect.disabled=true;quantityLabel.title='Dieses Paket enthält drei Marks. Die Stückzahl ist fest.';}
      quantitySelect.addEventListener('change',async()=>{
        quantitySelect.disabled=true;
        try{const latest=await get(mark.id);if(!latest)return;latest.quantity=Number(quantitySelect.value);await put(latest);await render();setStatus('Stückzahl aktualisiert.');}
        catch(e){quantitySelect.disabled=false;setStatus('Stückzahl konnte nicht gespeichert werden: '+e.message);}
      });
      quantityLabel.append(quantitySelect);quantityRow.append(quantityLabel);article.append(quantityRow);
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
      const shopChoice=!oldMark?pending():null;
      const mark={bundle:oldMark?.bundle||(shopChoice?.kind==='triple'||shopChoice?.kind==='starter'?shopChoice.kind:null),id:oldMark?.id||crypto.randomUUID?.()||String(Date.now())+'-'+Math.random(),created:oldMark?.created||Date.now(),
        quantity:oldMark?qty(oldMark):(shopChoice?.kind==='triple'||shopChoice?.kind==='starter'?3:1),
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
      await put(mark);if(shopChoice)setPending(null);sessionStorage.removeItem('montmory-cart-edit-id');currentMarkSaved=true;syncNewMarkButtons();await render();setStatus('Trail Mark zum Warenkorb hinzugefügt. Du kannst weitere Trail Marks gestalten oder später im Rucksack den Demo-Abschluss starten.');
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
    sessionStorage.removeItem('montmory-cart-edit-id');sessionStorage.setItem('montmory-new-mark-step1','1');window.location.href=window.location.pathname+window.location.search+'#konfigurator';window.location.reload();
  }
  $('cartClearAll')?.addEventListener('click',async()=>{
    if(!confirm('Wirklich alle Trail Marks aus dem Rucksack entfernen? Diese Aktion kann nicht rückgängig gemacht werden.'))return;
    const button=$('cartClearAll');button.disabled=true;
    try{await clearAll();setShopBoard(0);setPending(null);sessionStorage.removeItem('montmory-cart-edit-id');markUnsaved();await render();setStatus('Dein Rucksack wurde vollständig geleert.');}
    catch(e){setStatus('Rucksack konnte nicht geleert werden: '+e.message);}
    finally{button.disabled=false;}
  });
  // Mobile: nach einem neuen Mark immer den GPX-Upload in Schritt 1 zeigen.
  if(sessionStorage.getItem('montmory-new-mark-step1')==='1'){
    sessionStorage.removeItem('montmory-new-mark-step1');
    window.addEventListener('load',()=>{
      const go=()=>{
        document.querySelector('[data-wizard-go="1"]')?.click();
        const upload=document.querySelector('.upload-card[data-wizard-step="1"]');
        if(upload){upload.scrollIntoView({behavior:'auto',block:'start'});}
      };
      requestAnimationFrame(()=>requestAnimationFrame(go));
    },{once:true});
  }
  $('cartNewMark')?.addEventListener('click',newMark);
  $('newMarkFromStep3')?.addEventListener('click',newMark);
  document.querySelectorAll('[data-shop-config]').forEach(button=>button.addEventListener('click',()=>{
    const kind=button.dataset.shopConfig;
    setPending(kind==='single'?null:{kind});
    document.querySelector('[data-wizard-go="1"]')?.click();
    document.querySelector('#konfigurator')?.scrollIntoView({behavior:'smooth',block:'start'});
    const label=kind==='starter'?'Starterpaket: Bitte eine GPX-Konfiguration für drei identische Trail Marks gestalten.':kind==='triple'?'3er-Set: Bitte eine GPX-Konfiguration für drei identische Trail Marks gestalten.':'Gestalte deinen Trail Mark.';
    const el=$('shopStatus');if(el)el.textContent=label;
  }));
  document.querySelector('[data-shop-board]')?.addEventListener('click',()=>{
    setShopBoard(shopBoard()+1);render().catch(e=>setStatus(e.message));
    const el=$('shopStatus');if(el)el.textContent='Sammelboard im Rucksack gespeichert.';
  });
  render().catch(e=>setStatus('Warenkorb konnte nicht geladen werden: '+e.message));
})();