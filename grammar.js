// Grammar reference shown in the "Gramática" tab. Each section: id, group, title, html (Spanish explanations, French examples).
window.GRAMMAR = [
{ id: 'present', level: 'B1', group: 'Tiempos verbales', title: 'Présent', html: `
<p>Tres grupos según el infinitivo. Quita la terminación y añade:</p>
<table><tr><th></th><th>-er (parler)</th><th>-ir con -iss- (finir)</th><th>-re (vendre)</th></tr>
<tr><td>je</td><td>parl<b>e</b></td><td>fin<b>is</b></td><td>vend<b>s</b></td></tr>
<tr><td>tu</td><td>parl<b>es</b></td><td>fin<b>is</b></td><td>vend<b>s</b></td></tr>
<tr><td>il/elle/on</td><td>parl<b>e</b></td><td>fin<b>it</b></td><td>vend</td></tr>
<tr><td>nous</td><td>parl<b>ons</b></td><td>fin<b>issons</b></td><td>vend<b>ons</b></td></tr>
<tr><td>vous</td><td>parl<b>ez</b></td><td>fin<b>issez</b></td><td>vend<b>ez</b></td></tr>
<tr><td>ils/elles</td><td>parl<b>ent</b></td><td>fin<b>issent</b></td><td>vend<b>ent</b></td></tr></table>
<p><b>Irregulares imprescindibles</b></p>
<table><tr><th></th><th>être</th><th>avoir</th><th>aller</th><th>faire</th></tr>
<tr><td>je</td><td>suis</td><td>ai</td><td>vais</td><td>fais</td></tr>
<tr><td>tu</td><td>es</td><td>as</td><td>vas</td><td>fais</td></tr>
<tr><td>il</td><td>est</td><td>a</td><td>va</td><td>fait</td></tr>
<tr><td>nous</td><td>sommes</td><td>avons</td><td>allons</td><td>faisons</td></tr>
<tr><td>vous</td><td>êtes</td><td>avez</td><td>allez</td><td>faites</td></tr>
<tr><td>ils</td><td>sont</td><td>ont</td><td>vont</td><td>font</td></tr></table>
<table><tr><th></th><th>pouvoir</th><th>vouloir</th><th>devoir</th><th>venir</th><th>prendre</th></tr>
<tr><td>je</td><td>peux</td><td>veux</td><td>dois</td><td>viens</td><td>prends</td></tr>
<tr><td>nous</td><td>pouvons</td><td>voulons</td><td>devons</td><td>venons</td><td>prenons</td></tr>
<tr><td>ils</td><td>peuvent</td><td>veulent</td><td>doivent</td><td>viennent</td><td>prennent</td></tr></table>
<div class="tip">⚠️ Para una acción que dura hasta ahora se usa el presente: <i>J'habite ici <b>depuis</b> deux ans</i> = llevo dos años viviendo aquí.</div>` },

{ id: 'pc', level: 'B1', group: 'Tiempos verbales', title: 'Passé composé', html: `
<p><b>avoir / être</b> en presente + <b>participio</b>. Es el pasado de las acciones terminadas (equivale al indefinido y al perfecto españoles).</p>
<p><b>Participios:</b> -er → <b>-é</b> (parlé) · -ir → <b>-i</b> (fini) · -re → <b>-u</b> (vendu)</p>
<p><b>Irregulares frecuentes:</b> être → été · avoir → eu · faire → fait · dire → dit · écrire → écrit · prendre → pris · mettre → mis · voir → vu · venir → venu · savoir → su · pouvoir → pu · vouloir → voulu · devoir → dû · lire → lu · boire → bu · ouvrir → ouvert · naître → né · mourir → mort</p>
<p><b>Con être</b> (y el participio concuerda con el sujeto):</p>
<ul><li>Los verbos de movimiento/cambio de estado: <i>aller, venir, arriver, partir, entrer, sortir, monter, descendre, naître, mourir, rester, tomber, retourner, passer</i> y sus derivados (revenir, devenir, rentrer…).</li>
<li><b>Todos los pronominales:</b> <i>je me suis levée, nous nous sommes trompés</i>.</li></ul>
<p class="ex">Elle <b>est arrivée</b> hier. · Nous <b>avons fini</b> le rapport. · Je <b>me suis inscrite</b> au cours.</p>
<div class="tip">⚠️ <i>sortir, monter, descendre, passer, rentrer, retourner</i> van con <b>avoir</b> si llevan COD: <i>J'<b>ai</b> sorti la poubelle</i> / <i>Je <b>suis</b> sortie</i>.</div>` },

{ id: 'accord', level: 'B1-B2', group: 'Tiempos verbales', title: 'Concordancia del participio', html: `
<table><tr><th>Auxiliar</th><th>Concuerda con…</th><th>Ejemplo</th></tr>
<tr><td>être</td><td>el sujeto</td><td>Elles sont part<b>ies</b>.</td></tr>
<tr><td>avoir</td><td>el COD <b>solo si va antes</b> del verbo</td><td>Les clés ? Je <b>les</b> ai perdu<b>es</b>. · La lettre <b>que</b> j'ai écrit<b>e</b>.</td></tr>
<tr><td>avoir</td><td>nada si el COD va después</td><td>J'ai perdu les clés.</td></tr>
<tr><td>pronominal</td><td>el pronombre si es COD</td><td>Elle s'est lavé<b>e</b>. · Elle s'est lavé les mains (COD = les mains → sin concordancia).</td></tr></table>
<div class="tip">💡 <i>Je m'en suis rendu compte</i>: « rendu » no concuerda porque el COD es « compte ».</div>` },

{ id: 'imparfait', level: 'B1', group: 'Tiempos verbales', title: 'Imparfait', html: `
<p>Raíz de <b>nous</b> en presente sin <i>-ons</i> + <b>-ais, -ais, -ait, -ions, -iez, -aient</b>.</p>
<p class="ex">nous fais<s>ons</s> → je fais<b>ais</b> · nous finiss<s>ons</s> → je finiss<b>ais</b> · nous pren<s>ons</s> → je pren<b>ais</b></p>
<p>Única excepción: <b>être → ét-</b> (j'étais, nous étions).</p>
<p><b>Uso (como el imperfecto español):</b> descripciones, costumbres, acciones en curso en el pasado.</p>
<p class="ex">Quand j'<b>étais</b> petite, j'<b>allais</b> à la plage. Il <b>pleuvait</b> quand je <b>suis sortie</b>.</p>
<div class="tip">💡 Imparfait = el decorado; passé composé = lo que pasa.</div>` },

{ id: 'pqp', level: 'B1', group: 'Tiempos verbales', title: 'Plus-que-parfait', html: `
<p><b>avoir / être</b> en imparfait + participio = pluscuamperfecto (« había hecho »).</p>
<p class="ex">J'<b>avais</b> déjà <b>mangé</b> quand il est arrivé. · Elle <b>était partie</b>.</p>
<p>Se usa también tras <b>si</b> para hipótesis en el pasado (ver « Frases con si »).</p>` },

{ id: 'futur', level: 'B1', group: 'Tiempos verbales', title: 'Futur simple y futur proche', html: `
<p><b>Futur simple:</b> infinitivo + <b>-ai, -as, -a, -ons, -ez, -ont</b>. Los verbos en -re pierden la <i>e</i> (prendre → je prendr<b>ai</b>).</p>
<table><tr><th>Raíz irregular</th><th></th><th></th><th></th></tr>
<tr><td>être → <b>ser-</b></td><td>avoir → <b>aur-</b></td><td>aller → <b>ir-</b></td><td>faire → <b>fer-</b></td></tr>
<tr><td>pouvoir → <b>pourr-</b></td><td>vouloir → <b>voudr-</b></td><td>devoir → <b>devr-</b></td><td>savoir → <b>saur-</b></td></tr>
<tr><td>venir → <b>viendr-</b></td><td>voir → <b>verr-</b></td><td>envoyer → <b>enverr-</b></td><td>falloir → <b>faudr-</b></td></tr></table>
<p><b>Futur proche:</b> <i>aller</i> en presente + infinitivo: <i>Je <b>vais partir</b></i> (voy a salir).</p>
<div class="tip">⚠️ Tras <b>quand, dès que, lorsque, aussitôt que</b> se usa futuro, no subjuntivo: <i>Quand je <b>serai</b> à Paris, je t'appellerai</i> (cuando esté).</div>` },

{ id: 'futant', level: 'B2', group: 'Tiempos verbales', title: 'Futur antérieur', html: `
<p><b>avoir / être</b> en futuro + participio = « habré hecho ».</p>
<p class="ex">Je t'appellerai dès que j'<b>aurai fini</b>. (en cuanto termine) · Elle <b>sera partie</b> avant midi.</p>` },

{ id: 'cond', level: 'B1-B2', group: 'Tiempos verbales', title: 'Conditionnel (présent y passé)', html: `
<p><b>Présent:</b> raíz del futuro + terminaciones del imparfait (<b>-ais, -ais, -ait, -ions, -iez, -aient</b>).</p>
<p class="ex">je parler<b>ais</b> · je ser<b>ais</b> · j'aur<b>ais</b> · je pourr<b>ais</b> · je voudr<b>ais</b></p>
<p><b>Passé:</b> avoir/être en condicional + participio: <i>j'<b>aurais aimé</b></i>, <i>elle <b>serait venue</b></i>.</p>
<p><b>Usos:</b> cortesía (<i>Pourriez-vous… ?</i>), consejo (<i>Tu devrais…</i>), reproche (<i>Tu aurais dû me le dire</i>), hipótesis, información no confirmada (<i>Le ministre aurait démissionné</i> = al parecer ha dimitido).</p>` },

{ id: 'si', level: 'B1-B2', group: 'Tiempos verbales', title: 'Frases con si', html: `
<table><tr><th>Tipo</th><th>si + …</th><th>principal</th><th>Ejemplo</th></tr>
<tr><td>Real</td><td>présent</td><td>présent / futur / impératif</td><td>Si tu viens, on ira au cinéma.</td></tr>
<tr><td>Hipótesis</td><td>imparfait</td><td>conditionnel présent</td><td>Si j'avais le temps, je voyagerais.</td></tr>
<tr><td>Pasado irreal</td><td>plus-que-parfait</td><td>conditionnel passé</td><td>Si j'avais su, je ne serais pas venue.</td></tr></table>
<div class="tip">⚠️ Nunca condicional ni subjuntivo detrás de <b>si</b>: ❌ <i>Si j'aurais…</i> · ❌ <i>Si je sois…</i></div>` },

{ id: 'subj', level: 'B2', group: 'Tiempos verbales', title: 'Subjonctif présent', html: `
<p>Raíz de <b>ils</b> en presente sin <i>-ent</i> + <b>-e, -es, -e, -ions, -iez, -ent</b>.</p>
<p class="ex">ils parl<s>ent</s> → que je parl<b>e</b> · ils finiss<s>ent</s> → que je finiss<b>e</b> · ils prenn<s>ent</s> → que je prenn<b>e</b> (pero nous pren<b>ions</b>)</p>
<table><tr><th></th><th>être</th><th>avoir</th><th>aller</th><th>faire</th><th>pouvoir</th><th>savoir</th><th>vouloir</th></tr>
<tr><td>que je</td><td>sois</td><td>aie</td><td>aille</td><td>fasse</td><td>puisse</td><td>sache</td><td>veuille</td></tr>
<tr><td>qu'il</td><td>soit</td><td>ait</td><td>aille</td><td>fasse</td><td>puisse</td><td>sache</td><td>veuille</td></tr>
<tr><td>que nous</td><td>soyons</td><td>ayons</td><td>allions</td><td>fassions</td><td>puissions</td><td>sachions</td><td>voulions</td></tr>
<tr><td>qu'ils</td><td>soient</td><td>aient</td><td>aillent</td><td>fassent</td><td>puissent</td><td>sachent</td><td>veuillent</td></tr></table>
<p><b>Se usa tras:</b> <i>il faut que, vouloir que, aimer que, préférer que</i> · sentimientos (<i>je suis content que, j'ai peur que, c'est dommage que</i>) · duda y opinión negativa (<i>je doute que, je ne pense pas que</i>) · <i>bien que, pour que, avant que, à moins que, pourvu que, sans que</i>.</p>
<p><b>No se usa tras:</b> <i>espérer que, penser que / croire que</i> (afirmativos), <i>après que, parce que, pendant que, quand, si</i> → indicativo.</p>
<p><b>Subjonctif passé:</b> <i>que j'<b>aie fini</b>, qu'elle <b>soit venue</b></i>: <i>Je suis contente que tu <b>sois venu</b></i>.</p>
<div class="tip">⚠️ Diferencia con el español: el francés usa el subjuntivo <b>presente</b> donde el español usa el imperfecto: <i>No me extrañaría que llegara tarde</i> → <i>Ça ne m'étonnerait pas qu'il <b>arrive</b> en retard</i>.</div>` },

{ id: 'imper', level: 'B1', group: 'Tiempos verbales', title: 'Impératif', html: `
<p>Formas de <b>tu, nous, vous</b> del presente, sin sujeto.</p>
<p class="ex">Finis ! · Prenons le train. · Venez !</p>
<p>Los verbos en <b>-er</b> (y <i>aller</i>) pierden la <b>-s</b> en <i>tu</i>: <i>Parle ! Va !</i> … salvo delante de <b>en / y</b>: <i>Vas-y ! Parles-en !</i></p>
<p><b>Irregulares:</b> être → sois, soyons, soyez · avoir → aie, ayons, ayez · savoir → sache, sachons, sachez · vouloir → veuillez (<i>Veuillez trouver ci-joint…</i>)</p>
<p><b>Pronombres:</b> en afirmativo van detrás con guion (<i>Dis-<b>le-moi</b></i>); en negativo, delante (<i>Ne <b>me le</b> dis pas</i>).</p>` },

{ id: 'gerond', level: 'B2', group: 'Tiempos verbales', title: 'Gérondif y participe présent', html: `
<p>Raíz de <b>nous</b> sin <i>-ons</i> + <b>-ant</b>. Gérondif = <b>en</b> + participe présent.</p>
<p class="ex">nous fais<s>ons</s> → faisant → <b>en faisant</b> · Irregulares: étant, ayant, sachant</p>
<p><b>Gérondif</b> = simultaneidad o manera (mismo sujeto): <i>Je travaille <b>en écoutant</b> de la musique</i>. <i>C'est <b>en forgeant</b> qu'on devient forgeron.</i></p>` },

{ id: 'ps', level: 'B2', group: 'Tiempos verbales', title: 'Passé simple (para reconocerlo)', html: `
<p>Tiempo literario y de la prensa escrita; no hace falta usarlo al hablar, solo reconocerlo.</p>
<table><tr><th></th><th>-er (parler)</th><th>-ir / -re (finir, prendre)</th><th>en -u (vouloir)</th></tr>
<tr><td>il</td><td>parl<b>a</b></td><td>fin<b>it</b> / pr<b>it</b></td><td>voul<b>ut</b></td></tr>
<tr><td>ils</td><td>parl<b>èrent</b></td><td>fin<b>irent</b> / pr<b>irent</b></td><td>voul<b>urent</b></td></tr></table>
<p class="ex">Frecuentes: il <b>fut</b> (être) · il <b>eut</b> (avoir) · il <b>fit</b> (faire) · il <b>vint</b> (venir) · il <b>dit</b> · il <b>vit</b> (voir)</p>` },

{ id: 'pronoms', level: 'B1-B2', group: 'Pronombres', title: 'Pronombres COD, COI, en, y', html: `
<table><tr><th>COD</th><th>COI (à + persona)</th></tr>
<tr><td>me, te, <b>le, la</b>, nous, vous, <b>les</b></td><td>me, te, <b>lui</b>, nous, vous, <b>leur</b></td></tr></table>
<p><b>en</b> sustituye a <i>de</i> + cosa, partitivos y cantidades: <i>J'<b>en</b> ai besoin. J'<b>en</b> veux deux. Il faudrait <b>en</b> tenir compte.</i></p>
<p><b>y</b> sustituye a <i>à</i> + cosa y a lugares: <i>J'<b>y</b> pense. J'<b>y</b> vais. Je n'<b>y</b> arrive pas.</i></p>
<p><b>Orden delante del verbo:</b></p>
<p class="order">me / te / se / nous / vous → le / la / les → lui / leur → y → en</p>
<p class="ex">Il <b>me le</b> donne. · Je <b>le lui</b> ai dit. · Il <b>y en</b> a trois.</p>
<div class="tip">⚠️ <i>penser à qqn</i> → <i>je pense <b>à lui</b></i> (no « je lui pense »). Con personas tras <i>à</i> en verbos como penser, faire attention, s'intéresser se usa à + pronombre tónico.</div>` },

{ id: 'relatifs', level: 'B1-B2', group: 'Pronombres', title: 'Pronombres relativos', html: `
<table><tr><th>Pronombre</th><th>Sustituye a…</th><th>Ejemplo</th></tr>
<tr><td><b>qui</b></td><td>sujeto</td><td>La collègue <b>qui</b> travaille avec moi.</td></tr>
<tr><td><b>que</b></td><td>COD</td><td>Le rapport <b>que</b> j'ai écrit.</td></tr>
<tr><td><b>dont</b></td><td>complemento con <i>de</i></td><td>Le projet <b>dont</b> je t'ai parlé (parler <b>de</b>). Ce <b>dont</b> j'ai besoin.</td></tr>
<tr><td><b>où</b></td><td>lugar y tiempo</td><td>La ville <b>où</b> j'habite. Le jour <b>où</b> je suis arrivée.</td></tr>
<tr><td><b>lequel</b>, auquel, duquel…</td><td>tras preposición (cosas)</td><td>L'outil <b>avec lequel</b> je travaille. Le projet <b>auquel</b> je pense.</td></tr></table>
<div class="tip">⚠️ « Lo que » = <b>ce qui</b> (sujeto) / <b>ce que</b> (COD) / <b>ce dont</b> (con de): <i>Ce qui m'inquiète… · Ce que je veux… · Ce dont j'ai besoin…</i></div>` },

{ id: 'neg', level: 'B1', group: 'Frase', title: 'Negación', html: `
<table><tr><th>Forma</th><th>Significado</th><th>Ejemplo</th></tr>
<tr><td>ne … pas</td><td>no</td><td>Je ne sais pas.</td></tr>
<tr><td>ne … jamais</td><td>nunca</td><td>Je ne bois jamais de café.</td></tr>
<tr><td>ne … plus</td><td>ya no</td><td>Il n'habite plus ici.</td></tr>
<tr><td>ne … rien</td><td>nada</td><td>Je n'ai rien vu.</td></tr>
<tr><td>ne … personne</td><td>nadie</td><td>Je ne connais personne.</td></tr>
<tr><td>ne … aucun(e)</td><td>ningún</td><td>Je n'ai aucune idée.</td></tr>
<tr><td>ne … que</td><td>solo</td><td>Je n'ai que dix euros.</td></tr></table>
<p>Con tiempos compuestos: <i>Je n'ai <b>pas</b> mangé</i>, pero <i>Je n'ai vu <b>personne</b></i>. Con infinitivo, todo junto delante: <i>Je préfère <b>ne pas</b> sortir.</i></p>
<div class="tip">💡 En el oral se omite a menudo el <i>ne</i>: <i>Je sais pas, c'est pas grave</i>. En el escrito, nunca.</div>` },

{ id: 'articles', level: 'B1', group: 'Frase', title: 'Artículos partitivos y cantidades', html: `
<p><b>du, de la, de l', des</b> = cantidad indeterminada (en español sin artículo): <i>Je bois <b>du</b> café. J'ai <b>de la</b> chance.</i></p>
<p>Se convierten en <b>de / d'</b>:</p>
<ul><li>tras negación: <i>Je n'ai pas <b>de</b> voiture.</i> (salvo con <i>être</i>: <i>Ce n'est pas du café</i>)</li>
<li>tras cantidades: <i>beaucoup <b>de</b>, peu <b>de</b>, trop <b>de</b>, assez <b>de</b>, un kilo <b>de</b></i></li>
<li>delante de adjetivo plural: <i><b>de</b> meilleures conditions, <b>de</b> nouvelles choses</i></li></ul>` },

{ id: 'concord', level: 'B2', group: 'Frase', title: 'Estilo indirecto y concordancia de tiempos', html: `
<p>Si el verbo introductor está en pasado (<i>il a dit que…</i>), los tiempos cambian:</p>
<table><tr><th>Directo</th><th>Indirecto (pasado)</th></tr>
<tr><td>présent: « Je suis fatiguée »</td><td>imparfait: Elle a dit qu'elle <b>était</b> fatiguée.</td></tr>
<tr><td>passé composé: « J'ai fini »</td><td>plus-que-parfait: Il a dit qu'il <b>avait fini</b>.</td></tr>
<tr><td>futur: « Je viendrai »</td><td>conditionnel: Il a dit qu'il <b>viendrait</b>.</td></tr>
<tr><td>futur antérieur</td><td>conditionnel passé</td></tr></table>
<p>Cambian también los marcadores: <i>aujourd'hui → ce jour-là, demain → le lendemain, hier → la veille, ici → là</i>.</p>
<p class="ex">Preguntas: « Tu viens ? » → Il m'a demandé <b>si</b> je venais. · « Qu'est-ce que tu veux ? » → Il m'a demandé <b>ce que</b> je voulais.</p>` },

{ id: 'prep', level: 'B1', group: 'Frase', title: 'Preposiciones con lugares', html: `
<table><tr><th>Tipo</th><th>Preposición</th><th>Ejemplo</th></tr>
<tr><td>Ciudad</td><td><b>à</b></td><td>J'habite à Lausanne.</td></tr>
<tr><td>País femenino (acaba en -e) o empieza por vocal</td><td><b>en</b></td><td>en Suisse, en Espagne, en Iran</td></tr>
<tr><td>País masculino</td><td><b>au</b></td><td>au Portugal, au Canada, au Japon</td></tr>
<tr><td>País plural</td><td><b>aux</b></td><td>aux États-Unis, aux Pays-Bas</td></tr>
<tr><td>Venir de…</td><td>de / d' / du / des</td><td>Je viens d'Espagne, du Portugal, des États-Unis.</td></tr></table>
<p>Excepciones con -e masculinos: <i>au Mexique, au Mozambique</i>.</p>` },

{ id: 'connect', level: 'B2', group: 'Frase', title: 'Conectores útiles', html: `
<table><tr><th>Función</th><th>Conectores</th></tr>
<tr><td>Añadir</td><td>de plus, en outre, par ailleurs, qui plus est</td></tr>
<tr><td>Oponer</td><td>cependant, pourtant, en revanche, néanmoins, alors que, tandis que</td></tr>
<tr><td>Conceder</td><td>bien que (+ subj.), même si (+ ind.), malgré (+ sustantivo), certes… mais</td></tr>
<tr><td>Causa</td><td>parce que, puisque, comme (al inicio), grâce à (+), à cause de (−), en raison de</td></tr>
<tr><td>Consecuencia</td><td>donc, par conséquent, c'est pourquoi, si bien que, ainsi</td></tr>
<tr><td>Finalidad</td><td>pour (+ inf.), pour que / afin que (+ subj.)</td></tr>
<tr><td>Organizar</td><td>tout d'abord, ensuite, puis, enfin, pour conclure</td></tr></table>` },

{ id: 'fauxamis', level: 'B2', group: 'Vocabulario', title: 'Falsos amigos español–francés', html: `
<table><tr><th>Francés</th><th>Significa</th><th>No significa</th></tr>
<tr><td>actuellement</td><td>actualmente</td><td>« en realidad » (= en fait)</td></tr>
<tr><td>embarrassé(e)</td><td>incómodo/a, apurado/a</td><td>embarazada (= enceinte)</td></tr>
<tr><td>constipé(e)</td><td>estreñido/a</td><td>resfriado/a (= enrhumé)</td></tr>
<tr><td>molester</td><td>maltratar, acosar</td><td>molestar (= déranger, gêner)</td></tr>
<tr><td>rester</td><td>quedarse</td><td>restar (= soustraire)</td></tr>
<tr><td>sensible</td><td>sensible</td><td>sensato (= raisonnable)</td></tr>
<tr><td>large</td><td>ancho</td><td>largo (= long)</td></tr>
<tr><td>salir</td><td>ensuciar</td><td>salir (= sortir, partir)</td></tr>
<tr><td>une librairie</td><td>una librería</td><td>biblioteca (= bibliothèque)</td></tr>
<tr><td>un délai</td><td>un plazo</td><td>un retraso (= un retard)</td></tr>
<tr><td>reporter</td><td>aplazar</td><td>reportar (= signaler, rendre compte)</td></tr>
<tr><td>un brevet</td><td>una patente</td><td>— (patente comercial = licence)</td></tr>
<tr><td>une carte</td><td>un mapa, una tarjeta</td><td>una carta (= une lettre)</td></tr>
<tr><td>un compromis</td><td>un acuerdo, término medio</td><td>un compromiso/obligación (= un engagement)</td></tr></table>` },

{ id: 'c1-subj', level: 'C1', group: 'Nivel C1', title: 'Subjonctif avanzado: concesión y superlativo', html: `
<p>Además de los usos B2 (il faut que, vouloir que…), en C1 el subjuntivo aparece en estructuras de <b>concesión</b> y tras <b>superlativos</b>.</p>
<table><tr><th>Estructura</th><th>Ejemplo</th></tr>
<tr><td>bien que / quoique (aunque)</td><td>Bien qu'il <b>soit</b> tard, je continue.</td></tr>
<tr><td>quoi que (lo que sea que)</td><td>Quoi que tu <b>fasses</b>, je te soutiendrai.</td></tr>
<tr><td>où que / qui que / quel que</td><td>Où qu'il <b>aille</b>… · Quelle que <b>soit</b> la solution…</td></tr>
<tr><td>pour peu que / si tant est que</td><td>Pour peu qu'il <b>fasse</b> beau, on sortira.</td></tr>
<tr><td>sans que / à moins que / avant que</td><td>Il est parti sans que je le <b>voie</b>.</td></tr>
<tr><td>superlativo / le seul / l'unique</td><td>C'est le meilleur film que j'<b>aie</b> jamais vu.</td></tr>
<tr><td>ce n'est pas que</td><td>Ce n'est pas que je ne <b>veuille</b> pas…</td></tr></table>
<div class="tip">⚠️ <b>quoique</b> (una palabra) = aunque · <b>quoi que</b> (dos palabras) = lo que sea que. «&nbsp;Quel que&nbsp;» concuerda: quel<b>le</b> que soit la raison, quel<b>s</b> que soient les risques.</div>
<div class="tip">⚠️ Tras <b>après que</b> va indicativo en la norma (après qu'il <b>est</b> parti), aunque muchos nativos usan subjuntivo.</div>` },
{ id: 'c1-ne', level: 'C1', group: 'Nivel C1', title: '« Ne » expletivo', html: `
<p>Un <b>ne</b> sin valor negativo, propio del registro cuidado. Es <b>opcional</b>: si lo omites no es un error, pero suena menos formal. Nunca lleva «&nbsp;pas&nbsp;».</p>
<table><tr><th>Tras…</th><th>Ejemplo</th></tr>
<tr><td>avant que, à moins que</td><td>Partons avant qu'il <b>ne</b> pleuve.</td></tr>
<tr><td>verbos de temor: craindre, avoir peur que</td><td>Je crains qu'il <b>ne</b> se trompe.</td></tr>
<tr><td>comparaciones de desigualdad</td><td>C'est plus difficile que je <b>ne</b> le pensais.</td></tr>
<tr><td>éviter que, empêcher que</td><td>Il faut éviter qu'il <b>ne</b> parte.</td></tr></table>
<div class="tip">⚠️ <i>Je crains qu'il ne vienne</i> = temo que venga. <i>Je crains qu'il ne vienne <b>pas</b></i> = temo que <b>no</b> venga.</div>` },
{ id: 'c1-inv', level: 'C1', group: 'Nivel C1', title: 'Inversión y registro escrito', html: `
<p>En la lengua escrita y formal, algunos adverbios al principio de la frase provocan <b>inversión</b> sujeto–verbo:</p>
<table><tr><th>Adverbio</th><th>Ejemplo</th><th>Versión oral</th></tr>
<tr><td>peut-être</td><td>Peut-être <b>a-t-il</b> raison.</td><td>Peut-être qu'il a raison.</td></tr>
<tr><td>sans doute</td><td>Sans doute <b>est-ce</b> la meilleure option.</td><td>C'est sans doute…</td></tr>
<tr><td>à peine… que</td><td>À peine <b>était-il</b> arrivé que…</td><td>Il venait d'arriver quand…</td></tr>
<tr><td>aussi (= por eso)</td><td>Aussi <b>faut-il</b> agir vite.</td><td>Donc il faut agir vite.</td></tr>
<tr><td>ainsi</td><td>Ainsi <b>a-t-on</b> pu conclure…</td><td>Comme ça, on a pu…</td></tr></table>
<p>Con sujeto nominal se repite el pronombre: <i>Peut-être le directeur <b>a-t-il</b> oublié.</i></p>
<p>Concesión con inversión: <i>Aussi brillant <b>soit-il</b>, il doit travailler.</i> = por muy brillante que sea.</p>
<div class="tip">⚠️ «&nbsp;Aussi&nbsp;» al principio de frase con inversión significa «&nbsp;por eso&nbsp;», no «&nbsp;también&nbsp;».</div>` },
{ id: 'c1-part', level: 'C1', group: 'Nivel C1', title: 'Participio presente, gerundio y adjetivo verbal', html: `
<table><tr><th>Forma</th><th>Uso</th><th>Ejemplo</th></tr>
<tr><td>Participio presente (-ant, invariable)</td><td>Escrito; sustituye a «&nbsp;qui + verbo&nbsp;» o a una causa</td><td>Les candidats <b>parlant</b> allemand… · <b>Sachant</b> que tu viendrais…</td></tr>
<tr><td>Participio compuesto</td><td>Acción anterior</td><td><b>Ayant terminé</b> le rapport, il est parti.</td></tr>
<tr><td>Gerundio (en + -ant)</td><td>Simultaneidad, modo; mismo sujeto</td><td>Il travaille <b>en écoutant</b> de la musique.</td></tr>
<tr><td>Adjetivo verbal (concuerda)</td><td>Cualidad</td><td>des arguments <b>convaincants</b></td></tr></table>
<p>Algunos adjetivos verbales se escriben distinto del participio:</p>
<table><tr><th>Participio</th><th>Adjetivo</th></tr>
<tr><td>fatiguant</td><td>fatigant</td></tr><tr><td>convainquant</td><td>convaincant</td></tr>
<tr><td>provoquant</td><td>provocant</td></tr><tr><td>négligeant</td><td>négligent</td></tr>
<tr><td>précédant</td><td>précédent</td></tr><tr><td>différant</td><td>différent</td></tr></table>
<div class="tip">⚠️ <i>En convainquant ses collègues, elle a gagné.</i> (gerundio) / <i>Ses arguments sont convaincants.</i> (adjetivo)</div>` },
{ id: 'c1-nom', level: 'C1', group: 'Nivel C1', title: 'Nominalización', html: `
<p>En informes y textos formales se prefieren los <b>sustantivos</b> a los verbos: el texto queda más compacto y objetivo.</p>
<table><tr><th>Con verbo</th><th>Nominalizado</th></tr>
<tr><td>Quand le projet a été lancé…</td><td><b>Lors du lancement</b> du projet…</td></tr>
<tr><td>Parce que les délais ont augmenté…</td><td><b>En raison de l'augmentation</b> des délais…</td></tr>
<tr><td>Il faut vérifier les données.</td><td><b>Vérification</b> des données nécessaire.</td></tr>
<tr><td>Après qu'on a analysé les résultats…</td><td><b>Après l'analyse</b> des résultats…</td></tr>
<tr><td>Pour améliorer le processus…</td><td><b>En vue de l'amélioration</b> du processus…</td></tr></table>
<p>Sufijos frecuentes: <b>-tion</b> (validation), <b>-ment</b> (lancement), <b>-age</b> (nettoyage), <b>-ure</b> (fermeture), <b>-ité</b> (fiabilité), <b>-ance/-ence</b> (conformité, exigence).</p>
<div class="tip">💡 Muy útil para correos y documentos de trabajo, pero no abuses: demasiados sustantivos seguidos hacen el texto pesado.</div>` },
];
