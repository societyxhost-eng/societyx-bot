const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Adiciona um cargo a um usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário que receberá o cargo')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('cargo')
                .setDescription('Cargo a ser adicionado')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo para adicionar o cargo')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('cargo');
        const reason = interaction.options.getString('motivo') || 'Não informado';
        const moderator = interaction.user;

        try {
            const member = await interaction.guild.members.fetch(user.id);

            if (member.roles.cache.has(role.id)) {
                return interaction.reply({
                    content: `❌ O usuário ${user.tag} já possui o cargo ${role.name}.`,
                    ephemeral: true
                });
            }

            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({
                    content: `❌ Não posso adicionar o cargo ${role.name} porque ele está acima da minha hierarquia.`,
                    ephemeral: true
                });
            }

            if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== moderator.id) {
                return interaction.reply({
                    content: `❌ Você não tem permissão para adicionar o cargo ${role.name} pois ele está acima da sua hierarquia.`,
                    ephemeral: true
                });
            }

            await member.roles.add(role, `Cargo adicionado por ${moderator.tag} - Motivo: ${reason}`);

            await interaction.reply({
                content: `✅ Cargo **${role.name}** adicionado ao usuário **${user.tag}** com sucesso!`,
                ephemeral: false
            });

            await logAction(interaction.client, {
                action: 'Cargo Adicionado',
                moderator,
                target: user,
                reason,
                extra: `Cargo: ${role.name}`
            });

        } catch (error) {
            console.error('Erro ao adicionar cargo:', error);

            if (error.code === 50013) {
                return interaction.reply({
                    content: '❌ Não tenho permissões suficientes para adicionar este cargo.',
                    ephemeral: true
                });
            } else if (error.code === 10007) {
                return interaction.reply({
                    content: '❌ Usuário não encontrado no servidor.',
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: '❌ Ocorreu um erro ao tentar adicionar o cargo. Tente novamente.',
                    ephemeral: true
                });
            }
        }
    }
};
