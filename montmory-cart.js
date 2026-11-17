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
  const BOARD_TITLE_KEY='montmory-shop-board-title-v1';
  const BOARD_STYLE_KEY='montmory-shop-board-style-v1';
  const STARTER_STYLE_KEY='montmory-shop-starter-board-style-v1';
  const STARTER_TITLE_KEY='montmory-shop-starter-board-title-v1';
  const boardStyle=()=>localStorage.getItem(BOARD_STYLE_KEY)==='kompass'?'kompass':'berge';
  const setBoardStyle=value=>localStorage.setItem(BOARD_STYLE_KEY,value==='kompass'?'kompass':'berge');
  const starterStyle=()=>localStorage.getItem(STARTER_STYLE_KEY)==='kompass'?'kompass':'berge';
  const setStarterStyle=value=>localStorage.setItem(STARTER_STYLE_KEY,value==='kompass'?'kompass':'berge');
  const boardStyleName=value=>value==='kompass'?'Kompass & Weltkarte':'Bergpanorama';
  const cleanBoardTitle=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,55);
  const boardTitle=()=>cleanBoardTitle(localStorage.getItem(BOARD_TITLE_KEY))||'Meine Abenteuer';
  const setBoardTitle=value=>localStorage.setItem(BOARD_TITLE_KEY,cleanBoardTitle(value)||'Meine Abenteuer');
  const starterTitle=()=>cleanBoardTitle(localStorage.getItem(STARTER_TITLE_KEY))||'Meine Abenteuer';
  const setStarterTitle=value=>localStorage.setItem(STARTER_TITLE_KEY,cleanBoardTitle(value)||'Meine Abenteuer');
  const shopBoard=()=>Math.max(0,Math.min(10,Number(localStorage.getItem(SHOP_KEY))||0));
  const setShopBoard=n=>localStorage.setItem(SHOP_KEY,String(Math.max(0,Math.min(10,n))));
  const pendingKey='montmory-shop-pending-v1';
  const pending=()=>{try{return JSON.parse(sessionStorage.getItem(pendingKey)||'null')}catch{return null}};
  const setPending=p=>p?sessionStorage.setItem(pendingKey,JSON.stringify(p)):sessionStorage.removeItem(pendingKey);
  const bundleMarks=marks=>marks.filter(m=>m.bundleId);
  const completed=marks=>marks.filter(m=>!m.bundleId || marks.filter(x=>x.bundleId===m.bundleId).length===3);
  const bundleGroups=marks=>{const groups=new Map();for(const m of marks.filter(x=>x.bundleId)){if(!groups.has(m.bundleId))groups.set(m.bundleId,[]);groups.get(m.bundleId).push(m);}return groups;};
  const activeBundle=()=>{const p=pending();return p?.bundleId?p:null;};
  const bundleHint=()=>{
    const p=activeBundle();const node=$('montmoryBundleProgress');if(!node)return;
    node.hidden=!p;if(!p){node.replaceChildren();return;}
    const current=Math.min(3,(p.completed||0)+1);
    node.replaceChildren();
    const heading=document.createElement('p');heading.className='montmory-bundle-heading';
    heading.textContent=`${p.kind==='starter'?'Starterpaket · Board + 3 Marks':'3er-Set · 3 Marks'} — Mark ${current} von 3`;
    node.append(heading);
    const steps=document.createElement('div');steps.className='montmory-bundle-steps';
    steps.setAttribute('aria-label','Fortschritt der Trail Marks');
    for(let n=1;n<=3;n++){
      const chip=document.createElement('span');chip.className='montmory-bundle-step'+(n<current?' is-done':n===current?' is-current':'');
      chip.textContent=(n<current?'✓ ':'')+'Mark '+n;
      if(n===current)chip.setAttribute('aria-current','step');
      steps.append(chip);
    }
    node.append(steps);
  };
  const qty=m=>Math.max(1,Math.min(99,Number.parseInt(m.quantity,10)||1));
  const units=marks=>marks.reduce((sum,m)=>sum+qty(m),0);
  // A completed starter bundle includes exactly one board; it is not a separate paid board.
  const starterBundles=marks=>new Map(marks.filter(m=>m.bundle==='starter'&&m.bundleId).map(m=>[m.bundleId,m.boardStyle||'berge']));
  const boardCount=marks=>shopBoard()+starterBundles(marks).size;
  const boardDescription=marks=>{
    const descriptions=[];
    if(shopBoard())descriptions.push(`${shopBoard()} × einzelnes Sammelboard (${boardStyleName(boardStyle())})`);
    for(const style of starterBundles(marks).values())descriptions.push(`1 × Starterpaket-Sammelboard (${boardStyleName(style)})`);
    return descriptions.join(' · ');
  };
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
      const marks=completed(await all());if(!marks.length&&!shopBoard())return;
      const summary=$('cartDemoSummary');summary.replaceChildren();
      addText(summary,'strong',`${units(marks)} Trail Marks · ${boardCount(marks)} Sammelboard(s)`);
      const [low,high]=cartPrice(marks);addText(summary,'div',`Beispiel-Warenwert: ${euro(low)} – ${euro(high)}`);
      if(boardCount(marks))addText(summary,'div',boardDescription(marks));
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
    const billed=new Set();
    for(const m of completed(marks)){
      if(m.bundleId){if(billed.has(m.bundleId))continue;billed.add(m.bundleId);if(m.bundle==='starter'){low+=99.9;high+=129.9;}else{low+=39.9;high+=49.9;}}
      else if(m.bundle==='starter'){low+=99.9;high+=129.9;}
      else if(m.bundle==='triple'){low+=39.9;high+=49.9;}
      else{low+=qty(m)*14.9;high+=qty(m)*19.9;}}

    return [low,high];
  }
  async function render(){
    const marks=completed((await all()).sort((a,b)=>a.created-b.created)),list=$('cartItems');list.replaceChildren();
    const count=units(marks)+boardCount(marks);
    $('cartCount').textContent=`(${count})`;
    const packCount=$('montmoryPackCount'),packButton=$('montmoryPackShortcut');
    if(packCount)packCount.textContent=count>99?'99+':String(count);
    if(packButton)packButton.setAttribute('aria-label',`Rucksack öffnen: ${marks.length} Trail Mark${marks.length===1?'':'s'} gespeichert`);

    syncNewMarkButtons();
    $('cartEmpty').hidden=marks.length>0||shopBoard()>0||!!activeBundle();
    $('cartNewMark').hidden=marks.length===0 || !currentMarkSaved;
    if($('cartClearAll'))$('cartClearAll').hidden=marks.length===0&&shopBoard()===0&&!activeBundle();
    $('cartTotals').hidden=marks.length===0&&shopBoard()===0;
    if($('cartDemoStart'))$('cartDemoStart').disabled=marks.length===0&&shopBoard()===0;
    if(marks.length||shopBoard()){
      const totals=$('cartTotals');totals.replaceChildren();
      addText(totals,'h4','Zusammenfassung');
      addText(totals,'p',`${units(marks)} × Trail Mark · ${boardCount(marks)} × Sammelboard`);
      if(boardCount(marks))addText(totals,'p',boardDescription(marks));
      const [low,high]=cartPrice(marks);const total=addText(totals,'p',`${euro(low)} – ${euro(high)}`);total.className='cart-total-value';
      addText(totals,'p','Unverbindliche Beispielpreise · Versand noch offen');
    }
    if(shopBoard()){
      const article=document.createElement('article');article.className='shop-cart-product';
      addText(article,'h4','MONTMORY Sammelboard');
      addText(article,'p','Motiv: '+boardStyleName(boardStyle()));
      addText(article,'p',`${shopBoard()} Stück · je 59,90–89,90 € (Beispielpreis)`);
      const controls=document.createElement('div');
      const select=document.createElement('select');select.setAttribute('aria-label','Anzahl Sammelboards');
      for(let i=1;i<=10;i++){const o=document.createElement('option');o.value=String(i);o.textContent=i+' Stück';select.append(o);}
      select.value=String(shopBoard());select.addEventListener('change',()=>{setShopBoard(Number(select.value));render();});controls.append(select);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Entfernen';remove.addEventListener('click',()=>{setShopBoard(0);render();});controls.append(remove);article.append(controls);list.append(article);
    }
    const inProgress=activeBundle();
    if(inProgress){
      const notice=document.createElement('article');notice.className='montmory-bundle-in-progress';
      addText(notice,'h4',inProgress.kind==='starter'?'Starterpaket in Gestaltung':'3er-Set in Gestaltung');
      addText(notice,'p',`${inProgress.completed||0} von 3 Trail Marks gespeichert · Noch nicht im Warenwert enthalten`);
      const resume=document.createElement('button');resume.type='button';resume.className='primary-button';resume.textContent=`Trail Mark ${Math.min(3,(inProgress.completed||0)+1)} gestalten`;
      resume.addEventListener('click',()=>{closeCart();sessionStorage.setItem('montmory-new-mark-step1','1');window.location.href=window.location.pathname+window.location.search+'#konfigurator';window.location.reload();});
      notice.append(resume);list.prepend(notice);
    }
    const seenBundles=new Set();
    for(const mark of marks){
      if(mark.bundleId){
        if(seenBundles.has(mark.bundleId))continue;
        seenBundles.add(mark.bundleId);
        const group=marks.filter(x=>x.bundleId===mark.bundleId).sort((a,b)=>(a.bundleIndex||0)-(b.bundleIndex||0));
        const article=document.createElement('article');article.className='cart-item montmory-bundle-item';
        addText(article,'h4',mark.bundle==='starter'?'Starterpaket · Board + 3 Trail Marks':'3er-Set · 3 Trail Marks');
        const price=addText(article,'p',mark.bundle==='starter'?'99,90–129,90 € · Beispielpreis':'39,90–49,90 € · Beispielpreis');price.className='cart-item-price';
        if(mark.bundle==='starter'){
          addText(article,'p','1 × Sammelboard inklusive · Motiv: '+boardStyleName(mark.boardStyle));
        }
        for(const [i,part] of group.entries()){
          const partBox=document.createElement('div');partBox.className='montmory-bundle-part';
          addText(partBox,'h5',`${i+1}. ${part.title||'Trail Mark'}`);
          addText(partBox,'p',`${part.km||'–'} · ${part.hm||'–'} · ${part.date||'–'}`);
          const imgs=document.createElement('div');imgs.className='cart-item-images';
          for(const [label,svg] of [['Vorderseite',part.front],['Rückseite',part.back]]){
            const figure=document.createElement('figure');figure.style.margin='0';const img=document.createElement('img');img.src=svgImage(svg);img.alt=label+' – '+(part.title||'Trail Mark');img.loading='lazy';figure.append(img);addText(figure,'figcaption',label);imgs.append(figure);
          }partBox.append(imgs);
          const edit=document.createElement('button');edit.type='button';edit.className='review-cancel';edit.textContent='Mark bearbeiten';edit.addEventListener('click',async()=>{try{sessionStorage.setItem('montmory-cart-edit-id',part.id);closeCart();await restore(part);}catch(e){setStatus('Bearbeiten nicht möglich: '+e.message);}});partBox.append(edit);article.append(partBox);
        }
        const remove=document.createElement('button');remove.type='button';remove.className='review-cancel';remove.textContent='Gesamtes Paket entfernen';remove.addEventListener('click',async()=>{if(!confirm('Alle drei Marks und das Paket aus dem Rucksack entfernen?'))return;for(const part of group)await del(part.id);markUnsaved();await render();});article.append(remove);list.append(article);continue;
      }
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
      const mark={boardStyle:oldMark?.boardStyle||shopChoice?.boardStyle||null,boardTitle:oldMark?.boardTitle||shopChoice?.boardTitle||null,bundleId:oldMark?.bundleId||shopChoice?.bundleId||null,bundleIndex:oldMark?.bundleIndex||(shopChoice?.bundleId?(shopChoice.completed||0)+1:null),bundle:oldMark?.bundle||(shopChoice?.kind==='triple'||shopChoice?.kind==='starter'?shopChoice.kind:null),id:oldMark?.id||crypto.randomUUID?.()||String(Date.now())+'-'+Math.random(),created:oldMark?.created||Date.now(),
        quantity:oldMark?qty(oldMark):1,
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
      await put(mark);
      sessionStorage.removeItem('montmory-cart-edit-id');currentMarkSaved=true;syncNewMarkButtons();
      if(shopChoice?.bundleId){
        const next={...shopChoice,completed:(shopChoice.completed||0)+1};
        if(next.completed<3){
          setPending(next);
          bundleHint();
          setStatus(`Trail Mark ${next.completed} von 3 gespeichert. Weiter mit Trail Mark ${next.completed+1}.`);
          // Each package mark needs a fresh GPX and its own design. Reset to step 1
          // only after the previous mark has been persisted in IndexedDB.
          sessionStorage.setItem('montmory-bundle-notice',`Trail Mark ${next.completed} von 3 gespeichert. Jetzt Trail Mark ${next.completed+1} gestalten: neue GPX-Datei hochladen.`);
          sessionStorage.setItem('montmory-new-mark-step1','1');
          window.location.href=window.location.pathname+window.location.search+'#konfigurator';
          window.location.reload();
          return;
        }
        else{setPending(null);bundleHint();setStatus('Dein Paket mit drei unterschiedlichen Trail Marks ist vollständig im Rucksack.');const b=$('newMarkFromStep3');if(b)b.textContent='Weiteren Trail Mark gestalten';}
      }else{if(shopChoice)setPending(null);setStatus('Trail Mark zum Warenkorb hinzugefügt. Du kannst weitere Trail Marks gestalten oder später im Rucksack den Demo-Abschluss starten.');}
      await render();

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
  const boardShopCard=document.querySelector('[data-shop-board]')?.closest('.shop-product-body');
  const starterShopCard=document.querySelector('[data-shop-config="starter"]')?.closest('.shop-product-body');
  document.querySelectorAll('[data-shop-config]').forEach(button=>button.addEventListener('click',()=>{
    const kind=button.dataset.shopConfig;
    if(kind==='starter'){
      const choices=starterShopCard?.querySelector('[data-board-choices]');
      if(choices?.hidden){choices.hidden=false;button.innerHTML='Drei Marks gestalten <span aria-hidden="true">→</span>';choices.scrollIntoView({behavior:'smooth',block:'nearest'});return;}
    }
    if(kind==='starter'&&!starterShopCard?.querySelector('input[name="board-starter"]:checked')){
      const el=$('shopStatus');if(el)el.textContent='Bitte wähle zuerst ein Board für dein Starterpaket aus.';
      starterShopCard?.querySelector('[data-board-choices]')?.scrollIntoView({behavior:'smooth',block:'center'});return;
    }
    const existingDraft=activeBundle();
    if(existingDraft && existingDraft.kind!==kind && !confirm('Du gestaltest gerade ein Paket. Wenn du ein anderes Produkt auswählst, wird die laufende Paketgestaltung unterbrochen. Fortfahren?'))return;
    if(kind==='starter'||kind==='triple'){
      const existing=activeBundle();
      if(existing&&existing.kind===kind){setPending(existing);}else{setPending({kind,bundleId:crypto.randomUUID?.()||'bundle-'+Date.now(),completed:0,boardTitle:kind==='starter'?'MY ADVENTURES':null,boardStyle:kind==='starter'?starterStyle():null});}
    }else setPending(null);
    bundleHint();
    document.querySelector('[data-wizard-go="1"]')?.click();
    document.querySelector('#konfigurator')?.scrollIntoView({behavior:'smooth',block:'start'});
    const label=kind==='starter'?'Starterpaket: Gestalte drei unterschiedliche Trail Marks, jeweils mit eigener GPX-Datei.':kind==='triple'?'3er-Set: Gestalte drei unterschiedliche Trail Marks.':'Gestalte deinen Trail Mark.';
    const el=$('shopStatus');if(el)el.textContent=label;
  }));
  // Beide Produkte haben eigene, voneinander unabhängige Board-Motive und Überschriften.
  document.querySelectorAll('[data-board-choices]').forEach(fieldset=>{
    const isStarter=!!fieldset.querySelector('input[name="board-starter"]');
    const getStyle=isStarter?starterStyle:boardStyle;
    const saveStyle=isStarter?setStarterStyle:setBoardStyle;
    const radios=[...fieldset.querySelectorAll('input[type=radio]')];
    radios.forEach(r=>{
      r.checked=false;
      r.addEventListener('change',()=>{
        if(!r.checked)return;
        saveStyle(r.value);
        // Absichtlich nur die Auswahl im aktuellen Produkt aktualisieren.
      });
    });
  });
  document.querySelector('[data-shop-board]')?.addEventListener('click',()=>{
    const choices=boardShopCard?.querySelector('[data-board-choices]');
    if(choices?.hidden){choices.hidden=false;document.querySelector('[data-shop-board]').innerHTML='In den Rucksack legen <span aria-hidden="true">→</span>';choices.scrollIntoView({behavior:'smooth',block:'nearest'});return;}

    if(!boardShopCard?.querySelector('input[name="board-alone"]:checked')){
      const el=$('shopStatus');if(el)el.textContent='Bitte wähle zuerst dein Sammelboard aus.';
      boardShopCard?.querySelector('[data-board-choices]')?.scrollIntoView({behavior:'smooth',block:'center'});return;
    }
    setShopBoard(shopBoard()+1);render().catch(e=>setStatus(e.message));
    const el=$('shopStatus');if(el)el.textContent='Sammelboard im Rucksack gespeichert.';
  });
  const bundleNotice=sessionStorage.getItem('montmory-bundle-notice');if(bundleNotice){sessionStorage.removeItem('montmory-bundle-notice');setStatus(bundleNotice);}
  bundleHint();render().catch(e=>setStatus('Warenkorb konnte nicht geladen werden: '+e.message));
})();