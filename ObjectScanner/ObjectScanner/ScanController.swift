import Foundation
import RealityKit
import SwiftUI
import os

/// Drives the whole scan: guided LiDAR/photo capture with `ObjectCaptureSession`,
/// then on-device reconstruction with `PhotogrammetrySession`.
@available(iOS 17.0, *)
@MainActor
final class ScanController: ObservableObject {

    enum Phase: Equatable {
        case welcome
        case capturing
        case reconstructing
        case viewing
        case failed(String)
    }

    @Published private(set) var phase: Phase = .welcome
    /// Live capture session. Observing `session.state` inside a SwiftUI body
    /// tracks changes automatically (it is `@Observable`).
    @Published private(set) var session: ObjectCaptureSession?
    @Published private(set) var reconstructionProgress: Double = 0
    @Published private(set) var modelURL: URL?

    /// Set to true once the user has walked a full pass around the object.
    var scanPassComplete: Bool { session?.userCompletedScanPass ?? false }

    /// 0...1 estimate of how much of the current pass has been captured.
    var captureProgress: Double {
        guard let session, session.maximumNumberOfInputImages > 0 else { return 0 }
        return min(1, Double(session.numberOfShotsTaken) / Double(session.maximumNumberOfInputImages))
    }

    var shotCount: Int { session?.numberOfShotsTaken ?? 0 }

    static var isSupported: Bool {
        ObjectCaptureSession.isSupported && PhotogrammetrySession.isSupported
    }

    private let logger = Logger(subsystem: "com.atomik.objectscanner", category: "scan")
    private var scanDirectory: URL?
    private var reconstructionTask: Task<Void, Never>?

    // MARK: - Capture

    func startCapture() {
        do {
            let root = try makeScanDirectory()
            scanDirectory = root

            let session = ObjectCaptureSession()
            var configuration = ObjectCaptureSession.Configuration()
            configuration.checkpointDirectory = root.appending(path: "Checkpoint/")
            configuration.isOverCaptureEnabled = true

            session.start(imagesDirectory: root.appending(path: "Images/"),
                          configuration: configuration)

            self.session = session
            self.modelURL = nil
            self.reconstructionProgress = 0
            self.phase = .capturing
        } catch {
            fail("Couldn't prepare storage for the scan. \(error.localizedDescription)")
        }
    }

    /// Moves from bounding-box detection into actual image capture.
    func beginDetecting() {
        guard let session, session.state == .ready else { return }
        _ = session.startDetecting()
    }

    func beginCapturing() {
        guard let session, session.state == .detecting else { return }
        session.startCapturing()
    }

    /// Adds another pass around the object (e.g. after flipping it over).
    func continueScanning() {
        guard let session else { return }
        if session.feedback.contains(.objectNotFlippable) {
            session.beginNewScanPass()
        } else {
            session.beginNewScanPassAfterFlip()
        }
    }

    /// Ends capture; reconstruction kicks off once the session reports `.completed`.
    func finishCapture() {
        session?.finish()
    }

    func handleSessionStateChange(_ state: ObjectCaptureSession.CaptureState) {
        switch state {
        case .completed:
            session = nil
            startReconstruction()
        case .failed(let error):
            logger.error("Capture failed: \(String(describing: error))")
            session = nil
            fail("The capture session stopped: \(error.localizedDescription)")
        default:
            break
        }
    }

    // MARK: - Reconstruction

    private func startReconstruction() {
        guard let root = scanDirectory else {
            fail("The captured images are missing.")
            return
        }
        phase = .reconstructing
        reconstructionProgress = 0

        let images = root.appending(path: "Images/")
        let checkpoint = root.appending(path: "Checkpoint/")
        let output = root.appending(path: "Model.usdz")

        reconstructionTask = Task { [weak self] in
            do {
                var configuration = PhotogrammetrySession.Configuration()
                configuration.checkpointDirectory = checkpoint

                let photogrammetry = try PhotogrammetrySession(input: images,
                                                               configuration: configuration)
                try photogrammetry.process(requests: [.modelFile(url: output)])

                for try await outputMessage in photogrammetry.outputs {
                    if Task.isCancelled { return }
                    switch outputMessage {
                    case .requestProgress(_, let fraction):
                        await MainActor.run { self?.reconstructionProgress = fraction }
                    case .requestComplete(_, let result):
                        if case .modelFile(let url) = result {
                            await MainActor.run { self?.finishReconstruction(with: url) }
                        }
                    case .requestError(_, let error):
                        await MainActor.run {
                            self?.fail("Reconstruction failed: \(error.localizedDescription)")
                        }
                    case .processingComplete:
                        return
                    default:
                        continue
                    }
                }
            } catch {
                await MainActor.run {
                    self?.fail("Reconstruction couldn't start: \(error.localizedDescription)")
                }
            }
        }
    }

    private func finishReconstruction(with url: URL) {
        reconstructionProgress = 1
        modelURL = url
        phase = .viewing
    }

    // MARK: - Lifecycle

    func reset() {
        reconstructionTask?.cancel()
        reconstructionTask = nil
        session = nil
        modelURL = nil
        reconstructionProgress = 0
        phase = .welcome
    }

    private func fail(_ message: String) {
        logger.error("\(message, privacy: .public)")
        phase = .failed(message)
    }

    private func makeScanDirectory() throws -> URL {
        let root = URL.documentsDirectory
            .appending(path: "Scans/\(UUID().uuidString)/", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: root.appending(path: "Images/"),
                                                withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: root.appending(path: "Checkpoint/"),
                                                withIntermediateDirectories: true)
        return root
    }
}
