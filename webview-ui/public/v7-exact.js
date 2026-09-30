const MANIFEST='/assets/themes/ductor-space-lab/pixel-scene-v7/scene.json';
const scene=document.getElementById('scene');
const status=document.getElementById('status');
function fit(){
  const s=Math.min(innerWidth/1926,innerHeight/816);
  scene.style.transform='scale('+s+')';
}
addEventListener('resize',fit); fit();
fetch(MANIFEST,{cache:'no-store'}).then(r=>{
  if(!r.ok) throw new Error('manifest '+r.status);
  return r.json();
}).then(m=>{
  const layers=[...m.layers].filter(l=>l.visible&&l.opacity>0).sort((a,b)=>a.z-b.z);
  for(const l of layers){
    const el=document.createElement('span');
    el.className='layer';
    el.dataset.layerId=l.id;
    el.style.width=l.source.w+'px';
    el.style.height=l.source.h+'px';
    el.style.opacity=String(l.opacity);
    el.style.zIndex=String(l.z);
    el.style.transform='translate3d('+l.x+'px,'+l.y+'px,0) rotate('+l.rotation+'deg) scale('+l.scaleX+','+l.scaleY+')';
    const img=document.createElement('img');
    const manifestUrl=new URL(MANIFEST,location.origin);
    img.src=new URL(l.asset,manifestUrl).href;
    img.alt='';
    img.draggable=false;
    el.appendChild(img);
    scene.appendChild(el);
  }
  const ws=layers.filter(l=>/^agent-(alec|kevin|benjamin)-v7-/.test(l.id));
  status.textContent='V7 exact · '+layers.length+' layers · '+ws.length+' workstation layers';
}).catch(e=>{status.textContent='V7 ERROR: '+e.message;status.style.color='#f88';});
