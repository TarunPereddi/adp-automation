import { MongoClient, type Db } from 'mongodb';

export class DatabaseClient {
  readonly client: MongoClient;
  private db?: Db;

  constructor(
    uri: string,
    private readonly databaseName: string,
  ) {
    this.client = new MongoClient(uri, {
      appName: 'adp-automation',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  async connect(): Promise<Db> {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
    }
    return this.db;
  }

  async ping(): Promise<boolean> {
    const db = await this.connect();
    await db.command({ ping: 1 });
    return true;
  }

  async close(): Promise<void> {
    await this.client.close();
    this.db = undefined;
  }
}
