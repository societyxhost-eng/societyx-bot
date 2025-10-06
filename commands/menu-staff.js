const { 
    SlashCommandBuilder,
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ComponentType,
    PermissionFlagsBits
} = require('discord.js');

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function buildStaffContainer() {
    return new ContainerBuilder()
        .addTextDisplayComponents(text =>
            text.setContent('# <:Book:1411769115898806344> Painel - Sistema de Staff\n<:Bot:1411366172560986273> **Gerencie as ações de moderação do servidor**')
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent('## <:Book:1411769115898806344> O que cada comando faz:')
        )
        .addTextDisplayComponents(text =>
            text.setContent(
                '<:ActionWarning:1411491698382602300> **/warn:** Adiciona um aviso a um usuário\n' +
                '<:Clipboard:1411785262190825672> **/kick:** Expulsa um usuário do servidor\n' +
                '<:Warning1:1411784319201972335> **/ban:** Bane permanentemente um usuário\n' +
                '<:ActionQuestion:1411491772164608020> **/punir:** Silencia temporariamente um usuário'
            )
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent('## <:Book:1411769115898806344> Como preencher os comandos:')
        )
        .addTextDisplayComponents(text =>
            text.setContent(
                '<:ActionWarning:1411491698382602300> **Aviso (/warn):**\n' +
                '  - Preencha **ID do usuário** e **motivo** do aviso\n\n' +
                '<:Clipboard:1411785262190825672> **Expulsão (/kick):**\n' +
                '  - Preencha **ID do usuário** e **motivo** da expulsão\n\n' +
                '<:Warning1:1411784319201972335> **Ban (/ban):**\n' +
                '  - Preencha **ID do usuário** e **motivo** do banimento\n\n' +
                '<:ActionQuestion:1411491772164608020> **Silenciar (/punir):**\n' +
                '  - Preencha **ID do usuário**, **motivo** e **duração**\n' +
                '  - Exemplo de duração: `30s`, `10min`, `1h`, `1d`, `1mes`'
            )
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent('<:ActionQuestion:1411491772164608020> Dica: Clique em um botão para abrir o modal e preencher os campos.')
        )
        .addSeparatorComponents(separator => separator)
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('staff_warn')
                    .setLabel('Aviso')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('<:ActionWarning:1411491698382602300>'),
                new ButtonBuilder()
                    .setCustomId('staff_kick')
                    .setLabel('Expulsar')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('<:Clipboard:1411785262190825672>'),
                new ButtonBuilder()
                    .setCustomId('staff_ban')
                    .setLabel('Banir')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('<:Warning1:1411784319201972335>'),
                new ButtonBuilder()
                    .setCustomId('staff_punir')
                    .setLabel('Silenciar')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('<:ActionQuestion:1411491772164608020>')
            )
        );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menustaff')
        .setDescription('Painel interativo de Staff')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        // Mensagem ephemeral para que apenas quem executa veja
        const response = await interaction.reply({
            components: [buildStaffContainer()],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            fetchReply: true
        });

        const message = response;

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300_000
        });

        collector.on('collect', async i => {
            const action = i.customId.replace('staff_', ''); 

            const modal = new ModalBuilder()
                .setCustomId(`staff_modal_${action}`)
                .setTitle(`Ação de Staff: ${action.toUpperCase()}`);

            const userInput = new TextInputBuilder()
                .setCustomId('target_user')
                .setLabel('ID do Usuário')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Digite apenas o ID do usuário')
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Motivo da Ação')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Descreva o motivo da ação')
                .setRequired(true);

            const rows = [
                new ActionRowBuilder().addComponents(userInput),
                new ActionRowBuilder().addComponents(reasonInput)
            ];

            if (action === 'punir') {
                const durationInput = new TextInputBuilder()
                    .setCustomId('duration')
                    .setLabel('Duração da Punição')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ex: 30s, 10min, 1h, 1d, 1mes')
                    .setRequired(true);

                rows.push(new ActionRowBuilder().addComponents(durationInput));
            }

            modal.addComponents(...rows);
            await i.showModal(modal);
        });

        collector.on('end', async () => {
            try {
                await message.edit({
                    components: [buildStaffContainer().addTextDisplayComponents(text =>
                        text.setContent('<:Clock:1411792992980697158> **Sessão expirada.** Use `/menustaff` novamente.')
                    )]
                });
            } catch (err) {
                console.error(err);
            }
        });
    }
};
