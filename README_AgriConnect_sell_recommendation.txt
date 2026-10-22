AgriConnect Pakistan: deterministic crop-selling recommendation patch

Target file: lib/actions/natural-ai.ts

Apply from the project root:
  git apply AgriConnect_sell_recommendation.patch

Then inspect and test:
  git diff --check
  npm run lint
  npm run build

The patch makes sell-choice questions such as "inme sy koi aik btao konsi sell krney lgaoun?" use the farmer's recorded available crop stock, matching direct arhti offers, open arhti demand, and recorded mandi prices/trends. It recommends one crop and states which data supported the recommendation. If no active stock is recorded, it says so rather than inventing a crop.

The ranking is a practical heuristic, not a guaranteed profit prediction. Confirm price, deductions, and transport terms before accepting an offer.
