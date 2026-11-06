// Public web CV. Never add phone numbers or referee contact details here — this page is public.

export interface CvPreview {
  /** Filename of an image in src/assets/cv/, e.g. 'prior-park.jpg'. */
  image?: string;
  blurb?: string;
}

export interface CvEntry {
  org: string;
  role: string;
  dates: string;
  points: string[];
  preview?: CvPreview;
}

export const profile = [
  'First-year Immersive Software Engineering student at the University of Limerick.',
  'Interested in Java, Python and C, and keen to put problem-solving skills to work on real software projects.',
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

export const skills = [
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
    preview: { blurb: 'Busy forecourt in Clonmel — fast-paced, customer-facing, safety-first.' },
  },
  {
    org: 'CBS High School Clonmel',
    role: 'Exam Attendant',
    dates: 'Summer 2025',
    points: [
      'Helped with the smooth running of the State Examinations, making sure all exam rules and procedures were strictly followed.',
    ],
    preview: { blurb: 'State Examinations — where following procedure exactly is the whole job.' },
  },
  {
    org: 'Hotel Minella, Clonmel',
    role: 'Waiting and Cleaning',
    dates: 'Summer 2024',
    points: [
      'Worked as part of the hotel team serving customers, clearing tables and keeping dining areas clean during the busy summer season.',
    ],
    preview: { blurb: 'Hotel restaurant team through the summer rush.' },
  },
];

export const additional = [
  { label: 'Award', value: '3rd Year STEM Student of the Year (2023) for results in science and maths.' },
  { label: 'Student council', value: 'Elected to the Junior Student Council at The High School.' },
  { label: 'School events', value: 'Helped teachers and staff set up and run parent-teacher meetings.' },
  {
    label: 'Sport & coaching',
    value: 'School football and basketball teams; assistant coach for underage teams at Clonmel Commercials.',
  },
  {
    label: 'Placements',
    value:
      "St. Vincent de Paul, Paws, Bob Fitzgerald's Hardware, Clonmel Garden Centre and Eason Bookshop.",
  },
];

export const interests =
  'Coding in my spare time, practising algorithm problems, playing sport (currently American football with UL) and watching films.';
