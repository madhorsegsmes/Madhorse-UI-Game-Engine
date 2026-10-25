import { Component, type ReactNode } from 'react';
import { describeGraphicsFailure, type SceneGraphicsFailure } from '@/lib/webgl-context';

/** A missing/lost graphics context must not take down project tools or saves. */
export class SceneWebGLBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; fallbackContent?: ReactNode; onUnavailable?: (failure: SceneGraphicsFailure) => void },
  { failure: SceneGraphicsFailure | null }
> {
  state: { failure: SceneGraphicsFailure | null } = { failure: null };

  static getDerivedStateFromError(error: unknown) {
    return { failure: describeGraphicsFailure(error) };
  }

  componentDidCatch(error: unknown) {
    this.props.onUnavailable?.(describeGraphicsFailure(error));
  }

  render() {
    if (this.state.failure) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="mh-scene3d__unavailable" role="status" data-testid="scene3d-unavailable"
          data-graphics-failure={this.state.failure.kind} style={{ overflow: 'auto', maxHeight: '100%' }}>
          <strong>{this.state.failure.kind === 'context-unavailable' ? 'WebGL 2 could not start' : 'Scene preview stopped'}</strong>
          <p>{this.state.failure.message}</p>
          <p>Your project and editing tools are still available.</p>
          {this.state.failure.kind === 'context-unavailable' && <p>
            Check that browser graphics acceleration is enabled. In Chrome or Edge, open Settings → System,
            enable graphics acceleration, then relaunch. Browser policy, remote desktop, and outdated GPU drivers can also block WebGL 2.
          </p>}
          <button type="button" onClick={() => this.setState({ failure: null })} data-testid="scene3d-retry">
            Retry 3D graphics
          </button>
          <details><summary>Technical details</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{this.state.failure.detail}</pre></details>
          {this.props.fallbackContent && (
            <div className="mh-scene3d__unavailable-preview">{this.props.fallbackContent}</div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
