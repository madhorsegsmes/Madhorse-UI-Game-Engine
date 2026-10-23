// This is the editor's trust boundary, not a type assertion on worker data.
export type GamePosition = { x: number; y: number };
export const initialGamePosition: GamePosition = { x: 50, y: 50 };
export const gameCommandLimit = 128;

export type GameAnimationKeyframe = {
  id: string;
  time: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
};

export type GameAnimation = {
  id: string;
  name: string;
  targetEntityId: string;
  duration: number;
  loop: boolean;
  keyframes: GameAnimationKeyframe[];
};

export function isGameAnimation(value: unknown): value is GameAnimation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const animation = value as GameAnimation;
  if (typeof animation.id !== 'string' || !animation.id ||
      typeof animation.name !== 'string' || animation.name.length > 80 ||
      typeof animation.targetEntityId !== 'string' || !animation.targetEntityId ||
      typeof animation.loop !== 'boolean' ||
      typeof animation.duration !== 'number' || !Number.isFinite(animation.duration) ||
      animation.duration < 0.05 || animation.duration > 600 ||
      !Array.isArray(animation.keyframes) || animation.keyframes.length < 2 ||
      animation.keyframes.length > 100) return false;

  const keyframeIds = new Set<string>();
  let previousTime = -1;
  for (const keyframe of animation.keyframes) {
    if (!keyframe || typeof keyframe !== 'object' || Array.isArray(keyframe) ||
        typeof keyframe.id !== 'string' || !keyframe.id || keyframeIds.has(keyframe.id) ||
        typeof keyframe.time !== 'number' || !Number.isFinite(keyframe.time) ||
        keyframe.time < 0 || keyframe.time > animation.duration || keyframe.time <= previousTime ||
        !isAnimationVector(keyframe.position, 10000) ||
        !isAnimationVector(keyframe.rotation, 36000) ||
        typeof keyframe.scale !== 'number' || !Number.isFinite(keyframe.scale) ||
        keyframe.scale < 0.01 || keyframe.scale > 100) return false;
    keyframeIds.add(keyframe.id);
    previousTime = keyframe.time;
  }
  return true;
}

export function isGameAnimationCollection(value: unknown): value is GameAnimation[] {
  return Array.isArray(value) && value.length <= 100 &&
    value.every(isGameAnimation) &&
    new Set(value.map((animation) => animation.id)).size === value.length;
}

function isAnimationVector(value: unknown, maxAbsoluteValue: number): value is { x: number; y: number; z: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const vector = value as { x: number; y: number; z: number };
  return ['x', 'y', 'z'].every((axis) =>
    typeof vector[axis as keyof typeof vector] === 'number' &&
    Number.isFinite(vector[axis as keyof typeof vector]) &&
    Math.abs(vector[axis as keyof typeof vector]) <= maxAbsoluteValue);
}

export function createAnimationKeyframe(
  time: number,
  position: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number },
): GameAnimationKeyframe {
  const bound = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  return {
    id: crypto.randomUUID(),
    time,
    position: {
      x: bound(position.x, 10000),
      y: bound(position.y, 10000),
      z: bound(position.z, 10000),
    },
    rotation: {
      x: bound(rotation.x, 36000),
      y: bound(rotation.y, 36000),
      z: bound(rotation.z, 36000),
    },
    scale: 1,
  };
}

export function sampleGameAnimation(animation: GameAnimation, time: number): GameAnimationKeyframe {
  const keyframes = animation.keyframes;
  const sampleTime = Math.max(0, Math.min(animation.duration, time));
  const rightIndex = keyframes.findIndex((frame) => frame.time >= sampleTime);
  if (rightIndex <= 0) return { ...keyframes[Math.max(0, rightIndex)], time: sampleTime };
  if (rightIndex === -1) return { ...keyframes[keyframes.length - 1], time: sampleTime };
  const left = keyframes[rightIndex - 1];
  const right = keyframes[rightIndex];
  const progress = (sampleTime - left.time) / (right.time - left.time);
  const blend = (a: number, b: number) => a + (b - a) * progress;
  return {
    id: left.id,
    time: sampleTime,
    position: {
      x: blend(left.position.x, right.position.x),
      y: blend(left.position.y, right.position.y),
      z: blend(left.position.z, right.position.z),
    },
    rotation: {
      x: blend(left.rotation.x, right.rotation.x),
      y: blend(left.rotation.y, right.rotation.y),
      z: blend(left.rotation.z, right.rotation.z),
    },
    scale: blend(left.scale, right.scale),
  };
}

export function isGamePosition(value: unknown): value is GamePosition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const position = value as Record<string, unknown>;
  return ['x', 'y'].every((axis) =>
    Object.hasOwn(position, axis) && typeof position[axis] === 'number' &&
    Number.isFinite(position[axis]) && position[axis] >= 0 && position[axis] <= 100);
}

export function applyGameCommand(
  value: unknown,
  position: GamePosition,
  targetObjectId = 'player',
): GamePosition {
  const fail = (): never => { throw new Error('Invalid game command: use version 1, object "self" (or the assigned object ID), action "setPosition" or "move", and finite numeric x/y within the 0–100 scene.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const command = value as Record<string, unknown>;
  const keys = ['version', 'object', 'action', 'x', 'y'];
  if (Object.keys(command).length !== keys.length || !keys.every((key) => Object.hasOwn(command, key))) return fail();
  if (command.version !== 1 || (command.object !== 'self' && command.object !== targetObjectId) ||
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
  const line = 'MADHORSE_GAME {"version":1,"object":"self","action":"setPosition","x":75,"y":35}';
  if (language === 'Python') return `print('${line}')`;
  if (language === 'Lua') return `print('${line}')`;
  if (language === 'C') return `#include <stdio.h>\nint main(void) { puts(${JSON.stringify(line)}); return 0; }`;
  if (language === 'C++') return `#include <iostream>\nint main() { std::cout << ${JSON.stringify(`${line}\n`)}; }`;
  if (language === 'C#') return `System.Console.WriteLine(${JSON.stringify(line)});`;
  if (language === 'TypeScript') return `const command: string = ${JSON.stringify(line)};\nconsole.log(command);`;
  return `console.log(${JSON.stringify(line)});`;
}
