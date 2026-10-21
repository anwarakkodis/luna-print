import * as pdfjs from './vendor/pdf.mjs';
import {arrange} from './layout.js';
pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.mjs';
const $=id=>document.getElementById(id);
let batches=[],output=null,preview=null,current=1,busy=false,renderTask=null;
function status(text){$('status').textContent=text;}
function lock(value){busy=value;$('files').disabled=value;$('margin').disabled=value;$('download').disabled=value||!output;document.querySelectorAll('.file button').forEach(b=>b.disabled=value);}
function list(){
 $('fileList').replaceChildren();
 batches.forEach((b,index)=>{const row=document.createElement('div');row.className='file';const name=document.createElement('span');name.textContent=b.name;name.title=b.name;const meta=document.createElement('small');meta.textContent=`${b.count} label${b.count===1?'':'s'}`;const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`Remove ${b.name}`);remove.onclick=async()=>{if(busy)return;batches.splice(index,1);list();await rebuild();};row.append(name,meta,remove);$('fileList').append(row);});
 const n=batches.reduce((s,b)=>s+b.count,0);$('labels').textContent=n;$('sheets').textContent=Math.ceil(n/4);$('saved').textContent=n?`${Math.round((1-Math.ceil(n/4)/n)*100)}%`:'—';
}
async function render(){
 $('prev').disabled=!preview||current<=1;$('next').disabled=!preview||current>=preview.numPages;
 if(!preview){$('canvas').hidden=true;document.querySelector('.placeholder').hidden=false;$('pageCount').textContent='Your next batch starts here';return;}
 if(renderTask){renderTask.cancel();try{await renderTask.promise;}catch{}renderTask=null;}
 const page=await preview.getPage(current),viewport=page.getViewport({scale:1.5}),canvas=$('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.hidden=false;document.querySelector('.placeholder').hidden=true;
 renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});try{await renderTask.promise;}catch(e){if(e.name!=='RenderingCancelledException')throw e;}
 $('pageCount').textContent=`Sheet ${current} of ${preview.numPages}`;
}
async function rebuild(){
 lock(true);output=null;
 try{if(preview){await preview.destroy();preview=null;}current=1;if(batches.length){status('Preparing your A4 sheets…');output=await arrange(window.PDFLib,batches,Number($('margin').value));preview=await pdfjs.getDocument({data:output.slice()}).promise;}await render();status('');}
 catch(e){output=null;status('Could not prepare this PDF. Try another file or an unprotected copy.');console.error(e);}
 finally{lock(false);}
}
async function add(files){
 if(busy)return;lock(true);status('Reading your labels…');const errors=[];
 for(const file of files){try{if(!/\.pdf$/i.test(file.name))throw new Error('Please select a PDF');if(file.size>100*1024*1024)throw new Error('File exceeds 100 MB');const bytes=new Uint8Array(await file.arrayBuffer());const doc=await window.PDFLib.PDFDocument.load(bytes);if(!doc.getPageCount())throw new Error('No pages found');batches.push({name:file.name,bytes,count:doc.getPageCount()});}catch(e){errors.push(`${file.name}: ${/encrypt|password/i.test(e.message)?'Please use an unlocked PDF.':e.message.includes('100 MB')?e.message:'Could not read this file. Please use a valid, unlocked PDF.'}`);}}
 list();await rebuild();if(errors.length)status(errors.join(' '));$('files').value='';
}
const drop=$('drop');drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!busy)$('files').click();}};
['dragenter','dragover'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('drag');}));['dragleave','drop'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('drag');}));drop.addEventListener('drop',e=>add([...e.dataTransfer.files]));$('files').onchange=e=>add([...e.target.files]);$('margin').onchange=rebuild;
$('prev').onclick=async()=>{if(busy||current<=1)return;lock(true);current--;try{await render();}finally{lock(false);}};$('next').onclick=async()=>{if(busy||!preview||current>=preview.numPages)return;lock(true);current++;try{await render();}finally{lock(false);}};
$('download').onclick=()=>{
 if(!output)return;
 const token=Array.from(crypto.getRandomValues(new Uint32Array(4)),v=>v.toString(16)).join('-');
 const bytes=output.slice();
 const printTab=window.open('./print.html#'+token,'_blank');
 if(!printTab){status('Please allow pop-ups for this site, then click Print document again.');return;}
 const sendDocument=event=>{
   if(event.source!==printTab||event.data?.type!=='luna-print-ready'||event.data.token!==token)return;
   // Local file tabs have opaque origins, so verify the window and token instead.
   printTab.postMessage({type:'luna-print-document',token,bytes},'*');
   window.removeEventListener('message',sendDocument);clearInterval(cleanup);
 };
 window.addEventListener('message',sendDocument);
 status('Your document opened in a new tab for printing.');
 const cleanup=setInterval(()=>{if(printTab.closed){window.removeEventListener('message',sendDocument);clearInterval(cleanup);}},2000);
};
