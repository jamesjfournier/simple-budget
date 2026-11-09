# 💰 Simple Budget

### Personal Finance & Budget Management for macOS, Windows, and Linux

**A simple, private, and intuitive desktop application designed to help you take control of your finances.**

Simple Budget is a cross-platform personal finance application that makes it easier to manage your money, track debt, plan paychecks, and work toward your financial goals.

Designed with simplicity and privacy in mind, the application brings your essential financial information into one easy-to-use dashboard. Whether you're paying down debt, building an emergency fund, or saving for a major purchase, Simple Budget helps you understand where your money is going and make informed financial decisions.

The goal is simple: **take the guesswork out of budgeting and make every paycheck count.**

![Version](https://img.shields.io/badge/Version-1.0-blue?style=flat-square)
![macOS](https://img.shields.io/badge/macOS-13%2B-000000?style=flat-square&logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011-0078D6?style=flat-square&logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-x64%20%2F%20ARM64-FCC624?style=flat-square&logo=linux&logoColor=black)
![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-success?style=flat-square)
![License](https://img.shields.io/badge/Version-1.0-blue?style=flat-square)

---

## 🖥️ Application Overview

![Simple Budget Main Dashboard](assets/app-main-view.png)

Simple Budget provides a centralized dashboard for monitoring your financial position.

From a single interface, you can see how much money remains after your latest paycheck, track outstanding debts, monitor savings and investment goals, and keep an eye on your credit score.

The application begins with a guided setup that helps you enter your income, recurring expenses, outstanding debts, and financial goals.

Once configured, Simple Budget uses that information to help you plan how to distribute future paychecks.

---

## ✨ Features

### 📊 Financial Dashboard

Get a clear overview of your finances without navigating through complicated spreadsheets.

- View funds remaining after your latest paycheck.
- Monitor outstanding debt balances.
- Track progress toward savings goals.
- Visualize investment contributions.
- Monitor your manually entered credit score.
- Review your overall financial position in one place.

### 💵 Intelligent Paycheck Planning

Make every paycheck work toward your financial priorities.

- Supports biweekly and monthly pay schedules.
- Automatically suggests how to distribute each paycheck.
- Prioritizes upcoming bills and minimum debt payments.
- Maintains an everyday spending buffer.
- Allocates remaining funds toward debt repayment, savings, and investments.
- Allows manual adjustments before recording a paycheck.

### 💳 Debt Management

Stay organized and make progress toward becoming debt-free.

- Track multiple outstanding debts.
- Monitor remaining balances.
- Configure optional recurring minimum payments.
- Visualize debt repayment progress.

### 📅 Expense Tracking

Keep recurring financial obligations organized.

- Track bills and regular expenses.
- Supports weekly, biweekly, and monthly payment schedules.
- Configure optional minimum payment amounts.
- Include upcoming obligations in paycheck planning.

### 🎯 Savings & Investment Goals

Turn long-term financial objectives into measurable progress.

- Set a personal savings goal.
- Establish an investment target.
- Monitor progress using dedicated charts.
- Include savings and investments in paycheck allocation suggestions.

### 📈 Credit Score Monitoring

Keep track of your credit-building journey.

- Manually record your credit score.
- View your recorded score within the application.
- Receive a reminder to update your score after 31 days.

### 🔒 Privacy-First Design

Your financial information belongs to you.

- No account registration.
- No cloud storage.
- No external server required.
- No bank account connection.
- No subscription required.
- Financial data remains stored locally on your device.

---

## 📸 Application Walkthrough

A closer look at the features that make Simple Budget useful for everyday financial management.

<table>
  <tr>
    <td width="50%" align="center">
      <b>01. Financial Dashboard</b>
      <br><br>
      <img src="assets/dashboard.png" alt="Simple Budget Financial Dashboard" width="100%">
      <br><br>
      Monitor your finances, outstanding debt, and available funds.
    </td>
    <td width="50%" align="center">
      <b>02. Paycheck Planning</b>
      <br><br>
      <img src="assets/paycheck-planning.png" alt="Simple Budget Paycheck Planning" width="100%">
      <br><br>
      Review and customize suggested paycheck allocations.
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <b>03. Debt Management</b>
      <br><br>
      <img src="assets/debt-management.png" alt="Simple Budget Debt Management" width="100%">
      <br><br>
      Track balances and monitor debt repayment progress.
    </td>
    <td width="50%" align="center">
      <b>04. Savings & Investments</b>
      <br><br>
      <img src="assets/savings-investments.png" alt="Simple Budget Savings and Investments" width="100%">
      <br><br>
      Visualize progress toward your personal financial goals.
    </td>
  </tr>
</table>

---

## ⚙️ How It Works

Simple Budget follows a straightforward workflow designed around your personal financial situation.

**Step 1: Set Up Your Budget**

Complete the initial setup by entering your pay schedule, recurring expenses, outstanding debts, and financial goals.

**Step 2: Review Your Dashboard**

See your financial information organized into one dashboard, including remaining funds, debt balances, and goal progress.

**Step 3: Plan Your Paycheck**

When you receive a paycheck, Simple Budget calculates a suggested distribution based on your upcoming bills, minimum payments, and financial priorities.

**Step 4: Customize Your Allocations**

Adjust any suggested amount to match your current needs before recording the paycheck.

**Step 5: Track Your Progress**

As you continue using the application, monitor your debt repayment, savings contributions, investment progress, and credit score.

---

## 🛠️ Technical Specifications

| Component | Specification |
|---|---|
| Application | Simple Budget |
| Version | 1.0 |
| Platforms | macOS, Windows, Linux |
| macOS Support | macOS 13 or newer |
| Windows Support | Windows 10 / 11, 64-bit |
| Linux Support | AMD64 / ARM64 |
| Application Type | Standalone desktop application |
| Local Storage Key | `budget-app-v1` |
| Backup Format | JSON |
| macOS Architecture | Universal (Intel & Apple Silicon) |
| Windows Runtime | Microsoft Edge WebView2 |
| Linux Browser Support | Chrome, Chromium, Edge, Brave |
| Desktop Build Requirements | Go 1.26+ |
| macOS Build Requirements | Xcode Command Line Tools |
| Automated Testing | Node.js built-in test runner |
| macOS Bundle ID | `com.jamesfournier.budget` |

Simple Budget operates locally without requiring a backend server, user account, or cloud-based service.

---

## 💾 Data Storage & Backups

Simple Budget stores your budget locally using the storage key `budget-app-v1`.

You can manage your financial information directly through the application's **File** menu.

| Action | Description |
|---|---|
| **File > Backup Budget** | Export your current budget to a JSON file. |
| **File > Import Budget** | Restore a previously exported budget, with confirmation before replacing existing information. |
| **File > Reset Budget** | Clear the current budget and return to the initial setup. |

**Important:** Budget information is stored locally and is not automatically synchronized between devices. Regular JSON backups are recommended.

---

## 🚀 Installation & Setup

Simple Budget supports macOS, Windows, and Linux.

### 🍎 macOS

**Requirements**

- macOS 13 Ventura or newer.
- Intel or Apple Silicon processor.

**Build from source**

With the Xcode Command Line Tools installed, run:

```bash
./scripts/build-mac-app.sh
```

The build process generates:

```text
dist/
├── Simple Budget.app
└── Simple Budget 1.0.dmg
```

The application is built as a universal macOS binary, supporting both Intel and Apple Silicon Macs.

**Note:** The macOS application is ad-hoc signed. When opening it on another Mac for the first time, Control-click the application and select **Open**.

The bundle identifier `com.jamesfournier.budget` remains consistent between builds to preserve existing saved budget data when updating the application.

### 🪟 Windows

**Requirements**

- Windows 10 or Windows 11, 64-bit.
- Microsoft Edge WebView2 Runtime.

**Application executable**

```text
releases/windows/Simple Budget.exe
```

Launch `Simple Budget.exe` to open the application in its own desktop window.

Windows 11 includes the required WebView2 Runtime, and most up-to-date Windows 10 installations already have it installed.

If the application window does not appear, install the runtime from Microsoft:

[Download Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)

**Note:** Windows may display a security warning because the application is unsigned. If you trust the executable and its source, select **More info > Run anyway**.

Budget data is stored locally on the Windows computer.

### 🐧 Linux

Simple Budget includes builds for two Linux architectures.

| Architecture | Executable |
|---|---|
| AMD64 (Intel / AMD 64-bit) | `releases/linux/simple-budget-amd64` |
| ARM64 (including Raspberry Pi 4+) | `releases/linux/simple-budget-arm64` |

**Run the application**

For AMD64 systems:

```bash
chmod +x simple-budget-amd64
./simple-budget-amd64
```

For ARM64 systems, use `simple-budget-arm64` instead.

If Chrome, Chromium, Edge, or Brave is installed, Simple Budget opens in a dedicated application window.

Otherwise, it opens using your default web browser.

Budget backups, imports, and resets are accessible through the application's File menu.

---

## 🌐 Run in a Browser

Simple Budget can also run locally in a web browser for development and testing.

From the project directory, start a local HTTP server:

```bash
python3 -m http.server 5173
```

Open:

http://127.0.0.1:5173

Alternatively, start the development server using:

```bash
npm start
```

**Note:** The browser version maintains its own locally saved budget, separate from the macOS desktop application.

---

## 🔨 Building Windows & Linux Applications

Windows and Linux desktop executables can be generated using Go 1.26 or newer.

Run:

```bash
./scripts/build-desktop.sh
```

The build process generates:

```text
dist/
├── windows/
│   └── Simple Budget.exe
│
└── linux/
    ├── simple-budget-amd64
    └── simple-budget-arm64
```

The build script can generate all three executables from macOS.

The macOS application is built separately using:

```bash
./scripts/build-mac-app.sh
```

---

## 🧪 Testing

Simple Budget includes automated tests for its budgeting functionality.

Run the test suite:

```bash
npm test
```

Or execute the tests directly:

```bash
node --test tests/budget.test.js
```

---

## 🏡 Designed for Everyday Financial Management

Simple Budget was created around a simple idea: personal finance software should make managing money easier, not more complicated.

Many budgeting tools depend on subscriptions, cloud services, or direct connections to financial institutions.

Simple Budget takes a different approach by providing a focused, locally operated application built around practical financial goals.

Its design emphasizes:

- **Simplicity:** An easy-to-understand interface without unnecessary complexity.
- **Privacy:** Financial
