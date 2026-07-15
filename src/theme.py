"""Samsung-inspired theme for the GalaxyMatch AI notebook UI.

Owned by Member 3 (UI). Injects a single <style> block into notebook output:
self-hosted Onest font (SamsungOne-style look-alike), a Material-3-inspired
dark palette built from Samsung's blue, and the CSS animations that make the
result cards, meters, and loading state feel alive. Pure CSS only (no
injected <script>) so it renders identically across classic Notebook,
JupyterLab, and the VS Code Jupyter extension.
"""

import base64
from pathlib import Path

from IPython.display import HTML, display

_FONT_PATH = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "Onest-Variable.ttf"

# Thin-line icons matching Material Symbols' outlined style, inlined as SVG
# so no icon font/CDN dependency is needed.
ICONS = {
    "camera": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">'
    '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>'
    '<circle cx="12" cy="14" r="3.5"/></svg>',
    "balance": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">'
    '<path d="M12 3v18M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0zM5 8h14M9 21h6"/></svg>',
    "bolt": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">'
    '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
    "star": '<svg viewBox="0 0 24 24" fill="currentColor">'
    '<path d="M12 2l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.3 5.8 20.7l1.6-6.9L2.1 9.1l7-.7z"/></svg>',
    "briefcase": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">'
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
    "wallet": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">'
    '<path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
    '<circle cx="16" cy="13" r="1.2"/></svg>',
}


def _font_base64() -> str:
    return base64.b64encode(_FONT_PATH.read_bytes()).decode("ascii")


def build_theme_css() -> str:
    """Returns the full <style> block as a string (also usable standalone/for tests)."""
    return f"""
<style>
@font-face {{
  font-family: 'Onest';
  font-weight: 100 900;
  font-style: normal;
  src: url(data:font/ttf;base64,{_font_base64()}) format('truetype-variations');
  font-display: swap;
}}

:root {{
  --gm-background: #11131f;
  --gm-surface-container-lowest: #0b0d19;
  --gm-surface-container-low: #191b27;
  --gm-surface-container: #1d1f2c;
  --gm-surface-container-high: #272936;
  --gm-surface-container-highest: #323441;
  --gm-outline: #8f8f9f;
  --gm-outline-variant: #454653;
  --gm-on-surface: #e1e1f3;
  --gm-on-surface-variant: #c5c5d5;
  --gm-primary: #bcc3ff;
  --gm-on-primary: #011a97;
  --gm-primary-container: #1428a0;
  --gm-on-primary-container: #8f9cff;
  --gm-secondary: #96ccff;
  --gm-tertiary: #ffb4a1;
  --gm-radius-lg: 20px;
  --gm-radius-md: 12px;
  --gm-radius-full: 9999px;
  --gm-font: 'Onest', 'Segoe UI', system-ui, sans-serif;
}}

.gm-wrap {{
  font-family: var(--gm-font);
  background: var(--gm-background);
  color: var(--gm-on-surface);
  padding: 28px 28px 36px;
  border-radius: var(--gm-radius-lg);
  line-height: 1.5;
}}
.gm-wrap * {{ box-sizing: border-box; }}

/* Hero */
.gm-hero {{ text-align: center; margin-bottom: 32px; }}
.gm-eyebrow {{
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--gm-primary); margin-bottom: 10px;
}}
.gm-eyebrow svg {{ width: 13px; height: 13px; }}
.gm-title {{
  font-weight: 700; font-size: clamp(30px, 4vw, 44px); line-height: 1.08; letter-spacing: -0.02em;
  margin: 0 0 10px; color: var(--gm-on-surface);
}}
.gm-title span {{ color: var(--gm-primary); }}
.gm-tagline {{ font-size: 16px; color: var(--gm-on-surface-variant); max-width: 46ch; margin: 0 auto; }}

/* Persona bio card (shown next to the persona dropdown) */
.gm-persona-bio {{
  border: 1px solid var(--gm-outline-variant); background: var(--gm-surface-container-low);
  border-radius: var(--gm-radius-md); padding: 14px 16px; margin-top: 10px; display: flex; gap: 12px; align-items: flex-start;
}}
.gm-persona-avatar {{
  flex: none; width: 36px; height: 36px; border-radius: 50%;
  background: var(--gm-primary-container); color: var(--gm-on-primary-container);
  font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center;
}}
.gm-persona-name {{ font-weight: 600; font-size: 14.5px; color: var(--gm-on-surface); margin: 0 0 2px; }}
.gm-persona-need {{ font-size: 12.5px; color: var(--gm-on-surface-variant); margin: 0 0 4px; }}
.gm-persona-budget {{ font-size: 11.5px; color: var(--gm-primary); font-weight: 600; font-variant-numeric: tabular-nums; }}

/* Loading state */
.gm-thinking {{ display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 13px; color: var(--gm-primary); padding: 10px 2px; }}
.gm-thinking .gm-dots {{ display: flex; gap: 4px; }}
.gm-thinking .gm-dots span {{ width: 6px; height: 6px; border-radius: 50%; background: var(--gm-primary); animation: gm-bounce 1s infinite ease-in-out; }}
.gm-thinking .gm-dots span:nth-child(2) {{ animation-delay: 0.15s; }}
.gm-thinking .gm-dots span:nth-child(3) {{ animation-delay: 0.3s; }}
@keyframes gm-bounce {{ 0%, 80%, 100% {{ transform: translateY(0); opacity: 0.5; }} 40% {{ transform: translateY(-5px); opacity: 1; }} }}

/* Results header */
.gm-results-header {{ text-align: center; margin: 28px 0 18px; }}
.gm-results-header h2 {{ font-size: clamp(22px, 3vw, 30px); font-weight: 700; margin: 0 0 6px; letter-spacing: -0.01em; }}
.gm-results-header p {{ color: var(--gm-on-surface-variant); font-size: 14px; margin: 0; }}

/* Result cards */
.gm-cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; align-items: stretch; }}
.gm-card {{
  background: var(--gm-surface-container-low); border: 1px solid var(--gm-outline-variant);
  border-top: 1px solid rgba(255,255,255,0.15);
  border-radius: var(--gm-radius-lg); padding: 26px 20px 20px; position: relative; overflow: hidden;
  display: flex; flex-direction: column;
  opacity: 0; transform: translateY(16px);
  animation: gm-rise 0.55s cubic-bezier(.2,.7,.3,1) forwards;
  transition: transform 0.35s cubic-bezier(.34,1.4,.4,1), box-shadow 0.35s ease;
}}
.gm-card:hover {{ transform: translateY(-4px); }}
.gm-card:nth-child(1) {{ animation-delay: 0s; }}
.gm-card:nth-child(2) {{ animation-delay: 0.09s; }}
.gm-card:nth-child(3) {{ animation-delay: 0.18s; }}
@keyframes gm-rise {{ to {{ opacity: 1; transform: translateY(0); }} }}
.gm-card.gm-best {{ border-color: transparent; box-shadow: 0 0 0 1.5px rgba(188,195,255,0.4), 0 0 40px rgba(188,195,255,0.16); }}
.gm-card.gm-best:hover {{ box-shadow: 0 0 0 1.5px rgba(188,195,255,0.55), 0 0 56px rgba(188,195,255,0.24); }}
.gm-ghost-rank {{ position: absolute; top: 0; left: 16px; font-size: 72px; font-weight: 700; line-height: 1; color: rgba(255,255,255,0.05); user-select: none; }}
.gm-card.gm-best .gm-ghost-rank {{ color: rgba(188,195,255,0.1); }}

.gm-card-top {{ display: flex; justify-content: space-between; align-items: flex-start; z-index: 1; margin-bottom: 18px; }}
.gm-tag-chip {{
  display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 10px; border-radius: var(--gm-radius-full);
  background: var(--gm-surface-container); border: 1px solid var(--gm-outline-variant); color: var(--gm-on-surface-variant);
}}
.gm-tag-chip svg {{ width: 11px; height: 11px; }}
.gm-card.gm-best .gm-tag-chip {{ background: rgba(20,40,160,0.35); border-color: rgba(188,195,255,0.3); color: var(--gm-primary); }}
.gm-card-top .gm-icon {{ color: var(--gm-on-surface-variant); }}
.gm-card-top .gm-icon svg {{ width: 22px; height: 22px; }}
.gm-card.gm-best .gm-card-top .gm-icon {{ color: var(--gm-primary); }}

.gm-phone-render {{ position: relative; height: 110px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; z-index: 1; }}
.gm-phone-glow {{ position: absolute; width: 70%; height: 70%; border-radius: 50%; filter: blur(40px); opacity: 0.5; }}
.gm-phone-shape {{
  position: relative; width: 46px; height: 96px; border-radius: 13px;
  background: linear-gradient(160deg, var(--gm-surface-container-highest), var(--gm-surface-container));
  border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 16px 30px -12px rgba(0,0,0,0.6);
}}

.gm-phone-name {{ font-size: 20px; font-weight: 600; margin: 0 0 4px; color: var(--gm-on-surface); z-index: 1; }}
.gm-phone-sub {{ font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gm-primary); margin: 0 0 8px; z-index: 1; }}
.gm-explanation {{ font-size: 13.5px; color: var(--gm-on-surface-variant); margin: 0 0 12px; line-height: 1.5; z-index: 1; }}

.gm-meter-label {{ display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; z-index: 1; }}
.gm-meter-label span:first-child {{ color: var(--gm-on-surface-variant); }}
.gm-meter-track {{ height: 4px; background: var(--gm-surface-container-highest); border-radius: var(--gm-radius-full); overflow: hidden; z-index: 1; }}
.gm-meter-fill {{ height: 100%; border-radius: var(--gm-radius-full); position: relative; }}
.gm-meter-fill .gm-edge {{ position: absolute; right: 0; top: 0; bottom: 0; width: 12px; background: rgba(255,255,255,0.6); filter: blur(2px); }}

.gm-spec-strip {{
  z-index: 1; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--gm-outline-variant);
  display: flex; justify-content: space-between; font-size: 10.5px; color: var(--gm-on-surface-variant);
  font-variant-numeric: tabular-nums;
}}
.gm-spec-strip > div {{ display: flex; flex-direction: column; gap: 2px; }}
.gm-spec-strip b {{ font-size: 12.5px; font-weight: 600; color: var(--gm-on-surface); }}
.gm-card.gm-best .gm-spec-strip b {{ color: var(--gm-primary); }}

/* Score breakdown (details/summary — pure HTML, no JS needed) */
.gm-breakdown {{ margin-top: 12px; z-index: 1; }}
.gm-breakdown summary {{
  cursor: pointer; font-size: 12px; font-weight: 600; color: var(--gm-primary); list-style: none;
  display: flex; align-items: center; gap: 6px;
}}
.gm-breakdown summary::-webkit-details-marker {{ display: none; }}
.gm-breakdown summary::before {{ content: "▸"; font-size: 10px; transition: transform 0.15s ease; }}
.gm-breakdown[open] summary::before {{ transform: rotate(90deg); }}
.gm-sub-row {{ display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--gm-on-surface-variant); margin-top: 8px; }}
.gm-sub-row .gm-sub-label {{ width: 78px; flex: none; }}
.gm-sub-track {{ flex: 1; height: 3px; background: var(--gm-surface-container-highest); border-radius: var(--gm-radius-full); overflow: hidden; }}
.gm-sub-fill {{ height: 100%; background: var(--gm-secondary); border-radius: var(--gm-radius-full); }}
.gm-sub-val {{ width: 2.4em; text-align: right; font-variant-numeric: tabular-nums; }}

/* All-personas overview grid */
.gm-overview {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 8px; }}
.gm-overview-cell {{
  background: var(--gm-surface-container-low); border: 1px solid var(--gm-outline-variant);
  border-radius: var(--gm-radius-md); padding: 12px 14px;
}}
.gm-overview-cell .gm-ov-persona {{ font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gm-on-surface-variant); margin: 0 0 4px; }}
.gm-overview-cell .gm-ov-phone {{ font-size: 15px; font-weight: 600; color: var(--gm-on-surface); margin: 0; }}
.gm-overview-cell .gm-ov-pct {{ font-size: 12px; color: var(--gm-primary); font-weight: 600; }}

/* Compare table */
.gm-compare-table {{ width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }}
.gm-compare-table th, .gm-compare-table td {{ text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--gm-outline-variant); }}
.gm-compare-table th {{ color: var(--gm-on-surface-variant); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }}
.gm-compare-table td {{ color: var(--gm-on-surface); font-variant-numeric: tabular-nums; }}

@media (prefers-reduced-motion: reduce) {{
  .gm-card {{ animation: none; opacity: 1; transform: none; }}
}}

/* Light-touch skinning of native ipywidgets controls, so Button/Dropdown/
   Textarea/Slider/Checkbox read as part of the same dark theme even though
   we don't fully replace their chrome (that's fragile across ipywidgets
   versions — see plan Step 8). */
.gm-widget-panel {{
  background: var(--gm-surface-container-low); border: 1px solid var(--gm-outline-variant);
  border-radius: var(--gm-radius-lg); padding: 18px 20px; font-family: var(--gm-font);
}}
.gm-widget-panel .widget-label, .gm-widget-panel label {{ color: var(--gm-on-surface-variant) !important; font-family: var(--gm-font) !important; }}
.gm-widget-panel .widget-button, .gm-widget-panel button.jupyter-button {{
  font-family: var(--gm-font) !important; border-radius: var(--gm-radius-full) !important; font-weight: 600 !important;
}}
.gm-widget-panel .widget-button.mod-primary {{
  background: var(--gm-primary) !important; color: var(--gm-on-primary) !important; border: none !important;
}}
.gm-widget-panel .widget-textarea textarea, .gm-widget-panel .widget-dropdown select, .gm-widget-panel .widget-text input {{
  background: var(--gm-surface-container) !important; color: var(--gm-on-surface) !important;
  border: 1px solid var(--gm-outline-variant) !important; border-radius: var(--gm-radius-md) !important;
  font-family: var(--gm-font) !important;
}}
.gm-widget-panel .widget-checkbox input {{ accent-color: var(--gm-primary); }}
.gm-widget-panel .widget-hslider .slider, .gm-widget-panel .ui-slider {{ background: var(--gm-surface-container-highest) !important; }}
.gm-widget-panel .ui-slider-handle {{ background: var(--gm-primary) !important; border: none !important; }}
</style>
"""


def inject_theme() -> None:
    """Call once near the top of the notebook to load fonts/colors/animations."""
    display(HTML(build_theme_css()))


def icon(name: str) -> str:
    return ICONS.get(name, "")
