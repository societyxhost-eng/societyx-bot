const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'chatStats.json');

function loadStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao salvar chatStats.json:', err);
  }
}

module.exports = function chatStats(client) {
  let store = loadStore();
  let counterSinceLastSave = 0;

  client.on(Events.MessageCreate, (message) => {
    if (!message.inGuild()) return;
    if (message.author?.bot) return;

    const userId = message.author.id;
    store[userId] = (store[userId] || 0) + 1;
    counterSinceLastSave++;

    if (counterSinceLastSave >= 25) {
      saveStore(store);
      counterSinceLastSave = 0;
    }
  });

  setInterval(() => saveStore(store), 60_000);
};