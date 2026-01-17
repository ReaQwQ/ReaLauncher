# ReaLauncher

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/-React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/-Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/-Tailwind-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)

A Minecraft Launcher built with Electron, React, Vite, and TypeScript.

The design is inspired by the **Modrinth App**.
I really liked Modrinth's clean user interface, but I missed the ability to search specifically for **CurseForge** mods. I created ReaLauncher to combine that modern, easy-to-use experience with full CurseForge support.

## 📥 Download

**Currently, this application is for Windows only.**
You can download the latest installer from the **Releases** page.

[**Download Latest Version**](https://github.com/ReaQwQ/ReaLauncher/releases)

## 🌐 Language Support

ReaLauncher is available in **15 languages**:

* 🇺🇸 English (US)
* 🇯🇵 Japanese
* 🇪🇸 Spanish
* 🇫🇷 French
* 🇩🇪 German
* 🇮🇹 Italian
* 🇧🇷 Portuguese (Brazil)
* 🇷🇺 Russian
* 🇹🇷 Turkish
* 🇮🇳 Hindi
* 🇰🇷 Korean
* 🇸🇦 Arabic
* 🇨🇳 Chinese (Simplified)
* 🇹🇼 Chinese (Traditional)
* 🇮🇩 Indonesian

## 🛠️ Tech Stack

* **Electron**
* **React** + **TypeScript**
* **Vite**
* **Tailwind CSS**

## 🏗️ Development & Building

If you want to build the project from source, please follow the steps below.

### Prerequisites

* **Node.js** (Latest LTS recommended)
* **npm**

### ⚠️ Important: Enable Developer Mode

To build this project, you **must** enable Windows Developer Mode.
The build process uses symbolic links (specifically for `winCodeSign`), which requires this setting.

1.  Open Windows **Settings**.
2.  Go to **System** > **Privacy & Security** > **For developers**.
    *(Or simply search for "Developer settings" in the Start menu)*
3.  Turn on **Developer Mode**.

*If you do not enable this, the build will fail with a symbolic link error.*

### Build Instructions

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/ReaQwQ/ReaLauncher.git](https://github.com/ReaQwQ/ReaLauncher.git)
    cd ReaLauncher
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the application (Development Mode)**
    ```bash
    npm run dev
    ```

4.  **Build for production**
    To create the installer (`.exe`), run the following command:
    ```bash
    npm run build:ver 1.0.0
    ```
    *Note: The output files will be generated in the `release` folder.*

## 📄 License

This project is licensed under the MIT License.
