import { degrees, PDFDocument, PDFName, StandardFonts, rgb, PDFEmbeddedPage, type PDFImage, type PDFPage } from 'pdf-lib';

const navy = rgb(0, .114, .204);
const slate = rgb(.22, .29, .36);
const blue = rgb(.146, .388, .922);
const margin = 48, width = 499, bottom = 111;

export async function dossierLayout(template: Uint8Array, title: string) {
  const document = await PDFDocument.create();
  document.setTitle(title);
  document.setAuthor('BUILT Alliances');
  const [background] = await document.embedPdf(template, [0]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  const printable = (value: string) => Array.from(value.normalize('NFC'), c => supported.has(c.codePointAt(0)!) ? c : ' ').join('');
  const contents: { label: string; page: PDFPage; number: number }[] = [];
  let page: PDFPage, y = 0;
  function newPage() {
    page = document.addPage([595, 842]);
    page.drawPage(background);
    y = 731;
    return page;
  }
  function space(height: number) { if (y - height < bottom) newPage(); }
  function paragraph(value: string, strong = false, size = 10) {
    const font = strong ? bold : regular;
    const lineHeight = size + 4;
    for (const para of value.split(/\r?\n/)) {
      let line = '';
      const emit = () => {
        space(lineHeight);
        page.drawText(line, {x: margin, y, font, size, color: strong ? navy : slate});
        y -= lineHeight;
        line = '';
      };
      for (const word of printable(para).trim().split(/\s+/)) {
        if (line && font.widthOfTextAtSize(line + ' ' + word, size) > width) emit();
        if (line) line += ' ';
        for (const ch of word) {
          if (font.widthOfTextAtSize(line + ch, size) > width) emit();
          line += ch;
        }
      }
      emit();
    }
    y -= 5;
  }
  function banner(label: string) {
    page.drawRectangle({x:42, y:y-9, width:511, height:26, color:rgb(.945,.97,1)});
    page.drawRectangle({x:42, y:y-9, width:4,height:26,color:blue});
    page.drawText(label,{x:58,y,font:bold,size:13,color:navy});
    y -= 45;
  }
  const tocPage = newPage();
  banner('Sumário');
  paragraph('Dossiê anual', true, 19);
  paragraph(title, false, 13);
  const tocY = y - 12;
  function section(label: string) {
    newPage();
    contents.push({label,page,number:document.getPageCount()});
    banner(label);
  }
  function preview(item: PDFEmbeddedPage | PDFImage, angle = 0) {
    const rot = ((angle % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const w = swap ? item.height : item.width, h = swap ? item.width : item.height;
    if (y - bottom < 145) newPage();
    const scale = Math.min(width / w, (y - bottom) / h);
    const x = margin + (width - w * scale) / 2;
    const base = y - h * scale;
    const options = {x:x + ([180,270].includes(rot) ? w * scale : 0), y:base + ([90,180].includes(rot) ? h * scale : 0), width:item.width * scale,height:item.height * scale,rotate:degrees(-rot)};
    if (item instanceof PDFEmbeddedPage) page.drawPage(item as PDFEmbeddedPage, options);
    else page.drawImage(item as PDFImage, options);
    y = bottom;
  }
  function finish() {
    contents.forEach(({label,page:dest,number}, i) => {
      const row = tocY - i * 33;
      tocPage.drawText(label,{x:margin,y:row,font:bold,size:12,color:navy});
      tocPage.drawText(String(number),{x:540-bold.widthOfTextAtSize(String(number),12),y:row,font:bold,size:12,color:blue});
      tocPage.drawLine({start:{x:margin,y:row-10},end:{x:547,y:row-10},color:rgb(.85,.88,.91),thickness:.6});
      const ctx = document.context;
      const link = ctx.obj({Type:'Annot',Subtype:'Link',Rect:[margin,row-8,548,row+16],Border:[0,0,0],Dest:[dest.ref,PDFName.of('Fit')]});
      tocPage.node.addAnnot(ctx.register(link));
    });
    const pages = document.getPages();
    pages.forEach((p,i) => {
      const label = `Página ${i+1} de ${pages.length}`;
      p.drawText(label,{x:553-regular.widthOfTextAtSize(label,7.2),y:22,size:7.2,font:regular,color:slate});
    });
    return document.save();
  }
  return {document, paragraph, section, newPage, preview, finish};
}
