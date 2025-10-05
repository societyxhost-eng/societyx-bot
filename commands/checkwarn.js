const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');
const warningSystem = require('../utils/warningSystem');

function buildCheckWarnContainer(userId, warnings) {
    let warningsContent = '';
    if (!warnings || warnings.length === 0) {
        warningsContent = '<:ActionCheck:1411491648516522104> **Nenhum warning encontrado para este usuário!**';
    } else {
        warningsContent = `<:ActionWarning:1411491698382602300> **Warnings de <@${userId}>:**\n\n`;
        warnings.forEach((warn, index) => {
            const date = new Date(warn.timestamp).toLocaleDateString('pt-BR');
            warningsContent += `**${index + 1}.** Warning\n<:ActionQuestion:1411491772164608020> Motivo: ${warn.reason.substring(0, 50)}${warn.reason.length > 50 ? '...' : ''}\n <:Calendar:1411770124192579676> Data: ${date}\n`;
        });
    }

    return new ContainerBuilder()
        .addTextDisplayComponents(text =>
            text.setContent(`# <:ActionWarning:1411491698382602300> CheckWarn - <@${userId}>\n<:board:1411842629557289060> **Detalhes dos warnings do usuário**`)
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent(warningsContent)
        );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkwarn')
        .setDescription('Verifique os warnings de um usuário')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário que você quer verificar')
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const guildId = interaction.guild.id;
        const allWarnings = warningSystem.getAllWarnings(guildId);
        const userWarnings = allWarnings[user.id] || [];

        await interaction.reply({
            components: [buildCheckWarnContainer(user.id, userWarnings)],
            flags: MessageFlags.IsComponentsV2
        });
    }
};