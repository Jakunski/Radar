# RADAR — Gestão Inteligente Comercial

Sistema de gestão comercial para lojas de crédito: Matinal, Painel Estratégico, Parcial do Dia,
Central de Produção, Radar Comercial, Relatórios, Backup e Configurações — com dois perfis de
acesso (Supervisor e Consultor).

## Rodando localmente

```bash
npm install
npm run dev
```

## Publicando no GitHub Pages

Este projeto já vem configurado para publicar automaticamente via GitHub Actions a cada push
na branch `main`. Veja o passo a passo completo na conversa com o Claude, ou resumidamente:

1. Em **Settings → Pages** do repositório, em "Source", selecione **GitHub Actions**.
2. Dê push na branch `main`.
3. Acompanhe o progresso na aba **Actions** do repositório.
4. O site fica disponível em `https://SEU-USUARIO.github.io/Radar/`.

## Armazenamento de dados

Este projeto usa o **Firebase (Firestore)** como banco de dados gratuito, compartilhado entre
todos os dispositivos. Enquanto o Firebase não estiver configurado, o site funciona
normalmente com `localStorage` (dados salvos só no aparelho de cada pessoa) — ou seja, você
pode publicar e usar antes mesmo de configurar o Firebase, e conectar depois sem quebrar nada.

### Passo a passo para configurar o Firebase (gratuito)

1. Acesse **https://console.firebase.google.com** e faça login com uma conta Google.
2. Clique em **"Adicionar projeto"**, dê um nome (ex.: `radar-help`) e siga o assistente
   (pode desativar o Google Analytics, não é necessário).
3. Dentro do projeto, no menu lateral, clique em **"Compilação" → "Firestore Database"**.
4. Clique em **"Criar banco de dados"**. Escolha a localização mais próxima (ex.: `southamerica-east1`).
5. Em modo de segurança, escolha **"Iniciar em modo de teste"** por enquanto (permite leitura/escrita
   por 30 dias — depois vamos travar isso com uma regra permanente, veja abaixo).
6. Volte à visão geral do projeto (ícone de casa) e clique no ícone **"</>"** (Web) para criar um
   "app da Web". Dê um nome (ex.: `radar-web`) e clique em **"Registrar app"**.
7. O Firebase vai mostrar um bloco de código com `apiKey`, `authDomain`, `projectId`, etc.
   Copie esses valores.
8. **Para rodar localmente**: crie um arquivo `.env` na raiz do projeto (copie o `.env.example`)
   e cole os valores lá.
9. **Para publicar no GitHub Pages**: no repositório do GitHub, vá em
   **Settings → Secrets and variables → Actions → New repository secret** e crie um secret
   para cada uma das 6 variáveis (mesmos nomes do `.env.example`), colando o valor correspondente.
10. Dê um novo `git push` (ou re-rode a Action manualmente na aba "Actions") — o próximo build
    já vai sair conectado ao Firebase.

### Regra de segurança recomendada (depois dos 30 dias de teste)

No Firestore, vá em **"Regras"** e substitua pelo conteúdo abaixo, depois clique em **"Publicar"**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /radar_data/{document} {
      allow read, write: if true;
    }
  }
}
```

**Importante sobre segurança**: como este é um site estático (sem servidor por trás), as chaves do
Firebase ficam visíveis no código do site — isso é normal e esperado para esse tipo de projeto,
não é uma falha. Quem realmente protege seus dados são as **regras do Firestore**, não as chaves.
A regra acima libera leitura/escrita para qualquer pessoa que tenha o link do site — perfeitamente
razoável para uso interno da equipe agora, mas se um dia quiser mais segurança (exigir login, por
exemplo), me avise que ajudamos a evoluir isso.

