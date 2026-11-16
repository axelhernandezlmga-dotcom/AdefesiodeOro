# El Adefesio de Oro

Votación en tiempo real para elegir el peor regalo de la Familia Hernández Pose.
La compu se conecta a la tele y muestra la presentación; cada uno vota desde su celular.

## Cómo arrancarlo

```bash
npm install
npm start
```

Al arrancar, la consola muestra la dirección local, por ejemplo:

```
Tele / compu (admin):  http://192.168.1.23:3000/admin
Celulares (votar):     http://192.168.1.23:3000
```

Si la IP que muestra no es la del WiFi (pasa con VPNs o máquinas virtuales), mirá la lista de
"Otras IPs detectadas" o forzala: `HOST_IP=192.168.1.23 npm start`.

## Importante: todos en el mismo WiFi

La compu y todos los celulares tienen que estar conectados a la **misma red WiFi** de la casa.
Si el celular no abre la página, revisá que no esté usando datos móviles y que el firewall de la
compu deje pasar el puerto 3000.

## Conectar la compu a la tele

1. Conectá la compu a la tele con un cable HDMI (o duplicá la pantalla por Chromecast / AirPlay).
2. En la compu, poné la pantalla en modo **duplicar** (o mové el navegador a la tele).
3. Abrí `http://localhost:3000/admin` en Chrome.
4. Tocá **Iniciar**, cargá los nombres (nombre, Enter, nombre, Enter...) y **Iniciar votación**.
   Se pone en pantalla completa sola (si no, apretá `F`). `M` silencia el sonido.

## Cómo se vota

1. Escanean el QR de la tele (o entran a la dirección que aparece abajo del QR).
2. Eligen quién son.
3. Votan a otra persona (no se pueden votar a sí mismos).

Cuando votaron todos, la tele muestra **Revelar ganador**. Si falta alguien, el botón chico
**Cerrar votación y revelar** permite cerrar igual. Si hay empate, aparece **Desempate**.

## Rutas

| Ruta | Para qué |
|------|----------|
| `/` | Detecta si es celular o compu y redirige |
| `/admin` | Panel y presentación (tele) |
| `/votar` | Vista del celular |
| `/admin?demo=1` | Muestra los botones **Demo** y **Demo con empate**: 8 participantes falsos votan solos |

## Detalles

- El estado se guarda en `state.json`: si se reinicia el servidor, la votación sigue donde estaba.
  Para empezar de cero, usá el botón de reiniciar (esquina superior derecha) o borrá ese archivo.
- Si alguien recarga el celular o se le bloquea, vuelve a su pantalla (queda asociado a su nombre).
- Si alguien eligió un nombre por error, puede tocar "No soy ..." antes de votar.
