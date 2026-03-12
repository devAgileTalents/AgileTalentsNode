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
