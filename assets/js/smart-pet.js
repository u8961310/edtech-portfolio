/* ================= 小常識島寵物模組 =================
 * 4 隻原創寵物（雲朵兔、鍵盤龜、螢幕貓、燈泡雞）× 3 階段 × 表情 × 6 件服裝，全部 inline SVG
 * 繪圖程式來自選定的 B 版設計稿 docs/plans/mockups/smart-island-ui-ux-pro-max.html（規範 .interface-design/smart-island-system.md）
 * 存檔 localStorage 'edtech-smart-pets'：一台電腦可以住好幾隻（教室共用電腦，領養時輸入座號＋名字）
 *
 *   SmartPet.svg('bunny', 1, 'happy', { wear:['scarf'], snack:true })   → '<svg …>'
 *   SmartPet.svgOf(SmartPet.current(), 'worried')                     → 畫目前這隻
 *   SmartPet.adopt({ seat:'12', owner:'王小明', name:'小雲', type:'bunny' })
 *   SmartPet.award(29, 0)   → 過關給點心（同一關只給一次），回傳 { snack, before, after, stageUp, outfit }
 */
(function(){
'use strict';
const E=(cx,cy,rx,ry,f,x='')=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${x}/>`;
function blob(list,fill,line,w=3.5){ // 先畫一層外框色、再疊填色：黏土一體成形的邊
  return list.map(c=>E(c[0],c[1],c[2]+w,(c[3]??c[2])+w,line)).join('')+list.map(c=>E(c[0],c[1],c[2],c[3]??c[2],fill)).join('');
}
const MOUTH='#B8405E';
function face(x,y,s,mood,col,o={}){
  const dx=13*s;let g='';
  [x-dx,x+dx].forEach((ex,i)=>{
    if(mood==='happy'){g+=`<path d="M${ex-5.5*s} ${y+2*s} Q${ex} ${y-6.5*s} ${ex+5.5*s} ${y+2*s}" fill="none" stroke="${col}" stroke-width="${3.6*s}" stroke-linecap="round"/>`;}
    else if(mood==='worried'||mood==='surprised'){
      g+=E(ex,y,5.2*s,6.6*s,col)+`<circle cx="${ex+1.7*s}" cy="${y-2.5*s}" r="${1.9*s}" fill="#fff"/>`;
      if(mood==='worried'){const a=i?[ex-5*s,y-13*s,ex+6*s,y-9.5*s]:[ex-6*s,y-9.5*s,ex+5*s,y-13*s];
        g+=`<path d="M${a[0]} ${a[1]} L${a[2]} ${a[3]}" stroke="${col}" stroke-width="${2.6*s}" stroke-linecap="round"/>`;}
    } else {g+=E(ex,y,4.5*s,5.5*s,col)+`<circle cx="${ex+1.5*s}" cy="${y-2*s}" r="${1.7*s}" fill="#fff"/>`;}
  });
  if(o.cheek){ if(o.pixel){g+=`<rect x="${x-dx-11*s}" y="${y+5*s}" width="${7*s}" height="${4*s}" fill="${o.cheek}"/><rect x="${x+dx+4*s}" y="${y+5*s}" width="${7*s}" height="${4*s}" fill="${o.cheek}"/>`;}
    else g+=E(x-dx-6*s,y+7*s,5.5*s,3.2*s,o.cheek,'opacity=".6"')+E(x+dx+6*s,y+7*s,5.5*s,3.2*s,o.cheek,'opacity=".6"');}
  if(o.noMouth) return g;
  const my=y+11*s, mf=o.mouthFill||MOUTH;
  if(mood==='happy') g+=`<path d="M${x-7*s} ${my-1.5*s} Q${x} ${my+11*s} ${x+7*s} ${my-1.5*s} Z" fill="${mf}" stroke="${col}" stroke-width="${2*s}" stroke-linejoin="round"/>`;
  else if(mood==='surprised') g+=E(x,my+1.5*s,3.4*s,4.4*s,mf);
  else if(mood==='worried') g+=`<path d="M${x-6*s} ${my+2.5*s} Q${x-3*s} ${my-1*s} ${x} ${my+2.5*s} Q${x+3*s} ${my+6*s} ${x+6*s} ${my+2.5*s}" fill="none" stroke="${col}" stroke-width="${2.6*s}" stroke-linecap="round"/>`;
  else g+=`<path d="M${x-6*s} ${my} Q${x-3*s} ${my+4.5*s} ${x} ${my} Q${x+3*s} ${my+4.5*s} ${x+6*s} ${my}" fill="none" stroke="${col}" stroke-width="${2.6*s}" stroke-linecap="round"/>`;
  return g;
}
function eggshell(fill,line){return `<path d="M40 158 L52 146 L64 160 L78 145 L92 160 L106 145 L120 160 L134 146 L148 160 L160 150 Q164 197 100 197 Q36 197 40 158Z" fill="${fill}" stroke="${line}" stroke-width="3.5" stroke-linejoin="round"/><path d="M58 178 Q70 186 84 182" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>`;}

/* --- 雲朵兔：雲團身體＋耳尖 Wi-Fi 弧線（階段越大弧線越多） --- */
function bunny(st,mood){
  const F='#F3F5FF',L='#8D93C9';
  const P=[
   {body:[[100,150,42],[66,162,24],[134,162,24],[82,124,27],[118,124,27],[100,174,26]],head:[],ears:[[84,112,-14,38,15,1],[116,112,14,38,15,1]],arms:[],feet:[],f:[100,144,1.12],nk:[100,176,70],top:[100,104,62]},
   {body:[[100,164,30],[78,172,18],[122,172,18]],head:[[100,118,36],[72,124,20],[128,124,20],[100,98,26]],ears:[[86,94,-10,52,16,2],[114,94,10,52,16,2]],arms:[[66,160,11],[134,160,11]],feet:[[84,192,12,6],[116,192,12,6]],f:[100,122,1],nk:[100,150,66],top:[100,80,62]},
   {body:[[100,156,36],[72,164,22],[128,164,22],[100,178,22]],head:[[100,96,34],[74,102,19],[126,102,19],[100,76,23]],ears:[[88,76,-8,64,16,3],[112,76,8,64,16,3]],arms:[[62,148,12],[138,148,12]],feet:[[82,194,13,6],[118,194,13,6]],f:[100,102,.95],nk:[100,128,62],top:[100,60,58]}
  ][st];
  let g='';
  P.ears.forEach(([bx,by,t,Ln,W,n])=>{
    let e=E(bx,by-Ln/2,W/2+3.5,Ln/2+3.5,L)+E(bx,by-Ln/2,W/2,Ln/2,F)+E(bx,by-Ln/2+5,W/2-4.5,Ln/2-10,'#F8C9D8');
    const cy0=by-Ln+Ln*.36;
    for(let k=1;k<=n;k++){const r=2.5+k*3.8;e+=`<path d="M${bx-r*.72} ${cy0-r*.66} A${r} ${r} 0 0 1 ${bx+r*.72} ${cy0-r*.66}" fill="none" stroke="#2F86C8" stroke-width="2.6" stroke-linecap="round"/>`;}
    e+=`<circle cx="${bx}" cy="${cy0}" r="2.3" fill="#2F86C8"/>`;
    g+=`<g transform="rotate(${t} ${bx} ${by})">${e}</g>`;
  });
  g+=blob(P.feet,F,L)+blob(P.body.concat(P.arms),F,L)+blob(P.head,F,L);
  g+=E(P.f[0]-20,P.f[1]-26,10,6,'#fff','opacity=".9"');
  g+=face(P.f[0],P.f[1],P.f[2],mood,'#3B2350',{cheek:'#F7A0B8'});
  return {g,a:P};
}
/* --- 鍵盤龜：背殼是一格一格的按鍵，長大按鍵排數變多 --- */
function turtle(st,mood){
  const F='#A6DDB0',L='#3F8A60',SH='#5AA987',SL='#2F6B50';
  const P=[
   {sx:122,by:180,rx:54,ry:60,h:[64,140,33],neck:null,feet:[[90,184],[152,184]],f:[64,142,1.05],nk:[66,172,44],top:[64,112,54],tail:null},
   {sx:120,by:178,rx:62,ry:70,h:[56,114,30],neck:[64,146,15,24],feet:[[88,184],[154,184]],f:[56,116,.98],nk:[62,144,40],top:[56,90,50],tail:[184,170]},
   {sx:118,by:178,rx:72,ry:82,h:[46,92,30],neck:[56,134,15,32],feet:[[80,186],[158,186]],f:[46,94,.95],nk:[54,124,38],top:[46,68,50],tail:[192,170]}
  ][st];
  let g='';
  if(P.tail) g+=blob([[P.tail[0],P.tail[1],10,6]],F,L);
  g+=`<path d="M${P.sx-P.rx} ${P.by} A${P.rx} ${P.ry} 0 0 1 ${P.sx+P.rx} ${P.by} Z" fill="${SH}" stroke="${SL}" stroke-width="4" stroke-linejoin="round"/>`;
  const kw=17,kh=14,gp=4;let row=0;
  for(let yc=P.by-P.ry+19;yc<P.by-14;yc+=kh+gp,row++){
    const dy=(P.by-(yc-kh/2))/P.ry;if(dy>=1)continue;
    const hw=P.rx*Math.sqrt(1-dy*dy)-7;const n=Math.floor((2*hw+gp)/(kw+gp));if(n<1)continue;
    const tot=n*kw+(n-1)*gp,x0=P.sx-tot/2;
    for(let i=0;i<n;i++){const acc=(row===1&&i===Math.floor(n/2));
      g+=`<rect x="${x0+i*(kw+gp)}" y="${yc-kh/2+2}" width="${kw}" height="${kh}" rx="3.5" fill="${SL}" opacity=".35"/><rect x="${x0+i*(kw+gp)}" y="${yc-kh/2}" width="${kw}" height="${kh}" rx="3.5" fill="${acc?'#FFB648':'#FFF7E6'}" stroke="${SL}" stroke-width="1.8"/>`;}
  }
  g+=`<rect x="${P.sx-P.rx-6}" y="${P.by-10}" width="${2*P.rx+12}" height="14" rx="7" fill="#3F8A60" stroke="${SL}" stroke-width="3"/>`;
  g+=blob(P.feet.map(f=>[f[0],f[1],13,8]),F,L);
  if(P.neck) g+=blob([P.neck],F,L);
  g+=blob([[P.h[0],P.h[1],P.h[2]]],F,L);
  g+=E(P.h[0]-12,P.h[1]-18,8,5,'#fff','opacity=".7"');
  g+=face(P.f[0],P.f[1],P.f[2],mood,'#24452F',{cheek:'#F4A3A3'});
  return {g,a:{f:P.f,nk:P.nk,top:P.top}};
}
/* --- 螢幕貓：臉是圓角小螢幕（表情是螢幕上的畫素線條），尾巴是電源線＋插頭 --- */
function cat(st,mood){
  const B='#FF9E6D',BL='#B65A34',SC='#343A5E',FC='#A9F2D4',BD='#FFB98F';
  const P=[
   {h:[100,114,130,100,28],body:[100,180,36,16],stand:false,tail:null,f:[100,112,1.25]},
   {h:[100,90,112,86,24],body:[100,160,38,30],stand:true,tail:'M134 170 C172 176 180 150 172 126',plug:[172,120],f:[100,88,1.1]},
   {h:[100,72,108,82,22],body:[100,150,42,40],stand:true,tail:'M138 166 C188 172 192 132 178 104',plug:[178,98],f:[100,70,1.05]}
  ][st];
  const [cx,cy,w,h,r]=P.h,tp=cy-h/2;let g='';
  if(P.tail){g+=`<path d="${P.tail}" fill="none" stroke="#6B6F8F" stroke-width="6" stroke-linecap="round"/>`;
    const [px,py]=P.plug;g+=`<rect x="${px-9}" y="${py-6}" width="18" height="14" rx="4" fill="#C9CCD9" stroke="#5E627E" stroke-width="2.6"/><path d="M${px-4} ${py-6}v-7M${px+4} ${py-6}v-7" stroke="#5E627E" stroke-width="2.8" stroke-linecap="round"/>`;}
  g+=E(P.body[0],P.body[1],P.body[2],P.body[3],BD,`stroke="${BL}" stroke-width="4"`);
  if(st>0) g+=E(P.body[0]-16,P.body[1]+P.body[3]-2,11,7,BD,`stroke="${BL}" stroke-width="3.5"`)+E(P.body[0]+16,P.body[1]+P.body[3]-2,11,7,BD,`stroke="${BL}" stroke-width="3.5"`)+E(P.body[0],P.body[1]+4,P.body[2]*.55,P.body[3]*.55,'#FFD7BD');
  if(P.stand) g+=`<rect x="${cx-13}" y="${cy+h/2-4}" width="26" height="${P.body[1]-P.body[3]-(cy+h/2)+12}" rx="4" fill="${B}" stroke="${BL}" stroke-width="3.5"/>`;
  [[1,-1],[-1,1]].forEach(([sg])=>{const ex=cx+sg*(w/2);
    g+=`<path d="M${ex-sg*6} ${tp+16} L${ex-sg*12} ${tp-22} L${ex-sg*42} ${tp+3}Z" fill="${B}" stroke="${BL}" stroke-width="4" stroke-linejoin="round"/><path d="M${ex-sg*13} ${tp+6} L${ex-sg*15} ${tp-11} L${ex-sg*30} ${tp+3}Z" fill="#FFD9C4"/>`;});
  g+=`<rect x="${cx-w/2}" y="${tp}" width="${w}" height="${h}" rx="${r}" fill="${B}" stroke="${BL}" stroke-width="4"/>`;
  g+=`<rect x="${cx-w/2+10}" y="${tp+10}" width="${w-20}" height="${h-26}" rx="${r-9}" fill="${SC}"/>`;
  g+=`<path d="M${cx-w/2+20} ${tp+30} L${cx-w/2+36} ${tp+16}" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".25"/>`;
  g+=`<circle cx="${cx+w/2-16}" cy="${tp+h-8}" r="3.4" fill="#5BD08F"/><rect x="${cx-10}" y="${tp+h-10}" width="20" height="4" rx="2" fill="${BL}" opacity=".5"/>`;
  g+=face(P.f[0],P.f[1]-2,P.f[2],mood,FC,{cheek:'#FF9DB5',pixel:true,mouthFill:'#FF9DB5'});
  return {g,a:{f:[P.f[0],P.f[1]-2,P.f[2]],nk:[cx,cy+h/2+4,st?36:60],top:[cx,tp+6,64],screen:true}};
}
/* --- 燈泡雞：頭頂小燈泡，開心／驚訝（想到點子）時會亮 --- */
function chick(st,mood,o){
  const F='#FFD65E',L='#C98A12';
  const P=[
   {b:[100,134,44,44],br:9,top:90,f:[100,124,1.1],bk:[100,138],wings:null,feet:null,egg:true,nk:[100,160,90],tail:null},
   {b:[100,134,46,50],br:12,top:84,f:[100,120,1],bk:[100,134],wings:[[54,142],[146,142]],feet:[[86,186],[114,186]],nk:[100,156,84],tail:null},
   {b:[100,124,52,60],br:14,top:64,f:[100,104,1],bk:[100,118],wings:[[46,132],[154,132]],feet:[[84,186],[116,186]],nk:[100,144,96],tail:[150,158]}
  ][st];
  let g='';
  if(P.tail) g+=`<g transform="rotate(-20 ${P.tail[0]} ${P.tail[1]})">${blob([[P.tail[0]+10,P.tail[1]-8,8,16],[P.tail[0]+20,P.tail[1]+2,7,14]],'#FFC23A',L)}</g>`;
  if(P.feet) P.feet.forEach(([x,y])=>{g+=`<path d="M${x} ${y-14}v10M${x} ${y-4}l-7 5M${x} ${y-4}l7 5M${x} ${y-4}v7" stroke="#E87A2E" stroke-width="4" stroke-linecap="round" fill="none"/>`;});
  g+=blob([[P.b[0],P.b[1],P.b[2],P.b[3]]],F,L);
  if(P.wings) P.wings.forEach(([x,y],i)=>{const t=i?-22:22;
    g+=`<g transform="rotate(${t} ${x} ${y})">${E(x,y,15,22,'#FFC23A',`stroke="${L}" stroke-width="3.5"`)}${st===2?`<path d="M${x-4} ${y-10}v8h8v8" fill="none" stroke="${L}" stroke-width="2.2"/><circle cx="${x+4}" cy="${y+6}" r="2.4" fill="${L}"/><circle cx="${x-4}" cy="${y-10}" r="2.4" fill="${L}"/>`:''}</g>`;});
  g+=E(P.b[0],P.b[1]+P.b[3]*.35,P.b[2]*.6,P.b[3]*.42,'#FFE69A');
  g+=E(P.b[0]-P.b[2]*.45,P.b[1]-P.b[3]*.5,9,6,'#fff','opacity=".8"');
  if(P.egg) g+=eggshell('#FFF6E6','#C9B48E');
  g+=face(P.f[0],P.f[1],P.f[2],mood,'#3B2350',{cheek:'#FF9E8A',noMouth:true});
  const [bx,by]=P.bk;
  if(mood==='happy'||mood==='surprised') g+=`<path d="M${bx-9} ${by} L${bx} ${by-7} L${bx+9} ${by}Z" fill="#FF8A3D" stroke="#B8541A" stroke-width="2.4" stroke-linejoin="round"/>${E(bx,by+3,6,4,'#B8433A')}<path d="M${bx-7} ${by+4} L${bx} ${by+12} L${bx+7} ${by+4}Z" fill="#FF8A3D" stroke="#B8541A" stroke-width="2.4" stroke-linejoin="round"/>`;
  else g+=`<path d="M${bx-8} ${by} L${bx} ${by-6} L${bx+8} ${by} L${bx} ${by+7}Z" fill="#FF8A3D" stroke="#B8541A" stroke-width="2.4" stroke-linejoin="round"/>`;
  const lit=(mood==='happy'||mood==='surprised');
  return {g,a:{f:P.f,nk:P.nk,top:[100,P.top+4,64]},bulb:{x:100,top:P.top,r:P.br,lit}};
}
function bulbSVG(b,lift){
  const {x,r,lit}=b,base=b.top-lift,cy=base-r*.8-r*.9;let g='';
  if(lit){g+=`<circle cx="${x}" cy="${cy}" r="${r+11}" fill="#FFE680" opacity=".55"/>`;
    for(let k=0;k<7;k++){const a=(-90+(k-3)*32)*Math.PI/180,r1=r+14,r2=r+22;g+=`<path d="M${x+Math.cos(a)*r1} ${cy+Math.sin(a)*r1}L${x+Math.cos(a)*r2} ${cy+Math.sin(a)*r2}" stroke="#D99A00" stroke-width="3" stroke-linecap="round"/>`;}}
  g+=`<rect x="${x-r*.6}" y="${base-r*.9}" width="${r*1.2}" height="${r*.95}" rx="2" fill="#B5A8C4" stroke="#6F6283" stroke-width="2.4"/><path d="M${x-r*.6} ${base-r*.55}h${r*1.2}" stroke="#6F6283" stroke-width="1.8"/>`;
  g+=`<circle cx="${x}" cy="${cy}" r="${r}" fill="${lit?'#FFF08A':'#FFF9E6'}" stroke="#C98A12" stroke-width="2.8"/><path d="M${x-r*.35} ${cy+r*.35} L${x-r*.15} ${cy-r*.2} L${x+r*.15} ${cy+r*.1} L${x+r*.35} ${cy-r*.35}" fill="none" stroke="#C98A12" stroke-width="2"/>`;
  return g;
}
/* --- 服裝 --- */
function scarf([x,y,w]){const h=15;return `<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${h/2}" fill="#E8553D" stroke="#A3321F" stroke-width="2.8"/>`+
  [-.25,0,.25].map(k=>`<path d="M${x+w*k} ${y-h/2+2}v${h-4}" stroke="#FFE0C8" stroke-width="3.5"/>`).join('')+
  `<g transform="rotate(-10 ${x+w*.28} ${y})"><rect x="${x+w*.18}" y="${y+2}" width="15" height="28" rx="5" fill="#E8553D" stroke="#A3321F" stroke-width="2.8"/><path d="M${x+w*.18+3} ${y+30}v5M${x+w*.18+7.5} ${y+30}v5M${x+w*.18+12} ${y+30}v5" stroke="#A3321F" stroke-width="2.2" stroke-linecap="round"/></g>`;}
function hat([x,y,w]){const ww=w*.86,hh=ww*.62;return `<path d="M${x-ww/2} ${y+4} Q${x-ww/2} ${y-hh} ${x} ${y-hh-2} Q${x+ww/2} ${y-hh} ${x+ww/2} ${y+4}Z" fill="#4F7BD9" stroke="#2D4E9A" stroke-width="3"/><path d="M${x-ww*.2} ${y-hh+6} Q${x-ww*.17} ${y-hh/2} ${x-ww*.2} ${y+2}M${x+ww*.2} ${y-hh+6} Q${x+ww*.17} ${y-hh/2} ${x+ww*.2} ${y+2}" stroke="#7FA3EE" stroke-width="3" fill="none"/><rect x="${x-ww/2-4}" y="${y-4}" width="${ww+8}" height="13" rx="6.5" fill="#FFD65E" stroke="#A8670E" stroke-width="2.8"/><circle cx="${x}" cy="${y-hh-4}" r="7.5" fill="#FFF9F2" stroke="#2D4E9A" stroke-width="2.8"/>`;}
function glasses([x,y,s],dark){const dx=13*s,r=9.5*s,c=dark?'#FFD65E':'#3B2350';return `<circle cx="${x-dx}" cy="${y}" r="${r}" fill="#E8F4FF" fill-opacity=".25" stroke="${c}" stroke-width="${3*s}"/><circle cx="${x+dx}" cy="${y}" r="${r}" fill="#E8F4FF" fill-opacity=".25" stroke="${c}" stroke-width="${3*s}"/><path d="M${x-dx+r} ${y-1} Q${x} ${y-5*s} ${x+dx-r} ${y-1}" stroke="${c}" stroke-width="${2.8*s}" fill="none"/>`;}

function pet(type,st,mood,o={}){
  const R=type==='bunny'?bunny(st,mood):type==='turtle'?turtle(st,mood):type==='cat'?cat(st,mood):chick(st,mood,o);
  const a=R.a;let g=R.g;
  const wear=(o.wear||'').split(',');
  if(o.egg&&type!=='chick'){const col={bunny:['#E9EEFF','#9AA3D6'],turtle:['#E4F5E8','#7DB892'],cat:['#FFE9DC','#E2A07F']}[type];
    g=`<g transform="translate(0 -14)">${g}</g>`+eggshell(col[0],col[1]);}
  if(wear.includes('scarf')) g+=scarf(a.nk);
  if(wear.includes('glasses')) g+=glasses(a.f,a.screen);
  if(wear.includes('hat')) g+=hat(a.top);
  if(wear.includes('bow')) g+=bow(a.top);
  if(wear.includes('medal')) g+=medal(a.nk);
  if(wear.includes('headset')) g+=headset(a.top);
  if(R.bulb) g+=bulbSVG(R.bulb,wear.includes('hat')?R.bulb.r+14:0);
  const [fx,fy,fs]=a.f;
  if(o.snack){g+=`<svg viewBox="0 0 48 48" x="${fx+6*fs}" y="${fy+8*fs}" width="${28*fs}" height="${28*fs}"><circle cx="24" cy="24" r="20" fill="#E9A955" stroke="#A8672A" stroke-width="3"/><circle cx="24" cy="24" r="14" fill="#F3C27A"/><circle cx="17" cy="19" r="2.6" fill="#6B3E1F"/><circle cx="29" cy="17" r="2.2" fill="#6B3E1F"/><circle cx="26" cy="29" r="2.8" fill="#6B3E1F"/><circle cx="16" cy="29" r="1.8" fill="#6B3E1F"/></svg><circle cx="${fx-14}" cy="${fy+34}" r="2.2" fill="#C98A4A"/><circle cx="${fx+30}" cy="${fy+44}" r="2.6" fill="#C98A4A"/><circle cx="${fx-4}" cy="${fy+46}" r="1.8" fill="#C98A4A"/>`;}
  if(o.spark){[[28,40,9],[176,58,7],[164,22,5]].forEach(([x,y,r])=>{g+=`<path d="M${x} ${y-r}L${x+r*.3} ${y-r*.3}L${x+r} ${y}L${x+r*.3} ${y+r*.3}L${x} ${y+r}L${x-r*.3} ${y+r*.3}L${x-r} ${y}L${x-r*.3} ${y-r*.3}Z" fill="#FFC233" stroke="#A8670E" stroke-width="1.4"/>`;});}
  if(o.q){g+=`<g><circle cx="172" cy="34" r="20" fill="#FFF9F2" stroke="#6A45C9" stroke-width="3.5"/><text x="172" y="44" text-anchor="middle" font-family="Baloo 2,Noto Sans TC" font-weight="800" font-size="28" fill="#6A45C9">?</text><circle cx="28" cy="52" r="14" fill="#FFF9F2" stroke="#6A45C9" stroke-width="3"/><text x="28" y="60" text-anchor="middle" font-family="Baloo 2,Noto Sans TC" font-weight="800" font-size="20" fill="#6A45C9">?</text></g>`;}
  if(o.sweat){g+=`<path d="M164 46 Q172 60 164 64 Q156 60 164 46Z" fill="#9BD7F2" stroke="#2F86C8" stroke-width="2.4"/>`;}
  const nm={bunny:'雲朵兔',turtle:'鍵盤龜',cat:'螢幕貓',chick:'燈泡雞'}[type],sn=['寶寶','小朋友','大朋友'][st],mn={happy:'開心',normal:'普通',worried:'擔心',surprised:'驚訝'}[mood];
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${nm}（${sn}）${mn}"><ellipse cx="100" cy="196" rx="58" ry="6" fill="#3B2350" opacity=".10"/>${g}</svg>`;
}

/* --- 追加服裝（2026-11-21 M2：6 關各解鎖一件，mockup 只有前 3 件） --- */
function bow([x,y,w]){const s=w/64;return `<g transform="translate(${x+w*.26} ${y+2}) scale(${s})"><path d="M0 0 L-20 -13 Q-26 0 -20 13Z" fill="#FF7FA8" stroke="#B83D6B" stroke-width="3" stroke-linejoin="round"/><path d="M0 0 L20 -13 Q26 0 20 13Z" fill="#FF7FA8" stroke="#B83D6B" stroke-width="3" stroke-linejoin="round"/><circle r="6.5" fill="#FFB3CB" stroke="#B83D6B" stroke-width="3"/></g>`;}
function medal([x,y,w]){return `<path d="M${x-12} ${y-6} L${x-4} ${y+18} M${x+12} ${y-6} L${x+4} ${y+18}" stroke="#4F7BD9" stroke-width="7" stroke-linecap="round"/><circle cx="${x}" cy="${y+26}" r="11" fill="#FFC233" stroke="#A8670E" stroke-width="2.8"/><path d="M${x} ${y+19}l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#FFF0C4"/>`;}
function headset([x,y,w]){const r=w*.62;return `<path d="M${x-r} ${y+18} Q${x-r} ${y-r*.9} ${x} ${y-r*.9} Q${x+r} ${y-r*.9} ${x+r} ${y+18}" fill="none" stroke="#3B2350" stroke-width="6" stroke-linecap="round"/><rect x="${x-r-9}" y="${y+8}" width="18" height="26" rx="8" fill="#6A45C9" stroke="#3B2350" stroke-width="3"/><rect x="${x+r-9}" y="${y+8}" width="18" height="26" rx="8" fill="#6A45C9" stroke="#3B2350" stroke-width="3"/>`;}

/* ========== 對外介面 ========== */
var TYPES = [
  { id:'bunny',  name:'雲朵兔', desc:'耳朵收得到訊號' },
  { id:'turtle', name:'鍵盤龜', desc:'背上是小鍵盤' },
  { id:'cat',    name:'螢幕貓', desc:'臉就是小螢幕' },
  { id:'chick',  name:'燈泡雞', desc:'想到點子頭上會亮' }
];
var OUTFITS = [
  { id:'scarf', name:'圍巾' }, { id:'hat', name:'帽子' }, { id:'glasses', name:'眼鏡' },
  { id:'bow', name:'蝴蝶結' }, { id:'medal', name:'獎牌' }, { id:'headset', name:'耳機' }
];
// 每一關第一次過關解鎖的服裝（unit 編號 → 服裝 id）
var UNIT_OUTFIT = { 29:'scarf', 30:'hat', 31:'glasses', 32:'bow', 8:'medal', 9:'headset' };
var STEP = 8;                     // 每 8 個點心長大一階：0–7 寶寶、8–15 小朋友、16 以上大朋友
var KEY = 'edtech-smart-pets';    // { v:1, cur:id, pets:[{ id, seat, owner, name, type, snacks, got:{"29-0":1}, outfits:[], wear:[], t }] }
var MAX_PETS = 40;                // 一台電腦最多住幾隻（一班座號夠用）

function sget(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function sset(k,v){ try { localStorage.setItem(k,v); return true; } catch(e){ return false; } }
function load(){ try { var d = JSON.parse(sget(KEY)); if (d && Array.isArray(d.pets)) return d; } catch(e){} return { v:1, cur:null, pets:[] }; }
function save(d){ return sset(KEY, JSON.stringify(d)); }
function stageOf(snacks){ return snacks >= STEP*2 ? 2 : snacks >= STEP ? 1 : 0; }
function find(d,id){ for (var i=0;i<d.pets.length;i++) if (d.pets[i].id === id) return d.pets[i]; return null; }
function clean(s,n){ return String(s == null ? '' : s).replace(/[<>&"]/g,'').trim().slice(0,n); }

// 畫寵物：p 可以是寵物物件，或 { type, stage, wear }；mood：happy／normal／worried／surprised
function svgOf(p, mood, o){
  o = o || {};
  var stage = p.stage != null ? p.stage : stageOf(p.snacks || 0);
  var wear = o.wear != null ? o.wear : (p.wear || []);
  return pet(p.type || 'bunny', stage, mood || 'normal', {
    egg: stage === 0, wear: Array.isArray(wear) ? wear.join(',') : wear,
    snack: o.snack, spark: o.spark, q: o.q, sweat: o.sweat
  });
}

var api = {
  TYPES: TYPES, OUTFITS: OUTFITS, UNIT_OUTFIT: UNIT_OUTFIT, STEP: STEP, KEY: KEY,
  svg: function(type, stage, mood, o){ return svgOf({ type:type, stage:stage }, mood, o); },
  svgOf: svgOf,
  stageOf: stageOf,
  stageName: function(st){ return ['寶寶','小朋友','大朋友'][st] || ''; },
  typeName: function(t){ for (var i=0;i<TYPES.length;i++) if (TYPES[i].id === t) return TYPES[i].name; return ''; },
  outfitName: function(id){ for (var i=0;i<OUTFITS.length;i++) if (OUTFITS[i].id === id) return OUTFITS[i].name; return ''; },
  list: function(){ return load().pets.slice(); },
  current: function(){ var d = load(); return find(d, d.cur) || null; },
  setCurrent: function(id){ var d = load(); if (find(d,id)) { d.cur = id; save(d); return true; } return false; },
  // 領養：座號＋主人名字＋寵物名字＋種類；同座號同名字的主人可以養不同隻
  adopt: function(o){
    var d = load();
    var t = TYPES.some(function(x){ return x.id === o.type; }) ? o.type : 'bunny';
    var p = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      seat: clean(o.seat,3), owner: clean(o.owner,8), name: clean(o.name,6) || api.typeName(t),
      type: t, snacks: 0, got: {}, outfits: [], wear: [], t: Date.now() };
    d.pets.push(p); if (d.pets.length > MAX_PETS) d.pets.shift();
    d.cur = p.id; save(d); return p;
  },
  remove: function(id){ var d = load(); d.pets = d.pets.filter(function(p){ return p.id !== id; }); if (d.cur === id) d.cur = d.pets.length ? d.pets[d.pets.length-1].id : null; save(d); },
  setWear: function(id, list){
    var d = load(), p = find(d,id); if (!p) return null;
    p.wear = (list || []).filter(function(w){ return p.outfits.indexOf(w) >= 0; }); save(d); return p;
  },
  // 過關給點心：每個 (unit, 第幾關) 第一次過關給 1 個；unit 第一次過關解鎖該關服裝
  // 回傳 { pet, snack, before, after, stageUp, outfit }；沒有寵物（訪客）回傳 null
  award: function(unit, level){
    var d = load(), p = find(d, d.cur); if (!p) return null;
    var k = unit + '-' + level, before = p.snacks, snack = !p.got[k], outfit = null;
    if (snack) { p.got[k] = 1; p.snacks++; }
    var oid = UNIT_OUTFIT[unit];
    if (oid && p.outfits.indexOf(oid) < 0) { p.outfits.push(oid); outfit = oid; }
    save(d);
    return { pet: p, snack: snack, before: before, after: p.snacks, stageUp: stageOf(p.snacks) > stageOf(before), outfit: outfit };
  }
};
window.SmartPet = api;
})();
