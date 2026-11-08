# Install OpenJarvis using only an Android phone

**Honest status:** the APK has **not been built yet**. These steps make GitHub build it for you (free). It is the first real build, so it may fail once — Step 7 tells you what to do if it does.

## Part A — Get the APK built (about 20 minutes, one time)

**1. GitHub account + empty repository**
* In your phone browser go to github.com and sign up / sign in.
* Open github.com/new → name it `openjarvis` → keep **Private** → do **not** tick "Add a README" → **Create repository**.

**2. Create a token (your password for the upload)**
* github.com → your photo → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token (classic).
* Note: `openjarvis`, Expiration: 7 days, tick **repo** and **workflow** → Generate. **Copy the token** (starts with `ghp_`). Never share it or paste it into any chat.

**3. Put the project in Termux**
* Install **Termux from F-Droid** (not Play Store). Open it and run:
```sh
termux-setup-storage
cp ~/storage/downloads/OpenJarvis.zip ~ && pkg install -y unzip git
unzip OpenJarvis.zip && cd OpenJarvis
```

**4. Upload (this starts the build automatically)**
```sh
sh scripts/publish-to-github.sh
```
Type your GitHub username, the repo name (`openjarvis`), and paste the token (it stays hidden).

**5. Watch the build**
* Open `github.com/<you>/openjarvis/actions` → the run *Build Android APK* → wait for a **green tick** (5–10 min).

**6. Download the APK**
* Open `github.com/<you>/openjarvis/releases/latest` → tap **OpenJarvis-debug.apk**.

**7. If the run is red:** open the run → tap the red step → copy the last ~40 lines of the log (or download the **build-log** artifact) and send them to me. The code gets fixed and you re-run Step 4 (it only uploads the changes).

## Part B — Install and start
1. Open the downloaded APK. If Android asks, allow **Install unknown apps** for your browser, then Install. (Play Protect may warn because it is an unsigned-by-store debug build; choose *Install anyway* only if you built it yourself as above.)
2. In Termux, every time you want to use OpenJarvis:
```sh
cd ~/OpenJarvis && termux-wake-lock && npm start
```
(first time only: `sh scripts/termux-setup.sh`). Leave Termux running.
3. Open the **OpenJarvis** app. It connects to the Termux server. If it says "server not reachable", the server is not running.
4. Follow the permission screens. Allow only what you want; every one can be skipped.
5. Add your API key: Menu → **Providers & API keys** → paste your own key → **Test connection**.

## Part C — Turn on screen control (optional, most powerful)
Android Settings → Accessibility → Installed apps → **OpenJarvis** → On.
If Android says "Restricted setting": Settings → Apps → OpenJarvis → ⋮ (top right) → **Allow restricted settings**, then try again. Turn it off any time in the same place, or press **Stop** in OpenJarvis's notification.

## Tips for a 2 GB phone
Close other apps first. Keep **Low-power mode** on (default on 2 GB devices). Use Cloud Mode for quality; Offline Mode only with the smallest model (Qwen2.5 0.5B) and expect it to be slow.
