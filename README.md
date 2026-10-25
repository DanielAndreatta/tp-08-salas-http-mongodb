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

## 8. Matriz mínima de pruebas y resultados
**Nota sobre Morgan:** Al estar registrado al inicio del pipeline, Morgan registra todas las solicitudes, incluyendo recursos estáticos y errores 404.

| Caso | Resultado Esperado | Resultado Observado / Evidencia |
| :--- | :--- | :--- |
| **Listado vacío si la base es nueva** | 200, `[]` | 200 OK. Retorna arreglo vacío sin hacer inserciones. |
| **Creación válida** | 201 y Location | 201 Created. Devuelve JSON con el recurso y cabecera `Location`. |
| **Consulta por ID creado** | 200, mismo recurso | 200 OK. La petición GET al ID creado devuelve exactamente los mismos campos. |
| **Consulta tras reiniciar** | 200, mismo ID | 200 OK. Tras detener y arrancar Node, la consulta devuelve el mismo documento de Mongo. |
| **ID "1"** | 400 | 400 Bad Request. JSON advierte: "El identificador debe tener 24 caracteres...". |
| **ID válido inexistente** | 404 | 404 Not Found. JSON: `{"error": "Reserva no encontrada."}`. |
| **Estudiante vacío o email sin @** | 400, cantidad sin aumento | 400 Bad Request. El validador rechaza y la base se mantiene estable. |
| **Sala o turno no permitido** | 400, cantidad sin aumento | 400 Bad Request. Falla validación enum, la base se mantiene estable. |
| **Fecha vacía** | 400 | 400 Bad Request. Rechaza campo obligatorio. |
| **Personas 0, 7, 2.5 o "abc", por separado** | 400 | 400 Bad Request. Falla validación `min/max`, `isInteger` y conversión de tipos. |
| **Personas true, arreglo u objeto** | 400 | 400 Bad Request. La conversión rechaza booleanos y objetos (devuelve NaN). |
| **POST sin cuerpo o JSON mal formado** | 400 JSON | 400 Bad Request. La validación `req.body ?? {}` lo atrapa. BD intacta. |
| **Campos extra estado o _id** | No los asigna el cliente | 201 Created. Se ignoran los datos falsos, Mongo asigna nuevo `_id` y estado `pendiente`. |
| **Filtro exacto por sala** | Solo coincidencias; sin coincidencias `[]` | 200 OK. Devuelve las reservas de la sala enviada, o un array vacío si no hay uso. |
| **Sala repetida como parámetro** | 400 | 400 Bad Request. Se rechaza arreglos en `req.query` antes de ir a Mongo. |
| **Listar dos veces** | Cantidad estable | 200 OK. Dos consultas consecutivas devuelven la misma cantidad de registros. |
| **Formulario válido / inválido** | 302 / 400 | 302 Found tras crear, o 400 Bad Request renderizando `nueva.ejs` con los valores previos. |
| **Estado y sitio** | Conteo persistente y vistas correctas | 200 OK. `/estado` llama a `countDocuments()`. Las vistas de HTML operan normalmente. |
| **Fallo de arranque con URI ausente** | No abre el puerto | Código 1 en terminal. Captura el error "Falta MONGODB_URI" antes del listen. |

## 9. Seguridad
Se confirma que los archivos `.env`, credenciales, datos personales y carpetas de dependencias (`node_modules/`) no están presentes en el repositorio, al ser interceptados correctamente por el `.gitignore`.