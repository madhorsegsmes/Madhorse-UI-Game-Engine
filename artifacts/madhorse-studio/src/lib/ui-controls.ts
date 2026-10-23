export type UIControlType = 'text' | 'button' | 'health-bar' | 'panel';

export type UIControlElement = {
  id: string;
  type: UIControlType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

const uiControlTypes: UIControlType[] = ['text', 'button', 'health-bar', 'panel'];

export function createUIControlElement(type: UIControlType, existingCount: number): UIControlElement {
  const label = type === 'health-bar'
    ? 'Health'
    : type === 'text'
      ? 'New text'
      : type === 'panel'
        ? 'Panel'
        : 'Button';
  return {
    id: crypto.randomUUID(),
    type,
    label,
    x: 22 + (existingCount % 3) * 20,
    y: 22 + (Math.floor(existingCount / 3) % 3) * 18,
    width: type === 'text' ? 128 : type === 'health-bar' ? 176 : 136,
    height: type === 'text' ? 30 : type === 'health-bar' ? 36 : 42,
    color: type === 'text' ? '#f0e9e2' : type === 'panel' ? '#29272a' : '#bd4037',
  };
}

function isUIControlType(value: unknown): value is UIControlType {
  return typeof value === 'string' && uiControlTypes.includes(value as UIControlType);
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

export function isUIControlCollection(value: unknown): value is UIControlElement[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const element = entry as UIControlElement;
    return typeof element.id === 'string' &&
      isUIControlType(element.type) &&
      typeof element.label === 'string' &&
      element.label.length <= 80 &&
      Number.isFinite(element.x) && element.x >= 0 && element.x <= 100 &&
      Number.isFinite(element.y) && element.y >= 0 && element.y <= 100 &&
      Number.isFinite(element.width) && element.width >= 24 && element.width <= 1000 &&
      Number.isFinite(element.height) && element.height >= 20 && element.height <= 500 &&
      isHexColor(element.color);
  });
}
