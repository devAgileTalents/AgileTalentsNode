export type Freelancer = {
  id: number;
  imageUrl: string;
  fullName: string;
  profession: string;
  hourlyRate: number;
  experience: number;
  technologies: string[];
};

export type FreelancerFilters = {
  search?: string;
  name?: string;
  profession?: string;
  tech?: string;
  minRate?: number;
  maxRate?: number;
  minExp?: number;
};

export type Review = {
  id: number;
  rating: number;
  reviewerCompanyLogo: string;
  reviewText: string;
  reviewerPhoto: string;
  reviewerFullName: string;
  reviewerProfession: string;
  reviewTrustPilotLink: string;
};

export type ReviewFilters = {
  search?: string;
  rating?: number;
  reviewer?: string;
  text?: string;
};


export type BlogArticle = {
  id: number;
  imageArticleHref: string;
  title: string;
  description: string;
  photoAuthorHref: string;
  authorFullName: string;
  publishDate: string;
};

export type BlogArticleFilters = {
  search?: string;
  title?: string;
  author?: string;
  fromDate?: string;
  toDate?: string;
};

export type HubUser = {
  id: string;
  email: string;
  passwordHash: string;
  photo?: string;
  name: string;
  role?: string;
};

// ── Hub API types ─────────────────────────────────────────

export type HubUserLoggedHour = {
  id: number;
  date: string;
  hours: number;
  task: string;
  projectId: number;
};

export type HubUserAdditionalCost = {
  projectId: number;
  month: string;
  amount: number;
  description: string;
};

export type HubUserInvoice = {
  id: number;
  projectId: number;
  month: string;
  generatedAt: string;
  hours: number;
  hourlyRate: number;
  additionalCost: number;
  total: number;
};

export type HubUserAddress = {
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  region?: string;
  country?: string;
};

export type HubUserBankingInfo = {
  accountHolderName?: string;
  bankName?: string;
  bankCountry?: string;
  bankAddress?: string;
  iban?: string;
  swift?: string;
  accountNumber?: string;
  routingNumber?: string;
  currency?: string;
  paymentMethod?: string;
};

export type HubUserLegalInfo = {
  legalName?: string;
  legalAddress?: string;
  registrationNumber?: string;
  vatId?: string;
  taxId?: string;
};

export type HubUserResponse = {
  id: number;
  name: string;
  photo?: string;
  title: string;
  company?: string;
  hourlyRate?: number;
  role: string;
  email: string;
  invoiceEmail?: string;
  status: string;
  lastSeen?: string;
  loggedHours?: HubUserLoggedHour[];
  additionalCosts?: HubUserAdditionalCost[];
  invoices?: HubUserInvoice[];
  address?: HubUserAddress;
  bankingInfo?: HubUserBankingInfo;
  legalInfo?: HubUserLegalInfo;
  projectRates?: { projectId: number; hourlyRate: number }[];
};

export type HubProjectResponse = {
  id: number;
  name: string;
  clientId: number;
  title: string;
  startDate: string;
  endDate?: string;
  weeklyTarget: number;
  access: number[];
  contractedType: string;
  contractedHours?: number;
};

export type HubUserFilters = {
  search?: string;
  role?: string;
  status?: string;
};

export type HubProjectFilters = {
  search?: string;
  clientId?: number;
};