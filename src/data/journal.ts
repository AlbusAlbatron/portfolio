// The Journal follows the CareersLab professional portfolio structure (Week 1 slides, pages 18–23): seven sections,
// each with a purpose and the questions it reflects on. Entries live in src/content/journal/ and name their section
// by `slug`. Section 1 (About me) is the homepage itself, so it links there instead of having its own page.

export interface JournalSection {
  no: string;
  slug: string;
  title: string;
  /** One or two sentences, first person: what this section is for. */
  purpose: string;
  /** What I reflect on in this section (from the brief, reworded). */
  prompts: string[];
  /** Set for sections that live elsewhere on the site. */
  href?: string;
}

export const sections: JournalSection[] = [
  {
    no: '01',
    slug: 'about-me',
    title: 'About me',
    purpose: 'Who I am, what I can do and what I’m looking for. This section is the homepage.',
    prompts: ['How I stand out', 'How I present myself professionally'],
    href: '/',
  },
  {
    no: '02',
    slug: 'learn-more',
    title: 'Learn more',
    purpose: 'Who I am professionally: my strengths, my career interests and the three values I work by.',
    prompts: [
      'Why these values matter to me',
      'How they shape the way I work with others',
      'How they line up with where I want my career to go',
    ],
  },
  {
    no: '03',
    slug: 'what-i-learned-from-others',
    title: 'What I learned from others',
    purpose:
      'Reflections on the guest speakers and industry talks I’ve attended: what they said, what stuck with me, and how it shapes the decisions ahead of me.',
    prompts: [
      'The key messages from each speaker',
      'What surprised me',
      'What challenged my thinking',
      'How it might shape my career decisions',
    ],
  },
  {
    no: '04',
    slug: 'professional-and-industry',
    title: 'Professional & industry',
    purpose: 'Career Connect and my conversations with employers and industry representatives.',
    prompts: [
      'What I expected going in',
      'What I learned about employers and residency opportunities',
      'The conversations that stood out',
      'What I’ll do as a result',
    ],
  },
  {
    no: '05',
    slug: 'beyond-the-classroom',
    title: 'Beyond the classroom',
    purpose: 'What I contribute outside my degree: volunteering, societies, hackathons, mentoring and my community.',
    prompts: ['My contribution', 'The impact on others', 'The impact on my own development', 'The skills I gained'],
  },
  {
    no: '06',
    slug: 'how-i-developed-this-year',
    title: 'How I developed this year',
    purpose: 'How my projects, coursework and time with industry have moved me forward this year.',
    prompts: ['Projects and coursework', 'Industry engagement', 'How I’ve grown'],
  },
  {
    no: '07',
    slug: 'where-am-i-going-next',
    title: 'Where am I going next?',
    purpose: 'My personal development plan: where I want to get to, and the skills and experience I need on the way.',
    prompts: ['Where I want to be next', 'The skills I need to build', 'The steps I’ll take'],
  },
];

export const sectionSlugs = sections.map((s) => s.slug) as [string, ...string[]];

export const sectionBySlug = (slug: string) => sections.find((s) => s.slug === slug);
