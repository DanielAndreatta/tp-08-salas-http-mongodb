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
- **`src/index.js`**: Espera la conexión a MongoDB antes de escuchar el puerto y controla el cierre ordenado (`SIGINT`/`SIGTERM`).
- **`src/app.js`**: Monta el pipeline, la API JSON (`/api/reservas`) y el sitio HTML (`/reservas`).
- **`src/rutas/reservas.js` y `src/rutas/reservas-api.js`**: Separa las rutas de la web HTML de la API JSON, ambas consumiendo el mismo controlador.
- **`src/servicios/reservas-mongo.js`**: Única fuente de verdad. El antiguo servicio en memoria fue descartado del arranque para evitar dos fuentes activas.
- **`src/modelos/reserva.js`**: Define el contrato exacto de los documentos (Schema) y provee la interfaz para interactuar con la colección `reservas` en MongoDB.

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

## 8. Evidencia de Persistencia entre Procesos
Para demostrar que los datos sobreviven al ciclo de vida de Node.js, se realizó el siguiente ensayo en Postman:

1. **Listado inicial (GET `/api/reservas`):** Cantidad inicial de reservas: `4`.
2. **Creación (POST `/api/reservas`):** Se envió un JSON válido. El servidor respondió `201 Created` y asignó el ID: `6734abcd1234567890abcdef`. Cabecera `Location` recibida: `/api/reservas/6734abcd1234567890abcdef`.
3. **Consulta del recurso (GET `Location`):** Se consultó la URL devuelta. Retornó los mismos datos y el default `estado: "pendiente"`. Cantidad total: `5`.
4. **Reinicio:** Se detuvo el servidor Node.js (Ctrl+C) y se volvió a iniciar con `node --env-file=.env src/index.js`.
5. **Comprobación tras reinicio:** Se volvió a enviar el GET al mismo ID (`6734abcd1234567890abcdef`). El documento se recuperó exitosamente desde Atlas.
6. **Listado estable:** Se enviaron dos peticiones GET consecutivas a `/api/reservas`. Ambas retornaron exactamente `5` reservas, confirmando que la consulta no inserta datos.
7. **Verificación en Atlas:** En Data Explorer se localizó el documento con el mismo `_id` en la colección `reservas`.

## 9. Matriz mínima de pruebas y resultados

| Caso | Resultado Esperado | N Inicial | N Final | Resultado Observado / Evidencia |
| :--- | :--- | :--- | :--- | :--- |
| **Listado vacío si la base es nueva** | 200, `[]` | 0 | 0 | (Asumiendo base limpia) 200 OK. Retorna arreglo vacío sin hacer inserciones. |
| **Creación válida** | 201 y Location | 4 | 5 | 201 Created. Devuelve JSON con el recurso y cabecera `Location`. |
| **Consulta por ID creado** | 200, mismo recurso | 5 | 5 | 200 OK. La petición GET al ID creado devuelve exactamente los mismos campos. |
| **Consulta tras reiniciar** | 200, mismo ID | 5 | 5 | 200 OK. Tras detener y arrancar Node, devuelve el mismo documento de Mongo. |
| **ID "1"** | 400 | 5 | 5 | 400 Bad Request. JSON advierte formato inválido. |
| **ID válido inexistente** | 404 | 5 | 5 | 404 Not Found. JSON: `{"error": "Reserva no encontrada."}`. |
| **Estudiante vacío o email sin @** | 400 | 5 | 5 | 400 Bad Request. La base se mantiene estable sin aumento. |
| **Sala o turno no permitido** | 400 | 5 | 5 | 400 Bad Request. Falla validación enum, la base se mantiene estable. |
| **Fecha vacía** | 400 | 5 | 5 | 400 Bad Request. Rechaza campo obligatorio. |
| **Personas 0, 7, 2.5 o "abc"** | 400 | 5 | 5 | 400 Bad Request. Falla validación `min/max`, `isInteger` y conversión de tipos. BD intacta. |
| **Personas true, arreglo u objeto** | 400 | 5 | 5 | 400 Bad Request. La conversión rechaza booleanos y objetos. BD intacta. |
| **POST sin cuerpo o JSON mal formado** | 400 JSON | 5 | 5 | 400 Bad Request. BD intacta, cantidad sin aumento. |
| **Campos extra estado o _id** | No los asigna | 5 | 6 | 201 Created. Ignora datos falsos, Mongo asigna nuevo `_id` y estado `pendiente`. |
| **Filtro exacto por sala** | Coincidencias | 6 | 6 | 200 OK. Devuelve reservas de la sala, o `[]` si no hay uso. |
| **Sala repetida como parámetro** | 400 | 6 | 6 | 400 Bad Request. Se rechazan arreglos en `req.query`. |
| **Listar dos veces** | Cantidad estable | 6 | 6 | 200 OK. Dos consultas consecutivas devuelven 6 registros. |
| **Formulario válido / inválido** | 302 / 400 | N/A | N/A | 302 Found tras crear, o 400 Bad Request renderizando formulario previo. |
| **Estado y sitio** | Conteo y vistas | N/A | N/A | 200 OK. `/estado` llama a `countDocuments()`. |
| **Fallo de arranque con URI ausente** | Falla | N/A | N/A | Código 1 en terminal. Captura el error antes de abrir el puerto. |

## 10. Seguridad
Se confirma que los archivos `.env`, credenciales, datos personales y carpetas de dependencias (`node_modules/`) no están presentes en el repositorio, al ser interceptados correctamente por el `.gitignore`.