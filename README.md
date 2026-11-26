# studentnomad

Blog de viajes estático (Eleventy) publicado gratis con GitHub Pages, con un panel `/escritorio` para escribir posts.

## Puesta en marcha (una sola vez)

1. **Sube estos archivos** a la rama `main` de `arasstungys-art/studentnomad`
   (en GitHub: *Add file → Upload files* y arrastra el contenido de la carpeta, incluida `.github`).
2. **Activa Pages:** *Settings → Pages → Build and deployment → Source: GitHub Actions*.
3. Espera 1–2 min (pestaña *Actions*). El sitio queda en
   `https://arasstungys-art.github.io/studentnomad/`.

## Escribir posts (panel de admin)

El panel está en una dirección aparte que no aparece enlazada en ningún lugar del sitio:
**https://arasstungys-art.github.io/studentnomad/escritorio/** — guárdala en favoritos.
Aunque alguien encontrara la dirección, no puede entrar ni publicar: para guardar cualquier cambio hace falta
un token de GitHub con permiso de escritura sobre este repositorio, y solo el dueño puede crearlo.


1. Crea un token: GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens*
   → *Repository access: Only select repositories → studentnomad* → *Permissions → Contents: Read and write*.
2. Abre `https://arasstungys-art.github.io/studentnomad/escritorio/` → **Sign in with token** → pega el token.
3. En **Stories → New Story**: título, fecha, país, foto de portada, resumen y el texto (editor visual con
   negritas, títulos, citas, imágenes). Pulsa **Save** → se hace un commit y el sitio se republica solo.

Otras secciones del panel:
- **Countries:** cada país visitado (se pinta naranja en el mapa y tiene su página). Código ISO de 2 letras (`cl`, `pe`, `ar`…), rating, ciudades, foto, "Featured" para que salga en la portada.
- **Site settings:** textos de la portada y "About", imagen del hero, email de contacto, galería.

Marcar **Draft** oculta un post hasta que lo desmarques.

## Pendiente tras migrar desde Lovable
- Sube la foto del hero (Site settings → Hero image) y la portada de Chile (Countries → Chile → Cover photo).
- Formulario de contacto: pon tu email en *Contact email* (abre el correo del visitante) o crea un formulario
  gratis en formspree.io y pega su ID en *Formspree form ID* para recibir mensajes directamente.

## Dominio propio (opcional)
*Settings → Pages → Custom domain*. El build ajusta las rutas solo. Actualiza `site_url` en `src/admin/config.yml`.

## Trabajar en local
```bash
npm install
npm start   # http://localhost:8080
```

Estructura: `src/posts/` (historias en Markdown), `src/countries/` (países), `src/_data/` (textos y galería),
`src/uploads/` (imágenes), `src/_includes/` (plantillas), `src/assets/css/style.css` (estilos).
