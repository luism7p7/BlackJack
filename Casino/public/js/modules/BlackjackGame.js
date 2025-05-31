import { Player } from './Player.js';
import { Deck } from './Deck.js';

export const GameMode = {
    PLAYER_VS_MACHINE: 'machine',
    TWO_PLAYERS_VS_DEALER: 'player'
};

export const PlayerID = {
    PLAYER1: 'player1',
    PLAYER2: 'player2',
    CRUPIER: 'crupier'
};

export const GamePhase = {
    BETTING: 'betting',
    PLAYERS_TURN: 'players_turn',
    CRUPIER_TURN: 'crupier_turn',
    ROUND_OVER: 'round_over'
};

export class BlackjackGame {
    // Inicializa el juego con jugador 1 obligatorio y jugador 2 opcional
    constructor(player1Data, player2Data = null) {
        this.player1 = new Player(PlayerID.PLAYER1, player1Data);
        this.crupier = new Player(PlayerID.CRUPIER, { name: 'Crupier', chips: Infinity });
        this.player2 = null;

        this.deck = new Deck(1); // Un solo mazo por defecto
        this.gameMode = null;
        this.currentPlayerTurn = null;
        this.gamePhase = GamePhase.BETTING;

        this.betAmountPlayer1 = 0;
        this.betAmountPlayer2 = 0;
    }

    // Configura el modo de juego y crea el jugador 2 si es necesario
    setGameMode(mode, player2InitialData = null) {
        if (mode !== GameMode.PLAYER_VS_MACHINE && mode !== GameMode.TWO_PLAYERS_VS_DEALER) {
            throw new Error("BlackjackGame: Modo de juego no válido.");
        }
        this.gameMode = mode;
        if (this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER) {
            if (!player2InitialData) throw new Error("BlackjackGame: Se requieren datos para el Jugador 2 en modo 2 jugadores.");
            this.player2 = new Player(PlayerID.PLAYER2, player2InitialData);
        } else {
            this.player2 = null;
        }
        this.prepareForNewRound();
    }

    // Reinicia todos los valores para comenzar una nueva ronda
    prepareForNewRound() {
        this.player1.resetForNewRound();
        this.crupier.resetForNewRound();
        if (this.player2) {
            this.player2.resetForNewRound();
        }
        this.currentPlayerTurn = null;
        this.gamePhase = GamePhase.BETTING;
        this.betAmountPlayer1 = 0;
        this.betAmountPlayer2 = 0;
    }

    // Permite a un jugador hacer una apuesta durante la fase de apuestas
    placeBet(playerID, amount) {
        if (this.gamePhase !== GamePhase.BETTING) {
            console.warn(`BlackjackGame: Intento de apuesta fuera de la fase de apuestas por ${playerID}.`);
            return false;
        }
        
        let playerToBet;
        if (playerID === PlayerID.PLAYER1) {
            playerToBet = this.player1;
        } else if (playerID === PlayerID.PLAYER2 && this.player2) {
            playerToBet = this.player2;
        } else {
            console.error("BlackjackGame: Intento de apuesta para jugador no válido o no existente:", playerID);
            return false;
        }

        const success = playerToBet.placeBet(amount);
        if (success) {
            if (playerID === PlayerID.PLAYER1) this.betAmountPlayer1 = playerToBet.currentBet;
            else if (playerID === PlayerID.PLAYER2) this.betAmountPlayer2 = playerToBet.currentBet;
        }
        return success;
    }

    // Inicia una nueva ronda después de verificar que las apuestas sean válidas
    startRound() {
        if (this.gamePhase !== GamePhase.BETTING) {
            console.warn("BlackjackGame: Intento de iniciar ronda fuera de la fase de apuestas.");
            return false;
        }
        if (this.player1.currentBet <= 0) {
            this.player1.roundMessage = "Jugador 1 debe realizar una apuesta válida.";
            return false;
        }
        if (this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER && this.player2 && this.player2.currentBet <= 0) {
            this.player2.roundMessage = "Jugador 2 debe realizar una apuesta válida.";
            return false;
        }

        this.player1.resetForNewRound();
        this.player1.currentBet = this.betAmountPlayer1; 

        this.crupier.resetForNewRound();

        if (this.player2) {
            this.player2.resetForNewRound();
            this.player2.currentBet = this.betAmountPlayer2;
        }
        
        this.deck.buildDeck(); 
        this.deck.shuffle();

        // Reparte cartas iniciales: 2 cartas para cada jugador y crupier
        this.player1.addCard(this.deck.dealCard());
        if (this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER && this.player2) {
            this.player2.addCard(this.deck.dealCard());
        }
        this.crupier.addCard(this.deck.dealCard()); 

        this.player1.addCard(this.deck.dealCard());
        if (this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER && this.player2) {
            this.player2.addCard(this.deck.dealCard());
        }
        this.crupier.addCard(this.deck.dealCard()); 

        this.gamePhase = GamePhase.PLAYERS_TURN;
        this.currentPlayerTurn = PlayerID.PLAYER1;

        this.checkForInitialBlackjacks(); 
        
        if (this.allHumanPlayersDone()) {
            if (this.crupier.hasBlackjack || this.noPlayersLeftToPlayAgainstCrupier()) {
                 this.gamePhase = GamePhase.ROUND_OVER;
                 this.determineFinalResults(); 
            } else {
                 this.gamePhase = GamePhase.CRUPIER_TURN;
                 this.playCrupierTurn(); 
            }
        } else if (this.player1.isDone && this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER && this.player2 && !this.player2.isDone) {
            this.currentPlayerTurn = PlayerID.PLAYER2;
        } else if (!this.player1.isDone) {
            this.currentPlayerTurn = PlayerID.PLAYER1;
        }
        return true;
    }

    // Verifica y maneja los blackjacks iniciales después del reparto
    checkForInitialBlackjacks() {
        this.player1.updateStatus(); 
        this.crupier.updateStatus();
        if (this.player2) this.player2.updateStatus();

        const p1HasBJ = this.player1.hasBlackjack;
        const crupierHasBJ = this.crupier.hasBlackjack;

        if (p1HasBJ) {
            this.player1.isDone = true;
            if (crupierHasBJ) {
                this.player1.roundMessage = "Empate (Ambos Blackjack).";
                this.player1.pushBet();
            } else {
                this.player1.roundMessage = "¡Blackjack! Ganas 3:2.";
                this.player1.winBet(true); 
            }
        } else if (crupierHasBJ) { 
            this.player1.isDone = true;
            this.player1.roundMessage = "Pierdes (Crupier tiene Blackjack).";
            this.player1.loseBet();
        }

        if (this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER && this.player2) {
            const p2HasBJ = this.player2.hasBlackjack;
            if (p2HasBJ) {
                this.player2.isDone = true;
                if (crupierHasBJ) {
                    this.player2.roundMessage = "Jugador 2: Empate (Ambos Blackjack).";
                    this.player2.pushBet();
                } else {
                    this.player2.roundMessage = "Jugador 2: ¡Blackjack! Ganas 3:2.";
                    this.player2.winBet(true);
                }
            } else if (crupierHasBJ) { 
                this.player2.isDone = true;
                this.player2.roundMessage = "Jugador 2: Pierde (Crupier tiene Blackjack).";
                this.player2.loseBet();
            }
        }
    }
    
    // Verifica si todos los jugadores humanos han terminado su turno
    allHumanPlayersDone() {
        if (!this.player1.isDone) return false; 
        if (this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER && this.player2) {
            return this.player2.isDone; 
        }
        return true; 
    }

    // Determina si no quedan jugadores para competir contra el crupier
    noPlayersLeftToPlayAgainstCrupier() {
        const p1CannotPlay = this.player1.isBust || (this.player1.hasBlackjack && this.player1.isDone);
        
        if (this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER && this.player2) {
            const p2CannotPlay = this.player2.isBust || (this.player2.hasBlackjack && this.player2.isDone);

            let p1_still_in = !this.player1.isBust && !this.player1.hasBlackjack; 
            let p2_still_in = this.player2 && !this.player2.isBust && !this.player2.hasBlackjack;

            return !p1_still_in && !p2_still_in; 
        }
        // Modo de juego en solitario:
        return this.player1.isBust || this.player1.hasBlackjack; 
    }

    // Maneja cuando el jugador activo pide una carta adicional
    playerHits() {
        if (this.gamePhase !== GamePhase.PLAYERS_TURN || !this.currentPlayerTurn) return false;

        const activePlayer = this.getActivePlayerObject();
        if (!activePlayer || activePlayer.isDone) return false;

        activePlayer.addCard(this.deck.dealCard());
        activePlayer.updateStatus(); 

        if (activePlayer.isBust) {
            activePlayer.roundMessage = `${activePlayer.name} se pasó de 21. Pierde.`;
            activePlayer.loseBet(); 
            this.nextTurnOrProceed();
        } else if (activePlayer.getHandValue() === 21) {
            activePlayer.roundMessage = `${activePlayer.name} tiene 21 y se planta.`;
            activePlayer.stand(); 
            this.nextTurnOrProceed();
        }
        return true;
    }

    // Maneja cuando el jugador activo decide plantarse
    playerStands() {
        if (this.gamePhase !== GamePhase.PLAYERS_TURN || !this.currentPlayerTurn) return false;

        const activePlayer = this.getActivePlayerObject();
        if (!activePlayer || activePlayer.isDone) return false;

        activePlayer.stand(); 
        activePlayer.roundMessage = `${activePlayer.name} se planta con ${activePlayer.getHandValue()} puntos.`;
        this.nextTurnOrProceed();
        return true;
    }

    // Obtiene el objeto del jugador que tiene el turno actualmente
    getActivePlayerObject() {
        if (this.currentPlayerTurn === PlayerID.PLAYER1) return this.player1;
        if (this.currentPlayerTurn === PlayerID.PLAYER2 && this.player2) return this.player2;
        return null;
    }

    // Gestiona el cambio de turno entre jugadores o inicia el turno del crupier
    nextTurnOrProceed() {
        if (this.currentPlayerTurn === PlayerID.PLAYER1) {
            if (this.gameMode === GameMode.TWO_PLAYERS_VS_DEALER && this.player2 && !this.player2.isDone) {
                this.currentPlayerTurn = PlayerID.PLAYER2; 
            } else { 
                this.currentPlayerTurn = null;
                this.gamePhase = GamePhase.CRUPIER_TURN;
                this.playCrupierTurn();
            }
        } else if (this.currentPlayerTurn === PlayerID.PLAYER2) {
            this.currentPlayerTurn = null;
            this.gamePhase = GamePhase.CRUPIER_TURN;
            this.playCrupierTurn();
        }
    }

    // Ejecuta automáticamente el turno del crupier siguiendo las reglas del blackjack
    playCrupierTurn() {
        if (this.gamePhase !== GamePhase.CRUPIER_TURN) return;
        
        let player1NeedsDealerToPlay = this.player1 && !this.player1.isBust && !this.player1.hasBlackjack;
        let player2NeedsDealerToPlay = this.player2 && !this.player2.isBust && !this.player2.hasBlackjack;

        if (!player1NeedsDealerToPlay && (!this.player2 || !player2NeedsDealerToPlay) && !this.crupier.hasBlackjack) {
             this.crupier.roundMessage = "Gana el Crupier (todos los jugadores se pasaron o tuvieron Blackjack resuelto).";
             this.crupier.isDone = true; 
        } else {
            this.crupier.isDone = false; 
            while (this.crupier.getHandValue() < 17 && !this.crupier.isBust) {
                this.crupier.addCard(this.deck.dealCard());
                this.crupier.updateStatus(); 
            }
            this.crupier.isDone = true; 

            if (this.crupier.isBust) {
                this.crupier.roundMessage = `Crupier se pasó con ${this.crupier.getHandValue()} puntos.`;
            } else {
                this.crupier.roundMessage = `Crupier se planta con ${this.crupier.getHandValue()} puntos.`;
            }
        }
        
        this.gamePhase = GamePhase.ROUND_OVER;
        this.determineFinalResults();
    }

    // Determina los resultados finales de la ronda y actualiza las fichas de los jugadores
    determineFinalResults() {
        if (this.gamePhase !== GamePhase.ROUND_OVER) return;

        const crupierValue = this.crupier.getHandValue();
        const crupierIsBust = this.crupier.isBust;

        // Evaluar Jugador 1
        if (this.player1 && this.player1.currentBet > 0 && !this.player1.isBust && !this.player1.hasBlackjack) {
             this.resolvePlayerHand(this.player1, crupierValue, crupierIsBust);
        }
        else if (this.player1 && this.player1.isBust && !this.player1.roundMessage) {
            this.player1.roundMessage = `${this.player1.name} se pasó.`;
        }

        // Evaluar Jugador 2
        if (this.player2 && this.player2.currentBet > 0 && !this.player2.isBust && !this.player2.hasBlackjack) {
            this.resolvePlayerHand(this.player2, crupierValue, crupierIsBust);
        } else if (this.player2 && this.player2.isBust && !this.player2.roundMessage) {
            this.player2.roundMessage = `${this.player2.name} se pasó.`;
        }
        
        this.player1.isDone = true;
        if(this.player2) this.player2.isDone = true;
        this.crupier.isDone = true;
    }

    // Resuelve el resultado de una mano comparándola con la del crupier
    resolvePlayerHand(player, crupierValue, crupierIsBust) {
        const playerValue = player.getHandValue();
        if (crupierIsBust || playerValue > crupierValue) {
            player.roundMessage = `${player.name} gana con ${playerValue} vs ${crupierIsBust ? 'Bust del Crupier' : crupierValue}.`;
            player.winBet();
        } else if (playerValue < crupierValue) {
            player.roundMessage = `${player.name} pierde con ${playerValue} vs ${crupierValue}.`;
            player.loseBet();
        } else { 
            player.roundMessage = `${player.name} empata con ${playerValue} vs ${crupierValue}.`;
            player.pushBet();
        }
        player.isDone = true; 
    }

    // Métodos getter para acceder a los objetos de los jugadores y el estado del juego
    getPlayer1() { return this.player1; }
    getPlayer2() { return this.player2; }
    getCrupier() { return this.crupier; }
    getCurrentPlayerTurn() { return this.currentPlayerTurn; }
    getGamePhase() { return this.gamePhase; }
    getGameMode() { return this.gameMode; }
}