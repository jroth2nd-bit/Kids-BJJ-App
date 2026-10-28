const PAGE = { width: 612, height: 792, margin: 54 };

export async function sha256Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pdfSafe(text) {
  return String(text || '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7E\n]/g, '');
}

export async function buildWaiverPdf(record) {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const width = PAGE.width - PAGE.margin * 2;
  let y = PAGE.margin;
  const need = (height) => { if (y + height > PAGE.height - PAGE.margin) { doc.addPage(); y = PAGE.margin; } };
  const write = (text, { size = 10, bold = false, gap = 6 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    doc.splitTextToSize(pdfSafe(text), width).forEach((line) => { need(size + 3); doc.text(line, PAGE.margin, y); y += size + 3; });
    y += gap;
  };

  const snapshot = record.snapshot || {};
  const signature = record.signature?.typed || record.signature?.drawnDataUrl ? record.signature : snapshot.signature || {};
  const isChild = record.studentType === 'kids';

  write('WAIVER OF LIABILITY', { size: 16, bold: true, gap: 10 });
  write('Black Lotus Brazilian Jiu Jitsu Academy LLP', { size: 11, bold: true, gap: 10 });
  write(record.waiverText || '', { size: 9, gap: 12 });

  need(250);
  write('SIGNATURE RECORD', { size: 12, bold: true });
  write(`Participant: ${record.participantName || ''}`);
  if (isChild) {
    write(`Parent/Guardian (signer): ${record.parentGuardianName || ''}`);
    write(`Relationship to participant: ${record.signerRelationship || ''}`);
  }
  write(`Typed signature: ${signature.typed || ''}`);
  if (signature.drawnDataUrl) {
    need(80);
    doc.addImage(signature.drawnDataUrl, 'PNG', PAGE.margin, y, 180, 50);
    y += 58;
  }
  write(`Agreement accepted: ${signature.agreed === false ? 'No' : 'Yes'}`);
  write(`Signed (server time, UTC): ${record.signedAt || ''}`);
  write(`Collected by: ${record.signedByEmail || 'Unknown'}`);
  write(`Waiver record ID: ${record.dbId || record.id}`);
  write(`Waiver text SHA-256: ${record.waiverTextSha256 || ''}`, { size: 8 });
  return doc.output('blob');
}
