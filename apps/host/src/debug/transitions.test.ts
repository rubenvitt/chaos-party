import { describe, expect, it } from 'vitest';
import {
  sceneTransitions,
  summarizeTransitions,
  type LongTask,
  type SceneMark,
} from './transitions.ts';

const mark = (scene: SceneMark['scene'], point: SceneMark['point'], at: number): SceneMark => ({
  scene,
  point,
  at,
});
const task = (start: number, duration: number): LongTask => ({ start, duration });

describe('sceneTransitions', () => {
  it('benennt die Übergänge einer Partie nach der vorher aufgebauten Szene', () => {
    const marks = [
      mark('brett', 'aufbau', 100),
      mark('brett', 'erstes-bild', 200),
      mark('minispiel', 'aufbau', 1000),
      mark('minispiel', 'erstes-bild', 1500),
      mark('brett', 'aufbau', 3000),
      mark('brett', 'erstes-bild', 3400),
      mark('podest', 'aufbau', 5000),
      mark('podest', 'erstes-bild', 5600),
    ];
    expect(sceneTransitions(marks, [], 9000).map((t) => t.label)).toEqual([
      'lobby → brett',
      'brett → minispiel',
      'minispiel → brett',
      'zählung → podest',
    ]);
  });

  it('zählt Long Tasks, die das Fenster überlappen, mit voller Dauer', () => {
    const marks = [mark('minispiel', 'aufbau', 1000), mark('minispiel', 'erstes-bild', 2000)];
    const tasks = [
      task(400, 100), // endet vor dem Fenster
      task(900, 700), // Entsorgen + neue Engine: beginnt vor der Marke
      task(1700, 80),
      task(1950, 400), // erstes Bild: endet nach der Marke
      task(2100, 900), // nach dem ersten Bild
    ];
    const [transition] = sceneTransitions(marks, tasks, 5000);
    expect(transition).toMatchObject({
      label: 'lobby → minispiel',
      complete: true,
      waitMs: 1000,
      longTasks: 3,
      longestMs: 700,
      blockedMs: 1180,
    });
  });

  it('misst beim Podest Vorbereitung und Zeigen, nicht die Zählung dazwischen', () => {
    const marks = [
      mark('brett', 'aufbau', 0),
      mark('brett', 'erstes-bild', 50),
      mark('podest', 'aufbau', 1000),
      mark('podest', 'erstes-bild', 1800),
      mark('podest', 'sichtbar', 6000),
      mark('podest', 'erstes-bild', 6300),
    ];
    const tasks = [task(1100, 300), task(3000, 900), task(6100, 450)];
    const podium = sceneTransitions(marks, tasks, 9000).find((t) => t.to === 'podest');
    expect(podium).toMatchObject({
      label: 'zählung → podest',
      complete: true,
      waitMs: 800 + 300,
      longTasks: 2,
      longestMs: 450,
      blockedMs: 750,
    });
  });

  it('beendet ein Fenster ohne erstes Bild beim nächsten Aufbau bzw. bei „jetzt“', () => {
    const marks = [mark('brett', 'aufbau', 0), mark('minispiel', 'aufbau', 500)];
    const [board, minigame] = sceneTransitions(marks, [task(600, 60)], 800);
    expect(board).toMatchObject({ complete: false, waitMs: 500, longTasks: 0, longestMs: 0 });
    expect(minigame).toMatchObject({ complete: false, waitMs: 300, longTasks: 1, longestMs: 60 });
  });

  it('zählt ab der Anfrage, wenn der Aufbau auf Code wartet (CHAOS-86)', () => {
    const marks = [
      mark('brett', 'aufbau', 0),
      mark('brett', 'erstes-bild', 100),
      // Nachträglich gesetzt (Empfang des Stands), daher vor dem Aufbau einsortiert.
      mark('minispiel', 'aufbau', 1040),
      mark('minispiel', 'angefragt', 1000),
      mark('minispiel', 'erstes-bild', 1300),
    ];
    const [, minigame] = sceneTransitions(marks, [task(1010, 60)], 2000);
    expect(minigame).toMatchObject({
      label: 'brett → minispiel',
      startAt: 1000,
      requestMs: 40,
      waitMs: 300,
      longTasks: 1,
      complete: true,
    });
  });

  it('vergisst eine Anfrage beim nächsten Aufbau einer anderen Szene', () => {
    const marks = [
      mark('minispiel', 'angefragt', 0),
      mark('brett', 'aufbau', 100),
      mark('minispiel', 'aufbau', 1000),
      mark('minispiel', 'erstes-bild', 1100),
    ];
    const [, minigame] = sceneTransitions(marks, [], 2000);
    expect(minigame).toMatchObject({ startAt: 1000, requestMs: 0, waitMs: 100 });
  });

  it('sortiert Marken nach der Zeit und ignoriert Bilder ohne Aufbau', () => {
    const marks = [
      mark('minispiel', 'erstes-bild', 10),
      mark('brett', 'erstes-bild', 300),
      mark('brett', 'aufbau', 100),
    ];
    const transitions = sceneTransitions(marks, [], 1000);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({ label: 'lobby → brett', waitMs: 200, complete: true });
  });
});

describe('summarizeTransitions', () => {
  it('fasst die Vorkommen je Übergang zusammen', () => {
    const marks = [
      mark('brett', 'aufbau', 0),
      mark('brett', 'erstes-bild', 100),
      mark('minispiel', 'aufbau', 1000),
      mark('minispiel', 'erstes-bild', 1200),
      mark('brett', 'aufbau', 2000),
      mark('brett', 'erstes-bild', 2100),
      mark('minispiel', 'aufbau', 3000),
      mark('minispiel', 'erstes-bild', 3400),
      mark('brett', 'aufbau', 4000),
      mark('brett', 'erstes-bild', 4300),
      mark('minispiel', 'aufbau', 5000),
      mark('minispiel', 'erstes-bild', 5600),
    ];
    const tasks = [task(1000, 100), task(3000, 300), task(3300, 60), task(5000, 600)];
    const summary = summarizeTransitions(sceneTransitions(marks, tasks, 9000));
    expect(summary.map((s) => s.label)).toEqual([
      'lobby → brett',
      'brett → minispiel',
      'minispiel → brett',
    ]);
    expect(summary[1]).toEqual({
      label: 'brett → minispiel',
      count: 3,
      incomplete: 0,
      longestMaxMs: 600,
      longestMedianMs: 300,
      blockedMedianMs: 360,
      waitMedianMs: 400,
      requestMedianMs: 0,
      requestMaxMs: 0,
    });
    expect(summary[2]).toMatchObject({ count: 2, longestMaxMs: 0, waitMedianMs: 200 });
  });
});
