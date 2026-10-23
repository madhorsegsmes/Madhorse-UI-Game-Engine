import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createAnimationKeyframe,
  isGameAnimation,
  sampleGameAnimation,
  type GameAnimation,
  type GameAnimationKeyframe,
} from '@/lib/game-api';
import { getTransform, type SceneEntity } from '@/lib/scene-model';

type AnimationEditorProps = {
  animations: GameAnimation[];
  entities: SceneEntity[];
  selectedEntityId: string | null;
  readOnly: boolean;
  onChange: (animations: GameAnimation[]) => void;
  onPreviewFrame: (animation: GameAnimation | null, time: number) => void;
};

export function AnimationEditor({
  animations,
  entities,
  selectedEntityId,
  readOnly,
  onChange,
  onPreviewFrame,
}: AnimationEditorProps) {
  const [selectedId, setSelectedId] = useState(animations[0]?.id ?? '');
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<GameAnimation | null>(null);
  const activeAnimation = animations.find((animation) => animation.id === selectedId) ?? animations[0] ?? null;
  const targetEntity = entities.find((entity) => entity.id === activeAnimation?.targetEntityId);

  useEffect(() => {
    if (!animations.some((animation) => animation.id === selectedId)) {
      setSelectedId(animations[0]?.id ?? '');
    }
  }, [animations, selectedId]);

  useEffect(() => {
    animationRef.current = activeAnimation;
  }, [activeAnimation]);

  useEffect(() => {
    if (!isPlaying || !activeAnimation || readOnly) return;
    let startedAt = performance.now() - playhead * 1000;
    const tick = () => {
      const animation = animationRef.current;
      if (!animation) return;
      const elapsed = Math.max(0, (performance.now() - startedAt) / 1000);
      const nextTime = animation.loop
        ? elapsed % animation.duration
        : Math.min(elapsed, animation.duration);
      setPlayhead(nextTime);
      onPreviewFrame(animation, nextTime);
      if (!animation.loop && elapsed >= animation.duration) setIsPlaying(false);
    };
    tick();
    const timer = window.setInterval(tick, 33);
    return () => window.clearInterval(timer);
  }, [isPlaying, activeAnimation?.id, activeAnimation?.duration, activeAnimation?.loop, readOnly, onPreviewFrame]);

  const sortedFrames = useMemo(
    () => [...(activeAnimation?.keyframes ?? [])].sort((a, b) => a.time - b.time),
    [activeAnimation],
  );

  function commitAnimation(next: GameAnimation) {
    if (!isGameAnimation(next) || readOnly) return;
    onChange(animations.map((animation) => animation.id === next.id ? next : animation));
  }

  function createAnimation() {
    if (readOnly || animations.length >= 100) return;
    const target = entities.find((entity) => entity.id === selectedEntityId) ?? entities[0];
    if (!target) return;
    const transform = getTransform(target);
    const animation: GameAnimation = {
      id: crypto.randomUUID(),
      name: `${target.name.slice(0, 64)} Animation`,
      targetEntityId: target.id,
      duration: 1,
      loop: false,
      keyframes: [
        createAnimationKeyframe(0, transform.position, transform.rotation),
        createAnimationKeyframe(1, transform.position, transform.rotation),
      ],
    };
    onChange([...animations, animation]);
    setSelectedId(animation.id);
    setPlayhead(0);
    setIsPlaying(false);
    onPreviewFrame(null, 0);
  }

  function updateFrame(frameId: string, changes: Partial<GameAnimationKeyframe>) {
    if (!activeAnimation || readOnly) return;
    const frames = [...activeAnimation.keyframes];
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index < 0) return;
    const before = [...frames].sort((a, b) => a.time - b.time);
    const sortedIndex = before.findIndex((frame) => frame.id === frameId);
    const minTime = sortedIndex > 0 ? before[sortedIndex - 1].time + 0.01 : 0;
    const maxTime = sortedIndex < before.length - 1
      ? before[sortedIndex + 1].time - 0.01
      : activeAnimation.duration;
    const boundedChanges = changes.time === undefined
      ? changes
      : { ...changes, time: Math.max(minTime, Math.min(maxTime, changes.time)) };
    frames[index] = { ...frames[index], ...boundedChanges };
    commitAnimation({ ...activeAnimation, keyframes: frames.sort((a, b) => a.time - b.time) });
  }

  function addKeyframe() {
    if (!activeAnimation || !targetEntity || readOnly || activeAnimation.keyframes.length >= 100) return;
    const frames = sortedFrames;
    const gapIndex = frames.slice(0, -1).reduce((best, frame, index) =>
      frames[index + 1].time - frame.time > frames[best + 1].time - frames[best].time ? index : best, 0);
    const time = (frames[gapIndex].time + frames[gapIndex + 1].time) / 2;
    const sample = sampleGameAnimation(activeAnimation, time);
    const frame = {
      ...createAnimationKeyframe(time, sample.position, sample.rotation),
      scale: sample.scale,
    };
    commitAnimation({ ...activeAnimation, keyframes: [...frames, frame].sort((a, b) => a.time - b.time) });
  }

  function removeKeyframe(frameId: string) {
    if (!activeAnimation || readOnly || activeAnimation.keyframes.length <= 2) return;
    commitAnimation({
      ...activeAnimation,
      keyframes: activeAnimation.keyframes.filter((frame) => frame.id !== frameId),
    });
  }

  function updateDuration(duration: number) {
    if (!activeAnimation || readOnly || !Number.isFinite(duration)) return;
    const boundedDuration = Math.max(0.05, Math.min(600, duration));
    const frames = activeAnimation.keyframes
      .map((frame) => ({ ...frame, time: Math.min(frame.time, boundedDuration) }))
      .sort((a, b) => a.time - b.time);
    const uniqueFrames = frames.filter((frame, index) => index === 0 || frame.time > frames[index - 1].time);
    while (uniqueFrames.length < Math.min(2, frames.length)) {
      const frame = frames[uniqueFrames.length];
      uniqueFrames.push({ ...frame, time: boundedDuration });
    }
    commitAnimation({ ...activeAnimation, duration: boundedDuration, keyframes: uniqueFrames });
    setPlayhead((current) => Math.min(current, boundedDuration));
  }

  function setPreviewTime(time: number) {
    if (!activeAnimation) return;
    setPlayhead(time);
    onPreviewFrame(activeAnimation, time);
  }

  function togglePlayback() {
    if (!activeAnimation || readOnly) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const start = playhead >= activeAnimation.duration ? 0 : playhead;
    setPreviewTime(start);
    setIsPlaying(true);
  }

  function stopPreview() {
    setIsPlaying(false);
    setPlayhead(0);
    onPreviewFrame(null, 0);
  }

  return (
    <div className="system-tool-content animation-editor" aria-label="Animations menu" data-testid="animation-editor">
      <div className="animation-editor-heading">
        <span>Create and preview scene animations</span>
        <button type="button" onClick={createAnimation} disabled={readOnly || entities.length === 0 || animations.length >= 100} data-testid="create-animation">
          + New
        </button>
      </div>
      {animations.length === 0 ? (
        <p className="animation-empty">Create an animation to add timed scene keyframes.</p>
      ) : (
        <>
          <label className="animation-field">
            Animation
            <select value={activeAnimation?.id ?? ''} disabled={readOnly} onChange={(event) => {
              setSelectedId(event.target.value);
              setIsPlaying(false);
              setPlayhead(0);
              onPreviewFrame(null, 0);
            }}>
              {animations.map((animation) => <option key={animation.id} value={animation.id}>{animation.name}</option>)}
            </select>
          </label>
          {activeAnimation && (
            <>
              <label className="animation-field">
                Name
                <input
                  value={activeAnimation.name}
                  maxLength={80}
                  disabled={readOnly}
                  onChange={(event) => commitAnimation({ ...activeAnimation, name: event.target.value })}
                  aria-label="Animation name"
                />
              </label>
              <label className="animation-field">
                Target
                <select
                  value={activeAnimation.targetEntityId}
                  disabled={readOnly}
                  onChange={(event) => commitAnimation({ ...activeAnimation, targetEntityId: event.target.value })}
                  aria-label="Animation target"
                >
                  {!targetEntity && <option value={activeAnimation.targetEntityId}>Missing scene object</option>}
                  {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                </select>
              </label>
              <label className="animation-field">
                Duration (seconds)
                <input
                  type="number"
                  min="0.05"
                  max="600"
                  step="0.05"
                  value={activeAnimation.duration}
                  disabled={readOnly}
                  onChange={(event) => updateDuration(Number(event.target.value))}
                  aria-label="Animation duration"
                />
              </label>
              <label className="animation-loop">
                <input
                  type="checkbox"
                  checked={activeAnimation.loop}
                  disabled={readOnly}
                  onChange={(event) => commitAnimation({ ...activeAnimation, loop: event.target.checked })}
                />
                Loop preview
              </label>
              <div className="animation-preview-controls">
                <button type="button" onClick={togglePlayback} disabled={readOnly} data-testid="animation-play">
                  {isPlaying ? 'Pause' : 'Preview'}
                </button>
                <button type="button" onClick={stopPreview} data-testid="animation-stop">Stop</button>
                <span role="status">{isPlaying ? `Playing · ${playhead.toFixed(2)}s` : `Preview · ${playhead.toFixed(2)}s`}</span>
              </div>
              <label className="animation-scrubber">
                Timeline
                <input
                  type="range"
                  min="0"
                  max={activeAnimation.duration}
                  step="0.01"
                  value={Math.min(playhead, activeAnimation.duration)}
                  onChange={(event) => {
                    setIsPlaying(false);
                    setPreviewTime(Number(event.target.value));
                  }}
                  aria-label="Animation timeline"
                />
              </label>
              <div className="animation-keyframes">
                <div className="animation-keyframes-heading">
                  <strong>Keyframes</strong>
                  <button type="button" onClick={addKeyframe} disabled={readOnly || activeAnimation.keyframes.length >= 100}>
                    + Add at midpoint
                  </button>
                </div>
                {sortedFrames.map((frame, index) => (
                  <fieldset className="animation-keyframe" key={frame.id}>
                    <legend>Keyframe {index + 1}</legend>
                    <label>Time
                      <input
                        type="number"
                        min={index > 0 ? sortedFrames[index - 1].time + 0.01 : 0}
                        max={index < sortedFrames.length - 1 ? sortedFrames[index + 1].time - 0.01 : activeAnimation.duration}
                        step="0.01"
                        value={frame.time}
                        disabled={readOnly}
                        onChange={(event) => updateFrame(frame.id, { time: Number(event.target.value) })}
                      />
                    </label>
                    {(['x', 'y', 'z'] as const).map((axis) => (
                      <label key={`position-${axis}`}>Pos {axis.toUpperCase()}
                        <input
                          type="number"
                          step="any"
                          value={frame.position[axis]}
                          disabled={readOnly}
                          onChange={(event) => updateFrame(frame.id, {
                            position: { ...frame.position, [axis]: Number(event.target.value) },
                          })}
                        />
                      </label>
                    ))}
                    {(['x', 'y', 'z'] as const).map((axis) => (
                      <label key={`rotation-${axis}`}>Rot {axis.toUpperCase()}
                        <input
                          type="number"
                          step="any"
                          value={frame.rotation[axis]}
                          disabled={readOnly}
                          onChange={(event) => updateFrame(frame.id, {
                            rotation: { ...frame.rotation, [axis]: Number(event.target.value) },
                          })}
                        />
                      </label>
                    ))}
                    <label>Scale
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="any"
                        value={frame.scale}
                        disabled={readOnly}
                        onChange={(event) => updateFrame(frame.id, { scale: Number(event.target.value) })}
                      />
                    </label>
                    <button
                      className="animation-remove-keyframe"
                      type="button"
                      onClick={() => removeKeyframe(frame.id)}
                      disabled={readOnly || activeAnimation.keyframes.length <= 2}
                      aria-label={`Remove keyframe ${index + 1}`}
                    >×</button>
                  </fieldset>
                ))}
              </div>
              <button
                className="animation-delete"
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setIsPlaying(false);
                  setPlayhead(0);
                  onPreviewFrame(null, 0);
                  onChange(animations.filter((animation) => animation.id !== activeAnimation.id));
                }}
              >Delete animation</button>
              <small className="animation-preview-note">Preview changes only the scene view; saved object transforms stay unchanged.</small>
            </>
          )}
        </>
      )}
    </div>
  );
}
