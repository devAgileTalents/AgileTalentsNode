import { pool } from '../index';
import {
  HubUserDB,
  HubLoggedHourDB,
  HubAdditionalCostDB,
  HubInvoiceDB,
  HubProjectRateDB,
  SqlParam,
} from '../../types/db.types';
import {
  HubUserResponse,
  HubUserLoggedHour,
  HubUserAdditionalCost,
  HubUserInvoice,
  HubUserFilters,
} from '../../types/types';
import { handleRepositoryError } from '../../lib/errors/repository-error';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function transformLoggedHour(db: HubLoggedHourDB): HubUserLoggedHour {
  return {
    id: db.id,
    date: formatDate(db.date),
    hours: Number(db.hours),
    task: db.task,
    projectId: db.project_id,
  };
}

function transformAdditionalCost(db: HubAdditionalCostDB): HubUserAdditionalCost {
  return {
    projectId: db.project_id,
    month: db.month,
    amount: Number(db.amount),
    description: db.description,
  };
}

function transformInvoice(db: HubInvoiceDB): HubUserInvoice {
  return {
    id: db.id,
    projectId: db.project_id,
    month: db.month,
    generatedAt: db.generated_at.toISOString(),
    hours: Number(db.hours),
    hourlyRate: Number(db.hourly_rate),
    additionalCost: Number(db.additional_cost),
    total: Number(db.total),
  };
}

function transformUser(
  db: HubUserDB,
  loggedHours: HubUserLoggedHour[] = [],
  additionalCosts: HubUserAdditionalCost[] = [],
  invoices: HubUserInvoice[] = [],
  projectRates: { projectId: number; hourlyRate: number }[] = [],
): HubUserResponse {
  const result: HubUserResponse = {
    id: db.id,
    name: db.name,
    title: db.title,
    role: db.role,
    email: db.email,
    status: db.status,
    loggedHours,
    additionalCosts,
    invoices,
  };

  if (db.photo) result.photo = db.photo;
  if (db.company) result.company = db.company;
  if (db.hourly_rate != null) result.hourlyRate = Number(db.hourly_rate);
  if (db.invoice_email) result.invoiceEmail = db.invoice_email;
  if (db.last_seen) result.lastSeen = db.last_seen.toISOString();
  if (projectRates.length) result.projectRates = projectRates;

  // address
  if (db.street_address || db.city || db.postal_code || db.region || db.country) {
    result.address = {};
    if (db.street_address) result.address.streetAddress = db.street_address;
    if (db.city) result.address.city = db.city;
    if (db.postal_code) result.address.postalCode = db.postal_code;
    if (db.region) result.address.region = db.region;
    if (db.country) result.address.country = db.country;
  }

  // banking
  if (db.account_holder_name || db.bank_name || db.iban || db.swift) {
    result.bankingInfo = {};
    if (db.account_holder_name) result.bankingInfo.accountHolderName = db.account_holder_name;
    if (db.bank_name) result.bankingInfo.bankName = db.bank_name;
    if (db.bank_country) result.bankingInfo.bankCountry = db.bank_country;
    if (db.bank_address) result.bankingInfo.bankAddress = db.bank_address;
    if (db.iban) result.bankingInfo.iban = db.iban;
    if (db.swift) result.bankingInfo.swift = db.swift;
    if (db.account_number) result.bankingInfo.accountNumber = db.account_number;
    if (db.routing_number) result.bankingInfo.routingNumber = db.routing_number;
    if (db.currency) result.bankingInfo.currency = db.currency;
    if (db.payment_method) result.bankingInfo.paymentMethod = db.payment_method;
  }

  // legal
  if (db.legal_name || db.legal_address || db.tax_id || db.vat_id || db.registration_number) {
    result.legalInfo = {};
    if (db.legal_name) result.legalInfo.legalName = db.legal_name;
    if (db.legal_address) result.legalInfo.legalAddress = db.legal_address;
    if (db.registration_number) result.legalInfo.registrationNumber = db.registration_number;
    if (db.vat_id) result.legalInfo.vatId = db.vat_id;
    if (db.tax_id) result.legalInfo.taxId = db.tax_id;
  }

  return result;
}

async function loadUserRelations(userId: number) {
  const [hoursRes, costsRes, invoicesRes, ratesRes] = await Promise.all([
    pool.query<HubLoggedHourDB>('SELECT * FROM hub_logged_hours WHERE user_id = $1 ORDER BY date', [userId]),
    pool.query<HubAdditionalCostDB>('SELECT * FROM hub_additional_costs WHERE user_id = $1 ORDER BY month', [userId]),
    pool.query<HubInvoiceDB>('SELECT * FROM hub_invoices WHERE user_id = $1 ORDER BY month', [userId]),
    pool.query<HubProjectRateDB>('SELECT * FROM hub_project_rates WHERE user_id = $1', [userId]),
  ]);

  return {
    loggedHours: hoursRes.rows.map(transformLoggedHour),
    additionalCosts: costsRes.rows.map(transformAdditionalCost),
    invoices: invoicesRes.rows.map(transformInvoice),
    projectRates: ratesRes.rows.map((r) => ({ projectId: r.project_id, hourlyRate: Number(r.hourly_rate) })),
  };
}

// ── LIST ──────────────────────────────────────────────────
export const getHubUsers = async (
  page: number,
  limit: number,
  filters?: HubUserFilters,
): Promise<{ data: HubUserResponse[]; total: number }> => {
  try {
    const offset = (page - 1) * limit;
    const params: SqlParam[] = [];
    const whereParts: string[] = [];

    if (filters?.search) {
      params.push(`%${filters.search}%`);
      const p = `$${params.length}`;
      whereParts.push(`(name ILIKE ${p} OR email ILIKE ${p} OR title ILIKE ${p})`);
    }
    if (filters?.role) {
      params.push(filters.role);
      whereParts.push(`role = $${params.length}`);
    }
    if (filters?.status) {
      params.push(filters.status);
      whereParts.push(`status = $${params.length}`);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    params.push(limit);
    const limitP = `$${params.length}`;
    params.push(offset);
    const offsetP = `$${params.length}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query<HubUserDB>(
        `SELECT * FROM hub_users ${whereClause} ORDER BY id LIMIT ${limitP} OFFSET ${offsetP}`,
        params,
      ),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM hub_users ${whereClause}`,
        params.slice(0, -2),
      ),
    ]);

    const users: HubUserResponse[] = [];
    for (const row of dataRes.rows) {
      const relations = await loadUserRelations(row.id);
      users.push(
        transformUser(row, relations.loggedHours, relations.additionalCosts, relations.invoices, relations.projectRates),
      );
    }

    return { data: users, total: countRes.rows[0]?.total ?? 0 };
  } catch (error) {
    handleRepositoryError('getHubUsers', error);
  }
};

// ── GET ALL (no pagination, for internal use) ─────────────
export const getAllHubUsers = async (): Promise<HubUserResponse[]> => {
  try {
    const dataRes = await pool.query<HubUserDB>('SELECT * FROM hub_users ORDER BY id');

    const users: HubUserResponse[] = [];
    for (const row of dataRes.rows) {
      const relations = await loadUserRelations(row.id);
      users.push(
        transformUser(row, relations.loggedHours, relations.additionalCosts, relations.invoices, relations.projectRates),
      );
    }
    return users;
  } catch (error) {
    handleRepositoryError('getAllHubUsers', error);
  }
};

// ── GET BY ID ─────────────────────────────────────────────
export const getHubUserById = async (id: number): Promise<HubUserResponse | null> => {
  try {
    const res = await pool.query<HubUserDB>('SELECT * FROM hub_users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;

    const relations = await loadUserRelations(id);
    return transformUser(res.rows[0], relations.loggedHours, relations.additionalCosts, relations.invoices, relations.projectRates);
  } catch (error) {
    handleRepositoryError('getHubUserById', error);
  }
};

// ── CREATE ────────────────────────────────────────────────
export const createHubUser = async (data: any): Promise<HubUserResponse> => {
  try {
    const res = await pool.query<HubUserDB>(
      `INSERT INTO hub_users (name, photo, title, company, hourly_rate, role, email, invoice_email, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        data.name,
        data.photo ?? null,
        data.title ?? '',
        data.company ?? null,
        data.hourlyRate ?? null,
        data.role,
        data.email,
        data.invoiceEmail ?? null,
        data.status ?? 'Active',
      ],
    );
    return transformUser(res.rows[0]);
  } catch (error) {
    handleRepositoryError('createHubUser', error);
  }
};

// ── UPDATE ────────────────────────────────────────────────
export const updateHubUser = async (id: number, data: any): Promise<HubUserResponse | null> => {
  try {
    const fields: string[] = [];
    const values: SqlParam[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      name: 'name', photo: 'photo', title: 'title', company: 'company',
      hourlyRate: 'hourly_rate', role: 'role', email: 'email',
      invoiceEmail: 'invoice_email', status: 'status', lastSeen: 'last_seen',
      // address
      streetAddress: 'street_address', city: 'city', postalCode: 'postal_code',
      region: 'region', country: 'country',
      // banking
      accountHolderName: 'account_holder_name', bankName: 'bank_name',
      bankCountry: 'bank_country', bankAddress: 'bank_address',
      iban: 'iban', swift: 'swift', accountNumber: 'account_number',
      routingNumber: 'routing_number', currency: 'currency', paymentMethod: 'payment_method',
      // legal
      legalName: 'legal_name', legalAddress: 'legal_address',
      registrationNumber: 'registration_number', vatId: 'vat_id', taxId: 'tax_id',
    };

    // Flatten nested objects (address, bankingInfo, legalInfo)
    const flat: Record<string, any> = { ...data };
    if (data.address) { Object.assign(flat, data.address); delete flat.address; }
    if (data.bankingInfo) { Object.assign(flat, data.bankingInfo); delete flat.bankingInfo; }
    if (data.legalInfo) { Object.assign(flat, data.legalInfo); delete flat.legalInfo; }

    for (const [key, col] of Object.entries(map)) {
      if (flat[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(flat[key]);
      }
    }

    if (fields.length === 0) return await getHubUserById(id);

    values.push(id);
    const res = await pool.query<HubUserDB>(
      `UPDATE hub_users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (res.rows.length === 0) return null;

    const relations = await loadUserRelations(id);
    return transformUser(res.rows[0], relations.loggedHours, relations.additionalCosts, relations.invoices, relations.projectRates);
  } catch (error) {
    handleRepositoryError('updateHubUser', error);
  }
};

// ── DELETE ────────────────────────────────────────────────
export const deleteHubUser = async (id: number): Promise<boolean> => {
  try {
    const res = await pool.query('DELETE FROM hub_users WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    handleRepositoryError('deleteHubUser', error);
  }
};
