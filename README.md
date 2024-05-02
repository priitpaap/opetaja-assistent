# Õpetaja assistent

Pivotal Tracker: [https://www.pivotaltracker.com/n/projects/2645015](https://www.pivotaltracker.com/n/projects/2645015)

## Eesmärk

„Õpetaja assistent“ on Chrome'i laiendus, mis on loodud selleks, et aidata õpetajatel õppeinfosüsteemis rühmade
päevikuid kontrollida ja nendes esinevaid puudujääke, nagu puuduolevad tunnid või määramata lõpphinded, automaatselt
kõrvaldada. Laiendus tuvastab ja tõstab esile puuduolevad tunnid ja hinded, andes ühtlasi ülevaate ainete lõpetamise
staatusest ja paljust muust. See on mõeldud olema tõhus vahend õpetajatele, muutes nende töö lihtsamaks ja
korraldatumaks.

Hetkel on toetatud tahvel.edu.ee, kuid Siseveebi tugi on ka plaanis luua kunagi, kui keegi soovib seda.

## Paigaldamine

Järgi neid samme assistendi paigaldamiseks:

1. Laadi alla repo
2. Ava Chrome'i laienduste haldur aadressil `chrome://extensions/`
3. Lülita sisse arendaja režiim (Developer Mode)
4. Klõpsa Chrome'i laienduste halduris nuppu `Load unpacked` (avaneb kausta valimise dialoog)
5. Vali kaustaks `build/chrome-mv3-prod` kaust
6. Külasta oma õppeinfosüsteemi päevikute loendi vaadet (peaksid nägema, et lehel on midagi muutunud)

## Võimalused

Järgnev tabel näitab, millised funktsioonid on juba olemas ja millised on alles arendamisel.

<table>
  <tr>
    <th>Funktsioon</th>
    <th>Tahvel.edu.ee</th>
    <th>Siseveeb</th>
  </tr>
  <tr>
    <td colspan="3"><br><h3>Päevikute loetelu vaade</h3></td>
  </tr>
  <tr>
    <td>Õpetaja näeb hoiatust, kui päevikus on puuduvaid sissekandeid</td>
    <td align="center">✅</td>
    <td></td>
  </tr>
  <tr>
    <td>Õpetaja näeb hoiatust, kui kõik selle aine tunnid on tunniplaani lisatud ja päevikus puuduvad mõned hinded</td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>Õpetaja näeb äralõppenud aineid hallina, et neid oleks lihtsam eristada</td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>Õpetaja näeb tulpa ainete lõpuni jääva ajaga, et ta saaks paremini planeerida aine lõpetamist</td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>Käsunduslepinguga õpetajale on tulp 'Planeeritud ja sissekantud kontakttundide arv', et arve koostamisel teada, kui palju oli kontakttunde</td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>Käsunduslepinguga õpetajale on tulp "Planeeritud ja sissekantud e-õppetundide arv," et arve koostamisel teada, kui palju oli e-õppetunde, sest neil võib olla erinev hind</td>
    <td></td>
    <td></td>
  </tr>
    <tr>
    <td>Õpetaja näeb 'päevikud' lehe tabeli all "Kokku" real koondsummasid</td>
    <td></td>
    <td></td>
  </tr>

  <tr>
    <td colspan="3"><br><h3>Päeviku detailvaade</h3></td>
  </tr>
  <tr>
    <td>Õpetaja näeb tabelina, millised tunnid on sisse kandmata jäänud</td>
    <td align="center">✅</td>
    <td></td>
  </tr>
  <tr>
    <td>Õpetaja näeb tabelist, millised tunnid on vigaselt sisse kantud</td>
    <td align="center">✅</td>
    <td></td>
  </tr>
  <tr>
    <td>Õpetajana saab lisada päevikusse sissekandmata tunnid kahe klikiga, et säästa aega ja vähendada vigu</td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>Õpetaja näeb tabelina, millised hinded on väljapanemata jäänud, kui aine kõik tunnid on tunniplaani kantud</td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>Õpetaja saab tabelis nupuvajutusega avada õpiväljundi hindamisvaate, kus puuduvad hinded eeltäidetakse ja negatiivsete hinnete põhjused on kommenteeritud</td>
    <td></td>
    <td></td>
  </tr>
</table>

## Arendusversiooni kasutamine

Arendusversioon on mõeldud arendajatele, kes soovivad muuta koodi. Pull requestid on teretulnud.

See projekt on ehitatud [Plasmo](https://docs.plasmo.com/) baasile.

### Nõuded

See projekt kasutab [pnpm](https://pnpm.io/) paketihaldurit, mis on [npm](https://www.npmjs.com/)i alternatiiv.

- [Node.js](https://nodejs.org/en/) (versioon 14 või uuem)
- [pnpm](https://pnpm.io/) (versioon 6 või uuem)
- [Chrome](https://www.google.com/chrome/) (versioon 92 või uuem)

### Sõltuvuste paigaldamine (esmakordsel kasutamisel)

Selleks, et arendusversiooni käivitada, tuleb kõigepealt paigaldada sõltuvused:

```bash
pnpm install
```

### Arendusserveri käivitamine (igakordsel kasutamisel)

Arendusserveri käivitamiseks tuleb käivitada järgmine käsk:

```bash
pnpm dev
```

### Laienduse paigaldamine Chrome'i (esmakordsel kasutamisel)

Arendusversioon tekib kausta `build/chrome-mv3-dev`. Sellest kaustast saab laadida Chrome'i laienduse sama moodi nagu
tootmisversiooni puhul:

1. Klõpsa Chrome'i laienduste halduris nuppu `Load unpacked` (avaneb kausta valimise dialoog)
2. Vali kaustaks `build/chrome-mv3-dev` kaust
3. Külasta oma õppeinfosüsteemi päevikute loendi vaadet

### Panustamine

Kui oled midagi vahvat teinud, ära unusta seda ka teistega jagamast!

1. Täienda README faili
2. Käivita `pnpm build` või `npm run build`
3. Testi oma muudatusi laadides laiendi `build/chrome-mv3-dev` kaustast.
4. Tee pull request

