# Backend ERP + POS

Backend para construir una plataforma ERP + POS multiempresa y
multilicencia, orientada a la gestión de inventarios, ventas y operaciones
comerciales. El proyecto proporciona una base modular para que distintos
negocios puedan administrar sus datos, usuarios, sucursales, productos,
existencias y transacciones desde una misma solución.

Está construido con Node.js, TypeScript, Express y PostgreSQL.

## Objetivos del proyecto

- Centralizar la gestión de inventarios y ventas.
- Soportar múltiples empresas, sucursales, cajas y usuarios con separación de
  datos por empresa.
- Servir como backend para aplicaciones web, móviles y terminales POS.
- Mantener una arquitectura modular que permita incorporar nuevos módulos
  administrativos y comerciales.
- Automatizar procesos operativos, como alertas de stock y envío de
  documentos por correo o WhatsApp.

## Estado actual

La base de código incluye:

- Autenticación con JWT, refresh tokens y control de acceso por usuario.
- Gestión de empresas, usuarios, sucursales y cajas.
- Catálogos de categorías, marcas, unidades de medida y proveedores.
- Productos, clientes, existencias y alertas de stock.
- Proformas, métodos de pago y generación de documentos PDF.
- Configuración por empresa.
- API REST con paginación, carga de imágenes y notificaciones mediante SSE.
- Procesos en segundo plano para envío de proformas y alertas de inventario.

La plataforma está diseñada para crecer hacia un ERP + POS completo. Los
módulos que todavía no estén implementados deben incorporarse respetando el
aislamiento por empresa, las reglas de inventario y la trazabilidad de las
operaciones.

## Stack tecnológico

- Node.js `>=22.22.1`
- npm `>=10.9.4`
- TypeScript
- Express 5
- PostgreSQL
- `postgres` como cliente SQL
- JWT para autenticación
- `multer` para carga de imágenes
- `pdfkit` + `pdfkit-table` para PDFs
- `nodemailer` para correo
- `pino` + `morgan` para logging

## Arquitectura

La API sigue una estructura modular por capas. En la mayoría de los módulos
se repite este patrón:

- `dto`: contratos de entrada y salida.
- `model`: tipos del dominio o filas consultadas.
- `dao`: acceso a la base de datos.
- `service`: reglas de negocio.
- `controller`: adaptación HTTP.
- `route`: definición de endpoints.

El flujo típico de una petición es:

`route -> controller -> service -> dao -> PostgreSQL`

La información operativa se organiza por empresa y, cuando corresponde, por
sucursal y caja. Toda funcionalidad nueva debe conservar este alcance y evitar
que los datos de una empresa sean visibles para otra.

## Estructura del proyecto

```text
src/
  agents/
    README.md
    sendProforma/
      data/
      email/
      task/
        sendProformaTask.ts
      whatsapp/
    stockAlert/
      data/
      task/
        stockAlertTask.ts
  config/
  middlewares/
  modules/
    alert/
    auth/
    branch/
    brand/
    category/
    checkout/
    client/
    company/
    config/
    medida/
    playmentMethod/
    product/
    proforma/
    proveedor/
    sequence/
    stock/
    user/
  services/
  types/
  utils/
    pdf/
  app.ts
  server.ts
documentacion/
ecosystem.config.cjs
```

## Componentes principales

### API HTTP

- Punto de entrada: `src/server.ts`.
- Configuración de Express y rutas: `src/app.ts`.
- Ruta base pública: `GET /`.
- Archivos estáticos: `/uploads`.

### Base de datos

- Conexión centralizada en `src/config/database.ts`.
- Se usa `DATABASE_URL` como cadena de conexión.
- Las migraciones versionadas están en `db/migrations` y se aplican con
  `dbmate` desde `docker-compose.yml`.
- Los datos mínimos de desarrollo están en `db/seeds`; no forman parte de la
  migración del esquema.

### Autenticación y multiempresa

- Login: `POST /auth/login`.
- Refresh: `POST /auth/refresh`.
- Logout: `POST /auth/logout`.
- El middleware `authenticate` valida el bearer token y adjunta al request el
  identificador del usuario, la empresa y el rol.

Los endpoints protegidos deben validar siempre el contexto de empresa antes de
leer o modificar información. La autorización por rol y la separación entre
empresas son responsabilidades centrales del backend.

### Inventario y ventas

Los módulos actuales de productos, stock, clientes, cajas, métodos de pago y
proformas forman la base del flujo POS. Sobre ellos pueden implementarse
ventas, devoluciones, movimientos de inventario, cierres de caja, compras,
reportes y demás procesos ERP.

### Documentos y automatizaciones

- Las proformas se generan y consultan bajo `/proformas`.
- Los PDFs se construyen con `pdfkit` y se guardan en
  `uploads/proformas/<identificador-de-empresa>/`.
- `sendProforma` envía proformas pendientes por correo o WhatsApp.
- `stockAlert` detecta productos con stock bajo y crea o actualiza alertas.

## Requisitos previos

Antes de levantar el proyecto se necesita:

- Node.js y npm compatibles con las versiones definidas en `package.json`.
- Docker Engine y Docker Compose v2 (`docker compose version`) si se usará el
  entorno Docker.
- Variables de entorno configuradas.
- Estructura de base de datos creada, o Docker Compose para que `dbmate` la
  cree automáticamente.

Para utilizar `sendProforma` también se necesita:

- Acceso SMTP funcional.
- Plantilla HTML en `uploads/templates/send-proforma-email.html`.
- Configuración de correo o WhatsApp para las empresas que enviarán
  documentos.

## Instalación

```bash
cp .env.example .env
```

Luego ajusta `.env` con los valores del entorno. Para trabajar exclusivamente
con Docker no es necesario instalar las dependencias de Node.js en el host;
la imagen de desarrollo las instala durante la construcción. `npm install`
solo es necesario si se ejecutará la API directamente en la máquina local.

## Variables de entorno

El proyecto carga variables con `dotenv` desde `.env`.

Docker Compose también lee este archivo para sustituir expresiones como
`${POSTGRES_USER:-erp}`. Las variables `POSTGRES_USER`, `POSTGRES_PASSWORD` y
`POSTGRES_DB` configuran PostgreSQL y se reutilizan para las migraciones, los
seeds y la conexión interna de la API.

Hay dos direcciones de base de datos válidas:

| Forma de ejecución | `DATABASE_URL` |
| --- | --- |
| API ejecutada en el host (`npm run dev`) | `...@localhost:5433/erp` |
| API ejecutada en Docker Compose | `...@db:5432/erp` |

Cuando se ejecuta el servicio `api` con Compose, el `DATABASE_URL` definido en
`docker-compose.yml` sobrescribe el de `.env` para usar el nombre interno
`db`. El valor de `.env` se conserva para ejecutar la API fuera de Docker.

Ejemplo base:

```env
LOG_LEVEL=info
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://erp:erp_dev_password@localhost:5433/erp
PUBLIC_BASE_URL=http://localhost:3000
JWT_SECRET=change-this-secret-with-at-least-32-characters
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN_HOURS=168
BCRYPT_SALT_ROUNDS=10
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Requeridas para la API

| Variable | Descripción |
| --- | --- |
| `LOG_LEVEL` | Nivel de logs: `info`, `warn`, `error` o `debug`. |
| `PORT` | Puerto HTTP de la API. |
| `CORS_ORIGIN` | Origen permitido por CORS. |
| `DATABASE_URL` | Cadena completa de conexión a PostgreSQL. |
| `PUBLIC_BASE_URL` | URL pública usada para construir rutas de archivos. |
| `JWT_SECRET` | Secreto privado y fuerte para firmar tokens. |
| `ACCESS_TOKEN_EXPIRES_IN` | Duración del access token, por ejemplo `1h`. |
| `REFRESH_TOKEN_EXPIRES_IN_HOURS` | Duración del refresh token en horas. |
| `BCRYPT_SALT_ROUNDS` | Rondas usadas para generar hashes de contraseñas. |

### Requeridas para `sendProforma`

| Variable | Descripción |
| --- | --- |
| `SMTP_HOST` | Host SMTP. |
| `SMTP_PORT` | Puerto SMTP. |
| `SMTP_SECURE` | Booleano que indica si se usa conexión segura. |
| `WHATSAPP_APICONSULT_TOKEN` | Token requerido si se usa el canal WhatsApp. |

Las credenciales del correo se resuelven por empresa desde la tabla
`configuracion`. La configuración del canal determina si una proforma se
envía por correo o WhatsApp; el correo tiene prioridad cuando ambos canales
están activos.

## Scripts disponibles

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run lint
npm run format
npm run format:check
```

## Cómo levantar el proyecto

### Desarrollo

#### Opción recomendada: Docker Compose

Docker Compose levanta PostgreSQL, espera a que esté saludable, aplica las
migraciones pendientes con `dbmate` y después inicia la API:

```bash
cp .env.example .env
docker compose up --build api
```

La API queda disponible en <http://localhost:3000>. El puerto `5433` de la
máquina local se publica para herramientas externas; entre contenedores se usa
`db:5432`.

Para cargar la empresa y el usuario administrador de desarrollo:

```bash
docker compose --profile seed run --rm seed
```

El usuario inicial es `adminerp@systemconfig.com`, con apodo `adminerp_9999` y
contraseña `AdminERP_9999!`. Cambia estas credenciales antes de usar este
entorno fuera de desarrollo.

Para levantar la API, PostgreSQL y también el frontend hermano ubicado en
`../frontend-erp-app`, ejecuta:

```bash
docker compose --profile web up --build
```

El frontend queda disponible en <http://localhost:5173>.

Comandos útiles del entorno Docker:

```bash
# Ver los servicios y su estado
docker compose ps

# Ver los logs de la API
docker compose logs -f api

# Detener los contenedores sin borrar los datos de PostgreSQL
docker compose down

# Detener los contenedores y eliminar también el volumen de PostgreSQL
# (borra la base de datos local)
docker compose down -v
```

Para revisar la configuración resultante después de interpolar `.env`:

```bash
docker compose config
```

No compartas la salida de este comando si contiene contraseñas o tokens.

#### API fuera de Docker

Si se ejecuta la API directamente en el host, primero debe estar disponible
PostgreSQL en `localhost:5433` y deben instalarse las dependencias:

```bash
npm install
npm run dev
```

En este modo se usa el `DATABASE_URL` de `.env`; dentro de Docker se usa el
valor interno configurado por Compose.

API:

```bash
npm run dev
```

Agente `sendProforma`:

```bash
node --import tsx src/agents/sendProforma/task/sendProformaTask.ts
```

Agente `stockAlert`:

```bash
node --import tsx src/agents/stockAlert/task/stockAlertTask.ts
```

### Producción

```bash
npm run build
npm start
```

El archivo `ecosystem.config.cjs` existe para PM2, pero contiene rutas de
despliegue específicas del entorno original. Revisa y ajusta `cwd` y los
scripts antes de utilizarlo en otra máquina.

## Módulos y rutas base

Las rutas están registradas en `src/app.ts`.

| Módulo | Ruta base |
| --- | --- |
| system | `/` |
| auth | `/auth` |
| companies | `/companies` |
| users | `/users` |
| branches | `/branches` |
| checkouts | `/checkouts` |
| categories | `/categories` |
| brands | `/brands` |
| proveedores | `/proveedores` |
| medidas | `/medidas` |
| products | `/products` |
| stocks | `/stocks` |
| clients | `/clients` |
| playment-methods | `/playment-methods` |
| proformas | `/proformas` |
| configs | `/configs` |
| alerts | `/alerts` |

## Convenciones de la API

### Autenticación

Excepto `GET /` y los endpoints de autenticación, la API espera:

```http
Authorization: Bearer <token>
```

### Paginación

Los listados paginados devuelven:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

### Carga de imágenes

El middleware de imágenes usa `multipart/form-data` con el campo `imagen`.
Acepta `.png` y `.jpg`, con un tamaño máximo de `5MB`. Las imágenes se
guardan bajo `uploads/` y se publican usando `PUBLIC_BASE_URL`.

### Seguridad y middleware

- `helmet` para headers de seguridad.
- `cors` configurable por entorno.
- `morgan` conectado a `pino`.
- Límites de solicitudes por IP para autenticación, lecturas y escrituras.
- Middleware global de errores y `notFound`.

## Almacenamiento local

El proyecto usa `uploads/` para almacenar:

- Imágenes de empresas, usuarios y productos.
- PDFs de proformas.
- Plantillas HTML para correo.

Las rutas más relevantes son:

- `uploads/proformas/`
- `uploads/templates/send-proforma-email.html`

El directorio `uploads/` se expone públicamente desde Express y está ignorado
por git.

## Calidad y desarrollo

TypeScript está configurado en modo estricto, incluyendo:

- `strict`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`

La salida compilada se genera en `dist/`.

Para entender el proyecto:

1. Revisa `src/app.ts` para conocer las rutas montadas.
2. Entra a `src/modules/<modulo>/` y sigue el flujo
   `route -> controller -> service -> dao`.
3. Revisa `src/config/` y el middleware de autenticación para entender el
   contexto multiempresa.
4. Consulta `src/agents/` para conocer las automatizaciones en segundo plano.
