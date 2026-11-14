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
      customerName:$('customerName')?.value,customerEmail:$('customerEmail')?.value,customerNote:$('customerNote')?.value,
      layout:JSON.stringify(window.MONTMORY_LAYOUT?.layout)});
  }
  function reset(){
    previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];
    review=null;window.MontmoryV64 && (window.MontmoryV64.lastReview=null);panel.hidden=true;button.textContent='Bestellung prüfen →';
  }
  function invalidate(){if(!review || busy)return;reset();status.textContent='Änderung erkannt. Bitte die Konfiguration erneut prüfen.';}
  ['gpxFile','titleInput','distanceInput','gainInput','markWidthMM','markHeightMM','includeOuterContour','giftEnabled','giftMessage','customerName','customerEmail','customerNote'].forEach(id=>{
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
  function mailto(){
    const mode=document.querySelector('input[name="profileMode"]:checked')?.value;
    const title=$('titleInput')?.value?.trim() || 'Meine Tour';
    const subject=`MONTMORY ${review.orderNumber} - ${title}`;
    const body=[
      'Hallo MONTMORY,','',
      'ich moechte folgende Konfiguration anfragen:','',
      `Bestellnummer: ${review.orderNumber}`,
      `Kunde: ${$('customerName')?.value.trim()}`,
      `E-Mail Kunde: ${$('customerEmail')?.value.trim()}`,
      `Nachricht: ${$('customerNote')?.value.trim() || 'Keine'}`,
      `Tour: ${title}`,
      `Widmung: ${window.MontmoryGift?.text() || 'Keine'}`,
      `Strecke: ${$('previewDistance')?.textContent || '-'}`,
      `Hoehenmeter: ${$('previewGain')?.textContent || '-'}`,
      `Dauer: ${$('previewDuration')?.textContent || '-'}`,
      `Datum: ${$('previewDate')?.textContent || '-'}`,
      `Vorderseite: ${mode==='route'?'Route':'Hoehenprofil'}`,
      `Rueckseite: ${mode==='route'?'Hoehenprofil':'Route'}`,
      '',
      'ANHANG: Bitte die heruntergeladene ZIP-Bestelldatei an diese E-Mail anhaengen:',
      `${review.orderNumber}_MONTMORY_Bestellung.zip`,
      '',
      'Hinweis: Diese Nachricht wurde im MONTMORY-Konfigurator vorbereitet. Der Versand erfolgt erst nach manuellem Klick auf Senden.'
    ].join('\n');
    return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  button.addEventListener('click',async()=>{
    if(busy)return;busy=true;button.disabled=true;
    try{
      if(!review){
        if(!(window.__montmoryImportState?.status==='ready' && window.__trailMarkLastResult && window.__montmoryGpxFile))
          throw new Error('Bitte zuerst eine gültige GPX-Datei hochladen.');
        if(!$('customerName')?.value.trim())throw new Error('Bitte deinen Namen eingeben.');
        if(!$('customerEmail')?.checkValidity())throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
        status.textContent='Vorschau wird vorbereitet …';
        const before=signature();
        const [front,back]=await Promise.all([
          window.MontmorySvgExport.createSvg('front'),
          window.MontmorySvgExport.createSvg('back')
        ]);
        if(signature()!==before)throw new Error('Einstellungen geändert. Bitte erneut prüfen.');
        if(!window.MontmoryV64 || typeof window.MontmoryV64.orderNumber!=='function' || typeof window.MontmoryV64.check!=='function') throw new Error('Gravurprüfung konnte nicht geladen werden. Bitte Seite vollständig neu laden.');
        const orderNumber=window.MontmoryV64.orderNumber();
        const warnings=await window.MontmoryV64.check(front.svg,back.svg);
        warnings.push(...window.MontmoryV71.validateSvg(front.svg,'Vorderseite'));
        warnings.push(...window.MontmoryV71.validateSvg(back.svg,'Rückseite'));
        review={front,back,signature:before,orderNumber,warnings};
        $('orderNumberDisplay').textContent=`Bestellnummer: ${orderNumber}`;
        const summary=$('customerSummary');
        summary.replaceChildren();
        for(const [key,value] of [['Name',$('customerName').value.trim()],['E-Mail',$('customerEmail').value.trim()],['Tour',$('titleInput').value.trim()],['Widmung',window.MontmoryGift?.text()||'Keine'],['Nachricht',$('customerNote').value.trim()||'Keine']]){
          const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=key+': ';p.append(strong,document.createTextNode(value));summary.append(p);
        }
        window.MontmoryV64.showWarnings($('engravingCheck'),warnings);
        window.MontmoryV64.lastReview=review;
        preview('orderPreviewFront',front.svg);preview('orderPreviewBack',back.svg);
        panel.hidden=false;button.textContent='ZIP herunterladen und E-Mail öffnen';
        status.textContent='Beide Seiten prüfen. Beim nächsten Klick wird eine ZIP-Bestelldatei heruntergeladen und die E-Mail-App geöffnet.';
        panel.scrollIntoView({behavior:'smooth',block:'nearest'});
      }else{
        if(signature()!==review.signature){reset();throw new Error('Einstellungen geändert. Bitte erneut prüfen.');}
        // Downloads sind Browser-abhängig; ggf. Mehrfachdownloads erlauben.
        if(review.warnings.some(w=>w.level==='error')) throw new Error('Gravurprüfung meldet einen kritischen Fehler. Bitte die Konfiguration korrigieren.');
        await window.MontmoryZipOrder.download(review);
        const url=mailto();
        status.textContent='Bestell-ZIP wurde zum Download angeboten. Bitte die ZIP-Datei an die vorbereitete E-Mail anhängen und dort auf Senden klicken. Die Bestellung ist erst nach dem E-Mail-Versand übermittelt.';
        const link=$('openEmailDraft');
        if(link){link.href=url;link.hidden=false;}
        // Auf Mobilgeräten kann das Öffnen der Mail-App nach einem asynchronen Download blockiert werden.
        // Deshalb bleibt ein expliziter, verlässlicher Link sichtbar.
        try { window.location.href=url; } catch (_) { /* manueller Link bleibt verfügbar */ }
      }
    }catch(e){status.textContent=`Aktion nicht abgeschlossen: ${e.message}`;}
    finally{busy=false;button.disabled=false;}
  });
})();
