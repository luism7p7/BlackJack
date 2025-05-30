#!/usr/bin/env python

import asyncio
import json
import websockets
import logging
import uuid
import random
from websockets.protocol import State

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s [%(filename)s:%(lineno)d]: %(message)s')

# --- CLASES Card, DeckPython, PlayerPython, BlackjackGamePython ---
# (Las clases completas como las tenías en la versión anterior,
#  incluyendo la corrección en PlayerPython.to_dict para las fichas del crupier)

class Card:#Define cómo es una carta
    def __init__(self, suit, value): self.suit = suit; self.value = value
    def __str__(self): return f"{self.value}{self.suit[0]}"
    def to_dict(self): return {"suit": self.suit, "value": self.value}# metodo para convertir la carta a un formanto JSON
class DeckPython:#mazo de cartas, puede tener varias barajas
    #Define cómo es un mazo. Sabe cuántas barajas usar, cuáles son todos los palos y valores posibles.
    def __init__(self, num_decks=1): self.cards = []; self.num_decks = num_decks; self.suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades']; self.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']; self.build(); self.shuffle()
    def build(self): self.cards = []; [self.cards.append(Card(s, v)) for _ in range(self.num_decks) for s in self.suits for v in self.values]# crea el mazo de cartas
    def shuffle(self): random.shuffle(self.cards)# barajar el mazo
    def deal(self):# saca una carta del mazo
        # Si el mazo está vacío, se crea un nuevo mazo y lo baraja de nuevo.
        if not self.cards: logging.warning("Mazo vacío..."); self.build(); self.shuffle()
        return self.cards.pop() if self.cards else None
class PlayerPython:# Define cómo es un jugador, sus cartas, fichas, apuestas y acciones
    def __init__(self, websocket, player_id_in_game, name, initial_chips=100):
        self.websocket = websocket; self.id_in_game = player_id_in_game; self.server_player_id = str(uuid.uuid4()); self.name = name
        self.chips = initial_chips; self.hand = []; self.current_bet = 0; self.is_done = False; self.is_bust = False; self.has_blackjack = False; self.round_message = ""
    def add_card(self, card): self.hand.append(card); self.update_status()#Recibe una carta y la añade a su mano. Luego llama a "update_status()."
    def get_hand_value(self):#Suma los puntos de sus cartas. Sabe que las J, Q, K valen 10 y que el As puede valer 1 u 11
        val, aces = 0, 0
        for c in self.hand:
            if c.value in ['J','Q','K']: val+=10
            elif c.value == 'A': val+=11; aces+=1
            else: val += int(c.value)
        while val > 21 and aces > 0: val-=10; aces-=1
        return val
    def update_status(self): hv=self.get_hand_value(); self.is_bust=hv>21; self.has_blackjack=(hv==21 and len(self.hand)==2); self.is_done = True if self.is_bust else self.is_done 
    #   Después de recibir una carta o al inicio, revisa si se pasó de 21 o si tiene Blackjack.
    def place_bet(self, amount):
        if amount<=0 or amount>self.chips: self.round_message="Apuesta inválida."; return False
        self.chips-=amount; self.current_bet=amount; self.round_message=f"Apostó {amount}F."; return True
    def win_bet(self, bj=False): self.chips += self.current_bet + (int(self.current_bet*1.5) if bj else self.current_bet)
    def lose_bet(self): pass
    def push_bet(self): self.chips += self.current_bet
    def reset_for_new_round(self): self.hand=[]; self.current_bet=0; self.is_done=False; self.is_bust=False; self.has_blackjack=False; self.round_message=""
    #limpia la ronda para al siguientes ronda
    def to_dict(self, reveal_hand=True):# prepara un diccionario con la información del jugador, para enviar al cliente
        chips_to_send = None if self.id_in_game == "crupier" else self.chips
        hand_to_show = []
        if reveal_hand: hand_to_show = [card.to_dict() for card in self.hand]
        elif self.hand: hand_to_show = [self.hand[0].to_dict()] + ([{"suit": "Hidden", "value": "?"}] if len(self.hand) > 1 else [])
        points_to_show = "?"
        if reveal_hand or (self.id_in_game == "crupier" and (self.has_blackjack or self.is_done)): points_to_show = self.get_hand_value()
        elif self.id_in_game != "crupier": points_to_show = self.get_hand_value()
        return {"id":self.id_in_game,"name":self.name,"chips":chips_to_send,"hand":hand_to_show,"points":points_to_show,"currentBet":self.current_bet,
                "isDone":self.is_done,"isBust":self.is_bust,"hasBlackjack":self.has_blackjack,"roundMessage":self.round_message}

class BlackjackGamePython:# partida del blackjack
    def __init__(self, game_id, p1_ws):# necesita id partida y conexion del primer jugador,
        #el prepara todo para que el segundo llegue
        self.game_id=game_id; self.deck=DeckPython(); self.player1=PlayerPython(p1_ws,"player1","Jugador 1")
        self.player2=None; self.crupier=PlayerPython(None,"crupier","Crupier",float('inf'))
        self.players_in_game={p1_ws:self.player1}; self.game_phase="WAITING_FOR_PLAYER2"#control de apuestas
        self.bets_placed={"player1":False,"player2":False}# aqui se sabe quien aposto
        logging.info(f"Juego {self.game_id} por P1({self.player1.server_player_id}). Esperando P2.")
    def add_player2(self, p2_ws):#añade al segndo jugador
        if not self.player2:
            self.player2=PlayerPython(p2_ws,"player2","Jugador 2"); self.players_in_game[p2_ws]=self.player2
            self.game_phase="BETTING"; logging.info(f"P2({self.player2.server_player_id}) se unió {self.game_id}. Fase Apuestas."); return True
        return False
    async def broadcast_game_state(self, spec_ws=None):
        # envia en voz la informacion actualizada del juego a todos los jugadores conectados
        for ws, p_obj_loop in self.players_in_game.items():
            if not ws: continue
            if ws.state != State.OPEN: logging.warning(f"BC_STATE: Socket {p_obj_loop.server_player_id} no abierto. Saltando."); continue
            rev_crup = (self.crupier.is_done or self.crupier.has_blackjack or self.game_phase=="ROUND_OVER")
            state={"gameId":self.game_id,"gamePhase":self.game_phase, "player1":self.player1.to_dict(True),"player2":self.player2.to_dict(True) if self.player2 else None,
                   "crupier":self.crupier.to_dict(rev_crup), "currentTurn":self.game_phase if "TURN" in self.game_phase else None}
            if spec_ws and ws!=spec_ws: continue
            try: await ws.send(json.dumps({"type":"GAME_STATE_UPDATE","payload":state}))
            except websockets.exceptions.ConnectionClosed: logging.warning(f"BC_STATE: Conn cerrada {p_obj_loop.server_player_id}")
        if spec_ws is None: logging.info(f"J{self.game_id}: Estado enviado. Fase:{self.game_phase}")

    async def start_new_round(self):# reinicia todo para una nueva ronda
        self.player1.reset_for_new_round(); 
        if self.player2: self.player2.reset_for_new_round()
        self.crupier.reset_for_new_round(); self.deck=DeckPython()
        self.bets_placed={"player1":False,"player2":False}; self.game_phase="BETTING"
        logging.info(f"J{self.game_id}: Nueva ronda, apuestas."); await self.broadcast_game_state()

    async def handle_bet(self, player_obj, amount):
        #Procesa la apuesta de un jugador. Si ya todos los jugadores necesarios han apostado, llama a deal_initial_cards().
        logging.info(f"DEBUG handle_bet: Recibido para player_obj.id_in_game: {player_obj.id_in_game}, player_obj.name: {player_obj.name}") # LOG AÑADIDO
        if self.game_phase!="BETTING": await self.send_error_to_player(player_obj,"No es fase apuestas."); return
        if player_obj.place_bet(amount):
            self.bets_placed[player_obj.id_in_game]=True; logging.info(f"J{self.game_id}: {player_obj.name} apostó {amount} (id_in_game: {player_obj.id_in_game}). Bets placed: {self.bets_placed}") # LOG MEJORADO
            await self.broadcast_game_state()
            all_bets_in = (self.bets_placed.get("player1") and self.bets_placed.get("player2")) if self.player2 else self.bets_placed.get("player1")
            logging.info(f"J{self.game_id}: Chequeando todas las apuestas: {all_bets_in}. Bets: {self.bets_placed}") # LOG AÑADIDO
            if all_bets_in: await self.deal_initial_cards()
        else: await self.send_error_to_player(player_obj, player_obj.round_message)
    
    async def deal_initial_cards(self):# reparte las cartas a los jugadores, verifica si hay blackjack
        logging.info(f"J{self.game_id}: Repartiendo cartas.")
        # ... (resto de deal_initial_cards como antes) ...
        [p.add_card(self.deck.deal()) for _ in range(2) for p in [self.player1, self.player2, self.crupier] if p]
        p1bj,p2bj,cbj = self.player1.has_blackjack,self.player2.has_blackjack if self.player2 else False,self.crupier.has_blackjack
        if p1bj: self.player1.is_done=True; msg,fn="¡BJ!" if not cbj else "Empate BJ",self.player1.win_bet if not cbj else self.player1.push_bet; fn(True) if not cbj else fn(); self.player1.round_message=msg
        elif cbj: self.player1.is_done=True;self.player1.lose_bet();self.player1.round_message="Pierde(Crupier BJ)"
        if self.player2:
            if p2bj: self.player2.is_done=True; msg,fn="¡BJ!" if not cbj else "Empate BJ",self.player2.win_bet if not cbj else self.player2.push_bet; fn(True) if not cbj else fn(); self.player2.round_message=msg
            elif cbj: self.player2.is_done=True;self.player2.lose_bet();self.player2.round_message="Pierde(Crupier BJ)"
        next_phase_determined = False
        if self.player1.is_done and (not self.player2 or self.player2.is_done):
            if cbj or self.all_human_players_bust_or_bj(): self.game_phase="ROUND_OVER"; await self.finalize_round_results(); next_phase_determined=True
            else: self.game_phase="CRUPIER_TURN"; await self.play_crupier_turn(); next_phase_determined=True
        elif not self.player1.is_done: self.game_phase="PLAYER1_TURN"; next_phase_determined=True
        elif self.player2 and not self.player2.is_done: self.game_phase="PLAYER2_TURN"; next_phase_determined=True
        if next_phase_determined: await self.broadcast_game_state()

    def all_human_players_bust_or_bj(self):
        # ... (sin cambios) ...
        p1r=self.player1.is_bust or self.player1.has_blackjack
        return p1r and (self.player2.is_bust or self.player2.has_blackjack) if self.player2 else p1r

    async def handle_player_action(self, p_obj, action):
        #Cuando un jugador dice "HIT" (pedir) o "STAND" (plantarse).
        exp_ph=f"{p_obj.id_in_game.upper()}_TURN"
        if self.game_phase!=exp_ph or p_obj.is_done: await self.send_error_to_player(p_obj,"No es tu turno/terminaste."); return
        if action=="HIT":
            p_obj.add_card(self.deck.deal()); p_obj.round_message=f"Pidió. Pts:{p_obj.get_hand_value()}"
            if p_obj.is_bust: p_obj.round_message=f"Pasó({p_obj.get_hand_value()}).Pierde.";p_obj.lose_bet()
            elif p_obj.get_hand_value()==21: p_obj.round_message="21.Planta."
            if p_obj.is_bust or p_obj.get_hand_value()==21: p_obj.is_done=True
        elif action=="STAND": p_obj.is_done=True;p_obj.round_message=f"Plantó({p_obj.get_hand_value()})."
        await self.broadcast_game_state()
        if p_obj.is_done:
            if self.game_phase=="PLAYER1_TURN": self.game_phase="PLAYER2_TURN" if self.player2 and not self.player2.is_done else "CRUPIER_TURN"
            elif self.game_phase=="PLAYER2_TURN": self.game_phase="CRUPIER_TURN"
            if self.game_phase=="CRUPIER_TURN": await self.play_crupier_turn()
            elif self.game_phase != exp_ph: await self.broadcast_game_state()

    async def play_crupier_turn(self):# el crupier revela su carta y juega su turno
        # ... (sin cambios) ...
        logging.info(f"J{self.game_id}: Turno Crupier.");self.crupier.is_done=False
        if self.all_human_players_bust_or_bj() and not self.crupier.has_blackjack: self.crupier.round_message="Gana(todos pasaron/BJ)";self.crupier.is_done=True
        else:
            while self.crupier.get_hand_value()<17 and not self.crupier.is_bust: self.crupier.add_card(self.deck.deal())
            self.crupier.is_done=True; self.crupier.round_message=f"Crupier pasó({self.crupier.get_hand_value()})" if self.crupier.is_bust else f"Crupier planta({self.crupier.get_hand_value()})"
        self.game_phase="ROUND_OVER";await self.finalize_round_results();await self.broadcast_game_state()

    async def finalize_round_results(self):
        # compara la mano de los jugadores y determina quien gana, pierde o empata
        # ... (sin cambios) ...
        logging.info(f"J{self.game_id}: Finalizando."); c_val,c_bust=self.crupier.get_hand_value(),self.crupier.is_bust
        for p_obj in [self.player1, self.player2]:
            if not p_obj or p_obj.has_blackjack or p_obj.is_bust: continue
            p_val=p_obj.get_hand_value()
            if c_bust or p_val>c_val: p_obj.win_bet();p_obj.round_message=f"Gana {p_val}vs{c_val if not c_bust else'BustC'}"
            elif p_val<c_val: p_obj.lose_bet();p_obj.round_message=f"Pierde {p_val}vs{c_val}"
            else: p_obj.push_bet();p_obj.round_message=f"Empate {p_val}vs{c_val}"

    async def send_error_to_player(self, player_obj, error_message):# si un jugador intenta algo que no es, le envia un error
        # ... (sin cambios, ya usaba State.OPEN) ...
        logging.warning(f"Error para {player_obj.server_player_id}: {error_message}")
        if player_obj.websocket and player_obj.websocket.state == State.OPEN:
            try: await player_obj.websocket.send(json.dumps({"type": "ERROR", "payload": {"message": error_message}}))
            except websockets.exceptions.ConnectionClosed: pass

# --- Variables Globales del Servidor ---
#El servidor necesita recordarcosas entre diferentes conexiones y partidas
CONNECTED_CLIENTS = {} # define los clientes conectados al servidor y sus objetos PlayerPython 
ACTIVE_GAMES = {}    #mesas blackjack activas
PENDING_GAME = None  # por si un jugador esta sperando al otro jugador, se crea una nueva mesa

# --- Manejadores del Servidor WebSocket ---
# Este manejador recibe mensajes de los clientes y los procesa
# estas son las funciones principales que hacen que el servidor funcione
async def handle_client_message(websocket, message_str):# jefe de la mesa o crupier principal
    global PENDING_GAME
    client_global_player_obj = CONNECTED_CLIENTS.get(websocket) # Este es el PlayerPython temporal de connection_handler_main
    # Recibiendo una orden: Esta función toma el mensaje que envió el jugador (que connection_handler_main le pasó).
    try:
        message = json.loads(message_str) #El mensaje viene como texto (message_str), así que primero lo convierte de JSON a un formato que Python pueda entender
        msg_type, payload = message.get("type"), message.get("payload", {})# entiende el tipo de mensaje y su contenido
        player_log_id = client_global_player_obj.server_player_id if client_global_player_obj else '??'
        
        game_id_from_client, game = payload.get("gameId"), None
        if game_id_from_client: 
            game = ACTIVE_GAMES.get(game_id_from_client)
        
        player_in_game_obj = None
        if game:
            if game.player1 and game.player1.websocket == websocket:
                player_in_game_obj = game.player1
                player_log_id = game.player1.server_player_id # Usar el ID del jugador del juego para logs
            elif game.player2 and game.player2.websocket == websocket:
                player_in_game_obj = game.player2
                player_log_id = game.player2.server_player_id # Usar el ID del jugador del juego para logs
        
        logging.info(f"Msg de {player_log_id}: {msg_type}, Payload: {payload}")


        if msg_type == "JOIN_GAME_REQUEST": # si el jugador quizo esta funcion, entonces
            #Primero, revisa si este jugador ya está en alguna otra partida. Si es así, le dice "ya estás jugando".
            already_in_game = False
            for existing_game_id, existing_game in ACTIVE_GAMES.items(): # Iterar sobre items para tener game_id
                if (existing_game.player1 and existing_game.player1.websocket == websocket) or \
                   (existing_game.player2 and existing_game.player2.websocket == websocket):
                    logging.warning(f"Websocket {websocket.remote_address} ({player_log_id}) ya está en el juego {existing_game_id}. Ignorando JOIN_GAME_REQUEST.")
                    await websocket.send(json.dumps({"type": "ERROR", "payload": {"message": f"Ya estás en el juego {existing_game_id}."}})) # Informar al cliente
                    already_in_game = True
                    break
            
            if not already_in_game:
                if PENDING_GAME is None:#Si no está en otra partida, mira si hay una PENDING_GAME (una mesa con un jugador esperando):
                    new_gid = str(uuid.uuid4())[:8]; PENDING_GAME = BlackjackGamePython(new_gid, websocket)
                    ACTIVE_GAMES[new_gid] = PENDING_GAME
                    CONNECTED_CLIENTS[websocket] = PENDING_GAME.player1 # PlayerPython real del juego
                    await websocket.send(json.dumps({"type": "GAME_CREATED", "payload": {"gameId": new_gid, "playerId": "player1", "serverPlayerId": PENDING_GAME.player1.server_player_id}}))
                    await PENDING_GAME.broadcast_game_state()
                else:
                    # el jugador esperando (PENDING_GAME) ya tiene un jugador esperando, entonces este jugador se une como P2
                    if PENDING_GAME.player1 and PENDING_GAME.player1.websocket == websocket:
                        logging.warning(f"Websocket {websocket.remote_address} ({player_log_id}) intentó unirse a su propio juego pendiente como P2. Ignorando.")
                        await websocket.send(json.dumps({"type": "ERROR", "payload": {"message": "No puedes unirte a tu propio juego como oponente."}}))
                    elif PENDING_GAME.add_player2(websocket):
                        CONNECTED_CLIENTS[websocket] = PENDING_GAME.player2 # PlayerPython real del juego
                        await websocket.send(json.dumps({"type": "JOINED_GAME", "payload": {"gameId": PENDING_GAME.game_id, "playerId": "player2", "serverPlayerId": PENDING_GAME.player2.server_player_id}}))
                        if PENDING_GAME.player1 and PENDING_GAME.player1.websocket:
                             await PENDING_GAME.player1.websocket.send(json.dumps({"type": "OPPONENT_JOINED", "payload": {"opponentName": PENDING_GAME.player2.name, "opponentId": PENDING_GAME.player2.server_player_id}}))
                        logging.info(f"Juego {PENDING_GAME.game_id} completo. Fase apuestas.")
                        await PENDING_GAME.broadcast_game_state()
                        PENDING_GAME = None
                    else: await websocket.send(json.dumps({"type": "ERROR", "payload": {"message": "Juego pendiente lleno o error."}}))
        
        elif game and player_in_game_obj: # Solo procesar si el juego existe Y el websocket corresponde a un jugador en ese juego
            logging.info(f"DEBUG handle_client_message: Procesando para player_in_game_obj.id_in_game: {player_in_game_obj.id_in_game}, player_in_game_obj.name: {player_in_game_obj.name}") # LOG AÑADIDO
            if msg_type == "PLACE_BET": await game.handle_bet(player_in_game_obj, payload.get("amount",0))
            # si es "PLACE_BET": Le pasa la información de la apuesta (quién apostó y cuánto) al objeto BlackjackGamePython correspondiente para que la procese (game.handle_bet()).
            elif msg_type == "PLAYER_ACTION": await game.handle_player_action(player_in_game_obj, payload.get("action"))
            #Si es "PLAYER_ACTION" (HIT o STAND): Le pasa la acción al objeto BlackjackGamePython (game.handle_player_action())
            elif msg_type == "START_NEW_ROUND_REQUEST":
                #Si es "START_NEW_ROUND_REQUEST": Si la ronda anterior ya terminó, le dice al BlackjackGamePython que inicie una nueva (game.start_new_round()).    
                if game.game_phase == "ROUND_OVER": await game.start_new_round()
                else: await game.send_error_to_player(player_in_game_obj, "No se puede iniciar nueva ronda aún.")
        elif msg_type != "JOIN_GAME_REQUEST": # Si el mensaje no es "JOIN_GAME_REQUEST" y no hay un juego o jugador correspondiente, se ignora.
            logging.warning(f"Msg {msg_type} para juego '{game_id_from_client}' no procesado (juego no encontrado o jugador no pertenece). WS: {websocket.remote_address}")
            if websocket.state == State.OPEN:
                try: await websocket.send(json.dumps({"type": "ERROR", "payload": {"message": "Error de juego o sesión."}}))
                except websockets.exceptions.ConnectionClosed: pass

    except json.JSONDecodeError: logging.error(f"JSON Error de {websocket.remote_address}")
    except Exception: logging.exception(f"Error manejando msg de {websocket.remote_address}")

# ... (connection_handler_main y main como estaban, usando State.OPEN) ...
# Llegada de un jugador: Cada vez que un nuevo jugador (su navegador) se conecta al servidor, esta función se activa para esa conexión específica.
async def connection_handler_main(websocket):
    temp_player_obj = PlayerPython(websocket, "unassigned", "TempPlayer")
    CONNECTED_CLIENTS[websocket] = temp_player_obj # 1- Registrar el cliente temporal
    logging.info(f"Cliente conectado: {websocket.remote_address}, ID global temp {temp_player_obj.server_player_id}")
    if websocket.state == State.OPEN:
        try: await websocket.send(json.dumps({"type": "SERVER_WELCOME", "payload": {"serverPlayerId": temp_player_obj.server_player_id, "message": "Conectado. Envía JOIN_GAME_REQUEST."}}))#mensaje de bienvenida, decirle que esta conectado
        except websockets.exceptions.ConnectionClosed: logging.warning(f"SERVER_WELCOME falló {websocket.remote_address}"); CONNECTED_CLIENTS.pop(websocket,None); return
    try:
        async for message in websocket: await handle_client_message(websocket, message) # 2- espera recibir mensajes del cliente
    except websockets.exceptions.ConnectionClosedError as e: logging.info(f"Cliente {CONNECTED_CLIENTS.get(websocket,temp_player_obj).server_player_id} desconectado: {e.reason} ({e.code})")
    except Exception: logging.exception(f"Error con cliente {CONNECTED_CLIENTS.get(websocket,temp_player_obj).server_player_id}:")
    finally:# 3- Cuando el cliente se desconecta, se limpia el registro de clientes y juegos
        player_to_remove = CONNECTED_CLIENTS.pop(websocket,None)
        if player_to_remove: logging.info(f"Cliente global {player_to_remove.server_player_id} desregistrado.")
        game_to_cleanup,player_id_disc=None,None
        for gid,gi in list(ACTIVE_GAMES.items()):
            if (gi.player1 and gi.player1.websocket==websocket) or (gi.player2 and gi.player2.websocket==websocket):
                game_to_cleanup=gi; player_id_disc="player1" if gi.player1 and gi.player1.websocket==websocket else "player2"; break
        if game_to_cleanup:
            logging.info(f"{player_id_disc.capitalize()} ({player_to_remove.server_player_id if player_to_remove else 'N/A'}) desconectó de {game_to_cleanup.game_id}.")
            other_player = game_to_cleanup.player1 if player_id_disc=="player2" else game_to_cleanup.player2 # Corregido aquí
            if other_player and other_player.websocket and other_player.websocket.state==State.OPEN:
                try: await other_player.websocket.send(json.dumps({"type":"OPPONENT_LEFT","payload":{"message":"Oponente abandonó."}}))
                except:pass
            del ACTIVE_GAMES[game_to_cleanup.game_id]; logging.info(f"Juego {game_to_cleanup.game_id} eliminado.")
            global PENDING_GAME
            if PENDING_GAME==game_to_cleanup:PENDING_GAME=None;logging.info("Juego pendiente eliminado.")

async def main(): # función que realmente pone en marcha el servidor.
    host = "0.0.0.0"; port = 8765 #escucha conexiones de cualrquier ip que tenga la computadora
    #8765 es donde los clientes se conectan
    logging.info(f"Servidor WebSocket Blackjack en ws://{host}:{port}")
    logging.info("Para conectar desde otra máquina, usa la IP específica (ej. ws://192.168.X.Y:8765).")
    async with websockets.serve(connection_handler_main, host, port): await asyncio.Future()
    #Esta es la orden principal: "Inicia un servidor WebSocket en esta dirección y puerto, y cada vez que alguien se conecte, usa la función "connection_handler_main" para atenderlo".

if __name__ == "__main__":
    #Este es un truco estándar de Python. Significa: "Si este archivo server.py es el que se está ejecutando
    # directamente (y no está siendo importado por otro archivo), entonces ejecuta asyncio.run(main())".
    # Esto inicia todo el proceso asíncrono del servidor.
    try: asyncio.run(main())
    except KeyboardInterrupt: logging.info("Servidor detenido.")
    

# Flujo Simplificado de una Partida (Ejemplo):

# Servidor Inicia: server.py se ejecuta. Está esperando en ws://SU_IP:8765.
# Jugador A (Navegador) se Conecta: connection_handler_main lo recibe, le da la bienvenida.
# Jugador A Envía Mensaje: {"type": "JOIN_GAME_REQUEST"}.
# Servidor Procesa (handle_client_message):
# No hay PENDING_GAME.
# Crea game123 = BlackjackGamePython(..., websocket_A).
# PENDING_GAME = game123. ACTIVE_GAMES["game123"] = game123.
# Envía a Jugador A: {"type": "GAME_CREATED", "payload": {"gameId": "game123", "playerId": "player1", ...}}.
# game123.broadcast_game_state() (estado: esperando P2).
# Jugador B (Navegador) se Conecta: connection_handler_main lo recibe, bienvenida.
# Jugador B Envía Mensaje: {"type": "JOIN_GAME_REQUEST"}.
# Servidor Procesa (handle_client_message):
# Sí hay PENDING_GAME (game123).
# game123.add_player2(websocket_B).
# PENDING_GAME = None.
# Envía a Jugador B: {"type": "JOINED_GAME", "payload": {"gameId": "game123", "playerId": "player2", ...}}.
# Envía a Jugador A: {"type": "OPPONENT_JOINED", ...}.
# game123.broadcast_game_state() (estado: apostando).
# Jugador A Envía: {"type": "PLACE_BET", "payload": {"gameId": "game123", "amount": 10}}.
# Servidor Procesa: game123.handle_bet(playerA_obj, 10). Aún no se reparten cartas. broadcast_game_state().
# Jugador B Envía: {"type": "PLACE_BET", "payload": {"gameId": "game123", "amount": 20}}.
# Servidor Procesa: game123.handle_bet(playerB_obj, 20). Ahora sí, todos apostaron.
# game123.deal_initial_cards(). Se reparten cartas, se revisan Blackjacks.
# Se determina el turno (ej. PLAYER1_TURN).
# game123.broadcast_game_state() (con cartas y turno).
# Jugador A Envía: {"type": "PLAYER_ACTION", "payload": {"gameId": "game123", "action": "HIT"}}.
# Servidor Procesa: game123.handle_player_action(playerA_obj, "HIT"). Le da carta, actualiza. broadcast_game_state().
# ...y así continúa el juego...
# Alguien se Desconecta: connection_handler_main lo detecta, limpia la partida, avisa al otro.