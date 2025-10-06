async function resolveUser(guild, input) {
    if (!input) return null;

    const id = input.replace(/\D/g, '');

    try {
        const member = await guild.members.fetch(id);
        return member.user; 
    } catch {
        return null;
    }
}

module.exports = { resolveUser };
