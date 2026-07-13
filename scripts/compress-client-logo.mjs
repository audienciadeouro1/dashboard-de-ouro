// Comprime e recorta uma logo de cliente para foto de perfil 256x256.
// Uso: node scripts/compress-client-logo.mjs <arquivo-de-entrada> <slug>
// Ex:  node scripts/compress-client-logo.mjs public/images/clients/aki-sushi.png.jpg aki-sushi
//
// SEGURO: nunca apaga o arquivo de entrada. Gera public/images/clients/<slug>.png.
import sharp from "sharp";
import { existsSync } from "node:fs";
import path from "node:path";

const [input, slug] = process.argv.slice(2);
if (!input || !slug) {
  console.error("Uso: node scripts/compress-client-logo.mjs <arquivo-de-entrada> <slug>");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`Arquivo não encontrado: ${input}`);
  process.exit(1);
}

const output = path.join("public", "images", "clients", `${slug}.png`);

await sharp(input)
  .resize(256, 256, { fit: "cover", position: "centre" })
  .png({ quality: 90, compressionLevel: 9 })
  .toFile(output);

console.log(`OK: ${output} gerado (256x256).`);
