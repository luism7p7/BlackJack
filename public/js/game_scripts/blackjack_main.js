// public/js/game_scripts/blackjack_main.js

import { loadOrCreatePlayerData, saveToLocalStorage } from '../modules/StorageManager.js';
import { UIManager } from '../modules/UIManager.js';
import { BlackjackGame, GameMode as LocalGameMode, PlayerID as LocalPlayerID, GamePhase as LocalGamePhase } from '../modules/BlackjackGame.js';
import { SocketClient } from '../modules/SocketClient.js';

const PLAYER1_STORAGE_KEY = 'casino_blackjack_player1_data';
// DEFAULT_PLAYER_DATA se define en Player.js si se usa Player.fromData o similar
// Por ahora, lo mantenemos aquí para la carga inicial si StorageManager lo necesita.
const DEFAULT_PLAYER_DATA = { name: 'Jugador 1', chips: 100, debt: 0 };

let uiManager = null;
let localGame = null;
let socketClient = null;
let currentGameMode = null; // 'machine' o 'network'
let localPlayer1InitialData = null; // Datos cargados del localStorage para el jugador local

// --- Funciones de Actualización de UI ---
function updateUIFromGameState(gameState, clientPlayerIdInGame = null) {
    if (!uiManager || !gameState) {
        console.warn("updateUIFromGameState: uiManager o gameState no disponibles.");
        return;
    }
    // console.log("updateUIFromGameState:", JSON.parse(JSON.stringify(gameState)), "clientPlayerIdInGame:", clientPlayerIdInGame);

    const p1 = gameState.player1;
    const p2 = gameState.player2;
    const crupier = gameState.crupier;

    // Actualizar información de jugadores (nombre, fichas)
    if (p1) uiManager.updatePlayerInfo(p1); // UIManager espera un objeto {id, name, chips, ...}
    if (p2 && currentGameMode === 'network') { // Solo mostrar P2 si está en modo red y existe
        uiManager.updatePlayerInfo(p2);
        uiManager.showPlayer2Section(true);
    } else {
        uiManager.showPlayer2Section(false);
    }
    if (crupier) uiManager.updatePlayerInfo(crupier);

    // Mostrar manos
    const revealCrupierFull = crupier && (crupier.isDone || crupier.hasBlackjack || gameState.gamePhase === "ROUND_OVER" || gameState.gamePhase === LocalGamePhase.ROUND_OVER);
    if (crupier) uiManager.displayHand(crupier, revealCrupierFull);
    if (p1) uiManager.displayHand(p1, true); // La mano del propio jugador siempre revelada
    if (p2 && uiManager.domCache.player2Section.style.display !== 'none') uiManager.displayHand(p2, true);


    // Mensajes de resultado de ronda
    if (p1) uiManager.setGameResultMessage(p1.id, p1.roundMessage, getOutcomeForMessage(p1));
    if (p2 && uiManager.domCache.player2Section.style.display !== 'none') {
        uiManager.setGameResultMessage(p2.id, p2.roundMessage, getOutcomeForMessage(p2));
    } else {
        uiManager.setGameResultMessage(LocalPlayerID.PLAYER2, '', ''); // Limpiar P2 si no está visible
    }

    // Indicador de Turno y estado de controles
    let turnMessage = "";
    const currentTurn = gameState.currentTurn; // Puede ser "PLAYER1_TURN", "PLAYER2_TURN" (red) o LocalPlayerID (local)
    const gamePhase = gameState.gamePhase;

    let enableBettingInputs = false;
    let enableJugarButton = false;
    let enableActionButtons = false;

    switch (gamePhase) {
        case LocalGamePhase.BETTING: // Local
        case "BETTING": // Red
            turnMessage = "Realicen sus apuestas.";
            enableBettingInputs = true;
            enableJugarButton = true;
            // En modo red, el botón "Jugar" se convierte en "Confirmar Apuesta"
            uiManager.domCache.jugarButton.textContent = (currentGameMode === 'network') ? "Confirmar Apuesta" : "Jugar Ronda";
            break;
        case LocalGamePhase.PLAYERS_TURN: // Local
            if (currentTurn === LocalPlayerID.PLAYER1) {
                turnMessage = `Turno de ${p1 ? p1.name : 'Jugador 1'}.`;
                enableActionButtons = true; // En local, P1 siempre puede actuar en su turno
            }
            // No hay P2 en modo local con turno separado
            break;
        case "PLAYER1_TURN": // Red
            turnMessage = `Turno de ${p1 ? p1.name : 'Jugador 1'}.`;
            if (clientPlayerIdInGame === LocalPlayerID.PLAYER1) enableActionButtons = true;
            break;
        case "PLAYER2_TURN": // Red
            turnMessage = `Turno de ${p2 ? p2.name : 'Jugador 2'}.`;
            if (clientPlayerIdInGame === LocalPlayerID.PLAYER2) enableActionButtons = true;
            break;
        case LocalGamePhase.CRUPIER_TURN: // Local
        case "CRUPIER_TURN": // Red
            turnMessage = "Turno del Crupier...";
            break;
        case LocalGamePhase.ROUND_OVER: // Local
        case "ROUND_OVER": // Red
            turnMessage = "Ronda terminada. ";
            if (currentGameMode === 'machine') {
                turnMessage += "Haz clic en 'Jugar Ronda' para una nueva apuesta.";
                enableJugarButton = true; // "Jugar Ronda" para iniciar nueva apuesta/ronda
                uiManager.domCache.jugarButton.textContent = "Jugar Ronda";
            } else if (currentGameMode === 'network') {
                turnMessage += "Esperando para nueva ronda...";
                // Permitir a P1 (o host conceptual) solicitar nueva ronda
                if (clientPlayerIdInGame === LocalPlayerID.PLAYER1) enableJugarButton = true;
                uiManager.domCache.jugarButton.textContent = "Solicitar Nueva Ronda";
            }
            if (p1 && localPlayer1InitialData) { // Guardar siempre los datos del jugador local al final de la ronda
                const dataToSave = { name: p1.name, chips: p1.chips, debt: p1.debt !== undefined ? p1.debt : localPlayer1InitialData.debt };
                saveToLocalStorage(PLAYER1_STORAGE_KEY, dataToSave);
            }
            break;
        case "WAITING_FOR_PLAYER2": // Red (o WAITING_FOR_OPPONENT)
            turnMessage = gameState.message || "Esperando oponente...";
            break;
        default:
            turnMessage = gameState.message || `Fase de juego: ${gamePhase}`;
    }

    uiManager.toggleGameControls(enableBettingInputs, enableJugarButton, enableActionButtons);
    uiManager.setTurnIndicator(turnMessage);

    let uiActiveTurnId = null;
    if (currentTurn === LocalPlayerID.PLAYER1 || currentTurn === "PLAYER1_TURN") uiActiveTurnId = LocalPlayerID.PLAYER1;
    else if (currentTurn === LocalPlayerID.PLAYER2 || currentTurn === "PLAYER2_TURN") uiActiveTurnId = LocalPlayerID.PLAYER2;
    uiManager.setActiveTurn(uiActiveTurnId);
}


function getOutcomeForMessage(playerState) {
    if (!playerState || !playerState.roundMessage) return '';
    const msg = playerState.roundMessage.toLowerCase();
    if (msg.includes('blackjack') || msg.includes('gana')) return 'win';
    if (msg.includes('pierde') || msg.includes('pasó')) return 'lose';
    if (msg.includes('empate')) return 'push';
    return '';
}

// --- Lógica de Juego Local ---
function setupLocalGame() {
    currentGameMode = 'machine';
    if (socketClient) { // Si venimos de modo red, limpiar cliente de socket
        socketClient.closeConnection();
        socketClient = null;
    }
    localGame = new BlackjackGame(localPlayer1InitialData);
    localGame.setGameMode(LocalGameMode.PLAYER_VS_MACHINE);

    uiManager.showGameArea(true);
    const p1State = localGame.getPlayer1().to_dict();
    const crupierState = localGame.getCrupier().to_dict(false); // Carta oculta

    uiManager.resetUIForNewRound(p1State, null, crupierState, localGame.getGameMode());
    updateUIFromGameState({
        player1: p1State, player2: null, crupier: crupierState,
        gamePhase: localGame.getGamePhase(), currentTurn: localGame.getCurrentPlayerTurn()
    }, LocalPlayerID.PLAYER1);
}

function handleLocalJugarRonda() {
    if (!localGame) return;

    if (localGame.getGamePhase() === LocalGamePhase.ROUND_OVER) {
        localGame.prepareForNewRound(); // Resetea jugadores, fase a BETTING
        const p1State = localGame.getPlayer1().to_dict();
        const crupierState = localGame.getCrupier().to_dict(false);
        updateUIFromGameState({
            player1: p1State, player2: null, crupier: crupierState,
            gamePhase: localGame.getGamePhase(), currentTurn: localGame.getCurrentPlayerTurn()
        }, LocalPlayerID.PLAYER1);
        return; // Esperar a que el usuario ingrese la apuesta y presione "Jugar Ronda" de nuevo
    }

    if (localGame.getGamePhase() !== LocalGamePhase.BETTING) return;

    const bet1 = uiManager.getPlayerBetAmount(LocalPlayerID.PLAYER1);
    if (!localGame.placeBet(LocalPlayerID.PLAYER1, bet1)) { // placeBet es método de BlackjackGame
        uiManager.setTurnIndicator(localGame.getPlayer1().roundMessage, true);
        return;
    }

    localGame.startRound(); // Reparte cartas y maneja BJ iniciales
    
    const p1StateAfterStart = localGame.getPlayer1().to_dict();
    const crupierStateAfterStart = localGame.getCrupier().to_dict(localGame.getGamePhase() === LocalGamePhase.ROUND_OVER || localGame.getCrupier().hasBlackjack);

    updateUIFromGameState({
        player1: p1StateAfterStart, player2: null, crupier: crupierStateAfterStart,
        gamePhase: localGame.getGamePhase(), currentTurn: localGame.getCurrentPlayerTurn()
    }, LocalPlayerID.PLAYER1);

    if (localGame.getGamePhase() === LocalGamePhase.CRUPIER_TURN) {
        setTimeout(() => { // Simular retraso del crupier
            // El turno del crupier ya se jugó dentro de startRound o playerStands/playerHits si fue necesario
            // Solo necesitamos actualizar la UI al estado final de ROUND_OVER
            updateUIFromGameState({
                player1: localGame.getPlayer1().to_dict(), player2: null, crupier: localGame.getCrupier().to_dict(true),
                gamePhase: localGame.getGamePhase(), currentTurn: localGame.getCurrentPlayerTurn()
            }, LocalPlayerID.PLAYER1);
        }, 1000);
    } else if (localGame.getGamePhase() === LocalGamePhase.ROUND_OVER) {
        // Si la ronda terminó inmediatamente (ej. ambos BJ), la UI ya está actualizada.
        // No se necesita timeout adicional aquí, updateUIFromGameState ya lo hizo.
    }
}

function handleLocalPlayerAction(action) {
    if (!localGame || localGame.getGamePhase() !== LocalGamePhase.PLAYERS_TURN || localGame.getCurrentPlayerTurn() !== LocalPlayerID.PLAYER1) return;

    if (action === "HIT") localGame.playerHits();
    else if (action === "STAND") localGame.playerStands();
    
    updateUIFromGameState({
        player1: localGame.getPlayer1().to_dict(), player2: null, crupier: localGame.getCrupier().to_dict(false), // Crupier aún con carta oculta
        gamePhase: localGame.getGamePhase(), currentTurn: localGame.getCurrentPlayerTurn()
    }, LocalPlayerID.PLAYER1);

    if (localGame.getGamePhase() === LocalGamePhase.CRUPIER_TURN) {
        setTimeout(() => {
            updateUIFromGameState({
                player1: localGame.getPlayer1().to_dict(), player2: null, crupier: localGame.getCrupier().to_dict(true), // Revelar crupier
                gamePhase: localGame.getGamePhase(), currentTurn: localGame.getCurrentPlayerTurn()
            }, LocalPlayerID.PLAYER1);
        }, 1000);
    }
}

// --- Lógica de Juego en Red ---
function setupNetworkGame() {
    currentGameMode = 'network';
    if (localGame) localGame = null;

    if (!socketClient) {
        socketClient = new SocketClient();
        configureSocketClientCallbacks();
    }

    uiManager.showGameArea(true);
    const p1Reset = { id: LocalPlayerID.PLAYER1, name: localPlayer1InitialData.name, chips: localPlayer1InitialData.chips, debt: localPlayer1InitialData.debt, hand: [], points:0, roundMessage:'', currentBet:0, isDone:false, isBust:false, hasBlackjack:false };
    const crupierReset = { id: LocalPlayerID.CRUPIER, name: 'Crupier', chips: null, hand: [], points:0, roundMessage:''}; // Chips null
    uiManager.resetUIForNewRound(p1Reset, null, crupierReset, 'player'); // 'player' para modo 2J


    if (socketClient.isConnected()) {
        if (!socketClient.getGameInfo().gameId) {
            uiManager.setTurnIndicator("Conectado. Solicitando unirse a un juego...");
            socketClient.joinGameRequest();
        } else {
            uiManager.setTurnIndicator(`Ya en juego ${socketClient.getGameInfo().gameId}. Esperando estado...`);
            // Podríamos solicitar un GAME_STATE_UPDATE aquí si es necesario, o esperar que el servidor lo envíe.
        }
    } else if (socketClient.isConnecting()) {
        uiManager.setTurnIndicator("Conexión en progreso...");
    } else {
        uiManager.setTurnIndicator("Conectando al servidor...");
        socketClient.connect()
            // El callback onOpen ahora se encarga de joinGameRequest
            .catch(error => {
                console.error("Error conectando al servidor:", error);
                uiManager.setTurnIndicator("Error al conectar con el servidor.", true);
                uiManager.showGameOptions(true);
                currentGameMode = null;
            });
    }
}

function configureSocketClientCallbacks() {
    if (!socketClient) return;

    socketClient.onOpen = () => {
        console.log("blackjack_main: SocketClient.onOpen - Conexión establecida.");
        // Solo enviar JOIN_GAME_REQUEST si no estamos ya intentando unirnos o en un juego
        if (!socketClient.getGameInfo().gameId) {
            uiManager.setTurnIndicator("Conectado. Solicitando unirse a un juego...");
            socketClient.joinGameRequest();
        }
    };

    socketClient.onWelcome = (payload) => {
        console.log("blackjack_main: Bienvenido. ID Servidor:", payload.serverPlayerId);
        // El onOpen debería haber manejado el joinGameRequest si era una nueva conexión.
        // Si ya estaba conectado y recibe esto (ej. reconexión implícita), podría necesitar re-unirse.
        // Por ahora, onOpen es el punto principal para iniciar JOIN_GAME_REQUEST.
    };

    socketClient.onGameCreated = (payload) => {
        console.log("blackjack_main: Juego Creado:", payload);
        uiManager.setTurnIndicator(`Juego ${payload.gameId} creado. Eres ${payload.playerId}. Esperando oponente...`);
    };

    socketClient.onJoinedGame = (payload) => {
        console.log("blackjack_main: Unido al Juego:", payload);
        uiManager.setTurnIndicator(`Te uniste al juego ${payload.gameId} como ${payload.playerId}.`);
    };
    
    socketClient.onOpponentJoined = (payload) => {
        console.log("blackjack_main: Oponente Unido:", payload);
        uiManager.setTurnIndicator(`¡${payload.opponentName || 'Oponente'} se ha unido!`);
    };

    socketClient.onGameStateUpdate = (gameState) => {
        console.log("blackjack_main: GAME_STATE_UPDATE recibido del servidor.");
        updateUIFromGameState(gameState, socketClient.getGameInfo().playerIdInGame);
    };

    socketClient.onOpponentLeft = (payload) => {
        uiManager.setTurnIndicator(payload.message || "Tu oponente ha abandonado.", true);
        setTimeout(() => {
            if (currentGameMode === 'network') { // Solo si aún estamos en modo red
                uiManager.showGameOptions(true);
                socketClient.closeConnection(); // SocketClient pondrá a null en su onclose
                // socketClient = null; // Se resetea en el onclose del socketClient
                currentGameMode = null;
            }
        }, 3000);
    };

    socketClient.onServerError = (payload) => {
        uiManager.setTurnIndicator(`Error del servidor: ${payload.message}`, true);
    };
    
    socketClient.onClose = (event) => {
        console.log("blackjack_main: SocketClient.onClose disparado.");
        // Evitar mostrar error si el cierre fue intencional (ej. volver al menú)
        // o si ya no estamos en modo red.
        if (currentGameMode === 'network' && !event.wasClean) { 
            uiManager.setTurnIndicator("Desconectado del servidor.", true);
            uiManager.showGameOptions(true);
        }
        // Resetear variables de red independientemente de wasClean si estábamos en modo red
        if (currentGameMode === 'network') {
            currentGameMode = null;
            // No poner socketClient a null aquí, ya que onPlayPlayer lo recreará si es necesario.
            // SocketClient.js ya pone this.socket a null en su propio onclose.
        }
    };
}

function handleNetworkJugar() {
    if (!socketClient || !socketClient.isConnected() || !socketClient.getGameInfo().gameId) {
        uiManager.setTurnIndicator("No conectado o no en una partida.", true);
        return;
    }
    
    const buttonText = uiManager.domCache.jugarButton.textContent;
    if (buttonText === "Confirmar Apuesta") {
        const betAmount = uiManager.getPlayerBetAmount(socketClient.getGameInfo().playerIdInGame);
        if (betAmount > 0) {
            socketClient.placeBet(betAmount);
            uiManager.domCache.jugarButton.disabled = true; // Deshabilitar temporalmente
        } else {
            uiManager.setTurnIndicator("Ingresa una apuesta válida.", true);
        }
    } else if (buttonText === "Solicitar Nueva Ronda") {
        socketClient.requestNewRound();
        uiManager.setTurnIndicator("Solicitando nueva ronda...");
        uiManager.domCache.jugarButton.disabled = true;
    }
}

function handleNetworkPlayerAction(action) {
    if (!socketClient || !socketClient.isConnected() || !socketClient.getGameInfo().gameId) return;
    socketClient.playerAction(action);
    uiManager.toggleGameControls(false, false, false); // Deshabilitar acciones hasta nuevo estado
}

// --- Inicialización Principal ---
document.addEventListener('DOMContentLoaded', () => {
    uiManager = new UIManager();
    localPlayer1InitialData = loadOrCreatePlayerData(PLAYER1_STORAGE_KEY, DEFAULT_PLAYER_DATA);

    uiManager.onPlayMachine(() => {
        if (socketClient) { // Si existe una instancia de socketClient
            socketClient.closeConnection(); // Intenta cerrarla
            socketClient = null; // Descarta la instancia para el modo local
        }
        localGame = null; // Asegurar que no hay juego local previo
        setupLocalGame();
    });

    uiManager.onPlayPlayer(() => {
        if (localGame) localGame = null; // Descartar juego local
        setupNetworkGame();
    });

    uiManager.onBackToMenu(() => {
        if (socketClient) {
            socketClient.closeConnection();
            socketClient = null;
        }
        // Guardar datos del jugador local actual
        const playerTimeToSave = (localGame && localGame.getPlayer1()) 
            ? localGame.getPlayer1().to_dict() 
            : localPlayer1InitialData; // Usar los datos cargados si no hay juego local activo

        if (playerTimeToSave) {
             saveToLocalStorage(PLAYER1_STORAGE_KEY, {
                name: playerTimeToSave.name, 
                chips: playerTimeToSave.chips, 
                debt: playerTimeToSave.debt // Asumir que to_dict() o localPlayer1InitialData tienen debt
            });
        }
        window.location.href = "../index.html";
    });

    uiManager.onJugar(() => {
        if (currentGameMode === 'machine') handleLocalJugarRonda();
        else if (currentGameMode === 'network') handleNetworkJugar();
    });
    uiManager.onPedir(() => {
        if (currentGameMode === 'machine') handleLocalPlayerAction("HIT");
        else if (currentGameMode === 'network') handleNetworkPlayerAction("HIT");
    });
    uiManager.onPasar(() => {
        if (currentGameMode === 'machine') handleLocalPlayerAction("STAND");
        else if (currentGameMode === 'network') handleNetworkPlayerAction("STAND");
    });

    // Estado inicial: Mostrar opciones, no iniciar ningún juego automáticamente.
    uiManager.showGameOptions(true);
    uiManager.showGameArea(false);
});