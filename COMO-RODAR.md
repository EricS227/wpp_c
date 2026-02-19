# Como rodar o WPPConnector

## Parar a aplicacao

- **`stop.bat`** – Encerra so frontend e backend (portas 3100 e 4000). Docker continua rodando.
- **`stop-all.bat`** – Encerra frontend, backend e **para os containers Docker** (Postgres, Redis, WAHA).

---

## Opcao 1: Script unico (Windows)

De dois cliques em **`start.bat`** na raiz do projeto. Ele vai:
1. Verificar o Docker
2. Abrir uma janela com o **backend** (porta 4000)
3. Abrir outra janela com o **frontend** (porta 3100)

Depois abra no navegador: **http://192.168.10.156:3100**

---

## Opcao 2: Passo a passo manual

### 1. Subir o Docker (banco e servicos)

Na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe: Postgres (5434), Redis (6380), WAHA (3101).

### 2. Backend

```bash
cd backend
npm install
npm run start:dev
```

Deixe rodando. O backend fica em **http://192.168.10.156:4000**.

### 3. Frontend (em outro terminal)

```bash
cd frontend
npm install
npm run dev -- -p 3100
```

O frontend fica em **http://192.168.10.156:3100**. Acesse essa URL para usar o sistema.

---

## Se algo falhar

- **"Cannot find module"** → Rode `npm install` dentro de `backend` e de `frontend`.
- **Backend nao conecta no banco** → Confira se o Docker esta rodando (`docker compose ps`) e se o arquivo `.env` existe com `DATABASE_URL=postgresql://whatsapp:dev_password@192.168.10.156:5434/whatsapp_db`.
- **Frontend nao abre** → Confira se a porta 3100 esta livre e se rodou `npm run dev -- -p 3100` dentro da pasta `frontend`.
