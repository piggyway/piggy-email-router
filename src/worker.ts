interface Env {
  FORWARD_TO: string;
}

export default {
  async email(message, env, ctx) {
    const recipients = env.FORWARD_TO.split(",")
      .map((address) => address.trim())
      .filter((address) => address.length > 0);

    if (recipients.length === 0) {
      throw new Error("FORWARD_TO contains no recipient addresses");
    }

    await Promise.all(recipients.map((to) => message.forward(to)));
  },
} satisfies ExportedHandler<Env>;
