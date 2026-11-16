/* MONTMORY V58 – LightBurn-kompatibler SVG-Vektorexport.
   Reine Gravurdaten, keine Schnittkontur. SVG-Text bleibt editierbar.
   Physische GLB-Abmessungen 60 x 83 mm; Layout aus JSON basiert auf 70 x 90 mm.
   Vor Produktion Maße und Positionen in LightBurn kontrollieren. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"
  }[ch]));
  const num = n => Number(n).toFixed(2);
  const valid = p => Number.isFinite(+p.distance) && Number.isFinite(+p.elevation);
  function layout() {
    if (!window.MONTMORY_LAYOUT?.layout?.front || !window.MONTMORY_LAYOUT?.layout?.back) {
      return Promise.reject(new Error("Die eingebetteten Layoutdaten fehlen."));
    }
    return Promise.resolve(window.MONTMORY_LAYOUT);
  }
  function profilePath(points, x, y, w, h) {
    const clean = (points || []).filter(valid);
    if (clean.length < 2) return "";
    const ds = clean.map(p => +p.distance);
    const es = clean.map(p => +p.elevation);
    const minD = Math.min(...ds), maxD = Math.max(...ds);
    const minE = Math.min(...es), maxE = Math.max(...es);
    const spanD = Math.max(1e-9, maxD-minD), spanE = Math.max(1e-9,maxE-minE);
    // Proportionen für GPX-Draufsicht erhalten, damit die Strecke nicht verzerrt wird.
    const isRoute = clean.every(p => +p.distance >= 0 && +p.distance <= 1.00001 &&
                                        +p.elevation >= 0 && +p.elevation <= 1.00001);
    let actualW=w, actualH=h;
    if (isRoute) {
      const ratio=spanD/spanE;
      if (ratio > w/h) actualH=w/ratio;
      else actualW=h*ratio;
    }
    const ox=x+(w-actualW)/2, oy=y+(h-actualH)/2;
    return clean.map((p,i) => `${i?"L":"M"}${num(ox+(+p.distance-minD)/spanD*actualW)} ${num(oy+actualH-(+p.elevation-minE)/spanE*actualH)}`).join(" ");
  }
  // LightBurn ignoriert SVG-stroke-width bei "Linie". Deshalb erzeugen wir
  // eine echte, schmale, geschlossene Fläche von 0,18 mm für den Modus "Füllen".
  function makeFineRibbon(points, thicknessMM = 0.18) {
    if (points.length < 2) return "";
    const mmW = getDimension("markWidthMM",60);
    const mmH = getDimension("markHeightMM",80);
    const sx=mmW/1024, sy=mmH/1152;
    const pts=points.map(p=>({x:p.x*sx,y:p.y*sy}))
      .filter((p,i,a)=>i===0 || Math.hypot(p.x-a[i-1].x,p.y-a[i-1].y)>0.00001);
    if(pts.length<2)return "";
    const half=thicknessMM/2;
    const normals=[];
    for(let i=0;i<pts.length-1;i++){
      const dx=pts[i+1].x-pts[i].x,dy=pts[i+1].y-pts[i].y;
      const len=Math.hypot(dx,dy);
      normals.push({x:-dy/len,y:dx/len});
    }
    const left=[],right=[];
    for(let i=0;i<pts.length;i++){
      const a=normals[Math.max(0,i-1)],b=normals[Math.min(normals.length-1,i)];
      let nx=a.x+b.x,ny=a.y+b.y;
      const dot=nx*b.x+ny*b.y;
      const len=Math.hypot(nx,ny);
      const scale=len>0.001 ? Math.min(2,1/Math.max(0.5,dot/len))/len : 1;
      nx*=scale*half; ny*=scale*half;
      left.push({x:pts[i].x+nx,y:pts[i].y+ny});
      right.push({x:pts[i].x-nx,y:pts[i].y-ny});
    }
    const coords=left.concat(right.reverse());
    return coords.map((p,i)=>(i?"L":"M")+num(p.x/sx)+" "+num(p.y/sy)).join(" ")+" Z";
  }
  // Gleich breite Gravur wie beim Höhenprofil: echte 0,18-mm-Fläche.

  // Labelposition in der Routenbox: Abstand zu ALLEN Liniensegmenten pruefen.
  function placeRouteDestination(points, box, label, measure) {
    if (!points || points.length < 2 || !label) return null;
    const end=points[points.length-1], pad=12, clearance=13;
    const inside=(r)=>r.left>=box.x+6 && r.right<=box.x+box.width-6 &&
      r.top>=box.y+6 && r.bottom<=box.y+box.height-6;
    function segmentHitsRect(a,b,r) {
      const left=r.left-clearance,right=r.right+clearance,top=r.top-clearance,bottom=r.bottom+clearance;
      if(Math.max(a.x,b.x)<left || Math.min(a.x,b.x)>right ||
         Math.max(a.y,b.y)<top || Math.min(a.y,b.y)>bottom) return false;
      if((a.x>=left&&a.x<=right&&a.y>=top&&a.y<=bottom) ||
         (b.x>=left&&b.x<=right&&b.y>=top&&b.y<=bottom))return true;
      const cross=(c,d,e)=>(d.x-c.x)*(e.y-c.y)-(d.y-c.y)*(e.x-c.x);
      const intersect=(c,d,e,f)=>{
        const u=cross(c,d,e),v=cross(c,d,f),w=cross(e,f,c),z=cross(e,f,d);
        return ((u<=0&&v>=0)||(u>=0&&v<=0))&&((w<=0&&z>=0)||(w>=0&&z<=0));
      };
      const corners=[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
      return corners.some((c,i)=>intersect(a,b,c,corners[(i+1)%4]));
    }
    const words=label.trim().split(/\s+/);
    // Two words: try one line at full size, then two lines before shrinking.
    const layouts=words.length===2 ? [
      {fontSize:40,lines:[label]},
      ...[40,36,32,28,24,20].map(fontSize=>({fontSize,lines:words})),
      ...[36,32,28,24,20].map(fontSize=>({fontSize,lines:[label]}))
    ] : [40,36,32,28,24,20].map(fontSize=>({fontSize,lines:[label]}));
    for(const {fontSize,lines} of layouts) {
      const lineHeight=fontSize*1.3;
      const width=Math.max(...lines.map(line=>measure(fontSize,line)));
      const height=fontSize*1.22+(lines.length-1)*lineHeight;
      if(width>box.width-24)continue;
      const offsets=[
        [22,-height-20],[-width-22,-height-20],
        [22,20],[-width-22,20],
        [-width/2,-height-34],[-width/2,34],
        [34,-height/2],[-width-34,-height/2]
      ];
      const candidates=offsets.map(([dx,dy])=>({left:end.x+dx,top:end.y+dy}));
      // In engen Routen: freie Position in der Naehe des Zielpunkts suchen.
      for(let yy=box.y+8; yy<=box.y+box.height-height-8;yy+=18)
        for(let xx=box.x+8;xx<=box.x+box.width-width-8;xx+=18)
          candidates.push({left:xx,top:yy});
      const good=candidates.map(c=>({...c,right:c.left+width,bottom:c.top+height}))
        .filter(inside)
        .filter(r=>!points.slice(1).some((pt,i)=>segmentHitsRect(points[i],pt,r)))
        .sort((a,b)=>Math.hypot(a.left+width/2-end.x,a.top+height/2-end.y)-
                     Math.hypot(b.left+width/2-end.x,b.top+height/2-end.y));
      if(good.length)return {x:good[0].left,y:good[0].top+fontSize*0.61,fontSize,lineHeight,lines};
    }
    return null; // Keine sichere Position: keine ueberlappende Gravur erzeugen.
  }

  function routeSvg(points, box) {
    const coords=window.MontmoryRouteGeometry?.fit(
      points,box.x,box.y,box.width,box.height,
      getDimension("markWidthMM",60),getDimension("markHeightMM",80)
    ) || [];
    if(coords.length<2)return "";
    const path=makeFineRibbon(coords,0.18);
    const destination=window.MontmoryDestination?.get() || '';
    let label='';
    if(destination) {
      const end=coords[coords.length-1];
      const position=placeRouteDestination(coords,box,destination,
        (fontSize,line)=>line.length*fontSize*0.61);
      if(position) {
        const lines=position.lines.map((line,i)=>`<text x="${num(position.x)}" y="${num(position.y+i*position.lineHeight)}" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${position.fontSize}" font-weight="600" fill="black">${esc(line)}</text>`).join('');
        label=`<g id="zielort-am-streckenende"><circle cx="${num(end.x)}" cy="${num(end.y)}" r="11" fill="black"/>${lines}</g>`;
      }

    }
    return `<path id="route-fein-018mm" d="${path}" fill="#0000ff" stroke="none"/>${label}`;
  }
  function elevationSvg(points, box) {
    const axis = window.MontmoryElevationAxis?.get(points);
    if (!axis) return "";
    const x=box.x, y=box.y, w=box.width, h=box.height;
    const offset=Math.min(155,w*0.24), chartX=x+offset, chartW=w-offset;
    const lo=axis.bottom, hi=axis.top, range=Math.max(1e-9,hi-lo);
    const ds=points.map(pt=>Number(pt.distance));
    const minD=Math.min(...ds), maxD=Math.max(...ds), span=Math.max(1e-9,maxD-minD);
    const labels=axis.ticks.map(t=>{
      const py=y+h-(t-lo)/range*h;
      return `<text x="${num(chartX-12)}" y="${num(py)}" text-anchor="end" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="29" font-weight="600" fill="black">${esc(window.MontmoryElevationAxis.format(t))}</text><path d="M${num(chartX)} ${num(py)} L${num(chartX+chartW)} ${num(py)}" stroke="black" stroke-width="2.4" stroke-dasharray="8 7" fill="none"/>`;
    }).join("");
    // Feine EINZELNE Mittellinie: keine gefüllte Kontur, keine Selbstüberschneidungen.
    // Die LightBurn-Liniengravur fährt diesen Pfad genau einmal ab.
    const coords=points.map(pt=>({
      x:chartX+(Number(pt.distance)-minD)/span*chartW,
      y:y+h-(Number(pt.elevation)-lo)/range*h
    }));
    const d=makeFineRibbon(coords,0.18);
    return `<g id="hoehenangaben-und-profil">${labels}<path id="hoehenprofil-fein-018mm" d="${d}" fill="#0000ff" stroke="none"/></g>`;
  }
  function txt(value, slot, fallback) {
    const s=slot || fallback;
    if (!s) return "";
    const text=String(value ?? "");
    const max=Number(s.maxWidth) || 650;
    const initial=Number(s.fontSize) || 40;
    const min=Number(s.minFontSize) || initial;
    let size=initial;
    // Genau dieselbe 2-px-Verkleinerung wie die Canvas-Vorschau.
    const canvas=document.createElement("canvas");
    const ctx=canvas.getContext("2d");
    let measured=0;
    if (ctx) {
      while (size > min) {
        ctx.font=`500 ${size}px Arial, Helvetica, sans-serif`;
        if (ctx.measureText(text).width <= max) break;
        size-=2;
      }
      ctx.font=`500 ${size}px Arial, Helvetica, sans-serif`;
      measured=ctx.measureText(text).width;
    }
    // Auch bei Erreichen der Mindestgröße darf nichts über den Rand ragen.
    const constrain=measured>max ? ` textLength="${num(max)}" lengthAdjust="spacingAndGlyphs"` : "";
    return `<text x="${num(s.x)}" y="${num(s.y)}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="${num(size)}" font-weight="500"${constrain} data-original-font-size="${num(initial)}">${esc(text)}</text>`;
  }
  function line(x1,y1,x2,y2,width=3) {
    return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="black" stroke-width="${width}" fill="none"/>`;
  }
  const MONTMORY_MOUNTAIN_PATH = 'M752 401 L745 403 L740 413 L751 404 Z M674 341 L668 352 L674 346 Z M799 296 L792 303 L790 308 Z M1256 446 L1182 371 L1174 368 L1158 367 L1111 310 L1102 308 L1087 314 L1084 313 L1038 270 L1029 272 L1006 289 L997 292 L957 251 L948 245 L879 174 L874 175 L826 222 L806 247 L792 253 L757 291 L730 276 L723 268 L719 266 L712 267 L646 330 L624 356 L605 350 L598 352 L495 446 L524 429 L585 382 L602 374 L603 377 L592 404 L610 387 L647 343 L664 326 L713 284 L715 285 L707 313 L707 318 L711 317 L713 319 L712 323 L692 349 L677 363 L695 359 L697 361 L696 364 L687 371 L679 381 L634 417 L614 436 L642 419 L707 386 L727 393 L723 385 L725 381 L754 366 L755 367 L745 375 L743 380 L769 363 L772 363 L777 371 L765 392 L755 402 L767 398 L793 379 L842 414 L827 395 L803 371 L797 361 L825 333 L842 320 L849 311 L794 342 L793 340 L807 320 L812 306 L796 324 L768 349 L749 351 L735 350 L727 353 L725 345 L718 344 L717 342 L733 330 L798 260 L804 258 L804 265 L795 281 L806 271 L820 244 L876 187 L881 196 L879 221 L886 228 L886 232 L874 252 L863 277 L842 304 L864 291 L893 267 L899 278 L899 289 L901 293 L922 313 L934 321 L939 338 L951 351 L958 367 L980 393 L975 371 L968 354 L969 350 L999 377 L1015 397 L1027 402 L1025 396 L1027 389 L1072 415 L1133 445 L1082 394 L1043 350 L1044 348 L1066 355 L1098 376 L1090 350 L1079 338 L1087 331 L1102 349 L1104 346 L1110 349 L1124 372 L1130 378 L1136 380 L1158 403 L1152 387 L1153 385 L1172 395 L1175 394 L1223 430 L1250 446 Z M1089 330 L1102 320 L1120 339 L1124 347 L1119 344 L1113 344 L1103 336 L1098 337 Z M1056 310 L1060 316 L1059 318 L1055 312 Z M970 311 L972 310 L976 314 L983 316 L1003 338 L986 327 Z M1051 301 L1055 307 L1054 309 L1050 303 Z M1033 281 L1035 288 L1041 294 L1045 303 L1043 309 L1045 324 L1032 332 L1007 302 Z M887 198 L921 236 L931 261 L939 267 L943 277 L965 304 L964 305 L923 261 L924 252 L902 224 L887 202 Z';
  function divider(y, span) {
    const scale = 0.12614980;
    const left = 512 - 48.0000;
    const tx = left - 495 * scale;
    const ty = y - 39.1695;
    const symbol = `<path d="${MONTMORY_MOUNTAIN_PATH}" transform="translate(${num(tx)} ${num(ty)}) scale(${num(scale)})" fill="black" fill-rule="evenodd"/>`;
    const gap=65;
    return `<g id="trennlinie-montmory">${line(512-span/2,y,512-gap,y,3)}${symbol}${line(512+gap,y,512+span/2,y,3)}</g>`;
  }
    const OUTER_CONTOUR_MM = 'M0.06639 14.36194 L0.39492 13.39090 L0.97646 12.53715 L1.77018 11.86049 L2.40955 11.52375 L30.00000 0.00000 L57.59045 11.52375 L58.22982 11.86049 L59.02354 12.53715 L59.60508 13.39090 L59.93361 14.36194 L60.00000 15.06125 L60.00000 74.21688 L59.79557 75.71368 L59.19615 77.10840 L58.24266 78.30618 L57.00000 79.22521 L55.55291 79.80292 L54.00000 80.00000 L6.00000 80.00000 L4.44709 79.80292 L3.00000 79.22521 L1.75734 78.30618 L0.80385 77.10840 L0.20443 75.71368 L0.00000 74.21688 L0.00000 15.06125 L0.06639 14.36194 Z';
  function getDimension(id, fallback) {
    const value = Number($(id)?.value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
  function svgDoc(side, parts) {
    const width = getDimension('markWidthMM', 60);
    const height = getDimension('markHeightMM', 80);
    const sx = width / 60;
    const sy = height / 80;
    // Die Außenkontur ist als eigenständiger Pfad in Millimetern definiert.
    // Die Gravur wird in dieselben physischen Koordinaten transformiert.
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}mm" height="${num(height)}mm" viewBox="0 0 ${num(width)} ${num(height)}">
<title>MONTMORY Trail Mark ${side === 'front' ? 'Vorderseite' : 'Rückseite'}</title>
<desc>LightBurn: Außenkontur aus GLB, in mm kalibriert. Außenmaß ${num(width)} x ${num(height)} mm. Roten Konturlayer nur nach Prüfung ausgeben.</desc>
<g id="gravur" transform="scale(${num(width/1024)} ${num(height/1152)})" fill="black" stroke="none">${parts.join("\n")}</g>
${$("includeOuterContour")?.checked ? `<g id="Aussenkontur_60x80mm" transform="scale(${num(sx)} ${num(sy)})" fill="none" stroke="#ff0000" stroke-width="0.08"><path id="mark-aussenkontur" d="${OUTER_CONTOUR_MM}"/></g>` : ''}
</svg>`;
  }
  function save(text, filename) {
    const blob=new Blob([text],{type:"image/svg+xml;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function createSvg(side) {
    {
      if (!window.__trailMarkLastResult || !Array.isArray(currentTrackPoints) || currentTrackPoints.length<2) {
        throw new Error("Bitte zuerst eine gültige GPX-Datei hochladen.");
      }
      const config=await layout();
      const f=config.layout.front, b=config.layout.back;
      const shown = (key) => !config.hidden?.[`${side}:${key}`];
      const show = (side,key) => !config.hidden?.[`${side}:${key}`];
      const mode=getProfileMode();
      const elevation=window.__trailMarkLastResult.profile || [];
      const route=buildRouteGraphic(currentTrackPoints);
      const front=mode==="route"?route:elevation;
      const back=mode==="route"?elevation:route;
      const title=currentTitle || "Meine Tour";
      const parts=[];
      if (side==="front") {
        if(show("front","title")) if(shown("title")) parts.push(`<g id="titel">${txt(title,f.title)}</g>`);
        const box=f.profile;
        const d=profilePath(front,box.x,box.y,box.width,box.height);
        if(d && show("front","profile")) parts.push(mode === "elevation"
          ? elevationSvg(front,box)
          : routeSvg(front,box));
        if(show("front","divider")) parts.push(divider(f.divider?.y ?? 715,f.divider?.width ?? 780));
        if(show("front","distance")) parts.push(`<g id="strecke">${txt($("previewDistance")?.textContent,f.distance)}</g>`);
        if(show("front","gain")) parts.push(`<g id="hoehenmeter">${txt($("previewGain")?.textContent,f.gain)}</g>`);
        if(show("front","duration")) parts.push(`<g id="dauer">${txt($("previewDuration")?.textContent,f.duration)}</g>`);
        const destination=window.MontmoryDestination?.get() || '';
        if(show("front","date")) parts.push(`<g id="datum">${txt($("previewDate")?.textContent,f.date)}</g>`);
      } else {
        if(show("back","title")) if(shown("title")) parts.push(`<g id="titel">${txt(title,b.title)}</g>`);
        const d=profilePath(back,b.profile?.x ?? 150,b.profile?.y ?? 345,b.profile?.width ?? 724,b.profile?.height ?? 270);
        if(d && show("back","profile")) parts.push(mode === "route"
          ? elevationSvg(back, b.profile)
          : routeSvg(back,b.profile));
        if(show("back","divider")) parts.push(divider(b.divider?.y ?? 655,b.divider?.width ?? 760));
        // Markenblock als editierbarer Text; bildbasiertes Logo wird nicht als Vektor vorgetäuscht.
        parts.push(`<g id="markenblock">${show("back","brand1") ? txt("MONTMORY",b.brand1) : ""}${show("back","slogan") ? txt("From Mountains to Memories.",b.slogan) : ""}${show("back","country") ? txt(window.MontmoryGift?.text() || "", {...b.country,minFontSize:26}) : ""}</g>`);
      }
      const safe=(title.normalize("NFKD").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").slice(0,40)||"tour");
      return {
        svg: svgDoc(side,parts),
        filename: `MONTMORY_${safe}_${side==="front"?"Vorne":"Hinten"}_LightBurn.svg`
      };
    }
  }
  window.MontmorySvgExport = { createSvg };
  async function exportSide(side) {
    const status=$("svgExportStatus");
    try {
      const result=await createSvg(side);
      const checks=window.MontmoryV71?.validateSvg(result.svg,side==="front"?"Vorderseite":"Rückseite")||[];
      const errors=checks.filter(x=>x.level==="error");
      if(errors.length)throw new Error(errors.map(x=>x.message).join(' | '));
      save(result.svg,result.filename);
      status.textContent=`SVG heruntergeladen. ${checks.length} technische Prüfhinweise. Vor der Gravur in LightBurn prüfen.`;
    } catch(e) {
      status.textContent=`SVG-Export fehlgeschlagen: ${e.message}`;
    }
  }
  $("downloadFrontSvg")?.addEventListener("click",()=>exportSide("front"));
  $("downloadBackSvg")?.addEventListener("click",()=>exportSide("back"));
})();
