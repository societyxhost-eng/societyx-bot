const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const warningSystem = require('../utils/warningSystem');
const { logAction } = require('../utils/logger');

const BRAND = 'Societyx';
const BRAND_COLOR = 0x8f17a7;

const EPHEMERAL_FLAG = 1 << 6;

const panelState = new Map();

const BANNERS = {
  main:           'https://i.imgur.com/XWTaQdx.jpeg',
  warn:           'https://i.imgur.com/abcWARN.jpeg',
  kick:           'https://i.imgur.com/abcKICK.jpeg',
  ban:            'https://i.imgur.com/abcBAN.jpeg',
  punir:          'https://i.imgur.com/abcPUNIR.jpeg',
  warnings:       'https://i.imgur.com/abcWARNINGS.jpeg',
  unban:          'https://i.imgur.com/abcUNBAN.jpeg',
};

function buildBrandedEmbed(guild, title, description, bannerUrl) {
  const iconUrl = guild.iconURL({ size: 256 });
  const embed = new EmbedBuilder().setTitle(title).setColor(BRAND_COLOR);
  if (description) embed.setDescription(description);
  if (iconUrl) embed.setThumbnail(iconUrl);
  if (bannerUrl) embed.setImage(bannerUrl);
  return embed;
}

function buildMainEmbed(guild) {
  return buildBrandedEmbed(
    guild,
    `${BRAND} — Moderação`,
    'Painel de ações rápidas para manter a comunidade segura.',
    BANNERS.main
  );
}

function buildPage1Rows() {
  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('staff_actions_select')
      .setPlaceholder('Ações de moderação ▾')
      .addOptions([
        { label: 'Avisar', value: 'warn' },
        { label: 'Expulsar', value: 'kick' },
        { label: 'Banir', value: 'ban' },
        { label: 'Silenciar', value: 'punir' },
        { label: 'Avisos (histórico)', value: 'warnings' },
        { label: 'Desbanir', value: 'unban' },
      ])
  );

  const clearRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_clear_main_select')
      .setLabel('Limpar seleção')
      .setStyle(ButtonStyle.Secondary)
  );

  return [selectRow, clearRow];
}

function buildBackButtonRow(customId = 'staff_back_page1') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
  );
}

async function resolveUserLabel(interaction, userId) {
  let member = interaction.guild.members.cache.get(userId);
  if (member) return member.displayName || member.user?.tag || userId;

  try {
    member = await interaction.guild.members.fetch(userId);
    if (member) return member.displayName || member.user?.tag || userId;
  } catch (_) {}

  try {
    const user = await interaction.client.users.fetch(userId);
    if (user) return user.tag || user.username || userId;
  } catch (_) {}

  return userId;
}

function buildWarningsPanelSkeleton(interaction) {
  const embed = buildBrandedEmbed(
    interaction.guild,
    `${BRAND} — Avisos`,
    'Selecione um usuário para ver/remover avisos.',
    BANNERS.warnings
  );
  const rows = [];
  rows.push(buildBackButtonRow('staff_back_from_warnings'));
  return { embed, components: rows };
}

async function buildWarningsPanel(interaction, page = 1, cachedUsersList = null) {
  const all = warningSystem.getAllWarnings(interaction.guild.id) || {};
  const users = cachedUsersList ?? Object.keys(all).filter(id => Array.isArray(all[id]) && all[id].length > 0);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = users.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const embed = buildBrandedEmbed(
    interaction.guild,
    `${BRAND} — Avisos`,
    users.length
      ? `Selecione um usuário para ver/remover avisos. • Total: ${users.length}`
      : 'Sem avisos no servidor.',
    BANNERS.warnings
  );

  const rows = [];

  if (!slice.length) {
    embed.addFields({ name: 'Status', value: 'Sem avisos no servidor.' });
  } else {
    const options = [];
    for (const userId of slice) {
      const member = interaction.guild.members.cache.get(userId);
      let label = member?.displayName || member?.user?.tag || null;
      if (!label) {
        label = await resolveUserLabel(interaction, userId);
      }
      options.push({
        label,
        value: userId,
        description: `${all[userId].length} aviso(s)`,
      });
    }

    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('staff_select_user_warnings')
          .setPlaceholder('Selecionar usuário…')
          .addOptions(options)
      )
    );
  }

  if (users.length > PAGE_SIZE) {
    rows.push(buildPaginationRow(safePage, totalPages));
  }

  rows.push(buildBackButtonRow('staff_back_from_warnings'));

  return { embed, components: rows, users, page: safePage, totalPages };
}

async function buildUserWarningsDetailPanel(interaction, userId) {
  let member = interaction.guild.members.cache.get(userId);
  if (!member) {
    try { member = await interaction.guild.members.fetch(userId); } catch (_) {}
  }
  let user = member?.user;
  if (!user) {
    try { user = await interaction.client.users.fetch(userId); } catch (_) {}
  }
  const display = member?.displayName || user?.tag || userId;

  const entries = warningSystem.getUserWarnings(interaction.guild.id, userId) || [];

  const embed = buildBrandedEmbed(
    interaction.guild,
    `Avisos — ${display}`,
    null
  );

  if (!entries.length) {
    embed.setDescription('Sem avisos ativos.');
  } else {
    embed.setDescription(
      entries.map(w => {
        const reasonStr = String(
          typeof w.reason === 'undefined' || w.reason === null ? '—' : w.reason
        );
        const ts = Math.floor((w.timestamp || Date.now()) / 1000);
        return `• ID: \`${w.id || 'N/A'}\` • <t:${ts}:R>\n  Motivo: ${reasonStr}`;
      }).join('\n\n')
    );
  }

  const rows = [];

  const options = entries
    .filter(w => w?.id)
    .map(w => {
      const reasonStr = String(
        typeof w.reason === 'undefined' || w.reason === null ? 'Sem motivo' : w.reason
      );
      return {
        label: `ID ${w.id}`,
        value: w.id,
        description: reasonStr.slice(0, 50),
      };
    });

  if (options.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`staff_remove_warning_select_${userId}`)
          .setPlaceholder('Remover aviso…')
          .addOptions(options)
      )
    );
  }

  rows.push(buildBackButtonRow(`staff_back_to_warnings_${userId}`));
  return { embed, components: rows };
}

async function buildBansPanel(interaction) {
  const bans = await interaction.guild.bans.fetch({ limit: 25 });

  const embed = buildBrandedEmbed(
    interaction.guild,
    `${BRAND} — Desbanir`,
    'Selecione um usuário para desbanir.',
    BANNERS.unban
  );

  const rows = [];

  if (!bans.size) {
    embed.addFields({ name: 'Status', value: 'Nenhum usuário banido.' });
  } else {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('staff_unban_select')
          .setPlaceholder('Escolher usuário…')
          .addOptions(
            bans.map(b => ({
              label: b.user.tag,
              value: b.user.id,
              description: `Motivo: ${b.reason?.slice(0, 50) || '—'}`,
            }))
          )
      )
    );
  }

  rows.push(buildBackButtonRow('staff_back_from_unban'));
  return { embed, components: rows };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Abre o painel de moderação da Societyx.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ flags: EPHEMERAL_FLAG });

    const mainEmbed = buildMainEmbed(interaction.guild);

    await interaction.editReply({
      embeds: [mainEmbed],
      components: buildPage1Rows(),
    });

    const panelMsg = await interaction.fetchReply();
    panelState.set(panelMsg.id, { state: 'main' });

    const collector = panelMsg.createMessageComponentCollector({ time: 600_000 });

    collector.on('collect', async (i) => {
      const state = panelState.get(panelMsg.id) || { state: 'main' };

      if (i.customId === 'staff_clear_main_select') {
        await i.deferUpdate();
        const mainEmbedUpdated = buildMainEmbed(i.guild);
        await interaction.editReply({
          embeds: [mainEmbedUpdated],
          components: buildPage1Rows(),
        });
        panelState.set(panelMsg.id, { state: 'main' });
        return;
      }

      if (i.customId === 'staff_actions_select') {
        const v = i.values[0];

        if (['warn', 'kick', 'ban', 'punir'].includes(v)) {
          const modal = new ModalBuilder()
            .setCustomId(`staff_modal_${v}`)
            .setTitle(`${BRAND} — ${v.toUpperCase()}`);

          const rows = [
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('target_user')
                .setLabel('ID do Usuário')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Motivo')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            ),
          ];
          if (v === 'punir') {
            rows.push(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('duration')
                  .setLabel('Duração')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('30s, 10min, 1h, 1d, 1m')
                  .setRequired(true)
              )
            );
          }
          modal.addComponents(...rows);
          return i.showModal(modal);
        }

        await i.deferUpdate();
        if (v === 'warnings') {
          const panel = await buildWarningsPanel(i);
          await interaction.editReply({ embeds: [panel.embed], components: panel.components });
          panelState.set(panelMsg.id, { state: 'warnings' });
          return;
        }
        if (v === 'unban') {
          const bansPanel = await buildBansPanel(i);
          await interaction.editReply({ embeds: [bansPanel.embed], components: bansPanel.components });
          panelState.set(panelMsg.id, { state: 'unban' });
          return;
        }
      }

      if (i.customId === 'staff_back_from_warnings') {
        await i.deferUpdate();
        const mainEmbedUpdated = buildMainEmbed(i.guild);
        await interaction.editReply({ embeds: [mainEmbedUpdated], components: buildPage1Rows() });
        panelState.set(panelMsg.id, { state: 'main' });
        return;
      }

      if (i.customId.startsWith('staff_back_to_warnings_')) {
        await i.deferUpdate();
        const panel = await buildWarningsPanel(i);
        await interaction.editReply({ embeds: [panel.embed], components: panel.components });
        panelState.set(panelMsg.id, { state: 'warnings' });
        return;
      }

      if (i.customId === 'staff_back_from_unban') {
        await i.deferUpdate();
        const mainEmbedUpdated = buildMainEmbed(i.guild);
        await interaction.editReply({ embeds: [mainEmbedUpdated], components: buildPage1Rows() });
        panelState.set(panelMsg.id, { state: 'main' });
        return;
      }

      if (i.customId === 'staff_select_user_warnings') {
        await i.deferUpdate();
        const userId = i.values[0];
        const detail = await buildUserWarningsDetailPanel(i, userId);
        await interaction.editReply({ embeds: [detail.embed], components: detail.components });
        panelState.set(panelMsg.id, { state: 'warningsDetail', data: { userId } });
        return;
      }

      if (i.customId.startsWith('staff_remove_warning_select_')) {
        await i.deferUpdate();
        const userId = i.customId.split('_').pop();
        const warningId = i.values[0];
        const ok = !!warningSystem.removeWarning(i.guild.id, userId, warningId);
        if (ok) {
          const target = await i.client.users.fetch(userId).catch(() => null);
          await logAction(i.client, {
            action: 'Unwarn',
            moderator: i.user,
            target: target || { id: userId, tag: userId },
            reason: `Aviso ${warningId} removido`,
          });
        }
        await i.followUp({ content: ok ? `✅ Aviso ${warningId} removido.` : '❌ Não foi possível remover.', flags: EPHEMERAL_FLAG });

        const refreshed = await buildUserWarningsDetailPanel(i, userId);
        await interaction.editReply({ embeds: [refreshed.embed], components: refreshed.components });
        panelState.set(panelMsg.id, { state: 'warningsDetail', data: { userId } });
        return;
      }

      if (i.customId === 'staff_unban_select') {
        await i.deferUpdate();
        const userId = i.values[0];
        try {
          await i.guild.members.unban(userId, `Ação por: ${i.user.tag}`);
          const target = await i.client.users.fetch(userId).catch(() => null);
          await logAction(i.client, {
            action: 'Unban',
            moderator: i.user,
            target: target || { id: userId, tag: userId },
            reason: 'Desbanimento via painel',
          });

          await i.followUp({ content: `✅ Desbanido: <@${userId}>.`, flags: EPHEMERAL_FLAG });

          const bansPanel = await buildBansPanel(i);
          await interaction.editReply({ embeds: [bansPanel.embed], components: bansPanel.components });
          panelState.set(panelMsg.id, { state: 'unban' });
        } catch {
          await i.followUp({ content: '❌ Erro ao desbanir.', flags: EPHEMERAL_FLAG });
        }
        return;
      }
    });

    collector.on('end', () => {
      panelState.delete(panelMsg.id);
    });
  }
};