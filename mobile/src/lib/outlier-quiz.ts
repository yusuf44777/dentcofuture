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
    text: "Konfor alanının dışına en son ne zaman çıktın?",
    type: "scale",
    scaleMin: "Yıllar önce",
    scaleMax: "Bu hafta"
  },
  {
    id: 2,
    text: "Çığır açacak bir diş hekimliği fikrin var. İlk adımın ne olur?",
    type: "choice",
    options: [
      { label: "Önce detaylıca araştırırım", value: 2 },
      { label: "Meslektaşlarımla konuşurum", value: 3 },
      { label: "Prototip çıkarır / sunarım", value: 5 },
      { label: "Hemen fon başvurusu yaparım", value: 4 }
    ]
  },
  {
    id: 3,
    text: "Önümüzdeki 10 yılda diş hekimliği için en büyük tehdit nedir?",
    type: "choice",
    options: [
      { label: "Yapay zekanın tanıda insanı geri plana itmesi", value: 4 },
      { label: "Mevzuatın yavaş kalması", value: 3 },
      { label: "Yetenek açığı", value: 3 },
      { label: "Hastanın süreçten kopması", value: 4 }
    ]
  },
  {
    id: 4,
    text: "Bu yıl diş hekimliği dışındaki kaç kitap okudun?",
    type: "scale",
    scaleMin: "Hiç",
    scaleMax: "10+"
  },
  {
    id: 5,
    text: "Girişimcilik ruhunu değerlendir",
    type: "scale",
    scaleMin: "Klinik odaklıyım",
    scaleMax: "Seri girişimciyim"
  }
];

export function calculateOutlierScore(answers: number[]): number {
  if (answers.length !== 5) return 0;

  const [q1, q2, q3, q4, q5] = answers;
  const scaleScore = ((q1 + q4 + q5) / 15) * 60;
  const choiceScore = ((q2 + q3) / 10) * 40;
  const raw = scaleScore + choiceScore;

  return Math.min(100, Math.round(raw));
}

export function getOutlierTitle(score: number): string {
  if (score >= 85) return "Dönüştürücü";
  if (score >= 70) return "Yenilikçi";
  if (score >= 55) return "Meydan Okuyan";
  if (score >= 40) return "Kaşif";
  return "Öğrenen";
}
