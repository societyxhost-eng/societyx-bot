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
const {
    logAction
} = require('../utils/logger');

const BRAND = 'Societyx';
const BRAND_COLOR = 0x8f17a7;
const EPHEMERAL_FLAG = 1 << 6;
const PAGE_SIZE = 25;

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
    const iconUrl = guild.iconURL({
        size: 256
    });
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
        .addOptions([{
                label: 'Avisar',
                value: 'warn'
            },
            {
                label: 'Expulsar',
                value: 'kick'
            },
            {
                label: 'Banir',
                value: 'ban'
            },
            {
                label: 'Silenciar',
                value: 'punir'
            },
            {
                label: 'Avisos (histórico)',
                value: 'warnings'
            },
            {
                label: 'Desbanir',
                value: 'unban'
            },
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

function buildPaginationRow(current, total) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
        .setCustomId('staff_warn_prev')
        .setLabel('‹ Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(current <= 1),
        new ButtonBuilder()
        .setCustomId('staff_warn_page_info')
        .setLabel(`Página ${current}/${total}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
        new ButtonBuilder()
        .setCustomId('staff_warn_next')
        .setLabel('Próxima ›')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(current >= total)
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

function buildBackAndFilterRow(backId, filterId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(backId).setLabel('Voltar').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(filterId).setLabel('Filtrar').setStyle(ButtonStyle.Secondary)
    );
}

async function toast(i, content, ms = 3000) {
    try {
        const msg = await i.followUp({
            content,
            flags: EPHEMERAL_FLAG
        });
        setTimeout(() => msg.delete().catch(() => {}), ms);
        return msg;
    } catch {
        return null;
    }
}

async function safeEditPanel(interaction, payload) {
    const {
        embeds = [], components = []
    } = payload || {};
    return interaction.editReply({
        embeds,
        components
    });
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

    const embed = buildBrandedEmbed(
        interaction.guild,
        `${BRAND} — Avisos`,
        embedDescription,
        BANNERS.warnings
    );

    const rows = [];
    if (!slice.length) embed.addFields({
        name: 'Status',
        value: 'Sem avisos no servidor.'
    });
    else {
        const options = [];
        for (const userId of slice) {
            const label = await resolveUserLabel(interaction, userId);
            const count = (Array.isArray(all[userId]) ? all[userId] : []).length;
            options.push({
                label: `${label} (ID: ${userId})`,
                value: userId,
                description: `${count} aviso(s)`
            });
        }
        if (options.length) rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('staff_select_user_warnings').setPlaceholder('Selecionar usuário…').addOptions(options)
        ));
    }

    if (users.length > PAGE_SIZE) rows.push(buildPaginationRow(safePage, totalPages));
    rows.push(buildBackAndFilterRow('staff_back_from_warnings', 'staff_filter_warnings'));

    return {
        embed,
        components: rows,
        users,
        page: safePage,
        totalPages
    };
}

async function buildUserWarningsDetailPanel(interaction, userId) {
    const entries = warningSystem.getUserWarnings(interaction.guild.id, userId) || [];

    let member;
    try {
        member = await interaction.guild.members.fetch(userId);
    } catch {}
    const userLabel = member ? member.displayName : userId;
    const userTag = member?.user?.tag || userId;

    const embedDescription = entries.length ?
        `ID do Usuário: \`${userId}\`\nSelecione abaixo o aviso para remover:` :
        'Sem avisos ativos.';

    const embed = buildBrandedEmbed(
        interaction.guild,
        `Avisos — ${userLabel}`,
        embedDescription,
        BANNERS.warnings
    );

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
    return {
        embed,
        components: rows
    };
}

async function buildBansPanel(interaction) {
    const bans = await interaction.guild.bans.fetch({
        limit: 25
    });
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

    rows.push(buildBackAndFilterRow('staff_back_from_unban', 'staff_filter_bans'));
    return {
        embed,
        components: rows
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Abre o painel de moderação da Societyx.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),

    panelState,
    buildMainEmbed,
    buildBrandedEmbed,
    buildPage1Rows,
    buildWarningsPanel,
    buildUserWarningsDetailPanel,
    buildBansPanel,
    buildBackButtonRow,
    buildBackAndFilterRow,
    resolveUserLabel,
    safeEditPanel,
    toast,

    async execute(interaction) {
        await interaction.deferReply({
            flags: EPHEMERAL_FLAG
        });

        const mainEmbed = buildMainEmbed(interaction.guild);
        await safeEditPanel(interaction, {
            embeds: [mainEmbed],
            components: buildPage1Rows()
        });

        const panelMsg = await interaction.fetchReply();
        panelState.set(panelMsg.id, {
            state: 'main'
        });

        const collector = panelMsg.createMessageComponentCollector({
            idle: 90_000
        });

        collector.on('collect', async i => {
            const state = panelState.get(panelMsg.id) || {
                state: 'main'
            };

            // Botão de limpar seleção
            if (i.customId === 'staff_clear_main_select') {
                await i.deferUpdate();
                await safeEditPanel(i, {
                    embeds: [buildMainEmbed(i.guild)],
                    components: buildPage1Rows()
                });
                panelState.set(panelMsg.id, {
                    state: 'main'
                });
                return;
            }

            // Select principal de ações
            // Select principal de ações
            if (i.customId === 'staff_actions_select') {
                const v = i.values[0];

                // ================= MODAIS =================
                if (['warn', 'kick', 'ban', 'punir'].includes(v)) {
                    // NUNCA deferir aqui!
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
                        )
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

                // ================= WARNINGS =================
                if (v === 'warnings') {
                    await i.deferUpdate();
                    const panel = await buildWarningsPanel(i, 1);
                    await safeEditPanel(i, {
                        embeds: [panel.embed],
                        components: panel.components
                    });
                    panelState.set(panelMsg.id, {
                        state: 'warnings',
                        data: {
                            users: panel.users,
                            page: panel.page,
                            totalPages: panel.totalPages
                        }
                    });
                    return;
                }

                // ================= UNBAN =================
                if (v === 'unban') {
                    await i.deferUpdate();
                    const bansPanel = await buildBansPanel(i);
                    await safeEditPanel(i, {
                        embeds: [bansPanel.embed],
                        components: bansPanel.components
                    });
                    panelState.set(panelMsg.id, {
                        state: 'unban'
                    });
                    return;
                }
            }

            // ==================== DESBANIR USUÁRIO ====================
            if (i.customId === 'staff_unban_select') {
                await i.deferUpdate();
                const userId = i.values[0];
                const ban = await i.guild.bans.fetch(userId).catch(() => null);
                if (!ban) return await toast(i, `❌ Usuário não encontrado entre os bans.`);

                await i.guild.members.unban(userId, `Desbanido por ${i.user.tag}`);
                await logAction(i.client, {
                    action: 'Unban',
                    moderator: i.user,
                    target: ban.user,
                    reason: 'Painel de Staff'
                });

                await toast(i, `✅ Usuário ${ban.user.tag} foi desbanido com sucesso!`);

                const bansPanel = await buildBansPanel(i);
                await safeEditPanel(i, {
                    embeds: [bansPanel.embed],
                    components: bansPanel.components
                });
                panelState.set(panelMsg.id, {
                    state: 'unban'
                });
                return;
            }

            // Paginação de avisos
            if (['staff_warn_prev', 'staff_warn_next'].includes(i.customId)) {
                await i.deferUpdate();
                const current = state?.data?.page || 1;
                const users = state?.data?.users || null;
                const nextPage = i.customId === 'staff_warn_prev' ? current - 1 : current + 1;
                const panel = await buildWarningsPanel(i, nextPage, users);
                await safeEditPanel(i, {
                    embeds: [panel.embed],
                    components: panel.components
                });
                panelState.set(panelMsg.id, {
                    state: 'warnings',
                    data: {
                        users: panel.users,
                        page: panel.page,
                        totalPages: panel.totalPages
                    }
                });
                return;
            }

            // Seleção de usuário para ver avisos
            if (i.customId === 'staff_select_user_warnings') {
                await i.deferUpdate();
                const userId = i.values[0];
                const panel = await buildUserWarningsDetailPanel(i, userId);
                await safeEditPanel(i, {
                    embeds: [panel.embed],
                    components: panel.components
                });
                panelState.set(panelMsg.id, {
                    state: 'user_warnings',
                    data: {
                        userId,
                        users: state?.data?.users || null,
                        page: state?.data?.page || 1
                    }
                });
                return;
            }

            // Remover aviso
            if (i.customId.startsWith('staff_remove_warning_select_')) {
                await i.deferUpdate();
                const userId = i.customId.split('_').pop();
                const warningId = i.values[0];
                const removedWarning = warningSystem.removeWarning(i.guild.id, userId, warningId);
                if (!removedWarning) return toast(i, `❌ Não foi possível remover o aviso ${warningId}.`);

                let target;
                try {
                    target = (await i.guild.members.fetch(userId)).user;
                } catch {
                    try {
                        target = await i.client.users.fetch(userId);
                    } catch {
                        target = {
                            id: userId,
                            tag: userId
                        };
                    }
                }

                await logAction(i.client, {
                    action: 'Unwarn',
                    moderator: i.user,
                    target,
                    reason: removedWarning.reason || 'Sem motivo'
                });

                await toast(i, `✅ Aviso ${removedWarning.id} removido de ${target.tag || userId} (${removedWarning.reason || 'Sem motivo'})`);

                const refreshed = await buildUserWarningsDetailPanel(i, userId);
                await safeEditPanel(i, {
                    embeds: [refreshed.embed],
                    components: refreshed.components
                });
                panelState.set(panelMsg.id, {
                    state: 'user_warnings',
                    data: {
                        userId,
                        users: state?.data?.users || null,
                        page: state?.data?.page || 1
                    }
                });
                return;
            }

            // Botões de voltar
            if (i.customId.startsWith('staff_back')) {
                await i.deferUpdate();
                if (state.state === 'user_warnings') {
                    const page = state.data?.page || 1;
                    const users = state.data?.users || null;
                    const panel = await buildWarningsPanel(i, page, users);
                    await safeEditPanel(i, {
                        embeds: [panel.embed],
                        components: panel.components
                    });
                    panelState.set(panelMsg.id, {
                        state: 'warnings',
                        data: {
                            users: panel.users,
                            page: panel.page,
                            totalPages: panel.totalPages
                        }
                    });
                } else if (state.state === 'warnings' || state.state === 'unban') {
                    const mainEmbed = buildMainEmbed(i.guild);
                    await safeEditPanel(i, {
                        embeds: [mainEmbed],
                        components: buildPage1Rows()
                    });
                    panelState.set(panelMsg.id, {
                        state: 'main'
                    });
                }
            }
        });



        collector.on('end', async (_collected, reason) => {
            panelState.delete(panelMsg.id);
            try {
                await interaction.editReply({
                    content: reason === 'idle' ? '⏳ Sessão expirada (90s). Use /staff novamente.' : '⏳ Sessão encerrada. Use /staff novamente.',
                    embeds: [],
                    components: [],
                });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            } catch {}
        });
    }
};