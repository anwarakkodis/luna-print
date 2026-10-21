export const A4 = [595.2756, 841.8898];
export async function arrange(PDFLib, batches, marginMm=1) {
  const {PDFDocument, degrees}=PDFLib;
  const out=await PDFDocument.create();
  const margin=marginMm*72/25.4, gap=5*72/25.4, cw=(A4[0]-margin*2-gap)/2, ch=(A4[1]-margin*2-gap)/2;
  let count=0, sheet;
  for(const batch of batches){
    const src=await PDFDocument.load(batch.bytes);
    for(const p of src.getPages()){
      const slot=count%4;
      if(slot===0){
        sheet=out.addPage(A4);
      }
      const box=p.getCropBox(), r=((p.getRotation().angle%360)+360)%360;
      const embedded=await out.embedPage(p,{left:box.x,bottom:box.y,right:box.x+box.width,top:box.y+box.height});
      const w=r%180?box.height:box.width,h=r%180?box.width:box.height;
      const inset=2,scale=Math.min((cw-inset*2)/w,(ch-inset*2)/h),dw=w*scale,dh=h*scale;
      const x=margin+(slot%2)*(cw+gap)+(cw-dw)/2;
      const y=A4[1]-margin-(Math.floor(slot/2)+1)*ch-Math.floor(slot/2)*gap+(ch-dh)/2;
      sheet.drawPage(embedded,{x:x+(r===180||r===270?dw:0),y:y+(r===90||r===180?dh:0),width:box.width*scale,height:box.height*scale,rotate:degrees(-r)});
      count++;
    }
  }
  return out.save();
}
