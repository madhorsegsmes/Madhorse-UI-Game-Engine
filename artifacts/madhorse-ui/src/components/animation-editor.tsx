import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createAnimationKeyframe,
  getAnimationTracks,
  isGameAnimation,
  sampleGameAnimation,
  type GameAnimation,
  type GameAnimationKeyframe,
  type GameAnimationTrack,
} from '@/lib/game-api';
import { getTransform, type SceneEntity } from '@/lib/scene-model';
import { trackEvent } from '@/lib/analytics';

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
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [newTargetId, setNewTargetId] = useState('');
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<GameAnimation | null>(null);
  const activeAnimation = animations.find((animation) => animation.id === selectedId) ?? animations[0] ?? null;
  const tracks = activeAnimation ? getAnimationTracks(activeAnimation) : [];
  const activeTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0];
  const targetEntity = entities.find((entity) => entity.id === activeTrack?.targetEntityId);
  const availableTargets = entities.filter((entity) => !tracks.some((track) => track.targetEntityId === entity.id));
  const newTarget = availableTargets.find((entity) => entity.id === newTargetId) ?? availableTargets[0];

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
    () => [...(activeTrack?.keyframes ?? [])].sort((a, b) => a.time - b.time),
    [activeTrack],
  );

  function commitAnimation(next: GameAnimation) {
    if (!isGameAnimation(next) || readOnly) return;
    const clip: GameAnimation = {
      id: next.id, name: next.name, duration: next.duration, loop: next.loop,
      tracks: getAnimationTracks(next),
    };
    onChange(animations.map((animation) => animation.id === next.id ? clip : animation));
  }

  function commitTrack(next: GameAnimationTrack) {
    if (!activeAnimation) return;
    commitAnimation({
      id: activeAnimation.id,
      name: activeAnimation.name,
      duration: activeAnimation.duration,
      loop: activeAnimation.loop,
      tracks: tracks.map((track) => track.id === next.id ? next : track),
    });
  }

  function addTrack() {
    if (!activeAnimation || !newTarget || readOnly || tracks.length >= 100) return;
    const transform = getTransform(newTarget);
    const track: GameAnimationTrack = {
      id: crypto.randomUUID(),
      targetEntityId: newTarget.id,
      keyframes: [
        createAnimationKeyframe(0, transform.position, transform.rotation),
        createAnimationKeyframe(activeAnimation.duration, transform.position, transform.rotation),
      ],
    };
    commitAnimation({ ...activeAnimation, tracks: [...tracks, track] });
    setSelectedTrackId(track.id);
  }

  function createAnimation() {
    if (readOnly || animations.length >= 100) return;
    const target = entities.find((entity) => entity.id === selectedEntityId) ?? entities[0];
    if (!target) return;
    const transform = getTransform(target);
    const animation: GameAnimation = {
      id: crypto.randomUUID(),
      name: `${target.name.slice(0, 64)} Animation`,
      duration: 1,
      loop: false,
      tracks: [{
        id: crypto.randomUUID(),
        targetEntityId: target.id,
        keyframes: [
          createAnimationKeyframe(0, transform.position, transform.rotation),
          createAnimationKeyframe(1, transform.position, transform.rotation),
        ],
      }],
    };
    onChange([...animations, animation]);
    setSelectedId(animation.id);
    setPlayhead(0);
    setIsPlaying(false);
    onPreviewFrame(null, 0);
    trackEvent('animation_clip_created', {
      track_count: getAnimationTracks(animation).length,
      duration_seconds: animation.duration,
      loop: animation.loop,
    });
  }

  function updateFrame(frameId: string, changes: Partial<GameAnimationKeyframe>) {
    if (!activeAnimation || !activeTrack || readOnly) return;
    const frames = [...activeTrack.keyframes];
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
    commitTrack({ ...activeTrack, keyframes: frames.sort((a, b) => a.time - b.time) });
  }

  function addKeyframe() {
    if (!activeAnimation || !activeTrack || !targetEntity || readOnly || activeTrack.keyframes.length >= 100) return;
    const frames = sortedFrames;
    const gapIndex = frames.slice(0, -1).reduce((best, frame, index) =>
      frames[index + 1].time - frame.time > frames[best + 1].time - frames[best].time ? index : best, 0);
    const time = (frames[gapIndex].time + frames[gapIndex + 1].time) / 2;
    const sample = sampleGameAnimation({ ...activeTrack, duration: activeAnimation.duration }, time);
    const frame = {
      ...createAnimationKeyframe(time, sample.position, sample.rotation),
      scale: sample.scale,
    };
    commitTrack({ ...activeTrack, keyframes: [...frames, frame].sort((a, b) => a.time - b.time) });
  }

  function removeKeyframe(frameId: string) {
    if (!activeTrack || readOnly || activeTrack.keyframes.length <= 2) return;
    commitTrack({
      ...activeTrack,
      keyframes: activeTrack.keyframes.filter((frame) => frame.id !== frameId),
    });
  }

  function updateDuration(duration: number) {
    if (!activeAnimation || readOnly || !Number.isFinite(duration)) return;
    const boundedDuration = Math.max(0.05, Math.min(600, duration));
    // Retiming every track proportionally preserves distinct keys and coordination.
    commitAnimation({
      ...activeAnimation,
      duration: boundedDuration,
      tracks: tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((frame) => ({
          ...frame, time: frame.time / activeAnimation.duration * boundedDuration,
        })),
      })),
    });
    setPlayhead((current) => Math.min(current, boundedDuration));
  }

  function setPreviewTime(time: number) {
    if (!activeAnimation || readOnly) return;
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
    trackEvent('animation_preview_started', {
      track_count: tracks.length,
      keyframe_count: tracks.reduce((count, track) => count + track.keyframes.length, 0),
      duration_seconds: activeAnimation.duration,
      loop: activeAnimation.loop,
    });
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
                Object track
                <select
                  value={activeTrack?.id ?? ''}
                  onChange={(event) => setSelectedTrackId(event.target.value)}
                  aria-label="Animation track"
                >
                  {tracks.map((track) => <option key={track.id} value={track.id}>
                    {entities.find((entity) => entity.id === track.targetEntityId)?.name ?? 'Missing scene object'}
                  </option>)}
                </select>
              </label>
              <label className="animation-field">
                Track target
                <select
                  value={activeTrack?.targetEntityId ?? ''}
                  disabled={readOnly}
                  onChange={(event) => activeTrack && commitTrack({ ...activeTrack, targetEntityId: event.target.value })}
                  aria-label="Animation target"
                >
                  {!targetEntity && <option value={activeTrack?.targetEntityId}>Missing scene object</option>}
                  {entities.filter((entity) => entity.id === activeTrack?.targetEntityId ||
                    !tracks.some((track) => track.targetEntityId === entity.id))
                    .map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                </select>
              </label>
              <label className="animation-field">
                Add object
                <select value={newTarget?.id ?? ''} disabled={readOnly || !newTarget}
                  onChange={(event) => setNewTargetId(event.target.value)} aria-label="New track object">
                  {!newTarget && <option value="">All scene objects have tracks</option>}
                  {availableTargets.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                </select>
              </label>
              <div className="animation-preview-controls">
                <button type="button" onClick={addTrack} disabled={readOnly || !newTarget || tracks.length >= 100}>
                  + Add track
                </button>
                <button type="button" disabled={readOnly || tracks.length <= 1} onClick={() => {
                  commitAnimation({ ...activeAnimation, tracks: tracks.filter((track) => track.id !== activeTrack?.id) });
                  setSelectedTrackId('');
                }}>Remove track</button>
              </div>
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
                Shared timeline · {tracks.length} {tracks.length === 1 ? 'object' : 'objects'}
                <input
                  type="range"
                  min="0"
                  max={activeAnimation.duration}
                  step="0.01"
                  value={Math.min(playhead, activeAnimation.duration)}
                  disabled={readOnly}
                  onChange={(event) => {
                    setIsPlaying(false);
                    setPreviewTime(Number(event.target.value));
                  }}
                  aria-label="Animation timeline"
                />
              </label>
              <div className="animation-keyframes">
                <div className="animation-keyframes-heading">
                  <strong>Track keyframes</strong>
                  <button type="button" onClick={addKeyframe} disabled={readOnly || !targetEntity || (activeTrack?.keyframes.length ?? 0) >= 100}>
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
                      disabled={readOnly || (activeTrack?.keyframes.length ?? 0) <= 2}
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
