const {
  ChannelType,
  PermissionsBitField,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

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

async function logAction(client, { action, moderator, target, reason, extra }) {
  const channel = await getOrCreateLogChannel(client);
  if (!channel) return;

  const info = ACTIONS[action] || ACTIONS.Default;
  const accent =
    typeof info.color === 'string'
      ? Number(info.color.replace('#', '0x'))
      : info.color ?? 0x2f3136;

  const container = new ContainerBuilder()
    .setAccentColor(accent);

  const sep = new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${info.emoji ?? ''} ${info.title}`)
  );
  container.addSeparatorComponents(sep);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**👮 Moderador:** ${moderator?.tag ?? 'Desconhecido'}`),
    new TextDisplayBuilder().setContent(`**👤 Usuário:** ${target?.tag ?? 'N/A'}`),
    new TextDisplayBuilder().setContent(`**🆔 ID do Usuário:** ${target?.id ?? 'N/A'}`),
    new TextDisplayBuilder().setContent(`**⚖️ Ação:** ${action}`),
    new TextDisplayBuilder().setContent(`**📄 Motivo:** ${reason || 'Não informado'}`),
    ...(extra ? [new TextDisplayBuilder().setContent(`**📌 Detalhes:** ${extra}`)] : [])
  );
  container.addSeparatorComponents(sep);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`*Sistema de Moderação • ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false, dateStyle: 'short', timeStyle: 'medium' }).format(new Date())}*`)
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🔗 Perfil')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/users/${target?.id ?? ''}`)
  );
  container.addActionRowComponents(row);

  try {
    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    console.error('[Logger] Falha ao enviar log:', err);
  }
}

module.exports = { logAction };