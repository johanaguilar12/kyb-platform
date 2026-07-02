# Plataforma de Validación de Cumplimiento KYB (Know Your Business)

Plataforma empresarial de validación automatizada y análisis de riesgo KYB diseñada para simplificar y blindar la incorporación de personas morales en México. Este sistema analiza expedientes legales, extrae información estructurada de documentos oficiales usando IA local, y detecta discrepancias de datos y riesgos fiscales en listas del SAT.

## 🔗 Enlaces del Proyecto

- **Demo en Vivo (Producción Vercel):** [https://kyb-platform-omega.vercel.app](https://kyb-platform-omega.vercel.app)
- **Repositorio de Código:** [https://github.com/johanaguilar12/kyb-platform](https://github.com/johanaguilar12/kyb-platform)

---

## 🛠️ Stack Tecnológico

1. **Framework Principal:** Next.js 16 (App Router, Turbopack) con TypeScript en modo estricto.
2. **Estilos y UI:** Tailwind CSS v4 para diseño visual moderno y responsivo, estructurado con componentes accesibles.
3. **Base de Datos & ORM:** Prisma ORM interactuando con una base de datos PostgreSQL hospedada en Supabase.
4. **Validación de Esquemas:** Zod para control estricto de payloads de entrada y salida en la API.
5. **Inteligencia Artificial (Extractor local):** Google Gemini 2.5 Flash API para la lectura, digitalización y extracción estructurada (JSON) nativa de PDFs.
6. **Procesamiento de Archivos Local:**
   - `pdf-parse` para validar la estructura de los archivos cargados y extraer texto preliminar de forma local.
   - `pdf-lib` para optimizar y comprimir buffers binarios de PDF en memoria (eliminación de metadatos y reestructuración de flujos de objetos) reduciendo el tamaño entre un 50% y 75% antes del almacenamiento, manteniendo el 100% de las páginas intactas.
7. **Pruebas Unitarias y de Integración:** Vitest para un entorno de pruebas veloz y determinista.

---

## 🚀 Funcionalidades Clave

### 1. Extracción Estricta de Documentos con IA
- Procesa PDFs nativos y digitalizados de manera 100% automatizada.
- Si el archivo PDF está corrupto o es inválido, es rechazado inmediatamente (sin almacenar nada ni crear registros huérfanos).
- No se permiten entradas de datos manuales; toda la información de cumplimiento se deriva directamente de la lectura inteligente de los documentos subidos.

### 2. Conciliación y Validación de Datos Cruzados
- **Validación de RFC (Crítica):** Compara el RFC extraído del documento contra el RFC registrado del expediente y contra otros documentos activos. Cualquier discrepancia causa el rechazo inmediato de la carga.
- **Validación de Nombre Legal (Crítica):** Compara de forma estricta el nombre de la empresa ignorando puntuación, espacios extra, acentos y mayúsculas/minúsculas. Si difieren, el documento se rechaza inmediatamente.
- **Alertas de Representantes y Direcciones (Advertencias):** Utiliza algoritmos de similitud de texto (Levenshtein) para emitir advertencias de discrepancia en los nombres de representantes y direcciones declaradas entre documentos.

### 3. Índice de Riesgo Determinista y Explicable
- Evalúa el expediente bajo una fórmula matemática pura que calcula penalizaciones acumulativas de riesgo:
  - Presencia de RFC en listas de EFOS / Empresas fantasma del SAT (+50, +40 o +30 puntos).
  - CSD (Certificados de Sello Digital) revocados (+0 puntos, señal de advertencia).
  - Certificado de Situación Fiscal (CSF) desactualizado (+25 puntos).
  - Documentos de cumplimiento expirados (+20 puntos).
  - Documento obligatorio faltante (+15 puntos c/u).
  - Datos incompletos en representantes o accionistas (+20 puntos).
  - Listas del SAT desactualizadas (+10 puntos).
  - **Bono de Cumplimiento Perfecto (-5 puntos)** si todo está en perfecto orden y limpio de banderas de riesgo.
- Clasificación de Riesgo:
  - **Safe (Seguro):** < 30 puntos.
  - **Review Required (Manual):** 30 a 69 puntos.
  - **High Risk (Alto Riesgo):** ≥ 70 puntos (Bloquea automáticamente la opción de aprobar el expediente).

### 4. Consultas Reales de Listas del SAT
- Descarga y procesa en tiempo real las bases de datos de cumplimiento del portal del SAT (Art. 69, 69-B, 69-B Bis, CSD Revocados).
- Almacena en caché local las listas del SAT con un TTL de 24 horas para optimizar el rendimiento y evitar sobrecargar la red externa.

### 5. Flujo Dinámico de Menú de Carga Mediante Detección con IA
- El formulario de carga inicial muestra únicamente los **5 documentos base** obligatorios:
  1. Constancia de Situación Fiscal (CSF)
  2. Acta Constitutiva
  3. Identificación del Representante Legal
  4. Comprobante de Domicilio
  5. Manifestación Bajo Protesta de Decir Verdad (Obligatorio por PLD)
- Al procesar el Acta Constitutiva y la CSF, el sistema ejecuta dos análisis condicionales automáticos:
  - **Poder Notarial (Power of Attorney):** Si el representante legal registrado en la CSF difiere del administrador único o representante principal en el Acta, se activa la obligatoriedad de subir el Poder Notarial, agregándolo al menú de carga y mostrando una alerta amarilla que explica el motivo exacto.
  - **Estructura Accionaria Compleja (Controlling Party):** Si el Acta Constitutiva menciona estructuras con más de 3 accionistas, fideicomisos, holdings o socios corporativos (personas morales), se activa la obligatoriedad de subir la información de Beneficiario Controlador.

### 6. Bitácora de Auditoría Completa
- Cada cambio de estado de cumplimiento, carga de documento o actualización de score se registra con fecha, hora, actor y estados previos/posteriores para fines de auditoría regulatoria.

---

## 📦 Instrucciones de Instalación Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/johanaguilar12/kyb-platform.git
cd kyb-platform
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto y agrega tus claves:
```env
DATABASE_URL="tu-postgres-connection-string"
GOOGLE_GEMINI_API_KEY="tu-gemini-api-key"
SUPABASE_ANON_KEY="tu-supabase-anon-key"
```

Crea un archivo `.env.local` para las descargas de las listas de datos abiertos del SAT:
```env
SAT_LIST_69_URL="https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGR/No_localizados.csv"
SAT_LIST_69B_URL="https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGAFF/Listado_completo_69-B.csv"
SAT_LIST_69B_BIS_URL="https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGGC/Listado_69_B_Bis_Completo.csv"
SAT_LIST_CSD_URL="https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGR/CSDsinefectos.csv"
```

### 4. Generar Cliente Prisma y Sincronizar Base de Datos
```bash
npx prisma generate
npx prisma db push # o npx prisma migrate dev si deseas aplicar las migraciones formales
```

### 5. Iniciar Servidor de Desarrollo
```bash
npm run dev
```
Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## 🧪 Ejecución de Pruebas Unitarias

Para validar toda la lógica de negocio (Score de riesgo, compresión PDF, conciliación, validación e integración SAT):
```bash
npm run test:run
```

---

## 🌐 Instrucciones de Despliegue en Vercel

Este proyecto está preconfigurado para compilarse y desplegarse en Vercel.

1. Instala e inicia sesión en la interfaz de Vercel:
   ```bash
   npx vercel login
   ```
2. Vincula el proyecto local:
   ```bash
   npx vercel link
   ```
3. Registra las variables de entorno en el panel de Vercel ( DATABASE_URL, GOOGLE_GEMINI_API_KEY, SUPABASE_ANON_KEY, y las URLs de listas SAT).
4. Sube y despliega a producción:
   ```bash
   npx vercel --prod
   ```

Las migraciones de base de datos se ejecutan automáticamente en el build pipeline mediante la instrucción `prisma generate && next build` declarada en `vercel.json`.

---

## ⚠️ Limitaciones Conocidas

1. **Dependencia de Portales Externos**: Si los servidores de descargas del SAT están inactivos, la consulta de datos en tiempo real fallará, recurriendo inmediatamente al caché de datos expirado (graceful fallback).
2. **Formato PDF**: Los archivos cargados deben ser PDFs válidos. Formatos de imagen directa (JPEG/PNG) no son soportados por el flujo de subida directo y deben convertirse a PDF previamente.

---

## 🔮 Futuras Mejoras

1. **Dashboard Multiusuario**: Implementar niveles de roles (auditor, administrador, visualizador) con autenticación basada en NextAuth.
2. **Re-evaluación Recurrente**: Crear una tarea cron programada que re-evalue semanalmente todos los RFCs contra las listas negras del SAT para emitir notificaciones proactivas de riesgo en expedientes ya aprobados.
3. **Integración OCR Mejorada**: Añadir pre-procesamiento local de mejora de imagen para actas constitutivas antiguas y digitalizadas con baja resolución.
