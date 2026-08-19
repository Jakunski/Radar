import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db, firebaseConfigured } from "./firebaseConfig.js";

// Mesma ideia do storagePolyfill.js (localStorage), só que aqui os dados
// vão para o Firestore de verdade — compartilhado entre todos os
// dispositivos que acessarem o site, não só o aparelho de quem lançou.
//
// Cada "chave" do RADAR (ex.: "radar:producoes") vira um documento dentro
// da coleção "radar_data", com um campo "value" guardando o JSON.

const COLLECTION = "radar_data";

function ativarStorageFirestore() {
  if (!firebaseConfigured || !db) {
    console.info(
      "[RADAR] Firebase não configurado — usando localStorage como armazenamento local. " +
      "Veja o README.md para conectar um banco de dados real e gratuito."
    );
    return;
  }

  window.storage = {
    async get(key) {
      let snap;
      try {
        const ref = doc(db, COLLECTION, key);
        snap = await getDoc(ref);
      } catch (e) {
        // Erro de rede/conexão (offline, instável, timeout etc). Sinalizamos
        // isso separado de "não existe" pra quem chama poder tentar de novo
        // em vez de assumir que os dados nunca existiram.
        const erroDeRede = new Error(`Falha de conexão ao buscar "${key}": ${e?.message || e}`);
        erroDeRede.isNetworkError = true;
        throw erroDeRede;
      }
      if (!snap.exists()) {
        throw new Error(`Chave "${key}" não encontrada no Firestore.`);
      }
      return { key, value: snap.data().value, shared: false };
    },

    async set(key, value) {
      const ref = doc(db, COLLECTION, key);
      await setDoc(ref, { value, atualizadoEm: new Date().toISOString() });
      return { key, value, shared: false };
    },

    async delete(key) {
      const ref = doc(db, COLLECTION, key);
      await deleteDoc(ref);
      return { key, deleted: true, shared: false };
    },

    async list(prefix) {
      const snap = await getDocs(collection(db, COLLECTION));
      const keys = snap.docs.map((d) => d.id).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };

  console.info("[RADAR] Conectado ao Firebase — dados agora são compartilhados entre dispositivos.");
}

ativarStorageFirestore();
