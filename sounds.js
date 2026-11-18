/* Sonidos difíciles para hispanohablantes.
   pairs: [palabraA, significadoA, palabraB, significadoB] → pares mínimos (solo cambia el sonido trabajado).
   words: palabras sueltas para repetir · phrases: frases para repetir/grabar. */
window.SOUNDS = [
  {
    id: 'u-ou', title: 'u / ou', sub: 'rue ≠ roue',
    tip: `<p><b>ou</b> = la «u» española, con los labios redondeados y hacia delante: <i>vous, tout, rouge</i>.</p>
      <p><b>u</b> no existe en español. <b>Truco:</b> di «iiii» largo y, <b>sin mover la lengua</b>, redondea los labios como para silbar. La punta de la lengua sigue tocando los dientes de abajo.</p>
      <p class="warn">⚠️ Error típico: decir «u» española en <i>rue</i>, y entonces se oye <i>roue</i> (rueda en vez de calle). Igual con <i>dessus</i> (encima) → <i>dessous</i> (debajo).</p>`,
    pairs: [['rue', 'calle', 'roue', 'rueda'], ['tu', 'tú', 'tout', 'todo'], ['dessus', 'encima', 'dessous', 'debajo'], ['vu', 'visto', 'vous', 'vosotros/usted'],
      ['pur', 'puro', 'pour', 'para'], ['su', 'sabido', 'sous', 'bajo'], ['lu', 'leído', 'loup', 'lobo'], ['russe', 'ruso', 'rousse', 'pelirroja']],
    words: ['bus', 'sûr', 'jupe', 'musique', 'bouche', 'jour', 'nourriture', 'tu voudrais'],
    phrases: ['Je suis sûr que tout est sous le bureau.', 'Tu as vu la roue dans la rue ?'],
  },
  {
    id: 'e-e', title: 'e muda / é', sub: 'le ≠ les',
    tip: `<p><b>e muda</b> (<i>le, de, ce, me, je</i>): sonido relajado, con los labios ligeramente redondeados, parecido a «eu». No es la «e» española.</p>
      <p><b>é</b> (<i>les, des, ces, et, -er, -ez</i>): una «e» más cerrada y tensa que la española, con los labios estirados como sonriendo.</p>
      <p class="warn">⚠️ Si dices <i>le</i> con «e» española, suena casi a <i>les</i>: se confunde singular y plural (<i>le livre / les livres</i>).</p>
      <p>En conversación la e muda muchas veces desaparece: <i>samedi</i> → «sam'di», <i>petit</i> → «p'tit», <i>je ne sais pas</i> → «j'sais pas».</p>`,
    pairs: [['le', 'el', 'les', 'los'], ['de', 'de', 'des', 'unos/de los'], ['ce', 'este', 'ces', 'estos'], ['me', 'me', 'mes', 'mis'],
      ['te', 'te', 'tes', 'tus'], ['je fais', 'hago', "j'ai fait", 'he hecho']],
    words: ['premier', 'regarder', 'demain', 'cheveu', 'été', 'café', 'parlez', 'samedi'],
    phrases: ['Le café et les gâteaux.', 'Je te le demande demain.'],
  },
  {
    id: 'e-ai', title: 'é / è', sub: 'été ≠ était',
    tip: `<p><b>è</b> (<i>mère, fête, lait, -ais, -ait, est</i>): más abierta que la «e» española. Abre más la boca, como en «perro».</p>
      <p><b>é</b>: más cerrada y tensa, con los labios estirados.</p>
      <p>Sirve para distinguir <i>parlé</i> (hablado) de <i>parlait</i> (hablaba), o <i>j'irai</i> (iré) de <i>j'irais</i> (iría).</p>
      <p class="muted">ℹ️ No todos los nativos hacen esta distinción al final de palabra; varía según la región. Si no te sale perfecta, el contexto suele aclararlo. Aun así, conviene oírla.</p>`,
    pairs: [['les', 'los', 'lait', 'leche'], ['été', 'verano / sido', 'était', 'era/estaba'], ['parlé', 'hablado', 'parlait', 'hablaba'],
      ['fée', 'hada', 'fait', 'hecho'], ["j'irai", 'iré', "j'irais", 'iría']],
    words: ['mère', 'frère', 'fête', 'tête', 'merci', 'année', 'clé', 'chez'],
    phrases: ['Mon père était très fatigué.', "L'été dernier, il faisait chaud."],
  },
  {
    id: 'eu', title: 'eu / œu', sub: 'deux ≠ doux',
    tip: `<p><b>eu cerrado</b> (<i>deux, peu, bleu, ceux, -euse</i>): <b>truco:</b> di «é» y, sin mover la lengua, redondea los labios.</p>
      <p><b>eu abierto</b> (<i>peur, heure, jeune, sœur, seul</i>): di «è» (más abierta) y redondea los labios.</p>
      <p class="warn">⚠️ Errores típicos: decir «u» (<i>deux</i> → <i>doux</i>) o «e» española (<i>ceux</i> → <i>ces</i>).</p>`,
    pairs: [['deux', 'dos', 'doux', 'suave'], ['peu', 'poco', 'pou', 'piojo'], ['feu', 'fuego', 'fou', 'loco'], ['ceux', 'aquellos', 'ces', 'estos'],
      ['jeune', 'joven', 'jaune', 'amarillo'], ['seul', 'solo', 'sol', 'suelo']],
    words: ['bleu', 'cheveux', 'heureux', 'sœur', 'cœur', 'fleur', 'neuf', 'déjeuner'],
    phrases: ['Il pleut un peu.', 'Ma sœur a peur du feu.'],
  },
  {
    id: 'an-on', title: 'an / on', sub: 'vent ≠ vont',
    tip: `<p>En las vocales nasales el aire sale <b>también por la nariz</b>, y <b>la «n» no se pronuncia</b>. La lengua no toca el paladar al final.</p>
      <p><b>an / en / am / em</b> (<i>enfant, temps, chambre</i>): boca abierta, como para una «a» grave, y nasaliza.</p>
      <p><b>on / om</b> (<i>bon, nom, monde</i>): labios redondeados y bastante cerrados, casi como para una «o» o una «u», y nasaliza.</p>
      <p><b>Truco:</b> mantén la vocal larga («aaan…») y tápate la nariz un momento. Si el sonido cambia, estás nasalizando bien. Si al final notas la lengua tocando arriba, estás diciendo una «n» española.</p>`,
    pairs: [['vent', 'viento', 'vont', 'van'], ['sans', 'sin', 'son', 'sonido / su'], ['temps', 'tiempo', 'thon', 'atún'], ['lent', 'lento', 'long', 'largo'],
      ['blanc', 'blanco', 'blond', 'rubio'], ['banc', 'banco', 'bon', 'bueno']],
    words: ['enfant', 'maman', 'chambre', 'longtemps', 'monde', 'nombre', 'pantalon', 'comment'],
    phrases: ['Mon oncle a quarante ans.', 'On attend le bon moment.'],
  },
  {
    id: 'in-an', title: 'in / an', sub: 'vin ≠ vent',
    tip: `<p><b>in / ain / ein / im</b> (<i>vin, pain, plein, impossible</i>): parte de una «è» abierta, con los labios estirados, y nasaliza. No es «i» + n.</p>
      <p><b>un</b> (<i>un, brun, lundi</i>): hoy la mayoría de francófonos lo pronuncian igual que <i>in</i>. En algunas zonas francófonas se mantiene un poco distinto. Las dos formas se entienden.</p>
      <p class="warn">⚠️ Error típico: decir «vin» como en español, con «i» y «n». Se oye raro, y puede sonar a <i>vigne</i> o a <i>vent</i>.</p>`,
    pairs: [['vin', 'vino', 'vent', 'viento'], ['plein', 'lleno', 'plan', 'plano / plan'], ['teint', 'tez', 'temps', 'tiempo'],
      ['frein', 'freno', 'franc', 'franco'], ['main', 'mano', 'ment', 'miente']],
    words: ['pain', 'demain', 'matin', 'cinq', 'jardin', 'faim', 'lundi', 'important'],
    phrases: ['Un bon vin blanc.', "Demain matin, j'ai rendez-vous."],
  },
  {
    id: 'nasal-n', title: 'bon / bonne', sub: 'nasal ≠ vocal + n',
    tip: `<p>Si detrás de la n/m viene una <b>vocal</b> o una <b>n/m doble</b>, la vocal deja de ser nasal y la «n» <b>sí suena</b>: <i>bon</i> [bõ] → <i>bonne</i> [bonn].</p>
      <p>Por eso cambian tantos masculinos y femeninos: <i>italien / italienne, américain / américaine, plein / pleine</i>.</p>
      <p class="warn">⚠️ Error típico: pronunciar la «n» en el masculino (<i>bon</i> como «bón»). La n solo suena en la forma con vocal detrás.</p>`,
    pairs: [['bon', 'bueno', 'bonne', 'buena'], ['fin', 'fino / fin', 'fine', 'fina'], ['plein', 'lleno', 'pleine', 'llena'], ['un', 'un', 'une', 'una'],
      ['italien', 'italiano', 'italienne', 'italiana'], ['américain', 'americano', 'américaine', 'americana']],
    words: ['ancien', 'ancienne', 'cousin', 'cousine', 'voisin', 'voisine', 'lion', 'lionne'],
    phrases: ['Une bonne amie italienne.', "C'est un bon ami américain."],
  },
  {
    id: 'r', title: 'R francesa', sub: 'gros, très, rouge',
    tip: `<p>La R francesa <b>se hace en la garganta</b>. La parte de atrás de la lengua se acerca a la campanilla, y la punta se queda abajo, detrás de los dientes inferiores. <b>La punta nunca vibra.</b></p>
      <p><b>Truco desde el español:</b> di «ja» con la jota española, hazla más suave y añade voz (que vibren las cuerdas vocales). Es como hacer gárgaras sin agua.</p>
      <p><b>gr / tr / cr / fr:</b> haz la g/t/c/f y pasa directa a la garganta, sin meter ninguna vocal: <i>gros</i>, no «guerós». Practica despacio: «g… rrr… os».</p>
      <p>A final de palabra (<i>mer, partir, toujours</i>) suena muy suave, casi un soplo.</p>`,
    pairs: [],
    words: ['rue', 'rouge', 'Paris', 'très', 'gros', 'trois', 'grand', 'frère', 'prendre', 'quatre', 'arbre', 'merci', 'offrir', 'toujours', 'heureux'],
    phrases: ['Trois gros rats gris.', 'Il fait très froid à Paris.', 'Mon frère prend le train.', 'Je voudrais une chambre pour quatre.'],
  },
  {
    id: 'b-v', title: 'b / v', sub: 'boire ≠ voir',
    tip: `<p>En español «b» y «v» suenan igual; en francés <b>son distintas</b>.</p>
      <p><b>v:</b> los dientes de arriba se apoyan en el labio de abajo, con vibración (como una «f» con voz): <i>vous, ville, avoir</i>.</p>
      <p><b>b:</b> los dos labios se juntan y «explotan», <b>también entre vocales</b>. No es la b suave del español de <i>lobo</i>.</p>
      <p class="warn">⚠️ Si dices <i>voir</i> con b, se oye <i>boire</i>: «ver» y «beber».</p>`,
    pairs: [['boire', 'beber', 'voir', 'ver'], ['bol', 'tazón', 'vol', 'vuelo / robo'], ['bain', 'baño', 'vin', 'vino'], ['beau', 'bonito', 'veau', 'ternera'],
      ['base', 'base', 'vase', 'jarrón'], ['bon', 'bueno', 'vont', 'van']],
    words: ['avoir', 'travail', 'vélo', 'bureau', 'ville', 'bien', 'vraiment', 'élève'],
    phrases: ['Je voudrais boire un verre de vin.', 'Il va au bureau à vélo.'],
  },
  {
    id: 's-z', title: 's / z', sub: 'poisson ≠ poison',
    tip: `<p>El español casi no tiene sonido <b>z</b> (como el zumbido de una abeja, «zzzz», con voz). En francés es muy frecuente.</p>
      <p><b>Una s entre vocales suena z:</b> <i>maison, rose, cousin</i>. <b>ss</b> suena s: <i>poisson, dessert</i>.</p>
      <p>En la <i>liaison</i>, s y x suenan z: <i>les‿amis</i> = «lezami», <i>ils‿ont</i> = «ilzon», que no es lo mismo que <i>ils sont</i> = «ilson».</p>
      <p class="warn">⚠️ <i>poison</i> = veneno, <i>poisson</i> = pez. <i>désert</i> = desierto, <i>dessert</i> = postre.</p>`,
    pairs: [['poisson', 'pez', 'poison', 'veneno'], ['dessert', 'postre', 'désert', 'desierto'], ['coussin', 'cojín', 'cousin', 'primo'],
      ['basse', 'baja', 'base', 'base'], ['ils sont', 'son/están', 'ils ont', 'tienen'], ['nous savons', 'sabemos', 'nous avons', 'tenemos']],
    words: ['maison', 'rose', 'zéro', 'douze', 'chose', 'magasin', 'les amis', 'deux heures'],
    phrases: ['Mes amis aiment le dessert.', 'Les enfants ont douze ans.'],
  },
  {
    id: 'ch-j', title: 'ch / j', sub: 'chou ≠ joue',
    tip: `<p><b>ch</b> = «sh», como cuando pides silencio: <i>chat</i> = «sha». No es la «ch» española (<i>chico</i>).</p>
      <p><b>j</b> y <b>g + e/i</b> = el mismo sonido pero con voz, parecido a la «y» rioplatense («yo» en Buenos Aires): <i>je, jour, rouge, gens</i>.</p>
      <p class="warn">⚠️ Errores típicos: «ch» española en <i>chercher</i>, y «j» o «y» españolas en <i>je</i>.</p>`,
    pairs: [['chou', 'col', 'joue', 'mejilla / juega'], ['cache', 'escondo', 'cage', 'jaula'], ['bouche', 'boca', 'bouge', 'mueve'],
      ['chant', 'canto', 'gens', 'gente'], ['hache', 'hacha', 'âge', 'edad']],
    words: ['chercher', 'chaise', 'dimanche', 'jamais', 'manger', 'voyage', 'génial', 'déjà'],
    phrases: ['Le chat joue dans le jardin.', 'Je cherche mon chargeur.'],
  },
  {
    id: 'finales', title: 'Letras finales', sub: 'petit ≠ petite',
    tip: `<p>La mayoría de las <b>consonantes finales no se pronuncian</b>: <i>petit, grand, vert, trop, beaucoup, ils parlent</i>. La terminación verbal <i>-ent</i> es muda.</p>
      <p>Cuando hay una <b>-e final</b> (por ejemplo en el femenino), la consonante <b>sí suena</b>: <i>petit</i> [peti] → <i>petite</i> [petit].</p>
      <p>Excepciones frecuentes: c, r, f, l finales suelen sonar (<i>sac, mer, neuf, sel</i>), pero no la r de los infinitivos en <i>-er</i> (<i>parler</i>).</p>
      <p class="muted">ℹ️ <i>il parle</i> e <i>ils parlent</i> suenan igual.</p>`,
    pairs: [['petit', 'pequeño', 'petite', 'pequeña'], ['grand', 'grande (m.)', 'grande', 'grande (f.)'], ['vert', 'verde (m.)', 'verte', 'verde (f.)'],
      ['gris', 'gris (m.)', 'grise', 'gris (f.)'], ['chaud', 'caliente (m.)', 'chaude', 'caliente (f.)'], ['froid', 'frío', 'froide', 'fría']],
    words: ['beaucoup', 'trop', 'toujours', 'ils mangent', 'parler', 'avec', 'neuf', 'mer'],
    phrases: ['Il est grand, elle est grande.', 'Les petits enfants parlent beaucoup.'],
  },
];

/* Formas que el reconocimiento de voz puede escribir para la misma pronunciación (homófonos, números…). */
window.SOUND_HOMOPHONES = {
  'vent': ['vend', 'vends', 'van', 'vents'], 'vont': ['von'], 'vin': ['vingt', 'vain', 'vins', '20'], 'sans': ['sang', 'cent', 'sent', "s'en", '100'],
  'son': ['sont'], 'temps': ['tant', 'tend', 'tends', 'taon'], 'thon': ['ton', 'tond', 'tonds'], 'lent': ['lents'], 'long': ['longs'],
  'banc': ['bans', 'ban'], 'bon': ['bond', 'bons'], 'plan': ['plant', 'plans'], 'teint': ['tin', 'thym', 'tint'], 'franc': ['francs'],
  'main': ['mains'], 'ment': ['mens', 'mans'], 'rue': ['rues'], 'roue': ['roues'], 'tu': ['tue', 'tus', 'tut'], 'tout': ['tous', 'toux'],
  'vu': ['vue', 'vus', 'vues'], 'vous': [], 'pur': ['pure', 'purs'], 'pour': [], 'su': ['sue', 'sus', 'sût'], 'sous': ['sou'], 'lu': ['lue', 'lus'],
  'loup': ['loue', 'loups'], 'russe': ['russes'], 'rousse': ['rousses', 'rouce'], 'le': [], 'les': ['l\'ai', 'lé'], 'de': [], 'des': ['dès', 'dé', 'dés'],
  'ce': ['se'], 'ces': ['ses', "c'est", "s'est", 'sait', 'sais'], 'me': [], 'mes': ['mais', 'met', 'mets', 'mai'], 'te': [], 'tes': ['taie', "t'es", 'thé'],
  'lait': ['laid', 'laie'], 'été': ['étés'], 'était': ['étais', 'étaient'], 'parlé': ['parler', 'parlez'],
  'parlait': ['parlais', 'parlaient'], 'fée': ['fées'], 'fait': ['fais', 'faix'], "j'irai": [], "j'irais": ["j'irait"],
  'deux': ['2'], 'doux': ['douce'], 'peu': ['peut', 'peux'], 'pou': ['poux', 'pouls'], 'feu': ['feux'], 'fou': ['fous'], 'ceux': [],
  'jeune': ['jeûne', 'jeunes'], 'jaune': ['jaunes'], 'seul': ['seule', 'seuls', 'seules'], 'sol': ['sole', 'saule', 'sols'],
  'blanc': ['blancs'], 'blond': ['blonds'], 'plein': ['plains', 'plaint', 'pleins'], 'frein': ['freins'], 'bonne': ['bonnes'], 'fin': ['faim', 'feint'],
  'fine': ['fines'], 'pleine': ['plaine', 'pleines'], 'un': ['1', 'hein'], 'une': [], 'boire': [], 'voir': ['voire'], 'bol': ['bols'], 'vol': ['vole', 'voles', 'vols'],
  'bain': ['bains', 'bins'], 'beau': ['bot', 'baux', 'beaux'], 'veau': ['vos', 'vaut', 'veaux', 'vau'], 'poisson': ['poissons'], 'poison': ['poisons'],
  'dessert': ['desserts', 'dessers'], 'désert': ['déserts'], 'coussin': ['coussins'], 'cousin': ['cousins'], 'basse': ['basses'], 'chou': ['choux'],
  'joue': ['joues', 'joug'], 'cache': ['caches'], 'cage': ['cages'], 'bouche': ['bouches'], 'bouge': ['bouges'], 'chant': ['champ', 'chants', 'champs'],
  'gens': ['jean'], 'hache': ['haches'], 'âge': ['ages', 'âges'], 'petit': ['petits'], 'petite': ['petites'], 'grand': ['grands'], 'grande': ['grandes'],
  'vert': ['verre', 'vers', 'ver', 'verts', 'vair'], 'verte': ['vertes'], 'gris': [], 'grise': ['grises'], 'chaud': ['chaux', 'show', 'chauds'],
  'chaude': ['chaudes'], 'froid': ['froids'], 'froide': ['froides'], 'cinq': ['5'], 'trois': ['3'], 'quatre': ['4'], 'neuf': ['9'], 'douze': ['12'], 'zéro': ['0'],
  'mer': ['mère', 'maire'], 'mère': ['mer', 'maire'], 'clé': ['clef'], 'italien': ['italiens'], 'italienne': ['italiennes'],
  'américain': ['américains'], 'américaine': ['américaines'], 'je fais': ['je fait'], "j'ai fait": ['j\'ai fais', 'gay fait'],
};
