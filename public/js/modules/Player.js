export class Player {
    /**
     * Crea una instancia de Jugador.
     * @param {string} id - Identificador único para el jugador (ej: 'player1', 'crupier').
     * @param {object} initialData - Datos iniciales para el jugador.
     * @param {string} [initialData.name=Jugador] - Nombre del jugador.
     * @param {number} [initialData.chips=100] - Fichas iniciales del jugador.
     * @param {number} [initialData.debt=0] - Deuda inicial del jugador.
     */
    constructor(id, initialData = {}) {
        if (!id || typeof id !== 'string') {
            throw new Error("Player ID es requerido y debe ser un string.");
        }

        this.id = id;
        this.name = initialData.name || (id === 'crupier' ? 'Crupier' : `Jugador ${id.replace('player', '')}`);
        this.chips = typeof initialData.chips === 'number' ? initialData.chips : 100;
        this.debt = typeof initialData.debt === 'number' ? initialData.debt : 0;

        this.hand = [];
        this.currentBet = 0;
        this.isDealer = (this.id === 'crupier');
        this.isBust = false;
        this.hasBlackjack = false;
        this.isDone = false; 
        this.roundMessage = ''; 
    }

    /**
     * Añade una carta a la mano del jugador y actualiza su estado.
     * @param {object} card - Objeto carta (ej: { suit: 'Hearts', value: 'A' }).
     */
    addCard(card) {
        if (card && typeof card.value !== 'undefined' && typeof card.suit !== 'undefined') {
            this.hand.push(card);
            this.updateStatus();
        } else {
            console.error(`Player ${this.id}: Intento de añadir una carta inválida.`, card);
        }
    }

    /**
     * Limpia la mano del jugador y resetea su estado de ronda.
     * No resetea fichas ni deuda.
     */
    resetForNewRound() {
        this.hand = [];
        this.currentBet = 0;
        this.isBust = false;
        this.hasBlackjack = false;
        this.isDone = false;
        this.roundMessage = '';
    }

    /**
     * Calcula el valor total de la mano del jugador según las reglas del Blackjack.
     * @returns {number} El valor de la mano.
     */
    getHandValue() {
        let value = 0;
        let numAces = 0;

        if (!this.hand || this.hand.length === 0) {
            return 0;
        }

        for (const card of this.hand) {
            if (!card || typeof card.value === 'undefined') continue; // Salta cartas inválidas

            if (['J', 'Q', 'K'].includes(card.value)) {
                value += 10;
            } else if (card.value === 'A') {
                value += 11;
                numAces++;
            } else {
                const cardVal = parseInt(card.value, 10);
                if (!isNaN(cardVal)) {
                    value += cardVal;
                }
            }
        }

        while (value > 21 && numAces > 0) {
            value -= 10;
            numAces--;
        }
        return value;
    }

    /**
     * Actualiza el estado del jugador (isBust, hasBlackjack) basado en su mano actual.
     * Si el jugador se pasa, se marca como 'isDone'.
     */
    updateStatus() {
        const handValue = this.getHandValue();
        this.isBust = handValue > 21;
        this.hasBlackjack = (handValue === 21 && this.hand.length === 2);

        if (this.isBust) {
            this.isDone = true; // Si se pasa, termina su turno automáticamente
        }
    }

    /**
     * Realiza una apuesta, restando las fichas.
     * @param {number} amount - La cantidad a apostar.
     * @returns {boolean} True si la apuesta fue exitosa, false en caso contrario.
     */
    placeBet(amount) {
        const betAmount = parseInt(amount, 10);
        if (isNaN(betAmount) || betAmount <= 0) {
            this.roundMessage = "La cantidad de la apuesta debe ser un número positivo.";
            return false;
        }
        if (betAmount > this.chips) {
            this.roundMessage = "Fondos insuficientes para la apuesta.";
            return false;
        }
        this.chips -= betAmount;
        this.currentBet = betAmount;
        this.roundMessage = ''; // Limpiar mensaje de error si la apuesta es válida
        return true;
    }

    /**
     * El jugador gana la apuesta.
     * @param {boolean} [isBlackjackWin=false] - True si la ganancia es por un Blackjack (pago 3:2).
     */
    winBet(isBlackjackWin = false) {
        if (this.currentBet > 0) {
            if (isBlackjackWin) {
                this.chips += this.currentBet + Math.floor(this.currentBet * 1.5); // Pago 3:2
            } else {
                this.chips += this.currentBet * 2; // Pago 1:1 (la apuesta original + la ganancia)
            }
        }
    }

    /**
     * El jugador pierde la apuesta. Las fichas ya fueron restadas al apostar.
     */
    loseBet() {
        // No se hace nada con las fichas, ya se restaron en placeBet.
    }

    /**
     * La apuesta resulta en empate (push). El jugador recupera su apuesta.
     */
    pushBet() {
        if (this.currentBet > 0) {
            this.chips += this.currentBet; // Devuelve la apuesta
        }
    }

    /**
     * Marca al jugador como "plantado" (terminó su turno voluntariamente).
     */
    stand() {
        this.isDone = true;
    }

    /**
     * Devuelve un objeto plano con los datos persistentes del jugador.
     * Usado para guardar en localStorage.
     * @returns {{id: string, name: string, chips: number, debt: number}}
     */
    toPersistenceObject() {
        return {
            name: this.name,
            chips: this.chips,
            debt: this.debt,
        };
    }

    /**
     * Devuelve un objeto plano con el estado actual del jugador para la UI.
     * @returns {object}
     */
    to_dict() {
        const handRepresentation = this.hand.map(card => ({ ...card }));

        return {
            id: this.id,
            name: this.name,
            chips: this.chips,
            debt: this.debt, 
            hand: handRepresentation,
            points: this.getHandValue(), 
            currentBet: this.currentBet,
            isDone: this.isDone,
            isBust: this.isBust,
            hasBlackjack: this.hasBlackjack,
            roundMessage: this.roundMessage
        };
    }
}