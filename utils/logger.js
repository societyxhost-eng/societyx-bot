const { EmbedBuilder, ChannelType, PermissionsBitField } = require("discord.js");

let LOG_CHANNEL_ID = "1424515588700639393";

const ACTIONS = {
  Banimento: { color: 0xE74C3C, emoji: "🔨", title: "Usuário Banido" },
  Expulsão: { color: 0xE67E22, emoji: "👢", title: "Usuário Expulso" },
  Timeout: { color: 0xF1C40F, emoji: "⏱️", title: "Usuário Silenciado" },
  Clear: { color: 0x3498DB, emoji: "🧹", title: "Mensagens Limpas" },
  Warn: { color: 0xC0392B, emoji: "⚠️", title: "Aviso Emitido" },
  Unwarn: { color: 0x27AE60, emoji: "✅", title: "Aviso Removido" },
  Default: { color: 0x95A5A6, emoji: "ℹ️", title: "Ação de Moderação" }
};

async function getOrCreateLogChannel(client) {
  let channel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!channel) {
    const guild = client.guilds.cache.first();
    if (!guild) return null;

    channel = guild.channels.cache.find(
      (ch) =>
        ch.name.toLowerCase().includes("log") &&
        ch.type === ChannelType.GuildText
    );

    if (!channel) {
      try {
        channel = await guild.channels.create({
          name: "📜・logs-mod",
          type: ChannelType.GuildText,
          topic: "Canal automático de registros de moderação",
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.SendMessages],
            },
          ],
        });
        console.log(`[Logger] Canal de logs criado: ${channel.name}`);
      } catch (err) {
        console.error("[Logger] Erro ao criar canal de logs:", err);
        return null;
      }
    }

    LOG_CHANNEL_ID = channel.id;
  }
  return channel;
}

function formatDateToBR(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { 
    timeZone: 'America/Sao_Paulo', 
    hour12: false, 
    dateStyle: 'short', 
    timeStyle: 'medium' 
  }).format(date);
}

async function logAction(client, { action, moderator, target, reason, extra }) {
  const channel = await getOrCreateLogChannel(client);
  if (!channel) return;

  const info = ACTIONS[action] || ACTIONS.Default;

  const embed = new EmbedBuilder()
    .setTitle(`${info.emoji} ${info.title}`)
    .setColor(info.color)
    .addFields(
      { name: "👮 Moderador", value: moderator?.tag ?? "Desconhecido", inline: true },
      { name: "👤 Usuário", value: target?.tag ?? "N/A", inline: true },
      { name: "🆔 ID do Usuário", value: target?.id ?? "N/A", inline: true },
      { name: "⚖️ Ação", value: action, inline: true },
      { name: "📄 Motivo", value: reason || "Não informado" },
      ...(extra ? [{ name: "📌 Detalhes", value: extra }] : []),
      { name: "🕒 Data/Hora", value: formatDateToBR() }
    )
    .setFooter({ text: "Sistema de Moderação", iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

module.exports = { logAction };
