/* MONTMORY V62: Vorschau -> zwei Downloads -> mailto Entwurf.
   Browser können E-Mail-Anhänge NICHT automatisch setzen. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const button=$('sendConfiguration'), panel=$('orderReview'), status=$('sendConfigurationStatus');
  if (!button || !panel || !status) return;
  const recipient='florianmachoczek@t-online.de';
  let review=null, busy=false, previewUrls=[];
  function signature(){
    const f=window.__montmoryGpxFile || $('gpxFile')?.files?.[0];
    return JSON.stringify({gpx:f?[f.name,f.size,f.lastModified]:null,
      title:$('titleInput')?.value,km:$('distanceInput')?.value,hm:$('gainInput')?.value,
      mode:document.querySelector('input[name="profileMode"]:checked')?.value,
      width:$('markWidthMM')?.value,height:$('markHeightMM')?.value,
      contour:$('includeOuterContour')?.checked,
      gift:$('giftEnabled')?.checked, giftText:$('giftMessage')?.value,
      shippingStreet:$('shippingStreet')?.value,shippingPostal:$('shippingPostal')?.value,shippingCity:$('shippingCity')?.value,shippingCountry:$('shippingCountry')?.value,customerName:$('customerName')?.value,customerEmail:$('customerEmail')?.value,customerNote:$('customerNote')?.value,
      layout:JSON.stringify(window.MONTMORY_LAYOUT?.layout)});
  }
  function reset(){
    previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];
    review=null;window.MontmoryV64 && (window.MontmoryV64.lastReview=null);panel.hidden=true;button.textContent='Unverbindliche Übersicht anzeigen →';
  }
  function invalidate(){if(!review || busy)return;reset();status.textContent='Änderung erkannt. Bitte die Konfiguration erneut prüfen.';}
  ['gpxFile','titleInput','distanceInput','gainInput','markWidthMM','markHeightMM','includeOuterContour','giftEnabled','giftMessage','customerName','customerEmail','customerNote','shippingStreet','shippingPostal','shippingCity','shippingCountry'].forEach(id=>{
    $(id)?.addEventListener('change',invalidate);
    $(id)?.addEventListener('input',invalidate);
  });
  document.querySelectorAll('input[name="profileMode"]').forEach(el=>el.addEventListener('change',invalidate));
  $('cancelOrderReview')?.addEventListener('click',()=>{reset();status.textContent='Du kannst die Konfiguration weiter bearbeiten.';});
  function preview(id,svg){
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    previewUrls.push(url);$(id).src=url;
  }
  function download(result){
    const url=URL.createObjectURL(new Blob([result.svg],{type:'image/svg+xml;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=result.filename;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
  button.addEventListener('click',async()=>{
    if(busy)return;busy=true;button.disabled=true;
    try{
      if(!review){
        if(!(window.__montmoryImportState?.status==='ready' && window.__trailMarkLastResult && window.__montmoryGpxFile))
          throw new Error('Bitte zuerst eine gültige GPX-Datei hochladen.');


        status.textContent='Vorschau wird vorbereitet …';
        const before=signature();
        const [front,back]=await Promise.all([
          window.MontmorySvgExport.createSvg('front'),
          window.MontmorySvgExport.createSvg('back')
        ]);
        if(signature()!==before)throw new Error('Einstellungen geändert. Bitte erneut prüfen.');
        if(!window.MontmoryV64 || typeof window.MontmoryV64.check!=='function') throw new Error('Gravurprüfung konnte nicht geladen werden. Bitte Seite vollständig neu laden.');
        const orderNumber=null;
        const warnings=await window.MontmoryV64.check(front.svg,back.svg);
        warnings.push(...window.MontmoryV71.validateSvg(front.svg,'Vorderseite'));
        warnings.push(...window.MontmoryV71.validateSvg(back.svg,'Rückseite'));
        review={front,back,signature:before,orderNumber,warnings};

        const summary=$('customerSummary');
        summary.replaceChildren();
        const mode=document.querySelector('input[name="profileMode"]:checked')?.value;
        const details=[
          ['Produkt','1 × individuell gestalteter MONTMORY Trail Mark'],
          ['Tour',$('titleInput')?.value?.trim()||'Meine Tour'],
          ['Distanz',$('previewDistance')?.textContent||'–'],
          ['Höhenmeter',$('previewGain')?.textContent||'–'],
          ['Datum',$('previewDate')?.textContent||'–'],
          ['Vorderseite',mode==='route'?'Route':'Höhenprofil'],
          ['Rückseite',mode==='route'?'Höhenprofil':'Route'],
          ['Zielort',window.MontmoryDestination?.get?.()||'Nicht eingeblendet'],
          ['Widmung',window.MontmoryGift?.text?.()||'Keine']
        ];
        for(const [key,value] of details){
          const row=document.createElement('p');const strong=document.createElement('strong');
          strong.textContent=key+': ';row.append(strong,document.createTextNode(value));summary.append(row);
        }
        window.MontmoryV64.showWarnings($('engravingCheck'),warnings);
        window.MontmoryV64.lastReview=review;
        preview('orderPreviewFront',front.svg);preview('orderPreviewBack',back.svg);
        panel.hidden=false;button.textContent='Übersicht aktualisieren';
        status.textContent='Unverbindliche Übersicht erstellt. Es wird keine Bestellung ausgelöst.';
        panel.scrollIntoView({behavior:'smooth',block:'nearest'});
      }else{
        reset();
        status.textContent='Änderungen kannst du oben vornehmen und anschließend die Übersicht neu anzeigen.';
      }
    }catch(e){status.textContent=`Aktion nicht abgeschlossen: ${e.message}`;}
    finally{busy=false;button.disabled=false;}
  });
})();
