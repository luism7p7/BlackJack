# test_server.py (CORREGIDO SIN PATH)
import asyncio
import websockets
import logging

logging.basicConfig(level=logging.INFO)

async def my_simple_handler(websocket): # <--- CAMBIO AQUÍ, SIN PATH
    #Cuando un cliente se conecta a este servidor de prueba, esta función lo maneja.
    logging.info(f"Conexión recibida de {websocket.remote_address}") # anota quien se conecto
    try:
        async for message in websocket:# espera a que el cliente envia un mensaje
            logging.info(f"Mensaje recibido: {message}")# anota el mensaje que llego
            await websocket.send(f"Eco: {message}")# envía un eco de vuelta al cliente si el dice algo
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"Conexión cerrada desde {websocket.remote_address}")
    finally:
        logging.info(f"Handler para {websocket.remote_address} finalizado.")

async def main(): # prueba (inicio del servidor)
    host = "0.0.0.0"#host para escuchar conexiones de cualquier IP
    port = 8765
    logging.info(f"Servidor de prueba iniciando en ws://{host}:{port}")
    async with websockets.serve(my_simple_handler, host, port):#Inicia el servidor, pero esta vez,
        #le dice que use my_simple_handler para las conexiones.
        await asyncio.Future()

if __name__ == "__main__":# paa ejecutarlo directamente
    asyncio.run(main())