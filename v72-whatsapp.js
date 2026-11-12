/* MONTMORY V72: WhatsApp-Kontakt ohne API, keine automatische Bestellung. */
(()=>{'use strict';
const phone='4915786644894';
const $=id=>document.getElementById(id);
const link=(message)=>`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
function update(){
 const general=$('whatsappGeneral');
 if(general)general.href=link('Hallo MONTMORY! Ich habe eine Frage zu euren personalisierten Trail Marks.');
 const order=$('whatsappOrder');if(!order)return;
 const title=$('titleInput')?.value?.trim()||'noch nicht angegeben';
 const number=$('orderNumberDisplay')?.textContent?.match(/MM-\d{8}-[A-Za-z0-9]+/)?.[0]||'';
 const msg=['Hallo MONTMORY! Ich habe eine Frage zu meiner Trail-Mark-Konfiguration.',
  `Tour: ${title}`,
  ...(number?[`Bestellnummer: ${number}`]:[]),
  'Meine Frage: '].join('\n');
 order.href=link(msg);
}
update();
['input','change'].forEach(evt=>document.addEventListener(evt,update));
// Die Bestellnummer wird erst beim Erstellen der Vorschau erzeugt.
$('sendConfiguration')?.addEventListener('click',()=>setTimeout(update,0));
})();
