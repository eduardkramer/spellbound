DE TOREN VAN DE TOVENAAR - cozy vibe-setting

Starten: pak de zip uit en dubbelklik op index.html. Geen server of installatie nodig.

SPELEN
  Beweeg de tovenaar met de pijltjestoetsen of WASD. Houd een toets
  ingedrukt om door te lopen. Je kunt om meubels heen lopen.
  Klik op een vrije tegel. De tovenaar loopt erheen om obstakels heen.
  Een looptoets neemt de besturing over.
  Loop naast de kist om het deksel te openen en goudlicht te zien.
  Beweeg de muis over een vloertegel om de rand te laten oplichten.
  Gebruik − en + boven het speelveld om te zoomen. Klik op het percentage
  om terug te gaan naar 100%. Scroll als het speelveld niet volledig past.
  De pijltjes volgen de diagonale tegelrichtingen van de isometrische kamer.

MUZIEK TOEVOEGEN
  1. Zet je .mp3 bestanden in de map  music/
  2. Open tracks.js en voeg per nummer een regel toe:
       { title: 'Rainy Tower', artist: 'Naam', src: 'music/rainy-tower.mp3' },
  3. Pagina verversen.
  Spatiebalk = afspelen/pauzeren. Je volume wordt onthouden.

TILES (voor de tile-game)
  Open tiles.html: alle tiles + een testkamer.
  tiles.js    de tiles, procedureel getekend in dezelfde stijl. 1 tile = ruit van 32x16 px, afbeelding 32x48 px.
  tiles.png   spritesheet (8 cellen per rij), tiles.json zegt waar elke tile staat, of hij loopbaar is en hoe hoog.
  In code: TILESET.draw(ctx, 'stone_a', gx, gy, ox, oy, t)  en  TILESET.info('wall').walkable

TOVENAAR (sprite)
  wizard.js   de tovenaar, 4 richtingen (se, sw, ne, nw), 'idle' (2 frames) en 'walk' (4 frames). Cel 32x48 px, voeten op (16,44).
  wizard.png  spritesheet: per richting een rij (2x idle, 4x walk), wizard.json beschrijft de indeling.
  In code: WIZARD.draw(ctx, 'se', 'walk', t, x, y)  met [x,y] = TILESET.center(gx, gy, ox, oy)
  tiles.html: loop met pijltjestoetsen of WASD door de testkamer.

Bestanden
  index.html  speelbare torenkamer en muziekspeler
  scene.js    de kamer (procedureel getekend, geen plaatjes)
  player.js   de muziekspeler
  tracks.js   jouw afspeellijst
  music/      hier komen je mp3's
