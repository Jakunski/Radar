// O código do RADAR foi originalmente escrito para rodar dentro do Claude,
// que injeta um objeto global `window.storage` (get/set) como "banco de dados"
// de teste. Fora do Claude essa API não existe — então recriamos ela aqui
// usando localStorage do navegador, com a MESMA assinatura de funções.
// Isso permite que o restante do código (App.jsx) não precise mudar nenhuma
// linha de lógica: ele continua chamando window.storage.get/.set normalmente.
//
// Diferença importante: localStorage é por navegador/computador, não é
// compartilhado em tempo real entre celulares diferentes como um banco de
// dados de verdade seria. Cada pessoa que abrir o site terá seus próprios
// dados salvos localmente, no aparelho dela.

function ensureStorage() {
  if (typeof window === "undefined") return;

  window.storage = {
    async get(key) {
      const raw = window.localStorage.getItem(key);
      if (raw === null) {
        throw new Error(`Chave "${key}" não encontrada no localStorage.`);
      }
      return { key, value: raw, shared: false };
    },

    async set(key, value) {
      window.localStorage.setItem(key, value);
      return { key, value, shared: false };
    },

    async delete(key) {
      window.localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },

    async list(prefix) {
      const keys = Object.keys(window.localStorage).filter(
        (k) => !prefix || k.startsWith(prefix)
      );
      return { keys, prefix, shared: false };
    },
  };
}

ensureStorage();
