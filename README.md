# Tiempo

App del tiempo en JavaScript puro. Busca cualquier ciudad y muestra la temperatura actual y la previsión de 5 días. El fondo cambia de color según el tiempo.

<!-- Añade aquí una captura: ![Captura de Tiempo](docs/captura.png) -->

**Demo:** https://christiiangv.github.io/tiempo-app/

## Funciones

- Búsqueda de ciudades con lista de resultados cuando hay varias con el mismo nombre
- Botón para usar tu ubicación
- Temperatura, sensación térmica, humedad y viento
- Previsión de 5 días
- Cambio entre °C y °F
- Recuerda la última ciudad y las unidades elegidas
- Diseño adaptable a móvil y respeto por el modo de movimiento reducido

## Tecnologías

HTML, CSS y JavaScript (`fetch`, `async/await`, `localStorage`, Geolocation API).
Los datos vienen de [Open-Meteo](https://open-meteo.com/), que no necesita clave de API.

## Estructura

```
index.html     Estructura de la página
css/style.css  Estilos y colores según el tiempo
js/app.js      Lógica: búsqueda, llamadas a la API y pintado
```

## Cómo ejecutarlo

Abre `index.html` en el navegador, o desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

y visita `http://localhost:8000`. La ubicación solo funciona en `localhost` o con HTTPS.

## Ideas para mejorarlo

- Previsión por horas
- Ciudades favoritas
- Tests para la lógica de conversión de unidades
