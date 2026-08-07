// Miti, storie e descrizioni per costellazioni e stelle — in italiano
// Mappa costellazioni -> indici stelle nominate (0-based in STAR_NAMES)
const CONSTELLATION_STAR_INDICES = {
  "UMa": [15, 17, 18], // Merak, Mizar, Alkaid
  "UMi": [0],          // Polaris
  "Boo": [11],         // Arturo
  "Lyr": [21],         // Vega
  "Cyg": [23],         // Deneb
  "Aql": [22],         // Altair
  "Sco": [19],         // Antares
  "Vir": [9],          // Spica
  "Leo": [12],         // Regolo
  "Gem": [10, 14],     // Castore, Polluce
  "Aur": [7],          // Capella
  "Tau": [2],          // Aldebaran
  "Ori": [3, 5, 6, 8], // Rigel, Bellatrix, Mintaka, Betelgeuse
  "CMa": [4],          // Sirio
  "CMi": [13],         // Procione
  "And": [1],          // Mirach
  "Dra": [20],         // Rastaban
  "Crv": [16],         // Algorab
  "PsA": [24],         // Fomalhaut
};

const CONSTELLATION_MYTHS = [
  {
    id: "UMa", name: "Orsa Maggiore",
    desc: "Callisto, ninfa amata da Zeus, fu trasformata in orsa da Era gelosa. Zeus la salvò ponendola nel cielo. Le sette stelle del Grande Carro sono il simbolo più riconoscibile del cielo boreale. La stella Mizar, al centro del timone, è in realtà un sistema multiplo visibile anche a occhio nudo."
  },
  {
    id: "UMi", name: "Orsa Minore",
    desc: "Rappresenta Arcade, figlio di Callisto, o Cinosura, una ninfa nutrice di Zeus. Contiene Polaris, la Stella Polare, che indica il nord e rimane quasi immobile mentre le altre stelle ruotano attorno ad essa."
  },
  {
    id: "Boo", name: "Boote",
    desc: "Il guardiano dell'orsa (Arctophylax), raffigurato come un pastore che guida i carri celesti. La sua stella più brillante, Arturo, è gigante rossa e quarta stella più luminosa del cielo notturno."
  },
  {
    id: "CrB", name: "Corona Boreale",
    desc: "La corona di Arianna, donata da Dioniso. Dopo l'abbandono di Teseo a Nasso, Dioniso sposò Arianna e gettò la sua corona di gemme in cielo. È un semicerchio perfetto di stelle, ben visibile accanto a Boote."
  },
  {
    id: "Her", name: "Ercole",
    desc: "L'eroe greco inginocchiato, raffigurato mentre combatte il Dragone. Contiene M13, un ammasso globulare spettacolare visibile con binocolo. È una costellazione estesa ma priva di stelle molto brillanti."
  },
  {
    id: "Lyr", name: "Lira",
    desc: "La lira di Orfeo, strumento capace di incantare animali e alberi. Dopo la morte di Orfeo, Zeus pose la lira in cielo. Vega, la sua stella principale, è una delle stelle più brillanti e fu la prima ad essere fotografata."
  },
  {
    id: "Cyg", name: "Cigno",
    desc: "Zeus si trasformò in cigno per sedurre Leda, regina di Sparta. La costellazione forma la Croce del Nord ed è immersa nella Via Lattea. Deneb, la sua stella alfa, è una supergigante bianca tra le più luminose conosciute."
  },
  {
    id: "Aql", name: "Aquila",
    desc: "L'aquila che portava i fulmini di Zeus. Rapì Ganimede, giovane troiano, per farlo diventare coppiere degli dei sull'Olimpo. Altair, la sua stella principale, forma con Vega e Deneb il Triangolo Estivo."
  },
  {
    id: "Del", name: "Delfino",
    desc: "Il delfino che salvò il poeta Arione dai pirati. Colpito dal suo canto, il delfino lo trasportò a riva. È una piccola costellazione a forma di aquilone, facilmente riconoscibile vicino ad Aquila."
  },
  {
    id: "Sgr", name: "Sagittario",
    desc: "Raffigurato come centauro con arco, alcuni lo identificano con Chirone. In direzione del Sagittario si trova il centro della Via Lattea, dove un buco nero supermassiccio (Sagittarius A*) risiede. La zona è ricchissima di nebulose e ammassi."
  },
  {
    id: "Sco", name: "Scorpione",
    desc: "Lo scorpione inviato da Artemide per uccidere Orione, che si vantava di poter uccidere tutti gli animali. Scorpione e Orione sono posti ai lati opposti del cielo, così non si incontrano mai. Antares, il 'rivale di Marte', è una supergigante rossa."
  },
  {
    id: "Lib", name: "Bilancia",
    desc: "Originariamente parte dello Scorpione (le sue chele), divenne costellazione indipendente in epoca romana. Simboleggia la giustizia e l'equinozio d'autunno, quando giorno e notte sono in perfetto equilibrio."
  },
  {
    id: "Vir", name: "Vergine",
    desc: "Identificata con Astrea, dea della giustizia, o con Demetra, dea dell'agricoltura. Spica, la sua stella più brillante, significa 'spiga di grano' ed è portata in mano dalla Vergine. È la seconda costellazione più grande del cielo."
  },
  {
    id: "Leo", name: "Leone",
    desc: "Il leone di Nemea, ucciso da Ercole nella prima delle sue dodici fatiche. La sua pelle impenetrabile divenne l'armatura dell'eroe. Regolo, il 'piccolo re', è una stella tripla e segna il cuore del leone."
  },
  {
    id: "Cas", name: "Cassiopea",
    desc: "La regina d'Etiopia, madre di Andromeda, punita per la sua vanità. Fu legata a un trono e posta in cielo a testa in giù per metà dell'anno. La sua inconfondibile forma a W domina il cielo settentrionale."
  },
  {
    id: "Cep", name: "Cefeo",
    desc: "Re d'Etiopia e marito di Cassiopea. Fu posto in cielo accanto alla moglie. La costellazione ha forma di casa con tetto a punta e contiene stelle variabili importanti come Delta Cephei."
  },
  {
    id: "And", name: "Andromeda",
    desc: "Figlia di Cassiopea e Cefeo, incatenata a uno scoglio come sacrificio al mostro marino Ceto. Fu salvata da Perseo, che la sposò. Contiene la Galassia di Andromeda (M31), visibile a occhio nudo in cieli bui."
  },
  {
    id: "Peg", name: "Pegaso",
    desc: "Il cavallo alato nato dal sangue di Medusa. La sua forma principale è il Grande Quadrato di Pegaso, un asterismo formato da quattro stelle. Ottimo punto di riferimento nel cielo autunnale."
  },
  {
    id: "Per", name: "Perseo",
    desc: "L'eroe che uccise Medusa e salvò Andromeda. Impugna la testa di Medusa, la cui stella Algol ('la demoniaca') varia di luminosità. Il radiante delle Perseidi, stelle cadenti di agosto, si trova qui."
  },
  {
    id: "Aur", name: "Auriga",
    desc: "Il cocchiere celeste, identificato con Erittonio, inventore del carro a quattro cavalli. Capella, la sua stella più brillante, è la sesta più luminosa del cielo ed è in realtà un sistema di quattro stelle."
  },
  {
    id: "Tau", name: "Toro",
    desc: "Zeus si trasformò in toro per rapire Europa. L'ammasso delle Pleiadi ('Sette Sorelle') è visibile nella sua schiena, mentre le Iadi formano la testa. Aldebaran, l'occhio del toro, è una gigante arancione."
  },
  {
    id: "Gem", name: "Gemelli",
    desc: "Castore e Polluce, fratelli inseparabili, uno mortale e uno immortale. Quando Castore morì, Polluce chiese a Zeus di condividere la sua immortalità, così trascorrono metà del tempo in cielo e metà nell'Ade."
  },
  {
    id: "Oph", name: "Ofiuco",
    desc: "Il serpente che Asclepio, dio della medicina, teneva in mano. Un serpente attorcigliato al bastone è ancora oggi simbolo della medicina. È l'unica costellazione 'tredicesima' dello zodiaco attraversata dal sole."
  },
  {
    id: "Dra", name: "Dragone",
    desc: "Il drago Ladone, custode del giardino delle Esperidi, ucciso da Ercole. Si snoda attorno al polo nord celeste tra le due Orse. La stella Thuban fu la stella polare al tempo degli antichi egizi."
  },
  {
    id: "Ari", name: "Ariete",
    desc: "Il montone dal vello d'oro che trasportò Frisso ed Elle in salvo. Il mito ispirò la saga degli Argonauti. È una costellazione modesta con stelle deboli, ma importante come primo segno zodiacale."
  },
  {
    id: "Psc", name: "Pesci",
    desc: "Afrodite e suo figlio Eros si trasformarono in pesci per sfuggire al mostro Tifone. Sono legati da un nastro celeste. Nonostante la debole luminosità, è una costellazione zodiacale estesa."
  },
];

const STAR_MYTHS = [
  {
    name: "Vega", constellation: "Lira",
    desc: "Stella più brillante del Triangolo Estivo e quinta del cielo. Distante 25 anni luce, è una stella bianco-azzurra destinata a diventare la nuova stella polare tra circa 12.000 anni. Nella mitologia cinese fa parte della storia del mandriano e della tessitrice."
  },
  {
    name: "Altair", constellation: "Aquila",
    desc: "Stella bianca a 17 anni luce, ruota su se stessa a velocità elevatissima (un giro in 10 ore). Forma con Vega e Deneb il Triangolo Estivo. Il suo nome arabo significa 'l'aquila in volo'."
  },
  {
    name: "Deneb", constellation: "Cigno",
    desc: "Supergigante bianca tra le più luminose della Via Lattea. Dista circa 2.600 anni luce: se fosse al posto del Sole, si estenderebbe fino all'orbita terrestre. È la coda del Cigno."
  },
  {
    name: "Arturo", constellation: "Boote",
    desc: "Gigante rossa, la quarta stella più brillante del cielo. Il suo nome significa 'guardiano dell'orsa'. Si muove rapidamente rispetto alle altre stelle e fa parte di un gruppo di stelle provenienti da una galassia nana inghiottita dalla Via Lattea."
  },
  {
    name: "Antares", constellation: "Scorpione",
    desc: "Supergigante rossa, una delle stelle più grandi visibili a occhio nudo: se fosse al centro del sistema solare, si estenderebbe oltre l'orbita di Marte. Il suo nome significa 'rivale di Marte' per il colore rosso intenso."
  },
  {
    name: "Polaris", constellation: "Orsa Minore",
    desc: "La Stella Polare, meno di 1° dal polo nord celeste. È una variabile cefeide e un sistema triplo. Rimane quasi immobile nel cielo, rendendola indispensabile per la navigazione da millenni."
  },
  {
    name: "Spica", constellation: "Vergine",
    desc: "La stella più brillante della Vergine, il suo nome significa 'spiga di grano'. È una binaria spettroscopica molto calda a 250 anni luce. Una delle stelle che permisero a Ipparco di scoprire la precessione degli equinozi."
  },
  {
    name: "Regolo", constellation: "Leone",
    desc: "Il 'piccolo re', cuore del Leone. È un sistema quadruplo a 79 anni luce. Sorge a est prima dell'alba ad agosto. Era una delle quattro stelle regali dell'astronomia persiana."
  },
  {
    name: "Castore", constellation: "Gemelli",
    desc: "Stella binaria visuale (in realtà un sistema di 6 stelle). Insieme a Polluce forma la testa dei Gemelli. Castore è bianca, Polluce è arancione: a occhio nudo si distinguono bene per il colore diverso."
  },
  {
    name: "Polluce", constellation: "Gemelli",
    desc: "Gigante arancione, la stella più brillante dei Gemelli. A differenza del gemello Castore (bianco), è notevolmente più calda e arancione. Nel 2006 è stato scoperto un pianeta extrasolare orbitante attorno a Polluce."
  },
  {
    name: "Capella", constellation: "Auriga",
    desc: "La stella più brillante dell'Auriga, sesta del cielo. È in realtà un sistema di quattro stelle: due giganti gialle e due nane rosse. Visibile bassa sull'orizzonte nord nelle notti estive."
  },
  {
    name: "Aldebaran", constellation: "Toro",
    desc: "Gigante arancione, l'occhio del Toro. Appare vicino alle Iadi e alle Pleiadi. Il suo nome arabo significa 'colui che segue', perché sorge dopo le Pleiadi."
  },
  {
    name: "Betelgeuse", constellation: "Orione",
    desc: "Supergigante rossa, una delle stelle più grandi conosciute. Segna la spalla di Orione. La sua luminosità varia notevolmente e si prevede che esploderà come supernova entro 100.000 anni."
  },
  {
    name: "Sirio", constellation: "Cane Maggiore",
    desc: "La stella più brillante del cielo. Situata nel Cane Maggiore, è due volte più massiccia del Sole e dista solo 8,6 anni luce. Gli antichi egizi basavano il loro calendario sulla sua levata eliaca."
  },
  {
    name: "Procione", constellation: "Cane Minore",
    desc: "La stella più brillante del Cane Minore. Forma con Sirio e Betelgeuse il Triangolo Invernale. Il suo nome greco significa 'prima del cane', perché sorge poco prima di Sirio."
  },
  {
    name: "Mizar", constellation: "Orsa Maggiore",
    desc: "Stella doppia visibile anche senza telescopio: nell'antichità, distinguere Mizar dalla sua compagna Alcor era un test di acutezza visiva. Fa parte del timone del Grande Carro."
  },
  {
    name: "Fomalhaut", constellation: "Pesce Australe",
    desc: "La stella più brillante del Pesce Australe. Il suo nome arabo significa 'bocca del pesce'. È circondata da un disco di polveri e detriti in cui si forma un sistema planetario."
  },
  {
    name: "Alkaid", constellation: "Orsa Maggiore",
    desc: "La stella all'estremità del timone del Grande Carro. Il suo nome significa 'il capo delle lamentatrici'. È una stella blu-bianca calda, visibile tutto l'anno alle nostre latitudini."
  },
];
