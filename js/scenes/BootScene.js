import { loadSpecies } from './anims.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  init(data) { this.dexList = data.dexList; this.onDone = data.onDone; }

  preload() {
    const fill = document.getElementById('load-fill');
    const text = document.getElementById('load-text');
    this.load.on('progress', p => {
      fill.style.width = `${Math.round(p * 100)}%`;
      text.textContent = `Atrapando Pokémon… ${Math.round(p * 100)}%`;
    });
    for (const dex of this.dexList) loadSpecies(this.load, dex);
    for (const n of ['act0', 'act1', 'act2', 'act3', 'act4', 'act5', 'ranch']) {
      for (const o of ['h', 'v']) this.load.image(`arena-${n}-${o}`, `assets/arenas/${n}_${o}.webp`);
    }
  }

  create() {
    // Sombra compartida por todas las unidades
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(16, 6, 32, 12);
    g.generateTexture('shadow', 32, 12);
    g.destroy();
    document.getElementById('loading').classList.add('hidden');
    this.onDone();
  }
}
