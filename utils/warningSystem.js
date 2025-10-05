const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "warnings.json");

// Função auxiliar para carregar os warnings
function loadWarnings() {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
            return {};
        }

        const data = fs.readFileSync(filePath, "utf8");
        return data ? JSON.parse(data) : {};
    } catch (err) {
        console.error("Erro ao ler warnings.json:", err);
        return {};
    }
}

// Função auxiliar para salvar
function saveWarnings(warnings) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(warnings, null, 2));
    } catch (err) {
        console.error("Erro ao salvar warnings.json:", err);
    }
}

// Adiciona um warning
function addWarning(guildId, userId, reason) {
    const warnings = loadWarnings();

    if (!warnings[guildId]) warnings[guildId] = {};
    if (!warnings[guildId][userId]) warnings[guildId][userId] = [];

    const newWarning = {
        reason,
        timestamp: Date.now(),
        userId
    };

    warnings[guildId][userId].push(newWarning);

    saveWarnings(warnings);
    return warnings[guildId][userId].length; // retorna total de warnings do usuário
}

// Retorna todos os warnings de um servidor
function getAllWarnings(guildId) {
    const warnings = loadWarnings();
    return warnings[guildId] || {};
}

// Retorna os warnings de um usuário específico
function getUserWarnings(guildId, userId) {
    const warnings = loadWarnings();
    return warnings[guildId]?.[userId] || [];
}

// Reseta os warnings de um usuário
function resetWarnings(guildId, userId) {
    const warnings = loadWarnings();

    if (warnings[guildId] && warnings[guildId][userId]) {
        delete warnings[guildId][userId];
        saveWarnings(warnings);
    }
}

// Reseta todos os warnings de um servidor
function resetAllWarnings(guildId) {
    const warnings = loadWarnings();
    if (warnings[guildId]) {
        warnings[guildId] = {};
        saveWarnings(warnings);
    }
}

// Exporta
module.exports = {
    addWarning,
    getAllWarnings,
    getUserWarnings,
    resetWarnings,
    resetAllWarnings,
    saveWarnings,
};
