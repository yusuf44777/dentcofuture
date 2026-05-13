export type DefaultRafflePrize = {
  title: string;
  description: string;
  quantity: number;
};

export const DEFAULT_RAFFLE_PRIZES: DefaultRafflePrize[] = [
  {
    title: "Gözlük Tipi Siperlik",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 5
  },
  {
    title: "Siperlik",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 10
  },
  {
    title: "Soğuk Akrilik",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Fantom Sert Çene Modeli",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Dental Mum",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "RubyCompNano Polimer Bazlı Dental Restoratif Materyal",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "RubyBond 5. Jenerasyon Üniversal Adeziv",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Pure Etch Dental Asit Jeli",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Rodyum Ayna",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 5
  },
  {
    title: "Muayene Seti",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 5
  },
  {
    title: "Amazon Kodu",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 3
  },
  {
    title: "Endobox",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 2
  },
  {
    title: "Plastik Dişli Çene",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 2
  },
  {
    title: "Endo Yüzük",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Frez Kutusu",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Endocetvel",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Epoksi Bazlı Kanal Patı",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Aerotör",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 2
  },
  {
    title: "Piyasemen",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Anguldurva",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Konu Kitabı Seti",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Soru Kitabı Seti",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Rossignol Loupe",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 1
  },
  {
    title: "Secret of Love Koku Ürünleri",
    description: "Dent Co Future çekiliş ödül seti",
    quantity: 5
  }
];

export const DEFAULT_RAFFLE_PRIZE_TOTAL_QUANTITY = DEFAULT_RAFFLE_PRIZES.reduce(
  (total, prize) => total + prize.quantity,
  0
);
