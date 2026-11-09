/**
 * Trimmed copy of the real Wikipedia markup (2026 + 2027 sections), keeping the
 * structural features the parser depends on: year in the section heading, no
 * year in the date cells, thead/tbody, rowspanned Event cells for multi-night
 * shows, `background: #FFFF80` on NXT rows, footnote <sup>s, and a "Location"
 * column rather than "City".
 */
export const WIKI_FIXTURE = `
<div class="mw-heading mw-heading3"><h3 id="2026">2026</h3></div>
<table class="wikitable"><tbody><tr>
  <td style="background: #FFFF80; width: 2em"></td><td>NXT-branded event</td>
</tr></tbody></table>
<table class="sortable wikitable succession-box" style="font-size:85%">
<thead><tr>
  <th scope="col">Date</th><th scope="col">Event</th><th scope="col">Venue</th>
  <th scope="col">Location</th><th scope="col">Attendance</th><th scope="col">Final match</th><th scope="col">Notes</th>
</tr></thead>
<tbody>
<tr><td>January 31</td><td><a href="/wiki/Royal_Rumble_(2026)">Royal Rumble</a></td><td>Riyadh Season Stadium</td><td>Riyadh, Saudi Arabia</td><td>25,000</td><td>30-man Royal Rumble match</td><td></td></tr>
<tr style="background: #FFFF80"><td>March 7</td><td>Vengeance Day</td><td>WWE Performance Center</td><td>Orlando, Florida</td><td></td><td>Joe Hendry (c) vs. Ricky Saints</td><td></td></tr>
<tr><td>April 18</td><td rowspan="2">WrestleMania 42</td><td rowspan="2">Allegiant Stadium</td><td rowspan="2">Paradise, Nevada</td><td>50,816</td><td>Cody Rhodes (c) vs. Randy Orton</td><td rowspan="2">Aired as a two-part event</td></tr>
<tr><td>April 19</td><td>55,256</td><td>CM Punk (c) vs. Roman Reigns</td></tr>
<tr><td>August 1</td><td rowspan="2">SummerSlam</td><td rowspan="2">U.S. Bank Stadium</td><td rowspan="2">Minneapolis, Minnesota</td><td>36,683</td><td>Oba Femi vs. Brock Lesnar</td><td rowspan="2">Aired as a two-part event</td></tr>
<tr><td>August 2</td><td>33,086</td><td>Roman Reigns (c) vs. Seth Rollins</td></tr>
<tr><td>August 30</td><td>Ola de Calor</td><td>Bert Ogden Arena</td><td>Edinburg, Texas</td><td></td><td>Los Perros del Mal</td><td>First stand-alone AAA event</td></tr>
<tr style="background: #FFFF80"><td>August 30</td><td>Heatwave</td><td>Bert Ogden Arena</td><td>Edinburg, Texas</td><td></td><td>Tony D'Angelo (c) vs. Cruz Montana</td><td></td></tr>
</tbody></table>
<div class="mw-heading mw-heading3"><h3 id="2026_2">2026</h3></div>
<table class="wikitable"><tbody><tr>
  <td style="background: #FFFF80; width: 2em"></td><td>NXT-branded event</td>
  <td style="background: #B9E2C9; width: 2em"></td><td>Co-produced with AAA</td>
</tr></tbody></table>
<table class="sortable wikitable succession-box" style="font-size:85%">
<thead><tr>
  <th scope="col">Date</th><th scope="col">Event</th><th scope="col">Venue</th><th scope="col">Location</th><th scope="col">Notes</th>
</tr></thead>
<tbody>
<tr><td>September 6</td><td>Sunday Night's Main Event<sup class="reference">[28]</sup></td><td>State Farm Arena</td><td>Atlanta, Georgia</td><td></td></tr>
<tr><td>September 11</td><td rowspan="2">Triplemanía 34</td><td>MGM Grand Garden Arena</td><td>Paradise, Nevada</td><td rowspan="2">Will air as a two-part event</td></tr>
<tr><td>September 13</td><td>Arena CDMX</td><td>Mexico City, Mexico</td></tr>
<tr><td>September 26</td><td>Worlds Collide<sup class="reference">[29]</sup></td><td>Allstate Arena</td><td>Rosemont, Illinois</td><td></td></tr>
<tr><td>October 10</td><td>Money in the Bank<sup class="reference">[30]</sup></td><td>Smoothie King Center</td><td>New Orleans, Louisiana</td><td></td></tr>
<tr style="background: #FFFF80"><td>October 31</td><td>Halloween Havoc<sup class="reference">[31]</sup></td><td>TBA</td><td>TBA</td><td></td></tr>
<tr><td>November 7</td><td>Crown Jewel<sup class="reference">[32]</sup></td><td>Riyadh Season Stadium</td><td>Riyadh, Saudi Arabia</td><td></td></tr>
<tr><td>November 28</td><td>Survivor Series: WarGames<sup class="reference">[33]</sup></td><td>Daikin Park</td><td>Houston, Texas</td><td></td></tr>
<tr><td>December 12</td><td>Wrestlepalooza<sup class="reference">[34]</sup></td><td>RAC Arena</td><td>Perth, Western Australia, Australia</td><td></td></tr>
</tbody></table>
<div class="mw-heading mw-heading3"><h3 id="2027">2027</h3></div>
<table class="sortable wikitable succession-box" style="font-size:85%">
<thead><tr>
  <th scope="col">Date</th><th scope="col">Event</th><th scope="col">Venue</th><th scope="col">Location</th><th scope="col">Notes</th>
</tr></thead>
<tbody>
<tr><td>February</td><td>Royal Rumble<sup class="reference">[35]</sup></td><td>State Farm Stadium</td><td>Glendale, Arizona</td><td></td></tr>
<tr style="background: #FFFF80"><td>April</td><td>Stand &amp; Deliver<sup class="reference">[36]</sup></td><td>Infosys Theater</td><td>New York City, New York</td><td></td></tr>
<tr><td>April</td><td>WrestleMania 43</td><td>TBA</td><td>Riyadh, Saudi Arabia</td><td>Will air as a two-part event</td></tr>
<tr><td>January 30 – February 1</td><td>Some Multi-Day Show</td><td>Test Arena</td><td>Testville, Testland</td><td></td></tr>
</tbody></table>
`;
