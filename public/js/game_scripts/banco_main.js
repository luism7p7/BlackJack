// public/js/game_scripts/banco_main.js

import { loadOrCreatePlayerData, saveToLocalStorage } from '../modules/StorageManager.js';
// No importamos Player como clase aquí, ya que solo manejamos sus datos (fichas, deuda)
// y no su comportamiento de juego (cartas, puntos).

const PLAYER_STORAGE_KEY = 'casino_blackjack_player1_data'; // Usamos la misma clave que en Blackjack
const DEFAULT_PLAYER_DATA = { name: 'Jugador 1', chips: 100, debt: 0 }; // Debe coincidir
const INTEREST_RATE = 0.10; // 10% de interés

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const jugadorDisplay = document.getElementById('jugador');
    const tituloDeudaDisplay = document.getElementById('tituloDeuda'); // Aunque en tu HTML no lo usas para mostrar deuda, lo dejo por si acaso
    const cantidadPrestamoInput = document.getElementById('cantidad-prestamo');
    const devolverDisplay = document.getElementById('devolver');
    const pedirPrestamoButton = document.getElementById('pedir-prestamo');
    const pagarDeudaButton = document.getElementById('pagar-deuda');
    const resultadoDisplay = document.getElementById('resultado');
    const volverButton = document.getElementById('volver-al-menu');

    let playerData = loadOrCreatePlayerData(PLAYER_STORAGE_KEY, DEFAULT_PLAYER_DATA);

    function updateUI() {
        if (!playerData) return;

        jugadorDisplay.textContent = `${playerData.name} - Fichas: ${playerData.chips}F`;
        // tituloDeudaDisplay.textContent = `Deuda Actual: ${playerData.debt}F`; // Si quisieras mostrar la deuda en el H1
        
        if (playerData.debt > 0) {
            pagarDeudaButton.disabled = false;
            pagarDeudaButton.textContent = `Pagar Deuda (${playerData.debt}F)`;
        } else {
            pagarDeudaButton.disabled = true;
            pagarDeudaButton.textContent = 'Pagar Deuda';
        }
        
        // Limpiar el input de cantidad y el total a devolver si la deuda es 0
        if (playerData.debt === 0) {
             cantidadPrestamoInput.value = '';
             devolverDisplay.textContent = 'Total a devolver: 0F';
        }
        resultadoDisplay.textContent = ''; // Limpiar mensajes anteriores
    }

    function calcularTotalADevolver() {
        const cantidad = parseInt(cantidadPrestamoInput.value, 10);
        if (isNaN(cantidad) || cantidad <= 0) {
            devolverDisplay.textContent = 'Total a devolver: 0F';
            return 0;
        }
        const interes = Math.floor(cantidad * INTEREST_RATE); // Interés simple
        const totalDevolver = cantidad + interes;
        devolverDisplay.textContent = `Total a devolver: ${totalDevolver}F (Préstamo: ${cantidad}F + Interés: ${interes}F)`;
        return totalDevolver;
    }

    cantidadPrestamoInput.addEventListener('input', calcularTotalADevolver);

    pedirPrestamoButton.addEventListener('click', () => {
        const cantidadPedida = parseInt(cantidadPrestamoInput.value, 10);

        if (isNaN(cantidadPedida) || cantidadPedida <= 0) {
            resultadoDisplay.textContent = 'Error: Ingresa una cantidad válida para el préstamo.';
            resultadoDisplay.style.color = 'red';
            return;
        }

        if (playerData.debt > 0) {
            resultadoDisplay.textContent = 'Error: Ya tienes una deuda pendiente. Debes pagarla antes de pedir otro préstamo.';
            resultadoDisplay.style.color = 'orange';
            return;
        }

        const totalADevolverCalculado = calcularTotalADevolver();
        if (totalADevolverCalculado <= cantidadPedida) { // Sanity check, debería ser mayor por el interés
            resultadoDisplay.textContent = 'Error al calcular el préstamo. Intenta de nuevo.';
            resultadoDisplay.style.color = 'red';
            return;
        }

        playerData.chips += cantidadPedida;
        playerData.debt = totalADevolverCalculado;

        saveToLocalStorage(PLAYER_STORAGE_KEY, playerData);
        resultadoDisplay.textContent = `¡Préstamo de ${cantidadPedida}F concedido! Ahora tienes ${playerData.chips}F. Tu deuda es de ${playerData.debt}F.`;
        resultadoDisplay.style.color = '#4CAF50'; // Verde para éxito
        updateUI();
    });

    pagarDeudaButton.addEventListener('click', () => {
        if (playerData.debt <= 0) {
            resultadoDisplay.textContent = 'No tienes ninguna deuda que pagar.';
            resultadoDisplay.style.color = 'orange';
            return;
        }

        if (playerData.chips < playerData.debt) {
            resultadoDisplay.textContent = `No tienes suficientes fichas (${playerData.chips}F) para pagar tu deuda de ${playerData.debt}F.`;
            resultadoDisplay.style.color = 'red';
            return;
        }

        playerData.chips -= playerData.debt;
        const deudaPagada = playerData.debt;
        playerData.debt = 0;

        saveToLocalStorage(PLAYER_STORAGE_KEY, playerData);
        resultadoDisplay.textContent = `¡Deuda de ${deudaPagada}F pagada! Te quedan ${playerData.chips}F.`;
        resultadoDisplay.style.color = '#4CAF50';
        updateUI();
    });

    volverButton.addEventListener('click', () => {
        window.location.href = "../index.html";
    });

    // Inicializar UI al cargar la página
    updateUI();
    calcularTotalADevolver(); // Para mostrar el cálculo inicial si hay valor en input
});