# Simple Budget

A local budgeting app for Mac. Version 1.0.

You answer a few questions about pay, debts, bills, and goals. The overview shows what is left after the last paycheck, how debts are coming down, and how close savings and investments are to their goals. When you get paid, Simple Budget suggests a split and you can change any amount before recording it.

Nothing leaves the computer. There is no account. The budget is stored in the app under the key `budget-app-v1`.

File > Backup Budget saves that budget as a JSON file. File > Import Budget asks before it replaces the budget you have now. File > Reset Budget clears it and returns to the first questions.

## What it tracks

- Pay every two weeks or once a month
- Debts, with an optional repeating minimum
- Expenses that can repeat weekly, every two weeks, or monthly, with an optional minimum
- A savings goal and an investment goal, each with its own chart
- A credit score you enter yourself, with a reminder 31 days later

Suggested paychecks cover bills and minimums that are due first, keep an everyday spending buffer, then split what is left across debts, savings, and investments.

## Run it in a browser

From this folder:

```bash
python3 -m http.server 5173
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). A browser tab keeps its own saved budget, separate from the Mac app.

## Test

```bash
node --test tests/budget.test.js
```

`npm test` runs the same command. `npm start` serves the app on port 5173.

## Build the Mac app

macOS 13 or later, with the Xcode command line tools:

```bash
./scripts/build-mac-app.sh
```

That writes a universal app (Intel and Apple silicon) to `dist/Simple Budget.app` and a disk image to `dist/Simple Budget 1.0.dmg`. The build is ad-hoc signed. On another Mac, Control-click the app and choose Open the first time.

The app bundle id stays `com.jamesfournier.budget`, so installing a new build over the old one keeps the saved budget.
