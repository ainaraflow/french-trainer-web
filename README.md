# French Trainer · versión web (móvil)

App de tarjetas ES → FR que funciona en el navegador y se instala en el móvil como una app.
Funciona sin internet una vez abierta por primera vez. Los datos se guardan en el propio dispositivo.

## Publicarla gratis con GitHub Pages
1. En github.com → **New repository** → nombre `french-trainer-web` → **Public** → Create.
2. **Add file → Upload files** → arrastra TODO el contenido de esta carpeta (incluida la carpeta `icons`) → Commit.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, carpeta `/ (root)` → Save.
4. En 1–2 minutos estará en `https://TU_USUARIO.github.io/french-trainer-web/`.

## Instalarla en el móvil
- **iPhone (Safari):** abre la dirección → botón Compartir → **Añadir a pantalla de inicio**.
- **Android (Chrome):** abre la dirección → menú ⋮ → **Instalar app** / Añadir a pantalla de inicio.

## Datos y copias de seguridad
- Cada dispositivo guarda su propio progreso.
- Pestaña **Datos → Exportar progreso** genera un `.json` con el mismo formato que `data/cards.json` de la app de escritorio.
  Puedes importarlo en otro dispositivo (Datos → Importar) o copiarlo como `data/cards.json` en el ordenador.
- Exporta de vez en cuando como copia de seguridad.

## Actualizar
Sube los archivos nuevos al mismo repositorio. La app se actualiza sola la siguiente vez que la abras con internet
(a veces hace falta abrirla dos veces).
