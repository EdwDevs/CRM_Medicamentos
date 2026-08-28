# CRM Medicamentos

Sistema de gestión de pagos para medicamentos construido con Firebase/Firestore y Vanilla JavaScript.

## 📋 Descripción

CRM Medicamentos es una aplicación web progresiva (PWA) diseñada para gestionar pagos, reintegros y seguimiento de medicamentos. Permite registrar pagos a farmacias, aplicar reintegros, generar reportes y exportar datos a CSV.

## 🛠️ Tecnologías utilizadas

- **Frontend:** HTML5, CSS3 (Tailwind CDN), JavaScript Vanilla (ES Modules)
- **Backend:** Firebase Firestore (base de datos en tiempo real), Firebase Authentication (auth anónimo)
- **Gráficos:** Chart.js 4.x
- **PWA:** Manifest.json y Service Worker para funcionalidad offline
- **Herramientas de desarrollo:** Git, GitHub

## 📁 Estructura del proyecto

```
CRM_Medicamentos/
├── index.html          # Página principal
├── script.js           # Lógica principal de la aplicación
├── styles.css          # Estilos personalizados
├── manifest.json       # Configuración PWA
├── sw.js               # Service Worker
├── firebase.json       # Configuración de Firebase Hosting
├── firestore.rules     # Reglas de seguridad de Firestore
├── .gitignore          # Archivos excluidos de Git
├── README.md           # Este archivo
├── scripts/            # Scripts auxiliares
│   └── migrate-historical-payments-to-cash-movements.js
└── src/                # Código fuente organizado (para futura refactorización)
    ├── services/
    │   ├── firebase.js
    │   ├── payments.js
    │   └── references.js
    └── ui/
        ├── dashboard.js
        ├── modals.js
        └── table.js
```

## ⚙️ Configuración e instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/EdwDevs/CRM_Medicamentos.git
   cd CRM_Medicamentos
   ```

2. **Configurar Firebase:**
   - Crear un proyecto en [Firebase Console](https://console.firebase.google.com/)
   - Habilitar Firestore en modo prueba (o ajustar reglas en `firestore.rules`)
   - Habilitar Authentication > Proveedores de inicio de sesión > Anónimo
   - Copiar la configuración de Firebase y reemplazar los valores en `script.js` (sección `firebaseConfig`)

3. **Ejecutar localmente:**
   - Abrir `index.html` en un navegador moderno
   - O usar un servidor local (ej: `python -m http.server` o `npx serve`)

4. **Despliegue (opcional):**
   - Instalar Firebase CLI: `npm install -g firebase-tools`
   - Iniciar sesión: `firebase login`
   - Inicializar proyecto: `firebase init` (seleccionar Hosting)
   - Desplegar: `firebase deploy`

## 🚀 Funcionalidades principales

- **Registro de pagos:** Farmacia, producto, cantidad, precio unitario, fecha, notas
- **Estado de pagos:** Pendiente / Procesado con cambio masivo
- **Reintegros:** Aplicar reintegros a pagos realizados
- **Filtros avanzados:** Por producto, farmacia, estado, mes, rango de fechas, importe, búsqueda
- **Exportación a CSV:** Descarga de datos filtrados o seleccionados
- **Tema claro/oscuro:** Persistente en localStorage
- **Sidebar colapsable:** Para mejor uso de espacio en pantalla
- **Vistas guardadas:** Guardar configuraciones de filtros, orden y columnas
- **Gráficos de tendencia:** Egresos mensuales y distribución por producto
- **Estadísticas KPI:** Egresos, reintegros, uso de fondo, disponible
- **Selección múltiple:** Acciones en lote (procesar, exportar, eliminar)
- **Paginación:** Configurable con indicador de página

## 📱 Compatibilidad

- Navegadores modernos: Chrome, Firefox, Safari, Edge
- Diseño responsive: móvil, tablet y escritorio
- Instalable como PWA en dispositivos móviles y de escritorio

## 👥 Contribuir

1. Fork el repositorio
2. Crear una rama para tu feature: `git checkout -b feature/nueva-funcionalidad`
3. Hacer commit de tus cambios: `git commit -m 'Añade nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto es de uso privado/internal. Consulta al autor para derechos de uso.

## 🙏 Agradecimientos

- Firebase por proporcionar una plataforma backend fácil de usar
- Tailwind CSS por el framework utility-first
- Chart.js por la librería de gráficos
- La comunidad open source por sus herramientas y ejemplos

---
*Desarrollado por EdwDevs • Actualizado agosto 2026*