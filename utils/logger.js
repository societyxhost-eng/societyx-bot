const { EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');

let LOG_CHANNEL_ID = '1424931738051809281';

const ACTIONS = {
  Banimento: { color: 0xE74C3C, emoji: '🔨', title: 'Usuário Banido' },
  Unban:     { color: 0x27AE60, emoji: '🔓', title: 'Usuário Desbanido' },
  Expulsão:  { color: 0xE67E22, emoji: '👢', title: 'Usuário Expulso' },
  Timeout:   { color: 0xF1C40F, emoji: '⏱️', title: 'Usuário Silenciado' },
  Clear:     { color: 0x3498DB, emoji: '🧹', title: 'Mensagens Limpas' },
  Warn:      { color: 0xC0392B, emoji: '⚠️', title: 'Aviso Emitido' },
  Unwarn:    { color: 0x27AE60, emoji: '✅', title: 'Aviso Removido' },
  Default:   { color: 0x95A5A6, emoji: 'ℹ️', title: 'Ação de Moderação' },
};

const ALIASES = {
  unban: 'Unban',
  desbanir: 'Unban',
  unwarn: 'Unwarn',
  removeraviso: 'Unwarn',
  ban: 'Banimento',
  banimento: 'Banimento',
  kick: 'Expulsão',
  expulsao: 'Expulsão',
  timeout: 'Timeout',
  mute: 'Timeout',
};

const USE_GUILD_BRAND = true; // true => usa nome/ícone do servidor; false => usa o do bot

async function getOrCreateLogChannel(client) {
  let channel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!channel) {
    const guild = client.guilds.cache.first();
    if (!guild) return null;

    channel = guild.channels.cache.find(
      (ch) => ch.name.toLowerCase().includes('log') && ch.type === ChannelType.GuildText
    );

    if (!channel) {
      try {
        channel = await guild.channels.create({
          name: '📜・logs-mod',
          type: ChannelType.GuildText,
          topic: 'Canal automático de registros de moderação',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.SendMessages],
            },
          ],
        });
        console.log(`[Logger] Canal de logs criado: ${channel.name}`);
      } catch (err) {
        console.error('[Logger] Erro ao criar canal de logs:', err);
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
    timeStyle: 'medium',
  }).format(date);
}

function asStringSafe(val, fallback = 'Não informado') {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return fallback; }
  }
  return String(val);
}

async function logAction(client, { action, moderator, target, reason, extra, guildId }) {
  const channel = await getOrCreateLogChannel(client);
  if (!channel) return;

  const guild =
    (guildId && client.guilds.cache.get(guildId)) ||
    channel.guild ||
    client.guilds.cache.first();

  const normalized = ALIASES[String(action || '').toLowerCase()] || action || 'Default';
  const info = ACTIONS[normalized] || ACTIONS.Default;

  const moderatorName =
    moderator?.tag || moderator?.username || (moderator?.id && `ID: ${moderator.id}`) || 'Desconhecido';

  const targetName =
    target?.tag || target?.username || (target?.id && `ID: ${target.id}`) || 'N/A';

  const targetId = target?.id || 'N/A';
  const reasonStr = asStringSafe(reason, 'Não informado');
  const detailsStr = extra ? asStringSafe(extra) : null;

  const authorName = USE_GUILD_BRAND
    ? (guild?.name || client.user.username)
    : client.user.username;

  const authorIcon = USE_GUILD_BRAND
    ? guild?.iconURL?.({ size: 128 }) || client.user.displayAvatarURL({ size: 128 })
    : client.user.displayAvatarURL({ size: 128 });

  const embed = new EmbedBuilder()
    .setColor(info.color)
    .setTitle(`${info.emoji} ${info.title}`)
    .setAuthor({
      name: authorName,
      iconURL: authorIcon || undefined,
    })
    .addFields(
      { name: '⚖️ Ação', value: String(normalized), inline: true },
      { name: '👮 Moderador', value: moderatorName, inline: true },
      { name: '👤 Usuário', value: targetName, inline: true },
      { name: '🆔 ID do Usuário', value: String(targetId), inline: true },
      { name: '📄 Motivo', value: reasonStr },
      ...(detailsStr ? [{ name: '📌 Detalhes', value: detailsStr }] : []),
      { name: '🕒 Data/Hora', value: formatDateToBR() }
    )
    .setFooter({
      text: client.user.username,
      iconURL: client.user.displayAvatarURL({ size: 64 }),
    })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Logger] Falha ao enviar log:', err);
  }
}

module.exports = { logAction };