import { Events } from 'phaser';

// Used to emit events between components, HTML and Phaser scenes
//
// Events used in this project:
//   'current-scene-ready'   Phaser -> React   (scene, built into template)
//   'journey-ready'         React -> Phaser   ({ journey, fromCity, toCity })
//   'start-map'             React -> Phaser   ({ mode: 'intro'|'hop'|'arrival', ... })
//   'minigame-result'       Phaser -> React   ({ won, biome, minigameIndex })
//   'map-transition-done'   Phaser -> React   ({ minigameIndex })
//   'journey-complete'      Phaser -> React   (void)
export const EventBus = new Events.EventEmitter();