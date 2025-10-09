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
const BANNERS = { ticket: 'https://i.imgur.com/V7fDMxa.png' };

const SUPPORT_ROLE_ID = '1407822867101388851';
const LOG_CHANNEL_ID = '1425600226437365822';
const PARENT_CATEGORY_ID = '1425596175297417288';
const CLOSED_CATEGORY_ID = '1425599287156539392';

const IGNORED_ROLE_ID = '1408917844170899597';

const EPHEMERAL_TTL_MS = 9000;

const transcriptsDir = path.join(process.cwd(), 'transcripts');
if (!fs.existsSync(transcriptsDir)) {
  fs.mkdirSync(transcriptsDir);
}

const CATEGORY_OPTIONS = [
  { label: 'Dúvidas', value: 'duvidas', emoji: '❓', desc: 'Tire suas dúvidas sobre o servidor.' },
  { label: 'Técnico', value: 'tecnico', emoji: '🛠️', desc: 'Caso tenha algum problema técnico, reporte aqui.' },
  { label: 'VIP', value: 'vip', emoji: '💎', desc: 'Problemas ou dúvidas sobre os planos vips.' },
  { label: 'Parcerias', value: 'parcerias', emoji: '🤝', desc: 'Caso queira fazer uma parceria com o servidor.' },
  { label: 'Outros', value: 'outros', emoji: '📂', desc: 'Problemas ou dúvidas não listados anteriormente.' },
];

function buildBrandedEmbed(guild, title, description, bannerUrl) {
  const iconUrl = guild?.iconURL?.({ size: 256 });
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

function hasRole(member, roleId) {
  try { return member?.roles?.cache?.has(roleId); } catch { return false; }
}

async function safeEphemeralReply(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content).catch(() => {});
    setTimeout(() => interaction.deleteReply().catch(() => {}), EPHEMERAL_TTL_MS);
  } else {
    await interaction.reply({ content, flags: 64 }).catch(() => {});
    setTimeout(() => interaction.deleteReply().catch(() => {}), EPHEMERAL_TTL_MS);
  }
}

function buildStaffControlsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_staff_claim').setLabel('Assumir Ticket').setEmoji('🙋').setStyle(ButtonStyle.Success),
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
  if (SUPPORT_ROLE_ID) {
    try {
      const supportRole = await guild.roles.fetch(SUPPORT_ROLE_ID);
      if (supportRole) {
        supportRole.members.forEach(staffMember => {
          if (!hasRole(staffMember, IGNORED_ROLE_ID)) {
            overwrites.push({ id: staffMember.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] });
          }
        });
      }
    } catch (error) {
      console.error(`[Ticket System] Erro ao buscar o cargo de suporte (${SUPPORT_ROLE_ID}):`, error);
      overwrites.push({ id: SUPPORT_ROLE_ID, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] });
    }
  }
  if (guild.members.me) {
    overwrites.push({ id: guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'AttachFiles', 'EmbedLinks'] });
  }
  const cat = CATEGORY_OPTIONS.find(c => c.value === reasonValue);
  const reasonLabel = cat?.label || (reasonValue ? categorySlug(reasonValue) : 'Ticket');
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: PARENT_CATEGORY_ID || null,
    permissionOverwrites: overwrites,
    topic: `Ticket de ${author.tag} (${author.id}) | Motivo: ${reasonLabel}`,
    reason: `Ticket aberto por ${author.tag} - Motivo: ${reasonLabel}`,
  });
  const intro = [`${cat?.emoji ?? '🎫'} Motivo: ${reasonLabel}`, cat?.desc || null, extraDetails ? `Detalhes: ${extraDetails.slice(0, 1000)}` : null, `Nossa equipe irá te atender em breve. Descreva seu caso com detalhes.`].filter(Boolean).join('\n\n');
  const introEmbed = buildBrandedEmbed(guild, `🎫 Ticket Aberto — ${author.username}`, intro, BANNERS.ticket)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setFooter({ text: `Canal: #${name}` });
  await channel.send({ content: `<@${author.id}> ${SUPPORT_ROLE_ID ? `<@&${SUPPORT_ROLE_ID}>` : ''}`, embeds: [introEmbed], components: [buildStaffControlsRow()] });
  if (LOG_CHANNEL_ID) {
    const logChan = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChan) {
      const openEmbed = new EmbedBuilder()
        .setTitle(`🟢 Ticket Aberto — #${name}`)
        .setColor(0x3ba55d)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setDescription(`Canal: ${channel}\nAutor: <@${author.id}> (\`${author.tag}\`)\nMotivo: \`${reasonLabel}\``)
        .setTimestamp();
      await logChan.send({ embeds: [openEmbed] }).catch(() => {});
    }
  }
  return channel;
}

function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function fetchAllMessages(channel, limitHard = 5000) {
  let lastId;
  const all = [];
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
  const guildName = channel.guild?.name || 'Servidor Desconhecido';
  const channelName = channel.name;
  const fmtTime = ts => new Date(ts).toLocaleString('pt-BR');
  const messageBlocks = messages.map(msg => {
    const authorName = escapeHtml(msg.member?.displayName || msg.author?.globalName || msg.author?.username || 'Usuário');
    const fallbackAvatar = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%235865f2%22/><text x=%2220%22 y=%2225%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2216%22>${escapeHtml(authorName.charAt(0))}</text></svg>`;
    const authorAvatar = msg.author?.displayAvatarURL({ size: 64 }) || fallbackAvatar;
    const timestamp = fmtTime(msg.createdTimestamp);
    const botTag = msg.author.bot ? '<span class="bot-tag">BOT</span>' : '';
    const content = msg.content ? `<div>${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>` : '';
    const attachments = msg.attachments.size > 0 ? '<div class="attachments">' + [...msg.attachments.values()].map(att => {
      const isImg = /\.(png|jpe?g|gif|webp)$/i.test(att.url.split('?')[0]);
      if (isImg) { return `<a href="${att.url}" target="_blank"><img src="${att.url}" alt="Anexo" class="attachment-image"></a>`; }
      return `<a href="${att.url}" class="attachment-link" target="_blank">${escapeHtml(att.name)}</a>`;
    }).join('') + '</div>' : '';
    const embeds = msg.embeds.length > 0 ? '<div class="embeds">' + msg.embeds.map(e => {
      const title = e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : '';
      const description = e.description ? `<div class="embed-description">${escapeHtml(e.description).replace(/\n/g, '<br>')}</div>` : '';
      const image = e.image?.url ? `<img src="${e.image.url}" alt="Embed Image" class="embed-image">` : '';
      const color = e.color ? `style="border-left-color: #${e.color.toString(16).padStart(6, '0')}"` : '';
      return `<div class="embed" ${color}>${title}${description}${image}</div>`;
    }).join('') + '</div>' : '';
    return `<div class="message"><div class="message-header"><img src="${authorAvatar}" alt="Avatar" class="avatar"><span class="author">${authorName}</span>${botTag}<span class="timestamp">${timestamp}</span></div><div class="message-content">${content}${attachments}${embeds}</div></div>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Transcript - ${escapeHtml(channelName)}</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #36393f; color: #dcddde; line-height: 1.6; } .header { background-color: #2f3136; padding: 20px; border-bottom: 1px solid #40444b; text-align: center; } .header h1 { color: #ffffff; font-size: 24px; margin-bottom: 10px; } .header .info { color: #b9bbbe; font-size: 14px; } .messages { max-width: 1200px; margin: 0 auto; padding: 20px; } .message { margin-bottom: 20px; padding: 10px; border-radius: 8px; background-color: #40444b; } .message-header { display: flex; align-items: center; margin-bottom: 8px; flex-wrap: wrap; } .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 12px; } .author { font-weight: bold; color: #ffffff; margin-right: 8px; } .timestamp { color: #72767d; font-size: 12px; } .message-content { margin-left: 52px; word-wrap: break-word; } .attachments { margin-top: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; } .attachment-image { max-width: 400px; max-height: 300px; border-radius: 8px; margin: 5px 0; } .attachment-link { display: inline-block; background-color: #5865f2; color: white; padding: 8px 12px; border-radius: 4px; text-decoration: none; margin: 5px 0; } .embeds { margin-top: 10px; } .embed { background-color: #2f3136; border-left: 4px solid #5865f2; padding: 12px; margin: 8px 0; border-radius: 4px; } .embed-title { font-weight: bold; color: #ffffff; margin-bottom: 8px; } .embed-description { color: #dcddde; margin-bottom: 8px; } .embed-image { max-width: 400px; max-height: 300px; border-radius: 4px; margin-top: 8px; } .bot-tag { background-color: #5865f2; color: white; font-size: 10px; padding: 2px 4px; border-radius: 3px; margin-left: 4px; vertical-align: middle; } .footer { text-align: center; padding: 20px; color: #72767d; font-size: 12px; border-top: 1px solid #40444b; margin-top: 20px; }</style></head><body><div class="header"><h1>Transcript do Canal: #${escapeHtml(channelName)}</h1><div class="info">Servidor: ${escapeHtml(guildName)}<br>Fechado por: ${escapeHtml(closedBy?.tag || 'N/A')}<br>Motivo: ${escapeHtml(reason || 'Não especificado')}<br>Total de mensagens: ${messages.length}</div></div><div class="messages">${messageBlocks}</div><div class="footer">Transcript gerado por ${BRAND}.</div></body></html>`;
  const filePath = path.join(transcriptsDir, `transcript-${channel.id}.html`);
  fs.writeFileSync(filePath, html, 'utf8');
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
      await interaction.deferReply({ flags: 64 });
      const embed = buildTicketPanelEmbed(interaction.guild);
      const components = buildTicketPanelComponents();
      const panelMsg = await interaction.channel.send({ embeds: [embed], components });
      try { await panelMsg.pin(); } catch (_) { }
      await safeEphemeralReply(interaction, '✅ Painel de tickets publicado e fixado.');
      return;
    }
  },

  async handleComponent(interaction) {
    if (interaction.isButton() && interaction.customId === 'ticket_clear_selection') {
      await interaction.deferUpdate();
      const embed = buildTicketPanelEmbed(interaction.guild);
      const components = buildTicketPanelComponents();
      try { await interaction.message.edit({ embeds: [embed], components }); } catch { }
      return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_open_select') {
      if (hasRole(interaction.member, IGNORED_ROLE_ID)) {
        await safeEphemeralReply(interaction, '❌ Você não pode abrir tickets com este cargo.');
        return true;
      }
      const value = interaction.values?.[0];
      const cat = CATEGORY_OPTIONS.find(c => c.value === value);
      const motivo = cat?.label || value || 'ticket';
      const modal = new ModalBuilder().setCustomId(`ticket_confirm_modal:${value}`).setTitle(`Confirmar: ${motivo}`.slice(0, 45));
      const label = new TextInputBuilder().setCustomId('confirm_label').setLabel('Confirmar? Digite "Sim"').setPlaceholder(`Abrir para: ${motivo}`.slice(0, 100)).setStyle(TextInputStyle.Short).setRequired(true);
      const details = new TextInputBuilder().setCustomId('extra_details').setLabel('Detalhes (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(label), new ActionRowBuilder().addComponents(details));
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_confirm_modal:')) {
      if (hasRole(interaction.member, IGNORED_ROLE_ID)) {
        await safeEphemeralReply(interaction, '❌ Você não pode abrir tickets com este cargo.');
        return true;
      }
      const reasonValue = interaction.customId.split(':')[1];
      const raw = (interaction.fields.getTextInputValue('confirm_label') || '').trim();
      const confirmText = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const positives = new Set(['sim', 's', 'yes', 'y', 'ok', 'okay', 'ok.', 'confirmo', 'confirmar']);
      if (!positives.has(confirmText)) {
        await safeEphemeralReply(interaction, '❎ Abertura de ticket cancelada.');
        return true;
      }
      const extraDetails = (interaction.fields.getTextInputValue('extra_details') || '').trim();
      await interaction.deferReply({ flags: 64 });
      try {
        const ch = await createTicketChannel(interaction.guild, interaction.user, reasonValue, extraDetails);
        await safeEphemeralReply(interaction, `✅ Ticket criado: ${ch}`);
      } catch (e) {
        console.error("Erro ao criar ticket:", e);
        await safeEphemeralReply(interaction, '❌ Não foi possível criar o ticket. Verifique as permissões do bot.');
        try {
          const logChan = LOG_CHANNEL_ID && interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logChan) await logChan.send(`⚠️ Erro ao criar ticket de <@${interaction.user.id}>: ${e?.message || e}`);
        } catch { }
      }
      return true;
    }

    if (interaction.isButton() && interaction.customId === 'ticket_staff_claim') {
      if (!ensureStaff(interaction)) {
        await safeEphemeralReply(interaction, '❌ Apenas a equipe pode assumir tickets.');
        return true;
      }
      await interaction.deferUpdate();

      // Atualiza o tópico do canal para incluir quem assumiu
      const channel = interaction.channel;
      let newTopic = channel.topic || '';
      const userMention = `<@${interaction.user.id}>`;
      if (newTopic.includes('| Assumido por:')) {
        newTopic = newTopic.replace(/\| Assumido por:.*$/, `| Assumido por: ${userMention}`);
      } else {
        newTopic += ` | Assumido por: ${userMention}`;
      }
      await channel.setTopic(newTopic).catch(() => {});

      const originalRow = interaction.message.components[0];
      const newComponents = originalRow?.components?.filter(c => c.customId !== 'ticket_staff_claim') || [];
      const newRow = new ActionRowBuilder().addComponents(newComponents);
      await interaction.message.edit({ components: [newRow] }).catch(() => {});

      const claimEmbed = new EmbedBuilder()
        .setColor(0x3ba55d)
        .setDescription(`🙋 O ticket foi assumido por ${interaction.user}. Ele(a) irá te ajudar em breve.`);
      await interaction.channel.send({ embeds: [claimEmbed] }).catch(() => {});

      return true;
    }

    if (interaction.isButton() && interaction.customId === 'ticket_staff_close') {
      if (!ensureStaff(interaction)) {
        await safeEphemeralReply(interaction, '❌ Apenas a equipe pode fechar tickets.');
        return true;
      }
      const modal = new ModalBuilder()
        .setCustomId('ticket_staff_close_modal')
        .setTitle('Fechar e Deletar Ticket');
      const reasonField = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Motivo do Fechamento')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(reasonField));
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_staff_close_modal') {
      if (!ensureStaff(interaction)) {
        await safeEphemeralReply(interaction, '❌ Apenas a equipe pode fechar tickets.');
        return true;
      }
      const channel = interaction.channel;
      if (!channel || !isTicketChannelName(channel.name)) {
        await safeEphemeralReply(interaction, '❌ Este canal não é um ticket válido.');
        return true;
      }

      const reason = (interaction.fields.getTextInputValue('close_reason') || '').trim();
      await interaction.deferReply({ flags: 64 });

      try {
        await generateTranscriptHTML(channel, interaction.user, reason);

        if (LOG_CHANNEL_ID) {
          const logChan = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logChan) {
            const authorMatch = (channel.topic || '').match(/Ticket de .+? \((\d{17,20})\)/);
            const authorId = authorMatch ? authorMatch[1] : null;

            const assumedMatch = (channel.topic || '').match(/\| Assumido por: <@!?(\d{17,20})>/);
            const assumedId = assumedMatch ? assumedMatch[1] : null;
            const whoAssumed = assumedId ? `<@${assumedId}> (${assumedId})` : 'N/A';

            const closeEmbed = new EmbedBuilder()
              .setTitle(`🔴 Ticket Fechado — #${channel.name}`)
              .setColor(0xeb4d4b)
              .setThumbnail(channel.guild.iconURL({ size: 256 }))
              .setDescription('Ticket foi encerrado, segue as informações abaixo:')
              .addFields(
                { name: 'Quem abriu o ticket:', value: authorId ? `<@${authorId}> (${authorId})` : 'Desconhecido', inline: true },
                { name: 'Quem assumiu:', value: whoAssumed, inline: true },
                { name: 'Quem fechou o ticket:', value: `<@${interaction.user.id}> (${interaction.user.id})`, inline: true },
              )
              .setTimestamp();

            const transcriptButton = new ButtonBuilder()
              .setCustomId(`transcript_generate:${channel.id}`)
              .setLabel('Transcrição')
              .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(transcriptButton);

            await logChan.send({ embeds: [closeEmbed], components: [row] }).catch(() => {});
          }
        }

        await channel.send({ content: `🔒 Ticket fechado por ${interaction.user}. **Este canal será excluído em 10 segundos.**` }).catch(() => {});
        await safeEphemeralReply(interaction, '✅ Ticket fechado. A transcrição foi salva e o canal será excluído em 10 segundos.');

        setTimeout(() => { channel.delete('Ticket fechado e arquivado.').catch(e => console.error(`Falha ao deletar o canal ${channel.id}:`, e)); }, 10000);
      } catch (e) {
        console.error("Erro ao fechar/deletar ticket:", e);
        await safeEphemeralReply(interaction, `❌ Erro ao fechar o ticket: ${e?.message || e}`);
      }
      return true;
    }

    if (interaction.isButton() && (interaction.customId === 'ticket_staff_add' || interaction.customId === 'ticket_staff_remove')) {
      if (!ensureStaff(interaction)) { await safeEphemeralReply(interaction, '❌ Apenas a equipe pode usar este botão.'); return true; }
      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText || !isTicketChannelName(channel.name || '')) { await safeEphemeralReply(interaction, '❌ Este canal não parece ser um ticket.'); return true; }

      const action = interaction.customId === 'ticket_staff_add' ? 'add' : 'remove';
      const modal = new ModalBuilder().setCustomId(`ticket_staff_${action}_modal`).setTitle(`${action === 'add' ? 'Adicionar' : 'Remover'} membro ao ticket`);
      const userField = new TextInputBuilder().setCustomId('user_identifier').setLabel('ID do usuário (somente números)').setPlaceholder('Ex.: 123456789012345678').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(userField));
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.isModalSubmit() && (interaction.customId === 'ticket_staff_add_modal' || interaction.customId === 'ticket_staff_remove_modal')) {
      if (!ensureStaff(interaction)) {
        return interaction.reply({ content: '❌ Apenas a equipe pode usar este botão.', flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText || !isTicketChannelName(channel.name || '')) {
        return interaction.editReply({ content: '❌ Este canal não parece ser um ticket.' });
      }

      const raw = (interaction.fields.getTextInputValue('user_identifier') || '').trim();
      const userId = raw.match(/^\d{17,20}$/)?.[0];

      try {
        if (!userId) throw new Error('ID inválido');

        if (interaction.customId === 'ticket_staff_add_modal') {
          const memberToAdd = await interaction.guild.members.fetch(userId).catch(() => null);
          if (!memberToAdd) {
            return interaction.editReply({ content: '❌ Usuário não encontrado no servidor.' });
          }
          if (hasRole(memberToAdd, IGNORED_ROLE_ID)) {
            return interaction.editReply({ content: '❌ Este usuário possui um cargo bloqueado e não pode ser adicionado ao ticket.' });
          }

          await channel.permissionOverwrites.edit(userId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
          });

          const emb = new EmbedBuilder().setColor(0x3ba55d).setDescription(`➕ <@${userId}> foi adicionado ao ticket por ${interaction.user}.`);
          return interaction.editReply({ content: `<@${userId}>`, embeds: [emb] });

        } else {
          await channel.permissionOverwrites.delete(userId).catch(() => {});
          const emb = new EmbedBuilder().setColor(0xeb4d4b).setDescription(`➖ <@${userId}> foi removido do ticket por ${interaction.user}.`);
          return interaction.editReply({ embeds: [emb] });
        }
      } catch (e) {
        console.error('--- ERRO AO ADICIONAR/REMOVER MEMBRO ---', e);
        return interaction.editReply({
          content: '❌ Ocorreu um erro. Verifique se o ID está correto e se o bot tem permissão para "Gerenciar Canais".',
        });
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('transcript_generate:')) {
      if (!ensureStaff(interaction)) {
        return interaction.reply({ content: '❌ Apenas a equipe pode visualizar transcrições.', flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      const channelId = interaction.customId.split(':')[1];
      const filePath = path.join(transcriptsDir, `transcript-${channelId}.html`);

      if (fs.existsSync(filePath)) {
        const attachment = new AttachmentBuilder(filePath, { name: `transcript-${channelId}.html` });
        await interaction.editReply({
          content: `📄 Aqui está a transcrição do ticket \`${channelId}\`. Esta mensagem será apagada em 30 segundos.`,
          files: [attachment]
        });
        setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 30000);
      } else {
        await interaction.editReply({ content: '❌ Arquivo de transcrição não encontrado. Pode ter sido apagado ou houve um erro ao salvar.' });
      }
      return true;
    }

    return false;
  }
};