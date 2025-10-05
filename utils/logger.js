const { EmbedBuilder, ChannelType, PermissionsBitField } = require("discord.js");


let LOG_CHANNEL_ID = "123456789012345678";

const ACTIONS = {
  Banimento: { color: "Red", emoji: "🔨" },
  Expulsão: { color: "Orange", emoji: "👢" },
  Timeout: { color: "Yellow", emoji: "⏱️" },
  Clear: { color: "Blue", emoji: "🧹" },
  Warn: { color: "DarkRed", emoji: "⚠️" },
  Unwarn: { color: "Green", emoji: "✅" },
};

async function getOrCreateLogChannel(client) {
  let channel = client.channels.cache.get(LOG_CHANNEL_ID);

  if (!channel) {
    const guild = client.guilds.cache.first();
    if (!guild) return null;

    channel = guild.channels.cache.find(
      (ch) => ch.name.toLowerCase().includes("log") && ch.type === ChannelType.GuildText
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

async function logAction(client, { action, moderator, target, reason, extra }) {
  const channel = await getOrCreateLogChannel(client);
  if (!channel) return;

  const info = ACTIONS[action] || { color: "Grey", emoji: "ℹ️" };

  const embed = new EmbedBuilder()
    .setTitle(`${info.emoji} Registro de Moderação`)
    .setColor(info.color)
    .addFields(
      { name: "👮 Moderador", value: moderator?.tag ?? "Desconhecido", inline: true },
      { name: "👤 Usuário", value: target?.tag ?? "N/A", inline: true },
      { name: "⚖️ Ação", value: action, inline: true },
      { name: "📄 Motivo", value: reason || "Não informado" }
    )
    .setTimestamp();

  if (extra) embed.addFields({ name: "📌 Detalhes", value: extra });

  await channel.send({ embeds: [embed] });
}

module.exports = { logAction };