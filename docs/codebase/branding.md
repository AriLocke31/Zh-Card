# App branding

The app header and browser favicon share public/brand/zh-card-mahjong.png, a transparent PNG generated with the built-in image_gen tool. The header replaces the former Chinese Dictionary text with an image inside h1, using 中纸 as its accessible alternative text. index.html also sets the tab title to 中纸. No cloud or API changes are required.

## Generation prompt

Use case: logo-brand. Asset type: app header logo and favicon, square raster PNG with transparent background. Create a single upright mahjong tile, viewed almost straight-on with a subtle visible bevel and restrained dimensional depth. Ivory ceramic face, rounded corners, thin dark green base edge, elegant red engraved Chinese characters. Text (verbatim): "中纸", with 中 above 纸, both large and precisely legible, centered on the same tile. Use the simplified character 纸 exactly, not 紙. Clean polished mahjong aesthetic, bold strokes recognizable at small icon sizes, minimal shadow, tightly framed with small transparent margins. Only one tile, no other symbols, no English text, no watermark. Genuine transparent background.

## Final correction prompt

Correct the lower Chinese character only: it MUST be simplified 纸 (U+7EB8), with the simplified radical 纟 on the left (three simple strokes), NOT traditional 紙 with 糸 on the left. Exact text is 中纸, stacked vertically. Keep the same single ivory mahjong tile, red engraving, green edge, rounded corners, composition and transparent background. Make the simplified left radical unmistakable. No other changes.

## Procedural paper background

src/theme.ts applies the body background through MuiCssBaseline, which is mounted once in main.tsx. A warm yellow-ochre base (#d2ae70), broad translucent brown/cream radial gradients, overlapping smaller mottling, fine offset speckles, and low-opacity linear fibers create an uneven aged-paper texture. The background fills the viewport and remains continuous behind scrolling content; html/body/root minimum heights cover short pages as well. No image, SVG, canvas, or external texture asset is used.

## Printed ink

src/styles/printedInk.ts exports printedInkSx for the masthead and WordThumb text. A fine translucent radial gradient clipped to the glyphs varies ink coverage while revealing the paper beneath, and a subpixel warm shadow suggests slight ink bleed. Other UI text remains unchanged. Unsupported background clipping falls back to solid warm charcoal; forced-color mode restores plain system text. The effect uses CSS only and preserves selectable, accessible text.
