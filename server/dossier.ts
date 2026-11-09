import { PDFDocument } from 'pdf-lib';
import { dossierLayout } from './dossier-layout';
import { createHash } from 'node:crypto';

export type DossierFile = { id: string; name: string; folder: string; bytes?: Uint8Array };
export type DossierSource = { name: string; currency: string; entries: any[]; files: DossierFile[]; notes: string[] };
export function dossierYear(value: unknown) {
  if (!/^\d{4}$/.test(String(value)) || Number(value) < 1900 || Number(value) > 2100) throw Object.assign(new Error('Informe um ano entre 1900 e 2100.'), { status: 400 });
  return Number(value);
}
export function dossierEntries(entries: any[], year: number) {
  return entries.filter(e => String(e.data_pagamento || e.data || e.data_vencimento || '').slice(0, 4) === String(year));
}
const safeName = (s: string) => String(s).replace(/[^\p{L}\p{N} ._-]/gu, '_').replace(/^\.+/, '_').slice(0, 140) || 'arquivo';
const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';

type Layout = Awaited<ReturnType<typeof dossierLayout>>;
type DownloadedFile = { bytes: Uint8Array; name?: string };
const utf8 = (text: string) => new TextEncoder().encode(text);

// Keep original bytes even when a protected PDF or another format has no printable preview.
async function previewOriginal(layout: Layout, bytes: Uint8Array): Promise<boolean> {
  try {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (buffer.subarray(0,1024).includes('%PDF-')) {
      const source = await PDFDocument.load(bytes, {updateMetadata:false});
      const pages = source.getPages();
      if (!pages.length || pages.length > 200 || pages.length + layout.document.getPageCount() > 700) return false;
      // Validate all page streams in isolation. An unsupported stream must not leave
      // a broken XObject in the final PDF or a half-rendered receipt in its pages.
      const preview = await PDFDocument.create();
      const rotations: number[] = [];
      for (const p of pages) {
        const crop = p.getCropBox();
        if (!(crop.width > 0 && crop.height > 0)) return false;
        const sheet = preview.addPage([crop.width,crop.height]);
        rotations.push(p.getRotation().angle);
        if (p.node.Contents()) {
          sheet.drawPage(await preview.embedPage(p, {left:crop.x,bottom:crop.y,right:crop.x+crop.width,top:crop.y+crop.height}));
        } else { sheet.drawText(' '); }
      }
      const cleaned = await preview.save();
      const embedded = await layout.document.embedPdf(cleaned, pages.map((_, i) => i));
      for (const [index, p] of embedded.entries()) {
        if (index > 0) layout.newPage();
        layout.preview(p, rotations[index]);
      }
      return true;
    }
    if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
      if (buffer.length < 24 || buffer.readUInt32BE(16) * buffer.readUInt32BE(20) > 16_000_000) return false;
      layout.preview(await layout.document.embedPng(bytes)); return true;
    }
    if (buffer[0] === 255 && buffer[1] === 216) {
      layout.preview(await layout.document.embedJpg(bytes)); return true;
    }
  } catch { /* Unsupported content stays accessible as an embedded original. */ }
  return false;
}

export async function buildDossier(source: DossierSource, year: number, read: (id: string) => Promise<DownloadedFile>, template: () => Uint8Array) {
  if (source.files.length > 300) throw Object.assign(new Error('Dossiê excede 300 arquivos.'), {status:413});
  const entries = dossierEntries(source.entries, year);
  const title = `${source.name} · ${year}`;
  const layout = await dossierLayout(template(), title);
  const notes = [...source.notes];
  const money = (amount: number) => new Intl.NumberFormat('pt-BR',{style:'currency', currency:source.currency}).format(amount);
  let income = 0, expense = 0;
  for (const e of entries) {
    const amount = Number(e.valor);
    if (!Number.isFinite(amount)) { notes.push(`Lançamento ${e.id}: valor inválido, não somado.`); continue; }
    if (e.status !== 'pago' || (e.natureza && e.natureza !== 'caixa')) continue;
    if (['entrada','receita'].includes(e.tipo)) income += Math.round(amount * 100);
    if (['saida','despesa'].includes(e.tipo)) expense += Math.round(amount * 100);
  }
  layout.section('Resumo financeiro');
  layout.paragraph(title,true,15);
  layout.paragraph(`Entradas pagas   ${money(income/100)}\nSaídas pagas   ${money(expense/100)}\nResultado registrado   ${money((income-expense)/100)}`,true,12);
  layout.paragraph(`${entries.length} lançamento(s) no ano. A seleção considera a data de pagamento ou, quando ausente, a data do lançamento ou vencimento. Os totais incluem apenas movimentos de caixa pagos.`);
  layout.section('Extrato dos lançamentos');
  if (!entries.length) layout.paragraph('Nenhum lançamento registrado no ano selecionado.');
  const date = (v:unknown) => String(v || '').slice(0,10).replace(/^(\d{4})-(\d\d)-(\d\d)$/,'$3/$2/$1') || '—';
  for (const e of entries) {
    layout.paragraph(`${date(e.data_pagamento || e.data || e.data_vencimento)}   ·   ${e.tipo}   ·   ${Number.isFinite(Number(e.valor)) ? money(Number(e.valor)) : 'Valor indisponível'}`,true);
    layout.paragraph(`${e.descricao || 'Sem descrição'}\nStatus: ${e.status || 'Não informado'}   ·   Natureza: ${e.natureza || 'caixa'}\nLançamento: ${date(e.data)}   ·   Vencimento: ${date(e.data_vencimento)}   ·   Pagamento: ${date(e.data_pagamento)}\nReferência: ${e.id}`);
  }
  const columns = ['id','descricao','tipo','valor','status','data','data_vencimento','data_pagamento','natureza'];
  const csv = '\uFEFF' + [columns.join(';'), ...entries.map(e => columns.map(c => cell(e[c])).join(';'))].join('\r\n');
  await layout.document.attach(utf8(csv),'Extrato.csv',{mimeType:'text/csv'});
  const manifest: {arquivo:string;origem:string;bytes:number;sha256:string}[] = [];
  let totalBytes = 0;
  const groups = [
    {title:'Documentos e comprovantes',files:source.files.filter(f=>f.folder !== 'MAP')},
    {title:'MAP da aliança',files:source.files.filter(f=>f.folder === 'MAP')},
  ];
  for (const group of groups) {
    if (!group.files.length && group.title === 'MAP da aliança') continue;
    layout.section(group.title);
    if (!group.files.length) layout.paragraph('Nenhum arquivo disponível para esta seção.');
    for (const [i,f] of group.files.entries()) {
      const fetched = f.bytes ? {bytes:f.bytes, name:f.name} : await read(f.id);
      totalBytes += fetched.bytes.byteLength;
      if (fetched.bytes.byteLength > 20*1024*1024 || totalBytes > 100*1024*1024) throw Object.assign(new Error('Dossiê excede o limite de tamanho.'),{status:413});
      const name = `${manifest.length+1}-${safeName(fetched.name || f.name)}`;
      if (i > 0) layout.newPage();
      layout.paragraph(f.name || name,true,13);
      layout.paragraph(`${f.folder.replace(/^Comprovantes-/, 'Comprovante do lançamento ')}   ·   Arquivo anexo: ${name}`);
      await layout.document.attach(fetched.bytes,name,{description:f.folder});
      manifest.push({arquivo:name,origem:f.id,bytes:fetched.bytes.length,sha256:createHash('sha256').update(fetched.bytes).digest('hex')});
      if (!await previewOriginal(layout,fetched.bytes)) {
        layout.paragraph('A visualização integral está disponível no arquivo original, no painel Anexos do leitor de PDF.');
      }
    }
  }
  layout.section('Observações');
  layout.paragraph('Os originais acompanham o documento no painel Anexos de um leitor de PDF compatível. O extrato em CSV e os códigos de integridade também estão disponíveis nesse painel.');
  for (const note of notes) layout.paragraph(note);
  await layout.document.attach(utf8(JSON.stringify({titulo:title,ano:year,arquivos:manifest,observacoes:notes},null,2)), 'Manifesto.json',{mimeType:'application/json'});
  return layout.finish();
}
