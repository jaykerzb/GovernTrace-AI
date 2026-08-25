import { prisma } from "../lib/prisma.js";

const SINGLETON_ID = "singleton";

export async function getEmailSettings() {
  return prisma.emailSettings.upsert({ where: { id: SINGLETON_ID }, update: {}, create: { id: SINGLETON_ID } });
}

export async function updateEmailSettings(data: {
  provider?: string;
  fromName?: string;
  fromAddress?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPassword?: string;
  apiKey?: string;
}) {
  await getEmailSettings();
  return prisma.emailSettings.update({ where: { id: SINGLETON_ID }, data });
}
