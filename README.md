# CASINO BRC - ANTO CAPUTO

MVP web privado para un grupo de amigos. Usa fichas ficticias, no procesa dinero real, no recibe pagos y no se integra con plataformas de apuestas.

La aplicación está hecha con HTML, CSS y JavaScript puro. El frontend se puede publicar en Vercel y usa una Google Sheet como base de datos a través de una Web App de Google Apps Script.

## Qué incluye

- Registro libre con nombre único y saldo inicial configurable.
- Login simple guardado en `localStorage`.
- Mercados `SI_NO`, `NOMBRE` y `OVER_UNDER`.
- Validación de saldo, estado del mercado y apuestas repetidas en el backend.
- Saldo, apuestas por estado, rankings e historial de movimientos.
- Panel de administración protegido por clave para Nico.
- Creación de mercados y opciones, edición de cuotas, cierre, resolución y cancelación.
- Pago automático de apuestas ganadas y devolución automática de mercados cancelados.
- Inicialización automática de las siete hojas, tres usuarios de prueba, 61 mercados y 383 opciones normalizadas desde `Casino Bariloche.docx`.

## Archivos

- `index.html`: estructura de la interfaz.
- `styles.css`: diseño responsive oscuro.
- `app.js`: interfaz, sesión y llamadas a la API.
- `apps-script.gs`: API, validaciones, lógica de negocio e inicialización de Google Sheets.
- `README.md`: instalación, prueba y datos transformados.

## 1. Crear la Google Sheet

1. Creá una hoja nueva en [Google Sheets](https://sheets.google.com/).
2. Copiá el ID desde la URL:

   ```text
   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
   ```

3. No hace falta crear las pestañas a mano: `setupCasino()` lo hace por vos.

Si preferís crearlas manualmente, deben llamarse exactamente así:

| Hoja | Columnas |
| --- | --- |
| `Config` | `clave`, `valor` |
| `Usuarios` | `id`, `usuario`, `saldo`, `rol`, `fecha_registro` |
| `Mercados` | `id`, `categoria`, `evento`, `tipo`, `estado`, `fecha_creacion` |
| `Opciones` | `id`, `mercado_id`, `opcion`, `linea`, `lado`, `cuota` |
| `Apuestas` | `id`, `usuario`, `mercado_id`, `opcion_id`, `opcion`, `tipo_mercado`, `lado`, `linea`, `monto`, `cuota`, `estado`, `pago`, `fecha` |
| `Resultados` | `mercado_id`, `resultado`, `opcion_id_ganadora`, `fecha_resolucion` |
| `Movimientos` | `id`, `usuario`, `tipo`, `monto`, `descripcion`, `fecha` |

## 2. Configurar Google Apps Script

1. En la Google Sheet, abrí **Extensiones → Apps Script**.
2. Borrá el contenido inicial del editor.
3. Copiá todo el contenido de `apps-script.gs`.
4. Reemplazá:

   ```js
   const SPREADSHEET_ID = "PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET";
   ```

   por el ID real.

5. Guardá el proyecto.
6. En el selector de funciones elegí `setupCasino` y presioná **Ejecutar**.
7. Google va a pedir autorización para acceder a la planilla. Elegí tu cuenta y aceptá los permisos.
8. Cuando termine, la función devuelve un objeto con la URL de la planilla y los conteos cargados.

`setupCasino()` es idempotente para la carga inicial: crea hojas faltantes, pero no duplica mercados u opciones si esas hojas ya contienen datos.

Documentación oficial: [autorización de Apps Script](https://developers.google.com/apps-script/guides/services/authorization).

## 3. Cambiar la clave de Nico

Abrí la hoja `Config` y reemplazá inmediatamente `cambiar_esta_clave`:

| clave | valor |
| --- | --- |
| `saldo_inicial` | `10000` |
| `admin_user` | `Nico` |
| `admin_password` | una clave privada |

No pongas esa clave en `app.js`, GitHub ni Vercel. Para este MVP la clave queda guardada como texto en la hoja `Config`; por eso la planilla no debe compartirse con usuarios que no deban verla.

## 4. Desplegar Apps Script como Web App

1. En Apps Script, elegí **Implementar → Nueva implementación**.
2. En **Seleccionar tipo**, elegí **Aplicación web**.
3. En **Ejecutar como**, seleccioná **Yo**. Así todas las operaciones usan el permiso del propietario de la planilla.
4. En **Quién tiene acceso**, elegí **Cualquier persona**. Es necesario para que el frontend estático pueda llamar a la API sin pedir una cuenta de Google a cada amigo.
5. Presioná **Implementar**.
6. Copiá la URL que termina en `/exec`. No uses la URL de prueba terminada en `/dev`.

Google documenta el flujo actualizado en [Web Apps de Apps Script](https://developers.google.com/apps-script/guides/web).

Cada vez que cambies `apps-script.gs`, guardá y creá una versión nueva desde **Implementar → Administrar implementaciones → Editar → Nueva versión**.

## 5. Conectar el frontend

En `app.js`, reemplazá:

```js
const API_URL = "PEGA_AQUI_LA_URL_DE_APPS_SCRIPT";
```

por la URL `/exec` copiada en el paso anterior:

```js
const API_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
```

El frontend envía JSON como `text/plain;charset=utf-8`. Ese tipo de contenido evita el preflight CORS que suele generar problemas con Web Apps de Apps Script. No agregues encabezados personalizados ni cambies el body a `application/json` sin volver a probar CORS.

## 6. Probar localmente

La opción más confiable es servir la carpeta con un servidor local.

Con Python:

```bash
python -m http.server 8000
```

Después abrí:

```text
http://localhost:8000
```

También podés usar la extensión Live Server de VS Code. Abrir `index.html` con doble clic puede funcionar, pero algunos navegadores restringen solicitudes desde páginas con origen `file://`.

## 7. Publicar en Vercel

### Opción simple: Vercel Drop

1. Entrá a [vercel.com/drop](https://vercel.com/drop).
2. Arrastrá la carpeta del proyecto.
3. Elegí el nombre del proyecto y desplegá.

Vercel detecta que no hay framework y publica los archivos estáticos tal como están.

### Opción recomendada para actualizaciones

1. Subí este proyecto a GitHub.
2. En Vercel elegí **Add New → Project**.
3. Importá el repositorio.
4. No configures framework, build command ni output directory.
5. Presioná **Deploy**.

Cada push posterior crea una implementación nueva. Ver: [documentación oficial de despliegues de Vercel](https://vercel.com/docs/deployments).

## 8. Probar el flujo completo

1. Ingresá como `Juanpi` o registrá otro nombre.
2. Verificá que el saldo inicial sea `10.000`.
3. Abrí un mercado, elegí una opción, cargá un monto y apostá.
4. Confirmá que:
   - el saldo baje inmediatamente;
   - la apuesta aparezca como `Abierta`;
   - exista un movimiento `Apuesta`.
5. Cerrá sesión e ingresá como `Nico`.
6. Abrí **Administración** e ingresá la clave de `Config`.
7. Cerrá el mercado.
8. Elegí una opción ganadora y resolvelo.
9. Volvé al usuario apostador y verificá:
   - `Ganada` si acertó o `Perdida` si no;
   - pago igual a `monto × cuota`;
   - saldo actualizado;
   - movimiento `Ganancia` si correspondía;
   - rankings actualizados.
10. Repetí con otro mercado y usá **Cancelar** para verificar el estado `Devuelta` y el movimiento `Devolucion`.

### Prueba específica de OVER_UNDER

En un mismo mercado:

- Apostá una vez a `Menos de`.
- Confirmá que ya no se pueda apostar a otro `Menos de`.
- Apostá una vez a `Más de`.
- Confirmá que no se permita una tercera apuesta.

Estas reglas se controlan en Apps Script aunque alguien intente saltarse la interfaz.

## API disponible

Todas las respuestas tienen una de estas formas:

```js
{ success: true, data: {}, message: "..." }
```

```js
{ success: false, error: "Mensaje claro" }
```

Acciones:

- `register`
- `login`
- `getConfig`
- `getUserData`
- `getMarkets`
- `placeBet`
- `getMyBets`
- `getRankingSaldo`
- `getRankingGanancias`
- `getMovements`
- `adminLogin`
- `adminCreateMarket`
- `adminCreateOption`
- `adminUpdateOdds`
- `adminCloseMarket`
- `adminResolveMarket`
- `adminCancelMarket`
- `adminGetAllBets`

## Reglas implementadas

- El saldo se descuenta al crear una apuesta.
- Una cuota queda copiada en la apuesta: editar la cuota después no cambia apuestas anteriores.
- `SI_NO` y `NOMBRE`: una apuesta total por usuario y mercado.
- `OVER_UNDER`: como máximo una apuesta `Menos de` y una `Más de`.
- Solo se apuesta en mercados `Abierto`.
- Solo una opción perteneciente al mercado puede recibir la apuesta.
- No se aceptan montos no numéricos, cero, negativos o mayores al saldo.
- La resolución no se puede repetir.
- Un mercado resuelto no se puede cancelar.
- Cancelar devuelve únicamente apuestas que todavía estaban `Abierta`.
- Las operaciones que modifican saldo usan `LockService` para evitar carreras entre solicitudes simultáneas.
- Los endpoints admin requieren rol `admin` y un token temporal obtenido con la clave de `Config`.

## Limitaciones de seguridad del MVP

- Los usuarios comunes no tienen contraseña. Cualquier persona que conozca un nombre registrado puede entrar con ese nombre.
- `localStorage` identifica la sesión solo en el dispositivo; no es autenticación fuerte.
- La clave admin está en la hoja `Config` y la sesión admin se guarda temporalmente en `CacheService`.
- La Web App debe ser accesible públicamente para que el frontend de Vercel pueda usarla.
- Google Sheets funciona bien para un grupo chico, pero no reemplaza una base transaccional para alta concurrencia.

## Normalización aplicada al documento

- Se convirtieron cuotas con coma decimal a punto decimal: `1,002` pasó a `1.002`.
- Se corrigieron signos, tildes, mayúsculas, espacios y textos pegados evidentes.
- `LBCD` y `LBDC` se unificaron como `LBCD`.
- Los bloques de “Especiales de Quebrados” quedaron en `Quebrados` y los de “Especiales de Peleas” en `Peleas`, porque son subsecciones y no categorías independientes.
- Los mercados de semana y día de salida se clasificaron como `NOMBRE`, ya que tienen una única lista de opciones.
- Los mercados que preguntan “más de…” pero ofrecen únicamente `Sí` y `No` se clasificaron como `SI_NO`.
- Los mercados con líneas y pares “Más de / Menos de” se clasificaron como `OVER_UNDER`.
- El bloque duplicado de Fran en “Cantidad de minas comidas” se fusionó y se conservó la versión completa.
- `Gonza Boca`, `Gonza R`, `Gonzas`, `Romi` y `Romi (novia)` no se fusionaron automáticamente cuando el documento podía estar distinguiendo personas u opciones distintas.

## Datos a revisar manualmente

1. **`Gonzas`** aparece como opción en “¿Quién hará la primera wachineada?”, mientras que en otras partes figuran `Gonza Boca` y `Gonza R`. Se mantuvo `Gonzas` porque podría significar “cualquiera de los Gonzalos”.
2. **`Romi`, `Especial Romi` y `Romi (novia)`** podrían referirse a una o más personas. Se normalizó `Especial Romi` como `Romi`, pero se conservó `Romi (novia)` como opción separada.
3. El título fuente **“inas diferentes llevadas a la pieza”** está truncado. Se interpretó como “Cantidad de minas diferentes llevadas a la pieza”.
4. El documento usa líneas enteras como `Más de 2` y `Menos de 2`. Un resultado exactamente igual a `2` no queda cubierto por ninguna opción. El admin igualmente resuelve eligiendo una opción, pero conviene acordar la regla antes del viaje.
5. La segunda “semana” figura como **8-15**, un rango de ocho días. Se respetó literalmente.
6. El mercado de día exacto solo ofrece del **1 al 15 de agosto**. No se agregaron fechas posteriores.
7. En “Cantidad de minas diferentes llevadas a la pieza por Gonza Boca”, la línea `1` tiene `Más de 1 = 1.10` y `Menos de 1 = 1.45`. Se conservaron ambas cuotas aunque resultan atípicas.
8. Varias cuotas son exactamente `1.00`, y algunas llegan hasta `10000.00`. Se conservaron sin límites artificiales.
9. `Biglia` aparece una sola vez en todo el documento. Se mantuvo como nombre válido.
10. La definición textual de “wachineada”, “quebrado”, “pelea” e Instagram no se guarda en las hojas actuales porque el esquema solicitado no tiene una columna de reglas. Conviene comunicar esas reglas por fuera de la app o agregar una columna `descripcion` en una versión futura.

## Datos iniciales para copiar a Google Sheets

No hace falta pegarlos manualmente si ejecutás `setupCasino()`. Los bloques siguientes están en formato TSV: copiá desde la primera fila y pegá en la celda `A1` de la hoja correspondiente.

<!-- SEED_DATA_START -->
### Hoja `Mercados`

```tsv
id	categoria	evento	tipo	estado	fecha_creacion
1	Wachineadas	¿Habrá una wachineada de Facu?	SI_NO	Abierto	2026-06-23
2	Wachineadas	¿Habrá una wachineada de Nachón?	SI_NO	Abierto	2026-06-23
3	Wachineadas	¿Habrá una wachineada de Dante?	SI_NO	Abierto	2026-06-23
4	Wachineadas	¿Quién hará la primera wachineada?	NOMBRE	Abierto	2026-06-23
5	Quebrados	¿Habrá al menos un quebrado durante el viaje?	SI_NO	Abierto	2026-06-23
6	Quebrados	¿Quién será el primer quebrado del viaje?	NOMBRE	Abierto	2026-06-23
7	Quebrados	¿Habrá más de 5 quebrados distintos durante el viaje?	SI_NO	Abierto	2026-06-23
8	Quebrados	¿Habrá un doble quebrado de la misma persona?	SI_NO	Abierto	2026-06-23
9	Quebrados	¿Gonza Boca será el primer quebrado?	SI_NO	Abierto	2026-06-23
10	Quebrados	¿El primer quebrado ocurrirá antes de la primera noche?	SI_NO	Abierto	2026-06-23
11	Peleas	¿Dos o más integrantes de LBCD se agarrarán a las piñas entre sí?	SI_NO	Abierto	2026-06-23
12	Peleas	¿Algún integrante de LBCD se agarrará a las piñas con alguien externo?	SI_NO	Abierto	2026-06-23
13	Peleas	¿Alguien la boqueará feo y después no hará nada?	SI_NO	Abierto	2026-06-23
14	Viaje	¿En qué semana de agosto sale el viaje?	NOMBRE	Abierto	2026-06-23
15	Viaje	¿Qué día de agosto despega el avión?	NOMBRE	Abierto	2026-06-23
16	Minas	¿Quién encarará más durante el viaje?	NOMBRE	Abierto	2026-06-23
17	Minas	Cantidad de minas comidas por Nico	OVER_UNDER	Abierto	2026-06-23
18	Minas	Cantidad de minas comidas por Juanpi	OVER_UNDER	Abierto	2026-06-23
19	Minas	Cantidad de minas comidas por Capu	OVER_UNDER	Abierto	2026-06-23
20	Minas	Cantidad de minas comidas por Jane	OVER_UNDER	Abierto	2026-06-23
21	Minas	Cantidad de minas comidas por Dante	OVER_UNDER	Abierto	2026-06-23
22	Minas	Cantidad de minas comidas por Gonza Boca	OVER_UNDER	Abierto	2026-06-23
23	Minas	Cantidad de minas comidas por Jesús	OVER_UNDER	Abierto	2026-06-23
24	Minas	Cantidad de minas comidas por Rocco	OVER_UNDER	Abierto	2026-06-23
25	Minas	Cantidad de minas comidas por Fran	OVER_UNDER	Abierto	2026-06-23
26	Minas	Cantidad de minas comidas por Pipa	OVER_UNDER	Abierto	2026-06-23
27	Minas	Cantidad de minas comidas por Gonza R	OVER_UNDER	Abierto	2026-06-23
28	Minas	Cantidad de minas comidas por Ivi	OVER_UNDER	Abierto	2026-06-23
29	Minas	¿Romi se come a una mina?	SI_NO	Abierto	2026-06-23
30	Minas	¿Quién se comerá más minas durante todo el viaje?	NOMBRE	Abierto	2026-06-23
31	Minas	Cantidad de minas diferentes llevadas a la pieza por Nico	OVER_UNDER	Abierto	2026-06-23
32	Minas	Cantidad de minas diferentes llevadas a la pieza por Juanpi	OVER_UNDER	Abierto	2026-06-23
33	Minas	Cantidad de minas diferentes llevadas a la pieza por Capu	OVER_UNDER	Abierto	2026-06-23
34	Minas	Cantidad de minas diferentes llevadas a la pieza por Jane	OVER_UNDER	Abierto	2026-06-23
35	Minas	Cantidad de minas diferentes llevadas a la pieza por Dante	OVER_UNDER	Abierto	2026-06-23
36	Minas	Cantidad de minas diferentes llevadas a la pieza por Gonza Boca	OVER_UNDER	Abierto	2026-06-23
37	Minas	Cantidad de minas diferentes llevadas a la pieza por Jesús	OVER_UNDER	Abierto	2026-06-23
38	Minas	Cantidad de minas diferentes llevadas a la pieza por Rocco	OVER_UNDER	Abierto	2026-06-23
39	Minas	Cantidad de minas diferentes llevadas a la pieza por Fran	OVER_UNDER	Abierto	2026-06-23
40	Minas	Cantidad de minas diferentes llevadas a la pieza por Pipa	OVER_UNDER	Abierto	2026-06-23
41	Minas	Cantidad de minas diferentes llevadas a la pieza por Ivi	OVER_UNDER	Abierto	2026-06-23
42	Minas	Cantidad de minas diferentes llevadas a la pieza por Gonza R	OVER_UNDER	Abierto	2026-06-23
43	Minas	Cantidad de minas diferentes llevadas a la pieza por Romi	OVER_UNDER	Abierto	2026-06-23
44	Minas	Cantidad total de minas llevadas a la pieza por Nico	OVER_UNDER	Abierto	2026-06-23
45	Minas	Cantidad total de minas llevadas a la pieza por Juanpi	OVER_UNDER	Abierto	2026-06-23
46	Minas	Cantidad total de minas llevadas a la pieza por Capu	OVER_UNDER	Abierto	2026-06-23
47	Minas	Cantidad total de minas llevadas a la pieza por Jane	OVER_UNDER	Abierto	2026-06-23
48	Minas	Cantidad total de minas llevadas a la pieza por Dante	OVER_UNDER	Abierto	2026-06-23
49	Minas	Cantidad total de minas llevadas a la pieza por Gonza Boca	OVER_UNDER	Abierto	2026-06-23
50	Minas	Cantidad total de minas llevadas a la pieza por Jesús	OVER_UNDER	Abierto	2026-06-23
51	Minas	Cantidad total de minas llevadas a la pieza por Rocco	OVER_UNDER	Abierto	2026-06-23
52	Minas	Cantidad total de minas llevadas a la pieza por Fran	OVER_UNDER	Abierto	2026-06-23
53	Minas	Cantidad total de minas llevadas a la pieza por Pipa	OVER_UNDER	Abierto	2026-06-23
54	Minas	Cantidad total de minas llevadas a la pieza por Ivi	OVER_UNDER	Abierto	2026-06-23
55	Minas	Cantidad total de minas llevadas a la pieza por Gonza R	OVER_UNDER	Abierto	2026-06-23
56	Minas	Cantidad total de minas llevadas a la pieza por Romi (novia)	OVER_UNDER	Abierto	2026-06-23
57	Minas	¿Alguien llevará minas a la pieza más de 5 veces durante todo el viaje?	SI_NO	Abierto	2026-06-23
58	Minas	¿Quién pedirá más Instagram durante el viaje?	NOMBRE	Abierto	2026-06-23
59	Minas	¿El líder de Instagram pedirá más de 15?	SI_NO	Abierto	2026-06-23
60	Minas	¿Alguien estará con la coordinadora?	SI_NO	Abierto	2026-06-23
61	Minas	¿Alguien conseguirá que la coordinadora le devuelva el follow?	SI_NO	Abierto	2026-06-23
```

### Hoja `Opciones`

```tsv
id	mercado_id	opcion	linea	lado	cuota
1	1	Sí			1.10
2	1	No			3.50
3	2	Sí			1.25
4	2	No			2.80
5	3	Sí			1.90
6	3	No			1.90
7	4	Facu			4.50
8	4	Nachón			5.00
9	4	Dante			7.00
10	4	Pipa			40.00
11	4	Romi			20.00
12	4	Nico			20.00
13	4	Juanpi			20.00
14	4	Joaco			20.00
15	4	Jane			20.00
16	4	Capu			20.00
17	4	Biglia			20.00
18	4	Fran			20.00
19	4	Gonzas			20.00
20	4	Jesús			20.00
21	4	Ivi			20.00
22	4	Rocco			20.00
23	5	Sí			1.02
24	5	No			15.00
25	6	Gonza Boca			3.50
26	6	Joaco			4.00
27	6	Romi			5.00
28	6	Nico			7.00
29	6	Facu			7.00
30	6	Rocco			7.00
31	6	Jane			9.00
32	6	Fran			9.00
33	6	Juanpi			20.00
34	6	Ivi			20.00
35	6	Pipa			20.00
36	6	Gonza R			20.00
37	6	Jesús			20.00
38	7	Sí			15.00
39	7	No			1.02
40	8	Sí			7.00
41	8	No			1.02
42	9	Sí			3.50
43	9	No			2.00
44	10	Sí			7.00
45	10	No			1.05
46	11	Sí			8.00
47	11	No			1.05
48	12	Sí			6.00
49	12	No			1.10
50	13	Sí			2.50
51	13	No			1.50
52	14	Primera semana (1-7)			1.85
53	14	Segunda semana (8-15)			1.85
54	15	1 de agosto			12.00
55	15	2 de agosto			10.00
56	15	3 de agosto			8.50
57	15	4 de agosto			7.00
58	15	5 de agosto			6.00
59	15	6 de agosto			5.50
60	15	7 de agosto			5.00
61	15	8 de agosto			4.80
62	15	9 de agosto			5.00
63	15	10 de agosto			5.50
64	15	11 de agosto			6.00
65	15	12 de agosto			7.00
66	15	13 de agosto			8.50
67	15	14 de agosto			10.00
68	15	15 de agosto			18.00
69	16	Nico			3.50
70	16	Juanpi			4.00
71	16	Capu			6.00
72	16	Jane			7.00
73	16	Dante			8.00
74	16	Gonza Boca			8.00
75	16	Jesús			12.00
76	16	Rocco			12.00
77	16	Fran			25.00
78	16	Pipa			50.00
79	16	Ivi			50.00
80	16	Gonza R			50.00
81	17	Menos de 2	2	Menos de	5.00
82	17	Más de 2	2	Más de	1.10
83	17	Menos de 4	4	Menos de	2.80
84	17	Más de 4	4	Más de	1.35
85	17	Menos de 5	5	Menos de	2.00
86	17	Más de 5	5	Más de	1.70
87	17	Menos de 6	6	Menos de	1.60
88	17	Más de 6	6	Más de	2.20
89	17	Menos de 7	7	Menos de	1.35
90	17	Más de 7	7	Más de	3.00
91	17	Menos de 8	8	Menos de	1.10
92	17	Más de 8	8	Más de	5.00
93	18	Menos de 2	2	Menos de	4.50
94	18	Más de 2	2	Más de	1.15
95	18	Menos de 4	4	Menos de	2.50
96	18	Más de 4	4	Más de	1.45
97	18	Menos de 5	5	Menos de	1.90
98	18	Más de 5	5	Más de	1.80
99	18	Menos de 6	6	Menos de	1.55
100	18	Más de 6	6	Más de	2.30
101	18	Menos de 7	7	Menos de	1.30
102	18	Más de 7	7	Más de	3.20
103	18	Menos de 8	8	Menos de	1.08
104	18	Más de 8	8	Más de	5.50
105	19	Menos de 2	2	Menos de	3.00
106	19	Más de 2	2	Más de	1.30
107	19	Menos de 4	4	Menos de	1.80
108	19	Más de 4	4	Más de	1.90
109	19	Menos de 5	5	Menos de	1.45
110	19	Más de 5	5	Más de	2.50
111	19	Menos de 6	6	Menos de	1.15
112	19	Más de 6	6	Más de	4.00
113	19	Menos de 7	7	Menos de	1.05
114	19	Más de 7	7	Más de	7.00
115	19	Menos de 8	8	Menos de	1.01
116	19	Más de 8	8	Más de	12.00
117	20	Menos de 2	2	Menos de	3.00
118	20	Más de 2	2	Más de	1.30
119	20	Menos de 4	4	Menos de	1.80
120	20	Más de 4	4	Más de	1.90
121	20	Menos de 5	5	Menos de	1.45
122	20	Más de 5	5	Más de	2.50
123	20	Menos de 6	6	Menos de	1.15
124	20	Más de 6	6	Más de	4.00
125	20	Menos de 7	7	Menos de	1.05
126	20	Más de 7	7	Más de	7.00
127	20	Menos de 8	8	Menos de	1.01
128	20	Más de 8	8	Más de	12.00
129	21	Menos de 2	2	Menos de	2.40
130	21	Más de 2	2	Más de	1.50
131	21	Menos de 4	4	Menos de	1.45
132	21	Más de 4	4	Más de	2.50
133	21	Menos de 5	5	Menos de	1.15
134	21	Más de 5	5	Más de	4.00
135	21	Menos de 6	6	Menos de	1.05
136	21	Más de 6	6	Más de	7.00
137	21	Menos de 7	7	Menos de	1.01
138	21	Más de 7	7	Más de	12.00
139	21	Menos de 8	8	Menos de	1.00
140	21	Más de 8	8	Más de	20.00
141	22	Menos de 2	2	Menos de	2.40
142	22	Más de 2	2	Más de	1.50
143	22	Menos de 4	4	Menos de	1.45
144	22	Más de 4	4	Más de	2.50
145	22	Menos de 5	5	Menos de	1.15
146	22	Más de 5	5	Más de	4.00
147	22	Menos de 6	6	Menos de	1.05
148	22	Más de 6	6	Más de	7.00
149	22	Menos de 7	7	Menos de	1.01
150	22	Más de 7	7	Más de	12.00
151	22	Menos de 8	8	Menos de	1.00
152	22	Más de 8	8	Más de	20.00
153	23	Menos de 2	2	Menos de	1.60
154	23	Más de 2	2	Más de	2.20
155	23	Menos de 4	4	Menos de	1.10
156	23	Más de 4	4	Más de	6.00
157	23	Menos de 5	5	Menos de	1.02
158	23	Más de 5	5	Más de	12.00
159	23	Menos de 6	6	Menos de	1.00
160	23	Más de 6	6	Más de	20.00
161	24	Menos de 2	2	Menos de	1.60
162	24	Más de 2	2	Más de	2.20
163	24	Menos de 4	4	Menos de	1.10
164	24	Más de 4	4	Más de	6.00
165	24	Menos de 5	5	Menos de	1.02
166	24	Más de 5	5	Más de	12.00
167	24	Menos de 6	6	Menos de	1.00
168	24	Más de 6	6	Más de	20.00
169	25	Menos de 2	2	Menos de	1.20
170	25	Más de 2	2	Más de	4.00
171	25	Menos de 4	4	Menos de	1.01
172	25	Más de 4	4	Más de	15.00
173	25	Menos de 5	5	Menos de	1.00
174	25	Más de 5	5	Más de	30.00
175	26	Menos de 2	2	Menos de	1.05
176	26	Más de 2	2	Más de	10.00
177	26	Menos de 4	4	Menos de	1.00
178	26	Más de 4	4	Más de	50.00
179	26	Menos de 5	5	Menos de	1.00
180	26	Más de 5	5	Más de	100.00
181	27	Menos de 2	2	Menos de	1.05
182	27	Más de 2	2	Más de	10.00
183	27	Menos de 4	4	Menos de	1.00
184	27	Más de 4	4	Más de	50.00
185	27	Menos de 5	5	Menos de	1.00
186	27	Más de 5	5	Más de	100.00
187	28	Menos de 2	2	Menos de	1.05
188	28	Más de 2	2	Más de	10.00
189	28	Menos de 4	4	Menos de	1.00
190	28	Más de 4	4	Más de	50.00
191	28	Menos de 5	5	Menos de	1.00
192	28	Más de 5	5	Más de	100.00
193	29	Sí			100.00
194	29	No			1.002
195	30	Nico			3.50
196	30	Juanpi			3.50
197	30	Capu			5.00
198	30	Jane			5.00
199	30	Dante			6.00
200	30	Gonza Boca			6.00
201	30	Jesús			10.00
202	30	Rocco			10.00
203	30	Fran			20.00
204	30	Pipa			50.00
205	30	Ivi			50.00
206	30	Gonza R			50.00
207	31	Menos de 1	1	Menos de	2.00
208	31	Más de 1	1	Más de	1.95
209	31	Menos de 2	2	Menos de	1.45
210	31	Más de 2	2	Más de	2.50
211	31	Menos de 3	3	Menos de	1.15
212	31	Más de 3	3	Más de	5.00
213	32	Menos de 1	1	Menos de	2.00
214	32	Más de 1	1	Más de	1.95
215	32	Menos de 2	2	Menos de	1.35
216	32	Más de 2	2	Más de	2.80
217	32	Menos de 3	3	Menos de	1.10
218	32	Más de 3	3	Más de	6.00
219	33	Menos de 1	1	Menos de	1.50
220	33	Más de 1	1	Más de	2.00
221	33	Menos de 2	2	Menos de	1.15
222	33	Más de 2	2	Más de	5.00
223	33	Menos de 3	3	Menos de	1.02
224	33	Más de 3	3	Más de	12.00
225	34	Menos de 1	1	Menos de	1.50
226	34	Más de 1	1	Más de	2.00
227	34	Menos de 2	2	Menos de	1.15
228	34	Más de 2	2	Más de	5.00
229	34	Menos de 3	3	Menos de	1.02
230	34	Más de 3	3	Más de	12.00
231	35	Menos de 1	1	Menos de	1.50
232	35	Más de 1	1	Más de	2.50
233	35	Menos de 2	2	Menos de	1.08
234	35	Más de 2	2	Más de	7.00
235	35	Menos de 3	3	Menos de	1.01
236	35	Más de 3	3	Más de	15.00
237	36	Menos de 1	1	Menos de	1.45
238	36	Más de 1	1	Más de	1.10
239	36	Menos de 2	2	Menos de	1.08
240	36	Más de 2	2	Más de	3.00
241	36	Menos de 3	3	Menos de	1.01
242	36	Más de 3	3	Más de	15.00
243	37	Menos de 1	1	Menos de	1.20
244	37	Más de 1	1	Más de	3.00
245	37	Menos de 2	2	Menos de	1.02
246	37	Más de 2	2	Más de	12.00
247	37	Menos de 3	3	Menos de	1.00
248	37	Más de 3	3	Más de	25.00
249	38	Menos de 1	1	Menos de	1.20
250	38	Más de 1	1	Más de	3.00
251	38	Menos de 2	2	Menos de	1.02
252	38	Más de 2	2	Más de	12.00
253	38	Menos de 3	3	Menos de	1.00
254	38	Más de 3	3	Más de	25.00
255	39	Menos de 1	1	Menos de	1.08
256	39	Más de 1	1	Más de	7.00
257	39	Menos de 2	2	Menos de	1.01
258	39	Más de 2	2	Más de	25.00
259	39	Menos de 3	3	Menos de	1.00
260	39	Más de 3	3	Más de	60.00
261	40	Menos de 1	1	Menos de	1.02
262	40	Más de 1	1	Más de	20.00
263	40	Menos de 2	2	Menos de	1.00
264	40	Más de 2	2	Más de	75.00
265	40	Menos de 3	3	Menos de	1.00
266	40	Más de 3	3	Más de	150.00
267	41	Menos de 1	1	Menos de	1.02
268	41	Más de 1	1	Más de	20.00
269	41	Menos de 2	2	Menos de	1.00
270	41	Más de 2	2	Más de	75.00
271	41	Menos de 3	3	Menos de	1.00
272	41	Más de 3	3	Más de	150.00
273	42	Menos de 1	1	Menos de	1.02
274	42	Más de 1	1	Más de	20.00
275	42	Menos de 2	2	Menos de	1.00
276	42	Más de 2	2	Más de	75.00
277	42	Menos de 3	3	Menos de	1.00
278	42	Más de 3	3	Más de	150.00
279	43	Menos de 1	1	Menos de	1.00
280	43	Más de 1	1	Más de	300.00
281	43	Menos de 2	2	Menos de	1.00
282	43	Más de 2	2	Más de	1000.00
283	43	Menos de 3	3	Menos de	1.00
284	43	Más de 3	3	Más de	5000.00
285	44	Menos de 1	1	Menos de	3.50
286	44	Más de 1	1	Más de	1.25
287	44	Menos de 3	3	Menos de	1.35
288	44	Más de 3	3	Más de	2.80
289	44	Menos de 5	5	Menos de	1.03
290	44	Más de 5	5	Más de	15.00
291	45	Menos de 1	1	Menos de	3.20
292	45	Más de 1	1	Más de	1.30
293	45	Menos de 3	3	Menos de	1.30
294	45	Más de 3	3	Más de	3.00
295	45	Menos de 5	5	Menos de	1.02
296	45	Más de 5	5	Más de	18.00
297	46	Menos de 1	1	Menos de	2.20
298	46	Más de 1	1	Más de	1.60
299	46	Menos de 3	3	Menos de	1.15
300	46	Más de 3	3	Más de	5.00
301	46	Menos de 5	5	Menos de	1.01
302	46	Más de 5	5	Más de	30.00
303	47	Menos de 1	1	Menos de	2.20
304	47	Más de 1	1	Más de	1.60
305	47	Menos de 3	3	Menos de	1.15
306	47	Más de 3	3	Más de	5.00
307	47	Menos de 5	5	Menos de	1.01
308	47	Más de 5	5	Más de	30.00
309	48	Menos de 1	1	Menos de	1.70
310	48	Más de 1	1	Más de	2.00
311	48	Menos de 3	3	Menos de	1.08
312	48	Más de 3	3	Más de	7.00
313	48	Menos de 5	5	Menos de	1.00
314	48	Más de 5	5	Más de	40.00
315	49	Menos de 1	1	Menos de	1.70
316	49	Más de 1	1	Más de	2.00
317	49	Menos de 3	3	Menos de	1.08
318	49	Más de 3	3	Más de	7.00
319	49	Menos de 5	5	Menos de	1.00
320	49	Más de 5	5	Más de	40.00
321	50	Menos de 1	1	Menos de	1.25
322	50	Más de 1	1	Más de	3.50
323	50	Menos de 3	3	Menos de	1.03
324	50	Más de 3	3	Más de	15.00
325	50	Menos de 5	5	Menos de	1.00
326	50	Más de 5	5	Más de	75.00
327	51	Menos de 1	1	Menos de	1.25
328	51	Más de 1	1	Más de	3.50
329	51	Menos de 3	3	Menos de	1.03
330	51	Más de 3	3	Más de	15.00
331	51	Menos de 5	5	Menos de	1.00
332	51	Más de 5	5	Más de	75.00
333	52	Menos de 1	1	Menos de	1.06
334	52	Más de 1	1	Más de	8.00
335	52	Menos de 3	3	Menos de	1.00
336	52	Más de 3	3	Más de	40.00
337	52	Menos de 5	5	Menos de	1.00
338	52	Más de 5	5	Más de	150.00
339	53	Menos de 1	1	Menos de	1.01
340	53	Más de 1	1	Más de	25.00
341	53	Menos de 3	3	Menos de	1.00
342	53	Más de 3	3	Más de	150.00
343	53	Menos de 5	5	Menos de	1.00
344	53	Más de 5	5	Más de	500.00
345	54	Menos de 1	1	Menos de	1.01
346	54	Más de 1	1	Más de	25.00
347	54	Menos de 3	3	Menos de	1.00
348	54	Más de 3	3	Más de	150.00
349	54	Menos de 5	5	Menos de	1.00
350	54	Más de 5	5	Más de	500.00
351	55	Menos de 1	1	Menos de	1.01
352	55	Más de 1	1	Más de	25.00
353	55	Menos de 3	3	Menos de	1.00
354	55	Más de 3	3	Más de	150.00
355	55	Menos de 5	5	Menos de	1.00
356	55	Más de 5	5	Más de	500.00
357	56	Menos de 1	1	Menos de	1.00
358	56	Más de 1	1	Más de	300.00
359	56	Menos de 3	3	Menos de	1.00
360	56	Más de 3	3	Más de	3000.00
361	56	Menos de 5	5	Menos de	1.00
362	56	Más de 5	5	Más de	10000.00
363	57	Sí			8.00
364	57	No			1.002
365	58	Nico			3.50
366	58	Juanpi			4.00
367	58	Capu			5.00
368	58	Jane			5.50
369	58	Dante			6.00
370	58	Gonza Boca			6.00
371	58	Jesús			8.00
372	58	Rocco			8.00
373	58	Fran			12.00
374	58	Pipa			20.00
375	58	Ivi			20.00
376	58	Gonza R			20.00
377	58	Romi			30.00
378	59	Sí			2.20
379	59	No			1.30
380	60	Sí			15.00
381	60	No			1.01
382	61	Sí			4.00
383	61	No			1.02
```
<!-- SEED_DATA_END -->

## Mejoras futuras sugeridas

- Autenticación real o PIN individual.
- Columna de reglas/descripción por mercado.
- Auditoría de acciones administrativas.
- Cierre automático por fecha y hora.
- Notificaciones y actualización automática.
- Exportación de resultados y estadísticas por viaje.

