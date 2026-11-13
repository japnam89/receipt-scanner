// Open the app's sign-in page so OAuth state is created in the browser.
require("dotenv").config();
const open = (url) => {
  const { spawn } = require("child_process");
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try { spawn(cmd, [url]); } catch {}
};

const url = `http://localhost:${process.env.PORT || 4000}/auth`;
console.log("Start the app, then open its sign-in page to authorize the configured Google account:");
console.log(`\n${url}\n`);
open(url);
