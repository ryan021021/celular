// Regras do projeto conferidas pela regressão da QA (tools/qa/regressao.mjs). Casos em tools/qa/test/regras.test.mjs.

// CLAUDE.md/GEMINI.md: scripts sem caminho da Desktop. Formas cobertas: C:\Users\<x>\Desktop, %USERPROFILE%\Desktop,
// $env:USERPROFILE\Desktop, $HOME/Desktop, ${HOME}/Desktop, ~/Desktop (menos o glob "~/Desktop/**" das regras de
// bloqueio do worker), [Environment]::GetFolderPath('Desktop') e homedir()/expanduser/Path.home + "Desktop" (T35, revisão da FRONT).
export const DESKTOP = new RegExp([
  String.raw`[A-Za-z]:[\\/]+Users[\\/]+[^\\/"'\s]+[\\/]+Desktop`,
  String.raw`%USERPROFILE%[\\/]+Desktop`,
  String.raw`\$env:USERPROFILE[\\/]+Desktop`,
  String.raw`\$\{?HOME\}?[\\/]+Desktop`,
  String.raw`~[\\/]Desktop\b(?![\\/]\*\*)`,
  String.raw`GetFolderPath\(\s*["']?(\[(System\.)?Environment\+SpecialFolder\]::)?Desktop`,
  String.raw`(homedir\(\)|expanduser\(\s*["']~["']\s*\)|Path\.home\(\))[^\n]{0,40}["']Desktop["']`,
].join("|"), "i");
