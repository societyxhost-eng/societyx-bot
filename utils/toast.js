const { Routes } = require('discord.js');

const EPHEMERAL_FLAG = 1 << 6;

function getWebhookDeleteRoute(interaction, msg) {
  const applicationId = interaction?.applicationId || interaction?.client?.application?.id;
  const token = interaction?.token;
  const messageId = msg?.id;
  if (!applicationId || !token || !messageId) return null;
  return Routes.webhookMessage(applicationId, token, messageId);
}

async function deleteFollowupPrecisely(interaction, msg) {
  try {
    const route = getWebhookDeleteRoute(interaction, msg);
    if (!route) return false;
    await interaction.client.rest.delete(route);
    return true;
  } catch {
    return false;
  }
}

async function toast(interaction, payload, ms = 5000) {
  const options = typeof payload === 'string'
    ? { content: payload, ephemeral: true }
    : { ...payload, ephemeral: true };

  try {
    const msg = await interaction.followUp(options);

    setTimeout(async () => {
      if (await deleteFollowupPrecisely(interaction, msg)) return;

      try {
        if (msg && typeof msg.delete === 'function') {
          await msg.delete();
          return;
        }
      } catch {}

      try {
        await interaction.deleteReply();
      } catch {}
    }, ms);

    return msg;
  } catch {
    return null;
  }
}

async function toastSmart(interaction, payload, ms = 5000) {
  const options = typeof payload === 'string'
    ? { content: payload, ephemeral: true }
    : { ...payload, ephemeral: true };

  if (!interaction.deferred && !interaction.replied) {
    try {
      const msg = await interaction.reply(options);
      setTimeout(async () => {
        if (await deleteFollowupPrecisely(interaction, msg)) return;
        try {
          if (msg && typeof msg.delete === 'function') {
            await msg.delete();
            return;
          }
        } catch {}
        try {
          await interaction.deleteReply();
        } catch {}
      }, ms);
      return msg;
    } catch {
    }
  }
  try {
    const msg = await interaction.followUp(options);
    setTimeout(async () => {
      if (await deleteFollowupPrecisely(interaction, msg)) return;
      try {
        if (msg && typeof msg.delete === 'function') {
          await msg.delete();
          return;
        }
      } catch {}
      try {
        await interaction.deleteReply();
      } catch {}
    }, ms);
    return msg;
  } catch {
    return null;
  }
}

module.exports = { toast, toastSmart, EPHEMERAL_FLAG };