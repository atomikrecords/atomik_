# Object Scanner (iOS)

A minimal SwiftUI app that 3D-scans a physical object with the iPhone camera and
LiDAR, then lets you rotate and zoom around the finished model.

It leans entirely on Apple's native stack rather than reimplementing scanning:

- **RealityKit `ObjectCaptureSession`** — guided capture with the built-in
  bounding-box/dial overlay, LiDAR-assisted pose tracking, automatic shot
  triggering as you walk around the object, and live feedback ("move closer",
  "slow down").
- **`ObjectCapturePointCloudView`** — the live, progressively-built 3D preview
  you can toggle to mid-scan.
- **`PhotogrammetrySession`** — on-device reconstruction of the captured images
  into a `.usdz` model, with a progress readout.
- **SceneKit** — the finished-model viewer: drag to orbit, pinch to zoom, two
  fingers to pan.

## Flow

1. **Welcome** — one button, plus a line on how to place the object.
2. **Capture** — frame the object, tap *Start Capture*, then walk slowly around
   it. A progress bar and shot count track the pass; the guidance pill relays
   the session's feedback. Once a full pass is done you can add another pass
   (flip the object to get its underside) or finish.
3. **Reconstructing** — a percentage ring while `PhotogrammetrySession` builds
   the USDZ.
4. **Viewer** — free rotate/zoom/pan around the model, share the `.usdz`, or
   start a new scan.

## Requirements

- Xcode 15 or later, iOS 17 or later.
- A LiDAR-equipped iPhone Pro (iPhone 12 Pro or newer). `ObjectCaptureSession`
  and on-device `PhotogrammetrySession` both gate on this; the app shows an
  unsupported screen otherwise. It cannot run in the Simulator.

## Running it

```
open ObjectScanner/ObjectScanner.xcodeproj
```

Set your own team under *Signing & Capabilities* (the bundle id is
`com.atomik.objectscanner`), then build to a device. The camera usage string is
generated into the Info.plist by the build settings.

## Source layout

| File | Role |
| --- | --- |
| `ObjectScannerApp.swift` | App entry point. |
| `ContentView.swift` | Phase switch plus the welcome/error/unsupported screens. |
| `ScanController.swift` | Owns the capture session, the reconstruction task, and the phase state machine. |
| `CaptureView.swift` | Live camera/point-cloud view with the minimal overlay. |
| `ReconstructionView.swift` | Progress ring during reconstruction. |
| `ModelViewerView.swift` | SceneKit turntable viewer for the finished USDZ. |
