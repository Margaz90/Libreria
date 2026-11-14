// File .xlsx di prova costruiti a mano (v92): uno ZIP con l'XML scritto come lo scrivono Excel, Numbers e Google Fogli
// (celle vuote saltate, testi condivisi e in linea, numeri in notazione scientifica, date1904, voci «stored» o «deflate»).
import zlib from 'node:zlib';

const u8 = s => new TextEncoder().encode(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Uno ZIP minimo: header locali, directory centrale e fine directory.
export function creaZip(files, { stored = false } = {}) {
  const parti = [], centrale = []; let off = 0;
  for (const [nome, dati0] of Object.entries(files)) {
    const dati = typeof dati0 === 'string' ? u8(dati0) : dati0, n = u8(nome);
    const comp = stored ? dati : new Uint8Array(zlib.deflateRawSync(dati)), crc = zlib.crc32(dati), met = stored ? 0 : 8;
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(met, 8);
    loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(dati.length, 22); loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(met, 10);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(dati.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(off, 42);
    parti.push(loc, n, comp); centrale.push(cen, n); off += 30 + n.length + comp.length;
  }
  const dim = centrale.reduce((t, b) => t + b.length, 0);
  const fine = Buffer.alloc(22); fine.writeUInt32LE(0x06054b50, 0); fine.writeUInt16LE(centrale.length / 2, 8); fine.writeUInt16LE(centrale.length / 2, 10);
  fine.writeUInt32LE(dim, 12); fine.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parti, ...centrale, fine]));
}

// fogli: [{ nome, celle: 'XML delle righe' }]; condivise: testi di sharedStrings.xml
export function creaXlsx({ fogli, condivise = [], data1904 = false, stored = false, relAssoluti = false }) {
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<workbookPr${data1904 ? ' date1904="1"' : ''}/><sheets>${fogli.map((f, i) => `<sheet name="${esc(f.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + fogli.map((f, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${relAssoluti ? '/xl/' : ''}worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>',
  };
  if (condivise.length) files['xl/sharedStrings.xml'] = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${condivise.length}">`
    + condivise.map(t => t && t.xml ? `<si>${t.xml}</si>` : Array.isArray(t) ? `<si>${t.map(p => `<r><rPr><b/></rPr><t xml:space="preserve">${esc(p)}</t></r>`).join('')}</si>` : `<si><t>${esc(t)}</t></si>`).join('') + '</sst>';
  fogli.forEach((f, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${f.celle}</sheetData></worksheet>`; });
  return creaZip(files, { stored });
}
