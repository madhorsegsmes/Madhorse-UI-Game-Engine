import { Component, type ReactNode } from 'react';

/** A missing/lost graphics context must not take down project tools or saves. */
export class SceneWebGLBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onUnavailable?: () => void },
  { unavailable: boolean }
> {
  state = { unavailable: false };

  static getDerivedStateFromError() {
    return { unavailable: true };
  }

  componentDidCatch() {
    this.props.onUnavailable?.();
  }

  render() {
    if (this.state.unavailable) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="mh-scene3d__unavailable" role="status" data-testid="scene3d-unavailable">
          <strong>3D graphics unavailable</strong>
          <p>This browser could not start WebGL 2. Enable hardware acceleration or use a WebGL 2–capable browser.</p>
          <p>Your project is still available. Use the 2D Preview tab to continue editing.</p>
          <button type="button" onClick={() => this.setState({ unavailable: false })} data-testid="scene3d-retry">
            Retry 3D graphics
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
