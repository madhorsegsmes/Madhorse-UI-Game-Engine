import type { BuilderReferenceImage } from '@workspace/api-client-react';
import { prepareBuilderReference } from './builder-reference-image';

/** Bundled read-only modeling guide; it is sent transiently and not saved to project assets. */
export async function loadFightingCharacterReference(): Promise<BuilderReferenceImage> {
  const response = await fetch(`${import.meta.env.BASE_URL}references/default-fighting-character.webp`);
  if (!response.ok) throw new Error('The built-in fighting-character guide could not be loaded.');
  const blob = await response.blob();
  const dataUrl = await prepareBuilderReference(new File([blob], 'fighting-character-guide.webp', {
    type: blob.type || 'image/webp',
  }));
  return { role: 'category-default', dataUrl };
}
