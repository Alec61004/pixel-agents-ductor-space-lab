const {chromium}=require('playwright');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const {PNG}=require('pngjs');
const ui=path.resolve(__dirname,'../..'), root=path.resolve(ui,'..');
const assets=path.join(ui,'public/assets/themes/ductor-space-lab/pixel-scene');
const out=process.env.SCENE_QA_OUTPUT || path.join(root,'.tmp/pixel-scene-qa');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PIXEL_SCENE_BROWSER,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const rootAsset='/assets/themes/ductor-space-lab/pixel-scene/';
 let failOnce=true, failImage=true;
 await page.route('http://scene.test/**',async route=>{
   const u=new URL(route.request().url()), pathname=u.pathname.replace(/^\/sub\//,'/');
   if(pathname==='/retry/scene.json') {
     if(failOnce){failOnce=false;return route.fulfill({status:503,body:'test transient failure'});}
     return route.fulfill({path:path.join(ui,'public'+rootAsset+'scene.json'),contentType:'application/json'});
   }
   if(pathname===rootAsset+'missing.json')return route.fulfill({status:404,body:'missing'});
   if(pathname.startsWith('/retry/layers/')) return route.fulfill({path:path.join(assets,pathname.slice('/retry/'.length)),contentType:'image/png'});
   if(pathname===rootAsset+'bad-layer.json') {
     const m=JSON.parse(fs.readFileSync(path.join(ui,'public'+rootAsset+'scene.json')));m.layers[0].asset='layers/test-fail.png';
     return route.fulfill({json:m});
   }
   if(pathname===rootAsset+'layers/test-fail.png') {
     if(failImage){failImage=false;return route.fulfill({status:404,body:'missing'});}
     return route.fulfill({path:path.join(assets,'layers/hull-remainder.png'),contentType:'image/png'});
   }
   if(pathname.endsWith('/pixel-scene-editor.html')) return route.fulfill({path:path.join(ui,'pixel-scene-editor.html'),contentType:'text/html'});
   if(pathname.startsWith('/src/')) {
     const file=path.join(ui,pathname.replace(/^\//,'').replace(/\.js$/,'.ts'));
     const code=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace("import.meta.env?.BASE_URL ?? './'","'/sub/'");
     return route.fulfill({body:code,contentType:'text/javascript'});
   }
   if(pathname.startsWith(rootAsset)) {
     const rel=pathname.slice(rootAsset.length),file=rel==='scene.json'?path.join(ui,'public'+rootAsset+'scene.json'):path.join(assets,rel);
     if(fs.existsSync(file))return route.fulfill({path:file,contentType:rel.endsWith('.json')?'application/json':'image/png'});
   }
   return route.fulfill({status:404,body:'not found'});
 });
 await page.goto('http://scene.test/sub/pixel-scene-editor.html');
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('43 layers đã tải'));
 await page.evaluate(async()=>{
   window.module=await import('/src/ductor/starshipPixelScene.js');
   window.scene=await window.module.loadStarshipPixelScene('/sub/assets/themes/ductor-space-lab/pixel-scene/scene.json');
 });
 const check=(name,result)=>{assert(result,name);console.log('PASS',name);};
 async function frame(name,t,working){
   const data=await page.evaluate(({t,working})=>{scene.render(t,working);const c=document.createElement('canvas');c.width=1926;c.height=816;c.getContext('2d').drawImage(scene.nativeArtwork,0,0);return c.toDataURL();},{t,working});
   const buf=Buffer.from(data.split(',')[1],'base64');fs.writeFileSync(path.join(out,name+'.png'),buf);return PNG.sync.read(buf).data;
 }
 const idle=await frame('idle',0,false),source=PNG.sync.read(fs.readFileSync(path.join(assets,'scene-reference.png'))).data;
 check('browser idle exactly matches source RGBA',idle.equals(source));
 check('runtime artwork normalized for 1600x678 samplers',await page.evaluate(()=>scene.artwork.width===1600&&scene.artwork.height===678));
 const a=await frame('working-a',0.5,true),b=await frame('working-b',1.8,true);
 let diff=0,motion=0,desk=0,holes=0;
 for(let i=0;i<a.length;i+=4){if(a[i+3]!==255)holes++;if(a[i]!==idle[i]||a[i+1]!==idle[i+1]||a[i+2]!==idle[i+2]){diff++;const x=(i/4)%1926,y=Math.floor(i/4/1926);if(x>370&&x<960&&y>320&&y<533)desk++;}if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])motion++;}
 check('working visibly changes desk-owned pixels',desk>3000);check('animation changes across frames',motion>3000);check('no transparent gaps while working',holes===0);
 check('working to idle restores original',idle.equals(await frame('idle-restored',20,false)));
 check('failed manifest load rejects and retry recovers',await page.evaluate(async()=>{let rejected=false;try{await module.loadStarshipPixelScene('/retry/scene.json')}catch{rejected=true}return rejected&&Boolean(await module.loadStarshipPixelScene('/retry/scene.json'));}));
 check('failed image load rejects and retry recovers',await page.evaluate(async()=>{let rejected=false;try{await module.loadStarshipPixelScene('/assets/themes/ductor-space-lab/pixel-scene/bad-layer.json')}catch{rejected=true}return rejected&&Boolean(await module.loadStarshipPixelScene('/assets/themes/ductor-space-lab/pixel-scene/bad-layer.json'));}));
 // Exact layer translation with all other layers hidden: working effect follows source transform.
 check('working effects follow moved layer coordinates',await page.evaluate(()=>{
   const saved=structuredClone(scene.manifest.layers),l=scene.manifest.layers.find(l=>l.id==='command-desk');scene.manifest.layers.forEach(v=>v.visible=v===l);
   scene.render(1,true);const c=document.createElement('canvas');c.width=1926;c.height=816;const ctx=c.getContext('2d');ctx.drawImage(scene.nativeArtwork,0,0);const first=ctx.getImageData(0,0,1926,816).data;
   l.x+=25;l.y+=17;scene.render(1,true);ctx.clearRect(0,0,1926,816);ctx.drawImage(scene.nativeArtwork,0,0);const second=ctx.getImageData(0,0,1926,816).data;
   let ok=true;for(let y=0;y<799;y++)for(let x=0;x<1901;x++){const i=(y*1926+x)*4,j=((y+17)*1926+x+25)*4;for(let k=0;k<4;k++)if(first[i+k]!==second[j+k])ok=false;}
   scene.manifest.layers.forEach((v,i)=>Object.assign(v,saved[i]));return ok;
 }));
 await page.click('#working');await page.click('#focus');await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'editor-working.png')});
 await page.selectOption('#layer','command-desk');await page.fill('#x','396');await page.locator('#x').press('Tab');
 check('HTML editor changes the same manifest used by compositor',await page.evaluate(()=>scene.manifest.layers.find(l=>l.id==='command-desk').x===396));
 await page.click('#reset');check('HTML reset restores layer',await page.evaluate(()=>scene.manifest.layers.find(l=>l.id==='command-desk').x===371));
 const download=page.waitForEvent('download');await page.click('#save');const dl=await download;await dl.saveAs(path.join(out,'exported-scene.json'));check('HTML exports editable manifest',JSON.parse(fs.readFileSync(path.join(out,'exported-scene.json'))).layers.length===43);
 check('drawStage activates source animation only for Alec at work',await page.evaluate(async()=>{
   const sim=await import('/src/ductor/starshipSimulation.js');
   const img=new Image();img.src='/assets/themes/ductor-space-lab/pixel-scene/scene-reference.png';await img.decode();
   const c=document.createElement('canvas');c.width=1600;c.height=678;
   const ws=sim.WORKSTATIONS.Alec;
   const a=sim.makeAgent({id:'Alec',name:'Alec',role:'Strategy',skin:sim.SKINS[0],x:ws.interactionPoint.x,y:ws.interactionPoint.y,state:sim.STATE.WORKING,reportedState:'working'});
   a.commandTime=1.8;
   const calls=[],render=scene.render;scene.render=(t,active)=>{calls.push({t,active});return render(t,active)};
   const draw=()=>sim.drawStage(c.getContext('2d'),img,img,[a],false,{width:1600,height:678},1,50,0,0,1,undefined,undefined,undefined,undefined,undefined,undefined,scene);
   draw();const activeDesk=c.getContext('2d').getImageData(350,250,450,100).data;
   a.reportedState='idle';draw();const idleDesk=c.getContext('2d').getImageData(350,250,450,100).data;
   let deskDelta=0;for(let i=0;i<activeDesk.length;i+=4)if(activeDesk[i]!==idleDesk[i]||activeDesk[i+1]!==idleDesk[i+1]||activeDesk[i+2]!==idleDesk[i+2])deskDelta++;
   a.reportedState='review';draw();a.reportedState='offline';draw();a.reportedState='working';a.x+=40;draw();
   scene.render=render;return deskDelta>1000 && calls.length===5 && calls[0].t===1.8 && JSON.stringify(calls.map(c=>c.active))===JSON.stringify([true,false,true,false,false]);
 }));
 await page.setViewportSize({width:390,height:844});
 check('HTML editor has no mobile horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 check('no browser JavaScript errors',errors.length===0);
 const report={passed:true,browser:'Chromium',idleExact:true,workingChangedPixels:diff,deskChangedPixels:desk,animatedPixels:motion,transparentPixels:holes,editorSharedRenderer:true,errorRetry:true,jsErrors:errors};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(report);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
