/* home.js — landing page wiring. Cards are static markup; this just routes
   choices to the results page via URL params (results.js reads them). */

document.querySelectorAll(".p-card").forEach((card) => {
  card.addEventListener("click", () => {
    location.href = `results.html?persona=${card.dataset.persona}`;
  });
});

const input = document.getElementById("describe-input");
const go = () => {
  if (!input.value.trim()) { input.focus(); return; }
  location.href = `results.html?q=${encodeURIComponent(input.value.trim())}`;
};
document.getElementById("describe-go").addEventListener("click", go);
input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });

// Nav CTA + footnote link scroll to the persona picker.
const toPersonas = (e) => {
  e.preventDefault();
  document.getElementById("personas").scrollIntoView({ behavior: "smooth", block: "start" });
};
document.getElementById("nav-get").addEventListener("click", toPersonas);
document.getElementById("foot-more").addEventListener("click", toPersonas);
