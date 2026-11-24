// Public web CV. Never add phone numbers or referee contact details here — this page is public.

export interface CvEntry {
  org: string;
  role: string;
  dates: string;
  points: string[];
}

export interface CvItem {
  label: string;
  value: string;
}

export const profile = [
  'First-year Immersive Software Engineering student at the University of Limerick.',
  'Working in Java, Python and C, and looking for experience on real software projects.',
  'Hardworking and reliable, with part-time experience in busy, customer-facing jobs.',
];

export const education: CvEntry[] = [
  {
    org: 'University of Limerick',
    role: 'First Year — Immersive Software Engineering',
    dates: '2026 – Present',
    points: [],
  },
  {
    org: 'The High School, Clonmel',
    role: 'Leaving Certificate & Junior Cycle',
    dates: '2020 – 2026',
    points: [
      'Completed the Leaving Certificate with six Higher Level subjects.',
      'Achieved Higher Merits and Merits across all Junior Cycle subjects.',
    ],
  },
];

export const skills: CvItem[] = [
  { label: 'Languages', value: 'C, Java, Python, HTML/CSS' },
  { label: 'Tools', value: 'Git/GitHub, Linux environments' },
  { label: 'Key skills', value: 'Algorithmic problem-solving, object-oriented programming, version control' },
];

export const experience: CvEntry[] = [
  {
    org: 'Prior Park Service Station, Clonmel',
    role: 'Forecourt Attendant',
    dates: '2026 – Present',
    points: [
      'Working on a busy forecourt handling transactions, helping customers and making sure safety guidelines are followed.',
    ],
  },
  {
    org: 'CBS High School Clonmel',
    role: 'Exam Attendant',
    dates: 'Summer 2025',
    points: [
      'Helped with the smooth running of the State Examinations, making sure all exam rules and procedures were strictly followed.',
    ],
  },
  {
    org: 'Hotel Minella, Clonmel',
    role: 'Waiting and Cleaning',
    dates: 'Summer 2024',
    points: [
      'Worked as part of the hotel team serving customers, clearing tables and keeping dining areas clean during the busy summer season.',
    ],
  },
];

export const awards: CvItem[] = [
  { label: '2023', value: '3rd Year STEM Student of the Year, for results in science and maths.' },
];

/** Leadership, volunteering and sport. */
export const activities: CvItem[] = [
  { label: 'Student council', value: 'Elected to the Junior Student Council at The High School.' },
  { label: 'School events', value: 'Helped teachers and staff set up and run parent-teacher meetings.' },
  {
    label: 'Sport & coaching',
    value: 'School football and basketball teams; assistant coach for underage teams at Clonmel Commercials.',
  },
];

/** School work placements, listed under work experience. */
export const placements = [
  'St. Vincent de Paul',
  'Paws',
  "Bob Fitzgerald's Hardware",
  'Clonmel Garden Centre',
  'Eason Bookshop',
];

export const interests =
  'Coding in my spare time, practising algorithm problems, playing sport (currently American football with UL) and watching films.';
