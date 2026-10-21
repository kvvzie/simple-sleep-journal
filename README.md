# Simple Sleep Journal (mood journal) 🌙

Minimalistyczny, monochromatyczny dziennik snu i nastroju połączony z licznikiem zużycia żyletek (**Body Care / Razor Blade Tracker**). Aplikacja stworzona w **React Native** oraz **Expo SDK 57**, wyposażona w autorską typografię bitmapową **Redaction**, lokalną relacyjną bazę danych **SQLite** oraz płynne animacje oparte o fizykę sprężyn.

---

## 📱 Funkcjonalności

### 1. Interaktywny Kalendarz Siatkowy (`CalendarGrid`)
- **Regulowany układ siatki**: 5 presetów proporcji (`4x8`, `5x7`, `6x6`, `7x5`, `8x4`).
- **Adaptacja do ekranów**: Niezależne zapamiętywanie wybranego rozmiaru siatki dla ekranów standardowych (smartfony) oraz szerokich (`width > 500px` – tablety, tryb poziomy).
- **Trójpoziomowe przewijanie**:
  - Rok (płynny pager roczny z automatycznym dopasowaniem szerokości tekstu).
  - Miesiąc (pager miesięczny z animowanym skalowaniem szerokości etykiety).
  - Dni (siatka dni miesiąca z animacją sprężynową powiększenia przy zmianie widoku).
- **Wizualne stany dni**:
  - *Dzisiejszy dzień* (`today`) – pogrubiony, pełny kolor tekstu.
  - *Dzień z zapisanym snem* (`logged`) – standardowy krój, pełny kolor.
  - *Dzień przeszły bez wpisu* (`unlogged`) – subtelna kursywa, stonowany szary.
  - *Dni przyszłe* (`future`) – przyciemniony szary, zablokowane kliknięcie.
  - *Dni z sąsiednich miesięcy* (`otherMonth`) – najjaśniejszy odcień dopełniający układ siatki.
- **Typografia Redaction**: Pełny zestaw 8 wariantów czcionki Redaction (20, 35, 50, 70 w odmianach Regular, Bold oraz Italic).

### 2. Karta Dnia i Wpisu (`SleepModal`)
- **Bęben wyboru czasu snu (`WheelPicker`)**: Wygodny, pionowy pager umożliwiający precyzyjne ustawienie godzin snu w zakresie 0–24h ze wsparciem gestów i przycisków góra/dół.
- **Ocena nastroju**: 5-stopniowa skala gwiazdkowa.
- **Notatka / Komentarz**: Przerywane pole tekstowe z automatycznym zapisem.
- **Moduł Body Care (Licznik zużycia żyletek)**:
  - Obsługa marek: *Astra Superior Platinum*, *Gillette Platinum*, *Isana Men Classic*.
  - Śledzenie zużycia 4 ćwiartek ostrza: `top-left`, `top-right`, `bottom-left`, `bottom-right`.
  - Dotykowy interfejs graficzny z nakładkami wizualnymi ćwiartek i licznikami użyć.
- **Historia modyfikacji (Audit History)**: Zapis historii każdej edycji wpisu (poprzednia vs nowa wartość godzin, nastroju i komentarza ze znacznikami czasu).
- **Usuwanie wpisu**: Zintegrowany dialog potwierdzenia z opcją przywrócenia stanu początkowego.

### 3. Pływająca Nawigacja (`NavBar`)
- Przerywana, zaokrąglona kapsuła (`dashed pill`) uniesiona nad dolną krawędzią ekranu.
- Płynne przełączanie między kalendarzem a ekranem ustawień.
- Obsługa gestów przesunięcia palcem (poziomy swipe z wykrywaniem progu przesunięcia).
- Sprężynowe skalowanie aktywnej ikony.

### 4. Ustawienia i Zarządzanie Danymi (`Settings`)
- **Przełącznik motywu**: *Light* (jasny), *Automatic* (systemowy), *Dark* (ciemny) z animowanym suwakiem i przejściem przezroczystości całego widoku (`ThemedRoot`).
- **Kopia zapasowa i Eksport**:
  - **JSON**: Pełna kopia zapasowa uwzględniająca logi snu, historię edycji oraz dane modułu Body Care.
  - **CSV**: Zgodny z arkuszami kalkulacyjnymi, z obsługą ucieczki znaków specjalnych i przecinków.
  - **TXT**: Czytelny raport tekstowy.
  - Opcjonalne filtrowanie eksportu po zakresie dat (`Od` / `Do`) oraz wybór nazwy pliku.
  - Natywny wybór katalogu docelowego przez Storage Access Framework na Androidzie / Documents Picker na iOS.
- **Import danych**: Przywracanie kopii zapasowej JSON lub obsługa archiwalnego formatu płaskiej tablicy.

---

## 🏗️ Architektura Techniczna

```
src/
├── app/                      # Expo Router (file-based routing)
│   ├── _layout.tsx           # Główny layout: ładowanie fontów, Providers, ThemedRoot
│   └── (tabs)/
│       ├── _layout.tsx       # Poziomy animated slider łączący CalendarGrid i Settings
│       ├── index.tsx         # Route /
│       └── settings.tsx      # Route /settings
├── components/               # Modularne komponenty UI z plikami barrel (index.ts)
│   ├── calendar-grid/        # Główny kalendarz, pagery roku/miesiąca, obliczenia siatki
│   ├── settings/             # Ekran ustawień, eksport/import, przełącznik motywu
│   ├── sleep-modal/          # Modal wpisu snu, nastroju, żyletek oraz historii
│   ├── nav-bar/              # Pływająca dolna belka nawigacyjna z obsługą gestów
│   ├── confirm-dialog/       # Reużywalny dialog potwierdzenia (Tak / Nie)
│   └── wheel-picker/         # Pionowy selektor bębnowy bazujący na PagerView
├── constants/
│   ├── grid.ts               # Presety siatki GRID_STEPS oraz typy GridSize
│   └── theme.ts              # Palety barw (Light/Dark), czcionki, odstępy
├── contexts/
│   ├── nav-direction-context.tsx  # Stan aktywnego ekranu (calendar | settings)
│   └── settings-context.tsx       # Ustawienia siatki, motyw, integracja z AsyncStorage
├── hooks/
│   └── use-app-color-scheme.ts    # Hook synchronizujący motyw użytkownika z systemem
└── lib/
    └── db.ts                 # Warstwa dostępu do bazy SQLite z kolejką transakcji opQueue
```

### Stos Technologiczny
- **Platforma**: [React Native 0.86](https://reactnative.dev/) / [Expo SDK 57](https://expo.dev/)
- **Baza danych**: [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Preferencje klienta**: [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/)
- **Nawigacja**: [Expo Router v57](https://docs.expo.dev/router/introduction/) + Gestures & Animated API
- **Pagery & Gest**: [react-native-pager-view](https://github.com/callstack/react-native-pager-view) + PanResponder
- **System plików**: [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/), [expo-sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)
- **Typografia**: Redaction (kroje bitmapowo-szeryfowe)

---

## 🗄️ Schemat Bazy Danych (SQLite)

Baza danych `sleepinapp.db` wykorzystuje 3 tabele powiązane kluczami daty w formacie ISO (`YYYY-MM-DD`):

```sql
-- Główna tabela wpisów snu
CREATE TABLE IF NOT EXISTS sleep_logs (
  date TEXT PRIMARY KEY,
  hours REAL,
  mood INTEGER,
  comment TEXT,
  logged INTEGER DEFAULT 1,
  logged_at TEXT,
  updated_at TEXT
);

-- Dziennik audytowy zmian (historia edycji)
CREATE TABLE IF NOT EXISTS sleep_log_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_date TEXT NOT NULL,
  edit_index INTEGER NOT NULL,
  edited_at TEXT NOT NULL,
  prev_hours REAL,
  new_hours REAL,
  prev_mood INTEGER,
  new_mood INTEGER,
  prev_comment TEXT,
  new_comment TEXT,
  changed_hours INTEGER NOT NULL DEFAULT 0,
  changed_mood INTEGER NOT NULL DEFAULT 0,
  changed_comment INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sleep_log_edits_date ON sleep_log_edits(log_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_log_edits_unique ON sleep_log_edits(log_date, edit_index);

-- Tabela śledzenia zużycia żyletek / pielęgnacji
CREATE TABLE IF NOT EXISTS body_care_logs (
  date TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  amounts_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 🚀 Uruchomienie Lokalne (Development)

### Wymagania wstępne
- **Node.js** >= 20.x (zalecany Node.js 22 lub 24)
- **npm** >= 10.x
- Narzędzia platformowe (opcjonalnie do uruchamiania natywnego):
  - **Android Studio** + Android SDK (dla emulatora Androida)
  - **Xcode** + CocoaPods (dla symulatora iOS na macOS)

### Instalacja i start
```bash
# 1. Klonowanie repozytorium i instalacja zależności
npm install

# 2. Uruchomienie bundlera Metro
npm start

# 3. Uruchomienie bezpośrednio na platformie:
npm run android   # otwiera aplikację na emulatorze Androida / podłączonym urządzeniu
npm run ios       # otwiera aplikację w symulatorze iOS (wymaga macOS)
npm run web       # otwiera wersję przeglądarkową
```

---

## 🧪 Testy i Diagnostyka Jakości Kodu

Projekt zawiera zintegrowany zestaw testów jednostkowych oparty na natywnym runnerze `node:test` (niewymagającym zbędnych zależności zewnętrznych):

```bash
# Uruchomienie 21 testów jednostkowych (obliczenia kalendarza, siatka, Body Care, eksport)
npm test

# Sprawdzenie poprawności typowania TypeScript
npm run typecheck

# Weryfikacja spójności pakietów Expo SDK
npm run doctor

# Testowy eksport bundle'a Hermes dla Androida i iOS
npx expo export -p android --output-dir /tmp/test-android && rm -rf /tmp/test-android
npx expo export -p ios --output-dir /tmp/test-ios && rm -rf /tmp/test-ios
```

---

## 📦 Tworzenie Buildów (Build Guide)

Do tworzenia pakietów instalacyjnych wykorzystywane jest narzędzie **EAS Build** ([Expo Application Services](https://docs.expo.dev/build/introduction/)) skonfigurowane w pliku [`eas.json`](./eas.json).

### 🤖 Android

#### A. Wersja deweloperska (Expo Dev Client)
```bash
npx expo run:android
```

#### B. Samodzielny plik instalacyjny APK (Preview / Testy)
Profil `preview` w `eas.json` jest skonfigurowany pod bezpośrednie generowanie pliku `.apk`:
```bash
# Build w chmurze EAS:
npx eas build -p android --profile preview

# Lub alternatywnie build w 100% lokalny na Twojej maszynie (wymaga Android SDK):
npx eas-cli build -p android --profile preview --local
```
Po ukończeniu builda otrzymasz bezpośredni link do pobrania gotowego pliku `.apk`, który można zainstalować na dowolnym telefonie z Androidem.

#### C. Paczka produkcyjna na Google Play (`.aab`)
Profil `production` w `eas.json`:
```bash
npx eas build -p android --profile production
```

---

### 🍏 iOS

> [!NOTE]
> Tworzenie i testowanie buildów natywnych na iOS wymaga konta Apple Developer Program (indywidualnego lub firmowego).

#### A. Uruchomienie w symulatorze iOS (lokalnie na macOS)
```bash
npx expo run:ios
```

#### B. Build testowy Ad-Hoc / Wewnętrzny (EAS Internal Distribution)
Umożliwia instalację aplikacji na zarejestrowanych urządzeniach testowych (UDID):
```bash
npx eas build -p ios --profile preview
```

#### C. Build produkcyjny / TestFlight
Tworzy pakiet `.ipa` gotowy do przesłania do App Store Connect i dystrybucji przez TestFlight:
```bash
npx eas build -p ios --profile production
```
Aby automatycznie wysłać zbudowaną paczkę do App Store Connect:
```bash
npx eas submit -p ios --profile production
```

---

## 📄 Licencja

Projekt objęty licencją MIT. Szczegóły w pliku [LICENSE](./LICENSE).
