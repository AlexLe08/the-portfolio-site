// Kept in code rather than in site_content: the header renders on every
// route from the root layout, and reading /content there would make every
// page (including static ones) wait on the backend. These rarely change.
export const PROFILE_LINKS = {
  github: "https://github.com/AlexLe08",
  linkedin: "https://www.linkedin.com/in/alexander-le-65a1b89a",
};
