const { createCanvas, loadImage } = require("canvas");
const canvacord = require("canvacord");
const Discord = require("discord.js");
const SQLite = require("better-sqlite3");
const sql = new SQLite("./mainDB.sqlite");
const client = new Discord.Client();
const { join } = require("path");

module.exports = {
  name: "rank",
  aliases: ["rank"],
  description: "Check users rank and xp",
  cooldown: 3,
  category: "Leveling",
  async execute(message, args) {
    let userArray = message.content.split(" ");
    let userArgs = userArray.slice(1);
    let user =
      message.mentions.members.first() ||
      message.guild.members.cache.get(userArgs[0]) ||
      message.guild.members.cache.find(
        x =>
          x.user.username.toLowerCase() === userArgs.slice(0).join(" ") ||
          x.user.username === userArgs[0]
      ) ||
      message.member;

    client.getScore = sql.prepare(
      "SELECT * FROM levels WHERE user = ? AND guild = ?"
    );
    client.setScore = sql.prepare(
      "INSERT OR REPLACE INTO levels (id, user, guild, xp, level, totalXP) VALUES (@id, @user, @guild, @xp, @level, @totalXP);"
    );
    const top10 = sql
      .prepare("SELECT * FROM levels WHERE guild = ? ORDER BY totalXP")
      .all(message.guild.id);
    let score = client.getScore.get(user.id, message.guild.id);
    if (!score) {
      return message.reply(`This user does not have an xp yet!`);
    }
    const levelInfo = score.level;
    const nextXP = levelInfo * 2 * 250 + 250;
    const xpInfo = score.xp;
    const totalXP = score.totalXP;
    let rank = top10.sort((a, b) => {
      return b.totalXP - a.totalXP;
    });
    let ranking = rank.map(x => x.totalXP).indexOf(totalXP) + 1;
    if (!message.guild.me.hasPermission("ATTACH_FILES"))
      return message.reply(
        `**Missing Permission**: ATTACH_FILES or MESSAGE ATTACHMENTS`
      );

    let result = Math.floor(Math.random() * replies.length);
    const canvas = createCanvas(1000, 333);
    const background = await loadImage(`${replies[result]}`);
    const card = new canvacord.Rank()
    .setUsername(user.username)
    .setDiscriminator(user.discriminator)
    .setRank(rank)
    .setLevel(levelInfo)
    .setCurrentXP(xpInfo)
    .setRequiredXP(nextXP)
    .setStatus(user.presence.status)
    .setAvatar(user.displayAvatarURL({ format: "png", size: 1024 }));
    
    const img = await card.build();
  
  return message.channel.send(new MessageAttachment(img, "rank.png"));
  }
};
