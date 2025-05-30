// public/js/modules/SocketClient.js

const SERVER_URL = "ws://192.168.1.18:8765"; // Cambia 'localhost' por la IP del servidor si es diferente

export class SocketClient {
    constructor() {
        this.socket = null;
        this.serverPlayerId = null;
        this.gameId = null;
        this.playerIdInGame = null;

        this.onOpen = null; // Callback a ser definido por blackjack_main.js
        this.onClose = null;
        this.onError = null;
        this.onWelcome = null;
        this.onGameCreated = null;
        this.onJoinedGame = null;
        this.onOpponentJoined = null;
        this.onGameStateUpdate = null;
        this.onOpponentLeft = null;
        this.onServerError = null;
        this.onActionReceived = null;
        this.onNewRound = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                console.warn("SocketClient: Ya conectado.");
                if (this.onOpen) this.onOpen(); // Disparar onOpen si ya está conectado y se llama connect de nuevo
                resolve();
                return;
            }
            if (this.socket && (this.socket.readyState === WebSocket.CONNECTING)) {
                console.warn("SocketClient: Conexión ya en progreso.");
                // Podríamos esperar a que la promesa existente se resuelva
                return; // Evitar múltiples conexiones
            }


            this.socket = new WebSocket(SERVER_URL);

            this.socket.onopen = (event) => {
                console.log("SocketClient: Conectado al servidor WebSocket:", SERVER_URL);
                if (this.onOpen) this.onOpen(event); // Llamar al callback onOpen
                resolve();
            };

            this.socket.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };

            this.socket.onerror = (error) => {
                console.error("SocketClient: Error de WebSocket:", error);
                if (this.onError) this.onError(error);
                reject(error); // Rechazar la promesa de conexión
            };

            this.socket.onclose = (event) => {
                console.log("SocketClient: Desconectado del servidor WebSocket.", event.reason, `(Code: ${event.code})`);
                this.gameId = null; // Resetear gameId al desconectar
                this.playerIdInGame = null; // Resetear playerIdInGame
                if (this.onClose) this.onClose(event);
                this.socket = null;
            };
        });
    }

    handleServerMessage(jsonData) {
        try {
            const message = JSON.parse(jsonData);
            console.log("SocketClient: Mensaje recibido del servidor:", message);

            switch (message.type) {
                case "SERVER_WELCOME":
                    this.serverPlayerId = message.payload.serverPlayerId;
                    if (this.onWelcome) this.onWelcome(message.payload);
                    break;
                case "GAME_CREATED":
                    this.gameId = message.payload.gameId;
                    this.playerIdInGame = message.payload.playerId;
                    if (this.onGameCreated) this.onGameCreated(message.payload);
                    break;
                case "JOINED_GAME":
                    this.gameId = message.payload.gameId;
                    this.playerIdInGame = message.payload.playerId;
                    if (this.onJoinedGame) this.onJoinedGame(message.payload);
                    break;
                case "OPPONENT_JOINED":
                    if (this.onOpponentJoined) this.onOpponentJoined(message.payload);
                    break;
                case "GAME_STATE_UPDATE":
                    // Actualizar gameId por si acaso (aunque debería ser consistente)
                    if (message.payload.gameId) this.gameId = message.payload.gameId;
                    if (this.onGameStateUpdate) this.onGameStateUpdate(message.payload);
                    break;
                case "OPPONENT_LEFT":
                    if (this.onOpponentLeft) this.onOpponentLeft(message.payload);
                    this.gameId = null; // Resetear gameId
                    this.playerIdInGame = null;
                    break;
                case "ERROR":
                    if (this.onServerError) this.onServerError(message.payload);
                    else console.error("SocketClient: Error del servidor:", message.payload.message);
                    break;
                case "ACTION_RECEIVED":
                    if (this.onActionReceived) this.onActionReceived(message.payload);
                    break;
                case "NEW_ROUND":
                     if(this.onNewRound) this.onNewRound(message.payload);
                     break;
                default:
                    console.warn("SocketClient: Tipo de mensaje desconocido recibido:", message.type);
            }
        } catch (error) {
            console.error("SocketClient: Error procesando mensaje del servidor:", error, "Data:", jsonData);
        }
    }

    sendMessage(type, payload = {}) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.error("SocketClient: No conectado. No se puede enviar mensaje.");
            return false;
        }
        const messagePayload = { ...payload };
        // Solo añadir gameId si ya lo tenemos y el tipo de mensaje lo requiere (no es JOIN_GAME_REQUEST)
        if (this.gameId && type !== "JOIN_GAME_REQUEST") {
             messagePayload.gameId = this.gameId;
        }

        const message = { type: type, payload: messagePayload };
        try {
            this.socket.send(JSON.stringify(message));
            console.log("SocketClient: Mensaje enviado:", message);
            return true;
        } catch (error) {
            console.error("SocketClient: Error enviando mensaje:", error);
            return false;
        }
    }

    joinGameRequest() {
        // No añadir gameId aquí, el servidor lo gestiona para JOIN_GAME_REQUEST
        this.sendMessage("JOIN_GAME_REQUEST", {});
    }

    placeBet(amount) {
        if (typeof amount !== 'number' || amount <= 0) {
            console.error("SocketClient: Cantidad de apuesta inválida para enviar.");
            return;
        }
        // gameId se añadirá automáticamente por sendMessage si this.gameId existe
        this.sendMessage("PLACE_BET", { amount: amount });
    }

    playerAction(action) {
        if (action !== "HIT" && action !== "STAND") {
            console.error("SocketClient: Acción de jugador inválida:", action);
            return;
        }
        this.sendMessage("PLAYER_ACTION", { action: action });
    }

    requestNewRound() {
        this.sendMessage("START_NEW_ROUND_REQUEST");
    }

    closeConnection() {
        if (this.socket) {
            this.socket.close();
            // this.socket = null; // Se pondrá a null en el evento onclose
        }
    }

    isConnected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }
    
    isConnecting() {
        return this.socket && this.socket.readyState === WebSocket.CONNECTING;
    }

    getGameInfo() {
        return {
            gameId: this.gameId,
            playerIdInGame: this.playerIdInGame,
            serverPlayerId: this.serverPlayerId
        };
    }
}