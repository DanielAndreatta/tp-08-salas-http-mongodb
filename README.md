# Trabajo Práctico 08 - Endpoints persistentes de reservas de salas

## 1. Punto de partida y proyecto
Este proyecto (copia denominada `tp-08-salas-http-mongodb`) evoluciona desde el TP07. Su objetivo principal es la migración definitiva de la persistencia: tanto la aplicación web HTML (vistas EJS) como la nueva API JSON comparten y consumen una única fuente de verdad asíncrona conectada a MongoDB Atlas, abandonando por completo el almacenamiento temporal en memoria. 

## 2. Entorno y Versiones
- **Node.js**: >= 22.13.0
- **Base de Datos**: MongoDB Atlas, clúster gratuito Free (M0). Colección: `reservas`. Base: `reservas_salas_u8`.
- **Dependencias principales**: Express 5.1.0, Mongoose 9.10.3.

## 3. Preparación, Instalación y Ejecución
1. **Clonar e Instalar:**
   ```bash
   git clone <url-del-repo>
   cd tp-08-salas-http-mongodb
   npm install
   ```
2. **Preparar Clúster en Atlas:** Crear un clúster Free (M0). Configurar un usuario de base de datos con permisos de lectura y escritura. En *Network Access*, permitir tu dirección IP actual.
3. **Entorno local:** Copiar el archivo `.env.example` y renombrarlo a `.env`. Reemplazar los marcadores `USUARIO`, `CLAVE` y `HOST` por las credenciales provistas por Atlas.
4. **Ejecución del Servidor:**
   Dado que ahora la aplicación exige las variables de entorno para arrancar, se debe ejecutar:
   ```bash
   node --env-file=.env src/index.js
   ```
   *(También disponible mediante el script: `npm run start:local`)*

## 4. Diagnóstico DNS y Comandos de Calidad
- **Ajuste DNS:** Se implementó `dns.setServers(["8.8.8.8", "1.1.1.1"])` en `src/config/base-datos.js` para evitar fallos de resolución de registros SRV/TXT por bloqueos del proveedor de internet local.
- **Resultados de herramientas de calidad:**
  - `npm run format`: Ejecutado. Prettier unificó el formato en `src/` y `scripts/`.
  - `npm run lint`: Ejecutado. ESLint no detectó variables sin uso ni errores de sintaxis en CommonJS.
  - `npm run check`: Ejecutó con éxito ambas comprobaciones en pipeline.
  - `npm start`: Falla a propósito si no se inyecta el `.env` (comportamiento seguro esperado).
  - `node --env-file=.env src/index.js`: Arrancó conectando primero a MongoDB y luego abriendo el puerto 3000.

## 5. Mapa de Archivos, Esquema, Modelo y Colección
El proyecto mantiene una estructura modular estricta:
- **`src/index.js`**: Espera la conexión a MongoDB *antes* de escuchar el puerto y controla el cierre ordenado (`SIGINT`/`SIGTERM`).
- **`src/app.js`**: Monta el pipeline, la API JSON (`/api/reservas`) y el sitio HTML (`/reservas`).
- **`src/rutas/`**: Separa las rutas web (`productos.js`) de la API JSON (`productos-api.js`), ambas consumiendo el mismo controlador.
- **Transición de Memoria:** El archivo `src/servicios/reservas.js` (memoria temporal) se conserva solo como referencia histórica, pero **dejó de importarse** en `index.js`. Esto evita tener dos fuentes de verdad activas; ahora todo el flujo atraviesa `src/servicios/reservas-mongo.js`.
- **Esquema y Modelo (`modelos/reserva.js`)**: Define el contrato exacto de los documentos (Schema) y provee la interfaz (Model) para interactuar con la **colección** `reservas` en MongoDB.

## 6. Campos y Reglas del Dominio
- `estudiante`: String, obligatorio, `trim: true`.
- `email`: String, obligatorio, `trim: true`, `match: /@/`.
- `sala`: String, obligatorio, `enum: ["Sala Norte", "Sala Sur", "Sala Multimedia"]`.
- `fecha`: String, obligatorio, `trim: true`.
- `turno`: String, obligatorio, `enum: ["Mañana", "Tarde", "Noche"]`.
- `personas`: Number, obligatorio, `min: 1`, `max: 6`, `validate: Number.isInteger`.
- `estado` *(Nuevo)*: String, asignado automáticamente por Mongoose. `default: "pendiente"`, `enum: ["pendiente", "confirmada"]`. El cliente no lo envía al crear.
*(Límites: No se controlan lógicas de fechas pasadas, formato estricto de email ni control de superposición de reservas).*

## 7. Instrucciones para probar la API en Postman
Con el servidor corriendo localmente (`node --env-file=.env src/index.js`), ejecutar las siguientes peticiones en Postman:

1. **Listar Reservas (GET):**
   - **Método:** `GET` | **URL:** `http://localhost:3000/api/reservas` | **Body:** `none`
   - **Respuesta:** 200 OK. Arreglo JSON con todas las reservas.
2. **Crear Reserva (POST):**
   - **Método:** `POST` | **URL:** `http://localhost:3000/api/reservas`
   - **Headers:** `Content-Type: application/json`
   - **Body (raw -> JSON):**
     ```json
     {
       "estudiante": "Carlos Ejemplo",
       "email": "carlos@ejemplo.com",
       "sala": "Sala Norte",
       "fecha": "2026-10-30",
       "turno": "Mañana",
       "personas": 2
     }
     ```
   - **Respuesta:** 201 Created. Devuelve JSON de la reserva y la cabecera `Location` (ej: `/api/reservas/6734a...`).
3. **Filtrar por Sala (GET):**
   - **Método:** `GET` | **URL:** `http://localhost:3000/api/reservas?sala=Sala%20Norte`
   - **Respuesta:** 200 OK. Arreglo JSON solo con las coincidencias exactas.

## 8. Matriz de Pruebas y Resultados
**Nota sobre Morgan:** Como `app.use(morgan(...))` está registrado al principio del pipeline en `app.js`, intercepta absolutamente todas las solicitudes, incluyendo los recursos estáticos cargados exitosamente por `express.static` (`/css/estilos.css`) y las peticiones que terminan en el middleware 404 final.

| Caso | Método / Endpoint | Estado HTTP | Resultado Evidenciado |
| :--- | :--- | :--- | :--- |
| **Arranque sin URI** | Terminal | Falla (Código 1)| No abre el puerto. Lanza error: "Falta MONGODB_URI en el entorno". |
| **Listado vacío (Base nueva)** | GET `/api/reservas` | 200 OK | Retorna `[]` válido. No realiza inserciones automáticas. |
| **Crear válido API** | POST `/api/reservas` | 201 Created | Retorna JSON con `_id` limpio y añade `Location` en cabeceras. |
| **Consulta por ID creado** | GET `/api/reservas/:id` | 200 OK | Muestra exactamente el mismo recurso creado en el paso anterior. |
| **Persistencia tras reinicio** | GET `/api/reservas/:id` | 200 OK | Al detener y reiniciar Node, se recupera el mismo documento desde Mongo. |
| **ID mal formado** | GET `/api/reservas/1` | 400 Bad Request | Retorna JSON: `{"error": "El identificador debe tener 24 caracteres..."}`. |
| **ID válido inexistente** | GET `/api/reservas/000000000000000000000000` | 404 Not Found | Retorna JSON: `{"error": "Reserva no encontrada."}`. |
| **POST sin cuerpo / JSON roto**| POST `/api/reservas` | 400 Bad Request | Falla parseo. Retorna JSON de error. La cantidad de BD no aumenta. |
| **POST estudiante vacío** | POST `/api/reservas` | 400 Bad Request | Falla validación `trim/required`. BD no aumenta. |
| **POST email sin @** | POST `/api/reservas` | 400 Bad Request | Falla validación `match`. Retorna alerta. BD no aumenta. |
| **POST sala no permitida** | POST `/api/reservas` | 400 Bad Request | Falla regla `enum`. Retorna alerta de campos inválidos. |
| **POST personas: 0 o 7** | POST `/api/reservas` | 400 Bad Request | Falla validación de límites `min/max`. Retorna JSON/Alerta. BD intacta. |
| **POST personas float (2.5)** | POST `/api/reservas` | 400 Bad Request | Falla función `validate: isInteger`. Retorna error. BD intacta. |
| **POST personas string ("abc")**| POST `/api/reservas` | 400 Bad Request | Falla conversión del validador de Express. Retorna alerta. BD intacta. |
| **POST con campos extra** | POST `/api/reservas` | 201 Created | Ignora los campos maliciosos (ej: `_id` o `estado` falso) y crea con ID propio y estado `pendiente`. |
| **Filtro exacto de Sala** | GET `/api/reservas?sala=Sala%20Norte` | 200 OK | Arreglo filtrado. Si se envía una sala sin uso, devuelve `[]`. |
| **Filtro Sala como arreglo** | GET `...?sala=x&sala=y` | 400 Bad Request | Validador rechaza si `typeof sala !== "string"`. Evita error interno. |
| **Formulario Web Válido** | POST `/reservas` | 302 Found | Guarda en MongoDB y redirige a la vista listado que muestra el alta. |
| **Formulario Web Inválido** | POST `/reservas` | 400 Bad Request | El middleware EJS intercepta el error, renderiza `nueva.ejs` y conserva valores. |
| **Estado y Continuidad Web** | GET `/estado` | 200 OK | Continúa devolviendo `{"servicio":"activo", "reservas": X, "solicitudId":"..."}` contando directamente desde MongoDB (`countDocuments()`). |

## 9. Seguridad
Se confirma que los archivos `.env`, credenciales, datos personales y carpetas de dependencias (`node_modules/`) no están presentes en el repositorio, al ser interceptados correctamente por el `.gitignore`.