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