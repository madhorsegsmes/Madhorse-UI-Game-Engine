// This is the editor's trust boundary, not a type assertion on worker data.
export type GamePosition = { x: number; y: number };
export const initialGamePosition: GamePosition = { x: 50, y: 50 };
export const gameCommandLimit = 128;

export function isGamePosition(value: unknown): value is GamePosition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const position = value as Record<string, unknown>;
  return ['x', 'y'].every((axis) =>
    Object.hasOwn(position, axis) && typeof position[axis] === 'number' &&
    Number.isFinite(position[axis]) && position[axis] >= 0 && position[axis] <= 100);
}

export function applyGameCommand(value: unknown, position: GamePosition): GamePosition {
  const fail = (): never => { throw new Error('Invalid game command: use version 1, object "player", action "setPosition" or "move", and finite numeric x/y within the 0–100 scene.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const command = value as Record<string, unknown>;
  const keys = ['version', 'object', 'action', 'x', 'y'];
  if (Object.keys(command).length !== keys.length || !keys.every((key) => Object.hasOwn(command, key))) return fail();
  if (command.version !== 1 || command.object !== 'player' ||
      (command.action !== 'setPosition' && command.action !== 'move') ||
      typeof command.x !== 'number' || typeof command.y !== 'number' ||
      !Number.isFinite(command.x) || !Number.isFinite(command.y) ||
      Math.abs(command.x) > 100 || Math.abs(command.y) > 100) return fail();
  const next = command.action === 'move'
    ? { x: position.x + command.x, y: position.y + command.y }
    : { x: command.x, y: command.y };
  if (next.x < 0 || next.x > 100 || next.y < 0 || next.y > 100) return fail();
  return next;
}

// A reserved output line gives every existing language the same tiny API,
// without exposing host objects or adding FFI capabilities to any runtime.
export function gameExample(language: string): string {
  const line = 'MADHORSE_GAME {"version":1,"object":"player","action":"setPosition","x":75,"y":35}';
  if (language === 'Python') return `print('${line}')`;
  if (language === 'Lua') return `print('${line}')`;
  if (language === 'C') return `#include <stdio.h>\nint main(void) { puts(${JSON.stringify(line)}); return 0; }`;
  if (language === 'C++') return `#include <iostream>\nint main() { std::cout << ${JSON.stringify(`${line}\n`)}; }`;
  if (language === 'C#') return `System.Console.WriteLine(${JSON.stringify(line)});`;
  if (language === 'TypeScript') return `const command: string = ${JSON.stringify(line)};\nconsole.log(command);`;
  return `console.log(${JSON.stringify(line)});`;
}
