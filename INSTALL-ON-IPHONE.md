# Installing Object Scanner on your iPhone from a Windows PC

No Mac required. GitHub's Mac servers build the app; Sideloadly signs it with
your own Apple ID and installs it over USB.

## 1. Get the .ipa

1. Go to the repo on GitHub → **Actions** tab.
2. Pick the **Build Object Scanner IPA** workflow → the most recent run.
   (No run yet? Click *Run workflow* on the right to start one.)
3. Wait for the green check — roughly 3-5 minutes.
4. At the bottom of the run page, under **Artifacts**, download
   `ObjectScanner-unsigned-ipa`. It arrives as a .zip — unzip it to get
   `ObjectScanner-unsigned.ipa`.

## 2. One-time Windows setup

Sideloadly needs Apple's drivers, and it needs the *standalone* versions —
the Microsoft Store versions of iTunes will not work.

1. Install iTunes from apple.com/itunes (the Windows download link near the
   bottom of the page, **not** the Microsoft Store).
2. Install iCloud for Windows from apple.com, also the direct download.
3. Install Sideloadly from sideloadly.io.

## 3. Install the app

1. Plug the iPhone into the PC, unlock it, tap **Trust** on the phone.
2. Open Sideloadly. The phone should appear in the device dropdown.
3. Drag `ObjectScanner-unsigned.ipa` onto the Sideloadly window.
4. Enter your Apple ID. It is sent to Apple to request a signing certificate,
   nothing else. If you use two-factor auth, Sideloadly will ask for the code,
   and you may need an app-specific password from appleid.apple.com.
5. Click **Start**. It signs and installs in a minute or two.
6. On the phone: **Settings → General → VPN & Device Management** → tap your
   Apple ID → **Trust**.
7. Launch Object Scanner from the home screen.

## Things worth knowing

- **It expires after 7 days.** Free Apple IDs get 7-day signatures. Re-run
  Sideloadly with the phone plugged in to refresh it — your scans stay put.
  A paid Apple Developer account ($99/yr) extends this to a year.
- **Three apps at a time.** A free Apple ID can hold three sideloaded apps.
- **LiDAR required.** iPhone 12 Pro or newer Pro model. On any other iPhone
  the app opens and tells you the device can't scan.
- **If Sideloadly can't see the phone**, it is almost always the iTunes
  version. Uninstall the Microsoft Store one, install the standalone.
