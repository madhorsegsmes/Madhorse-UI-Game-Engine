import { PlanMadBuilderResponse } from '@workspace/api-zod';
import type { MadBuilderPlan } from '@workspace/api-client-react';

export type MadBuilderBuildLog = {
  id: string;
  createdAt: string;
  request: string;
  plan: MadBuilderPlan;
  objectNames: string[];
  uiControlNames: string[];
  prefabSaved: boolean;
};

export function isMadBuilderBuildLogs(value: unknown): value is MadBuilderBuildLog[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const log = entry as MadBuilderBuildLog;
    return typeof log.id === 'string' && typeof log.createdAt === 'string' &&
      typeof log.request === 'string' && log.request.length <= 2000 &&
      PlanMadBuilderResponse.safeParse(log.plan).success &&
      Array.isArray(log.objectNames) && log.objectNames.every((name) => typeof name === 'string' && name.length <= 200) &&
      Array.isArray(log.uiControlNames) && log.uiControlNames.every((name) => typeof name === 'string' && name.length <= 200) &&
      typeof log.prefabSaved === 'boolean';
  });
}

function pdfText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
}

function wrapPdfLine(value: string, maxLength = 92) {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (word.length > maxLength) {
      if (line) lines.push(line);
      line = '';
      for (let index = 0; index < word.length; index += maxLength) {
        const chunk = word.slice(index, index + maxLength);
        if (chunk.length === maxLength) lines.push(chunk);
        else line = chunk;
      }
    } else if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= maxLength) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function escapePdfString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildReportLines(projectName: string, logs: MadBuilderBuildLog[]) {
  const lines = [
    'MADHORSE STUDIO - MAD BUILDER BUILD LOG',
    `Project: ${projectName}`,
    `Exported: ${new Date().toISOString()}`,
    `Completed builds: ${logs.length}`,
    '',
  ];
  logs.forEach((log, index) => {
    lines.push(`BUILD ${index + 1} - ${new Date(log.createdAt).toLocaleString()}`);
    lines.push(`Title: ${log.plan.title}`);
    if (log.request) lines.push(`Request: ${log.request}`);
    lines.push(`Summary: ${log.plan.summary}`);
    lines.push(`Generated objects (${log.objectNames.length}): ${log.objectNames.join(', ') || 'None'}`);
    if (log.uiControlNames.length) lines.push(`UI controls: ${log.uiControlNames.join(', ')}`);
    lines.push(`Saved as prefab: ${log.prefabSaved ? 'Yes' : 'No'}`);
    lines.push('Planned parts:');
    for (const part of log.plan.parts) {
      const position = `${part.position.x}, ${part.position.y}, ${part.position.z}`;
      const size = `${part.size.x}, ${part.size.y}, ${part.size.z}`;
      const shape = part.shape ? ` / ${part.shape}` : '';
      lines.push(`- ${part.name} [${part.kind}${shape}] position (${position}), size (${size}), color ${part.color}`);
    }
    if (log.plan.warnings.length) {
      lines.push('Build notes:');
      log.plan.warnings.forEach((warning) => lines.push(`- ${warning}`));
    }
    lines.push('');
  });
  return lines.flatMap((line) => wrapPdfLine(line));
}

/** Create a self-contained PDF using standard PDF fonts, with no remote service or package dependency. */
export function createMadBuilderLogPdf(projectName: string, logs: MadBuilderBuildLog[]) {
  const reportLines = buildReportLines(projectName, logs);
  const linesPerPage = 49;
  const pages: string[][] = [];
  for (let start = 0; start < reportLines.length; start += linesPerPage) {
    pages.push(reportLines.slice(start, start + linesPerPage));
  }
  if (!pages.length) pages.push(['No completed Mad Builder builds are recorded for this project.']);

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  pages.forEach((page) => {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    const commands = [
      'BT',
      '/F1 9 Tf',
      '46 754 Td',
      '13 TL',
      ...page.map((line, index) => `${index === 0 ? '' : 'T* '}(${escapePdfString(line)}) Tj`),
      'ET',
    ].join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`,
    );
  });

  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    document += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([document], { type: 'application/pdf' });
}

export function downloadMadBuilderLogPdf(projectName: string, logs: MadBuilderBuildLog[]) {
  const blobUrl = URL.createObjectURL(createMadBuilderLogPdf(projectName, logs));
  const link = document.createElement('a');
  const safeName = pdfText(projectName).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'project';
  link.href = blobUrl;
  link.download = `${safeName}-mad-builder-build-log.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
