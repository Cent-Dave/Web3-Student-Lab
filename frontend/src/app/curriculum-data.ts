export type Lesson = {
  id: string;
  title: string;
  route: string;
  duration: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  accent: string;
  lessons: Lesson[];
};

export const courses: Course[] = [
  {
    id: "blockchain-foundations",
    title: "Blockchain Foundations",
    description: "Understand blocks, hashes, wallets, and decentralized networks.",
    accent: "#6366f1",
    lessons: [
      { id: "blocks", title: "How Blocks Work", route: "/roadmap/blockchain-foundations/blocks", duration: "8 min" },
      { id: "wallets", title: "Wallets and Keys", route: "/roadmap/blockchain-foundations/wallets", duration: "10 min" },
      { id: "consensus", title: "Consensus Basics", route: "/roadmap/blockchain-foundations/consensus", duration: "12 min" },
    ],
  },
  {
    id: "smart-contracts",
    title: "Smart Contracts",
    description: "Learn how programmable agreements power Web3 products.",
    accent: "#14b8a6",
    lessons: [
      { id: "intro-contracts", title: "Intro to Contracts", route: "/roadmap/smart-contracts/intro", duration: "9 min" },
      { id: "soroban-state", title: "Soroban State", route: "/roadmap/smart-contracts/soroban-state", duration: "14 min" },
      { id: "testing", title: "Testing Contract Logic", route: "/roadmap/smart-contracts/testing", duration: "11 min" },
    ],
  },
  {
    id: "open-source",
    title: "Open Source Lab",
    description: "Practice GitHub issues, branches, reviews, and pull requests.",
    accent: "#f59e0b",
    lessons: [
      { id: "issues", title: "Reading Issues", route: "/roadmap/open-source/issues", duration: "7 min" },
      { id: "branches", title: "Branch Workflow", route: "/roadmap/open-source/branches", duration: "9 min" },
      { id: "prs", title: "Submitting PRs", route: "/roadmap/open-source/pull-requests", duration: "13 min" },
    ],
  },
];

export const allLessons = courses.flatMap((course) =>
  course.lessons.map((lesson) => ({ ...lesson, courseId: course.id, courseTitle: course.title }))
);

export const storageKeys = {
  completed: "web3-student-lab.completed-lessons",
  bookmarks: "web3-student-lab.bookmarked-lessons",
  celebrated: "web3-student-lab.course-completion-celebrated",
};
