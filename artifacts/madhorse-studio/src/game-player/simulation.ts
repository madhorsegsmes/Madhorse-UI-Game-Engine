import { advanceSceneRuntime, createSceneRuntimeState, type RuntimeInput } from '../lib/scene-play-runtime';
import { applyEgoAnimationController } from '../lib/ego-animation-controller';
import { getTransform, getWorldTransform } from '../lib/scene-model';
import type { WebGameData } from '../lib/web-game-format';
import { cartChaseCamera } from '../lib/cart-racer-runtime';

/** Uses the same gameplay and animation implementation as Studio; never mutates the exported starting state. */
export class StandaloneSimulation {
  entities;
  readonly state;
  elapsed = 0;
  yaw = 0;
  pitch = 0;
  constructor(readonly game: WebGameData) {
    this.entities = structuredClone(game.entities);
    const players = this.entities.filter(entity => entity.active && entity.components.some(component =>
      component.type === 'characterController' && component.enabled && component.role === 'player'));
    const preferredPlayer = players.find(entity => entity.components.some(component =>
      component.type === 'playerAction' && component.enabled)) ?? players[0];
    this.state = createSceneRuntimeState(this.entities, preferredPlayer?.id ?? null);
    const player = this.entities.find(entity => entity.id === this.state.controlledPlayerId);
    if (player) this.yaw = getTransform(player).rotation.z;
  }
  get player() { return this.entities.find(entity => entity.id === this.state.controlledPlayerId); }
  get perspective() {
    const controller = this.player?.components.find(component => component.type === 'characterController' && component.enabled);
    return controller?.type === 'characterController' ? controller.perspective : null;
  }
  get primaryKey() {
    const action = this.player?.components.find(component => component.type === 'playerAction' && component.enabled &&
      ['shoot', 'fight', 'light-attack'].includes(component.action));
    return action?.type === 'playerAction' ? action.key : 'j';
  }
  togglePerspective() {
    if (this.perspective !== 'first-person' && this.perspective !== 'third-person') return;
    const next: 'first-person' | 'third-person' = this.perspective === 'first-person' ? 'third-person' : 'first-person';
    this.entities = this.entities.map(entity => entity.id !== this.state.controlledPlayerId ? entity : {
      ...entity, components: entity.components.map(component => component.type === 'characterController'
        ? { ...component, perspective: next } : component),
    });
    if (this.player) this.yaw = getTransform(this.player).rotation.z;
    this.pitch = 0;
  }
  step(delta: number, input: RuntimeInput) {
    this.elapsed += delta;
    const firstPerson = this.perspective === 'first-person';
    const result = advanceSceneRuntime(this.entities, delta, this.elapsed, {
      ...input, ...(firstPerson ? { lookYaw: this.yaw, lookPitch: this.pitch } : {}),
    }, this.state);
    const controller = this.game.animationControllers.find(item => item.targetEntityId === result.animationTargetId);
    this.entities = controller
      ? applyEgoAnimationController(result.entities, this.game.animations, controller, result.animationState, this.elapsed)
      : result.entities;
    return result;
  }
  get camera() {
    const player = this.player;
    if (!player || (this.perspective !== 'first-person' && this.perspective !== 'third-person')) return this.game.camera;
    const transform = getWorldTransform(this.entities, player.id);
    if (!transform) return this.game.camera;
    const target = { x: (transform.position.x - 50) / 10, y: transform.position.z / 10 + 1.1, z: (transform.position.y - 50) / 10 };
    const cartCamera=cartChaseCamera(this.game.camera,this.entities,player.id,this.perspective==='first-person');
    if(cartCamera)return cartCamera;
    if (this.perspective === 'third-person') {
      return { ...this.game.camera, rotation: undefined, target,
        position: { x: target.x + 2.4, y: target.y + 1.8, z: target.z - 5 } };
    }
    const crouched = this.state.actions.players.get(player.id)?.baseScale &&
      getTransform(player).scale.z < this.state.actions.players.get(player.id)!.baseScale.z * .8;
    target.y = transform.position.z / 10 + (crouched ? .9 : 1.6);
    const heading = transform.rotation.z * Math.PI / 180;
    const pitch = this.pitch * Math.PI / 180;
    return { ...this.game.camera, rotation: undefined, position: target,
      target: { x: target.x + Math.sin(heading) * Math.cos(pitch) * 4,
        y: target.y + Math.sin(pitch) * 4, z: target.z + Math.cos(heading) * Math.cos(pitch) * 4 } };
  }
}
