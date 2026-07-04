export type Lesson = {
  id: string;
  title: string;
  route: string;
  duration: string;
  content?: string[];
  starterCode?: string;
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
      {
        id: "blocks",
        title: "How Blocks Work",
        route: "/roadmap/blockchain-foundations/blocks",
        duration: "8 min",
        content: [
          "A blockchain is a continuously growing list of records, called blocks, which are linked and secured using cryptography.",
          "Each block contains a cryptographic hash of the previous block, a timestamp, and transaction data.",
          "In the editor, we will write a simple Rust struct that represents a block's structure in memory."
        ],
        starterCode: `#[derive(Clone, Debug)]\npub struct Block {\n    pub id: u64,\n    pub prev_hash: String,\n    pub data: String,\n}\n\n// TODO: Add an 'impl Block' with a 'new' function.`
      },
      {
        id: "wallets",
        title: "Wallets and Keys",
        route: "/roadmap/blockchain-foundations/wallets",
        duration: "10 min",
        content: [
          "Wallets don't actually hold your tokens; they hold the cryptographic keys that allow you to authorize transactions.",
          "A public key serves as your address, while a private key acts as your password. Never share your private key!",
          "Let's define a simple Wallet struct that holds a public address and balance."
        ],
        starterCode: `pub struct Wallet {\n    pub address: String,\n    pub balance: u64,\n}\n\nimpl Wallet {\n    pub fn new(address: &str) -> Self {\n        Self {\n            address: address.to_string(),\n            balance: 0,\n        }\n    }\n}`
      },
      {
        id: "consensus",
        title: "Consensus Basics",
        route: "/roadmap/blockchain-foundations/consensus",
        duration: "12 min",
        content: [
          "Consensus mechanisms are how decentralized networks agree on the true state of the blockchain.",
          "Examples include Proof of Work (Bitcoin), Proof of Stake (Ethereum), and the Stellar Consensus Protocol (SCP).",
          "In this exercise, write a function that validates if a block is approved by a majority of nodes."
        ],
        starterCode: `pub fn is_approved(yes_votes: u32, total_nodes: u32) -> bool {\n    // TODO: Return true if yes_votes is greater than half of total_nodes\n    false\n}`
      },
    ],
  },
  {
    id: "smart-contracts",
    title: "Smart Contracts",
    description: "Learn how programmable agreements power Web3 products.",
    accent: "#14b8a6",
    lessons: [
      {
        id: "intro-contracts",
        title: "Intro to Contracts",
        route: "/roadmap/smart-contracts/intro",
        duration: "9 min",
        content: [
          "Smart contracts are self-executing contracts with the terms of the agreement directly written into code.",
          "On the Stellar network, smart contracts are powered by Soroban and written in Rust.",
          "Let's write a simple Hello World contract using Soroban."
        ],
        starterCode: `#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env, Symbol, symbol_short};\n\n#[contract]\npub struct HelloContract;\n\n#[contractimpl]\nimpl HelloContract {\n    pub fn hello(env: Env, to: Symbol) -> Symbol {\n        // TODO: Return a greeting\n        symbol_short!("hello")\n    }\n}`
      },
      {
        id: "soroban-state",
        title: "Soroban State",
        route: "/roadmap/smart-contracts/soroban-state",
        duration: "14 min",
        content: [
          "Contracts often need to remember data between invocations. This is called state.",
          "Soroban provides Env storage to save and read persistent data.",
          "In this lesson, let's write a simple counter contract that increments a stored value."
        ],
        starterCode: `#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env, Symbol, symbol_short};\n\nconst COUNTER: Symbol = symbol_short!("COUNTER");\n\n#[contract]\npub struct Counter;\n\n#[contractimpl]\nimpl Counter {\n    pub fn increment(env: Env) -> u32 {\n        let mut count: u32 = env.storage().instance().get(&COUNTER).unwrap_or(0);\n        count += 1;\n        env.storage().instance().set(&COUNTER, &count);\n        count\n    }\n}`
      },
      {
        id: "testing",
        title: "Testing Contract Logic",
        route: "/roadmap/smart-contracts/testing",
        duration: "11 min",
        content: [
          "Testing is critical for smart contracts since bugs can lead to lost funds.",
          "Soroban allows you to test your Rust contracts locally using the standard cargo test command.",
          "Write a simple test for our Counter contract."
        ],
        starterCode: `#[cfg(test)]\nmod test {\n    use super::*;\n    use soroban_sdk::Env;\n\n    #[test]\n    fn test_increment() {\n        let env = Env::default();\n        let contract_id = env.register_contract(None, Counter);\n        let client = CounterClient::new(&env, &contract_id);\n\n        assert_eq!(client.increment(), 1);\n        assert_eq!(client.increment(), 2);\n    }\n}`
      },
    ],
  },
  {
    id: "open-source",
    title: "Open Source Lab",
    description: "Practice GitHub issues, branches, reviews, and pull requests.",
    accent: "#f59e0b",
    lessons: [
      {
        id: "issues",
        title: "Reading Issues",
        route: "/roadmap/open-source/issues",
        duration: "7 min",
        content: [
          "GitHub issues are the primary way to track bugs, features, and tasks in an open-source project.",
          "A good issue contains a clear description, reproduction steps (for bugs), and expected behavior.",
          "Write a simple Markdown template for reporting a bug."
        ],
        starterCode: `## Bug Description\nA clear and concise description of what the bug is.\n\n## Steps to Reproduce\n1. Go to '...'\n2. Click on '....'\n3. See error\n\n## Expected Behavior\nA clear and concise description of what you expected to happen.`
      },
      {
        id: "branches",
        title: "Branch Workflow",
        route: "/roadmap/open-source/branches",
        duration: "9 min",
        content: [
          "Branching allows you to work on new features without affecting the main codebase.",
          "A standard workflow is: create a branch, commit your changes, push to the remote, and open a Pull Request.",
          "In the terminal (or this editor as a simulation), list the git commands to create and push a new branch."
        ],
        starterCode: `# 1. Create and switch to a new branch\ngit checkout -b feature/add-new-button\n\n# 2. Stage your changes\ngit add .\n\n# 3. Commit your changes\ngit commit -m "feat: add new button"\n\n# 4. Push to remote\ngit push origin feature/add-new-button`
      },
      {
        id: "prs",
        title: "Submitting PRs",
        route: "/roadmap/open-source/pull-requests",
        duration: "13 min",
        content: [
          "A Pull Request (PR) is a proposal to merge your branch into the main repository.",
          "Reviewers will leave comments, and you may need to push additional commits to address them.",
          "Write a polite, informative PR description."
        ],
        starterCode: `## What does this PR do?\nThis PR implements the new 'Take Lesson' button on the Learning Dashboard.\n\n## Changes\n- Added dynamic routing to /lessons/[courseId]/[lessonId]\n- Improved button aesthetics to match the neon-red theme\n\n## Testing\n- [x] Verified route transitions\n- [x] Checked responsive layout on mobile`
      },
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
