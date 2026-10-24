import { applyGameCommand, gameCommandLimit, initialGamePosition, type GamePosition } from './game-api';
import { maxScriptSize, movementLanguages, sourceSize, type ScriptFile } from './project-scripts';

export type EgoScriptReview = {
  summary: string;
  commandCount: number;
  finalPosition: GamePosition | null;
  notes: string[];
};

export const egoEngineKnowledge = [
  {
    name: 'Unity-style',
    concept: 'Objects are built from small components; events and physics components control behavior.',
    madhorse: 'Use Hierarchy objects, editable components, Player Actions, physics settings, and visual logic. Script output is limited to the documented Madhorse command line.',
  },
  {
    name: 'Unreal-style',
    concept: 'Actors combine components; Blueprint-style event graphs connect events to actions.',
    madhorse: 'Use scene objects, plugin components, trigger zones, and visual logic steps. A script cannot access arbitrary scene objects.',
  },
  {
    name: 'GameGuru MAX-style',
    concept: 'Object behaviors, triggers, and level rules are composed into a playable scene.',
    madhorse: 'Use object behaviors, world-building tools, and saved project assets. These are concepts and mappings, not imported GameGuru code.',
  },
  {
    name: 'Madhorse',
    concept: 'Scene data, editor tools, and runtime actions stay separate and editable.',
    madhorse: 'Ego can read the saved scene objects, components, UI, assets, scripts, and camera values. It cannot inspect rendered viewport pixels or silently change render settings.',
  },
] as const;

function buildCommand(language: string, command: Record<string, unknown>) {
  const line = `MADHORSE_GAME ${JSON.stringify(command)}`;
  const comment = `${language === 'Python' ? '#' : language === 'Lua' ? '--' : '//'} ${line}`;
  if (language === 'Python' || language === 'Lua') return `${comment}\nprint(${JSON.stringify(line)})`;
  if (language === 'C') return `#include <stdio.h>\n${comment}\nint main(void) { puts(${JSON.stringify(line)}); return 0; }`;
  if (language === 'C++') return `#include <iostream>\n${comment}\nint main() { std::cout << ${JSON.stringify(`${line}\n`)}; }`;
  if (language === 'C#') return `${comment}\nSystem.Console.WriteLine(${JSON.stringify(line)});`;
  if (language === 'TypeScript') return `${comment}\nconst command: string = ${JSON.stringify(line)};\nconsole.log(command);`;
  return `${comment}\nconsole.log(${JSON.stringify(line)});`;
}

function requestedCommand(request: string) {
  const direction = request.toLowerCase().match(/\b(move|go|walk)\s+(left|right|up|down)\b/);
  if (direction) {
    const distanceMatch = request.match(/\b(?:by|for)\s+(-?\d+(?:\.\d+)?)\b/i);
    const distance = Math.abs(Number(distanceMatch?.[1] ?? 10));
    if (distance < 0.1 || distance > 50) throw new Error('Use a movement distance from 0.1 to 50. The preview starts at the center.');
    const offset = {
      left: { x: -distance, y: 0 },
      right: { x: distance, y: 0 },
      up: { x: 0, y: -distance },
      down: { x: 0, y: distance },
    }[direction[2]];
    return { version: 1, object: 'self', action: 'move', ...offset };
  }
  const coordinates = request.match(/\b(?:to|at|position(?:\s+to)?)\s*(-?\d+(?:\.\d+)?)\s*[,/ ]\s*(-?\d+(?:\.\d+)?)\b/i);
  if (coordinates) {
    const x = Number(coordinates[1]);
    const y = Number(coordinates[2]);
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      return { version: 1, object: 'self', action: 'setPosition', x, y };
    }
    throw new Error('Position values must be between 0 and 100.');
  }
  return null;
}

function safeScriptName(language: string, request: string, scripts: ScriptFile[]) {
  const extension = movementLanguages.find((entry) => entry.language === language)?.extension;
  if (!extension) throw new Error('Choose one of the seven supported script languages.');
  const words = request.toLowerCase().match(/[a-z0-9]+/g)?.slice(0, 4).join('-') || 'starter';
  const base = `ego-${words}`;
  let name = `${base}${extension}`;
  for (let suffix = 2; scripts.some((script) => script.name.toLowerCase() === name.toLowerCase()); suffix++) {
    name = `${base}-${suffix}${extension}`;
  }
  return name;
}

export function createEgoScript(language: string, request: string, scripts: ScriptFile[]): Omit<ScriptFile, 'id'> {
  if (!movementLanguages.some((entry) => entry.language === language)) {
    throw new Error('Choose a supported language.');
  }
  const command = requestedCommand(request);
  if (!command) throw new Error('For now, describe movement like “move right by 8” or “move to 70, 35”. Other game logic is available as editable Madhorse components, not generated script code.');
  const content = `${buildCommand(language, command)}\n`;
  return { name: safeScriptName(language, request, scripts), language, content, size: sourceSize(content) };
}

export function createEgoScriptFromSource(
  language: string,
  sourceName: string,
  content: string,
  scripts: ScriptFile[],
): Omit<ScriptFile, 'id'> {
  const extension = movementLanguages.find((entry) => entry.language === language)?.extension;
  if (!extension) throw new Error('Choose one of the seven supported script languages.');
  if (!content.trim()) throw new Error('The selected script file is empty.');
  if (content.includes('\u0000')) throw new Error('The file is not plain text.');
  const size = sourceSize(content);
  if (size > maxScriptSize) throw new Error('Scripts must be 256 KB or smaller.');
  const base = sourceName.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'imported-script';
  let name = `${base}${extension}`;
  for (let suffix = 2; scripts.some((script) => script.name.toLowerCase() === name.toLowerCase()); suffix++) {
    name = `${base}-${suffix}${extension}`;
  }
  return { name, language, content, size };
}

export function reviewEgoScript(source: string, language: string): EgoScriptReview {
  if (sourceSize(source) > 256 * 1024) {
    return { summary: 'This source is larger than the review limit.', commandCount: 0, finalPosition: null, notes: ['Maximum source size is 256 KB.'] };
  }
  const notes: string[] = [];
  const lines = source.split(/\r?\n/);
  const commandLines = lines.flatMap((line, index) => {
    const match = line.match(/^\s*(?:\/\/|#|--)\s*MADHORSE_GAME\s+(.+?)\s*$/);
    return match ? [{ source: match[1], line: index + 1 }] : [];
  });
  if (!commandLines.length) {
    return {
      summary: `${language} source was read, but it contains no Madhorse commands Ego can validate.`,
      commandCount: 0,
      finalPosition: null,
      notes: ['Add a line comment in the form MADHORSE_GAME {command JSON} to review a command.', 'This is a bounded text review, not a compiler or general-purpose parser.', 'Ego did not execute the source.'],
    };
  }
  if (commandLines.length > gameCommandLimit) {
    return {
      summary: `Review stopped: found ${commandLines.length} command lines; the limit is ${gameCommandLimit}.`,
      commandCount: 0,
      finalPosition: null,
      notes: ['No commands were executed.'],
    };
  }
  let position = { ...initialGamePosition };
  let validCommands = 0;
  for (const entry of commandLines) {
    try {
      const command: unknown = JSON.parse(entry.source);
      position = applyGameCommand(command, position, 'ego-preview');
      validCommands++;
    } catch {
      notes.push(`Line ${entry.line}: command is not valid for the supported Madhorse movement protocol.`);
      if (notes.length >= 8) break;
    }
  }
  notes.push('Ego validated only MADHORSE_GAME command data; other language syntax was not compiled or executed.');
  return {
    summary: `${validCommands} of ${commandLines.length} Madhorse command line(s) passed validation.`,
    commandCount: validCommands,
    finalPosition: validCommands ? position : null,
    notes,
  };
}
