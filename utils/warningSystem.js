const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "warnings.json");

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

function saveWarnings(warnings) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(warnings, null, 2));
    } catch (err) {
        console.error("Erro ao salvar warnings.json:", err);
    }
}

function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

function addWarning(guildId, userId, reason) {
    const warnings = loadWarnings();
    if (!warnings[guildId]) warnings[guildId] = {};
    if (!warnings[guildId][userId]) warnings[guildId][userId] = [];
    const newWarning = {
        id: generateId(),
        reason,
        timestamp: Date.now(),
        userId
    };
    warnings[guildId][userId].push(newWarning);
    saveWarnings(warnings);
    return { warning: newWarning, totalWarnings: warnings[guildId][userId].length };
}

function removeWarning(guildId, userId, warningId) {
    const allWarnings = loadWarnings();
    if (!allWarnings[guildId] || !allWarnings[guildId][userId]) {
        return null;
    }

    let removedWarning = null;
    const userWarnings = allWarnings[guildId][userId];
    const warningIndex = userWarnings.findIndex(w => w.id === warningId);

    if (warningIndex !== -1) {
        removedWarning = userWarnings.splice(warningIndex, 1)[0];
        if (userWarnings.length === 0) {
            delete allWarnings[guildId][userId];
        }
        saveWarnings(allWarnings);
    }
    return removedWarning;
}

function getAllWarnings(guildId) {
    const warnings = loadWarnings();
    return warnings[guildId] || {};
}

function getUserWarnings(guildId, userId) {
    const warnings = loadWarnings();
    return warnings[guildId]?.[userId] || [];
}

function resetWarnings(guildId, userId) {
    const warnings = loadWarnings();
    if (warnings[guildId] && warnings[guildId][userId]) {
        delete warnings[guildId][userId];
        saveWarnings(warnings);
    }
}

function resetAllWarnings(guildId) {
    const warnings = loadWarnings();
    if (warnings[guildId]) {
        warnings[guildId] = {};
        saveWarnings(warnings);
    }
}

function removeOldWarnings(guildId, userId) {
    const warnings = loadWarnings();
    if (warnings[guildId] && warnings[guildId][userId]) {
        const originalCount = warnings[guildId][userId].length;
        const updatedWarnings = warnings[guildId][userId].filter(w => w && w.id);
        if (updatedWarnings.length === originalCount) {
            return 0;
        }
        const removedCount = originalCount - updatedWarnings.length;
        if (updatedWarnings.length === 0) {
            delete warnings[guildId][userId];
        } else {
            warnings[guildId][userId] = updatedWarnings;
        }
        saveWarnings(warnings);
        return removedCount;
    }
    return 0;
}

module.exports = {
    addWarning,
    removeWarning, 
    getAllWarnings,
    getUserWarnings,
    resetWarnings,
    resetAllWarnings,
    saveWarnings,
    removeOldWarnings
};