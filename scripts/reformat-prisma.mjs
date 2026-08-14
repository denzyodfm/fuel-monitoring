import fs from "node:fs";

const path = "prisma/schema.prisma";
const source = fs.readFileSync(path, "utf8");

function tokens(value) {
  const result = [];
  let current = "", depth = 0, quote = false;
  for (const char of value.trim()) {
    if (char === '"') quote = !quote;
    if (!quote && ["(", "["].includes(char)) depth++;
    if (!quote && [")", "]"].includes(char)) depth--;
    if (/\s/.test(char) && depth === 0 && !quote) {
      if (current) result.push(current), current = "";
    } else current += char;
  }
  if (current) result.push(current);
  return result;
}

const output = source.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^(generator|datasource|enum|model)\s+(\w+)\s*\{(.*)\}$/);
  if (!match) return [line];
  const [, kind, name, body] = match;
  const parts = tokens(body);
  const rows = [];
  if (kind === "enum") rows.push(...parts.map((part) => `  ${part}`));
  else if (kind === "generator" || kind === "datasource") {
    for (let i = 0; i < parts.length; i += 3) rows.push(`  ${parts[i]} ${parts[i + 1]} ${parts[i + 2]}`);
  } else {
    for (let i = 0; i < parts.length;) {
      if (parts[i].startsWith("@@")) { rows.push(`  ${parts[i++]}`); continue; }
      const field = [parts[i++], parts[i++]];
      while (i < parts.length && parts[i].startsWith("@") && !parts[i].startsWith("@@")) field.push(parts[i++]);
      rows.push(`  ${field.join(" ")}`);
    }
  }
  return [`${kind} ${name} {`, ...rows, "}"];
}).join("\n");

fs.writeFileSync(path, `${output}\n`);
