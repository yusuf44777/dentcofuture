export interface QuizQuestion {
  id: number;
  text: string;
  type: "scale" | "choice";
  options?: { label: string; value: number }[];
  scaleMin?: string;
  scaleMax?: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: "When did you last do something outside your comfort zone?",
    type: "scale",
    scaleMin: "Years ago",
    scaleMax: "This week"
  },
  {
    id: 2,
    text: "You have a groundbreaking dental idea. Your first move?",
    type: "choice",
    options: [
      { label: "Research it thoroughly first", value: 2 },
      { label: "Talk to colleagues", value: 3 },
      { label: "Build a prototype / pitch it", value: 5 },
      { label: "Apply for a grant immediately", value: 4 }
    ]
  },
  {
    id: 3,
    text: "Biggest threat to dentistry in the next 10 years?",
    type: "choice",
    options: [
      { label: "AI replacing diagnostics", value: 4 },
      { label: "Regulatory stagnation", value: 3 },
      { label: "Talent shortage", value: 3 },
      { label: "Patient disengagement", value: 4 }
    ]
  },
  {
    id: 4,
    text: "How many non-dentistry books have you read this year?",
    type: "scale",
    scaleMin: "Zero",
    scaleMax: "10+"
  },
  {
    id: 5,
    text: "Rate your entrepreneurial spirit",
    type: "scale",
    scaleMin: "Pure clinician",
    scaleMax: "Serial founder"
  }
];

export function calculateOutlierScore(answers: number[]): number {
  if (answers.length !== 5) return 0;

  const [q1, q2, q3, q4, q5] = answers;

  // Q1, Q4, Q5 are scales 1-5 → max contribution: 20 each
  const scaleScore = ((q1 + q4 + q5) / 15) * 60;

  // Q2, Q3 are choice scores (2-5) → max 5 each → 10 total → map to 40
  const choiceScore = ((q2 + q3) / 10) * 40;

  const raw = scaleScore + choiceScore;
  return Math.min(100, Math.round(raw));
}

export function getOutlierTitle(score: number): string {
  if (score >= 85) return "The Disruptor";
  if (score >= 70) return "The Innovator";
  if (score >= 55) return "The Challenger";
  if (score >= 40) return "The Explorer";
  return "The Learner";
}

export function getOutlierColor(score: number): string {
  if (score >= 85) return "#FF4D6D";
  if (score >= 70) return "#6C63FF";
  if (score >= 55) return "#00E5A0";
  if (score >= 40) return "#F59E0B";
  return "#64748B";
}
