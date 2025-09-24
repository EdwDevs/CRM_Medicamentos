# CRM Medicamentos

Aplicación web para gestionar el presupuesto y los pagos de medicamentos de distintas farmacias. El proyecto fue reestructurado para separar la lógica en módulos ES6, mejorar la accesibilidad de la interfaz y reducir la cantidad de lecturas innecesarias a Firestore mediante el uso de un pequeño estado global en memoria.

## Estructura del proyecto

```
├── firebase-config.sample.js   # Plantilla de credenciales de Firebase
├── index.html                  # Contenedor principal con la estructura semántica de la UI
├── src/
│   ├── main.js                 # Punto de entrada y orquestador de eventos
│   ├── js/
│   │   ├── config/             # Constantes de negocio (presupuesto, productos)
│   │   ├── services/           # Acceso a Firestore (pagos y presupuesto)
│   │   ├── state/              # Pequeña tienda de estado basada en EventTarget
│   │   ├── ui/                 # Renderizadores y componentes visuales reutilizables
│   │   └── utils/              # Funciones de ayuda (formateo, normalización de texto)
│   └── styles/
│       └── main.css            # Hoja de estilos con los nuevos componentes visuales
└── .gitignore
```

## Configuración

1. Copia el archivo `firebase-config.sample.js` como `firebase-config.js` en la raíz del proyecto.
2. Completa los valores con las credenciales de tu proyecto de Firebase.
3. Abre `index.html` en un navegador compatible con módulos ES6.

> **Nota:** el archivo `firebase-config.js` está incluido en `.gitignore` para evitar exponer claves sensibles en el repositorio.

## Funcionalidades destacadas

- Resumen de presupuesto con actualización en vivo y barras de progreso accesibles.
- Tablas responsivas con paginación y filtros combinables (producto, farmacia, mes y estado).
- Registro de pagos con validación en tiempo real del presupuesto disponible.
- Panel de recarga de presupuesto con cálculos previos y registro del historial en Firestore.
- Estado global que sincroniza totales y contadores sin recargar toda la colección en cada operación.
- Notificaciones accesibles (`aria-live`) y componentes semánticos para una mejor experiencia en lectores de pantalla.

## Scripts y herramientas

No se requiere un servidor de compilación: basta con servir el directorio mediante un servidor estático o abrir `index.html` directamente en el navegador. Para un flujo de desarrollo más cómodo se recomienda usar alguna de estas opciones:

```bash
# Servir el proyecto con Python
python3 -m http.server 8000

# o con npx serve
npx serve .
```

Luego visita `http://localhost:8000` (o el puerto que elijas) en el navegador.

## Buenas prácticas implementadas

- Lógica desacoplada en servicios reutilizables y renderizadores.
- Módulo de estado que centraliza presupuesto, totales y paginación.
- Uso de transacciones en Firestore para asegurar consistencia al crear o eliminar pagos.
- Toasts accesibles y estructura semántica (`header`, `main`, `section`, `table`, `dl`).
- Separación completa de estilos, HTML y JavaScript para facilitar mantenimiento y escalabilidad.
