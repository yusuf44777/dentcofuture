export type DefaultRafflePrize = {
  title: string;
  description: string;
  quantity: number;
};

const DEFAULT_RAFFLE_PRIZE_DESCRIPTION = "DentCo Outliers çekiliş ödül seti";

export const DEFAULT_RAFFLE_PRIZES: DefaultRafflePrize[] = [
  {
    title: "Gözlük Tipi Siperlik",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 5
  },
  {
    title: "Siperlik",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 10
  },
  {
    title: "Soğuk Akrilik",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Fantom Sert Çene Modeli",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Dental Mum",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "RubyCompNano Polimer Bazlı Dental Restoratif Materyal",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "RubyBond 5. Jenerasyon Üniversal Adeziv",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Pure Etch Dental Asit Jeli",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Rodyum Ayna",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 5
  },
  {
    title: "Muayene Seti",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 5
  },
  {
    title: "Amazon Kodu",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 3
  },
  {
    title: "Endobox",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 2
  },
  {
    title: "Plastik Dişli Çene",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 2
  },
  {
    title: "Endo Yüzük",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Frez Kutusu",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Endocetvel",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Epoksi Bazlı Kanal Patı",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Aerotör",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 2
  },
  {
    title: "Piyasemen",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Anguldurva",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Konu Kitabı Seti",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Soru Kitabı Seti",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Rossignol Loupe",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 1
  },
  {
    title: "Secret of Love Koku Ürünleri",
    description: DEFAULT_RAFFLE_PRIZE_DESCRIPTION,
    quantity: 5
  }
];

export const DEFAULT_RAFFLE_PRIZE_TOTAL_QUANTITY = DEFAULT_RAFFLE_PRIZES.reduce(
  (total, prize) => total + prize.quantity,
  0
);
