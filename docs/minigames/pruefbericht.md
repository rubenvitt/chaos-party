# Prüfbericht Minispiele

Erzeugt von `packages/minigames/src/checks/checks.test.ts` (CHAOS-84) mit 200 Seeds je Tisch. Regeln, Tische und Begründung der Schwellen: [`pruefungen.md`](pruefungen.md). Neu erzeugen:

```sh
PRUEFBERICHT=1 pnpm exec vitest run packages/minigames/src/checks --silent=false
```

## Bot-Fairness

| Spiel | Seeds | Gleichstand P1 (≤ 25 %) | Abstand 1–2 (≤ 45 %) | Führungswechsel (≥ 1,0) | Siege Neuling (2 %–25 %) | Siege Profi (≥ 25 %) | Eindringling max. (≤ 1,50) | Rechenzeit s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sockenregen | 200 | 12 % | 17 % | 2,9 | 6 % | 72 % | 0,35 (Dauerdrücken (Hechtsprung)) | 2,2 |
| pudding-gerangel | 200 | 12 % | 8 % | 6,9 | 7 % | 34 % | 0,35 (Dauerrempler) | 66,7 |
| wackelturm | 200 | 9 % | 14 % | 6,2 | 10 % | 44 % | 1,54 (gierig (7–10 Törtchen)) | 4,3 |
| kuckucks-klatsche | 200 | 10 % | 15 % | 3,8 | 8 % | 53 % | 1,12 (Raffzahn (klaut alles)) | 0,5 |
| kruemel-kehraus | 200 | 21 % | 19 % | 2,2 | 7 % | 37 % | 0,98 (Dauerrempler) | 156,6 |

## Ergebnis je Spiel

- **sockenregen:** besteht
- **pudding-gerangel:** besteht
- **wackelturm:** besteht
- **kuckucks-klatsche:** besteht
- **kruemel-kehraus:** besteht

## Eindringling-Test je Strategie

3 Spieler, Strategie gegen zwei normale Bots, Platz reihum. Siegfaktor = Siegquote × 3 (1,00 = fair).

| Spiel | Strategie | Siegfaktor |
| --- | --- | --- |
| sockenregen | Dauerdrücken (Hechtsprung) | 0,35 |
| pudding-gerangel | Dauerrempler | 0,35 |
| wackelturm | Raufbold (rempelt immer) | 0,65 |
| wackelturm | gierig (7–10 Törtchen) | 1,54 |
| wackelturm | vorsichtig (2–4 Törtchen) | 0,03 |
| kuckucks-klatsche | Dauerklatscher | 0,47 |
| kuckucks-klatsche | Raffzahn (klaut alles) | 1,12 |
| kuckucks-klatsche | brav (klaut nie) | 0,99 |
| kruemel-kehraus | Dauerrempler | 0,98 |
| kruemel-kehraus | Torsteher | 0,03 |
| kruemel-kehraus | Raufbold (jagt die Führung) | 0,02 |

## Vielfalts-Steckbriefe

| Spiel | kernverb | ziel | arena | kamera | bedienung | spielform | tempo | Ort | ähnlichstes Spiel | Abstand |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sockenregen | fangen | meiste | rund | schraeg | SA | FFA | hektisch | bad | pudding-gerangel | 3 / 7 |
| pudding-gerangel | rempeln | meiste | insel | schraeg | SA | FFA | wechselnd | garten | sockenregen | 3 / 7 |
| wackelturm | stapeln | meiste | frei | schraeg | SAB | FFA | ruhig | garten | sockenregen | 4 / 7 |
| kuckucks-klatsche | reagieren | meiste | buehne | fest | A | FFA | wechselnd | spielzimmer | pudding-gerangel | 4 / 7 |
| kruemel-kehraus | rempeln | meiste | eckig | draufsicht | SA | FFA | hektisch | kueche | sockenregen | 3 / 7 |
