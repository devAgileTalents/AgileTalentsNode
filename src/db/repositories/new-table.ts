import { pool } from '../index';

type NewTableColumn = {
  name: string;
  type: 'text' | 'int' | 'bigint' | 'boolean' | 'timestamptz' | 'date' | 'jsonb' | 'uuid';
  nullable: boolean;
};

const ALLOWED_TYPES = new Set<NewTableColumn['type']>([
  'text',
  'int',
  'bigint',
  'boolean',
  'timestamptz',
  'date',
  'jsonb',
  'uuid',
]);

function isSafeIdentifier(s: string) {
  return /^[a-z][a-z0-9_]{0,62}$/.test(s);
}

function qIdent(ident: string) {
  return `"${ident}"`;
}

export async function createNewTable(params: {
  tableName: string;
  columns: NewTableColumn[];
}): Promise<{ tableName: string }> {
  const { tableName, columns } = params;

  if (!isSafeIdentifier(tableName)) {
    throw new Error('Invalid tableName');
  }
  if (!Array.isArray(columns) || columns.length < 1) {
    throw new Error('Columns are required');
  }

  const seen = new Set<string>();
  for (const c of columns) {
    if (!isSafeIdentifier(c.name)) throw new Error(`Invalid column name: ${c.name}`);
    if (seen.has(c.name)) throw new Error(`Duplicate column: ${c.name}`);
    seen.add(c.name);

    if (!ALLOWED_TYPES.has(c.type)) throw new Error(`Type not allowed: ${c.type}`);
    if (typeof c.nullable !== 'boolean') throw new Error(`nullable must be boolean: ${c.name}`);
  }

  const colsSql = [
    `"id" bigserial PRIMARY KEY`,
    ...columns.map((c) => `${qIdent(c.name)} ${c.type}${c.nullable ? '' : ' NOT NULL'}`),
    `"created_at" timestamptz NOT NULL DEFAULT now()`,
  ].join(',\n  ');

  const createSql = `CREATE TABLE ${qIdent(tableName)} (\n  ${colsSql}\n);`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(createSql);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_tables (
        id bigserial PRIMARY KEY,
        table_name text UNIQUE NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(
      `INSERT INTO admin_tables (table_name) VALUES ($1) ON CONFLICT (table_name) DO NOTHING`,
      [tableName],
    );

    await client.query('COMMIT');
    return { tableName };
  } catch (e: any) {
    await client.query('ROLLBACK');

    if (e?.code === '42P07') {
      const err = new Error('Table already exists');
      // @ts-ignore
      err.status = 409;
      throw err;
    }

    throw e;
  } finally {
    client.release();
  }
}
