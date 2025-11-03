/* sketch.js — auto-slice with Wix-safe “confirm download” popup
   ZIP filename/top folder = <prefix>
   Slices at <prefix>/assets/<prefix>/<prefix>_NN.png
*/

let sheetImg = null;
let sheetURL = null;
let slicesFiles = []; // {name, blob, url}
let manifest = { id: 'auto-slices', title: 'Auto Slices', version:'1.0.0', assets: [] };

// popup state
let pendingBlob = null;
let pendingName = '';

// small helpers
const $ = (id) => document.getElementById(id);
const nowLog = (msg) => {
  const d = document.createElement('div');
  d.textContent = `${new Date().toLocaleTimeString()} — ${msg}`;
  $('logs').prepend(d);
};

// sanitize user prefix -> folder/file safe
function sanitizePrefix(raw) {
  const s = (raw || '').trim().replace(/\s+/g,'_').replace(/[^A-Za-z0-9_\-]/g,'_');
  return s || 'frames';
}

// DOM refs (filled in setup)
let fileInput, btnLoad, btnClear, previewArea, previewInner;
let prefixEl, zeroPadEl, alphaThresholdEl, minWidthEl, gapTolEl;
let btnAuto, btnZip, btnToAssets, btnDownloadCurrent;
let assetList, manifestPreview;
let popup, popupFilename, btnConfirm, btnCancel;

function setup(){
  noCanvas();

  // Bind DOM
  fileInput = $('fileInput');
  btnLoad = $('btnLoad');
  btnClear = $('btnClear');
  previewArea = $('previewArea');
  previewInner = $('previewInner');

  prefixEl = $('prefix');
  zeroPadEl = $('zeroPad');
  alphaThresholdEl = $('alphaThreshold');
  minWidthEl = $('minWidth');
  gapTolEl = $('gapTol');

  btnAuto = $('btnAuto');
  btnZip = $('btnZip');
  btnToAssets = $('btnToAssets');
  btnDownloadCurrent = $('btnDownloadCurrent');

  assetList = $('assetList');
  manifestPreview = $('manifestPreview');

  popup = $('downloadPopup');
  popupFilename = $('popupFilename');
  btnConfirm = $('confirmDownload');
  btnCancel = $('cancelPopup');

  // Popup wire-up
  btnCancel.addEventListener('click', closePopup);
  btnConfirm.addEventListener('click', doConfirmDownload);

  // File load
  btnLoad.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', (ev)=> {
    if(ev.target.files.length) loadSheetFromFile(ev.target.files[0]);
  });

  // Drag & drop
  previewArea.addEventListener('dragover', (e)=>{ e.preventDefault(); previewArea.style.outline='3px dashed #0ea5a4'; });
  previewArea.addEventListener('dragleave', (e)=>{ e.preventDefault(); previewArea.style.outline='none'; });
  previewArea.addEventListener('drop', (e)=>{
    e.preventDefault(); previewArea.style.outline='none';
    if(e.dataTransfer.files.length) loadSheetFromFile(e.dataTransfer.files[0]);
  });

  // Clear
  btnClear.addEventListener('click', ()=>{
    if(sheetURL) URL.revokeObjectURL(sheetURL);
    clearAll();
    previewInner.innerHTML = 'No image loaded';
    previewArea.style.background = '#111827';
    nowLog('Cleared');
  });

  // Actions
  btnAuto.addEventListener('click', onAutoSlice);
  btnZip.addEventListener('click', onAutoSliceAndZip);
  btnToAssets.addEventListener('click', onAutoSliceToAssets);
  btnDownloadCurrent.addEventListener('click', onDownloadCurrentZip);

  updateManifest();
  nowLog('Auto-slice tool ready');
}

/* ---------- UI helpers ---------- */
function openPopup(filename, blob){
  pendingBlob = blob;
  pendingName = filename; // e.g. "Attack.zip"
  popupFilename.textContent = filename;
  popup.style.display = 'flex';
}
function closePopup(){
  popup.style.display = 'none';
  pendingBlob = null;
  pendingName = '';
}

/* --- Preserves the user filename in the browser save dialog (Wix-safe) --- */
function doConfirmDownload(){
  if(!pendingBlob) return;
  const url = URL.createObjectURL(pendingBlob);

  // Anchor with download keeps the file name; _top helps inside Wix iframe
  const a = document.createElement('a');
  a.href = url;
  a.download = pendingName;
  a.target = '_top';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(()=> URL.revokeObjectURL(url), 5000);
  closePopup();
}

function updateManifest(){
  manifestPreview.innerText = JSON.stringify(manifest, null, 2);
}

/* ---- THUMBNAIL PREVIEW LIST ---- */
function renderAssets(){
  assetList.innerHTML = '';
  if (slicesFiles.length === 0) return;

  assetList.style.display = 'flex';
  assetList.style.flexDirection = 'column';
  assetList.style.gap = '8px';

  for(const s of slicesFiles){
    const row = document.createElement('div');
    row.className = 'asset';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.padding = '8px';
    row.style.borderRadius = '8px';
    row.style.background = '#f3f4f6';
    row.style.border = '1px solid #e5e7eb';

    const img = document.createElement('img');
    img.src = s.url;
    img.alt = s.name;
    img.style.width = '72px';
    img.style.height = '72px';
    img.style.objectFit = 'contain';
    img.style.background = '#fff';
    img.style.border = '1px solid #e5e7eb';
    img.style.borderRadius = '6px';
    img.style.imageRendering = 'pixelated';

    const meta = document.createElement('div');
    meta.style.flex = '1 1 auto';
    meta.innerHTML = `<div style="font-weight:600">${s.name}</div>
      <div style="color:#6b7280;font-size:12px">${(s.blob.size/1024).toFixed(1)} KB</div>`;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const openBtn = document.createElement('a');
    openBtn.href = s.url; openBtn.target = '_blank';
    openBtn.textContent = 'Open';
    openBtn.className = 'btn';
    openBtn.style.textDecoration = 'none';
    openBtn.style.padding = '6px 10px';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'btn secondary';
    removeBtn.style.padding = '6px 10px';
    removeBtn.addEventListener('click', ()=>{
      const i = slicesFiles.findIndex(x => x.name === s.name);
      if(i >= 0){
        try{ URL.revokeObjectURL(slicesFiles[i].url); }catch(e){}
        slicesFiles.splice(i,1);
        manifest.assets = manifest.assets.filter(a => a.name !== s.name);
        renderAssets(); updateManifest();
        nowLog(`Removed ${s.name}`);
      }
    });

    actions.appendChild(openBtn);
    actions.appendChild(removeBtn);

    row.appendChild(img);
    row.appendChild(meta);
    row.appendChild(actions);
    assetList.appendChild(row);
  }
}

function clearAll(){
  sheetImg = null; sheetURL = null;
  slicesFiles.forEach(s => { try{ URL.revokeObjectURL(s.url);}catch(e){} });
  slicesFiles = [];
  manifest = { id:'auto-slices', title:'Auto Slices', version:'1.0.0', assets: [] };
  renderAssets();
  updateManifest();
}

/* ---------- Load image ---------- */
async function loadSheetFromFile(file){
  if(sheetURL) URL.revokeObjectURL(sheetURL);
  clearAll();
  sheetURL = URL.createObjectURL(file);
  sheetImg = new Image();
  sheetImg.onload = ()=> {
    // scaled preview
    previewInner.innerHTML = '';
    const canvas = document.createElement('canvas');
    const maxW = 760;
    const scale = Math.min(1, maxW / sheetImg.width);
    canvas.width = Math.max(1, Math.floor(sheetImg.width * scale));
    canvas.height = Math.max(1, Math.floor(sheetImg.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheetImg, 0, 0, canvas.width, canvas.height);
    previewInner.appendChild(canvas);
    previewArea.style.background = '#fff';
    nowLog(`Loaded sheet ${file.name} (${sheetImg.width}×${sheetImg.height})`);
  };
  sheetImg.onerror = ()=> nowLog('Error loading image');
  sheetImg.src = sheetURL;
}

/* ---------- Slicing ---------- */
function detectFrameRuns(alphaThreshold=1, minWidth=4, gapTol=4){
  if(!sheetImg) return [];
  const c = document.createElement('canvas');
  c.width = sheetImg.width; c.height = sheetImg.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(sheetImg, 0, 0);
  const imgData = ctx.getImageData(0,0,c.width,c.height).data;

  const width = c.width, height = c.height;
  const colHasPixel = new Uint8Array(width);
  for(let x=0;x<width;x++){
    let occupied = 0;
    for(let y=0;y<height;y++){
      const idx = (y*width + x) * 4;
      if(imgData[idx+3] >= alphaThreshold){ occupied = 1; break; }
    }
    colHasPixel[x] = occupied;
  }

  const runs = [];
  let x = 0;
  while(x < width){
    while(x < width && colHasPixel[x] === 0) x++;
    if(x >= width) break;
    let start = x, last = x; x++;
    while(x < width){
      if(colHasPixel[x] === 1){ last = x; x++; continue; }
      let gap = 1;
      while((x+gap) < width && gap <= gapTol && colHasPixel[x+gap] === 0) gap++;
      if((x+gap) < width && gap <= gapTol && colHasPixel[x+gap] === 1){ x = x + gap + 1; last = x-1; continue; }
      break;
    }
    if(last - start + 1 >= minWidth) runs.push({start, end:last});
    x = last + 1;
  }
  return runs;
}

async function extractRunsAsBlobs(runs, prefix, padLen){
  const out = [];
  const fullC = document.createElement('canvas');
  fullC.width = sheetImg.width; fullC.height = sheetImg.height;
  const fullCtx = fullC.getContext('2d');
  fullCtx.drawImage(sheetImg, 0, 0);
  let idx = 1;
  for(const r of runs){
    const w = r.end - r.start + 1;
    const h = sheetImg.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(fullC, r.start, 0, w, h, 0, 0, w, h);
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    const name = `${prefix}${String(idx).padStart(padLen,'0')}.png`;
    out.push({ name, blob });
    idx++;
  }
  return out;
}

/* ---------- ZIP builder with requested structure ---------- */
async function buildZipFromBlobs(blobs, prefixSafe){
  const zip = new JSZip();

  // root folder == prefix
  const root = zip.folder(prefixSafe);

  // assets/<prefix>/
  const assetsFolder = root.folder('assets').folder(prefixSafe);

  const manifestAssets = [];
  blobs.forEach(b => {
    assetsFolder.file(b.name, b.blob);
    manifestAssets.push({
      name: b.name,
      path: `assets/${prefixSafe}/${b.name}`,
      size: b.blob.size,
      type: 'image/png'
    });
  });

  const manifestObj = {
    id: prefixSafe,
    title: 'Auto Slices',
    version: '1.0.0',
    assets: manifestAssets
  };
  root.file('manifest.json', JSON.stringify(manifestObj, null, 2));

  const content = await zip.generateAsync({ type:'blob' });
  return { blob: content, filename: `${prefixSafe}.zip` };
}

/* ---------- Button handlers ---------- */
async function onAutoSlice(){
  if(!sheetImg){ nowLog('Load sheet first'); return; }
  const alphaT = Math.max(0, Math.min(255, parseInt(alphaThresholdEl.value||1)));
  const minW = Math.max(1, parseInt(minWidthEl.value||4));
  const gapTol = Math.max(0, parseInt(gapTolEl.value||4));
  const prefixSafe = sanitizePrefix(prefixEl.value || 'frame');
  const padLen = Math.max(1, parseInt(zeroPadEl.value||2));

  const runs = detectFrameRuns(alphaT, minW, gapTol);
  if(runs.length === 0){ nowLog('No frames detected. Try lowering alpha threshold or gap tolerance.'); return; }
  nowLog(`Detected ${runs.length} frame(s). Extracting...`);
  const blobs = await extractRunsAsBlobs(runs, prefixSafe + '_', padLen);

  blobs.forEach(b => {
    const url = URL.createObjectURL(b.blob);
    slicesFiles.push({ name: b.name, blob: b.blob, url });
  });

  manifest.id = prefixSafe;
  manifest.assets = blobs.map(b => ({ name: b.name, path: `assets/${prefixSafe}/${b.name}`, size: b.blob.size, type: 'image/png' }));

  renderAssets();
  updateManifest();
  nowLog(`Added ${blobs.length} slices to assets`);
}

async function onAutoSliceAndZip(){
  if(!sheetImg){ nowLog('Load sheet first'); return; }
  const alphaT = Math.max(0, Math.min(255, parseInt(alphaThresholdEl.value||1)));
  const minW = Math.max(1, parseInt(minWidthEl.value||4));
  const gapTol = Math.max(0, parseInt(gapTolEl.value||4));
  const prefixSafe = sanitizePrefix(prefixEl.value || 'frame');
  const padLen = Math.max(1, parseInt(zeroPadEl.value||2));

  const runs = detectFrameRuns(alphaT, minW, gapTol);
  if(runs.length === 0){ nowLog('No frames detected. Try lowering alpha threshold or gap tolerance.'); return; }

  nowLog(`Detected ${runs.length} frame(s). Building ZIP...`);
  const blobs = await extractRunsAsBlobs(runs, prefixSafe + '_', padLen);

  const { blob, filename } = await buildZipFromBlobs(blobs, prefixSafe);
  openPopup(filename, blob);

  manifest.id = prefixSafe;
  manifest.assets = blobs.map(b => ({ name: b.name, path: `assets/${prefixSafe}/${b.name}`, size: b.blob.size, type: 'image/png' }));
  updateManifest();

  nowLog(`ZIP ready with ${blobs.length} slices`);
}

async function onAutoSliceToAssets(){
  await onAutoSlice();
}

async function onDownloadCurrentZip(){
  if(slicesFiles.length === 0){
    nowLog('No slices to download. Run Auto Slice first.');
    return;
  }
  const prefixSafe = sanitizePrefix(prefixEl.value || 'frame');
  nowLog(`Building ZIP from existing ${slicesFiles.length} slices...`);

  const blobs = slicesFiles.map(f => ({ name: f.name, blob: f.blob }));
  const { blob, filename } = await buildZipFromBlobs(blobs, prefixSafe);
  openPopup(filename, blob);

  manifest.id = prefixSafe;
  manifest.assets = blobs.map(b => ({ name: b.name, path: `assets/${prefixSafe}/${b.name}`, size: b.blob.size, type: 'image/png' }));
  updateManifest();

  nowLog('ZIP generated.');
}
