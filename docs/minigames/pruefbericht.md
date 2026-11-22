# Prüfbericht Minispiele

Erzeugt von `packages/minigames/src/checks/checks.test.ts` (CHAOS-84) mit 200 Seeds je Tisch. Regeln, Tische und Begründung der Schwellen: [`pruefungen.md`](pruefungen.md). Neu erzeugen:

```sh
PRUEFBERICHT=1 pnpm exec vitest run packages/minigames/src/checks --silent=false
```

## Bot-Fairness

| Spiel | Seeds | Gleichstand P1 (≤ 25 %) | Abstand 1–2 (≤ 45 %) | Führungswechsel (≥ 1,0) | Siege Neuling (2 %–25 %) | Siege Profi (≥ 25 %) | Eindringling max. (≤ 1,50) | Rechenzeit s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sockenregen | 200 | 12 % | 17 % | 2,9 | 6 % | 72 % | 0,35 (Dauerdrücken (Hechtsprung)) | 1,1 |
| pudding-gerangel | 200 | 12 % | 8 % | 6,9 | 7 % | 34 % | 0,35 (Dauerrempler) | 30,1 |
| wackelturm | 200 | 9 % | 14 % | 6,2 | 10 % | 44 % | 1,54 (gierig (7–10 Törtchen)) | 2,0 |
| kuckucks-klatsche | 200 | 10 % | 15 % | 3,8 | 8 % | 53 % | 1,12 (Raffzahn (klaut alles)) | 0,3 |
| kruemel-kehraus | 200 | 21 % | 19 % | 2,2 | 7 % | 37 % | 0,98 (Dauerrempler) | 93,4 |
| toaster-timing | 200 | 5 % | 10 % | 9,2 | 8 % | 75 % | 0,00 (Dauerdrücken (Toast sofort raus)) | 0,3 |
| nussregen-netz | 200 | 1 % | 21 % | 4,9 | 18 % | 57 % | 0,00 (Dauerdrücken (immer weit schwingen)) | 0,6 |
| matschmaler | 200 | 10 % | 14 % | 17,0 | 20 % | 45 % | 0,83 (Dauerdrücken (Bauchplatscher, sobald bereit)) | 11,6 |
| rasensprenger-rodeo | 200 | 2 % | 2 % | 3,6 | 8 % | 52 % | 1,06 (Dauerdrücken (A ist ohne Wirkung)) | 4,9 |
| schnapp-den-kaese | 200 | 6 % | 15 % | 5,9 | 11 % | 44 % | 0,76 (Greift beim Zucken) | 0,4 |
| eiswuerfel-sumo | 200 | 3 % | 23 % | 2,0 | 7 % | 30 % | 0,88 (Dauerrempler) | 22,6 |
| bienenstock-honig | 200 | 2 % | 13 % | 5,7 | 7 % | 51 % | 0,92 (Dauerdrücken (nur zapfen)) | 0,6 |

## Ergebnis je Spiel

- **sockenregen:** besteht
- **pudding-gerangel:** besteht
- **wackelturm:** besteht
- **kuckucks-klatsche:** besteht
- **kruemel-kehraus:** besteht
- **toaster-timing:** besteht
- **nussregen-netz:** besteht
- **matschmaler:** besteht
- **rasensprenger-rodeo:** besteht
- **schnapp-den-kaese:** besteht
- **eiswuerfel-sumo:** besteht
- **bienenstock-honig:** besteht

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
| toaster-timing | Dauerdrücken (Toast sofort raus) | 0,00 |
| nussregen-netz | Dauerdrücken (immer weit schwingen) | 0,00 |
| matschmaler | Dauerdrücken (Bauchplatscher, sobald bereit) | 0,83 |
| rasensprenger-rodeo | Dauerdrücken (A ist ohne Wirkung) | 1,06 |
| rasensprenger-rodeo | Stillsteher | 0,00 |
| rasensprenger-rodeo | Randläufer (im Kreis am Rand) | 0,01 |
| schnapp-den-kaese | Dauerdrücken (greift sofort) | 0,22 |
| schnapp-den-kaese | Greift beim Zucken | 0,76 |
| eiswuerfel-sumo | Dauerrempler | 0,88 |
| eiswuerfel-sumo | Mittelsteher (rempelt nie) | 0,11 |
| bienenstock-honig | Dauerdrücken (nur zapfen) | 0,92 |
| bienenstock-honig | Gierhals (sichert spät) | 0,00 |
| bienenstock-honig | Angsthase (sichert jeden Zapfer) | 0,01 |

## Vielfalts-Steckbriefe

| Spiel | kernverb | ziel | arena | kamera | bedienung | spielform | tempo | Ort | ähnlichstes Spiel | Abstand |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sockenregen | fangen | meiste | rund | schraeg | SA | FFA | hektisch | bad | pudding-gerangel | 3 / 7 |
| pudding-gerangel | rempeln | meiste | insel | schraeg | SA | FFA | wechselnd | garten | sockenregen | 3 / 7 |
| wackelturm | stapeln | meiste | frei | schraeg | SAB | FFA | ruhig | garten | sockenregen | 4 / 7 |
| kuckucks-klatsche | reagieren | meiste | buehne | fest | A | FFA | wechselnd | spielzimmer | schnapp-den-kaese | 3 / 7 |
| kruemel-kehraus | rempeln | meiste | eckig | draufsicht | SA | FFA | hektisch | kueche | sockenregen | 3 / 7 |
| toaster-timing | timen | genau | eigenbereiche | fest | A | FFA | ruhig | kueche | kuckucks-klatsche | 4 / 7 |
| nussregen-netz | fangen | meiste | frei | seite | SA | FFA | wechselnd | garten | sockenregen | 3 / 7 |
| matschmaler | malen | mehrheit | frei | schraeg | SA | FFA | hektisch | garten | sockenregen | 3 / 7 |
| rasensprenger-rodeo | ausweichen | ueberleben | rund | draufsicht | S | FFA | wechselnd | garten | bienenstock-honig | 4 / 7 |
| schnapp-den-kaese | reagieren | meiste | eigenbereiche | schraeg | A | FFA | hektisch | kueche | sockenregen | 3 / 7 |
| eiswuerfel-sumo | rempeln | letzter | insel | fest | SA | FFA | hektisch | kueche | pudding-gerangel | 3 / 7 |
| bienenstock-honig | zocken | meiste | rund | schraeg | AB | FFA | wechselnd | garten | sockenregen | 3 / 7 |
