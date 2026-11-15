DE TOREN VAN DE TOVENAAR - cozy vibe-setting

Starten: pak de zip uit en dubbelklik op index.html. Geen server of installatie nodig.

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

Bestanden
  index.html  pagina + stijl van de speler
  scene.js    de kamer (procedureel getekend, geen plaatjes)
  player.js   de muziekspeler
  tracks.js   jouw afspeellijst
  music/      hier komen je mp3's
