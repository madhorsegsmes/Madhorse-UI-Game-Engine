export type SceneGraphicsFailure = {
  kind: 'context-unavailable' | 'context-lost' | 'scene-error';
  message: string;
  detail: string;
};

export class WebGLStartupError extends Error {
  constructor(readonly reasons: readonly string[]) {
    super('No WebGL 2 context could be created, including compatibility settings.');
    this.name = 'WebGLStartupError';
  }
}

/** Three.js requires WebGL 2. Never substitute WebGL 1 or claim a software preview is WebGL. */
export function requestWebGL2Context(canvas: HTMLCanvasElement, options: {
  antialias: boolean;
  powerPreference: WebGLPowerPreference;
}) {
  const attempts: WebGLContextAttributes[] = [
    { ...options, alpha: false, depth: true, stencil: false, failIfMajorPerformanceCaveat: false },
    { antialias: false, powerPreference: 'default', alpha: false, depth: true, stencil: false, failIfMajorPerformanceCaveat: false },
    { antialias: false, powerPreference: 'low-power', alpha: false, depth: true, stencil: false, failIfMajorPerformanceCaveat: false },
  ];
  const reasons: string[] = [];
  const creationError = (event: Event) => {
    const message = (event as WebGLContextEvent).statusMessage;
    if (message) reasons.push(message.slice(0, 500));
  };
  canvas.addEventListener('webglcontextcreationerror', creationError);
  try {
    for (const [index, attributes] of attempts.entries()) {
      try {
        const context = canvas.getContext('webgl2', attributes);
        if (context && !context.isContextLost()) return { context, compatibility: index > 0 };
        reasons.push(`Attempt ${index + 1}: browser did not provide a usable WebGL 2 context.`);
      } catch (error) {
        reasons.push(error instanceof Error ? error.message.slice(0, 500) : 'Context creation threw an error.');
      }
    }
    throw new WebGLStartupError(reasons);
  } finally {
    canvas.removeEventListener('webglcontextcreationerror', creationError);
  }
}

export function describeGraphicsFailure(error: unknown): SceneGraphicsFailure {
  const detail = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown rendering error';
  if (error instanceof WebGLStartupError || /(?:creat(?:e|ing).*WebGL.*context|WebGL.?2.*not (?:available|supported))/i.test(detail)) {
    return {
      kind: 'context-unavailable',
      message: 'This browser could not start WebGL 2, even with compatibility settings. Enable graphics acceleration, restart the browser, or update the graphics driver.',
      detail: error instanceof WebGLStartupError ? error.reasons.join('\n').slice(0, 2000) : detail,
    };
  }
  return {
    kind: 'scene-error',
    message: 'The scene renderer encountered an error. This does not necessarily mean WebGL 2 is unavailable. Retry the preview and check the debugger for the scene error.',
    detail,
  };
}

/** Keep the live canvas mounted so the browser and Three.js can restore its context and resources. */
export function observeWebGLContext(canvas: HTMLCanvasElement, callbacks: {
  onLost: (failure: SceneGraphicsFailure) => void;
  onRestored: () => void;
}) {
  const lost = (event: Event) => {
    event.preventDefault(); // Required to allow webglcontextrestored.
    callbacks.onLost({
      kind: 'context-lost',
      message: 'The graphics context was interrupted. Waiting for the browser to restore it. You can also restart graphics without changing the project.',
      detail: (event as WebGLContextEvent).statusMessage || 'webglcontextlost',
    });
  };
  const restored = () => callbacks.onRestored();
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}
