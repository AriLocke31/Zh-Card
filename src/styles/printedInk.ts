/** Subtle ink coverage and bleed; ordinary text remains the fallback. */
export const printedInkSx = {
  color: "#30251b",
  textShadow: "0.25px 0.35px 0.45px rgba(48, 31, 15, 0.18)",
  "@supports ((background-clip: text) or (-webkit-background-clip: text))": {
    // Text-clipped, translucent pigment lets the actual paper show through.
    backgroundImage: "radial-gradient(ellipse at 35% 40%, rgba(48, 37, 27, 0.42) 0.45px, rgba(48, 37, 27, 0.78) 0.8px, rgba(48, 37, 27, 0.96) 1.4px)",
    backgroundSize: "4.3px 5.7px",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  "@media (forced-colors: active)": {
    backgroundImage: "none",
    WebkitTextFillColor: "currentColor",
    color: "CanvasText",
    textShadow: "none",
  },
};
