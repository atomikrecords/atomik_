import SwiftUI
import RealityKit

struct ContentView: View {
    var body: some View {
        if #available(iOS 17.0, *) {
            ScannerFlowView()
        } else {
            UnsupportedView(message: "Object Scanner needs iOS 17 or later.")
        }
    }
}

@available(iOS 17.0, *)
private struct ScannerFlowView: View {
    @StateObject private var controller = ScanController()

    var body: some View {
        Group {
            if !ScanController.isSupported {
                UnsupportedView(message: "This device can't scan objects. Object Capture needs an iPhone Pro with a LiDAR sensor.")
            } else {
                switch controller.phase {
                case .welcome:
                    WelcomeView { controller.startCapture() }
                case .capturing:
                    CaptureView(controller: controller)
                case .reconstructing:
                    ReconstructionView(progress: controller.reconstructionProgress)
                case .viewing:
                    if let url = controller.modelURL {
                        ModelViewerView(modelURL: url) { controller.reset() }
                    }
                case .failed(let message):
                    ErrorView(message: message) { controller.reset() }
                }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: controller.phase)
    }
}

// MARK: - Simple screens

struct WelcomeView: View {
    var onStart: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "cube.transparent")
                .font(.system(size: 72, weight: .thin))
                .foregroundStyle(.white)
            VStack(spacing: 8) {
                Text("Object Scanner")
                    .font(.largeTitle.weight(.semibold))
                Text("Put the object on a flat, well-lit surface, then walk slowly around it while keeping it centered.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
            Spacer()
            Button(action: onStart) {
                Text("Start Scan")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .padding(.horizontal, 32)
            .padding(.bottom, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}

struct UnsupportedView: View {
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48, weight: .thin))
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}

struct ErrorView: View {
    let message: String
    var onRestart: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48, weight: .thin))
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 40)
            Spacer()
            Button("Start Over", action: onRestart)
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .padding(.bottom, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}
