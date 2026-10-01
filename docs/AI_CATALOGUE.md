# AI animal catalogue v2

Updated 2026-09-30. Scope: the offline AI mode, not the multiplayer backend catalogue.
120 distinct entries, split into 40 easy / 40 medium / 40 hard animals. “Random”
uses all 120. Difficulty pools reflect editorial estimates of name recognition;
they are independent of opponent difficulty.

## Data contract and editorial conventions

The JSON is bundled, with no runtime downloads. Records have stable IDs, Arabic
display names, scientific identities, search aliases (including selected Darija
and Arabizi forms), game facts, source links, and short Arabic caveats. Sources
are editorial references, not resources fetched by the running game.

These are simplified game cards, not a veterinary or taxonomic authority. Reading
a reference page does not certify every Boolean for every individual. References
include Animal Diversity Web species accounts, zoo/conservation organisations,
RSPB, FAO, and specialist natural-history organisations. Classification-only pages
support identity, not every behavioural field. Traits with breed, sex, age, or
environmental variation require this interpretation:

- Identity is the named species/domestic form, not every species sharing the generic
  Arabic alias. Generic aliases are search aids only; they never enter AI reasoning.
- Size uses a representative adult body mass: small <10 kg, medium 10–<100 kg,
  large 100–<1000 kg, huge >=1000 kg. The recorded mass is a game representative,
  not an exact species mean or a measurement of every individual.
- Habitat is one recognisable game setting, not an exhaustive habitat distribution.
  `arctic` is the legacy code for polar environments including Antarctica;
  `jungle` groups wooded/forest settings, not only tropical jungle. Region questions
  provide more specific origin information. Domestic origins are conventional
  ancestral ranges; introduced populations are not an exhaustive region inventory.
- Diet means an editorial primary feeding category. Carnivore includes insectivores
  and animal plankton eaters; herbivore includes fruit/nectar eaters. Detritivore is
  separate for earthworms and millipedes. Occasional foods do not necessarily change
  a category. These facts must not be presented as an exclusive list of foods.
- Body traits can occur in a typical adult of either sex. Male ostrich colours,
  ant reproductive wings, male elephant tusks and male okapi horns are explicitly
  qualified on their cards. “Horns” includes the everyday sense encompassing antlers
  and ossicones; it is not a claim that these structures are anatomically identical.
- Legs count recognisable walking legs, excluding wings, arms and flippers. Octopus
  arms and starfish tube feet are excluded. The many-leg question asks only >10;
  millipede leg counts vary and the stored representative number is not exact.
- Fur means a visible fur coat, not any microscopic/sparse mammalian hair. Scales
  include reptile/fish scales and pangolin scales; seahorse bony plates are not
  called scales. A shell/armour is not the same as every arthropod exoskeleton.
- Flight includes short powered flights. Wings and flight are separate. Swimming
  does not follow automatically from water habitat. Hippo bottom-walking is not
  classified as free swimming. A negative reply is worded as “the card does not
  confirm this”, not a universal biological impossibility.
- Nocturnal means ordinary activity can include night, not exclusively nocturnal.
  Group living describes a characteristic social/flocking/colonial pattern, not
  every temporary encounter. Individual and seasonal variation remains possible.

The automated tests validate consistency and solvability against these cards.
They cannot prove all zoological facts. Further independent content review is
welcome; do not change data solely to make signatures different.

## Corrections and identity decisions

The original records remain frozen in `animals.v1.json` for old saved rounds.
New rounds use v2. This allows substantive fact/name corrections without silently
changing an existing mystery or its answers.

- 39, the malformed “طاسوع” beaver-emoji record, is now an American beaver.
- 45/46 explicitly distinguish a one-humped dromedary and a two-humped domestic
  Bactrian camel; “جمل” versus “بعير” is not a species distinction.
- 53, the malformed “وحيد المرفق”, is replaced by an explicitly named Atlantic
  puffin. This is an editorial replacement, not a translation claim.
- 60, the malformed “بانيو” mammoth-emoji record, is replaced by an Asian elephant.
  This is an editorial replacement, not an assertion of the old intended identity.
- 20 is explicitly a tiger (ببر), consistent with its image; common search names
  still work. Other broad names are similarly anchored to specific identities.
- Cat swimming, short chicken flight, shrew carnivory, egg-laying mammals,
  live-bearing sharks/scorpions and water-habitat versus swimming are handled
  explicitly. The opponent fact card displays notes for important exceptions.

The old horse/donkey, parrot/toucan and shrew/hedgehog duplicates are resolved by
real traits and/or specific identity information. The final v2 signature audit
finds no duplicate group across the 69 supported predicates. No animal name or ID
is used as a hidden-answer shortcut.

## Catalogue and references

Source links are recorded for traceability. Some accounts use historical scientific
synonyms; taxonomy and vernacular names can evolve. Do not interpret a single
reference link as provenance for every game convention above.

| ID | Arabic name | Scientific identity | Pool | Search aliases | Reference |
|---:|---|---|---|---|---|
| 1 | قطة منزلية | Felis catus | easy | قطة، قط، مش، مشة، 9ett | [Reference](https://animaldiversity.org/accounts/Felis_catus/) |
| 2 | كلب منزلي | Canis lupus familiaris | easy | كلب، kelb | [Reference](https://animaldiversity.org/accounts/Canis_lupus_familiaris/) |
| 3 | دجاجة منزلية | Gallus gallus domesticus | easy | دجاجة، دجاج، djaja | [Reference](https://animaldiversity.org/accounts/Gallus_gallus/) |
| 4 | أرنب أوروبي | Oryctolagus cuniculus | easy | أرنب، قنية، 9nya | [Reference](https://animaldiversity.org/accounts/Oryctolagus_cuniculus/) |
| 5 | بقرة منزلية | Bos taurus | easy | بقرة، begra | [Reference](https://animaldiversity.org/accounts/Bos_taurus/) |
| 6 | حصان | Equus caballus | easy | عود، خيل، 3awd | [Reference](https://animaldiversity.org/accounts/Equus_caballus/) |
| 7 | خروف | Ovis aries | easy | كبش، حولي، 7awli | [Reference](https://animaldiversity.org/accounts/Ovis_aries/) |
| 8 | دب بني | Ursus arctos | easy | دب | [Reference](https://animaldiversity.org/accounts/Ursus_arctos/) |
| 9 | بطة برية | Anas platyrhynchos | easy | بطة، بط، بط بري | [Reference](https://animaldiversity.org/accounts/Anas_platyrhynchos/) |
| 10 | سمكة ذهبية | Carassius auratus | easy | سمكة، سمك ذهبي | [Reference](https://animaldiversity.org/accounts/Carassius_auratus/) |
| 11 | أسد | Panthera leo | easy | سبع، سبعان، sbe3 | [Reference](https://animaldiversity.org/accounts/Panthera_leo/) |
| 12 | فيل إفريقي | Loxodonta africana | easy | فيل، fil | [Reference](https://animaldiversity.org/accounts/Loxodonta_africana/) |
| 13 | مكاك بربري | Macaca sylvanus | medium | قرد، زعطوط، قرد الأطلس | [Reference](https://animaldiversity.org/accounts/Macaca_sylvanus/) |
| 14 | ببغاء رمادي | Psittacus erithacus | easy | ببغاء، ببغاء إفريقي | [Reference](https://animaldiversity.org/accounts/Psittacus_erithacus/) |
| 15 | حمار | Equus asinus | easy | 7mar | [Reference](https://animaldiversity.org/accounts/Equus_asinus/) |
| 16 | زرافة | Giraffa camelopardalis | easy | زرافة شمالية | [Reference](https://animaldiversity.org/accounts/Giraffa_camelopardalis/) |
| 17 | حمار وحشي | Equus quagga | easy | زيبرا، zebra | [Reference](https://animaldiversity.org/accounts/Equus_burchellii/) |
| 18 | فرس النهر | Hippopotamus amphibius | medium | سيد قشطة، هيبو | [Reference](https://animaldiversity.org/accounts/Hippopotamus_amphibius/) |
| 19 | وحيد القرن الأبيض | Ceratotherium simum | medium | وحيد القرن، كركدن | [Reference](https://animaldiversity.org/accounts/Ceratotherium_simum/) |
| 20 | ببر | Panthera tigris | easy | نمر مخطط، تايغر، tiger، نمر | [Reference](https://animaldiversity.org/accounts/Panthera_tigris/) |
| 21 | فهد صياد | Acinonyx jubatus | easy | فهد، شيتا، cheetah | [Reference](https://animaldiversity.org/accounts/Acinonyx_jubatus/) |
| 22 | ذئب رمادي | Canis lupus | easy | ذئب، ديب، dib | [Reference](https://animaldiversity.org/accounts/Canis_lupus/) |
| 23 | ثعلب أحمر | Vulpes vulpes | easy | ثعلب، تعلب | [Reference](https://animaldiversity.org/accounts/Vulpes_vulpes/) |
| 24 | دلفين قاروري الأنف | Tursiops truncatus | easy | دلفين | [Reference](https://animaldiversity.org/accounts/Tursiops_truncatus/) |
| 25 | حوت أزرق | Balaenoptera musculus | easy | حوت | [Reference](https://animaldiversity.org/accounts/Balaenoptera_musculus/) |
| 26 | قرش أبيض | Carcharodon carcharias | easy | قرش | [Reference](https://animaldiversity.org/accounts/Carcharodon_carcharias/) |
| 27 | أخطبوط شائع | Octopus vulgaris | medium | أخطبوط، بوطبوط | [Reference](https://animaldiversity.org/accounts/Octopus_vulgaris/) |
| 28 | سلحفاة يونانية | Testudo graeca | easy | سلحفاة، فكرون، fekroun | [Reference](https://www.marylandzoo.org/animal/greek-tortoise/) |
| 29 | ضفدع شائع | Rana temporaria | easy | ضفدع، جرانة، jrana | [Reference](https://animaldiversity.org/accounts/Rana_temporaria/) |
| 30 | عقرب إمبراطوري | Pandinus imperator | medium | عقرب، 3a9rab | [Reference](https://animaldiversity.org/accounts/Pandinus_imperator/) |
| 31 | نسر أسمر | Gyps fulvus | hard | نسر | [Reference](https://zoobarcelona.cat/en/node/211) |
| 32 | طاووس هندي | Pavo cristatus | easy | طاووس | [Reference](https://animaldiversity.org/accounts/Pavo_cristatus/) |
| 33 | بومة الحظائر | Tyto alba | easy | بومة، موكة، mouka | [Reference](https://animaldiversity.org/accounts/Tyto_alba/) |
| 34 | حمامة صخرية | Columba livia | easy | حمامة، حمام، 7mama | [Reference](https://animaldiversity.org/accounts/Columba_livia/) |
| 35 | بجعة صامتة | Cygnus olor | medium | بجعة | [Reference](https://animaldiversity.org/accounts/Cygnus_olor/) |
| 36 | كنغر أحمر | Macropus rufus | medium | كنغر | [Reference](https://animaldiversity.org/accounts/Macropus_rufus/) |
| 37 | زبابة شائعة | Sorex araneus | medium | زبابة | [Reference](https://animaldiversity.org/accounts/Sorex_araneus/) |
| 38 | خفاش بني كبير | Eptesicus fuscus | medium | خفاش، وطواط | [Reference](https://animaldiversity.org/accounts/Eptesicus_fuscus/) |
| 39 | قندس أمريكي | Castor canadensis | medium | قندس | [Reference](https://animaldiversity.org/accounts/Castor_canadensis/) |
| 40 | غوريلا غربية | Gorilla gorilla | medium | غوريلا | [Reference](https://animaldiversity.org/accounts/Gorilla_gorilla/) |
| 41 | تمساح النيل | Crocodylus niloticus | easy | تمساح | [Reference](https://animals.sandiegozoo.org/animals/crocodilian) |
| 42 | كوبرا مصرية | Naja haje | easy | كوبرا، أفعى، بوسكة | [Reference](https://animaldiversity.org/accounts/Naja_haje/classification/) |
| 43 | عنكبوت ذئبي | Lycosa tarantula | easy | عنكبوت، عناكب، رتيلة | [Reference](https://wsc.nmbe.ch/spec-data/26708/Lycosa_tarantula) |
| 44 | قنفذ أوروبي | Erinaceus europaeus | easy | قنفذ، كنفود، 9nfod | [Reference](https://animaldiversity.org/accounts/Erinaceus_europaeus/) |
| 45 | جمل عربي | Camelus dromedarius | easy | جمل، بعير، جمل بسنام واحد | [Reference](https://animaldiversity.org/accounts/Camelus_dromedarius/) |
| 46 | جمل ذو سنامين | Camelus bactrianus | medium | جمل بكتيري، جمل بسنامين | [Reference](https://animaldiversity.org/accounts/Camelus_bactrianus/) |
| 47 | نعامة | Struthio camelus | easy | نعامة إفريقية | [Reference](https://animaldiversity.org/accounts/Struthio_camelus/) |
| 48 | طوقان توكو | Ramphastos toco | medium | طوقان | [Reference](https://animaldiversity.org/accounts/Ramphastos_toco/) |
| 49 | أناكوندا خضراء | Eunectes murinus | medium | أناكوندا | [Reference](https://animaldiversity.org/accounts/Eunectes_murinus/) |
| 50 | وعل ألبي | Capra ibex | medium | وعل | [Reference](https://animaldiversity.org/accounts/Capra_ibex/) |
| 51 | ذبابة منزلية | Musca domestica | medium | ذبابة، دبانة، debana | [Reference](https://animaldiversity.org/accounts/Musca_domestica/) |
| 52 | أصلة إفريقية | Python sebae | medium | أصلة، ثعبان إفريقي، بيثون | [Reference](https://animaldiversity.org/accounts/Python_sebae/) |
| 53 | بفن أطلسي | Fratercula arctica | hard | بفن، ببغاء البحر | [Reference](https://animaldiversity.org/accounts/Fratercula_arctica/) |
| 54 | بطريق إمبراطوري | Aptenodytes forsteri | easy | بطريق | [Reference](https://animaldiversity.org/accounts/Aptenodytes_forsteri/) |
| 55 | فقمة الميناء | Phoca vitulina | medium | فقمة | [Reference](https://animaldiversity.org/accounts/Phoca_vitulina/) |
| 56 | دب قطبي | Ursus maritimus | medium | دب أبيض | [Reference](https://animaldiversity.org/accounts/Ursus_maritimus/) |
| 57 | فراشة ملكية | Danaus plexippus | easy | فراشة، فرتطو | [Reference](https://animaldiversity.org/accounts/Danaus_plexippus/) |
| 58 | نملة نارية حمراء | Solenopsis invicta | medium | نملة، نمل، nemla | [Reference](https://animaldiversity.org/accounts/Solenopsis_invicta/) |
| 59 | جرادة صحراوية | Schistocerca gregaria | medium | جراد، جرادة | [Reference](https://www.fao.org/crc/faqs/en) |
| 60 | فيل آسيوي | Elephas maximus | medium | فيل هندي | [Reference](https://animaldiversity.org/accounts/Elephas_maximus/) |
| 61 | ماعز منزلي | Capra hircus | easy | ماعز، عنزة، معزة | [Reference](https://animaldiversity.org/accounts/Capra_hircus/) |
| 62 | خنزير منزلي | Sus scrofa domesticus | easy | خنزير، حلوف | [Reference](https://animaldiversity.org/accounts/Sus_scrofa/) |
| 63 | إوزة رمادية | Anser anser | medium | إوزة، وزة | [Reference](https://animaldiversity.org/accounts/Anser_anser/) |
| 64 | ديك رومي | Meleagris gallopavo | medium | ديك رومي، بيبي، bibi | [Reference](https://animaldiversity.org/accounts/Meleagris_gallopavo/) |
| 65 | فأر منزلي | Mus musculus | easy | فأر، فار، far | [Reference](https://animaldiversity.org/accounts/Mus_musculus/) |
| 66 | سنجاب أحمر | Sciurus vulgaris | medium | سنجاب | [Reference](https://animaldiversity.org/accounts/Sciurus_vulgaris/) |
| 67 | هامستر ذهبي | Mesocricetus auratus | medium | هامستر | [Reference](https://animaldiversity.org/accounts/Mesocricetus_auratus/) |
| 68 | خنزير غينيا | Cavia porcellus | medium | كابياء، كوشون داند | [Reference](https://animaldiversity.org/accounts/Cavia_porcellus/) |
| 69 | باندا عملاقة | Ailuropoda melanoleuca | medium | باندا | [Reference](https://animaldiversity.org/accounts/Ailuropoda_melanoleuca/) |
| 70 | كوالا | Phascolarctos cinereus | medium | كوالا أسترالي | [Reference](https://animaldiversity.org/accounts/Phascolarctos_cinereus/) |
| 71 | كسلان ثلاثي الأصابع | Bradypus variegatus | medium | كسلان | [Reference](https://animaldiversity.org/accounts/Bradypus_variegatus/) |
| 72 | آكل النمل العملاق | Myrmecophaga tridactyla | medium | آكل النمل | [Reference](https://animaldiversity.org/accounts/Myrmecophaga_tridactyla/) |
| 73 | مدرع تساعي الأحزمة | Dasypus novemcinctus | medium | مدرع، أرماديلو | [Reference](https://animaldiversity.org/accounts/Dasypus_novemcinctus/) |
| 74 | بنغول صيني | Manis pentadactyla | hard | بنغول، آكل النمل الحرشفي | [Reference](https://animaldiversity.org/accounts/Manis_pentadactyla/) |
| 75 | خلد الماء | Ornithorhynchus anatinus | medium | منقار البط، بلاتيبوس | [Reference](https://animaldiversity.org/accounts/Ornithorhynchus_anatinus/) |
| 76 | نضناض قصير المنقار | Tachyglossus aculeatus | hard | نضناض، إيكيدنا | [Reference](https://animaldiversity.org/accounts/Tachyglossus_aculeatus/) |
| 77 | قضاعة أوروبية | Lutra lutra | medium | قضاعة، ثعلب الماء | [Reference](https://animaldiversity.org/accounts/Lutra_lutra/) |
| 78 | راكون | Procyon lotor | medium | راكون شائع | [Reference](https://animaldiversity.org/accounts/Procyon_lotor/) |
| 79 | ظربان مخطط | Mephitis mephitis | medium | ظربان | [Reference](https://animaldiversity.org/accounts/Mephitis_mephitis/) |
| 80 | سرقاط | Suricata suricatta | hard | ميركات، سرقاط | [Reference](https://animaldiversity.org/accounts/Suricata_suricatta/) |
| 81 | جاموس إفريقي | Syncerus caffer | medium | جاموس | [Reference](https://animaldiversity.org/accounts/Syncerus_caffer/) |
| 82 | بيسون أمريكي | Bison bison | hard | بيسون، ثور أمريكي | [Reference](https://animaldiversity.org/accounts/Bison_bison/) |
| 83 | رنة | Rangifer tarandus | medium | رنة، كاريبو | [Reference](https://animaldiversity.org/accounts/Rangifer_tarandus/) |
| 84 | غزال دوركاس | Gazella dorcas | medium | غزال | [Reference](https://animaldiversity.org/accounts/Gazella_dorcas/) |
| 85 | أوكابي | Okapia johnstoni | hard | أوكابي الغابة | [Reference](https://animaldiversity.org/accounts/Okapia_johnstoni/) |
| 86 | كابيبارا | Hydrochoerus hydrochaeris | hard | خنزير الماء | [Reference](https://animaldiversity.org/accounts/Hydrochoerus_hydrochaeris/) |
| 87 | نيص متوج | Hystrix cristata | hard | نيص، شيهم | [Reference](https://animaldiversity.org/accounts/Hystrix_cristata/) |
| 88 | ليمور حلقي الذيل | Lemur catta | hard | ليمور | [Reference](https://animaldiversity.org/accounts/Lemur_catta/) |
| 89 | إنسان الغاب البورنيوي | Pongo pygmaeus | hard | إنسان الغاب، أورانغوتان | [Reference](https://animaldiversity.org/accounts/Pongo_pygmaeus/) |
| 90 | شمبانزي | Pan troglodytes | medium | شمبانزي شائع | [Reference](https://animaldiversity.org/accounts/Pan_troglodytes/) |
| 91 | فلامنغو وردي | Phoenicopterus roseus | hard | نحام، فلامنغو | [Reference](https://animaldiversity.org/accounts/Phoenicopterus_roseus/) |
| 92 | بجع أبيض | Pelecanus onocrotalus | hard | بجع، بجع أبيض كبير | [Reference](https://animaldiversity.org/accounts/Pelecanus_onocrotalus/) |
| 93 | إيمو | Dromaius novaehollandiae | hard | إيمو أسترالي | [Reference](https://animaldiversity.org/accounts/Dromaius_novaehollandiae/) |
| 94 | كيوي بني | Apteryx australis | hard | كيوي | [Reference](https://animaldiversity.org/accounts/Apteryx_australis/) |
| 95 | طائر طنان | Archilochus colubris | hard | طنان، طنان ياقوتي الحنجرة | [Reference](https://animaldiversity.org/accounts/Archilochus_colubris/) |
| 96 | نقار خشب كبير | Dendrocopos major | hard | نقار الخشب | [Reference](https://www.rspb.org.uk/birds-and-wildlife/great-spotted-woodpecker) |
| 97 | رفراف شائع | Alcedo atthis | hard | رفراف، صياد السمك | [Reference](https://animaldiversity.org/accounts/Alcedo_atthis/) |
| 98 | قطرس جوال | Diomedea exulans | hard | قطرس | [Reference](https://animaldiversity.org/accounts/Diomedea_exulans/) |
| 99 | لقلق أبيض | Ciconia ciconia | hard | لقلق، بلارج | [Reference](https://animaldiversity.org/accounts/Ciconia_ciconia/) |
| 100 | هدهد | Upupa epops | hard | هدهد | [Reference](https://www.rspb.org.uk/birds-and-wildlife/hoopoe) |
| 101 | حرباء محجبة | Chamaeleo calyptratus | hard | حرباء، تاتا | [Reference](https://animaldiversity.org/accounts/Chamaeleo_calyptratus/) |
| 102 | إغوانا خضراء | Iguana iguana | hard | إغوانا | [Reference](https://animaldiversity.org/accounts/Iguana_iguana/) |
| 103 | وزغة فهدية | Eublepharis macularius | hard | وزغة، أبو بريص، بو بريص | [Reference](https://animaldiversity.org/accounts/Eublepharis_macularius/) |
| 104 | سمندل ناري | Salamandra salamandra | hard | سمندل | [Reference](https://animaldiversity.org/accounts/Salamandra_salamandra/) |
| 105 | أكسولوتل | Ambystoma mexicanum | hard | عفريت الماء، أكسولوتل مكسيكي | [Reference](https://animaldiversity.org/accounts/Ambystoma_mexicanum/) |
| 106 | فرس بحر | Hippocampus hippocampus | hard | حصان البحر، فرس بحر قصير الخطم | [Reference](https://www.theseahorsetrust.org/seahorse-facts/) |
| 107 | سمكة مهرج | Amphiprion ocellaris | hard | سمكة نيمو، نيمو | [Reference](https://animaldiversity.org/accounts/Amphiprion_ocellaris/) |
| 108 | شفنين مانتا | Manta birostris | hard | مانتا، شيطان البحر | [Reference](https://animaldiversity.org/accounts/Manta_birostris/) |
| 109 | قنديل القمر | Aurelia aurita | hard | قنديل البحر، قنديل | [Reference](https://animaldiversity.org/accounts/Aurelia_aurita/) |
| 110 | نجم بحر شائع | Asterias rubens | hard | نجم البحر | [Reference](https://animaldiversity.org/accounts/Asterias_rubens/) |
| 111 | سلطعون شاطئي | Carcinus maenas | hard | سلطعون، سرطان البحر | [Reference](https://animaldiversity.org/accounts/Carcinus_maenas/) |
| 112 | كركند أمريكي | Homarus americanus | hard | كركند، لوبستر | [Reference](https://animaldiversity.org/accounts/Homarus_americanus/) |
| 113 | حلزون حدائق | Cornu aspersum | hard | حلزون، ببوش، babbouch | [Reference](https://www.nhm.ac.uk/discover/snails-and-slugs.html) |
| 114 | دودة أرض | Lumbricus terrestris | hard | دودة، دودة التراب | [Reference](https://www.earthwormsoc.org.uk/earthworm-ecology) |
| 115 | نحلة عسل | Apis mellifera | easy | نحلة، نحل، ne7la | [Reference](https://animaldiversity.org/accounts/Apis_mellifera/) |
| 116 | دعسوقة سباعية النقط | Coccinella septempunctata | hard | دعسوقة، خنفساء منقطة | [Reference](https://animaldiversity.org/accounts/Coccinella_septempunctata/) |
| 117 | سرعوف أوروبي | Mantis religiosa | hard | سرعوف، فرس النبي | [Reference](https://www.bugguide.net/node/view/22947) |
| 118 | يعسوب إمبراطوري | Anax imperator | hard | يعسوب | [Reference](https://british-dragonflies.org.uk/species/emperor-dragonfly/) |
| 119 | حريش منزلي | Scutigera coleoptrata | hard | حريش، أم أربعة وأربعين | [Reference](https://animaldiversity.org/accounts/Scutigera_coleoptrata/) |
| 120 | دودة ألفية إفريقية | Archispirostreptus gigas | hard | دودة ألفية، ألفية الأرجل | [Reference](https://animals.sandiegozoo.org/animals/giant-african-millipede) |


## Live-prey feeding (`is_predator`)

For this yes/no game property, predation means documented deliberate feeding on
live animal prey in the species' natural diet, even opportunistically. It includes
insects, worms and zooplankton, and is independent of the primary-diet label. It
does not mean danger to humans, large prey, or that every individual hunts.
The Arabic question preview states this scope before the player confirms.
As with other catalogue facts, the values are simplified species-level cards,
not absolute claims about every exceptional observation or captive diet.

All 120 current records have an explicit boolean. Sources are the food-habit
references linked for each animal above. Examples: the griffon vulture is a
scavenger (false), while an omnivorous macaque eating animal prey is true.
Filter feeders consuming zooplankton count as true. The monarch butterfly,
honeybee, housefly and detritivorous millipede do not count as predators.
Additional references for easily misunderstood exceptions:

- [Western-gorilla insect feeding, original study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3967517/).
- [Red squirrel feeding, Woodland Trust](https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/animals/mammals/red-squirrel/).
- [Griffon vulture, Barcelona Zoo](https://zoobarcelona.cat/en/node/211).

No values or question predicates in the frozen v1 catalogue were modified.
