import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.mjs';
const button=document.getElementById('print'),status=document.getElementById('status');
const imageUrls=[];
button.onclick=()=>window.print();
async function preparePrint(bytes){try{
 const pdf=await pdfjs.getDocument({data:bytes}).promise;
 for(let n=1;n<=pdf.numPages;n++){
   status.textContent=`Preparing page ${n} of ${pdf.numPages}…`;
   const page=await pdf.getPage(n),viewport=page.getViewport({scale:300/72});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw new Error('Page could not be prepared');
   const image=document.createElement('img');image.src=URL.createObjectURL(blob);imageUrls.push(image.src);image.alt=`A4 sheet ${n}`;await image.decode();
   const sheet=document.createElement('section');sheet.className='sheet';sheet.append(image);document.getElementById('pages').append(sheet);
   canvas.width=canvas.height=0;page.cleanup();
 }
 await pdf.destroy();document.body.classList.add('ready');button.disabled=false;
 status.textContent='A4 · Actual size / 100%. If the dialog does not open, click Print document.';
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 window.focus();window.print();
}catch(error){status.textContent='Could not prepare the document. Return to the app and click Print document again.';console.error(error);}
}
window.addEventListener('pagehide',()=>imageUrls.forEach(url=>URL.revokeObjectURL(url)));
const token=location.hash.slice(1);
if(window.opener&&token){
 const receiveDocument=event=>{
   if(event.source!==window.opener||event.data?.type!=='luna-print-document'||event.data.token!==token)return;
   if(!(event.data.bytes instanceof Uint8Array))return;
   window.removeEventListener('message',receiveDocument);clearTimeout(timeout);
   preparePrint(event.data.bytes);
 };
 window.addEventListener('message',receiveDocument);
 const timeout=setTimeout(()=>{status.textContent='No document received. Keep the app tab open and click Print document there again.';},15000);
 window.opener.postMessage({type:'luna-print-ready',token},'*');
}else{status.textContent='Open index.html, add your labels, then click Print document.';}
