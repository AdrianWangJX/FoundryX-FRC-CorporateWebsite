import {fromDrawing, toDrawing, referenceCenter} from './reference-space.js';
import {referenceDriveOpenings} from './reference-cutouts.js';
import {referenceBracketFaces} from './reference-brackets.js';
import {referenceInternalFacesV17} from './reference-internals.js';

// Geometry reconstructed against the supplied original drawing's measured landmarks.
export function buildRobot(THREE) {
  const parts = [];
  const V = (x,y,z) => new THREE.Vector3(x,y,z);
  const X = V(1,0,0), Y = V(0,1,0), Z = V(0,0,1);
  let sequence = 0;

  function add(geometry, material='gold', name='part', position, quaternion) {
    if (quaternion) geometry.applyQuaternion(quaternion);
    if (position) geometry.translate(...position);
    geometry.computeVertexNormals();
    parts.push({ geometry, material, name: `${name}-${sequence++}` });
    return geometry;
  }
  function roundedRect(x,y,w,h,r) {
    const s = new THREE.Shape();
    s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
    return s;
  }
  function polygon(points) {
    const s = new THREE.Shape(); s.moveTo(...points[0]);
    for (let i=1;i<points.length;i++) s.lineTo(...points[i]);
    s.closePath(); return s;
  }
  function holePolygon(shape, points) {
    const p = new THREE.Path(); p.moveTo(...points[0]);
    for(let i=1;i<points.length;i++) p.lineTo(...points[i]);
    p.closePath(); shape.holes.push(p);
  }
  function holeCircle(shape,x,y,r) {
    const p = new THREE.Path(); p.absarc(x,y,r,0,Math.PI*2,true); shape.holes.push(p);
  }
  function holeRoundRect(shape,x,y,w,h,r=.03) { shape.holes.push(roundedRect(x,y,w,h,r)); }
  const planes = {
    xy: [X,Y,Z],
    zy: [Z,Y,V(-1,0,0)],
    xz: [X,Z,V(0,-1,0)]
  };
  function plate(shape,depth,position,plane='xy',material='gold',name='plate',bevel=.008) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, steps:1, curveSegments:5, bevelEnabled:bevel>0,
      bevelThickness:bevel, bevelSize:bevel, bevelSegments:1
    });
    geometry.translate(0,0,-depth/2);
    const matrix=new THREE.Matrix4().makeBasis(...planes[plane]);
    matrix.setPosition(...position); geometry.applyMatrix4(matrix);
    const result=add(geometry,material,name);
    result.userData.formation={kind:'plate',normal:planes[plane][2].toArray(),origin:position};return result;
  }
  function block(w,h,d,x,y,z,material='gold',name='block',bevel=.015) {
    return plate(roundedRect(-w/2,-h/2,w,h,Math.min(bevel,w/4,h/4)),d,[x,y,z],'xy',material,name,bevel/2);
  }
  function cylinder(radius,length,x,y,z,axis='x',material='silver',name='shaft',segments=16) {
    const direction=axis==='x'?X:axis==='z'?Z:Y;
    const g=add(new THREE.CylinderGeometry(radius,radius,length,segments,1),material,name,[x,y,z],new THREE.Quaternion().setFromUnitVectors(Y,direction));
    g.userData.formation={kind:'cylinder',axis:direction.toArray(),origin:[x,y,z],radius,radial:V(0,0,1).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y,direction)).toArray(),sideCount:g.groups[0].count};return g;
  }
  function cone(r1,r2,length,x,y,z,axis='x',material='silver',name='collar') {
    const direction=axis==='x'?X:axis==='z'?Z:Y;
    return add(new THREE.CylinderGeometry(r1,r2,length,16,1),material,name,[x,y,z],new THREE.Quaternion().setFromUnitVectors(Y,direction));
  }
  function ring(radius,tube,x,y,z,axis='x',material='silver',name='ring',radial=4,tubular=20) {
    const direction=axis==='x'?X:axis==='z'?Z:Y;
    const g=add(new THREE.TorusGeometry(radius,tube,radial,tubular),material,name,[x,y,z],new THREE.Quaternion().setFromUnitVectors(Z,direction));
    g.userData.formation={kind:'ring',axis:direction.toArray(),origin:[x,y,z],radius};return g;
  }
  function rod(a,b,r=.025,material='gold',name='tie-rod') {
    const av=V(...a), bv=V(...b), delta=bv.clone().sub(av), mid=av.clone().add(bv).multiplyScalar(.5);
    const geometry=new THREE.CylinderGeometry(r,r,delta.length(),8,1);geometry.userData.structuralRod=true;
    const g=add(geometry,material,name,mid.toArray(),new THREE.Quaternion().setFromUnitVectors(Y,delta.normalize()));
    g.userData.formation={kind:'cylinder',axis:delta.toArray(),origin:mid.toArray(),radius:r};return g;
  }
  function bolt(x,y,z,axis='x',material='silver') {
    cylinder(.032,.026,x,y,z,axis,material,'hex-bolt',6);
    const direction=axis==='x'?X:axis==='z'?Z:Y;
    const p=V(x,y,z).addScaledVector(direction,.015);
    cylinder(.013,.002,...p.toArray(),axis,'dark','hex-socket',6);
  }
  function bearing(x,y,z,axis='x',radius=.13) {
    cylinder(radius,.075,x,y,z,axis,'dark','bearing-seat',20);
    cylinder(radius*.78,.086,x,y,z,axis,'silver','bearing-race',20);
    ring(radius*.54,.016,x,y,z,axis,'dark','bearing-seal',4,16);
    cylinder(radius*.32,.12,x,y,z,axis,'gold','axle-end',10);
  }
  function tubePath(points,radius=.014,material='rubber',name='belt',closed=false) {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>V(...p)),closed,'centripetal');
    const steps=Math.max(16,points.length*5),g=add(new THREE.TubeGeometry(curve,steps,radius,4,closed),material,name);
    g.userData.formation={kind:'tube',centers:curve.getSpacedPoints(steps).map(p=>p.toArray())};return g;
  }
  function slottedRail(a,b,width,depth,plane,position,material='silver',name='slotted-rail',bays=7) {
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,nx=-uy,ny=ux;
    const p=(t,offset)=>[a[0]+ux*t+nx*offset,a[1]+uy*t+ny*offset];
    const shape=polygon([p(0,-width/2),p(length,-width/2),p(length,width/2),p(0,width/2)]);
    const pitch=(length-.14)/bays;
    for(let i=0;i<bays;i++) {
      const start=.07+i*pitch,end=start+pitch-.035,inner=width*.32;
      holePolygon(shape,i%2?[p(start,-inner),p(end,inner),p(start,inner)]:[p(start,-inner),p(end,-inner),p(end,inner)]);
    }
    return plate(shape,depth,position,plane,material,name,.005);
  }

  function drawnPlate(points,plane,constant,material,name,holes=[],thickness=.024){
    const coordinates=pts=>pts.map(([u,v])=>{const p=fromDrawing(u,v,plane,constant);return plane==='xy'?[p[0],p[1]]:plane==='zy'?[p[2],p[1]]:[p[0],p[2]];});
    const shape=polygon(coordinates(points));for(const h of holes)holePolygon(shape,coordinates(h));
    const position=plane==='xy'?[0,0,constant]:plane==='zy'?[constant,0,0]:[0,constant,0];
    return plate(shape,thickness,position,plane,material,name,.004);
  }
  function at(u,v,z=1.78){return fromDrawing(u,v,'xy',z);}
  function fastener(u,v,plane,constant,r=.016){const p=fromDrawing(u,v,plane,constant);const axis=plane==='xy'?'z':plane==='zy'?'x':'y';cylinder(r,.020,...p,axis,'silver','reference-fastener',8);const q=[...p];q[axis==='x'?0:axis==='y'?1:2]+=.013;cylinder(r*.37,.003,...q,axis,'dark','socket',6);}
  function drillRow(a,b,count,plane,constant){for(let i=0;i<count;i++){const t=i/(count-1);fastener(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,plane,constant);}}
  function lineMember(a,b,plane,constant,r=.02,mat='silver',name='frame-link'){rod(fromDrawing(...a,plane,constant),fromDrawing(...b,plane,constant),r,mat,name);}
  function web(points,holes,z,name,material='gold'){return drawnPlate(points,'xy',z,material,name,holes,.034);}
  function wheelAt(u,v,r,z=1.84,mat='silver',name='pulley'){
    const p=at(u,v,z);cylinder(r,.055,...p,'z','dark',name+'-belt-seat',36);
    for(const dz of [-.035,.035])cylinder(r+.010,.014,p[0],p[1],z+dz,'z',mat,name+'-flange',36);
    ring(r*.88,.006,p[0],p[1],z+.045,'z','gold',name+'-turned-rim',4,36);
    bearing(p[0],p[1],z+.06,'z',r*.28);return p;
  }
  function roundGear(u,v,r,z=1.78,teeth=24){
    const p=at(u,v,z),points=[];for(let i=0;i<teeth;i++)for(const [dt,k]of [[0,.90],[.20,1],[.68,1],[.90,.90]]){const a=(i+dt)/teeth*Math.PI*2;points.push([p[0]+Math.cos(a)*r*k,p[1]+Math.sin(a)*r*k]);}
    const s=polygon(points);holeCircle(s,p[0],p[1],r*.16);for(let j=0;j<6;j++){const a=j*Math.PI/3;holeCircle(s,p[0]+Math.cos(a)*r*.58,p[1]+Math.sin(a)*r*.58,r*.18);}
    plate(s,.044,[0,0,z],'xy','gold','reference-toothed-gear',.003);
    bearing(p[0],p[1],z+.032,'z',r*.24);
  }
  function sourceToothedArc(){
    // Only this toothed sector is supported by the visible reference drawing.
    const p=at(648,738,1.71),r=.75,start=-70*Math.PI/180,end=9*Math.PI/180,teeth=25,points=[];
    for(let i=0;i<teeth;i++)for(const [t,k]of [[0,.978],[.20,1],[.68,1],[.90,.978]]){const a=start+(end-start)*(i+t)/teeth;points.push([p[0]+Math.cos(a)*r*k,p[1]+Math.sin(a)*r*k]);}
    for(let i=teeth;i>=0;i--){const a=start+(end-start)*i/teeth;points.push([p[0]+Math.cos(a)*r*.893,p[1]+Math.sin(a)*r*.893]);}
    plate(polygon(points),.044,[0,0,1.71],'xy','gold','source-toothed-sector',.003);
  }

  // Lower chassis is narrower than the upper intake assembly in the source.
  function sheetQuad(points,material,name){
    const g=new THREE.BufferGeometry(),vertices=[];
    for(const order of [[0,1,2],[0,2,3],[2,1,0],[3,2,0]])for(const i of order)vertices.push(...points[i]);
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));return add(g,material,name);
  }
  const bumperSections=[
    {left:[[152,764],[527,1114]],front:[[543,1120],[1325,929]],x:-2.60,z:1.73,end:[1359,919]},
    {left:[[122,803],[496,1152]],front:[[572,1164],[1339,971]],x:-2.94,z:2.22,end:[1371,950]},
    {left:[[124,870],[497,1205]],front:[[574,1218],[1342,1027]],x:-2.94,z:2.22,end:[1373,1005]},
    {left:[[131,883],[503,1219]],front:[[566,1236],[1334,1046]],x:-2.83,z:2.08,end:[1352,1035]}
  ].map(s=>[...s.left.map(p=>fromDrawing(...p,'zy',s.x)),...s.front.map(p=>fromDrawing(...p,'xy',s.z)),fromDrawing(...s.end,'xy',1.83)]);
  for(let j=0;j<3;j++)for(let i=0;i<4;i++)sheetQuad([bumperSections[j][i],bumperSections[j][i+1],bumperSections[j+1][i+1],bumperSections[j+1][i]],'rubber','original-padded-bumper');
  // Visible top strips and return close the padded perimeter around its open centre.
  const innerBack=fromDrawing(188,761,'zy',-2.43),innerCorner=fromDrawing(553,1100,'xy',1.70),innerRight=fromDrawing(1299,917,'xy',1.70);
  sheetQuad([bumperSections[0][0],innerBack,innerCorner,bumperSections[0][1]],'rubber','bumper-top-left');
  sheetQuad([bumperSections[0][1],innerCorner,bumperSections[0][2],bumperSections[0][2]],'rubber','bumper-top-corner');
  sheetQuad([bumperSections[0][2],innerCorner,innerRight,bumperSections[0][3]],'rubber','bumper-top-front');
  sheetQuad([bumperSections[0][3],innerRight,bumperSections[0][4],bumperSections[0][4]],'rubber','bumper-top-return');
  for(const j of [1,2])for(let i=0;i<4;i++)rod(bumperSections[j][i],bumperSections[j][i+1],.006,'dark','original-bumper-seam');
  block(4.08,.38,.25,-.68,.83,-2.30,'rubber','hidden-rear-bumper');
  block(.25,.38,3.96,1.33,.83,-.18,'rubber','hidden-right-bumper');
  for(const x of [-2.48,1.24])block(.12,.17,4.2,x,1.06,-.09,'silver','longitudinal-chassis');
  for(const z of [-2.10,1.90])block(3.80,.17,.12,-.60,1.06,z,'silver','chassis-crossmember');
  for(const x of [-2.32,1.08])for(const z of [-1.93,1.66]){
    cylinder(.22,.18,x,.66,z,'x','rubber','drive-wheel',24);cylinder(.14,.195,x,.66,z,'x','silver','wheel-hub',20);
    block(.27,.22,.32,x,.97,z,'dark','drive-module');cylinder(.10,.28,x,1.22,z,'y','silver','drive-motor',20);
    cylinder(.09,.045,x,1.38,z,'y','dark','motor-lid',20);
  }
  for(const z of [-1.7,-.9,0,1.0])block(3.45,.07,.075,-.55,1.08,z,'silver','deck-rib');
  rod([-2.4,1.02,-2.05],[1.17,1.02,1.84],.025,'silver','chassis-diagonal');rod([1.17,1.02,-2.05],[-2.4,1.02,1.84],.025,'silver','chassis-diagonal');

  // Existing sheet-metal walls retain their original cutouts and unequal silhouette.
  const leftWall=[[207,390],[550,686],[558,1076],[496,1026],[491,929],[281,722],[276,815],[216,750]];
  const leftWindow=[[355,552],[398,585],[403,709],[353,663]];
  drawnPlate(leftWall,'zy',-2.50,'gold','original-left-side',[leftWindow],.029);
  const rearLeft=[[211,384],[898,207],[909,209],[913,477],[228,658]];
  const rearRight=[[883,248],[1217,164],[1223,175],[1224,333],[1214,345],[885,477],[879,471],[875,262]];
  // Two independent overlapping rear sheets. Their measured silhouettes differ
  // in height; a real fore/aft air gap leaves the front sheet's edge readable.
  const rearLeftZ=-2.04,rearRightZ=-1.72;
  drawnPlate(rearLeft,'xy',rearLeftZ,'gold','original-rear-left',[],.045);
  drawnPlate(rearRight,'xy',rearRightZ,'gold','original-rear-right',[],.045);
  lineMember([903,215],[905,243],'xy',rearLeftZ+.027,.008,'silver','rear-left-exposed-end');
  lineMember([879,262],[883,469],'xy',rearRightZ+.027,.009,'silver','rear-right-overlap-edge');
  // Short spacer sleeves stay behind the front sheet instead of joining both
  // silhouettes into a single solid wall.
  for(const [u,v]of [[897,275],[899,442]]){
    const p=at(u,v,(rearLeftZ+rearRightZ)/2);
    cylinder(.019,rearRightZ-rearLeftZ,...p,'z','dark','rear-panel-spacer',12);
  }
  const rightWall=[[1227,179],[1536,462],[1517,475],[1471,653],[1229,342]];
  drawnPlate(rightWall,'zy',2.67,'gold','original-right-side');
  drawnPlate([[1534,476],[1553,470],[1558,685],[1468,696]],'xy',1.71,'gold','right-front-fold',[],.027);
  // The two measured sheet planes meet through this narrow physical fold.
  // Sharing these boundary vertices prevents a gap during depth formation.
  const joint=[fromDrawing(1536,462,'zy',2.67),fromDrawing(1553,470,'xy',1.71),fromDrawing(1468,696,'xy',1.71),fromDrawing(1471,653,'zy',2.67)];
  const joinGeometry=new THREE.BufferGeometry();
  joinGeometry.setAttribute('position',new THREE.Float32BufferAttribute(joint.flat(),3));joinGeometry.setIndex([0,1,2,0,2,3,2,1,0,3,2,0]);add(joinGeometry.toNonIndexed(),'gold','right-panel-fold-joint');joinGeometry.dispose();
  for(const [a,b,n,plane,c]of [
    [[220,408],[544,690],15,'zy',-2.526],[[221,430],[224,740],10,'zy',-2.526],[[545,712],[550,1058],14,'zy',-2.526],
    [[232,376],[893,224],15,'xy',rearLeftZ+.035],[[889,260],[1206,181],8,'xy',rearRightZ+.035],[[1206,208],[1206,328],6,'xy',rearRightZ+.035],
    [[1240,187],[1527,452],13,'zy',2.70],[[1243,230],[1247,331],6,'zy',2.70],[[1266,378],[1480,578],10,'zy',2.70],
    [[1541,486],[1545,672],6,'xy',1.745]
  ])drillRow(a,b,n,plane,c);
  for(const pts of [[[212,384],[546,682]],[[216,745],[274,800]],[[496,1018],[552,1075]]])lineMember(...pts,'zy',-2.51,.019,'silver','side-fold');
  lineMember([1224,165],[1544,465],'zy',2.66,.024,'silver','right-top-fold');

  // Long roller axes are measured from the reference, not arranged symmetrically.
  const rollers=[
    {a:[489,327],b:[792,605],z0:-1.43,z1:1.73,r:.120,flange:.158},
    {a:[502,465],b:[802,734],z0:-1.40,z1:1.73,r:.123,flange:.161},
    {a:[483,518],b:[786,789],z0:-1.43,z1:1.73,r:.120,flange:.153},
    {a:[1115,437],b:[1450,741],z0:-1.72,z1:1.73,r:.136,flange:.183}
  ];
  for(const [i,r]of rollers.entries()){
    const a=at(...r.a,r.z0),b=at(...r.b,r.z1),x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,z=(r.z0+r.z1)/2;
    cylinder(.048,r.z1-r.z0+.20,x,y,z,'z','silver','roller-through-shaft',20);
    cylinder(r.r,r.z1-r.z0-.13,x,y,z,'z','silver','long-machined-roller',40);
    for(const end of [r.z0+.035,r.z0+.105,r.z1-.08,r.z1-.02]){
      cylinder(r.flange,.035,x,y,end,'z','dark','roller-end-grip',32);ring(r.flange-.006,.011,x,y,end+.021,'z','silver','roller-collar',4,32);
    }
    for(const end of [r.z0-.06,r.z1+.04])bearing(x,y,end,'z',r.flange*.87);
    // Thin backbone above each cylinder, visible in the source's outline.
    block(.065,.070,r.z1-r.z0+.12,x+.08,y+.18,z,'silver','roller-backbone');
  }
  // Trussed top rails follow the measured source diagonals.
  const upperLattice=referenceBracketFaces.find(p=>p.id==='source-upper-left-lattice');
  drawnPlate(upperLattice.outer,upperLattice.plane,upperLattice.constantSuggested,'silver',upperLattice.id,upperLattice.holes,.031);
  for(const face of referenceInternalFacesV17)drawnPlate(face.outer,face.plane,face.constantSuggested,'silver',face.id,face.holes,.032);
  drawnPlate([[486,277],[809,568],[792,587],[474,296]],'zy',-1.14,'silver','upper-roller-rail',[],.033);
  drawnPlate([[1128,368],[1211,366],[1216,393],[1151,408]],'xy',-1.56,'silver','far-roller-support',[[[1146,382],[1189,382],[1162,400]]],.035);

  // Front gear plate: the tall, dense face beside the left vertical sheet.
  const drive=[[551,690],[784,576],[815,593],[839,650],[856,725],[858,834],[833,865],[780,893],[750,949],[651,1031],[556,1059]];
  web(drive,referenceDriveOpenings,1.79,'source-drive-side-plate','gold');
  // Separate thin ribs sit proud of the base plate, not an invented duplicated bay.
  for(const [a,b]of [[[566,704],[786,590]],[[576,990],[797,653]],[[580,929],[825,820]],[[603,1020],[809,813]],[[610,736],[786,790]],[[643,886],[810,647]]])lineMember(a,b,'xy',1.835,.018,'silver','machined-web-rib');
  for(const [u,v]of [[563,715],[564,801],[565,925],[566,1040],[792,605],[809,648],[834,737],[841,821],[779,875],[733,941],[670,1009]])fastener(u,v,'xy',1.84,.019);
  sourceToothedArc();roundGear(803,749,.089,1.76,18);roundGear(611,970,.14,1.79,18);
  const fly=at(652,847,1.91),flyShape=new THREE.Shape();flyShape.absarc(0,0,.36,0,Math.PI*2,false);holeCircle(flyShape,0,0,.316);
  plate(flyShape,.055,fly,'xy','silver','three-spoke-flywheel',.003);
  const drum=new THREE.Shape();drum.absarc(0,0,.327,0,Math.PI*2,false);holeCircle(drum,0,0,.026);plate(drum,.065,[fly[0],fly[1],1.885],'xy','silver','crank-backing-drum',.006);
  const crank=[[682,760],[691,757],[699,761],[702,769],[699,778],[675,823],[673,845],[676,857],[701,898],[701,905],[697,911],[689,912],[684,906],[655,872],[638,865],[621,865],[578,874],[570,874],[565,868],[566,861],[572,855],[621,841],[642,830],[656,813],[680,766]];
  const crankHoles=[[652,845,5],[690,768,3.5],[574,866,3.5],[693,902,3.5]].map(([u,v,r])=>Array.from({length:16},(_,i)=>[u+Math.cos(i*Math.PI/8)*r,v+Math.sin(i*Math.PI/8)*r]));
  drawnPlate(crank,'xy',1.985,'silver','source-three-arm-crank',crankHoles,.031);
  for(const [u,v]of [[690,768],[574,866],[693,902]])fastener(u,v,'xy',2.011,.017);
  const crankHub=at(652,845,2.010);bearing(...crankHub,'z',.035);
  wheelAt(628,742,.245,1.94,'silver','upper-belt-pulley');wheelAt(803,815,.158,1.94,'silver','right-belt-pulley');wheelAt(600,961,.109,1.94,'silver','lower-belt-pulley');wheelAt(610,1018,.085,1.94,'silver','bottom-belt-pulley');
  for(const [u,v]of [[792,605],[809,648]]){const p=at(u,v,1.9);bearing(...p,'z',.078);}
  for(const points of [
    [[579,740],[587,710],[625,690],[668,712],[682,754],[666,780],[613,981],[589,980],[579,958],[579,931]],
    [[649,698],[837,793],[836,824],[812,846],[788,841],[604,773],[580,746],[587,709]],
    [[598,938],[627,949],[629,982],[628,1023],[613,1039],[590,1026],[583,1007],[583,961]]
  ])tubePath(points.map(p=>at(...p,1.976)),.009,'rubber','reference-timing-belt',true);
  // Source's low mechanical web directly above the bumper.
  const bottomLattice=referenceBracketFaces.find(p=>p.id==='source-front-lower-lattice');
  drawnPlate(bottomLattice.outer,bottomLattice.plane,bottomLattice.constantSuggested,'silver',bottomLattice.id,bottomLattice.holes,.030);
  // The return bearing sits behind this open lower frame, not on a filled panel.
  drawnPlate([[782.9,876.4],[782.9,886.6],[792.6,893.6],[772.1,1005.6],[746.3,1011.5],[766.7,994.8],[772.1,957.7],[736.6,956.1],[706.4,942.6],[690.8,948.6],[688.6,954.5],[721.5,1018],[715,1019.1],[688.1,965.8],[683.8,964.7],[680.5,967.4],[677.3,956.6],[671.9,955.5],[697.8,941],[701,937.2],[700.5,933.5],[689.7,918.4],[694,914.6],[703.2,928.6],[709.1,934.6],[713.4,935.1],[780.7,909.8],[785.1,894.2],[780.2,886.1]],'xy',1.79,'silver','source-lower-bearing-frame',[[[774.8,917.3],[723.6,936.2],[721.5,943.2],[731.2,948],[751.6,952.3],[773.2,950.7],[780.2,920.6],[779.1,917.3]]],.034);
  for(const [u,v]of [[620,1054],[690,1038],[756,1016],[824,999],[894,982],[955,964],[1023,944],[1109,925],[1210,902]])fastener(u,v,'xy',1.73,.014);

  // The lower feed deck is eight X-running belt loops around a shared Z shaft,
  // not a row of X-axis solid rollers. The segmented end wheels are visible.
  const conveyorA=at(973,577,-1.42),conveyorB=at(1253,829,1.43);
  const cx=(conveyorA[0]+conveyorB[0])/2,cy=(conveyorA[1]+conveyorB[1])/2;
  cylinder(.044,3.18,cx,cy,.0,'z','silver','segmented-conveyor-shaft',20);
  const returnFront=at(748,988,1.80),returnX=returnFront[0],returnY=returnFront[1];
  cylinder(.046,3.51,returnX,returnY,.085,'z','silver','conveyor-return-shaft',20);
  cylinder(.148,.34,returnX,returnY,1.57,'z','silver','return-bearing-housing',28);
  cylinder(.153,.024,returnX,returnY,1.75,'z','silver','return-bearing-end-cap',28);
  bearing(returnX,returnY,1.80,'z',.052);
  ring(.037,.008,returnX,returnY,1.862,'z','gold','return-shaft-lock-collar',4,24);
  const returnFoot=at(751,1006,1.43);
  rod([returnX,returnY,1.43],returnFoot,.039,'silver','return-bearing-pedestal');
  for(let i=0;i<8;i++){
    const z=-1.42+i*(2.85/7),r=.138;
    cylinder(r,.215,cx,cy,z,'z','silver','segmented-feed-wheel',28);
    for(const dz of [-.117,.117])cylinder(.15,.022,cx,cy,z+dz,'z','gold','conveyor-wheel-flange',28);
    cylinder(r,.10,returnX,returnY,z,'z','dark','conveyor-return-pulley',24);
    for(const dz of [-.095,.095]){
      const angle=Math.atan2(cy-returnY,cx-returnX);
      const beltOutline=(radius,Type)=>{const p=new Type();p.absarc(returnX,returnY,radius,angle+Math.PI/2,angle+Math.PI*1.5,false);p.absarc(cx,cy,radius,angle-Math.PI/2,angle+Math.PI/2,false);p.closePath();return p;};
      const s=beltOutline(r,THREE.Shape);s.holes.push(beltOutline(r-.018,THREE.Path));
      plate(s,.070,[0,0,z+dz],'xy','belt','continuous-feed-belt',.002);
    }
  }
  // Curved guide cheeks frame the belts exactly where the drawing shows them.
  drawnPlate([[1443,691],[1541,686],[1550,752],[1481,801],[1433,743]],'xy',1.77,'gold','right-front-bearing-plate',[
    [[1465,703],[1489,699],[1476,719]],[[1508,701],[1528,702],[1535,725]],[[1455,740],[1470,723],[1480,748]],[[1504,753],[1524,740],[1517,767]]
  ],.038);
  for(const [u,v]of [[1450,741],[1510,744],[1534,755],[1469,779]]){const p=at(u,v,1.84);bearing(...p,'z',.041);}
  // Articulated front bar and its triangular links; extends beyond the bumper.
  web([[1147,875],[1466,796],[1528,758],[1556,755],[1558,802],[1532,824],[1490,847],[1147,931]],[],1.91,'source-front-intake-link','silver');
  for(const [u,v]of [[1015,879],[1050,885],[1148,877],[1208,861],[1278,846],[1348,831],[1420,817],[1487,807],[1538,789]])fastener(u,v,'xy',1.95,.020);
  web([[1240,814],[1356,771],[1400,780],[1389,793],[1266,837]],[[[1280,814],[1351,788],[1330,811]]],1.83,'upper-four-bar-link','silver');
  web([[1139,907],[1261,881],[1298,913],[1266,925],[1232,902],[1152,921]],[],1.95,'front-sliding-rack','silver');
  for(let i=0;i<21;i++){
    const u=1148+i*8.5,v=915-i*1.98;
    web([[u,v],[u+3,v-9],[u+6,v-1]],[],1.97,'rack-tooth','gold');
  }
  web([[1333,886],[1370,894],[1424,947],[1408,961],[1380,948]],[],1.93,'intake-drop-bracket','silver');
  for(const [u,v]of [[1248,821],[1358,785],[1388,789],[1406,946]])fastener(u,v,'xy',1.97,.023);
  lineMember([845,938],[1101,884],'xy',1.88,.020,'silver','front-link-cross-shaft');
  lineMember([852,943],[876,955],'xy',1.91,.032,'silver','link-clevis');

  // The electronics and drive detail seen through the original lower opening.
  for(const [u,v]of [[331,797],[382,850],[430,894]]){
    const p=fromDrawing(u,v,'zy',-2.27);cylinder(.106,.30,p[0],p[1],p[2],'y','silver','visible-drive-motor',24);
    cylinder(.111,.045,p[0],p[1]+.17,p[2],'y','dark','motor-end-cap',20);
    for(let j=0;j<4;j++)ring(.11,.009,p[0],p[1]-.1+j*.05,p[2],'y','silver','motor-cooling-ring',4,24);
  }
  drawnPlate([[855,746],[992,709],[998,834],[864,870]],'xy',.51,'silver','central-controller-enclosure',[],.12);
  drawnPlate([[857,643],[940,628],[947,697],[862,715]],'xy',.94,'silver','controller-mount',[[[875,659],[925,647],[929,681],[875,695]]],.032);
  for(const [u,v]of [[865,654],[934,639],[941,689],[869,706]])fastener(u,v,'xy',.98,.018);
  for(const z of [-1.75,-.9,.1])tubePath([[-2.24,1.25,z],[-2.03,1.14,z+.12],[-1.57,1.18,z+.18],[-1.05,1.29,z+.23]],.012,'rubber','routed-drive-cable');

  // The open side repeats both original panel contours in clear material.
  // Mirror the depth step across the machine: the short sheet is inboard on
  // BOTH sides. Reusing the rear side's positive step made this sheet outboard.
  const moveToFront=points=>points.map(([u,v])=>[u+338,v+302]);
  const frontLeftZ=2.14,frontRightZ=frontLeftZ-(rearRightZ-rearLeftZ);
  const mirroredRight=points=>moveToFront(points).map(([u,v])=>{
    const [x,y]=at(u,v,frontLeftZ+(rearRightZ-rearLeftZ));
    return toDrawing(x,y,frontRightZ);
  });
  const rightMounts=[[891,264],[1208,179],[1208,325],[895,459]];
  const clearPanels=[
    {name:'left',outline:moveToFront(rearLeft),z:frontLeftZ,mounts:moveToFront([[226,397],[894,224],[238,640],[895,458]])},
    {name:'right',outline:mirroredRight(rearRight),z:frontRightZ,mounts:mirroredRight(rightMounts),anchorProjection:moveToFront(rightMounts)}
  ];
  for(const panel of clearPanels){
    drawnPlate(panel.outline,'xy',panel.z,'glass','clear-service-cover-'+panel.name,[],.026);
    for(const [index,[u,v]]of panel.mounts.entries()){
      // One world-space axis keeps each mounting screw and its sleeve coaxial.
      const p=at(u,v,panel.z),length=panel.name==='left'?.17:.32;
      const innerOverlap=panel.name==='right'&&p[0]<=2;
      const screwSide=innerOverlap?-1:1;
      if(panel.name==='right'&&p[0]>2){
        const anchor=at(1542,panel.anchorProjection[index][1]+5,1.745);
        rod(anchor,[p[0],p[1],panel.z-.024],.018,'silver','cover-outer-bracket');
      }else cylinder(.022,length,p[0],p[1],panel.z-screwSide*length/2,'z','silver','cover-stand-off',12);
      cylinder(.020,.020,p[0],p[1],panel.z+screwSide*.018,'z','silver','cover-mount-screw',8);
      cylinder(.0074,.003,p[0],p[1],panel.z+screwSide*.031,'z','dark','cover-mount-socket',6);
    }
  }

  const box=new THREE.Box3();for(const p of parts){p.geometry.computeBoundingBox();box.union(p.geometry.boundingBox);}
  return {parts,center:referenceCenter,bounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()},metadata:{source:'IMG_8494 2.JPG',textures:false,clearPanels:2,frontPanels:clearPanels,construction:'source-projected 3D geometry',projection:toDrawing},forward:[0,0,1]};
}
