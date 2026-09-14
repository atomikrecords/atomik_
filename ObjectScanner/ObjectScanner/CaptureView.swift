import SwiftUI
import RealityKit

/// Live capture screen: camera feed with Object Capture's guidance overlay,
/// a togglable point-cloud preview of the model as it builds up, and the
/// single contextual action button for the current stage.
@available(iOS 17.0, *)
struct CaptureView: View {
    @ObservedObject var controller: ScanController
    @State private var showsPointCloud = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let session = controller.session {
                Group {
                    if showsPointCloud {
                        ObjectCapturePointCloudView(session: session)
                            .transition(.opacity)
                    } else {
                        ObjectCaptureView(session: session)
                            .transition(.opacity)
                    }
                }
                .ignoresSafeArea()

                VStack {
                    topBar(session: session)
                    Spacer()
                    bottomBar(session: session)
                }
                .padding(.horizontal, 20)
                .onChange(of: session.state) { _, newState in
                    if newState == .ready { controller.beginDetecting() }
                    controller.handleSessionStateChange(newState)
                }
                .onAppear {
                    if session.state == .ready { controller.beginDetecting() }
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showsPointCloud)
    }

    // MARK: - Overlay

    @ViewBuilder
    private func topBar(session: ObjectCaptureSession) -> some View {
        HStack(alignment: .top) {
            Button {
                controller.reset()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .padding(10)
            }
            .buttonStyle(.plain)
            .background(.ultraThinMaterial, in: Circle())

            Spacer()

            Text(guidance(for: session))
                .font(.subheadline.weight(.medium))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial, in: Capsule())

            Spacer()

            Button {
                showsPointCloud.toggle()
            } label: {
                Image(systemName: showsPointCloud ? "camera" : "cube")
                    .font(.system(size: 15, weight: .semibold))
                    .padding(10)
            }
            .buttonStyle(.plain)
            .background(.ultraThinMaterial, in: Circle())
            .opacity(session.state == .capturing ? 1 : 0)
            .disabled(session.state != .capturing)
        }
        .foregroundStyle(.white)
        .padding(.top, 8)
    }

    @ViewBuilder
    private func bottomBar(session: ObjectCaptureSession) -> some View {
        VStack(spacing: 16) {
            if session.state == .capturing {
                VStack(spacing: 6) {
                    ProgressView(value: controller.captureProgress)
                        .tint(.white)
                    Text("\(controller.shotCount) photos captured")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.7))
                }
                .padding(.horizontal, 12)
            }

            switch session.state {
            case .detecting:
                actionButton("Start Capture") { controller.beginCapturing() }
            case .capturing:
                if controller.scanPassComplete {
                    HStack(spacing: 12) {
                        actionButton("Another Pass", prominent: false) {
                            controller.continueScanning()
                        }
                        actionButton("Finish") { controller.finishCapture() }
                    }
                } else {
                    actionButton("Finish", prominent: false) { controller.finishCapture() }
                }
            default:
                EmptyView()
            }
        }
        .padding(.bottom, 32)
    }

    private func actionButton(_ title: String,
                              prominent: Bool = true,
                              action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
        }
        .buttonStyle(.borderedProminent)
        .tint(prominent ? Color.accentColor : Color.white.opacity(0.18))
        .buttonBorderShape(.capsule)
    }

    // MARK: - Guidance copy

    private func guidance(for session: ObjectCaptureSession) -> String {
        switch session.state {
        case .initializing:
            return "Starting camera…"
        case .ready:
            return "Point at the object"
        case .detecting:
            return "Frame the whole object, then start"
        case .capturing:
            if let feedback = feedbackMessage(session.feedback) { return feedback }
            return controller.scanPassComplete
                ? "Pass complete — finish or flip the object"
                : "Move slowly around the object"
        case .finishing:
            return "Wrapping up…"
        case .completed:
            return "Capture complete"
        case .failed:
            return "Capture stopped"
        @unknown default:
            return ""
        }
    }

    private func feedbackMessage(_ feedback: Set<ObjectCaptureSession.Feedback>) -> String? {
        if feedback.contains(.objectTooFar) { return "Move closer" }
        if feedback.contains(.objectTooClose) { return "Move farther away" }
        if feedback.contains(.movingTooFast) { return "Slow down" }
        if feedback.contains(.environmentLowLight) { return "Needs more light" }
        if feedback.contains(.environmentTooDark) { return "Too dark" }
        if feedback.contains(.outOfFieldOfView) { return "Keep the object in frame" }
        return nil
    }
}
