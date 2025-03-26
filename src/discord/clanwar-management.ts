import {
  Client,
  ChannelType,
  TextChannel,
  Events,
  ActionRowBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuBuilder,
  Guild,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  StringSelectMenuInteraction,
  PermissionFlagsBits,
} from "discord.js";
import create_clanwar from "./clanwar";
import { removeHexColors, msToTimeStr } from "@helpers/string";

const roles = process.env.DISCORD_CLANWAR_MANAGEMENT_ROLES?.split(",") || [];

async function find_clanwar_management_channel(
  guild: Guild
): Promise<TextChannel | undefined> {
  const channel = guild.channels.cache.find(
    (channel) => channel.name === "clanwars-management" && channel.isTextBased()
  );

  if (!channel || !(channel instanceof TextChannel)) {
    return create_clanwar_management_channel(guild);
  } else {
    return channel;
  }
}

async function create_clanwar_management_channel(
  guild: Guild
): Promise<TextChannel | undefined> {
  const channel = await guild.channels.create({
    name: "clanwars-management",
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...roles.map((role) => ({
        id: role,
        allow: [PermissionFlagsBits.ViewChannel],
      })),
    ],
  });

  return channel;
}

interface ToptimeCreated {
  mapName: string;
  position: number;
  playerName: string;
  time: number;
}

export default async function clanwar_management(client: Client) {
  const guild = client.guilds.cache.find(
    (guild) => guild.name === process.env.DISCORD_NAME
  );

  if (!guild) return;

  const channel = await find_clanwar_management_channel(guild);

  if (!channel) return;

  client.on(Events.MessageCreate, async (message) => {
    if (message.channelId !== channel.id) return;
    if (message.content === "!create") {
      await create_clanwar(guild, channel, message);
    } else if (message.content === "!delete") {
      const categories = guild.channels.cache.filter(
        (channel) =>
          channel.type === ChannelType.GuildCategory &&
          channel.name.toLocaleLowerCase().startsWith("cw")
      );

      if (!categories || categories.size === 0) {
        await channel.send("There are no categories to delete");
        return;
      }

      const category_options = categories.map((category) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(category.name)
          .setValue(category.id)
      );

      const select_menu = new StringSelectMenuBuilder()
        .setCustomId("delete_clanwar")
        .setPlaceholder("Select a category to delete")
        .addOptions(category_options);

      const action_row =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          select_menu
        );

      await channel.send({
        content: "Select a category from the list to delete:",
        components: [action_row],
      });
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction instanceof StringSelectMenuInteraction) {
      if (interaction.customId === "delete_clanwar") {
        const category = interaction.values[0];
        const category_channel = guild.channels.cache.get(category);

        if (
          !category_channel ||
          category_channel.type !== ChannelType.GuildCategory
        )
          return;

        category_channel.children.cache.forEach(async (channel) => {
          await channel.delete();
        });
        await category_channel.delete();
        await interaction.reply({
          content: `Category ${category_channel.name} deleted`,
        });
        await interaction.message.delete();
      }
    } else if (interaction instanceof ButtonInteraction) {
      if (interaction.customId === "register_clanwar") {
        const description =
          interaction.message.embeds[0].description || "No Players registered";

        const list =
          description === "No Players registered" ? [] : description.split(" ");

        if (list.includes(`<@${interaction.user.id}>`)) {
          await interaction.reply({
            content: "You're already registered!",
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder();
        embed.setTitle("Registered Players");
        if (!list || list.length === 0) {
          embed.setDescription(`<@${interaction.user.id}>`);
        } else {
          list.push(`<@${interaction.user.id}>`);
          embed.setDescription(list.join(" "));
        }

        const register_button = new ButtonBuilder()
          .setCustomId("register_clanwar")
          .setLabel("Register")
          .setStyle(ButtonStyle.Primary);

        const unregister_button = new ButtonBuilder()
          .setCustomId("unregister_clanwar")
          .setLabel("Unregister")
          .setStyle(ButtonStyle.Danger);

        const action_row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          register_button,
          unregister_button
        );

        await interaction.update({
          embeds: [embed],
          components: [action_row],
        });
      } else if (interaction.customId == "unregister_clanwar") {
        const description =
          interaction.message.embeds[0].description || "No Players registered";

        const list =
          description === "No Players registered" ? [] : description.split(" ");

        if (!list.includes(`<@${interaction.user.id}>`)) {
          await interaction.reply({
            content: "You're not in the list!",
            ephemeral: true,
          });
          return;
        }

        const index = list.indexOf(`<@${interaction.user.id}>`);
        if (index === -1) return;
        list.splice(index, 1);

        const embed = new EmbedBuilder();
        embed.setTitle("Registered Players");
        if (list.length === 0) {
          embed.setDescription("No Players registered");
        } else {
          embed.setDescription(list.join(" "));
        }

        const register_button = new ButtonBuilder()
          .setCustomId("register_clanwar")
          .setLabel("Register")
          .setStyle(ButtonStyle.Primary);

        const unregister_button = new ButtonBuilder()
          .setCustomId("unregister_clanwar")
          .setLabel("Unregister")
          .setStyle(ButtonStyle.Danger);

        const action_row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          register_button,
          unregister_button
        );

        await interaction.update({
          embeds: [embed],
          components: [action_row],
        });
      }
    }
  });

  client.on("ToptimeCreated", async (toptime: ToptimeCreated) => {
    const categories = guild.channels.cache.filter(
      (channel) =>
        channel.name.startsWith("CW ") &&
        channel.type === ChannelType.GuildCategory
    );

    for (const [_, category] of categories) {
      const toptime_channel = guild.channels.cache
        .filter((channel) => channel.parentId == category.id)
        .find((channel) => channel.name == "toptimes") as
        | TextChannel
        | undefined;

      if (!toptime_channel) continue;

      try {
        const messages = await toptime_channel.messages.fetch({ limit: 100 });

        const target_messages = messages.filter((msg) =>
          msg.embeds.some((embed) => embed.title === toptime.mapName)
        );

        for (const message of target_messages.values()) {
          const new_embeds = message.embeds.map((embed) => {
            if (embed.title !== toptime.mapName)
              return new EmbedBuilder(embed.toJSON());

            const new_fields = embed.fields.map((field, index) =>
              index === toptime.position - 1
                ? {
                    name: field.name,
                    value: `${removeHexColors(
                      toptime.playerName
                    )}, ${msToTimeStr(toptime.time)}`,
                    inline: field.inline,
                  }
                : field
            );

            return new EmbedBuilder(embed.toJSON()).setFields(new_fields);
          });

          await message.edit({ embeds: new_embeds });
        }
      } catch (err) {}
    }
  });
}
