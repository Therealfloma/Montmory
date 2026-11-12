/* MONTMORY V60: GPX-Routen ohne geometrische Verzerrung.
   Lokale equirektanguläre Projektion: Längengrade mit cos(Breitengrad).
   X und Y werden mit EINEM gemeinsamen Maßstab normiert. */
window.MontmoryRouteGeometry = (() => {
  function fromGPX(points) {
    const valid = (points || []).filter(p => Number.isFinite(+p.lat) && Number.isFinite(+p.lon));
    if(valid.length < 2) return [];
    const lat0 = valid.reduce((sum,p)=>sum + Number(p.lat),0)/valid.length * Math.PI/180;
    const factor = Math.cos(lat0);
    const xy = valid.map(p => ({x:Number(p.lon)*factor, y:Number(p.lat)}));
    const xs=xy.map(p=>p.x), ys=xy.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const span=Math.max(maxX-minX,maxY-minY,1e-12);
    return xy.map(p=>({distance:(p.x-minX)/span,elevation:(p.y-minY)/span}));
  }
  // Maße des 60x80-mm-Marks und des SVG viewBox werden berücksichtigt.
  function fit(points,x,y,w,h,markW=60,markH=80) {
    if(!Array.isArray(points)||points.length<2)return [];
    const valid=points.filter(p=>Number.isFinite(+p.distance)&&Number.isFinite(+p.elevation));
    if(valid.length<2)return [];
    const xs=valid.map(p=>+p.distance),ys=valid.map(p=>+p.elevation);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const spanX=Math.max(0,maxX-minX),spanY=Math.max(0,maxY-minY);
    // Ein gemeinsamer mm-Maßstab für beide Achsen.
    const mmPerUnit=Math.min(
      spanX>1e-12 ? (w*markW/1024)/spanX : Infinity,
      spanY>1e-12 ? (h*markH/1152)/spanY : Infinity
    );
    if(!Number.isFinite(mmPerUnit))return [];
    const usedW=spanX*mmPerUnit*1024/markW,usedH=spanY*mmPerUnit*1152/markH;
    const ox=x+(w-usedW)/2,oy=y+(h-usedH)/2;
    return valid.map(p=>({x:ox+(+p.distance-minX)*mmPerUnit*1024/markW,
      y:oy+usedH-(+p.elevation-minY)*mmPerUnit*1152/markH}));
  }
  return {fromGPX,fit};
})();
