// public/js/modules/StorageManager.js

/**
 * Guarda un objeto JSON en localStorage.
 * Si el valor es null o undefined, elimina la clave de localStorage.
 * @param {string} key La clave bajo la cual se guardará el objeto.
 * @param {object | null | undefined} value El objeto a guardar.
 */
export function saveToLocalStorage(key, value) {
    if (value === null || typeof value === 'undefined') {
        removeFromLocalStorage(key);
        return;
    }
    try {
        const serializedValue = JSON.stringify(value);
        localStorage.setItem(key, serializedValue);
    } catch (error) {
        console.error(`StorageManager: Error guardando en localStorage (key: ${key}).`, error);
        // lanzar el error para que la aplicación lo maneje
        throw new Error(`StorageManager: Fallo al guardar ${key}`);
    }
}

/**
 * Obtiene un objeto JSON de localStorage.
 * @param {string} key La clave del objeto a obtener.
 * @returns {object | null} El objeto parseado o null si no se encuentra o hay un error de parseo.
 */
export function getFromLocalStorage(key) {
    try {
        const serializedValue = localStorage.getItem(key);
        if (serializedValue === null) {
            return null;
        }
        return JSON.parse(serializedValue);
    } catch (error) {
        console.error(`StorageManager: Error obteniendo o parseando de localStorage (key: ${key}).`, error);
        // En caso de error de parseo, es mejor devolver null que un objeto corrupto.
        // También podríamos eliminar el item corrupto aquí si quisiéramos.
        // removeFromLocalStorage(key);
        return null;
    }
}

/**
 * Elimina un item de localStorage.
 * @param {string} key La clave del item a eliminar.
 */
export function removeFromLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`StorageManager: Error eliminando de localStorage (key: ${key}).`, error);
    }
}

/**
 * Carga los datos de un jugador (como objeto plano) desde localStorage
 * o crea un nuevo objeto de datos de jugador si no existe.
 *
 * Nota: Esta función devuelve un objeto plano. La instanciación
 * como clase `Player` deberá ocurrir fuera, una vez que los datos
 * son recuperados o creados por esta función.
 *
 * @param {string} playerKey La clave para los datos del jugador en localStorage (ej: 'casinoPlayerData_j1').
 * @param {object} defaultPlayerData Un objeto con los datos por defecto para un nuevo jugador.
 *                                   Ej: { fichas: 100, deuda: 0, nombre: 'Jugador 1' }
 * @returns {object} Un objeto con los datos del jugador (cargados o nuevos).
 */
export function loadOrCreatePlayerData(playerKey, defaultPlayerData) {
    if (!playerKey || typeof playerKey !== 'string') {
        console.error("StorageManager: playerKey debe ser un string no vacío.");
        // Devolver una copia de los datos por defecto podría ser una opción segura aquí
        // o lanzar un error. Por ahora, advertimos y devolvemos default.
        return { ...defaultPlayerData };
    }
    if (!defaultPlayerData || typeof defaultPlayerData !== 'object') {
        console.error("StorageManager: defaultPlayerData debe ser un objeto.");
        // Podríamos tener un objeto ultra-básico por defecto aquí, o lanzar un error.
        return { fichas: 0, deuda: 0 }; // Fallback muy básico
    }

    let playerData = getFromLocalStorage(playerKey);

    if (playerData === null) {
        console.log(`StorageManager: No se encontró jugador con clave "${playerKey}". Creando datos por defecto.`);
        // Aseguramos que creamos una copia para no mutar el objeto defaultPlayerData original
        playerData = { ...defaultPlayerData };
        saveToLocalStorage(playerKey, playerData); // Guardamos el nuevo jugador inmediatamente
    } else {
        // Opcional: Validar que playerData tiene las propiedades esperadas de defaultPlayerData
        // y si no, fusionarlas o actualizarlas.
        // Por ejemplo, si se añade una nueva propiedad a defaultPlayerData en una versión futura.
        let updated = false;
        for (const key in defaultPlayerData) {
            if (Object.hasOwnProperty.call(defaultPlayerData, key) && !Object.hasOwnProperty.call(playerData, key)) {
                playerData[key] = defaultPlayerData[key];
                updated = true;
            }
        }
        if (updated) {
            console.log(`StorageManager: Actualizando datos del jugador "${playerKey}" con nuevas propiedades por defecto.`);
            saveToLocalStorage(playerKey, playerData);
        }
    }
    return playerData;
}

/**
 * Limpia todos los datos del localStorage que podrían estar relacionados con el juego.
 * ¡Usar con precaución! Podría ser útil para un reseteo completo.
 * @param {string[]} keysToClear - Un array de claves a eliminar. Si no se provee, no hace nada.
 */
export function clearGameDataFromLocalStorage(keysToClear = []) {
    if (!Array.isArray(keysToClear)) {
        console.error("StorageManager: keysToClear debe ser un array.");
        return;
    }
    console.warn("StorageManager: Limpiando datos del juego de localStorage...");
    keysToClear.forEach(key => {
        removeFromLocalStorage(key);
    });
    console.log("StorageManager: Datos del juego limpiados.");
}