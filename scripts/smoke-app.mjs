import { chromium } from "@playwright/test";
import fs from "node:fs";

const candidates = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const executablePath = candidates.find((path) => fs.existsSync(path));
if (!executablePath) throw new Error("No supported local browser executable was found.");

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("admin@fuel.local");
await page.getByLabel("Password").fill("FuelAdmin2026!");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/dashboard", { timeout: 30000 });
await page.getByRole("heading", { name: "Operations dashboard" }).waitFor();
await page.screenshot({ path: "dashboard-smoke.png", fullPage: true });
const sidebar = await page.locator("aside").first().boundingBox();
console.log(JSON.stringify({ url: page.url(), heading: await page.getByRole("heading", { name: "Operations dashboard" }).textContent(), sidebar, errors }, null, 2));
await browser.close();
