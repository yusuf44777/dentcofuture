# DentLinkCo Mobile

Dis hekimleri icin kart tabanli tanisma ve eslesme urunu.

## Stack

- Expo SDK 54
- Expo Router
- TanStack Query
- Zustand + SecureStore
- React Native SVG + Linear Gradient

## Kurulum

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --fix
npx expo-doctor
npm run start
```

`EXPO_PUBLIC_API_URL`, Next.js uygulamasinin calistigi tabana isaret etmeli.

Ornekler:

- iOS Simulator / Android Emulator: `http://127.0.0.1:3000`
- Fiziksel cihaz: `http://<bilgisayarin-lan-ip-adresi>:3000`

## Akis

- `app/index.tsx`: cihazdaki profil kimligini hydrate eder ve yonlendirir
- `app/onboarding.tsx`: yeni dis hekimi profili olusturur
- `app/discovery.tsx`: dating-app tarzinda kart beslemesi
- `app/matches.tsx`: karsilikli ilgi olusan profiller
- `app/profile.tsx`: mevcut profili gunceller

## Sunucu Baglantisi

Mobil istemci asagidaki Next API endpointlerini kullanir:

- `POST /api/networking/profile`
- `PUT /api/networking/profile`
- `GET /api/networking/profile?id=<uuid>`
- `GET /api/networking/feed?profileId=<uuid>`
- `POST /api/networking/interactions`
- `GET /api/networking/matches?profileId=<uuid>`

## EAS

Bu repo icin Expo'nun verdigi:

```bash
npm install --global eas-cli
npx create-expo-app dentlinkco
cd dentlinkco
eas init --id 03066288-4ace-49af-abd9-b6b82b1e7041
```

komutunu aynen kullanmiyoruz; cunku uygulama zaten bu repo icindeki `mobile/` klasorunde kuruldu.

Bunun yerine:

```bash
cd mobile
npm install
npx expo install --fix
npm run eas:configure
npm run build:android:preview
```

`mobile/app.config.ts` icinde `projectId` zaten tanimli.

## Notlar

- Profil kimligi cihazda `expo-secure-store` ile tutulur.
- Discovery kartlari like/pass aksiyonlariyla ilerler.
- Karsilikli ilgi olusunca profil eslesmeler ekranina duser ve iletisim butonlari acilir.
- Mobil veri sozlesmeleri `mobile/src/lib/contracts.ts` icinde tutulur.
