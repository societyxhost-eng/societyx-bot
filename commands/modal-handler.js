const { toast, EPHEMERAL_FLAG } = require('../utils/toast');
const { resolveUser } = require('../utils/resolveUser');
const warnCommand = require('../commands/warn');
const kickCommand = require('../commands/kick');
const banCommand = require('../commands/ban');
const punirCommand = require('../commands/punir');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('staff_modal_')) return;

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: EPHEMERAL_FLAG });
      }
    } catch (err) {
      console.warn('[modal-handler] Não foi possível deferReply no modal submit:', err.message);
    }

    function extractPanelIdFromCustomId(customId) {
      const parts = customId.split('_');
      const last = parts[parts.length - 1];
      if (/^\d{16,22}$/.test(last)) return last;
      const m = customId.match(/_(\d{16,22})$/);
      return m ? m[1] : null;
    }

    async function notifyPanelResume(panelId) {
      if (!panelId) {
        console.warn('[modal-handler] notifyPanelResume chamado sem panelId');
        return;
      }

      try {
        const menuStaff = require('../commands/menu-staff');
        if (menuStaff && typeof menuStaff.resumePanelTimer === 'function') {
          menuStaff.resumePanelTimer(panelId);
          console.log(`[modal-handler] resumePanelTimer chamado para panelId=${panelId}`);
          return;
        }
        console.warn('[modal-handler] menu-staff.resumePanelTimer não encontrado no require');
      } catch (err) {
        console.warn('[modal-handler] erro ao require menu-staff:', err.message);
      }
    }

    if (!interaction.customId.startsWith('staff_modal_quick_')) {
      const action = interaction.customId.replace('staff_modal_', '').split('_')[0];

      let userInput = '';
      let reasonInput = 'Sem motivo';
      let durationInput = null;

      try { userInput = interaction.fields.getTextInputValue('target_user')?.trim(); } catch {}
      try { reasonInput = (interaction.fields.getTextInputValue('reason') || 'Sem motivo').trim(); } catch {}
      try { durationInput = interaction.fields.getTextInputValue('duration')?.trim() || null; } catch {}

      let targetUser = null;
      try { targetUser = await resolveUser(interaction.guild, userInput); } catch (err) {
        console.warn('[modal-handler] resolveUser erro:', err.message);
      }

      if (!targetUser) {
        await toast(interaction, '❌ Usuário não encontrado. Verifique o ID/menção e se está no servidor.');
        const panelId = extractPanelIdFromCustomId(interaction.customId);
        if (panelId) await notifyPanelResume(panelId);
        return;
      }

      try {
        switch (action) {
          case 'warn':
            await warnCommand.execute(interaction, client, targetUser, null, reasonInput);
            break;

          case 'kick':
            await kickCommand.execute(interaction, client, targetUser, reasonInput);
            break;

          case 'ban':
            await banCommand.execute(interaction, client, targetUser, reasonInput);
            break;

          case 'punir':
            await punirCommand.execute(interaction, client, targetUser, durationInput, reasonInput);
            break;

          default:
            await toast(interaction, '❌ Ação inválida.');
        }
      } catch (err) {
        console.error(`[modal-handler] Erro ao executar a ação '${action}':`, err);
        await toast(interaction, '❌ Ocorreu um erro ao executar a ação.');
      }

      try {
        const panelId = extractPanelIdFromCustomId(interaction.customId);
        if (panelId) await notifyPanelResume(panelId);
      } catch (err) {
        console.warn('[modal-handler] Erro ao extrair/notificar panelId (por id):', err.message);
      }

      return;
    }

    if (interaction.customId.startsWith('staff_modal_quick_')) {
      const parts = interaction.customId.replace('staff_modal_quick_', '').split('_');
      const action = parts[0];
      const userId = parts[1];

      let reasonInput = 'Sem motivo';
      let durationInput = null;

      try { reasonInput = (interaction.fields.getTextInputValue('reason') || 'Sem motivo').trim(); } catch {}
      try { durationInput = interaction.fields.getTextInputValue('duration')?.trim() || null; } catch {}

      let targetUser = null;
      try { targetUser = await resolveUser(interaction.guild, userId); } catch (err) {
        console.warn('[modal-handler] resolveUser (quick) erro:', err.message);
      }

      if (!targetUser) {
        await toast(interaction, '❌ Usuário não encontrado (fluxo rápido).');
        const panelId = extractPanelIdFromCustomId(interaction.customId);
        if (panelId) await notifyPanelResume(panelId);
        return;
      }

      try {
        switch (action) {
          case 'warn':
            await warnCommand.execute(interaction, client, targetUser, null, reasonInput);
            await toast(interaction, `✅ Aviso aplicado em <@${userId}> — ${reasonInput}`);
            break;

          case 'kick':
            await kickCommand.execute(interaction, client, targetUser, reasonInput);
            await toast(interaction, `✅ Usuário expulsado: <@${userId}> — ${reasonInput}`);
            break;

          case 'ban':
            await banCommand.execute(interaction, client, targetUser, reasonInput);
            await toast(interaction, `✅ Usuário banido: <@${userId}> — ${reasonInput}`);
            break;

          case 'punir':
            if (!durationInput) {
              await toast(interaction, '❌ Duração não informada para silenciar.');
            } else {
              await punirCommand.execute(interaction, client, targetUser, durationInput, reasonInput);
              await toast(interaction, `✅ Usuário silenciado: <@${userId}> — ${reasonInput} (${durationInput})`);
            }
            break;

          default:
            await toast(interaction, '❌ Ação inválida (fluxo rápido).');
        }
      } catch (err) {
        console.error(`[modal-handler] Erro ao executar a ação rápida '${action}':`, err);
        await toast(interaction, '❌ Ocorreu um erro ao executar a ação.');
      }

      try {
        const panelId = extractPanelIdFromCustomId(interaction.customId);
        if (panelId) await notifyPanelResume(panelId);
      } catch (err) {
        console.warn('[modal-handler] Erro ao extrair/notificar panelId (quick):', err.message);
      }

      return;
    }
  });
};