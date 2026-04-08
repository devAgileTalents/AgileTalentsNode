export type FreelancerDB = {
  id: number;
  image_url: string;
  full_name: string;
  profession: string;
  hourly_rate: number;
  experience: number;
  technologies: string[];
  created_at?: Date;
};

export type ReviewDB = {
  id: number;
  rating: number;
  reviewer_company_logo: string;
  review_text: string;
  reviewer_photo: string;
  reviewer_full_name: string;
  reviewer_profession: string;
  review_trustpilot_link: string;
  created_at?: Date;
};

export type BlogArticleDB = {
  id: number;
  image_article_href: string;
  title: string;
  description: string;
  photo_author_href: string;
  author_full_name: string;
  publish_date: Date;
  created_at?: Date;
};

// ── Hub DB types ──────────────────────────────────────────

export type HubUserDB = {
  id: number;
  name: string;
  photo: string | null;
  title: string;
  company: string | null;
  hourly_rate: number | null;
  role: string;
  email: string;
  invoice_email: string | null;
  status: string;
  last_seen: Date | null;
  // address
  street_address: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  country: string | null;
  // banking
  account_holder_name: string | null;
  bank_name: string | null;
  bank_country: string | null;
  bank_address: string | null;
  iban: string | null;
  swift: string | null;
  account_number: string | null;
  routing_number: string | null;
  currency: string | null;
  payment_method: string | null;
  // legal
  legal_name: string | null;
  legal_address: string | null;
  registration_number: string | null;
  vat_id: string | null;
  tax_id: string | null;
  created_at?: Date;
};

export type HubProjectDB = {
  id: number;
  name: string;
  client_id: number;
  title: string;
  start_date: Date;
  end_date: Date | null;
  weekly_target: number;
  contracted_type: string;
  contracted_hours: number | null;
  created_at?: Date;
};

export type HubLoggedHourDB = {
  id: number;
  user_id: number;
  project_id: number;
  date: Date;
  hours: number;
  task: string;
  created_at?: Date;
};

export type HubAdditionalCostDB = {
  id: number;
  user_id: number;
  project_id: number;
  month: string;
  amount: number;
  description: string;
  created_at?: Date;
};

export type HubInvoiceDB = {
  id: number;
  user_id: number;
  project_id: number;
  month: string;
  generated_at: Date;
  hours: number;
  hourly_rate: number;
  additional_cost: number;
  total: number;
  created_at?: Date;
};

export type HubProjectRateDB = {
  id: number;
  user_id: number;
  project_id: number;
  hourly_rate: number;
};

export type SqlParam =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | string[]
  | number[]
  | boolean[]
  | Date[];
