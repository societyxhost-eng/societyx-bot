const { Events, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'chatStats.json');
const STATE_PATH = path.join(__dirname, '..', 'topchatMessage.json');

const CHANNEL_ID = process.env.TOPCHAT_CHANNEL_ID || '1423874783493361795';

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { messageId: null };
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao salvar topchatMessage.json:', err);
  }
}

function buildContainer(limit, guild) {
  const store = readStore();
  const entries = Object.entries(store).sort((a, b) => b[1] - a[1]).slice(0, limit);

  const linhas =
    entries.length === 0
      ? ['Ainda não há dados coletados.']
      : entries.map(([id, count], idx) => `${idx + 1}. <@${id}> — ${count} mensagens`);

  const stamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const header = `## 📊 Top Chat (atualizado ${stamp})`;

  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${header}\n${linhas.join('\n')}`)
  );
}

module.exports = function topchatAuto(client) {
  client.once(Events.ClientReady, async () => {
    if (!CHANNEL_ID) {
      console.warn('TOPCHAT_CHANNEL_ID não definido. Auto-update do topchat desativado.');
      return;
    }

    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) {
      console.warn(`Canal ${CHANNEL_ID} não encontrado. Auto-update do topchat desativado.`);
      return;
    }

    let state = readState();

    async function runUpdate() {
      const container = buildContainer(10, channel.guild);

      try {
        if (state.messageId) {
          const msg = await channel.messages.fetch(state.messageId).catch(() => null);
          if (msg) {
            await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
            return;
          }
        }

        const sent = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        state.messageId = sent.id;
        writeState(state);
      } catch (err) {
        console.error('Erro ao atualizar Top Chat:', err);
      }
    }

    // Dispara imediatamente e a cada 5 minutos
    await runUpdate();
    setInterval(runUpdate, 5 * 60 * 1000);
  });
};