const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Adiciona um cargo a um usuário')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuário que receberá o cargo')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('cargo')
                .setDescription('Cargo a ser adicionado')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('cargo');
        const moderator = interaction.user;

        try {
            // Buscar o membro no servidor
            const member = await interaction.guild.members.fetch(user.id);
            
            // Verificar se o membro já possui o cargo
            if (member.roles.cache.has(role.id)) {
                return await interaction.reply({
                    content: `O usuário ${user.tag} já possui o cargo ${role.name}.`,
                    ephemeral: true
                });
            }

            // Verificar se o bot tem permissão para gerenciar o cargo
            const botMember = interaction.guild.members.me;
            if (role.position >= botMember.roles.highest.position) {
                return await interaction.reply({
                    content: `Não posso adicionar o cargo ${role.name} pois ele está acima da minha hierarquia.`,
                    ephemeral: true
                });
            }

            // Verificar se o moderador tem permissão para gerenciar o cargo
            if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
                return await interaction.reply({
                    content: `Você não tem permissão para adicionar o cargo ${role.name} pois ele está acima da sua hierarquia.`,
                    ephemeral: true
                });
            }

            // Adicionar o cargo ao membro
            await member.roles.add(role, `Cargo adicionado por ${moderator.tag} - Motivo: ${reason}`);

            // Resposta de sucesso
            await interaction.reply({
                content: `Cargo ${role.name} adicionado com sucesso ao usuário ${user.mention}!`,
                ephemeral: false
            });

            // Log da ação
            try {
                await logAction(interaction.guild, {
                    action: 'Cargo Adicionado',
                    moderator: moderator,
                    target: user,
                    reason: reason,
                    details: `Cargo: ${role.name}`
                });
            } catch (logError) {
                console.error('Erro ao registrar log:', logError);
            }

        } catch (error) {
            console.error('Erro ao adicionar cargo:', error);
            
            if (error.code === 50013) {
                await interaction.reply({
                    content: 'Não tenho permissões suficientes para adicionar este cargo.',
                    ephemeral: true
                });
            } else if (error.code === 10007) {
                await interaction.reply({
                    content: 'Usuário não encontrado no servidor.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'Ocorreu um erro ao tentar adicionar o cargo. Tente novamente.',
                    ephemeral: true
                });
            }
        }
    }
};