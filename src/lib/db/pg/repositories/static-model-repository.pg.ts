import { pgDb } from '../db.pg';
import { staticModels } from '../schema.pg';
import { eq, and } from 'drizzle-orm';

export const staticModelRepository = {
  async getByName(name: string, userId: string) {
    const [result] = await pgDb.select().from(staticModels)
      .where(and(
        eq(staticModels.name, name),
        eq(staticModels.userId, userId)
      ));
    return result;
  },
  async insert(model: { name: string; apiKey: string; userId: string }) {
    const [result] = await pgDb.insert(staticModels).values({
      name: model.name,
      apiKey: model.apiKey,
      userId: model.userId,
    }).returning();
    return result;
  },

  async upsert(model: { name: string; apiKey: string; userId: string }) {
    const [existing] = await pgDb.select().from(staticModels)
      .where(and(
        eq(staticModels.name, model.name),
        eq(staticModels.userId, model.userId)
      ));
    if (existing) {
      const [updated] = await pgDb.update(staticModels)
        .set({ apiKey: model.apiKey })
        .where(eq(staticModels.id, existing.id))
        .returning();
      return updated;
    } else {
      return this.insert(model);
    }
  },

  async findByUser(userId: string) {
    return pgDb.select().from(staticModels).where(eq(staticModels.userId, userId));
  },

  async findById(id: string) {
    const [result] = await pgDb.select().from(staticModels).where(eq(staticModels.id, id));
    return result;
  },

  async update(id: string, data: Partial<{ name: string; apiKey: string }>) {
    const [result] = await pgDb.update(staticModels).set(data).where(eq(staticModels.id, id)).returning();
    return result;
  },

  async delete(id: string) {
    await pgDb.delete(staticModels).where(eq(staticModels.id, id));
  },
};
