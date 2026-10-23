# Solar Calculator — Dimensionamento Fotovoltaico Rápido

Aplicativo Android independente (React Native + Expo + TypeScript) para:

- Dimensionamento fotovoltaico por consumo mensal ou diário
- Gerenciador de módulos comerciais e customizados
- Cálculo bidirecional de área de telhado
- Guia técnico com dicionário e explicação do fator **3,33**
- Validação inteligente com IA (OpenAI GPT-4o-mini ou Google Gemini)

> Migrado da pasta `provisao-solar-app/` do repositório `chuveiro-inteligente` (tag `solar-calculator-v1.0.43`).

## Requisitos

- Node.js 20+ (recomendado; CI usa Node 22)
- npm 10+
- Conta Expo (para gerar APK com EAS)
- Android Studio / emulador **ou** Expo Go no aparelho (para testes locais)

## Instalação e teste local

```bash
npm install
npm run typecheck
npm run test:calc
npm start
```

Com o Metro em execução:

- pressione `a` para abrir no emulador/dispositivo Android
- ou escaneie o QR Code com o Expo Go

Scripts úteis:

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o Expo Dev Server |
| `npm run android` | Abre direto no Android |
| `npm run typecheck` | Verifica TypeScript |
| `npm run test:calc` | Valida as fórmulas de negócio |
| `npm run build:apk` | Atalho para build APK (EAS preview) |

## Download do APK (Android)

Link direto para baixar o APK gerado:

**https://github.com/olavoprovisaosolar-byte/calculadora-solar/releases/download/v1.0.46/SolarCalculator-v1.0.46.apk**

Página do release: https://github.com/olavoprovisaosolar-byte/calculadora-solar/releases/tag/v1.0.46

> App independente **Solar Calculator** (`com.solarcalculator.app`). APK **release** com bundle JavaScript embutido (não precisa do Metro).

> **Atualizando de ≤ 1.0.20:** desinstale a versão antiga antes de instalar o 1.0.21+. Os APKs anteriores eram assinados com certificados diferentes a cada build do CI (o Android bloqueia a atualização). A partir do 1.0.21 a assinatura é estável.

Página auxiliar local: `download.html`

APK histórico (antes da migração): [Solar Calculator 1.0.43 no chuveiro-inteligente](https://github.com/olavoprovisaosolar-byte/chuveiro-inteligente/releases/tag/solar-calculator-v1.0.43)

## Gerar o arquivo `.apk` (Android)

1. Instale e autentique o EAS CLI:

```bash
npm install -g eas-cli
eas login
```

2. Configure o projeto Expo (uma vez):

```bash
eas build:configure
```

Substitua o `extra.eas.projectId` em `app.json` pelo ID gerado, se necessário.

3. Gere o APK de preview/distribuição interna:

```bash
eas build -p android --profile preview
```

O perfil `preview` em `eas.json` usa `"buildType": "apk"`.

Alternativa via npm:

```bash
npm run build:apk
```

Ao final, o EAS fornece um link para download do `.apk`.

### Build local (opcional, sem nuvem EAS)

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

O APK geralmente fica em:

`android/app/build/outputs/apk/release/app-release.apk`

O GitHub Actions (`.github/workflows/build-solar-calculator-apk.yml`) também gera o APK release assinado a cada push em `main` / branches `cursor/**`.

## Estrutura do projeto

```text
.
├── App.tsx
├── app.json
├── eas.json
├── src/
│   ├── components/       # UI reutilizável
│   ├── constants/        # Catálogo de módulos e constantes
│   ├── hooks/            # Módulos e config de IA
│   ├── navigation/       # Bottom Tabs
│   ├── screens/          # Telas principais
│   ├── services/         # Storage, SecureStore e APIs de IA
│   ├── theme/            # Modo claro/escuro
│   ├── types/
│   └── utils/            # Fórmulas de cálculo
└── README.md
```

## Abas do aplicativo

1. **Cálculo** — Dimensionamento por consumo mensal/diário + sugestão de inversor (FDI 1,15–1,30)
2. **Módulos** — Catálogo comercial, cadastro local de placas customizadas e resumo do arranjo
3. **Telhado** — Cálculo bidirecional (sistema→telhado e telhado→placas)
4. **Guia** — Fórmulas, fator 3,33 e dicionário técnico
5. **Config. IA** — Provedor (OpenAI/Gemini), API Key segura, teste de conexão e tema

## Fórmulas principais

- Mensal: `kWh/dia = mensal / 30` · `kWp = mensal / 100`
- Diário: `kWh/mês = diário * 30` · `kWp = diário / 3,33`
- Inversor: `kWp / 1,30` até `kWp / 1,15`
- Telhado direto: `Área recomendada = (qtd * área unitária) * (1 + margem)`
- Telhado inverso: `qtd máx = piso(área útil / área unitária)` · geração ≈ `kWp * 100`

## Configuração da IA

1. Abra a aba **Config. IA**
2. Escolha **OpenAI (GPT-4o-mini)** ou **Google Gemini**
3. Cole a API Key
4. Toque em **Salvar configuração** e **Testar conexão**
5. Nas telas de resultado, use **Revisar Dimensionamento com IA**

A chave é persistida com `expo-secure-store` (armazenamento seguro do dispositivo).

## Observações

- Os cálculos são estimativas rápidas de pré-dimensionamento.
- Irradiação local, orientação, sombreamento e normas devem ser validados por profissional habilitado.
- Não versionamos `node_modules/`, `.expo/` nem pastas nativas geradas (`android/`, `ios/`).
