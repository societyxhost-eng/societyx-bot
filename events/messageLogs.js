const {
  Events,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
} = require('discord.js');

// Canal fixo de logs (pode trocar por env: process.env.MESSAGE_LOG_CHANNEL_ID)
const LOG_CHANNEL_ID = '1424515588700639393';

function safeText(text) {
  if (!text || String(text).trim().length === 0) return 'Sem conteúdo';
  const t = String(text);
  return t.length > 1800 ? t.slice(0, 1797) + '...' : t;
}

function sendContainer(channel, container) {
  return channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

module.exports = function messageLogs(client) {
  const getLogChannel = () => client.channels.cache.get(LOG_CHANNEL_ID);

  // Mensagem criada
  client.on(Events.MessageCreate, async (message) => {
    if (message.author?.bot) return;
    const logChannel = getLogChannel();
    if (!logChannel) return;

    const container = new ContainerBuilder();
    container.setComponents([
      new TextDisplayBuilder()
        .setTitle('Mensagem Criada')
        .setContent(
          `Autor: ${message.author?.tag || 'Desconhecido'}\n` +
          `Canal: #${message.channel?.name || 'DM'}`
        ),
      new SeparatorBuilder(),
      new TextDisplayBuilder()
        .setTitle('Conteúdo')
        .setContent(safeText(message.content)),
    ]);

    try {
      await sendContainer(logChannel, container);
    } catch (_) {}
  });

  // Mensagem editada
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    const logChannel = getLogChannel();
    if (!logChannel) return;

    const author = newMessage.author || oldMessage.author;
    if (author?.bot) return;

    const before = safeText(oldMessage.content);
    const after = safeText(newMessage.content);
    const channelName = newMessage.channel?.name || oldMessage.channel?.name || 'DM';

    const container = new ContainerBuilder();
    container.setComponents([
      new TextDisplayBuilder()
        .setTitle('Mensagem Editada')
        .setContent(
          `Autor: ${author?.tag || 'Desconhecido'}\n` +
          `Canal: #${channelName}`
        ),
      new TextDisplayBuilder().setTitle('Antes').setContent(before),
      new SeparatorBuilder(),
      new TextDisplayBuilder().setTitle('Depois').setContent(after),
    ]);

    try {
      await sendContainer(logChannel, container);
    } catch (_) {}
  });

  // Mensagem deletada
  client.on(Events.MessageDelete, async (message) => {
    const logChannel = getLogChannel();
    if (!logChannel) return;
    if (message.author?.bot) return;

    const container = new ContainerBuilder();
    container.setComponents([
      new TextDisplayBuilder()
        .setTitle('Mensagem Deletada')
        .setContent(
          `Autor: ${message.author?.tag || 'Desconhecido'}\n` +
          `Canal: #${message.channel?.name || 'DM'}`
        ),
      new SeparatorBuilder(),
      new TextDisplayBuilder().setTitle('Conteúdo').setContent(safeText(message.content)),
    ]);

    try {
      await sendContainer(logChannel, container);
    } catch (_) {}
  });
};