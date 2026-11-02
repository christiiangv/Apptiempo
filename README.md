# Tiempo

App del tiempo en JavaScript puro. Busca cualquier ciudad y muestra la temperatura actual y la previsión de 5 días. El fondo cambia de color según el tiempo.

<!-- Añade aquí una captura: ![Captura de Tiempo](docs/captura.png) -->

**Demo:** [https://christiiangv.github.io/tiempo-app/](https://christiiangv.github.io/Apptiempo/)

## Funciones

- Búsqueda de ciudades con lista de resultados cuando hay varias con el mismo nombre
- Botón para usar tu ubicación
- Temperatura, sensación térmica, humedad y viento
- Previsión de 5 días
- Cambio entre °C y °F
- Recuerda la última ciudad y las unidades elegidas
- Diseño adaptable a móvil y respeto por el modo de movimiento reducido
- Aviso de lluvia inminente (próximas 2 horas), previsión por horas, amanecer, atardecer y probabilidad de lluvia
- Calidad del aire, polen y oleaje (si hay datos para el lugar)
- Ciudades favoritas y enlace compartible (`#c=lat,lon|Ciudad`; tu ubicación nunca se pone en el enlace)
- Instalable como app (PWA) y con los últimos datos sin conexión
- Riesgos meteorológicos a 5 días: inundación fluvial, lluvia torrencial, tormentas, viento, nieve, calor, frío y radiación UV, con nivel (bajo, moderado, alto, extremo)

## Tecnologías

HTML, CSS y JavaScript (`fetch`, `async/await`, `localStorage`, Geolocation API).
Los datos vienen de [Open-Meteo](https://open-meteo.com/), que no necesita clave de API.
El riesgo de inundación fluvial usa además su [Flood API](https://open-meteo.com/en/docs/flood-api) (modelo GloFAS).

## Estructura

```
index.html     Estructura de la página
css/style.css  Estilos y colores según el tiempo
js/app.js      Lógica: búsqueda, llamadas a la API y pintado
```

## Riesgos meteorológicos

Vive en `riesgos.js`, un módulo independiente: `app.js` solo le avisa con el evento `tiempo:lugar` cuando carga una ciudad.

- **Inundación fluvial:** compara el caudal máximo previsto con el de los últimos 30 días. Si falla esa consulta, el resto de riesgos se muestra igual.
- **Lluvia torrencial:** mira la intensidad por hora y lo acumulado en 12 horas, que es lo que provoca las inundaciones repentinas que los modelos de ríos no ven.
- **Otros:** tormentas (con granizo), rachas de viento, nieve, calor, frío y UV.

Los umbrales están en el objeto `UMBRAL` y son orientativos. No sustituyen los avisos oficiales.

## Tests

Sin dependencias, con el runner de Node (18 o superior):

```bash
node --test
```

## Cómo ejecutarlo

Abre `index.html` en el navegador, o desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

y visita `http://localhost:8000`. La ubicación solo funciona en `localhost` o con HTTPS.

## Ideas para mejorarlo

- Tests para la conversión de unidades de `app.js` (los de riesgos ya están en `tests/`)
- Captura o GIF de la app en este README
