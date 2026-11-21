// Conventional Commits für alle Commits auf main (CHAOS-156): semantic-release liest daraus die Version
// der Mac-App. Typen und Aufbau wie @commitlint/config-conventional, angepasst an deutsche Texte:
// Betreff darf groß beginnen (Substantive), Text und Fußzeilen ohne Längengrenze (Co-Authored-By, Links).
//
// Merge-Commits sind ausgenommen (CLAUDE.md). Die Standard-Ausnahmen von commitlint erkennen nur
// „Merge branch …“, „Merge remote-tracking branch …“ und „Merge … into …“; „Merge origin/main in
// <branch>“ (deutsch „in“, CHAOS-89) ist dieselbe Art Commit und zählt hier ebenso.
export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => /^Merge \S+ (in|into) \S+(\r?\n|$)/.test(message)],
  rules: {
    'subject-case': [0],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
