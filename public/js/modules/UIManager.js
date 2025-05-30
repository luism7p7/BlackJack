// public/js/modules/UIManager.js

export class UIManager {
    constructor() {
        this.domCache = {
            // Opciones de Juego y Área Principal
            gameOptionsSection: document.querySelector(".game-options"),
            gameAreaSection: document.getElementById("game-area"),
            playMachineButton: document.getElementById("play-machine"),
            playPlayerButton: document.getElementById("play-player"),
            backToMenuButton: document.getElementById("volver-blackjack"),

            // Crupier
            crupierSection: document.getElementById("crupier-section"), // Asumiendo que "crupier-area" es el ID correcto, como en el HTML. Si no, ajustar.
            crupierCardsDisplay: document.getElementById("crupier-cards-main"),
            crupierPointsDisplay: document.getElementById("crupier-points-main"),
            crupierTitle: document.getElementById("crupier-title-main"),


            // Jugador 1
            player1Section: document.getElementById("player1-section"), // Asumiendo que "player1-area" es el ID correcto, como en el HTML. Si no, ajustar.
            player1Title: document.getElementById("player1-title-main"),
            player1BalanceDisplay: document.getElementById("player1-balance-main"), // Span inside H2
            player1CardsDisplay: document.getElementById("player1-cards-main"),
            player1PointsDisplay: document.getElementById("player1-points-main"),
            player1BetAmountInput: document.getElementById("player1-bet-amount"),

            // Jugador 2
            player2Section: document.getElementById("player2-area"), // CORREGIDO
            player2Title: document.getElementById("player2-title-main"),
            player2BalanceDisplay: document.getElementById("player2-balance-main"), // Span inside H2
            player2CardsDisplay: document.getElementById("player2-cards-main"),
            player2PointsDisplay: document.getElementById("player2-points-main"),
            player2BetAmountInput: document.getElementById("player2-bet-amount"),

            // Controles y Mensajes
            turnIndicatorMessage: document.getElementById("turn-indicator-message"),
            jugarButton: document.getElementById("jugar-button"), // "Jugar Ronda"
            pedirButton: document.getElementById("pedir-button"),
            pasarButton: document.getElementById("pasar-button"),
            gameResultP1Display: document.querySelector("#game-result-message .p1-result"),
            gameResultP2Display: document.querySelector("#game-result-message .p2-result"),
        };

        if (!this.validateDomCache()) {
            // La validación podría fallar si los IDs de player1Section y crupierSection también necesitan ser player1-area y crupier-area.
            // Basado en el HTML, player1-area y crupier-area son los IDs correctos.
            // Se recomienda verificar y ajustar player1Section y crupierSection si es necesario para que coincidan con el HTML.
            // Por ahora, nos centramos en el problema reportado de player2.
            // throw new Error("UIManager: No se pudieron encontrar algunos elementos esenciales del DOM. Verifica los IDs en blackjack.html.");
            console.warn("UIManager: Algunos elementos del DOM podrían no haberse encontrado. Verifica IDs como player1-area y crupier-area si player1Section/crupierSection son null.");
        }
    }

    validateDomCache() {
        let allFound = true;
        for (const key in this.domCache) {
            if (!this.domCache[key] && key !== 'player2BalanceDisplay' && key !== 'player1BalanceDisplay' && key !== 'crupierSection' && key !== 'player1Section') {
                console.error(`UIManager: Elemento DOM no encontrado - ${key}. ID esperado: ${this.getExpectedIdForKey(key)}`);
                allFound = false;
            }
        }
        // Re-acquire balance spans after initial setup as they are inside H2 that might be set by JS
        if (this.domCache.player1Title) this.domCache.player1BalanceDisplay = document.getElementById("player1-balance-main");
        if (this.domCache.player2Title) this.domCache.player2BalanceDisplay = document.getElementById("player2-balance-main");

        // Verificación adicional para las secciones principales de los jugadores y el crupier
        if (!this.domCache.player1Section && document.getElementById("player1-area")) {
             this.domCache.player1Section = document.getElementById("player1-area");
             console.log("UIManager: player1Section re-asignado a player1-area.");
        }
        if (!this.domCache.crupierSection && document.getElementById("crupier-area")) {
             this.domCache.crupierSection = document.getElementById("crupier-area");
             console.log("UIManager: crupierSection re-asignado a crupier-area.");
        }


        return allFound;
    }

    getExpectedIdForKey(key) {
        const idMap = {
            gameOptionsSection: ".game-options (selector)",
            gameAreaSection: "game-area",
            playMachineButton: "play-machine",
            playPlayerButton: "play-player",
            backToMenuButton: "volver-blackjack",
            crupierSection: "crupier-area", // AJUSTADO (asumiendo HTML usa crupier-area)
            crupierCardsDisplay: "crupier-cards-main",
            crupierPointsDisplay: "crupier-points-main",
            crupierTitle: "crupier-title-main",
            player1Section: "player1-area", // AJUSTADO (asumiendo HTML usa player1-area)
            player1Title: "player1-title-main",
            player1BalanceDisplay: "player1-balance-main (span inside H2)",
            player1CardsDisplay: "player1-cards-main",
            player1PointsDisplay: "player1-points-main",
            player1BetAmountInput: "player1-bet-amount",
            player2Section: "player2-area", // CORREGIDO
            player2Title: "player2-title-main",
            player2BalanceDisplay: "player2-balance-main (span inside H2)",
            player2CardsDisplay: "player2-cards-main",
            player2PointsDisplay: "player2-points-main",
            player2BetAmountInput: "player2-bet-amount",
            turnIndicatorMessage: "turn-indicator-message",
            jugarButton: "jugar-button",
            pedirButton: "pedir-button",
            pasarButton: "pasar-button",
            gameResultP1Display: "#game-result-message .p1-result (selector)",
            gameResultP2Display: "#game-result-message .p2-result (selector)",
        };
        return idMap[key] || key;
    }


    renderCard(cardObject, isHidden = false) {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');

        if (isHidden) {
            cardDiv.classList.add('hidden-card');
            cardDiv.innerHTML = '<span>?</span>';
            return cardDiv;
        }

        if (!cardObject || typeof cardObject.value === 'undefined' || typeof cardObject.suit === 'undefined') {
            console.error("UIManager: Intento de renderizar una carta inválida.", cardObject);
            cardDiv.textContent = 'Err';
            cardDiv.style.fontSize = '1em';
            cardDiv.style.textAlign = 'center';
            cardDiv.style.paddingTop = '30px';
            return cardDiv;
        }

        const valueSpan = document.createElement('span');
        valueSpan.classList.add('value');
        valueSpan.textContent = cardObject.value;

        const suitSpan = document.createElement('span');
        suitSpan.classList.add('suit');
        let suitChar = '';
        switch (cardObject.suit) {
            case 'Hearts': suitChar = '♥'; suitSpan.classList.add('suit-hearts'); break;
            case 'Diamonds': suitChar = '♦'; suitSpan.classList.add('suit-diamonds'); break;
            case 'Clubs': suitChar = '♣'; suitSpan.classList.add('suit-clubs'); break;
            case 'Spades': suitChar = '♠'; suitSpan.classList.add('suit-spades'); break;
            default: suitChar = '?';
        }
        suitSpan.textContent = suitChar;

        cardDiv.appendChild(valueSpan);
        cardDiv.appendChild(suitSpan);

        return cardDiv;
    }

    displayHand(playerEntity, revealCrupierFirstCard = false) {
        let cardsContainer, pointsDisplay;
        const playerID = playerEntity.id; // Expecting object with id, hand, points
        const hand = playerEntity.hand;
        const points = playerEntity.points; // Use pre-calculated points from playerEntity

        switch(playerID) {
            case 'player1':
                cardsContainer = this.domCache.player1CardsDisplay;
                pointsDisplay = this.domCache.player1PointsDisplay;
                break;
            case 'player2':
                if (!this.domCache.player2CardsDisplay) {
                    console.warn("UIManager: player2CardsDisplay no encontrado en domCache para displayHand.");
                    return;
                }
                cardsContainer = this.domCache.player2CardsDisplay;
                pointsDisplay = this.domCache.player2PointsDisplay;
                break;
            case 'crupier':
                cardsContainer = this.domCache.crupierCardsDisplay;
                pointsDisplay = this.domCache.crupierPointsDisplay;
                break;
            default:
                console.error("UIManager: Tipo de jugador no reconocido para displayHand:", playerID);
                return;
        }

        if (!cardsContainer || !pointsDisplay) {
            console.error(`UIManager: Contenedor de cartas o puntos no encontrado para ${playerID}.`);
            return;
        }

        cardsContainer.innerHTML = '';
        hand.forEach((card, index) => {
            const isHidden = (playerID === 'crupier' && index === 0 && !revealCrupierFirstCard && hand.length > 1 && !playerEntity.hasBlackjack && !playerEntity.isDone);
            cardsContainer.appendChild(this.renderCard(card, isHidden));
        });

        const displayPointsAsQuestionMark = (playerID === 'crupier' && !revealCrupierFirstCard && hand.length > 1 && !playerEntity.hasBlackjack && !playerEntity.isDone);

        pointsDisplay.textContent = displayPointsAsQuestionMark ? `? puntos` : `${points} puntos`;
    }

    updatePlayerInfo(playerEntity) { // playerEntity is an object with id, name, chips
        const playerID = playerEntity.id;
        const playerName = playerEntity.name;
        const playerChips = playerEntity.chips;

        if (playerID === 'player1') {
            if (this.domCache.player1Title) {
                this.domCache.player1Title.innerHTML = `${playerName} (<span id="player1-balance-main">${playerChips}</span>F)`;
                this.domCache.player1BalanceDisplay = document.getElementById("player1-balance-main");
            }
        } else if (playerID === 'player2') {
             if (this.domCache.player2Title) {
                this.domCache.player2Title.innerHTML = `${playerName} (<span id="player2-balance-main">${playerChips}</span>F)`;
                this.domCache.player2BalanceDisplay = document.getElementById("player2-balance-main");
             } else {
                console.warn("UIManager: player2Title no encontrado en domCache para updatePlayerInfo.");
             }
        } else if (playerID === 'crupier') {
            if (this.domCache.crupierTitle) this.domCache.crupierTitle.textContent = playerName;
        }
    }

    updatePlayerBalance(playerID, chips) {
        if (playerID === 'player1' && this.domCache.player1BalanceDisplay) {
            this.domCache.player1BalanceDisplay.textContent = chips;
        } else if (playerID === 'player2' && this.domCache.player2BalanceDisplay) {
            this.domCache.player2BalanceDisplay.textContent = chips;
        }
    }

    setTurnIndicator(message, isError = false) {
        if (this.domCache.turnIndicatorMessage) {
            this.domCache.turnIndicatorMessage.textContent = message;
            this.domCache.turnIndicatorMessage.style.color = isError ? 'red' : 'white'; // O el color que corresponda al tema
        }
    }

    setGameResultMessage(playerID, message, outcome) {
        let displayElement;
        let colorClass = ''; // Usar clases para los colores de resultado

        if (playerID === 'player1') {
            displayElement = this.domCache.gameResultP1Display;
            if (outcome === 'win' || outcome === 'blackjack') colorClass = 'win';
            else if (outcome === 'lose' || outcome === 'bust') colorClass = 'lose';
            else if (outcome === 'push') colorClass = 'push';
        } else if (playerID === 'player2' && this.domCache.gameResultP2Display) {
            displayElement = this.domCache.gameResultP2Display;
            if (outcome === 'win' || outcome === 'blackjack') colorClass = 'win';
            else if (outcome === 'lose' || outcome === 'bust') colorClass = 'lose';
            else if (outcome === 'push') colorClass = 'push';
            this.domCache.gameResultP2Display.style.display = message ? 'block' : 'none';
        } else {
            return;
        }

        if (displayElement) {
            displayElement.textContent = message;
            displayElement.className = `p${playerID.slice(-1)}-result ${colorClass}`; // ej. p1-result win
        }
    }

    clearGameResultMessages() {
        if (this.domCache.gameResultP1Display) {
            this.domCache.gameResultP1Display.textContent = '';
            this.domCache.gameResultP1Display.className = 'p1-result';
        }
        if (this.domCache.gameResultP2Display) {
            this.domCache.gameResultP2Display.textContent = '';
            this.domCache.gameResultP2Display.className = 'p2-result';
            this.domCache.gameResultP2Display.style.display = 'none';
        }
    }

    toggleGameControls(enableBettingInputs, enableJugarButton, enableActionButtons) {
        if (this.domCache.player1BetAmountInput) {
            this.domCache.player1BetAmountInput.disabled = !enableBettingInputs;
        }
        if (this.domCache.player2BetAmountInput) { // Este input existe para player2
            this.domCache.player2BetAmountInput.disabled = !enableBettingInputs;
        }
        if (this.domCache.jugarButton) this.domCache.jugarButton.disabled = !enableJugarButton;
        if (this.domCache.pedirButton) this.domCache.pedirButton.disabled = !enableActionButtons;
        if (this.domCache.pasarButton) this.domCache.pasarButton.disabled = !enableActionButtons;
    }

    showGameOptions(show) {
        if (this.domCache.gameOptionsSection) this.domCache.gameOptionsSection.style.display = show ? 'block' : 'none';
        if (show) this.showGameArea(false);
    }

    showGameArea(show) {
        if (this.domCache.gameAreaSection) this.domCache.gameAreaSection.style.display = show ? 'block' : 'none';
        if (show) this.showGameOptions(false);
    }

    showPlayer2Section(show) {
        if (this.domCache.player2Section) { // player2Section ahora referencia 'player2-area'
            this.domCache.player2Section.style.display = show ? 'flex' : 'none'; // 'flex' si .player-spot es flex, o 'block'
            if (!show && this.domCache.gameResultP2Display) {
                this.domCache.gameResultP2Display.style.display = 'none';
            }
        } else {
            console.warn("UIManager: player2Section (player2-area) no encontrado en domCache para showPlayer2Section.");
        }
    }

    setActiveTurn(playerID) {
        // Asegurarse que player1Section y player2Section son los correctos ('player1-area', 'player2-area')
        const p1Area = this.domCache.player1Section || document.getElementById('player1-area');
        const p2Area = this.domCache.player2Section || document.getElementById('player2-area');

        if (p1Area) p1Area.classList.remove('active-turn');
        if (p2Area) p2Area.classList.remove('active-turn');


        if (playerID === 'player1' && p1Area) {
            p1Area.classList.add('active-turn');
        } else if (playerID === 'player2' && p2Area) {
            p2Area.classList.add('active-turn');
        }
    }

    getPlayerBetAmount(playerID) {
        let inputElement;
        if (playerID === 'player1' && this.domCache.player1BetAmountInput) {
            inputElement = this.domCache.player1BetAmountInput;
        } else if (playerID === 'player2' && this.domCache.player2BetAmountInput) {
            inputElement = this.domCache.player2BetAmountInput;
        } else {
            return 0;
        }
        const amount = parseInt(inputElement.value, 10);
        return isNaN(amount) || amount < 0 ? 0 : amount;
    }

    resetPlayerBetAmount(playerID, defaultValue = 10) {
        let inputElement;
        if (playerID === 'player1' && this.domCache.player1BetAmountInput) {
            inputElement = this.domCache.player1BetAmountInput;
        } else if (playerID === 'player2' && this.domCache.player2BetAmountInput) {
            inputElement = this.domCache.player2BetAmountInput;
        }
        if (inputElement) {
            inputElement.value = defaultValue;
        }
    }

    resetUIForNewRound(player1Entity, player2Entity, crupierEntity, gameMode) {
        this.clearGameResultMessages();
        this.setTurnIndicator('Realicen sus apuestas.');

        if (crupierEntity && this.domCache.crupierCardsDisplay) this.displayHand(crupierEntity, false);
        if (player1Entity && this.domCache.player1CardsDisplay) this.displayHand(player1Entity, true); // La mano propia siempre visible

        if (player2Entity && (gameMode === 'player' || gameMode === 'network')) { // 'network' es el modo que usa blackjack_main
             if (this.domCache.player2CardsDisplay) {
                this.displayHand(player2Entity, true); // La mano propia siempre visible
                this.showPlayer2Section(true);
                this.updatePlayerInfo(player2Entity);
                this.resetPlayerBetAmount('player2');
             } else {
                console.warn("UIManager: No se pudo resetear UI para P2, player2CardsDisplay falta.");
                this.showPlayer2Section(false);
             }
        } else {
            this.showPlayer2Section(false);
        }

        if (player1Entity) this.updatePlayerInfo(player1Entity);
        if (crupierEntity) this.updatePlayerInfo(crupierEntity);
        this.resetPlayerBetAmount('player1');


        this.toggleGameControls(true, true, false);
        this.setActiveTurn(null); // Ningún turno activo inicialmente en nueva ronda
    }

    onPlayMachine(callback) {
        if (this.domCache.playMachineButton) this.domCache.playMachineButton.addEventListener('click', callback);
    }
    onPlayPlayer(callback) {
        if (this.domCache.playPlayerButton) this.domCache.playPlayerButton.addEventListener('click', callback);
    }
    onBackToMenu(callback) {
        if (this.domCache.backToMenuButton) this.domCache.backToMenuButton.addEventListener('click', callback);
    }
    onJugar(callback) {
        if (this.domCache.jugarButton) this.domCache.jugarButton.addEventListener('click', callback);
    }
    onPedir(callback) {
        if (this.domCache.pedirButton) this.domCache.pedirButton.addEventListener('click', callback);
    }
    onPasar(callback) {
        if (this.domCache.pasarButton) this.domCache.pasarButton.addEventListener('click', callback);
    }
}