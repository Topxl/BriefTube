import { founderEmail, p, signature } from "@/lib/mail/founder-email";

export function AnnouncementEmail(): string {
  return founderEmail(
    `${
      p("Hey,") +
      p(
        "I wanted to reach out personally. We just shipped a few things I think you'll find useful.",
      ) +
      p(
        "You can now receive your BriefTube summaries directly in <strong>Discord</strong> or <strong>Slack</strong>. One click to connect, no setup needed. If you're already using one of those for work or personal stuff, your audio summaries will land there automatically whenever a channel you follow posts a new video.",
      ) +
      p(
        "We also added a personal <strong>RSS podcast feed</strong>. You get a private URL you can drop into any podcast app (Overcast, Pocket Casts, Apple Podcasts, whatever you use) and your BriefTube summaries show up as episodes.",
      ) +
      p(
        "To connect Discord or Slack, or to grab your RSS feed, just go here: <a href='https://www.brief-tube.com/dashboard/profile' style='color:#1a1a1a;'>brief-tube.com/dashboard/profile</a>",
      ) +
      p(
        "As always, if anything feels off or you have a feature request, just hit reply. I read everything.",
      ) +
      signature()
    }<p style="margin:32px 0 0;font-size:12px;color:#999999;"><a href="https://www.brief-tube.com/dashboard/profile" style="color:#999999;">Unsubscribe</a></p>`,
  );
}
