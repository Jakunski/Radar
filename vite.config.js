import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANTE: o base precisa ser "/NOME-DO-REPOSITORIO/" para o GitHub Pages
// funcionar em https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/
// Este repositório se chama "Radar", então o base já está configurado certo.
// Se um dia você renomear o repositório, troque o valor abaixo também.
export default defineConfig({
  base: "/Radar/",
  plugins: [react()],
  build: {
    outDir: "dist",
  },
});
