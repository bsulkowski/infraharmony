# Infraharmonia

*Osiem oktaw poniżej dźwięku*

*Dostępne także po angielsku: [README](README.md)*

Harmonia dla rytmów. Muzyka od dawna wie, które dźwięki dobrze brzmią razem: częstotliwości
w prostych proporcjach, kwinta 3 : 2, akord durowy 4 : 5 : 6. Rytmy też są częstotliwościami,
tylko wolniejszymi, więc te same proporcje powinny mówić, które rytmy dobrze idą w parze.
Infraharmonia przenosi skalę tam, gdzie częstotliwość słychać już jako puls, i pozwala łączyć jedno
z drugim.

Siatka tonów i rytmów na jednej skali. Wiersze to skala C-dur od środkowego C
(C4 ≈ 262 Hz). Kolumny to ta sama skala osiem oktaw niżej, od C−4 ≈ 1,02 Hz, gdzie
częstotliwości nie słychać już jako wysokości dźwięku, tylko jako puls. Każda kratka łączy ton
z rytmem; kratki na przekątnej grają ton dokładnie 256 razy szybszy od tempa, w którym go powtarzają.

Daleki krewny Rhythmiconu, instrumentu, który Lew Termen zbudował dla Henry'ego Cowella w 1931
roku: każdy ton szeregu harmonicznego grał razem z rytmem w tej samej proporcji.

Prototyp strony do Piaskownicy na [bsulkowski.pl](https://bsulkowski.pl).

## Gra

- **LPM** na kratce: zaczyna się w niej głos. Brzmi od razu i wraca co okres swojego rytmu.
  Kolejne kliknięcie tej samej kratki dodaje kolejny głos o tym samym tonie i rytmie, w fazie
  tego kliknięcia.
- **PPM** na kratce: czyści wszystkie jej głosy. Na ekranie dotykowym przytrzymaj kratkę.
- Klawiatura: strzałki przesuwają, **Enter** dodaje, **Delete** czyści.

Każdy głos to kropka okrążająca kratkę raz na okres; dźwięk pada, gdy mija znacznik u góry.

Strona ma gotowe wzory i przycisk losujący nowe, z pentatoniki i w tonie, i w rytmie. Wzory są
w czterech grupach: interwały skali od oktawy (1 : 2) po tryton (32 : 45), każdy w swoim rytmie,
więc im prostsza proporcja, tym szybciej głosy się schodzą; akordy i ich przewroty; kanony, czyli
jedna melodia w kilku tempach; i kilka innych, jak serce czy fala wahadeł.

Utwór można wysłać jako krótki kod, który stoi w adresie strony po `#` i w polu na stronie:
`1j8.AAAACAVVEAqr` to C4, E4 i G4 w rytmie C−4, co trzecią część okresu, w stroju naturalnym.
Format jest opisany w `src/code.ts`.

Dwa stroje: równomiernie temperowany i naturalny, w którym stopnie skali są proporcjami liczb
całkowitych (9/8, 5/4, 4/3, 3/2 …). W stroju naturalnym polirytmy powtarzają się dokładnie: C, E
i G w rytmach swoich nut to 4 : 5 : 6 i schodzą się co cztery okresy C. W równomiernym się
rozjeżdżają: tercja wraca do zgody co 25 s, kwinta po niecałych pięciu minutach.

## Kod

- `src/infraharmony.ts`: skala, rytmy i czas głosów. Czyste funkcje, bez DOM i dźwięku.
- `src/examples.ts`: gotowe wzory i losowanie.
- `src/code.ts`: utwór jako kod do linku i z powrotem.
- `src/player.ts`: odtwarza głosy przez Web Audio; nuty są planowane z wyprzedzeniem
  na zegarze audio, dźwięk jest syntezowany.
- `demo/`: strona prototypu.

```sh
npm install
npm test        # silnik
npm run demo    # strona, pod http://localhost:8000
```

## Licencja

[MIT](LICENSE) — Bartosz Sułkowski.
