export type FAQItem = { question: string; answer: string; category?: string };
export type Author = { slug: string; name: string; avatar?: string; bio?: string; credentials?: string[]; socials?: { label: string; url: string }[] };
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category?: string;
  authorSlug: string;
  publishedAt: string;
  updatedAt?: string;
  heroImage?: string;
  summary?: string;
  content: string;
};

export const authors: Author[] = [
  {
    slug: 'editorial-team',
    name: 'Editorial Team',
    bio: 'We research products and publish practical buying guides to help you shop with confidence.',
    credentials: ['Product research', 'Customer support insights'],
    socials: [{ label: 'Website', url: '/' }],
  },
];

export const faqs: FAQItem[] = [
  {
    category: 'Orders',
    question: 'How long does shipping take?',
    answer: 'Most orders ship within 1-2 business days. Typical delivery time is 5-12 business days depending on your location.',
  },
  {
    category: 'Returns',
    question: 'What is your return policy?',
    answer: 'We accept returns within 30 days of delivery. Items must be unused and in original packaging. Contact support to start a return.',
  },
  {
    category: 'Payments',
    question: 'Which payment methods do you accept?',
    answer: 'We support major credit cards and secure checkout options depending on your region.',
  },
];

export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-choose-the-right-product',
    title: 'How to Choose the Right Product (A Practical Checklist)',
    description: 'A quick guide to evaluate features, fit, and value before you buy.',
    category: 'Guides',
    authorSlug: 'editorial-team',
    publishedAt: '2025-01-05T10:00:00.000Z',
    updatedAt: '2025-02-01T10:00:00.000Z',
    summary: 'Use this checklist to compare specs, prioritize must-have features, and avoid overpaying for unnecessary extras.',
    content: `## 1. Start with your use case\n\nDefine where and how you will use the product.\n\n## 2. Compare key specs\n\nFocus on the few specs that actually affect real-world usage.\n\n## 3. Validate with reviews\n\nLook for consistent feedback patterns across multiple sources.\n\n## 4. Check return and warranty\n\nA clear policy reduces purchase risk.`,
  },
];

export function getAuthor(slug: string): Author | undefined {
  return authors.find((a) => a.slug === slug);
}

export function getPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
