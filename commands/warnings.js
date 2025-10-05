const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags,
    ComponentType
} = require('discord.js');
const warningSystem = require('../utils/warningSystem');
const { logAction } = require('../utils/logger');

// Container mostrando todos os warnings do servidor
function buildServerWarningsContainer(guildId) {
    const allWarnings = warningSystem.getAllWarnings(guildId);
    const userWarnings = {};
    
    Object.values(allWarnings).forEach(userWarningList => {
        userWarningList.forEach(warning => {
            if (!userWarnings[warning.userId]) userWarnings[warning.userId] = [];
            userWarnings[warning.userId].push(warning);
        });
    });

    let content = '';
    if (!Object.keys(userWarnings).length) {
        content = '<:ActionCheck:1411491648516522104> Nenhum warning ativo no servidor.';
    } else {
        content = '<:board:1411842629557289060> Warnings Ativos:\n';
        Object.entries(userWarnings)
            .sort(([,a], [,b]) => b.length - a.length)
            .forEach(([userId, warnings]) => {
                content += `- <@${userId}>: ${warnings.length} warning(s)\n`;
            });
    }

    return new ContainerBuilder()
        .addTextDisplayComponents(text => text.setContent(`# Warnings do Servidor\n${content}`));
}

// Container de confirmação para limpar todos os warnings
function buildClearAllConfirmationContainer() {
    return new ContainerBuilder()
        .addTextDisplayComponents(text => 
            text.setContent('<:ActionWarning:1411491698382602300> **Você tem certeza que deseja limpar todos os warnings do servidor?**')
        )
        .addActionRowComponents(row => 
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_clear_all')
                    .setLabel('Confirmar')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_clear_all')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            )
        );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Gerencia os warnings do servidor')
        .addSubcommand(sub => 
            sub.setName('servidor')
               .setDescription('Mostra todos os warnings do servidor'))
        .addSubcommand(sub => 
            sub.setName('limpar')
               .setDescription('Remove todos os warnings de um usuário')
               .addUserOption(opt => 
                   opt.setName('usuário')
                      .setDescription('Usuário que terá os warnings limpos')
                      .setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('limpar_todos')
               .setDescription('Remove todos os warnings do servidor'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'servidor') {
            await interaction.reply({
                components: [buildServerWarningsContainer(guildId)],
                flags: MessageFlags.IsComponentsV2
            });

        } else if (sub === 'limpar') {
            const user = interaction.options.getUser('usuário');
            warningSystem.resetWarnings(guildId, user.id);

            await interaction.reply({
                components: [new ContainerBuilder().addTextDisplayComponents(text =>
                    text.setContent(`<:ActionCheck:1411491648516522104> Todos os warnings de ${user.tag} foram removidos.`)
                )],
                flags: MessageFlags.IsComponentsV2
            });

            logAction(interaction.client, {
                action: 'Unwarn',
                moderator: interaction.user,
                target: user,
                reason: 'Remoção de todos os warnings do usuário'
            });

        } else if (sub === 'limpar_todos') {
            const response = await interaction.reply({
                components: [buildClearAllConfirmationContainer()],
                flags: MessageFlags.IsComponentsV2,
                fetchReply: true
            });

            const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ 
                        content: '<:ActionX:1411491670196883637> Apenas quem executou o comando pode confirmar.',
                        ephemeral: true 
                    });
                }

                if (i.customId === 'confirm_clear_all') {
                    warningSystem.resetAllWarnings(guildId);
                    await i.update({ 
                        components: [],
                        content: '<:ActionCheck:1411491648516522104> Todos os warnings do servidor foram removidos.'
                    });

                    logAction(interaction.client, {
                        action: 'Clear',
                        moderator: interaction.user,
                        reason: 'Remoção de todos os warnings do servidor'
                    });

                } else if (i.customId === 'cancel_clear_all') {
                    await i.update({
                        components: [],
                        content: '<:ActionWarning:1411491698382602300> A ação de limpar todos os warnings foi cancelada.'
                    });
                }
            });
        }
    }
};
