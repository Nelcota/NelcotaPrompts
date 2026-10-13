import { eq } from "drizzle-orm";

import { getDb } from "~/shared/server/db.server";
import { userAvatars } from "~/shared/server/db/schema";
import type { ImageType } from "~/shared/server/image.server";
import { type StoredImage, versionedUrl } from "~/shared/server/stored-image.server";

export function avatarUrl(userId: string, version: Date | null): string | null {
  return versionedUrl(`/avatar/${userId}`, version);
}

export async function saveAvatar(userId: string, type: ImageType, bytes: Uint8Array) {
  const values = { contentType: type, data: bytes, byteSize: bytes.byteLength, updatedAt: new Date() };

  await getDb()
    .insert(userAvatars)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userAvatars.userId, set: values });
}

export async function deleteAvatar(userId: string) {
  await getDb().delete(userAvatars).where(eq(userAvatars.userId, userId));
}

export async function loadAvatar(userId: string): Promise<StoredImage | null> {
  const [row] = await getDb()
    .select({ contentType: userAvatars.contentType, data: userAvatars.data, updatedAt: userAvatars.updatedAt })
    .from(userAvatars)
    .where(eq(userAvatars.userId, userId));

  return row ?? null;
}
