---
name: publish
description: Crea una versión SemVer, actualiza CHANGELOG y hojas de ruta, compila y firma el binario/artefacto, etiqueta con suma SHA-256, genera notas de instalación específicas y publica en GitHub.
---

# Publish (Versionamiento y Release)

Esta skill unifica `versiona` y `publica`. Le pone número a lo que está en `main`, lo ata a un binario con un tag, genera el binario/artefacto firmado y lo despliega públicamente.

**Solo funciona en la rama `main`**.

## 1. Verificación Inicial
- `git status -sb` y `git fetch origin`.
- Averigua qué hay nuevo: `git describe --tags --abbrev=0` y `git log --oneline <último_tag>..HEAD`. Si no hay commits nuevos, detente.
- El salto de SemVer lo decide el contenido (Mayor, Menor o Parche). **Espera confirmación del usuario**.

## 2. Escribir el Changelog y Hoja de Ruta
- En la raíz, abre `CHANGELOG.md` (crea la cabecera "Keep a Changelog" si es la primera vez).
- Inserta sección `## [<X.Y.Z>] — <fecha>` y escribe los apartados `Añadido`, `Cambiado`, `Corregido`. Escribe pensando en el usuario de la app, sin tecnicismos.
- **Hoja de ruta (`specs/roadmap.md`)**:
  - Cambia la cabecera a `Versión publicada: <X.Y.Z> (<fecha>)`.
  - Mueve las tareas de "En curso" a "Después de la 1.0.0" y vacía "En main, sin versión todavía".
- *(Actualiza los estados en `requirements.md` de las specs involucradas si aplica).*

## 3. QA Final
- Ejecuta los linters y tests correspondientes al proyecto. Detente si algo falla.

## 4. Commit y Merge de Versión
```bash
git switch -c version/<X.Y.Z>
git add .
git commit -m "feat/fix: versión <X.Y.Z>" -m "Versión <X.Y.Z>."
git push -u origin version/<X.Y.Z>
git switch main
git merge --ff-only version/<X.Y.Z>
git push origin main
```

## 5. Generar binario/artefacto Firmado (Si aplica)
- Compila el proyecto y genera la binario/artefacto en modo release si está configurado.
- Copia el binario/artefacto al destino para releases o adjúntalo a los artefactos.

## 6. Etiquetar (Git Tag)
Saca la suma (`sha256sum`) del binario/artefacto y etiqueta en `main`:
```bash
git tag -a v<X.Y.Z> -m "{{PROJECT_NAME}} <X.Y.Z>" -m "El binario/artefacto publicado se compiló de este árbol."
git push origin v<X.Y.Z>
```

## 7. Publicación del Release (GitHub)
- **Construye las Notas de Release (`<scratchpad>/notas.md`)**:
  - Fragmento del changelog.
  - `---`
  - `## Instalar`: (Menciona instrucciones y advertencias necesarias).
- Ejecuta el release (si `gh` cli está disponible):
  ```bash
  gh release create v<X.Y.Z> <ruta-al-binario/artefacto> --target main --title "{{PROJECT_NAME}} <X.Y.Z>" --notes-file <scratchpad>/notas.md
  ```

