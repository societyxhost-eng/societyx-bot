const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  AttachmentBuilder,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const BRAND = 'Societyx';
const BRAND_COLOR = 0x8f17a7;
const BANNERS = { ticket: 'https://i.imgur.com/XWTaQdx.jpeg' };

const SUPPORT_ROLE_ID = '1407822867101388851';
const LOG_CHANNEL_ID = '1425600226437365822';
const PARENT_CATEGORY_ID = '1425596175297417288';
const CLOSED_CATEGORY_ID = '1425599287156539392';

const EPHEMERAL_TTL_MS = 9000;

const CATEGORY_OPTIONS = [
  { label: 'Dúvidas', value: 'duvidas', emoji: '❓', desc: 'Suporte geral e perguntas.' },
  { label: 'Reclamação', value: 'reclamacao', emoji: '⚠️', desc: 'Reporte problemas e feedbacks.' },
  { label: 'Compra de VIP', value: 'vip', emoji: '💎', desc: 'Atendimento para VIPs e pagamentos.' },
  { label: 'Parcerias', value: 'parceria', emoji: '🤝', desc: 'Solicitações de parceria.' },
  { label: 'Denúncia', value: 'denuncia', emoji: '🚨', desc: 'Reportar violações ou usuários.' },
];

function buildBrandedEmbed(guild, title, description, bannerUrl) {
  const iconUrl = guild.iconURL({ size: 256 });
  const embed = new EmbedBuilder().setTitle(title).setColor(BRAND_COLOR);
  if (description) embed.setDescription(description);
  if (iconUrl) embed.setThumbnail(iconUrl);
  if (bannerUrl) embed.setImage(bannerUrl);
  return embed;
}
function buildTicketPanelEmbed(guild) {
  return buildBrandedEmbed(
    guild,
    `${BRAND} — Central de Tickets`,
    'Selecione abaixo o motivo do seu atendimento. Um canal privado será criado após confirmação.',
    BANNERS.ticket
  );
}
function buildTicketPanelComponents() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_open_select')
    .setPlaceholder('Escolha o motivo do seu ticket ▾')
    .addOptions(
      CATEGORY_OPTIONS.map(opt => ({
        label: opt.label,
        value: opt.value,
        emoji: opt.emoji,
        description: opt.desc?.slice(0, 100) || undefined,
      }))
    );
  const clearBtn = new ButtonBuilder()
    .setCustomId('ticket_clear_selection')
    .setLabel('Limpar seleção')
    .setStyle(ButtonStyle.Secondary);
  return [
    new ActionRowBuilder().addComponents(select),
    new ActionRowBuilder().addComponents(clearBtn),
  ];
}

function sanitizeName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20) || 'user';
}
function categorySlug(value) {
  const cat = CATEGORY_OPTIONS.find(c => c.value === value);
  return sanitizeName(cat?.label || value || 'ticket');
}
function isTicketChannelName(name = '') { return name.startsWith('ticket-') || name.startsWith('closed-'); }

function ensureStaff(interaction) {
  const m = interaction.member;
  return m?.roles?.cache?.has(SUPPORT_ROLE_ID) || m?.permissions?.has(PermissionsBitField.Flags.Administrator);
}
async function safeEphemeralReply(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content);
    setTimeout(() => interaction.deleteReply().catch(() => {}), EPHEMERAL_TTL_MS);
  } else {
    await interaction.reply({ content, ephemeral: true });
    setTimeout(() => interaction.deleteReply().catch(() => {}), EPHEMERAL_TTL_MS);
  }
}

function buildStaffControlsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_staff_close').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_staff_add').setLabel('Adicionar Membro').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_staff_remove').setLabel('Remover Membro').setEmoji('➖').setStyle(ButtonStyle.Secondary),
  );
}

async function createTicketChannel(guild, author, reasonValue, extraDetails) {
  const usernameSlug = sanitizeName(author.username);
  const name = `ticket-${usernameSlug}`;

  const overwrites = [
    { id: guild.roles.everyone, deny: ['ViewChannel'] },
    { id: author.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] },
  ];
  if (SUPPORT_ROLE_ID) overwrites.push({ id: SUPPORT_ROLE_ID, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] });
  if (guild.members.me) overwrites.push({ id: guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'AttachFiles', 'EmbedLinks'] });

  const reasonSlug = reasonValue ? categorySlug(reasonValue) : 'ticket';
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: PARENT_CATEGORY_ID || null,
    permissionOverwrites: overwrites,
    topic: `Ticket de ${author.tag} (${author.id}) | Motivo: ${reasonSlug}`,
    reason: `Ticket aberto por ${author.tag} - Motivo: ${reasonSlug}`,
  });

  const intro = [
    `Motivo: ${reasonSlug}`,
    extraDetails ? `Detalhes: ${extraDetails.slice(0, 1000)}` : null,
    `Nossa equipe irá te atender em breve. Descreva seu caso com detalhes.`,
  ].filter(Boolean).join('\n\n');

  const introEmbed = buildBrandedEmbed(guild, `🎫 Ticket Aberto — ${author.username}`, intro, BANNERS.ticket);

  await channel.send({
    content: `<@${author.id}> ${SUPPORT_ROLE_ID ? `<@&${SUPPORT_ROLE_ID}>` : ''}`,
    embeds: [introEmbed],
    components: [buildStaffControlsRow()],
  });

  if (LOG_CHANNEL_ID) {
    const logChan = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChan) {
      const openEmbed = new EmbedBuilder()
        .setTitle('🟢 Ticket Aberto')
        .setColor(0x3ba55d)
        .setDescription(`Canal: ${channel}\nAutor: <@${author.id}> (\`${author.tag}\`)\nMotivo: \`${reasonSlug}\``)
        .setTimestamp();
      await logChan.send({ embeds: [openEmbed] }).catch(() => {});
    }
  }
  return channel;
}

function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
async function fetchAllMessages(channel, limitHard = 5000) {
  let lastId; const all = [];
  while (true) {
    const fetched = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
    if (!fetched || fetched.size === 0) break;
    all.push(...fetched.values());
    lastId = fetched.last().id;
    if (all.length >= limitHard) break;
  }
  all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return all;
}

async function generateTranscriptHTML(channel, closedBy, reason) {
  const messages = await fetchAllMessages(channel);
  const guildIcon = channel.guild.iconURL({ size: 128 }) || '';
  const guildName = channel.guild?.name || '';
  const channelName = channel.name;

  const fmtTime = ts => {
    const d = new Date(ts);
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { date, time, full: `${date} ${time}` };
  };
  const dayKey = ts => new Date(ts).toDateString();

  const linkify = s => escapeHtml(s || '')
    .replace(/https?:\/\/\S+/g, m => `<a href="${m}" target="_blank" class="link">${m}</a>`)
    .replace(/(@everyone|@here)/g, '<span class="mention everyone">$1</span>')
    .replace(/<@!?(\d{17,20})>/g, '<span class="mention">@usuário</span>')
    .replace(/<@&(\d{17,20})>/g, '<span class="mention role">@cargo</span>')
    .replace(/<#(\d{17,20})>/g, '<span class="mention channel">#canal</span>');

  const mdInline = s => linkify(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<div class="quote">$1</div>');

  const renderContent = s => {
    if (!s) return '';
    const withBlocks = s.replace(/```([\s\S]*?)```/g, (m, p1) => `[[[BLOCK:${p1}]]]`);
    let html = mdInline(withBlocks);
    html = html.replace(/\[\[\[BLOCK:([\s\S]*?)\]\]\]/g, (m, p1) => `<pre class="pre"><code>${escapeHtml(p1)}</code></pre>`);
    return html;
  };

  const days = [];
  let currentDay = null;
  let lastAuthorId = null;
  messages.forEach(msg => {
    const dk = dayKey(msg.createdTimestamp);
    if (!currentDay || currentDay.key !== dk) {
      currentDay = { key: dk, dateLabel: fmtTime(msg.createdTimestamp).date, blocks: [] };
      days.push(currentDay);
      lastAuthorId = null;
    }
    const sameAuthor = msg.author?.id === lastAuthorId;
    const authorName = msg.member?.displayName || msg.author?.globalName || msg.author?.username || 'Usuário';
    const avatar = msg.author?.displayAvatarURL({ size: 64 }) || '';
    const t = fmtTime(msg.createdTimestamp);

    const attachments = [...msg.attachments.values()].map(att => {
      const name = escapeHtml(att.name || 'arquivo');
      const url = att.url;
      const isImg = /\.(png|jpe?g|gif|webp)$/i.test(url.split('?')[0]);
      if (isImg) return `<div class="attach"><a href="${url}" target="_blank"><img src="${url}" alt="${name}"/></a></div>`;
      return `<div class="attach file"><a href="${url}" target="_blank">${name}</a></div>`;
    }).join('');

    const content = renderContent(msg.content || '');
    const hasEmbed = msg.embeds && msg.embeds.length > 0;
    const embedsHtml = hasEmbed ? msg.embeds.map(e => {
      const styleAttr = e.color ? ` style="border-left-color:#${e.color.toString(16).padStart(6, '0')}"` : '';
      const title = e.title ? `<div class="emb-title">${escapeHtml(e.title)}</div>` : '';
      const desc = e.description ? `<div class="emb-desc">${mdInline(e.description)}</div>` : '';
      return `<div class="embed"${styleAttr}>${title}${desc}</div>`;
    }).join('') : '';

    const reactions = msg.reactions?.cache?.size ? `<div class="reactions">${[...msg.reactions.cache.values()].map(r => {
        const count = r.count || 1;
        const emoji = r.emoji?.name || '👍';
        return `<span class="reaction">${escapeHtml(emoji)} ${count}</span>`;
      }).join('')
      }</div>` : '';

    currentDay.blocks.push({
      sameAuthor,
      authorName, avatar, time: t, content, attachments, embedsHtml, reactions
    });
    lastAuthorId = msg.author?.id;
  });

  const daySections = days.map(d => {
    const blocksHtml = d.blocks.map(b => {
      if (b.sameAuthor) {
        return `
          <div class="row cont">
            <div class="msg bubble">
              <div class="line"><span class="time">${b.time.time}</span></div>
              ${b.content ? `<div class="content">${b.content}</div>` : ''}
              ${b.attachments}
              ${b.embedsHtml}
              ${b.reactions}
            </div>
          </div>`;
      }
      return `
        <div class="row">
          ${b.avatar ? `<img class="avatar" src="${b.avatar}" alt="avatar"/>` : '<div class="avatar placeholder"></div>'}
          <div class="msg bubble">
            <div class="head"><span class="author">${escapeHtml(b.authorName)}</span><span class="time">${b.time.time}</span></div>
            ${b.content ? `<div class="content">${b.content}</div>` : ''}
            ${b.attachments}
            ${b.embedsHtml}
            ${b.reactions}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="day">
        <div class="date-bar"><span>${escapeHtml(d.dateLabel)}</span></div>
        ${blocksHtml}
      </div>`;
  }).join('');

  const topic = channel.topic || '';
  const match = topic.match(/Ticket de (.+?) \((\d{17,20})\)/);
  const authorTag = match?.[1] || '';

  const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8"/>
<title>Transcrição • ${escapeHtml(channelName)}</title>
<style>
  :root{
    --bg:#0b0e14; --panel:#0f1320; --panel2:#0c111c; --line:#1b2230; --text:#e3e5e8; --muted:#b9bbbe;
    --accent:#5865f2; --brand:#8f17a7; --chip:#1f2535; --chip-brd:#30384a;
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 "gg sans","Segoe UI",Arial,Helvetica,sans-serif}
  a{color:#9fb4ff;text-decoration:none}
  a:hover{text-decoration:underline}
  .wrap{max-width:980px;margin:0 auto;padding:16px 18px 44px}
  header{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,var(--bg) 70%,transparent)}
  .titlebar{display:flex;align-items:center;gap:12px;padding:10px 0 8px}
  .titlebar .icon{width:36px;height:36px;border-radius:10px;border:1px solid var(--line)}
  .chname{font-size:18px;font-weight:700}
  .meta{margin:8px 0 16px;display:flex;flex-wrap:wrap;gap:8px}
  .chip{background:var(--chip);border:1px solid var(--chip-brd);color:var(--muted);padding:6px 10px;border-radius:999px;font-size:12px}
  .date-bar{display:flex;align-items:center;gap:10px;margin:18px 0}
  .date-bar:before,.date-bar:after{content:"";flex:1;height:1px;background:var(--line)}
  .date-bar span{color:var(--muted);font-size:12px}
  .row{display:flex;gap:12px;padding:6px 0}
  .row.cont{margin-left:52px}
  .avatar{width:40px;height:40px;border-radius:50%}
  .avatar.placeholder{background:#1d2333;border:1px solid var(--line)}
  .msg{min-width:0}
  .bubble{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
  .head{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}
  .author{font-weight:600;color:#ffffff}
  .time{color:var(--muted);font-size:12px}
  .content{white-space:pre-wrap}
  .quote{border-left:3px solid var(--line);padding:4px 8px;margin:6px 0;color:var(--muted);background:#101522;border-radius:6px}
  code{background:#151a28;border:1px solid #222b3d;border-radius:4px;padding:1px 4px}
  .pre{background:#0e1424;border:1px solid #1e2740;border-radius:8px;padding:10px;overflow:auto;margin:8px 0}
  .attach{margin-top:8px}
  .attach img{max-width:560px;border-radius:8px;border:1px solid var(--line)}
  .attach.file a{display:inline-block;background:#101626;border:1px solid var(--line);padding:6px 10px;border-radius:8px}
  .embed{border-left:4px solid var(--accent);background:#0d1222;border:1px solid #1e2540;border-radius:10px;padding:8px 10px;margin-top:8px}
  .emb-title{font-weight:600;margin-bottom:4px}
  .emb-desc{color:#e4e6f0}
  .reactions{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
  .reaction{background:#141a2a;border:1px solid #232b42;border-radius:14px;padding:2px 8px;color:#cbd3f0;font-size:12px}
  .mention{color:#c9d6ff;background:rgba(88,101,242,.15);border:1px solid rgba(88,101,242,.35);padding:0 4px;border-radius:3px}
  .mention.channel{color:#9ec7ff}
  .mention.role{color:#b2ffd6}
  .mention.everyone{color:#ffd89e}
  footer{color:var(--muted);font-size:12px;margin-top:28px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="titlebar">
      ${guildIcon ? `<img class="icon" src="${guildIcon}" alt="icon"/>` : ''}
      <div class="chname"># ${escapeHtml(channelName)}</div>
    </div>
    <div class="meta">
      <div class="chip">Servidor: ${escapeHtml(guildName)}</div>
      <div class="chip">Autor do ticket: ${escapeHtml(authorTag || '—')}</div>
      <div class="chip">Fechado por: ${escapeHtml(closedBy?.username || closedBy?.tag || '—')}</div>
      <div class="chip">Motivo: ${escapeHtml(reason || '—')}</div>
    </div>
  </header>

  ${daySections}

  <footer>Transcrição gerada em ${new Date().toLocaleString()}</footer>
</div>
</body>
</html>`;

  const filePath = path.join(process.cwd(), `transcript_${channel.id}.html`);
  fs.writeFileSync(filePath, html, 'utf8');
  return filePath;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gerencia o painel de tickets.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sc =>
      sc.setName('painel').setDescription('Publica o painel de tickets no canal atual (use no #ticket).')
    ),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'painel') {
      await interaction.deferReply({ ephemeral: true });
      const embed = buildTicketPanelEmbed(interaction.guild);
      const components = buildTicketPanelComponents();
      const panelMsg = await interaction.channel.send({ embeds: [embed], components });
      try { await panelMsg.pin(); } catch (_) {}
      await safeEphemeralReply(interaction, '✅ Painel de tickets publicado e fixado. Use esta mensagem para abrir tickets.');
      return;
    }
  },

  async handleComponent(interaction) {
    if (interaction.isButton() && interaction.customId === 'ticket_clear_selection') {
      await interaction.deferUpdate();
      const embed = buildTicketPanelEmbed(interaction.guild);
      const components = buildTicketPanelComponents();
      try { await interaction.message.edit({ embeds: [embed], components }); } catch {}
      return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_open_select') {
      const value = interaction.values?.[0];
      const cat = CATEGORY_OPTIONS.find(c => c.value === value);
      const motivo = cat?.label || value || 'ticket';

      const modal = new ModalBuilder()
        .setCustomId(`ticket_confirm_modal:${value}`)
        .setTitle(`Confirmar: ${motivo}`.slice(0, 45));
      const label = new TextInputBuilder()
        .setCustomId('confirm_label')
        .setLabel('Confirmar? Digite "Sim"')
        .setPlaceholder(`Abrir para: ${motivo}`.slice(0, 100))
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const details = new TextInputBuilder()
        .setCustomId('extra_details')
        .setLabel('Detalhes (opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      modal.addComponents(
        new ActionRowBuilder().addComponents(label),
        new ActionRowBuilder().addComponents(details)
      );
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_confirm_modal:')) {
      const reasonValue = interaction.customId.split(':')[1];
      const raw = (interaction.fields.getTextInputValue('confirm_label') || '').trim();
      const confirmText = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const positives = new Set(['sim', 's', 'yes', 'y', 'ok', 'okay', 'ok.', 'confirmo', 'confirmar']);
      if (!positives.has(confirmText)) { await safeEphemeralReply(interaction, '❎ Abertura de ticket cancelada.'); return true; }
      const extraDetails = (interaction.fields.getTextInputValue('extra_details') || '').trim();

      await interaction.deferReply({ ephemeral: true });
      try {
        const ch = await createTicketChannel(interaction.guild, interaction.user, reasonValue, extraDetails);
        await safeEphemeralReply(interaction, `✅ Ticket criado: ${ch}`);
      } catch (e) {
        await safeEphemeralReply(interaction, '❌ Não foi possível criar o ticket. Verifique as permissões do bot.');
        try {
          const logChan = LOG_CHANNEL_ID && interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logChan) await logChan.send(`⚠️ Erro ao criar ticket de <@${interaction.user.id}>: ${e?.message || e}`);
        } catch {}
      }
      return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('ticket_staff_')) {
      if (!ensureStaff(interaction)) { await safeEphemeralReply(interaction, '❌ Apenas a equipe pode usar este botão.'); return true; }

      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText || !isTicketChannelName(channel.name || '')) {
        await safeEphemeralReply(interaction, '❌ Este canal não parece ser um ticket.');
        return true;
      }

      if (interaction.customId === 'ticket_staff_close') {
        const modal = new ModalBuilder().setCustomId('ticket_staff_close_modal').setTitle('Fechar Ticket');
        const reasonField = new TextInputBuilder()
          .setCustomId('close_reason')
          .setLabel('Motivo')
          .setPlaceholder('Explique brevemente o motivo')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(reasonField));
        await interaction.showModal(modal);
        return true;
      }

      if (interaction.customId === 'ticket_staff_add') {
        const modal = new ModalBuilder().setCustomId('ticket_staff_add_modal').setTitle('Adicionar membro ao ticket');
        const userField = new TextInputBuilder()
          .setCustomId('user_identifier')
          .setLabel('ID do usuário (somente números)')
          .setPlaceholder('Ex.: 123456789012345678')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userField));
        await interaction.showModal(modal);
        return true;
      }

      if (interaction.customId === 'ticket_staff_remove') {
        const modal = new ModalBuilder().setCustomId('ticket_staff_remove_modal').setTitle('Remover membro do ticket');
        const userField = new TextInputBuilder()
          .setCustomId('user_identifier')
          .setLabel('ID do usuário (somente números)')
          .setPlaceholder('Ex.: 123456789012345678')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userField));
        await interaction.showModal(modal);
        return true;
      }

      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_staff_close_modal') {
      if (!ensureStaff(interaction)) { await safeEphemeralReply(interaction, '❌ Apenas a equipe pode usar este botão.'); return true; }
      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText || !isTicketChannelName(channel.name || '')) {
        await safeEphemeralReply(interaction, '❌ Este canal não parece ser um ticket.');
        return true;
      }

      const reason = (interaction.fields.getTextInputValue('close_reason') || '').trim();
      await interaction.deferReply({ ephemeral: true });

      try {
        const permsCache = channel.permissionOverwrites?.cache || new Map();
        const botId = interaction.client.user.id;

        const roleOverwritesToDeny = [];
        const userOverwritesToDeny = [];

        for (const po of permsCache.values()) {
          if (po.type === 0) { // role
            const roleId = po.id;
            if (roleId === channel.guild.roles.everyone.id) continue;
            if (SUPPORT_ROLE_ID && roleId === SUPPORT_ROLE_ID) continue;
            roleOverwritesToDeny.push(roleId);
          } else if (po.type === 1) { // user
            const uid = po.id;
            if (uid === botId) continue;
            const gm = channel.guild.members.cache.get(uid);
            if (gm?.roles?.cache?.has(SUPPORT_ROLE_ID)) continue;
            userOverwritesToDeny.push(uid);
          }
        }

        const authorMatch = (channel.topic || '').match(/Ticket de .+? \((\d{17,20})\)/);
        const authorId = authorMatch?.[1];
        if (authorId && !userOverwritesToDeny.includes(authorId)) userOverwritesToDeny.push(authorId);

        const edits = [];
        edits.push(channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
          ViewChannel: false, SendMessages: false, ReadMessageHistory: false
        }).catch(() => {}));
        for (const rid of roleOverwritesToDeny) {
          edits.push(channel.permissionOverwrites.edit(rid, {
            ViewChannel: false, SendMessages: false, ReadMessageHistory: false
          }).catch(() => {}));
        }
        for (const uid of userOverwritesToDeny) {
          edits.push(channel.permissionOverwrites.edit(uid, {
            ViewChannel: false, SendMessages: false, ReadMessageHistory: false
          }).catch(() => {}));
        }
        if (SUPPORT_ROLE_ID) {
          edits.push(channel.permissionOverwrites.edit(SUPPORT_ROLE_ID, {
            ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true
          }).catch(() => {}));
        }
        edits.push(channel.permissionOverwrites.edit(botId, {
          ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageChannels: true, AttachFiles: true, EmbedLinks: true
        }).catch(() => {}));

        await Promise.race([
          Promise.allSettled(edits),
          new Promise(res => setTimeout(res, 4000)),
        ]);

        const transcriptPath = await generateTranscriptHTML(channel, interaction.user, reason);
        const attachment = new AttachmentBuilder(transcriptPath, { name: `${channel.name}.html` });

        const ops = [];
        if (CLOSED_CATEGORY_ID && channel.parentId !== CLOSED_CATEGORY_ID) {
          ops.push(channel.setParent(CLOSED_CATEGORY_ID, { lockPermissions: false }).catch(() => {}));
        }
        if (!channel.name.startsWith('closed-')) {
          ops.push(channel.setName(`closed-${channel.name}`.slice(0, 90)).catch(() => {}));
        }
        await Promise.race([
          Promise.allSettled(ops),
          new Promise(res => setTimeout(res, 5000)),
        ]);

        await channel.send({
          content: `🔒 Ticket fechado por ${interaction.user}. Motivo: ${reason}`,
          files: [attachment],
          components: [buildStaffControlsRow()],
        }).catch(() => {});

        if (LOG_CHANNEL_ID) {
          const logChan = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logChan) {
            const closeEmbed = new EmbedBuilder()
              .setTitle('🔴 Ticket Fechado')
              .setColor(0xeb4d4b)
              .setDescription(`Canal: ${channel}\nFechado por: <@${interaction.user.id}> (\`${interaction.user.tag}\`)\nMotivo: ${reason}`)
              .setTimestamp();
            logChan.send({ embeds: [closeEmbed] }).catch(() => {});
            logChan.send({ content: '📄 Transcrição anexada', files: [attachment] }).catch(() => {});
          }
        }

        await safeEphemeralReply(interaction, '✅ Ticket fechado. Acesso removido imediatamente de todos os não-staff.');
        setTimeout(() => { try { fs.unlinkSync(transcriptPath); } catch {} }, 30000);
      } catch (e) {
        await safeEphemeralReply(interaction, `❌ Erro ao fechar o ticket: ${e?.message || e}`);
      }
      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_staff_add_modal') {
      if (!ensureStaff(interaction)) { await safeEphemeralReply(interaction, '❌ Apenas a equipe pode usar este botão.'); return true; }

      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText || !isTicketChannelName(channel.name || '')) {
        await safeEphemeralReply(interaction, '❌ Este canal não parece ser um ticket.');
        return true;
      }

      const raw = (interaction.fields.getTextInputValue('user_identifier') || '').trim();
      const userId = raw.match(/^\d{17,20}$/)?.[0];

      try {
        if (!userId) throw new Error('ID inválido');

        await channel.permissionOverwrites.edit(userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true
        });

        const emb = new EmbedBuilder()
          .setColor(0x3ba55d)
          .setDescription(`➕ <@${userId}> foi adicionado ao ticket por ${interaction.user}.`);
        await interaction.reply({ content: `<@${userId}>`, embeds: [emb] }).catch(async () => {
          await channel.send({ content: `<@${userId}>`, embeds: [emb] }).catch(() => {});
        });
      } catch (e) {
        await safeEphemeralReply(interaction, '❌ Informe um ID válido (17–20 dígitos) e verifique permissões do canal/categoria.');
      }
      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_staff_remove_modal') {
      if (!ensureStaff(interaction)) { await safeEphemeralReply(interaction, '❌ Apenas a equipe pode usar este botão.'); return true; }

      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText || !isTicketChannelName(channel.name || '')) {
        await safeEphemeralReply(interaction, '❌ Este canal não parece ser um ticket.');
        return true;
      }

      const raw = (interaction.fields.getTextInputValue('user_identifier') || '').trim();
      const userId = raw.match(/^\d{17,20}$/)?.[0];

      try {
        if (!userId) throw new Error('ID inválido');

        await channel.permissionOverwrites.delete(userId).catch(() => {});
        const emb = new EmbedBuilder().setColor(0xeb4d4b).setDescription(`➖ <@${userId}> foi removido do ticket por ${interaction.user}.`);

        await interaction.reply({ embeds: [emb] }).catch(async () => {
          await channel.send({ embeds: [emb] }).catch(() => {});
        });
      } catch (e) {
        await safeEphemeralReply(interaction, '❌ Informe um ID válido (17–20 dígitos).');
      }
      return true;
    }

    return false;
  }
};