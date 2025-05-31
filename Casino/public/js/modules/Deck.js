/**
 * Representa una carta individual.
 * @typedef {object} Card
 * @property {string} suit - El tipo de la carta (ejemplo: 'Corazon', 'Diamante', 'Trebol', 'Pica').
 * @property {string} value - El valor de la carta (ejemplo: '2', '10', 'K', 'A').
 */

export class Deck {
    /**
     * Crea una instancia de un mazo de cartas.
     * Por defecto, crea un mazo estándar de 52 cartas y lo baraja.
     * @param {number} [numDecks=1] - El número de barajas estándar de 52 cartas a combinar.
     */
    constructor(numDecks = 1) {
        if (typeof numDecks !== 'number' || numDecks < 1) {
            console.warn("Deck: numDecks debe ser un número positivo. Usando 1 por defecto.");
            this.numDecks = 1;
        } else {
            this.numDecks = numDecks;
        }
        this.cards = [];
        this.suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
        this.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.buildDeck();
        this.shuffle();
    }

    /**
     * Construye el mazo de cartas basado en el número de mazos especificado.
     * @protected
     */
    buildDeck() {
        this.cards = [];
        for (let i = 0; i < this.numDecks; i++) {
            for (const suit of this.suits) {
                for (const value of this.values) {
                    this.cards.push({ suit, value });
                }
            }
        }
    }

    /**
     * Baraja las cartas en el mazo utilizando el algoritmo Fisher-Yates.
     */
    shuffle() {
        // Algoritmo Fisher-Yates 
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]; // Intercambio de elementos
        }
    }

    /**
     * Reparte una carta de la parte superior del mazo.
     * Si el mazo está vacío, lo reconstruye y lo baraja automáticamente antes de repartir.
     * @returns {Card | null} La carta repartida, o null si ocurre un error inesperado (aunque debería rellenarse).
     */
    dealCard() {
        if (this.cards.length === 0) {
            console.warn("Deck: Mazo vacío. Reconstruyendo y barajando...");
            this.buildDeck();
            this.shuffle();
        }

        if (this.cards.length > 0) {
            return this.cards.pop();
        }
        // Este caso no debería ocurrir si la lógica de rellenado anterior funciona.
        console.error("Deck: No se pudo repartir una carta después de intentar rellenar el mazo.");
        return null;
    }

    /**
     * Devuelve el número de cartas restantes en el mazo.
     * @returns {number} El número de cartas restantes.
     */
    getRemainingCardsCount() {
        return this.cards.length;
    }
}