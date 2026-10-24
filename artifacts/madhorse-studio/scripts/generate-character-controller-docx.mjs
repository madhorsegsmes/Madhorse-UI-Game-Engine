import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

const artifactRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(artifactRoot, 'src/lib/character-controller-reference.md');
const outputPath = resolve(artifactRoot, 'public/documents/character-controller-guide.docx');
const guideText = (await readFile(sourcePath, 'utf8')).trim();

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function paragraph(line, index) {
  if (!line.trim()) {
    return '<w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>';
  }

  const isTitle = index === 0;
  const isHeading = /^[A-Z0-9 .—–&/-]+$/.test(line) && /[A-Z]/.test(line) && line.length < 90;
  const color = isTitle ? '7D3FB2' : '57247A';
  const size = isTitle ? '32' : '23';
  const paragraphProperties = isTitle
    ? '<w:pPr><w:jc w:val="center"/><w:spacing w:after="220"/></w:pPr>'
    : isHeading
      ? '<w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/></w:pPr>'
      : '<w:pPr><w:spacing w:after="90" w:line="280" w:lineRule="auto"/></w:pPr>';
  const runProperties = isTitle || isHeading
    ? `<w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr>`
    : '<w:rPr><w:sz w:val="21"/></w:rPr>';

  return `<w:p>${paragraphProperties}<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${guideText.split(/\r?\n/).map(paragraph).join('')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1200" w:right="1150" w:bottom="1200" w:left="1150" w:header="600" w:footer="600" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docx = zipSync({
  '[Content_Types].xml': strToU8(contentTypes),
  '_rels/.rels': strToU8(relationships),
  'word/document.xml': strToU8(documentXml),
}, { level: 6 });

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, docx);
console.log(`Generated ${outputPath}`);
