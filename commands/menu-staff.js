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
  ButtonStyle
} = require('discord.js');

const warningSystem = require('../utils/warningSystem');
const { logAction } = require('../utils/logger');
const { resolveUser } = require('../utils/resolveUser');

const warnCommand = require('../commands/warn');
const kickCommand = require('../commands/kick');
const banCommand = require('../commands/ban');
const punirCommand = require('../commands/punir');

const BRAND = 'Societyx';
const BRAND_COLOR = 0x8f17a7;
const EPHEMERAL_FLAG = 1 << 6;
const PAGE_SIZE = 25;
const QUICK_PAGE_SIZE = 25;

const BANNERS = {
  main: 'https://i.imgur.com/ruk2rzu.png',
  warn: 'https://i.imgur.com/XWTaQdx.jpeg',
  kick: 'https://i.imgur.com/XWTaQdx.jpeg',
  ban: 'https://i.imgur.com/XWTaQdx.jpeg',
  punir: 'https://i.imgur.com/XWTaQdx.jpeg',
  warnings: 'https://i.imgur.com/XWTaQdx.jpeg',
  unban: 'https://i.imgur.com/XWTaQdx.jpeg',
};

const panelState = new Map();

function buildBrandedEmbed(guild, title, description, bannerUrl) {
  const iconUrl = guild.iconURL?.({ size: 256 });
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

function buildPaginationRow(current, totalPages, prefix = 'staff_warn') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}_prev`)
      .setLabel('‹ Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current <= 1),
    new ButtonBuilder()
      .setCustomId(`${prefix}_page_info`)
      .setLabel(`Página ${current}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}_next`)
      .setLabel('Próxima ›')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current >= totalPages)
  );
}

function buildPaginationRowFlexible(current, hasNext, prefix = 'staff_quick_user') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}_prev`)
      .setLabel('‹ Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current <= 1),
    new ButtonBuilder()
      .setCustomId(`${prefix}_page_info`)
      .setLabel(`Página ${current}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}_next`)
      .setLabel('Próxima ›')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasNext)
  );
}

function buildBackButtonRow(backId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(backId)
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
  );
}

async function toast(i, content, ms = 3000) {
  try {
    const msg = await i.followUp({ content, flags: EPHEMERAL_FLAG });
    setTimeout(() => msg.delete().catch(() => {}), ms);
    return msg;
  } catch (err) {
    console.warn('[menu-staff][toast] erro:', err && err.message);
    return null;
  }
}

async function resolveUserLabel(interaction, userId) {
  let member = interaction.guild.members.cache.get(userId);
  if (member) return member.displayName || member.user?.tag || userId;
  try {
    member = await interaction.guild.members.fetch(userId);
    if (member) return member.displayName || member.user?.tag || userId;
  } catch {}
  try {
    const user = await interaction.client.users.fetch(userId);
    if (user) return user.tag || user.username || userId;
  } catch {}
  return userId;
}

async function getUserForLog(client, targetUser, userId) {
  try {
    if (!targetUser) {
      return await client.users.fetch(userId);
    }
    if (targetUser.user) return targetUser.user;
    if (targetUser.id && (targetUser.username || targetUser.tag)) return targetUser;
    return await client.users.fetch(targetUser.id || userId);
  } catch {
    return { id: userId, tag: `N/A (${userId})` };
  }
}

/* Painéis de avisos e bans */
async function buildWarningsPanel(interaction, page = 1, cachedUsersList = null) {
  const all = warningSystem.getAllWarnings(interaction.guild.id) || {};
  const baseList = cachedUsersList ?? Object.keys(all);
  const users = baseList.filter(id => Array.isArray(all[id]) && all[id].length > 0);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = users.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalWarnings = Object.values(all).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

  const embedDescription = users.length ?
    `Selecione um usuário para ver/remover avisos.\n• **Total de Usuários com Aviso:** ${users.length}\n• **Total de Avisos no Servidor:** ${totalWarnings}` :
    'Sem avisos no servidor.';

  const embed = buildBrandedEmbed(interaction.guild, `${BRAND} — Avisos`, embedDescription, BANNERS.warnings);

  const rows = [];
  if (!slice.length) embed.addFields({ name: 'Status', value: 'Sem avisos no servidor.' });
  else {
    const options = [];
    for (const userId of slice) {
      const label = await resolveUserLabel(interaction, userId);
      const count = (Array.isArray(all[userId]) ? all[userId] : []).length;
      options.push({
        label: `${label} (ID: ${userId})`.slice(0, 100),
        value: userId,
        description: `${count} aviso(s)`
      });
    }
    if (options.length) rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('staff_select_user_warnings').setPlaceholder('Selecionar usuário…').addOptions(options)
    ));
  }

  if (users.length > PAGE_SIZE) rows.push(buildPaginationRow(safePage, totalPages));
  rows.push(buildBackButtonRow('staff_back_from_warnings'));

  return { embed, components: rows, users, page: safePage, totalPages };
}

async function buildUserWarningsDetailPanel(interaction, userId) {
  const entries = warningSystem.getUserWarnings(interaction.guild.id, userId) || [];

  let member;
  try { member = await interaction.guild.members.fetch(userId); } catch {}
  const userLabel = member ? member.displayName : userId;

  const embedDescription = entries.length ?
    `ID do Usuário: \`${userId}\`\nSelecione abaixo o aviso para remover:` :
    'Sem avisos ativos.';

  const embed = buildBrandedEmbed(interaction.guild, `Avisos — ${userLabel}`, embedDescription, BANNERS.warnings);

  if (entries.length) {
    embed.addFields(entries.map(w => ({
      name: `📝 Aviso \`${w.id}\``,
      value: `**Motivo:**\n\`\`\`${w.reason ?? 'Sem motivo'}\`\`\`\n**Data:** ${new Date(w.timestamp).toLocaleString()}`,
      inline: false
    })));
  }

  const rows = [];
  const options = entries.filter(w => w && w.id).map(w => ({
    label: `ID ${w.id}`,
    value: w.id,
    description: `${String(w.reason ?? 'Sem motivo').slice(0, 50)} — ${new Date(w.timestamp).toLocaleDateString()}`
  }));

  if (options.length) rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`staff_remove_warning_select_${userId}`).setPlaceholder('Remover aviso…').addOptions(options)
  ));

  rows.push(buildBackButtonRow(`staff_back_to_warnings_${userId}`));
  return { embed, components: rows };
}

async function buildBansPanel(interaction) {
  const bans = await interaction.guild.bans.fetch({ limit: 25 });
  const embed = buildBrandedEmbed(
    interaction.guild,
    `${BRAND} — Desbanir`,
    bans.size ? 'Selecione um usuário abaixo para desbanir. Você verá o motivo do banimento, caso exista.' : 'Nenhum usuário banido.',
    BANNERS.unban
  );

  const rows = [];
  if (bans.size) {
    const options = bans.map(b => ({
      label: `${b.user.tag} (ID: ${b.user.id})`,
      value: b.user.id,
      description: `Motivo: ${b.reason?.slice(0, 50) || '—'}`
    }));
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('staff_unban_select').setPlaceholder('Escolher usuário…').addOptions(options)
    ));
  }

  rows.push(buildBackButtonRow('staff_back_from_unban'));
  return { embed, components: rows };
}

/* Painéis de ação */
function buildActionPanel(guild, action) {
  const labels = { warn: 'Avisar', kick: 'Expulsar', ban: 'Banir', punir: 'Silenciar' };
  const title = `${BRAND} — ${labels[action] ?? action}`;

  const explanations = {
    warn: '**Avisar**: aplica um aviso no histórico do usuário. Use "Por ID" para aplicar a um ID específico (útil para usuários offline), ou "Rápido" para escolher um membro rapidamente.',
    kick: '**Expulsar**: remove o usuário do servidor. "Por ID" permite inserir o ID manualmente; "Rápido" usa a lista de membros.',
    ban: '**Banir**: impede o usuário de acessar o servidor. "Por ID" aplica ban por ID com motivo; "Rápido" ban por usuário em cache.',
    punir: '**Silenciar**: restringe o envio de mensagens/voz por um período. "Por ID" aceita duração manual; "Rápido" permite escolher duração rápida (máx 28 dias).'
  };

  const desc = `${explanations[action] ?? 'Escolha como executar a ação.'}\n\nPor ID: insira o ID e motivo manualmente.\nRápido: selecione da lista de membros (API paginada).`;

  const embed = buildBrandedEmbed(guild, title, desc, BANNERS[action] || BANNERS.main);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`staff_${action}_byid`)
      .setLabel(`${labels[action] ?? action} — Por ID`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`staff_${action}_quick`)
      .setLabel(`${labels[action] ?? action} — Rápido`)
      .setStyle(ButtonStyle.Secondary)
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`staff_${action}_back`)
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, components: [actionRow, backRow] };
}

function buildActionModal(action, panelId) {
  const titleMap = { warn: 'Avisar', kick: 'Expulsar', ban: 'Banir', punir: 'Silenciar' };
  const modal = new ModalBuilder()
    .setCustomId(`staff_modal_${action}_${panelId}`)
    .setTitle(`${BRAND} — ${String(titleMap[action] ?? action).toUpperCase()}`);

  const rows = [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('target_user').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(true)
    )
  ];

  if (action === 'punir') {
    rows.push(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Duração')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('30s, 10m, 1h, 1d, 7d, 28d')
        .setRequired(true)
    ));
  }

  modal.addComponents(...rows);
  return modal;
}

function buildQuickOtherModal(action, userId, panelId) {
  const titleMap = { warn: 'Avisar', kick: 'Expulsar', ban: 'Banir', punir: 'Silenciar' };
  const modal = new ModalBuilder().setCustomId(`staff_modal_quick_${action}_${userId}_${panelId}`).setTitle(`${BRAND} — Motivo personalizado`);

  const rows = [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Motivo personalizado').setStyle(TextInputStyle.Paragraph).setRequired(true)
    )
  ];

  if (action === 'punir') {
    rows.push(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('duration').setLabel('Duração (ex: 10m, 1h, 1d)').setStyle(TextInputStyle.Short).setRequired(true)
    ));
  }

  modal.addComponents(...rows);
  return modal;
}

function getQuickReasons(action) {
  const common = [
    { label: '⚠️ Spam', value: 'spam', desc: 'Envio repetido de mensagens/links' },
    { label: '🗣️ Linguagem inapropriada', value: 'linguagem', desc: 'Insultos / ofensas' },
    { label: '🤺 Assédio', value: 'assedio', desc: 'Assédio a membros' },
    { label: '📛 Quebra de regras', value: 'regras', desc: 'Violou as regras do servidor' },
    { label: '✍️ Outro', value: 'outro', desc: 'Escrever motivo personalizado' },
  ];

  const perAction = {
    warn: common,
    kick: [
      { label: '🔥 Toxicidade recorrente', value: 'toxicidade', desc: 'Comportamento tóxico contínuo' },
      { label: '🚫 Quebra grave de regras', value: 'grave', desc: 'Quebra grave das regras' },
      ...common
    ],
    ban: [
      { label: '🕵️‍♂️ Doxing / Exposição', value: 'doxing', desc: 'Exposição de dados pessoais' },
      { label: '🔁 Conta alternativa', value: 'alt', desc: 'Alt account / ban evade' },
      { label: '💸 Scam / Venda', value: 'scam', desc: 'Golpes / venda ilegal' },
      ...common
    ],
    punir: [
      { label: '⚠️ Spam', value: 'spam', desc: 'Spam / Flood' },
      { label: '⚙️ Uso de macros', value: 'macros', desc: 'Comportamento automatizado' },
      { label: '🔊 Abuso de voz', value: 'voice', desc: 'Abuso no canal de voz' },
      ...common
    ]
  };

  return perAction[action] || common;
}

function buildQuickReasonsPanel(interaction, action, userId) {
  const labelTitle = { warn: 'Avisar', kick: 'Expulsar', ban: 'Banir', punir: 'Silenciar' }[action] || action;
  const embed = buildBrandedEmbed(interaction.guild, `${BRAND} — ${labelTitle} — Rápido`, `Selecione o motivo para aplicar **${labelTitle}** em <@${userId}>`, BANNERS[action] || BANNERS.main);

  const reasons = getQuickReasons(action);
  const options = reasons.map(r => ({
    label: r.label,
    value: r.value,
    description: r.desc
  }));

  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`staff_quick_reason_select_${action}_${userId}`)
        .setPlaceholder('Escolher motivo…')
        .addOptions(options)
    ),
    buildBackButtonRow(`staff_quick_back_${action}`)
  ];

  return { embed, components: rows };
}

function buildQuickDurationsPanel(interaction, action, userId, reasonLabel) {
  const embed = buildBrandedEmbed(interaction.guild, `${BRAND} — Silenciar — Duração`, `Escolha a duração para silenciar <@${userId}> — ${reasonLabel}`, BANNERS.punir);

  const options = [
    { label: '30 segundos', value: '30s' },
    { label: '5 minutos', value: '5m' },
    { label: '10 minutos', value: '10m' },
    { label: '30 minutos', value: '30m' },
    { label: '1 hora', value: '1h' },
    { label: '6 horas', value: '6h' },
    { label: '12 horas', value: '12h' },
    { label: '1 dia', value: '1d' },
    { label: '3 dias', value: '3d' },
    { label: '7 dias', value: '7d' },
    { label: '14 dias', value: '14d' },
    { label: '28 dias', value: '28d' },
  ];

  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`staff_quick_duration_select_${action}_${userId}_${reasonLabel}`)
        .setPlaceholder('Escolher duração…')
        .addOptions(options)
    ),
    buildBackButtonRow(`staff_quick_back_${action}`)
  ];

  return { embed, components: rows };
}

function buildQuickUserSelectPanel(interaction, action, members, page, hasNext) {
  const labelTitle = { warn: 'Avisar', kick: 'Expulsar', ban: 'Banir', punir: 'Silenciar' }[action] || action;
  const embed = buildBrandedEmbed(interaction.guild, `${BRAND} — ${labelTitle} — Rápido`, `Selecione o usuário para executar **${labelTitle} (rápido)**`, BANNERS[action] || BANNERS.main);

  const options = members.map(m => ({
    label: `${m.displayName}`.slice(0, 100),
    value: m.id,
    description: `${m.user.tag}`.slice(0, 100)
  })).slice(0, 25);

  const rows = [];
  if (options.length) rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`staff_quick_user_select_${action}`)
      .setPlaceholder('Escolher usuário…')
      .addOptions(options)
  ));
  else embed.addFields({ name: 'Status', value: 'Nenhum membro encontrado nesta página.' });

  rows.push(buildPaginationRowFlexible(page, hasNext, `staff_quick_${action}_user`));
  rows.push(buildBackButtonRow(`staff_quick_back_${action}`));

  return { embed, components: rows };
}

function resumePanelTimer(panelId, timeout = 5 * 60 * 1000) {
  const st = panelState.get(panelId);
  console.log(`[menu-staff][resumePanelTimer] panelId=${panelId} stExists=${!!st} timeout=${timeout}`);
  if (!st) return;
  st.modalOpen = false;
  if (st.timer) clearTimeout(st.timer);
  st.timer = setTimeout(() => {
    try {
      if (st.collector && typeof st.collector.stop === 'function' && !st.collector.ended) {
        console.log(`[menu-staff][resumePanelTimer] stopping collector for panelId=${panelId}`);
        st.collector.stop('idle');
      } else {
        console.log(`[menu-staff][resumePanelTimer] collector missing or already ended for panelId=${panelId}`);
      }
    } catch (e) {
      console.warn(`[menu-staff][resumePanelTimer] error stopping collector:`, e && e.message);
    }
    panelState.delete(panelId);
  }, timeout);
  panelState.set(panelId, st);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Abre o painel de moderação da Societyx.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  panelState,
  resumePanelTimer,
  buildMainEmbed,
  buildBrandedEmbed,
  buildPage1Rows,
  buildWarningsPanel,
  buildUserWarningsDetailPanel,
  buildBansPanel,
  buildBackButtonRow,
  resolveUserLabel,
  toast,

  async execute(interaction) {
    await interaction.deferReply({ flags: EPHEMERAL_FLAG }).catch(() => {});

    const mainEmbed = buildMainEmbed(interaction.guild);
    await interaction.editReply({ embeds: [mainEmbed], components: buildPage1Rows() }).catch(err => console.error('[menu-staff] editReply initial failed', err));

    const panelMsg = await interaction.fetchReply().catch(err => {
      console.error('[menu-staff] fetchReply failed', err);
      return null;
    });
    if (!panelMsg) return;

    console.log(`[menu-staff] painel aberto messageId=${panelMsg.id} by=${interaction.user.tag}`);

    panelState.set(panelMsg.id, { state: 'main', timer: null, allMembers: null, page: 1, modalOpen: false });

    const collector = panelMsg.createMessageComponentCollector();
    console.log(`[menu-staff] collector created for message=${panelMsg.id}`);

    const DEFAULT_IDLE = 5 * 60 * 1000;
    const EXTENDED_MODAL_IDLE = DEFAULT_IDLE;

    function safeLogEditReply(tag, fn) {
      return fn().catch(err => console.error(`[menu-staff][${tag}] editReply error:`, err));
    }

    function startIdleTimer(msgId, timeout = DEFAULT_IDLE) {
      const st = panelState.get(msgId) || {};
      if (st.timer) clearTimeout(st.timer);
      st.timer = setTimeout(() => {
        try {
          if (collector && !collector.ended) {
            console.log(`[menu-staff] idle timeout reached, stopping collector for ${msgId}`);
            collector.stop('idle');
          } else {
            console.log(`[menu-staff] idle timer fired but collector already ended for ${msgId}`);
          }
        } catch (e) {
          console.error('[menu-staff] error stopping collector from idle timer', e);
        }
      }, timeout);
      panelState.set(msgId, st);
    }

    startIdleTimer(panelMsg.id, DEFAULT_IDLE);

    const curr = panelState.get(panelMsg.id) || {};
    curr.collector = collector;
    panelState.set(panelMsg.id, curr);

    async function ensureAllMembersFetched(guild, stateKey) {
      const st = panelState.get(stateKey) || {};
      if (st.allMembers && Array.isArray(st.allMembers) && st.allMembers.length) return st.allMembers;

      try {
        await guild.members.fetch();
        const arr = Array.from(guild.members.cache.values())
          .filter(m => m && m.user && !m.user.bot)
          .sort((a, b) => (a.displayName || a.user.username || '').localeCompare(b.displayName || b.user.username || ''));
        st.allMembers = arr;
        panelState.set(stateKey, st);
        return arr;
      } catch (err) {
        const arr = Array.from(guild.members.cache.values())
          .filter(m => m && m.user && !m.user.bot)
          .sort((a, b) => (a.displayName || a.user.username || '').localeCompare(b.displayName || b.user.username || ''));
        st.allMembers = arr;
        panelState.set(stateKey, st);
        return arr;
      }
    }

    function getMembersPageFromAll(allMembers, page = 1, limit = QUICK_PAGE_SIZE) {
      const total = allMembers.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.max(1, Math.min(page, totalPages));
      const slice = allMembers.slice((safePage - 1) * limit, safePage * limit);
      const hasNext = safePage < totalPages;
      return { members: slice, page: safePage, hasNext, totalPages };
    }

    collector.on('collect', async i => {
      try {
        console.log(`[menu-staff][collect] customId=${i.customId} user=${i.user.tag} messageId=${panelMsg.id}`);
        const st0 = panelState.get(panelMsg.id) || {};
        if (st0.timer) clearTimeout(st0.timer);
        startIdleTimer(panelMsg.id, DEFAULT_IDLE);

        const state = panelState.get(panelMsg.id) || { state: 'main' };

        if (i.customId === 'staff_clear_main_select') {
          await i.deferUpdate().catch(() => {});
          await interaction.editReply({ embeds: [buildMainEmbed(i.guild)], components: buildPage1Rows() });
          panelState.set(panelMsg.id, { state: 'main', allMembers: state.allMembers || null, page: 1, modalOpen: false });
          return;
        }

        if (i.customId === 'staff_actions_select') {
          const v = i.values[0];
          if (['warn', 'kick', 'ban', 'punir'].includes(v)) {
            await i.deferUpdate().catch(() => {});
            const panel = buildActionPanel(i.guild, v);
            await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply action_panel failed', err));
            panelState.set(panelMsg.id, { state: 'action_menu', data: { action: v }, allMembers: state.allMembers || null, page: 1, modalOpen: false });
            return;
          }

          if (v === 'warnings') {
            await i.deferUpdate().catch(() => {});
            const panel = await buildWarningsPanel(i, 1);
            await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply warnings failed', err));
            panelState.set(panelMsg.id, { state: 'warnings', data: { users: panel.users, page: panel.page, totalPages: panel.totalPages }, allMembers: state.allMembers || null, page: 1, modalOpen: false });
            return;
          }

          if (v === 'unban') {
            await i.deferUpdate().catch(() => {});
            const bansPanel = await buildBansPanel(i);
            await interaction.editReply({ embeds: [bansPanel.embed], components: bansPanel.components }).catch(err => console.error('[menu-staff] editReply bans failed', err));
            panelState.set(panelMsg.id, { state: 'unban', allMembers: state.allMembers || null, page: 1, modalOpen: false });
            return;
          }
        }

        if (i.customId === 'staff_unban_select') {
          await i.deferUpdate().catch(() => {});
          const userId = i.values[0];
          const ban = await i.guild.bans.fetch(userId).catch(() => null);
          if (!ban) return await toast(i, `❌ Usuário não encontrado entre os bans.`);

          await i.guild.members.unban(userId, `Desbanido por ${i.user.tag}`).catch(err => console.error('[menu-staff] unban failed', err));
          await logAction(i.client, { action: 'Unban', moderator: i.user, target: ban.user, reason: 'Painel de Staff' }).catch(err => console.warn('[menu-staff] logAction unban failed', err));

          await toast(i, `✅ Usuário ${ban.user.tag} foi desbanido com sucesso!`);

          const bansPanel = await buildBansPanel(i);
          await interaction.editReply({ embeds: [bansPanel.embed], components: bansPanel.components }).catch(err => console.error('[menu-staff] editReply bans after unban failed', err));
          panelState.set(panelMsg.id, { state: 'unban', allMembers: state.allMembers || null, page: 1, modalOpen: false });
          return;
        }

        if (['staff_warn_prev', 'staff_warn_next'].includes(i.customId)) {
          await i.deferUpdate().catch(() => {});
          const current = state?.data?.page || 1;
          const users = state?.data?.users || null;
          const nextPage = i.customId === 'staff_warn_prev' ? Math.max(1, current - 1) : current + 1;
          const panel = await buildWarningsPanel(i, nextPage, users);
          await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply warnings pagination failed', err));
          panelState.set(panelMsg.id, { state: 'warnings', data: { users: panel.users, page: panel.page, totalPages: panel.totalPages }, allMembers: state.allMembers || null, page: panel.page, modalOpen: false });
          return;
        }

        if (i.customId === 'staff_select_user_warnings') {
          await i.deferUpdate().catch(() => {});
          const userId = i.values[0];
          const panel = await buildUserWarningsDetailPanel(i, userId);
          await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply user warnings failed', err));
          panelState.set(panelMsg.id, { state: 'user_warnings', data: { userId, users: state?.data?.users || null, page: state?.data?.page || 1 }, allMembers: state.allMembers || null, page: 1, modalOpen: false });
          return;
        }

        if (i.customId.startsWith('staff_remove_warning_select_')) {
          await i.deferUpdate().catch(() => {});
          const userId = i.customId.split('_').pop();
          const warningId = i.values[0];
          const removedWarning = warningSystem.removeWarning(i.guild.id, userId, warningId);
          if (!removedWarning) return toast(i, `❌ Não foi possível remover o aviso ${warningId}.`);

          let target;
          try { target = (await i.guild.members.fetch(userId)).user; } catch {
            try { target = await i.client.users.fetch(userId); } catch { target = { id: userId, tag: userId }; }
          }

          await logAction(i.client, { action: 'Unwarn', moderator: i.user, target, reason: removedWarning.reason || 'Sem motivo' }).catch(err => console.warn('[menu-staff] logAction unwarn failed', err));
          await toast(i, `✅ Aviso ${removedWarning.id} removido de ${target.tag || userId} (${removedWarning.reason || 'Sem motivo'})`);

          const refreshed = await buildUserWarningsDetailPanel(i, userId);
          await interaction.editReply({ embeds: [refreshed.embed], components: refreshed.components }).catch(err => console.error('[menu-staff] editReply refreshed warnings failed', err));
          panelState.set(panelMsg.id, { state: 'user_warnings', data: { userId, users: state?.data?.users || null, page: state?.data?.page || 1 }, allMembers: state.allMembers || null, page: 1, modalOpen: false });
          return;
        }

        if (i.customId.startsWith('staff_') && (i.customId.includes('_byid') || i.customId.includes('_quick') || i.customId.includes('_back'))) {
          const parts = i.customId.split('_');
          const action = parts[1];
          const suffix = parts.slice(2).join('_');

          if (suffix === 'byid') {
            const modal = buildActionModal(action, panelMsg.id);
            await i.showModal(modal).catch(err => console.error('[menu-staff] showModal failed', err));
            const st = panelState.get(panelMsg.id) || {};
            if (st.timer) clearTimeout(st.timer);
            st.modalOpen = true;
            st.timer = setTimeout(() => {
              try { collector.stop('idle'); } catch(_) {}
            }, EXTENDED_MODAL_IDLE);
            panelState.set(panelMsg.id, st);
            return;
          }

          if (suffix === 'quick') {
            await i.deferUpdate().catch(() => {});
            const allMembers = await ensureAllMembersFetched(i.guild, panelMsg.id);
            const { members, page, hasNext } = getMembersPageFromAll(allMembers, 1, QUICK_PAGE_SIZE);
            const panel = buildQuickUserSelectPanel(i, action, members, page, hasNext);
            await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply quick user select failed', err));
            panelState.set(panelMsg.id, { state: 'quick_user_select', data: { action, page, hasNext }, allMembers, page, modalOpen: false });
            return;
          }

          if (suffix === 'back') {
            await i.deferUpdate().catch(() => {});
            const main = buildMainEmbed(i.guild);
            await interaction.editReply({ embeds: [main], components: buildPage1Rows() }).catch(err => console.error('[menu-staff] editReply back failed', err));
            panelState.set(panelMsg.id, { state: 'main', allMembers: state.allMembers || null, page: 1, modalOpen: false });
            return;
          }
        }

        if (i.customId.startsWith('staff_quick_') && (i.customId.includes('_prev') || i.customId.includes('_next'))) {
          await i.deferUpdate().catch(() => {});
          const matches = i.customId.match(/^staff_quick_(.+?)_user_(prev|next|page_info)$/);
          if (!matches) return;
          const action = matches[1];
          const dir = matches[2];
          const current = state.data?.page || state.page || 1;
          const nextPage = dir === 'prev' ? Math.max(1, current - 1) : current + 1;

          const allMembers = state.allMembers || await ensureAllMembersFetched(i.guild, panelMsg.id);
          const { members, page, hasNext } = getMembersPageFromAll(allMembers, nextPage, QUICK_PAGE_SIZE);

          const panel = buildQuickUserSelectPanel(i, action, members, page, hasNext);
          await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply quick page failed', err));
          panelState.set(panelMsg.id, { state: 'quick_user_select', data: { action, page, hasNext }, allMembers, page, modalOpen: false });
          return;
        }

        if (i.customId.startsWith('staff_quick_user_select_')) {
          await i.deferUpdate().catch(() => {});
          const action = i.customId.replace('staff_quick_user_select_', '');
          const userId = i.values[0];
          const panel = buildQuickReasonsPanel(i, action, userId);
          await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply quick reasons failed', err));
          panelState.set(panelMsg.id, { state: 'quick_reason_select', data: { action, userId }, allMembers: state.allMembers || null, page: state.page || 1, modalOpen: false });
          return;
        }

        if (i.customId.startsWith('staff_quick_reason_select_')) {
          const tail = i.customId.replace('staff_quick_reason_select_', '');
          const [action, userId] = tail.split('_');
          const reasonValue = i.values[0];

          const reasons = getQuickReasons(action);
          const reasonObj = reasons.find(r => r.value === reasonValue);
          const reasonLabel = reasonObj?.label || reasonValue;

          if (reasonValue === 'outro') {
            const modal = buildQuickOtherModal(action, userId, panelMsg.id);
            await i.showModal(modal).catch(err => console.error('[menu-staff] showModal quick other failed', err));
            const st = panelState.get(panelMsg.id) || {};
            if (st.timer) clearTimeout(st.timer);
            st.modalOpen = true;
            st.timer = setTimeout(() => {
              try { collector.stop('idle'); } catch(_) {}
            }, EXTENDED_MODAL_IDLE);
            panelState.set(panelMsg.id, st);
            return;
          }

          if (action === 'punir') {
            await i.deferUpdate().catch(() => {});
            const panel = buildQuickDurationsPanel(i, action, userId, reasonLabel);
            await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply quick durations failed', err));
            panelState.set(panelMsg.id, { state: 'quick_duration_select', data: { action, userId, reasonValue, reasonLabel }, allMembers: state.allMembers || null, page: state.page || 1, modalOpen: false });
            return;
          }

          await i.deferUpdate().catch(() => {});

          let targetUser = null;
          try { targetUser = await resolveUser(i.guild, userId); } catch (err) { console.warn('[menu-staff] resolveUser quick failed', err && err.message); }
          if (!targetUser) {
            await toast(i, '❌ Usuário não encontrado.');
            const allMembers = state.allMembers || await ensureAllMembersFetched(i.guild, panelMsg.id);
            const { members, page, hasNext } = getMembersPageFromAll(allMembers, 1, QUICK_PAGE_SIZE);
            const panel = buildQuickUserSelectPanel(i, action, members, page, hasNext);
            await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply quick fallback failed', err));
            panelState.set(panelMsg.id, { state: 'quick_user_select', data: { action, page, hasNext }, allMembers, page, modalOpen: false });
            return;
          }

          try {
            if (action === 'warn') {
              await warnCommand.execute(interaction, interaction.client, targetUser, null, reasonLabel);
              await toast(i, `✅ Aviso aplicado em <@${userId}> — ${reasonLabel}`);
            } else if (action === 'kick') {
              await kickCommand.execute(interaction, interaction.client, targetUser, reasonLabel);
              await toast(i, `✅ Usuário expulsado: <@${userId}> — ${reasonLabel}`);
            } else if (action === 'ban') {
              await banCommand.execute(interaction, interaction.client, targetUser, reasonLabel);
              await toast(i, `✅ Usuário banido: <@${userId}> — ${reasonLabel}`);
            } else {
              await toast(i, '❌ Ação desconhecida.');
            }
          } catch (err) {
            console.error('Erro no quick action:', err);
            await toast(i, '❌ Ocorreu um erro ao executar a ação.');
          }

          const allMembers = state.allMembers || await ensureAllMembersFetched(i.guild, panelMsg.id);
          const { members, page, hasNext } = getMembersPageFromAll(allMembers, 1, QUICK_PAGE_SIZE);
          const panel2 = buildQuickUserSelectPanel(i, action, members, page, hasNext);
          await interaction.editReply({ embeds: [panel2.embed], components: panel2.components }).catch(err => console.error('[menu-staff] editReply quick after action failed', err));
          panelState.set(panelMsg.id, { state: 'quick_user_select', data: { action, page, hasNext }, allMembers, page, modalOpen: false });
          return;
        }

        if (i.customId.startsWith('staff_quick_duration_select_')) {
          await i.deferUpdate().catch(() => {});
          const tail = i.customId.replace('staff_quick_duration_select_', '');
          const [action, userId, reasonValue] = tail.split('_');
          const durationValue = i.values[0];

          const reasons = getQuickReasons(action);
          const reasonObj = reasons.find(r => r.value === reasonValue);
          const reasonLabel = reasonObj?.label || reasonValue;

          let targetUser = null;
          try { targetUser = await resolveUser(i.guild, userId); } catch (err) { console.warn('[menu-staff] resolveUser quick duration failed', err && err.message); }
          if (!targetUser) {
            await toast(i, '❌ Usuário não encontrado.');
            const allMembers = state.allMembers || await ensureAllMembersFetched(i.guild, panelMsg.id);
            const { members, page, hasNext } = getMembersPageFromAll(allMembers, 1, QUICK_PAGE_SIZE);
            const panel = buildQuickUserSelectPanel(i, action, members, page, hasNext);
            await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply quick duration fallback failed', err));
            panelState.set(panelMsg.id, { state: 'quick_user_select', data: { action, page, hasNext }, allMembers, page, modalOpen: false });
            return;
          }

          try {
            await punirCommand.execute(interaction, interaction.client, targetUser, durationValue, reasonLabel);
            await toast(i, `✅ Usuário silenciado: <@${userId}> — ${reasonLabel} (${durationValue})`);
          } catch (err) {
            console.error('Erro ao aplicar punir via quick:', err);
            await toast(i, '❌ Ocorreu um erro ao aplicar o silenciamento.');
          }

          const allMembers = state.allMembers || await ensureAllMembersFetched(i.guild, panelMsg.id);
          const { members, page, hasNext } = getMembersPageFromAll(allMembers, 1, QUICK_PAGE_SIZE);
          const panel = buildQuickUserSelectPanel(i, action, members, page, hasNext);
          await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply quick duration after failed', err));
          panelState.set(panelMsg.id, { state: 'quick_user_select', data: { action, page, hasNext }, allMembers, page, modalOpen: false });
          return;
        }

        if (i.customId.startsWith('staff_quick_back_') || i.customId.startsWith('staff_quick_back_to_')) {
          await i.deferUpdate().catch(() => {});
          const main = buildMainEmbed(i.guild);
          await interaction.editReply({ embeds: [main], components: buildPage1Rows() }).catch(err => console.error('[menu-staff] editReply quick back failed', err));
          panelState.set(panelMsg.id, { state: 'main', allMembers: state.allMembers || null, page: 1, modalOpen: false });
          return;
        }

        if (i.customId.startsWith('staff_back')) {
          await i.deferUpdate().catch(() => {});
          if (state.state === 'user_warnings') {
            const page = state.data?.page || 1;
            const users = state.data?.users || null;
            const panel = await buildWarningsPanel(i, page, users);
            await interaction.editReply({ embeds: [panel.embed], components: panel.components }).catch(err => console.error('[menu-staff] editReply back to warnings failed', err));
            panelState.set(panelMsg.id, { state: 'warnings', data: { users: panel.users, page: panel.page, totalPages: panel.totalPages }, allMembers: state.allMembers || null, page: 1, modalOpen: false });
          } else {
            const mainEmbed = buildMainEmbed(i.guild);
            await interaction.editReply({ embeds: [mainEmbed], components: buildPage1Rows() }).catch(err => console.error('[menu-staff] editReply back main failed', err));
            panelState.set(panelMsg.id, { state: 'main', allMembers: state.allMembers || null, page: 1, modalOpen: false });
          }
          return;
        }
      } catch (err) {
        console.error('[menu-staff][collect] erro inesperado:', err);
        try { await i.reply?.({ content: '❌ Erro interno no painel.', ephemeral: true }); } catch {}
      }
    });

    collector.on('end', async (_collected, reason) => {
      console.log(`[menu-staff] collector ended for message=${panelMsg.id} reason=${reason}`);
      const st = panelState.get(panelMsg.id);
      if (st && st.timer) clearTimeout(st.timer);
      panelState.delete(panelMsg.id);
      try {
        await interaction.editReply({
          content: reason === 'idle' ? '⏳ Sessão expirada. Use /staff novamente.' : '⏳ Sessão encerrada. Use /staff novamente.',
          embeds: [],
          components: [],
        }).catch(err => console.warn('[menu-staff] editReply on end failed:', err));
        setTimeout(() => interaction.deleteReply().catch(() => {}), 300_000);
      } catch {}
    });
  }
};