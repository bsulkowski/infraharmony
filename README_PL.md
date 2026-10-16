# Infra-beatbox

*Dostępne także po angielsku: [README](README.md)*

Siatka tonów i rytmów na jednej skali. Wiersze to skala C-dur od środkowego C
(C4 ≈ 262 Hz). Kolumny to ta sama skala osiem oktaw niżej, od C−4 ≈ 1,02 Hz, gdzie
częstotliwości nie słychać już jako wysokości dźwięku, tylko jako puls. Każda kratka łączy ton
z rytmem; kratki na przekątnej grają ton dokładnie 256 razy szybszy od tempa, w którym go powtarzają.

Prototyp strony do Piaskownicy na [bsulkowski.pl](https://bsulkowski.pl).

## Gra

- **LPM** na kratce: zaczyna się w niej głos. Brzmi od razu i wraca co okres swojego rytmu.
  Kolejne kliknięcie tej samej kratki dodaje kolejny głos o tym samym tonie i rytmie, w fazie
  tego kliknięcia.
- **PPM** na kratce: czyści wszystkie jej głosy. Na ekranie dotykowym przytrzymaj kratkę.
- Klawiatura: strzałki przesuwają, **Enter** dodaje, **Delete** czyści.

Każdy głos to kropka okrążająca kratkę raz na okres; dźwięk pada, gdy mija znacznik u góry.

Dwa stroje: równomiernie temperowany i naturalny, w którym stopnie skali są proporcjami liczb
całkowitych (9/8, 5/4, 4/3, 3/2 …). W stroju naturalnym polirytmy powtarzają się dokładnie: C, E
i G w rytmach swoich nut to 4 : 5 : 6 i schodzą się co cztery okresy C. W równomiernym powoli
się rozjeżdżają i wracają po kilku minutach.

## Kod

- `src/infra-beatbox.ts`: skala, rytmy i czas głosów. Czyste funkcje, bez DOM i dźwięku.
- `src/player.ts`: odtwarza głosy przez Web Audio; nuty są planowane z wyprzedzeniem
  na zegarze audio, dźwięk jest syntezowany.
- `demo/`: strona prototypu.

```sh
npm install
npm test        # silnik
npm run demo    # strona, pod http://localhost:8000
```
