// Compiles one formula on its own, so a failing formula is found before it
// breaks a whole document. Inputs: mode (typst | mitex), src.
#set page(width: auto, height: auto, margin: 4pt)
#set text(font: "Liberation Sans", size: 12pt, lang: "id")
#show math.equation: set text(font: "New Computer Modern Math")
#let src = sys.inputs.at("src")
#if sys.inputs.at("mode") == "mitex" {
  import "@preview/mitex:0.2.7": mitex
  mitex(src)
} else {
  math.equation(block: true, eval(src, mode: "math"))
}
