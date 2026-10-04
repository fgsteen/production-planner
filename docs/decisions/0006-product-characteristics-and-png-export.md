# 0006 — Product characteristics as data; PNG export of panels

- **Status:** accepted
- **Date:** 2026-10-04
- **Session:** S06

## Context
R17 makes every product one combination of characteristics X, Y and Z. The user decided (S06):
- the characteristics are **labels only**: demand and machine capabilities stay per product;
- the name **defaults to `X-Y-Z`** and can be overridden; clearing it goes back to the default;
- demo X variants are **K, L, M, N** (A and B are site names);
- headers in the demand and plan views show **names**, not ids.

R45 asks for a PNG download of every chart or table panel, at 2×, in the light theme.

## Decision
**Characteristics**
- `Dataset.characteristics`: an ordered list of `{ id, name, variants: { id, name }[] }`, at most 8
  variants each. Ids are stable (`X`, `X1` …), so renaming changes no references.
- `Product.variants` maps characteristic id → variant id. `Product.name` is the **custom** name;
  `''` means the default. `productName()` derives the shown name, so renamed variants carry
  through to every view.
- Validation: each product has a known variant per characteristic; no two products share a
  combination; names are unique; variant names are unique and non-empty within a characteristic.
- A variant in use can't be removed. A new product gets the first free combination.
- Files from before S06 still load: they get the demo characteristics, each product gets the next
  free combination, and its old name becomes its custom name.

**PNG export**
- One shared `Panel` component (title, hint, controls, download icon) for all chart and table
  panels. The Master data editor is not a panel.
- `html-to-image` renders the live DOM. It handles tables, CSS charts and the React Flow map
  alike. While it renders:
  - the panel gets `.light-theme`, which sets the light tokens on that subtree;
  - it gets `.png-export`, which expands scroll areas so wide or long tables export whole;
  - the panel's controls (`data-export-ignore`) are left out.
- The file is named `<panel-title>-<date>.png`.

## Consequences
- Product ids (P01 …) remain the keys in demand, capabilities, stock and the LP. Names are display
  only, so renaming never breaks data.
- With 20 products the per-product tables scroll sideways. Grouping (R44) is next.
- While a dark-mode panel renders to PNG, it shows in light colours for a moment.
