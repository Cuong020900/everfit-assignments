import { DataSource, DeepPartial } from 'typeorm';

/**
 * Base repository providing common query patterns shared across all repositories.
 * Each feature module extends this and passes its entity class + dataSource.
 */
export class BaseRepository<T> {
  protected constructor(
    protected readonly target: new () => T,
    protected readonly dataSource: DataSource,
  ) {}

  protected get manager() {
    return this.dataSource.createEntityManager();
  }

  /**
   * Upsert: insert if not exists, update if exists.
   * Uses ON CONFLICT DO UPDATE for PostgreSQL.
   */
  async upsert(entities: DeepPartial<T>[], conflictColumns: (keyof T)[]): Promise<T[]> {
    if (entities.length === 0) return [];
    return this.manager
      .createQueryBuilder()
      .insert()
      .into(this.target)
      .values(entities as DeepPartial<T>[])
      .orUpdate(conflictColumns.map(String), conflictColumns.map(String))
      .returning('*')
      .execute()
      .then((result) => result.generatedMaps as T[]);
  }

  /**
   * Hard-delete by id. Returns true if a row was deleted.
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.manager.delete(this.target, { id } as Record<string, unknown>);
    return (result.affected ?? 0) > 0;
  }
}
