# Mealz public SDK — reference material

These files are copied verbatim from the public npm package `webc-miam@10.9.0`
(the `interfaces/` folder they ship), under GNU GPLv3. They are kept here **only
as a reference** to document how this project's `MealzSource` adapter was aligned
with Mealz's real public contract, rather than invented.

Source: https://www.npmjs.com/package/webc-miam  (repo: gitlab.com/miam/ng-miam-sdk)

Nothing in this folder is imported by the project's own code. The adapter
re-expresses the relevant shapes (notably `ComparableProduct`) as our own types
in `src/mealz/`.
